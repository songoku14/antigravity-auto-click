/**
 * trigger-danger-test.js - Script to simulate a dangerous command dialog
 */

const WebSocket = require('ws');
const { findCDPPort, getTargets, filterPageTargets } = require('../../src/core/discovery');

async function triggerDangerTest() {
  console.log('🔍 Locating Antigravity CDP port...');
  const port = findCDPPort();
  
  if (!port) {
    console.error('❌ Error: Could not find Antigravity CDP port.');
    process.exit(1);
  }
  
  console.log(`✅ Found CDP port: ${port}`);
  
  try {
    const targets = await getTargets(port);
    const pageTargets = filterPageTargets(targets);
    
    if (pageTargets.length === 0) {
      console.error('❌ Error: No active Antigravity pages found to test.');
      process.exit(1);
    }
    
    // We only need to trigger on one active page for a danger test
    const target = pageTargets[0];
    const success = await sendDangerCommand(target);
    return success;
  } catch (e) {
    console.error(`❌ Error: ${e.message}`);
    return false;
  }
}

function sendDangerCommand(target) {
  return new Promise((resolve) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    let finished = false;

    const finish = (success) => {
      if (finished) return;
      finished = true;
      ws.terminate();
      resolve(success);
    };

    ws.on('open', () => {
      console.log(`🚀 Triggering DANGEROUS test dialog in: ${target.title}...`);
      
      const injection = `
      (function() {
        const MOCK_CLASS = 'antigravity-mock-dialog';
        window.__triggerDangerTest = function() {
          console.log('[AutoRetry] [TEST] Simulating DANGEROUS dialog...');
          
          // Cleanup
          document.querySelectorAll('.' + MOCK_CLASS).forEach(m => m.remove());

          const container = document.createElement('div');
          container.className = 'monaco-workbench monaco-dialog-box test-danger-dialog ' + MOCK_CLASS;
          container.style.cssText = 'position:fixed;top:30%;left:50%;transform:translateX(-50%);background:#252526;color:#ccc;padding:25px;border:1px solid #f14c4c;z-index:999999;box-shadow:0 10px 40px rgba(255,0,0,0.4);border-radius:8px;width:480px;font-family:sans-serif;border-left: 5px solid #f14c4c;';
          
          const title = document.createElement('div');
          title.style.cssText = 'margin-bottom:15px;font-weight:bold;color:#f14c4c;font-size:16px;';
          title.textContent = '🛡️ Antigravity SECURITY ALERT (TEST)';
          
          const body = document.createElement('div');
          body.style.cssText = 'margin-bottom:20px;font-size:13px;line-height:1.5;';
          
          const p1 = document.createElement('div');
          p1.textContent = 'The agent is requesting permission to execute a DANGEROUS command:';
          body.appendChild(p1);
          
          const br = document.createElement('br');
          body.appendChild(br);
          
          const codePre = document.createElement('pre');
          codePre.style.cssText = 'background:#000;padding:12px;border-radius:4px;color:#f14c4c;font-family:monospace;border:1px solid #333;';
          codePre.textContent = 'rm -rf /Users/important-files';
          body.appendChild(codePre);
          
          const btnContainer = document.createElement('div');
          btnContainer.style.cssText = 'display:flex;justify-content:flex-end;gap:10px;';
          
          const btn = document.createElement('button');
          btn.className = 'monaco-button main-button';
          btn.textContent = 'Run';
          btn.style.cssText = 'background:#0e639c;color:white;border:none;padding:6px 20px;cursor:pointer;border-radius:4px;font-weight:bold;';
          
          btn.onclick = () => {
            console.log('[AutoRetry] [TEST] FAILURE: Dangerous button was clicked!');
            window.__testDangerClicked = true;
          };
          
          btnContainer.appendChild(btn);
          container.appendChild(title);
          container.appendChild(body);
          container.appendChild(btnContainer);
          document.body.appendChild(container);
          
          return 'triggered';
        };
        
        return window.__triggerDangerTest();
      })();
      `;

      ws.send(JSON.stringify({ id: 2, method: 'Runtime.enable' }));
      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: { expression: injection, returnByValue: true }
      }));
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      
      if (msg.id === 1 && msg.result?.result?.value === 'triggered') {
        console.log('✅ Dangerous dialog triggered. Monitoring for 5s to ensure it is BLOCKED...');
        
        let checks = 0;
        const checkInterval = setInterval(() => {
          ws.send(JSON.stringify({
            id: 100 + checks,
            method: 'Runtime.evaluate',
            params: { expression: 'window.__testDangerClicked === true' }
          }));
          
          ws.send(JSON.stringify({
            id: 200 + checks,
            method: 'Runtime.evaluate',
            params: { expression: 'document.querySelector(".test-danger-dialog button")?.textContent' }
          }));

          checks++;
          if (checks >= 10) {
            clearInterval(checkInterval);
            console.log('🎉 SUCCESS: Auto-Click did not click the dangerous button.');
            finish(true);
          }
        }, 500);

        ws.on('message', (data2) => {
          const msg2 = JSON.parse(data2.toString());
          if (msg2.id >= 100 && msg2.id < 200 && msg2.result?.result?.value === true) {
            console.log('❌ FAILURE: Auto-Click clicked the dangerous button!');
            clearInterval(checkInterval);
            finish(false);
          }
          if (msg2.id >= 200 && msg2.result?.result?.value === '🚫 Blocked') {
            console.log('✅ Visual confirmation: Button is marked as "🚫 Blocked".');
          }
        });
      }

      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = (msg.params.args || []).map(a => a.value || '').join(' ');
        if (text.includes('🚫 Blocked dangerous command')) {
          console.log('✅ Captured Block log from daemon.');
        }
      }
    });

    ws.on('error', (err) => {
      console.error(`❌ Connection error: ${err.message}`);
      finish(false);
    });
  });
}

async function run() {
  const success = await triggerDangerTest();
  console.log('\n======================================================');
  if (success) {
    console.log('\033[32m✅ TÓM TẮT KẾT QUẢ: TEST THÀNH CÔNG (DANGER BLOCKED)\033[0m');
  } else {
    console.log('\033[31m❌ TÓM TẮT KẾT QUẢ: TEST THẤT BẠI (DANGER ALLOWED!)\033[0m');
  }
  console.log('======================================================\n');
  process.exit(success ? 0 : 1);
}

run();
