const path = require('path');
const { findCDPPort, findAntigravityPID, getTargets, filterPageTargets } = require('./discovery');
const CDPConnection = require('./cdp-connection');
const ConfigStore = require('./config-store');
const ActivityStore = require('./activity-store');

const DEBUG = process.env.DEBUG === '1';
const LOG_PREFIX = '[AutoRetry]';

class AutoRetryDaemon {
  constructor() {
    this.connections = new Map(); // targetId -> CDPConnection
    
    const projectRoot = path.join(__dirname, '..', '..');
    this.configStore = new ConfigStore(path.join(projectRoot, 'config.json'));
    this.activityStore = new ActivityStore(path.join(projectRoot, 'logs'));
    
    this.lastPID = null;
    this.running = false;

    // Watch for config changes to trigger re-injection
    this.configStore.onConfigChange(() => {
      this.debug('Config changed, marking connections for re-injection');
      for (const conn of this.connections.values()) {
        conn.injected = false; 
      }
    });
  }

  log(msg) {
    const ts = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    console.log(`${LOG_PREFIX} [${ts}] ${msg}`);
  }

  debug(msg) {
    if (DEBUG) this.log(`[DEBUG] ${msg}`);
  }

  error(msg) {
    const ts = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    console.error(`${LOG_PREFIX} [${ts}] [ERROR] ${msg}`);
  }

  updateActivity(text) {
    if (this.activityStore.update(text)) {
      this.debug(`Activity updated: ${text.split('[STAT] ')[1]}`);
    }
  }

  async start() {
    this.log('🚀 Starting Antigravity Auto-Click Daemon...');
    this.log(`Debug mode: ${DEBUG ? 'ON' : 'OFF'}`);
    this.running = true;

    process.on('SIGINT', () => this.stop('SIGINT'));
    process.on('SIGTERM', () => this.stop('SIGTERM'));

    while (this.running) {
      try {
        await this.cycle();
      } catch (e) {
        this.error(`Cycle error: ${e.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  async cycle() {
    const currentPID = findAntigravityPID();
    
    if (!currentPID) {
      if (this.connections.size > 0) {
        this.log('Antigravity stopped. Cleaning up connections...');
        this.disconnectAll();
      }
      this.lastPID = null;
      this.debug('Antigravity not running.');
      return;
    }

    if (this.lastPID && this.lastPID !== currentPID) {
      this.log(`🔄 Restart detected (PID: ${this.lastPID} -> ${currentPID}). Resetting...`);
      this.disconnectAll();
    }
    this.lastPID = currentPID;

    const port = findCDPPort();
    if (!port) {
      this.debug('CDP port not found.');
      return;
    }

    let targets;
    try {
      targets = await getTargets(port);
      this.debug(`CDP returned ${targets.length} total target(s) on port ${port}`);
    } catch (e) {
      this.debug(`Failed to get targets: ${e.message}`);
      return;
    }

    const pageTargets = filterPageTargets(targets);
    this.debug(
      `Filtered to ${pageTargets.length} page target(s): ` +
      pageTargets.map(t => `${t.title || '<untitled>'} <${t.url || 'no-url'}> [${t.id}]`).join(' | ')
    );
    const config = this.configStore.get();

    // Connect & inject into new targets
    await Promise.all(pageTargets.map(async (target) => {
      if (!this.connections.has(target.id)) {
        const conn = new CDPConnection(target, this);
        try {
          await conn.connect();
          await conn.inject(config);
          await conn.setupAutoReinject();
          this.connections.set(target.id, conn);
        } catch (e) {
          this.debug(`Failed to connect to ${target.title}: ${e.message}`);
          conn.disconnect();
        }
      } else {
        const conn = this.connections.get(target.id);
        if (!conn.isConnected) {
          this.connections.delete(target.id);
        } else if (!conn.injected) {
          await conn.inject(config);
        }
      }
    }));

    // Clean up stale connections
    const activeIds = new Set(pageTargets.map(t => t.id));
    for (const [id, conn] of this.connections) {
      if (!activeIds.has(id)) {
        conn.disconnect();
        this.connections.delete(id);
      }
    }
  }

  disconnectAll() {
    for (const conn of this.connections.values()) {
      conn.disconnect();
    }
    this.connections.clear();
  }

  stop(signal) {
    this.log(`🛑 Stopping (${signal})...`);
    this.running = false;
    this.disconnectAll();
    process.exit(0);
  }
}

module.exports = AutoRetryDaemon;
