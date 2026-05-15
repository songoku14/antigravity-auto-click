const path = require('path');
const AutoRetryDaemon = require('./daemon');

// Simple CLI arg parser
const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(name);
  return (idx !== -1 && args[idx + 1]) ? args[idx + 1] : null;
};

const projectRoot = path.join(__dirname, '..', '..');
const configPath = getArg('--config') || path.join(projectRoot, 'config.json');
const logsDir = getArg('--logs') || path.join(projectRoot, 'logs');

const daemon = new AutoRetryDaemon(configPath, logsDir);

daemon.start().catch(e => {
  console.error(`[AutoRetry] [FATAL] ${e.message}`);
  process.exit(1);
});
