const cp = require('child_process');
const path = require('path');

function createDaemonService(outputChannel) {
  let daemonProcess = null;
  let lastStartTime = 0;

  function getScriptPath() {
    return path.join(__dirname, '..', 'core', 'auto-retry.js');
  }

  function getStopScriptPath() {
    return path.join(__dirname, '..', '..', 'scripts', 'core', 'stop.sh');
  }

  function isRunning() {
    return !!daemonProcess;
  }

  function getState() {
    return {
      running: isRunning(),
      lastStartTime
    };
  }

  function start() {
    if (daemonProcess) return getState();

    const scriptPath = getScriptPath();
    outputChannel.appendLine(`[Extension] Starting daemon: node ${scriptPath}`);

    daemonProcess = cp.spawn('node', [scriptPath], {
      env: { ...process.env, DEBUG: process.env.DEBUG || '1' }
    });
    lastStartTime = Date.now();

    daemonProcess.stdout.on('data', (data) => {
      outputChannel.append(data.toString());
    });

    daemonProcess.stderr.on('data', (data) => {
      outputChannel.append(`[ERROR] ${data.toString()}`);
    });

    daemonProcess.on('close', (code) => {
      outputChannel.appendLine(`[Extension] Daemon exited with code ${code}`);
      daemonProcess = null;
    });

    return getState();
  }

  function stop() {
    return new Promise((resolve) => {
      cp.execFile('bash', [getStopScriptPath()], (error, stdout, stderr) => {
        if (stdout) outputChannel.append(stdout);
        if (stderr) outputChannel.append(`[ERROR] ${stderr}`);
        if (error) outputChannel.appendLine(`[Extension] Stop warning: ${error.message}`);

        if (daemonProcess) daemonProcess.kill();
        daemonProcess = null;
        resolve(getState());
      });
    });
  }

  async function reload() {
    await stop();
    return start();
  }

  function dispose() {
    if (daemonProcess) {
      daemonProcess.kill();
      daemonProcess = null;
    }
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
