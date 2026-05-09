const WebSocket = require('ws');
const { findCDPPort, getTargets, filterPageTargets } = require('../src/discovery');

async function trigger() {
  const port = findCDPPort();
  if (!port) { console.log('No port'); return; }
  const targets = await getTargets(port);
  const pages = filterPageTargets(targets);
  
  for (const page of pages) {
    console.log(`\n--- Triggering in ${page.title} ---`);
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise(resolve => {
      ws.on('open', async () => {
        const eval = async (expr) => {
          return new Promise(res => {
            ws.send(JSON.stringify({
              id: Math.floor(Math.random() * 10000),
              method: 'Runtime.evaluate',
              params: { expression: expr, returnByValue: true }
            }));
            ws.once('message', data => {
              const r = JSON.parse(data.toString());
              res(r.result?.result?.value || r.result?.result?.description);
            });
          });
        };
        
        const triggerScript = `
          (function() {
            console.log('[AutoRetry] 🧪 Manually triggering test dialog...');
            const testDiv = document.createElement('div');
            testDiv.className = 'monaco-dialog-box test-auto-retry-dialog';
            testDiv.style.cssText = 'position:fixed;top:20%;left:50%;transform:translateX(-50%);background:#252526;color:#ccc;padding:20px;border:1px solid #444;z-index:99999;box-shadow:0 5px 15px rgba(0,0,0,0.5);border-radius:5px;text-align:center;min-width:300px;';
            testDiv.innerHTML = '<div style="margin-bottom:15px;font-weight:bold;color:#ff4444;">[TEST] High Traffic Simulation</div>' +
                                '<div style="margin-bottom:20px;">This is a test dialog to verify the Auto-Retry script.</div>' +
                                '<button class="monaco-button" style="background:#0e639c;color:white;border:none;padding:6px 20px;cursor:pointer;border-radius:2px;">Retry</button>';
            document.body.appendChild(testDiv);
            testDiv.__isTestDialog = true;
            return 'triggered';
          })()
        `;
        
        console.log('Result:', await eval(triggerScript));
        
        ws.close();
        resolve();
      });
    });
  }
}

trigger();
