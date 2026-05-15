const cp = require('child_process');
const path = require('path');

function createDaemonService(outputChannel) {
  let daemonProcess = null;
  let lastStartTime = 0;
  let status = 'stopped'; // stopped, starting, running, stopping, reloading

  function getScriptPath() {
    return path.join(__dirname, '..', 'core', 'auto-retry.js');
  }

  function getStopScriptPath() {
    return path.join(__dirname, '..', '..', 'scripts', 'core', 'stop.sh');
  }

  function isRunning() {
    if (status === 'running' || status === 'starting') return true;
    
    // Check for external process (including background daemon or other VS Code instances)
    try {
      // Use pgrep with full command line match to find the specific script
      cp.execSync('pgrep -f "node.*src/core/auto-retry.js"');
      return true;
    } catch (e) {
      return false;
    }
  }

  function getState() {
    const running = isRunning();
    // If it's running but we thought it was stopped, sync it
    if (running && status === 'stopped') {
      status = 'running';
    } else if (!running && status === 'running') {
      status = 'stopped';
    }

    return {
      running,
      status,
      lastStartTime
    };
  }

  let lastConfigPath = null;
  let lastLogsDir = null;

  function start(configPath, logsDir) {
    if (status === 'starting' || status === 'running' || status === 'reloading') {
      return getState();
    }
    
    lastConfigPath = configPath || lastConfigPath;
    lastLogsDir = logsDir || lastLogsDir;
    
    // Double check if already running externally
    if (isRunning()) {
      status = 'running';
      return getState();
    }

    status = 'starting';
    const scriptPath = getScriptPath();
    const args = [scriptPath];
    if (lastConfigPath) args.push('--config', lastConfigPath);
    if (lastLogsDir) args.push('--logs', lastLogsDir);

    outputChannel.appendLine(`[Extension] Starting daemon: node ${args.join(' ')}`);

    try {
      daemonProcess = cp.spawn('node', args, {
        env: { ...process.env, DEBUG: process.env.DEBUG || '1' }
      });
      lastStartTime = Date.now();
      status = 'running';

      daemonProcess.stdout.on('data', (data) => {
        outputChannel.append(data.toString());
      });

      daemonProcess.stderr.on('data', (data) => {
        outputChannel.append(`[ERROR] ${data.toString()}`);
      });

      daemonProcess.on('close', (code) => {
        outputChannel.appendLine(`[Extension] Daemon exited with code ${code}`);
        daemonProcess = null;
        if (status !== 'reloading' && status !== 'stopping') {
          status = 'stopped';
        }
      });
    } catch (error) {
      outputChannel.appendLine(`[ERROR] Failed to start daemon: ${error.message}`);
      status = 'stopped';
    }

    return getState();
  }

  async function stop() {
    if (status === 'stopped' || status === 'stopping') {
      return getState();
    }

    status = 'stopping';
    outputChannel.appendLine('[Extension] Stopping daemon...');

    return new Promise((resolve) => {
      cp.execFile('bash', [getStopScriptPath()], (error, stdout, stderr) => {
        if (stdout) outputChannel.append(stdout);
        if (stderr) outputChannel.append(`[ERROR] ${stderr}`);
        if (error) outputChannel.appendLine(`[Extension] Stop warning: ${error.message}`);

        if (daemonProcess) {
          daemonProcess.kill();
          daemonProcess = null;
        }
        
        status = 'stopped';
        resolve(getState());
      });
    });
  }

  async function reload() {
    status = 'reloading';
    outputChannel.appendLine('[Extension] Reloading daemon...');
    
    await stop();
    const result = start(lastConfigPath, lastLogsDir);
    
    if (result.status === 'running') {
      outputChannel.appendLine('[Extension] Daemon reloaded successfully.');
    }
    return result;
  }

  function dispose() {
    if (daemonProcess) {
      daemonProcess.kill();
      daemonProcess = null;
    }
    status = 'stopped';
  }

  return {
    dispose,
    getState,
    isRunning,
    reload,
    start,
    stop
  };
}

module.exports = {
  createDaemonService
};
