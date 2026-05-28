const cp = require('child_process');
const path = require('path');
const fs = require('fs');
const { findCDPPort } = require('../core/discovery');

const hasIdeApp = fs.existsSync('/Applications/Antigravity IDE.app');
const appPath = hasIdeApp ? '/Applications/Antigravity IDE.app' : '/Applications/Antigravity.app';
const appName = hasIdeApp ? 'Antigravity IDE' : 'Antigravity';

function createDaemonService(outputChannel) {
  let daemonProcess = null;
  let lastStartTime = 0;
  let status = 'stopped'; // stopped, starting, running, stopping, reloading

  let cachedCdpState = { detected: false, port: null };
  let cdpCheckInterval = null;
  const stateChangeEmitter = new (require('events').EventEmitter)();

  function checkCdpStatus() {
    const port = findCDPPort();
    if (process.env.DEBUG) {
      outputChannel.appendLine(`[Extension] checkCdpStatus - findCDPPort returned: ${port}`);
    }
    if (!port) {
      if (cachedCdpState.detected) {
        cachedCdpState = { detected: false, port: null };
        stateChangeEmitter.emit('change');
      }
      return;
    }

    const http = require('http');
    const req = http.get(`http://127.0.0.1:${port}/json`, (res) => {
      const isOk = res.statusCode === 200;
      if (process.env.DEBUG) {
        outputChannel.appendLine(`[Extension] checkCdpStatus - http get status: ${res.statusCode}`);
      }
      if (cachedCdpState.detected !== isOk || cachedCdpState.port !== port) {
        cachedCdpState = { detected: isOk, port: isOk ? port : null };
        stateChangeEmitter.emit('change');
      }
    }).on('error', (err) => {
      if (process.env.DEBUG) {
        outputChannel.appendLine(`[Extension] checkCdpStatus - http get error: ${err.message}`);
      }
      if (cachedCdpState.detected) {
        cachedCdpState = { detected: false, port: null };
        stateChangeEmitter.emit('change');
      }
    });
    req.setTimeout(1000, () => req.destroy());
  }

  function startCdpChecker() {
    if (!cdpCheckInterval) {
      checkCdpStatus(); // initial check
      cdpCheckInterval = setInterval(checkCdpStatus, 2000);
    }
  }

  function stopCdpChecker() {
    if (cdpCheckInterval) {
      clearInterval(cdpCheckInterval);
      cdpCheckInterval = null;
    }
    if (cachedCdpState.detected) {
      cachedCdpState = { detected: false, port: null };
      stateChangeEmitter.emit('change');
    }
  }

  function getScriptPath() {
    return path.join(__dirname, '..', 'core', 'auto-retry.js');
  }

  function getStopScriptPath() {
    return path.join(__dirname, '..', '..', 'scripts', 'core', 'stop.sh');
  }

  function isRunning() {
    // If we are stopping, we should report based on the actual process check
    // but if we are starting/running/reloading we can trust our state temporarily
    // unless we need a fresh check.
    
    // Perform a fresh check for external process
    try {
      // Use pgrep with full command line match to find the specific script
      cp.execSync('pgrep -f "node.*src/core/auto-retry.js"');
      return true;
    } catch (e) {
      // If it's starting, give it a bit of grace period (3 seconds)
      if (status === 'starting' && (Date.now() - lastStartTime < 3000)) {
        return true;
      }
      return false;
    }
  }

  function getState() {
    const running = isRunning();
    
    // Sync internal status with actual process state
    if (running) {
      if (status === 'stopped' || status === 'stopping') {
        status = 'running';
      }
    } else {
      if (status === 'running' || status === 'starting' || status === 'reloading') {
        status = 'stopped';
      }
    }

    return {
      running,
      status,
      lastStartTime,
      cdp: {
        detected: cachedCdpState.detected,
        port: cachedCdpState.port
      }
    };
  }

  let lastConfigPath = null;
  let lastLogsDir = null;

  function start(configPath, logsDir) {
    if (status === 'starting' || status === 'running' || status === 'reloading') {
      startCdpChecker();
      return getState();
    }
    
    lastConfigPath = configPath ? path.resolve(configPath) : lastConfigPath;
    lastLogsDir = logsDir ? path.resolve(logsDir) : lastLogsDir;
    
    // Double check if already running externally
    if (isRunning()) {
      status = 'running';
      startCdpChecker();
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
      startCdpChecker();

      daemonProcess.stdout.on('data', (data) => {
        outputChannel.append(data.toString());
      });

      daemonProcess.stderr.on('data', (data) => {
        outputChannel.append(`[ERROR] ${data.toString()}`);
      });

      daemonProcess.on('close', (code) => {
        outputChannel.appendLine(`[Extension] Daemon exited with code ${code}`);
        daemonProcess = null;
        stopCdpChecker();
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
    stopCdpChecker();
    if (daemonProcess) {
      daemonProcess.kill();
      daemonProcess = null;
    }
    status = 'stopped';
  }

  return {
    onStateChange: (cb) => stateChangeEmitter.on('change', cb),
    dispose,
    getState,
    isRunning,
    reload,
    start,
    stop,
    copyCDPCommand: () => {
      const launchCmd = `open -a "${appPath}" --args --remote-debugging-port=31905`;
      try {
        cp.execSync(`printf '${launchCmd}' | pbcopy`);
        outputChannel.appendLine('[Extension] Launch command copied to clipboard.');
        return true;
      } catch (err) {
        outputChannel.appendLine(`[ERROR] Failed to copy command: ${err.message}`);
        return false;
      }
    },
    quitAntigravity: () => {
      outputChannel.appendLine('[Extension] Requesting Antigravity to quit...');
      return new Promise((resolve) => {
        cp.exec(`osascript -e 'quit app "${appName}"'`, (error) => {
          if (error) {
            outputChannel.appendLine('[Extension] osascript quit failed, trying pkill...');
            cp.exec(`pkill -9 -f "${appName}"`, () => resolve(true));
          } else {
            resolve(true);
          }
        });
      });
    }
  };
}

module.exports = {
  createDaemonService
};
