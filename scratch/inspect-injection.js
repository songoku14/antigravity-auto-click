const WebSocket = require('ws');
const { findCDPPort, getTargets, filterPageTargets } = require('../src/discovery');

async function inspect() {
  const port = findCDPPort();
  if (!port) { console.log('No port'); return; }
  const targets = await getTargets(port);
  const pages = filterPageTargets(targets);
  
  for (const page of pages) {
    console.log(`\n--- Inspecting ${page.title} ---`);
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise(resolve => {
      ws.on('open', async () => {
        const check = async (expr) => {
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
        
        console.log('__autoRetryInjected:', await check('window.__autoRetryInjected'));
        console.log('__autoRetryVersion:', await check('window.__autoRetryVersion'));
        console.log('__triggerAutoRetryTest:', await check('typeof window.__triggerAutoRetryTest'));
        
        ws.close();
        resolve();
      });
    });
  }
}

inspect();
