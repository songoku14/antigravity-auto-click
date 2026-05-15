const AutoRetryDaemon = require('./daemon');
const { getStoragePaths } = require('./storage-paths');

// Simple CLI arg parser
const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(name);
  return (idx !== -1 && args[idx + 1]) ? args[idx + 1] : null;
};

const defaults = getStoragePaths();
const configPath = getArg('--config') || defaults.configPath;
const logsDir = getArg('--logs') || defaults.logsDir;

const daemon = new AutoRetryDaemon(configPath, logsDir);

daemon.start().catch(e => {
  console.error(`[AutoRetry] [FATAL] ${e.message}`);
  process.exit(1);
});
