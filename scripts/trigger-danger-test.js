/**
 * trigger-danger-test.js - Script to simulate a dangerous command dialog
 */

const WebSocket = require('ws');
const http = require('http');

const CDP_PORT = 9222;

async function getTargets() {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${CDP_PORT}/json`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function trigger() {
  console.log('🔍 Finding Antigravity targets...');
  let targets;
  try {
    targets = await getTargets();
  } catch (e) {
    console.error('❌ Failed to connect to Antigravity.');
    process.exit(1);
  }

  const target = targets.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
  if (!target) { process.exit(1); }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  
  ws.on('open', () => {
    console.log('🚀 Triggering DANGEROUS test dialog...');

    const injection = `
(function() {
  const container = document.createElement('div');
  container.className = 'monaco-dialog-box test-danger-dialog';
  container.style.cssText = 'position:fixed;top:30%;left:50%;transform:translateX(-50%);background:#252526;color:#ccc;padding:20px;border:1px solid #444;z-index:99999;box-shadow:0 5px 25px rgba(255,0,0,0.4);border-radius:6px;width:450px;font-family:sans-serif;';
  
  const title = document.createElement('div');
  title.style.cssText = 'margin-bottom:10px;font-weight:bold;color:#f14c4c;';
  title.textContent = 'DANGEROUS ACTION DETECTED';
  
  const body = document.createElement('div');
  body.style.cssText = 'margin-bottom:15px;font-size:13px;';
  body.innerHTML = 'The agent wants to run a DANGEROUS command:<br><br><pre style="background:#000;padding:10px;border-radius:4px;color:#f00;">rm -rf /Users/lehoangthang/important-files</pre>';
  
  const btnContainer = document.createElement('div');
  btnContainer.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;';
  
  const btn = document.createElement('button');
  btn.className = 'monaco-button';
  btn.textContent = 'Run';
  btn.style.cssText = 'background:#0e639c;color:white;border:none;padding:4px 12px;cursor:pointer;border-radius:2px;';
  
  btn.onclick = () => {
    console.log('[AutoRetry] [TEST] Run button clicked (DANGER)!');
    window.__testDangerClicked = true;
    container.remove();
  };
  
  btnContainer.appendChild(btn);
  container.appendChild(title);
  container.appendChild(body);
  container.appendChild(btnContainer);
  document.body.appendChild(container);
  
  return 'triggered';
})();
`;

    ws.send(JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: { expression: injection }
    }));
  });

  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.id === 1) {
      console.log('✅ Dangerous dialog triggered. Checking if Auto-Click blocks it...');
      
      let checks = 0;
      const checkInterval = setInterval(() => {
        ws.send(JSON.stringify({
          id: 200 + checks,
          method: 'Runtime.evaluate',
          params: { expression: 'window.__testDangerClicked === true' }
        }));
        
        // Also check if the button text changed to "Blocked"
        ws.send(JSON.stringify({
          id: 300 + checks,
          method: 'Runtime.evaluate',
          params: { expression: 'document.querySelector(".test-danger-dialog button")?.textContent' }
        }));

        checks++;
        if (checks > 10) {
          console.log('🎉 SUCCESS: Auto-Click DID NOT click the dangerous button after 5s.');
          clearInterval(checkInterval);
          ws.close();
          process.exit(0);
        }
      }, 500);

      ws.on('message', (data2) => {
        const msg2 = JSON.parse(data2);
        if (msg2.id >= 200 && msg2.id < 300 && msg2.result && msg2.result.result && msg2.result.result.value === true) {
          console.log('❌ FAILURE: Auto-Click CLICKED the dangerous button!');
          clearInterval(checkInterval);
          ws.close();
          process.exit(1);
        }
        if (msg2.id >= 300 && msg2.result && msg2.result.result && msg2.result.result.value === '🚫 Blocked') {
          console.log('✅ Visual confirmation: Button is marked as "🚫 Blocked".');
        }
      });
    }
  });
}

trigger();
