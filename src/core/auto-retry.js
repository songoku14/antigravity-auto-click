/**
 * auto-retry.js - Entry point for Antigravity Auto-Click Daemon
 */

const AutoRetryDaemon = require('./daemon');

const daemon = new AutoRetryDaemon();

daemon.start().catch(e => {
  console.error(`[AutoRetry] [FATAL] ${e.message}`);
  process.exit(1);
});
