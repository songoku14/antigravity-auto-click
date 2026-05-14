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
    
    // Check for external process
    try {
      cp.execSync('pgrep -f "node.*[s]rc/core/auto-retry.js"');
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

  function start() {
    if (status === 'starting' || status === 'running' || status === 'reloading') {
      return getState();
    }

    // Double check if already running externally
    if (isRunning()) {
      status = 'running';
      return getState();
    }

    status = 'starting';
    const scriptPath = getScriptPath();
    outputChannel.appendLine(`[Extension] Starting daemon: node ${scriptPath}`);

    try {
      daemonProcess = cp.spawn('node', [scriptPath], {
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
    const oldStatus = status;
    status = 'reloading';
    outputChannel.appendLine('[Extension] Reloading daemon...');
    
    await stop();
    const result = start();
    
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
