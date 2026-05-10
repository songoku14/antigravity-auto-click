/**
 * trigger-accept-test.js - Script to simulate Accept/Run dialogs in Antigravity
 * 
 * It connects to the CDP port and executes a script in the browser context
 * to create a DOM element that looks like an Antigravity agent prompt.
 */

const WebSocket = require('ws');
const http = require('http');

const TEST_BUTTON_LABEL = process.argv[2] || 'Run';
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
    console.error('❌ Failed to connect to Antigravity. Is it running with --remote-debugging-port=9222?');
    process.exit(1);
  }

  const pages = targets.filter(t => t.type === 'page' && t.webSocketDebuggerUrl);
  if (pages.length === 0) {
    console.error('❌ No active pages found in Antigravity.');
    process.exit(1);
  }

  const target = pages[0];
  console.log(`Connected to: ${target.title}`);

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  
  ws.on('open', () => {
    console.log(`🚀 Triggering Accept/Run test dialog with button: "${TEST_BUTTON_LABEL}"...`);

    const injection = `
(function() {
  if (window.__triggerAcceptTest) return window.__triggerAcceptTest("${TEST_BUTTON_LABEL}");

  window.__triggerAcceptTest = function(label) {
    const btnLabel = label || 'Run';
    const container = document.createElement('div');
    container.className = 'monaco-workbench monaco-dialog-box test-accept-dialog';
    container.style.cssText = 'position:fixed;top:30%;left:50%;transform:translateX(-50%);background:#252526;color:#ccc;padding:20px;border:1px solid #444;z-index:99999;box-shadow:0 5px 25px rgba(0,0,0,0.8);border-radius:6px;width:450px;font-family:sans-serif;';
    
    const title = document.createElement('div');
    title.style.cssText = 'margin-bottom:10px;font-weight:bold;color:#3794ff;';
    title.textContent = 'Agent Action Required';
    
    const body = document.createElement('div');
    body.style.cssText = 'margin-bottom:15px;font-size:13px;';
    body.innerHTML = 'The agent wants to run the following command:<br><br><pre style="background:#000;padding:10px;border-radius:4px;color:#0f0;">echo "Hello Antigravity!"</pre>';
    
    const btnContainer = document.createElement('div');
    btnContainer.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;';
    
    const btn = document.createElement('button');
    btn.className = 'monaco-button';
    btn.textContent = btnLabel;
    btn.style.cssText = 'background:#0e639c;color:white;border:none;padding:4px 12px;cursor:pointer;border-radius:2px;';
    
    btn.onclick = () => {
      console.log('[AutoRetry] [TEST] ' + btnLabel + ' button clicked!');
      container.remove();
      window.__testSuccess = true;
    };
    
    btnContainer.appendChild(btn);
    container.appendChild(title);
    container.appendChild(body);
    container.appendChild(btnContainer);
    document.body.appendChild(container);
    
    return 'triggered';
  };
  
  return window.__triggerAcceptTest("${TEST_BUTTON_LABEL}");
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
      console.log('✅ Test dialog triggered. Waiting for Auto-Click...');
      
      // Wait to see if it gets clicked
      let checks = 0;
      const checkInterval = setInterval(() => {
        ws.send(JSON.stringify({
          id: 100 + checks,
          method: 'Runtime.evaluate',
          params: { expression: 'window.__testSuccess === true' }
        }));
        checks++;
        if (checks > 20) {
          console.log('❌ TIMEOUT: Auto-Click did not click the button within 10s.');
          clearInterval(checkInterval);
          ws.close();
          process.exit(1);
        }
      }, 500);

      ws.on('message', (data2) => {
        const msg2 = JSON.parse(data2);
        if (msg2.id >= 100 && msg2.result && msg2.result.result && msg2.result.result.value === true) {
          console.log(`🎉 SUCCESS: Auto-Click detected and clicked the ${TEST_BUTTON_LABEL} button!`);
          clearInterval(checkInterval);
          ws.close();
          process.exit(0);
        }
      });
    }
  });
}

trigger();
