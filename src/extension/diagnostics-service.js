const fs = require('fs');
const cp = require('child_process');
const { inspectConfig } = require('./config-service');
const { getStoragePaths } = require('../core/storage-paths');

function createDiagnosticsService(daemonService) {
  function getRecentLogs(lines = 50) {
    const logPath = getStoragePaths().daemonLogPath;
    if (!fs.existsSync(logPath)) return 'Log file not found.';
    
    try {
      // Use tail if on mac/linux, otherwise read file
      if (process.platform !== 'win32') {
        return cp.execSync(`tail -n ${lines} "${logPath}"`).toString();
      } else {
        const content = fs.readFileSync(logPath, 'utf8');
        return content.split('\n').slice(-lines).join('\n');
      }
    } catch (error) {
      return `Error reading logs: ${error.message}`;
    }
  }

  function checkCdpState() {
    // Basic check: see if any process has --remote-debugging-port
    try {
      const output = cp.execSync('ps aux | grep remote-debugging-port | grep -v grep || true').toString();
      const match = output.match(/--remote-debugging-port=(\d+)/);
      if (match) {
        return {
          detected: true,
          port: match[1],
          raw: output.split('\n')[0].trim().substring(0, 100) + '...'
        };
      }
    } catch (e) {
      // ignore
    }
    return { detected: false };
  }

  function getSystemDiagnostics() {
    const daemonState = daemonService.getState();
    const configInspection = inspectConfig();
    const cdp = checkCdpState();
    
    // Check if activity-log.json exists and is writable
    const activityLogPath = getStoragePaths().activityLogPath;
    let activityLogState = 'missing';
    if (fs.existsSync(activityLogPath)) {
      try {
        fs.accessSync(activityLogPath, fs.constants.R_OK | fs.constants.W_OK);
        activityLogState = 'ready';
      } catch (e) {
        activityLogState = 'locked/readonly';
      }
    }

    return {
      daemon: daemonState,
      config: {
        valid: configInspection.warnings.length === 0,
        warnings: configInspection.warnings
      },
      cdp,
      files: {
        activityLog: activityLogState
      },
      timestamp: Date.now()
    };
  }

  return {
    getRecentLogs,
    getSystemDiagnostics
  };
}

module.exports = {
  createDiagnosticsService
};
