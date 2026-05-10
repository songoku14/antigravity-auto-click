/**
 * auto-retry.js - Main orchestrator for Antigravity Auto-Retry
 * 
 * Connects to Antigravity via Chrome DevTools Protocol (CDP),
 * injects MutationObserver into renderer pages to auto-click
 * "Retry" button when "High Traffic" error dialogs appear.
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { findCDPPort, isAntigravityRunning, getTargets, filterPageTargets } = require('./discovery');
const { getInjectionScript } = require('./injection-payload');

const DEBUG = process.env.DEBUG === '1';
const LOG_PREFIX = '[AutoRetry]';

// ============================================================
// Logging
// ============================================================

function log(msg) {
  const ts = new Date().toLocaleTimeString('vi-VN', { hour12: false });
  console.log(`${LOG_PREFIX} [${ts}] ${msg}`);
}

function debug(msg) {
  if (DEBUG) log(`[DEBUG] ${msg}`);
}

function error(msg) {
  const ts = new Date().toLocaleTimeString('vi-VN', { hour12: false });
  console.error(`${LOG_PREFIX} [${ts}] [ERROR] ${msg}`);
}

// ============================================================
// CDP Connection Manager
// ============================================================

class CDPConnection {
  constructor(target) {
    this.target = target;
    this.ws = null;
    this.msgId = 1;
    this.pendingCallbacks = new Map();
    this.isConnected = false;
    this.injected = false;
    this.config = null;
  }

  /**
   * Kết nối WebSocket đến CDP target
   */
  connect() {
    return new Promise((resolve, reject) => {
      const url = this.target.webSocketDebuggerUrl;
      debug(`Connecting to ${this.target.title} at ${url}`);

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
        log(`Connected to: ${this.target.title} (${this.target.id})`);
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          
          // Handle response to our commands
          if (msg.id && this.pendingCallbacks.has(msg.id)) {
            const cb = this.pendingCallbacks.get(msg.id);
            this.pendingCallbacks.delete(msg.id);
            if (msg.error) {
              cb.reject(new Error(msg.error.message));
            } else {
              cb.resolve(msg.result);
            }
          }

          // Handle console messages from injected script
          if (msg.method === 'Runtime.consoleAPICalled') {
            const args = msg.params.args || [];
            const text = args.map(a => a.value || a.description || '').join(' ');
            if (text.includes('[AutoRetry]')) {
              log(`[${this.target.title}] ${text}`);
            }
          }
        } catch (e) {
          debug(`Message parse error: ${e.message}`);
        }
      });

      this.ws.on('close', () => {
        this.isConnected = false;
        this.injected = false;
        log(`Disconnected from: ${this.target.title}`);
      });

      this.ws.on('error', (err) => {
        clearTimeout(timeout);
        this.isConnected = false;
        debug(`WebSocket error for ${this.target.title}: ${err.message}`);
        reject(err);
      });
    });
  }

  /**
   * Gửi CDP command
   */
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected || !this.ws) {
        return reject(new Error('Not connected'));
      }

      const id = this.msgId++;
      const msg = JSON.stringify({ id, method, params });

      this.pendingCallbacks.set(id, { resolve, reject });

      // Timeout for individual commands
      setTimeout(() => {
        if (this.pendingCallbacks.has(id)) {
          this.pendingCallbacks.delete(id);
          reject(new Error(`Command timeout: ${method}`));
        }
      }, 15000);

      this.ws.send(msg);
    });
  }

  /**
   * Enable console log forwarding từ injected script
   */
  async enableConsole() {
    try {
      await this.send('Runtime.enable');
      debug(`Console enabled for ${this.target.title}`);
    } catch (e) {
      debug(`Failed to enable console for ${this.target.title}: ${e.message}`);
    }
  }

  /**
   * Inject cleanup script to kill old versions' intervals/observers
   */
  async injectCleanup() {
    const cleanupScript = `
(function() {
  // Call cleanup if available (from v3+)
  if (window.__autoRetryCleanup) {
    window.__autoRetryCleanup();
  }
  // Nuclear option: clear ALL intervals/timeouts set by old scripts
  // We save current max ID, then clear everything below it
  if (!window.__autoRetryCleanedUp) {
    window.__autoRetryCleanedUp = true;
    window.__autoRetryInjected = false;
    window.__autoRetryVersion = 0;
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
      debug(`Cleanup done for ${this.target.title}`);
      // Wait for old intervals to fire one last time and see the flag
      await new Promise(r => setTimeout(r, 3000));
    } catch (e) {
      debug(`Cleanup failed for ${this.target.title}: ${e.message}`);
    }
  }

  /**
   * Inject auto-retry script vào page
   */
  async inject(config = {}) {
    if (this.injected && JSON.stringify(this.config) === JSON.stringify(config)) {
      debug(`Already injected into ${this.target.title} with current config`);
      return;
    }

    try {
      await this.enableConsole();

      // Step 1: Clean up old versions first
      await this.injectCleanup();

      this.config = config;
      const script = getInjectionScript(config);
      const result = await this.send('Runtime.evaluate', {
        expression: script,
        returnByValue: true,
        awaitPromise: false
      });

      const value = result?.result?.value;
      if (value === 'injection_success') {
        this.injected = true;
        log(`✅ Injected into: ${this.target.title}`);
      } else if (value === 'already_injected') {
        this.injected = true;
        debug(`Already injected into ${this.target.title}`);
      } else {
        error(`Unexpected injection result for ${this.target.title}: ${JSON.stringify(result)}`);
      }
    } catch (e) {
      error(`Injection failed for ${this.target.title}: ${e.message}`);
    }
  }

  /**
   * Re-inject khi page navigate/reload  
   */
  async setupAutoReinject() {
    try {
      await this.send('Page.enable');

      // Listen for page load events
      this.ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.method === 'Page.loadEventFired' || 
              msg.method === 'Page.domContentEventFired') {
            log(`Page reloaded in ${this.target.title}, re-injecting...`);
            this.injected = false;
            setTimeout(() => this.inject(), 2000);
          }
        } catch (e) {
          // ignore
        }
      });

      debug(`Auto-reinject setup for ${this.target.title}`);
    } catch (e) {
      debug(`Failed to setup auto-reinject for ${this.target.title}: ${e.message}`);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.injected = false;
  }
}

// ============================================================
// Main Daemon
// ============================================================

class AutoRetryDaemon {
  constructor() {
    this.connections = new Map(); // targetId -> CDPConnection
    this.running = false;
    this.config = this.loadConfig();
    this.setupConfigWatcher();
  }

  loadConfig() {
    const configPath = path.join(__dirname, '..', 'config.json');
    try {
      if (fs.existsSync(configPath)) {
        const data = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(data);
        log('Loaded config from config.json');
        return config;
      }
    } catch (e) {
      error(`Failed to load config: ${e.message}`);
    }
    return { blacklist: [], autoAccept: true, autoRetry: true };
  }

  setupConfigWatcher() {
    const configPath = path.join(__dirname, '..', 'config.json');
    if (!fs.existsSync(configPath)) return;

    fs.watch(configPath, (event) => {
      if (event === 'change') {
        debug('Config file changed, reloading...');
        // Small delay to ensure file is written
        setTimeout(() => {
          this.config = this.loadConfig();
          // Force re-injection on next cycle
          for (const conn of this.connections.values()) {
            conn.injected = false; 
          }
        }, 500);
      }
    });
  }

  async start() {
    log('🚀 Starting Antigravity Auto-Retry Daemon...');
    log(`Debug mode: ${DEBUG ? 'ON' : 'OFF'}`);
    this.running = true;

    // Graceful shutdown
    process.on('SIGINT', () => this.stop('SIGINT'));
    process.on('SIGTERM', () => this.stop('SIGTERM'));

    // Main loop
    await this.mainLoop();
  }

  async mainLoop() {
    while (this.running) {
      try {
        await this.cycle();
      } catch (e) {
        error(`Cycle error: ${e.message}`);
      }
      // Wait before next cycle
      await this.sleep(5000);
    }
  }

  async cycle() {
    // Step 1: Check if Antigravity is running
    if (!isAntigravityRunning()) {
      if (this.connections.size > 0) {
        log('Antigravity stopped. Cleaning up connections...');
        this.disconnectAll();
      }
      debug('Antigravity not running. Waiting...');
      return;
    }

    // Step 2: Find CDP port
    const port = findCDPPort();
    if (!port) {
      debug('CDP port not found. Waiting...');
      return;
    }
    debug(`CDP port: ${port}`);

    // Step 3: Get targets
    let targets;
    try {
      targets = await getTargets(port);
    } catch (e) {
      debug(`Failed to get targets: ${e.message}`);
      return;
    }

    // Step 4: Filter page targets
    const pageTargets = filterPageTargets(targets);
    debug(`Found ${pageTargets.length} page targets`);

    // Step 5: Connect & inject into new targets
    for (const target of pageTargets) {
      if (!this.connections.has(target.id)) {
        const conn = new CDPConnection(target);
        try {
          await conn.connect();
          await conn.inject(this.config);
          await conn.setupAutoReinject();
          this.connections.set(target.id, conn);
        } catch (e) {
          debug(`Failed to connect to ${target.title}: ${e.message}`);
          conn.disconnect();
        }
      } else {
        // Re-inject if disconnected or config changed
        const conn = this.connections.get(target.id);
        if (!conn.isConnected) {
          this.connections.delete(target.id);
          debug(`Removed stale connection: ${target.title}`);
        } else if (!conn.injected) {
          await conn.inject(this.config);
        }
      }
    }

    // Step 6: Clean up stale connections
    const activeIds = new Set(pageTargets.map(t => t.id));
    for (const [id, conn] of this.connections) {
      if (!activeIds.has(id)) {
        debug(`Cleaning up stale target: ${id}`);
        conn.disconnect();
        this.connections.delete(id);
      }
    }
  }

  disconnectAll() {
    for (const [id, conn] of this.connections) {
      conn.disconnect();
    }
    this.connections.clear();
  }

  stop(signal) {
    log(`\n🛑 Stopping (${signal})...`);
    this.running = false;
    this.disconnectAll();
    process.exit(0);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================
// Entry Point
// ============================================================

const daemon = new AutoRetryDaemon();
daemon.start().catch(e => {
  error(`Fatal: ${e.message}`);
  process.exit(1);
});
