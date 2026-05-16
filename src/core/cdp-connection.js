const WebSocket = require('ws');
const { getInjectionScript } = require('../payload/injection-payload');

class CDPConnection {
  constructor(target, daemon = null) {
    this.target = target;
    this.daemon = daemon;
    this.ws = null;
    this.msgId = 1;
    this.pendingCallbacks = new Map();
    this.isConnected = false;
    this.injected = false;
    this.injectInFlight = null;
    this.reinjectTimer = null;
    this.config = null;
    this.logPrefix = `[CDP:${target.title}]`;
  }

  log(msg) {
    if (this.daemon) {
      this.daemon.log(`${this.logPrefix} ${msg}`);
    } else {
      if (this.config?.logging?.enabled === false) return;
      console.log(`${this.logPrefix} ${msg}`);
    }
  }

  debug(msg) {
    if (this.daemon) {
      this.daemon.debug(`${this.logPrefix} ${msg}`);
    } else {
      const debugEnabled = this.config?.debug === true || process.env.DEBUG === '1';
      if (debugEnabled) {
        if (this.config?.logging?.enabled === false) return;
        console.log(`${this.logPrefix} [DEBUG] ${msg}`);
      }
    }
  }

  error(msg) {
    if (this.daemon) {
      this.daemon.error(`${this.logPrefix} ${msg}`);
    } else {
      if (this.config?.logging?.enabled === false) return;
      console.error(`${this.logPrefix} [ERROR] ${msg}`);
    }
  }

  connect() {
    return new Promise((resolve, reject) => {
      const url = this.target.webSocketDebuggerUrl;
      this.debug(`Connecting to ${url} (title="${this.target.title}", url="${this.target.url || ''}")`);

      this.ws = new WebSocket(url, {
        perMessageDeflate: false,
        maxPayload: 256 * 1024 * 1024 // 256MB
      });

      const timeout = setTimeout(() => {
        this.ws.terminate();
        reject(new Error(`Connection timeout for ${this.target.title}`));
      }, 10000);

      this.ws.on('open', () => {
        clearTimeout(timeout);
        this.isConnected = true;
        this.log(`Connected (ID: ${this.target.id})`);
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          
          if (msg.id && this.pendingCallbacks.has(msg.id)) {
            const cb = this.pendingCallbacks.get(msg.id);
            this.pendingCallbacks.delete(msg.id);
            if (msg.error) {
              cb.reject(new Error(msg.error.message));
            } else {
              cb.resolve(msg.result);
            }
          }

          if (msg.method === 'Runtime.consoleAPICalled') {
            const args = msg.params.args || [];
            const text = args.map(a => a.value || a.description || '').join(' ');
            if (text.includes('[AutoRetry]')) {
              this.log(text);
              if (text.includes('[STAT]') && this.daemon) {
                this.daemon.updateActivity(text);
              }
            }
          }
        } catch (e) {
          this.debug(`Message parse error: ${e.message}`);
        }
      });

      this.ws.on('close', () => {
        this.isConnected = false;
        this.injected = false;
        this.log(`Disconnected`);
      });

      this.ws.on('error', (err) => {
        clearTimeout(timeout);
        this.isConnected = false;
        this.debug(`WebSocket error: ${err.message}`);
        reject(err);
      });
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected || !this.ws) {
        return reject(new Error('Not connected'));
      }

      const id = this.msgId++;
      const msg = JSON.stringify({ id, method, params });

      this.pendingCallbacks.set(id, { resolve, reject });

      setTimeout(() => {
        if (this.pendingCallbacks.has(id)) {
          this.pendingCallbacks.delete(id);
          reject(new Error(`Command timeout: ${method}`));
        }
      }, 15000);

      this.ws.send(msg);
    });
  }

  async enableConsole() {
    try {
      await this.send('Runtime.enable');
      this.debug(`Console enabled`);
    } catch (e) {
      this.debug(`Failed to enable console: ${e.message}`);
    }
  }

  async injectCleanup() {
    const cleanupScript = `
(function() {
  if (window.__autoRetryCleanup) {
    window.__autoRetryCleanup();
  }
  window.__autoRetryCleanedUp = true;
  window.__autoRetryInjected = false;
  window.__autoRetryVersion = 0;
  if (!window.__autoRetryCleanup) {
    console.log('[AutoRetry] Cleanup: old scripts neutralized.');
  }
  return 'cleanup_done';
})();
`;
    try {
      await this.send('Runtime.evaluate', {
        expression: cleanupScript,
        returnByValue: true,
        awaitPromise: false
      });
      this.debug(`Cleanup done`);
      await new Promise(r => setTimeout(r, 3000));
    } catch (e) {
      this.debug(`Cleanup failed: ${e.message}`);
    }
  }

  async inject(config = {}) {
    if (this.injectInFlight) {
      this.debug(`Injection already in progress for "${this.target.title}"`);
      return this.injectInFlight;
    }

    if (this.injected && JSON.stringify(this.config) === JSON.stringify(config)) {
      this.debug(`Already injected with current config`);
      return;
    }

    this.injectInFlight = (async () => {
      try {
        await this.enableConsole();
        await this.injectCleanup();

        this.config = config;
        this.debug(
          `Injecting script into target "${this.target.title}" (${this.target.id}) with config ${JSON.stringify(config)}`
        );
        const script = getInjectionScript(config);
        const result = await this.send('Runtime.evaluate', {
          expression: script,
          returnByValue: true,
          awaitPromise: false
        });

        const value = result?.result?.value;
        if (value === 'injection_success') {
          this.injected = true;
          this.log(`✅ Injection successful`);
        } else if (value === 'already_injected') {
          this.injected = true;
          this.log(`ℹ️ Already has active script.`);
        } else {
          this.error(`Unexpected injection result: ${JSON.stringify(result)}`);
        }
      } catch (e) {
        this.error(`Injection failed: ${e.message}`);
      } finally {
        this.injectInFlight = null;
      }
    })();

    return this.injectInFlight;
  }

  async setupAutoReinject() {
    try {
      await this.send('Page.enable');
      this.ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.method === 'Page.loadEventFired' || 
              msg.method === 'Page.domContentEventFired') {
            this.log(`Page reloaded, re-injecting in 2s...`);
            this.injected = false;
            if (this.reinjectTimer) clearTimeout(this.reinjectTimer);
            this.reinjectTimer = setTimeout(() => {
              this.reinjectTimer = null;
              this.inject(this.config);
            }, 2000);
          }
        } catch (e) {}
      });
      this.debug(`Auto-reinject setup done`);
    } catch (e) {
      this.debug(`Failed to setup auto-reinject: ${e.message}`);
    }
  }

  disconnect() {
    if (this.reinjectTimer) {
      clearTimeout(this.reinjectTimer);
      this.reinjectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.injected = false;
  }
}

module.exports = CDPConnection;
