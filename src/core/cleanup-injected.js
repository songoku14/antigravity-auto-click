const WebSocket = require('ws');
const { findCDPPort, getTargets, filterPageTargets } = require('./discovery');

const CLEANUP_SCRIPT = `
(function() {
  window.__autoRetryDisabled = true;
  if (window.__autoRetryCleanup) {
    window.__autoRetryCleanup();
  }
  window.__autoRetryCleanedUp = true;
  window.__autoRetryInjected = false;
  window.__autoRetryVersion = 0;
  console.log('[AutoRetry] Cleanup: injected automation disabled.');
  return 'cleanup_done';
})();
`;

function send(ws, method, params = {}, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1000000);
    const timer = setTimeout(() => reject(new Error(`Command timeout: ${method}`)), timeoutMs);

    function onMessage(data) {
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch (e) {
        return;
      }
      if (msg.id !== id) return;
      clearTimeout(timer);
      ws.off('message', onMessage);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }

    ws.on('message', onMessage);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function cleanupTarget(target) {
  return new Promise((resolve) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl, {
      perMessageDeflate: false,
      maxPayload: 32 * 1024 * 1024
    });

    const timer = setTimeout(() => {
      ws.terminate();
      resolve({ target, ok: false, error: 'connection timeout' });
    }, 5000);

    ws.once('open', async () => {
      clearTimeout(timer);
      try {
        await send(ws, 'Runtime.evaluate', {
          expression: CLEANUP_SCRIPT,
          returnByValue: true,
          awaitPromise: false
        });
        ws.close();
        resolve({ target, ok: true });
      } catch (e) {
        ws.close();
        resolve({ target, ok: false, error: e.message });
      }
    });

    ws.once('error', (e) => {
      clearTimeout(timer);
      resolve({ target, ok: false, error: e.message });
    });
  });
}

async function cleanupInjectedScripts() {
  const port = findCDPPort();
  if (!port) {
    return { ok: true, port: null, targets: [], message: 'CDP port not found' };
  }

  const targets = filterPageTargets(await getTargets(port));
  const results = await Promise.all(targets.map(cleanupTarget));
  return { ok: results.every(r => r.ok), port, targets: results };
}

if (require.main === module) {
  cleanupInjectedScripts()
    .then(result => {
      if (!result.port) {
        console.log('[AutoRetry] Cleanup skipped: CDP port not found.');
        return;
      }
      const cleaned = result.targets.filter(t => t.ok).length;
      const failed = result.targets.length - cleaned;
      console.log(`[AutoRetry] Cleanup complete: ${cleaned} target(s), ${failed} failed.`);
      if (failed > 0) process.exitCode = 1;
    })
    .catch(e => {
      console.error(`[AutoRetry] Cleanup failed: ${e.message}`);
      process.exitCode = 1;
    });
}

module.exports = { cleanupInjectedScripts, CLEANUP_SCRIPT };
