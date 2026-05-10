/**
 * trigger-accept-test.js - Script to simulate Accept/Run dialogs in Antigravity
 * 
 * It connects to the CDP port and executes a script in the browser context
 * to create a DOM element that looks like an Antigravity agent prompt.
 */

const WebSocket = require('ws');
const { findCDPPort, getTargets, filterPageTargets } = require('../src/discovery');

const TEST_BUTTON_LABEL = process.argv[2] || 'Run';

async function triggerAcceptTest() {
  console.log('🔍 Locating Antigravity CDP port...');
  const port = findCDPPort();
  
  if (!port) {
    console.error('❌ Error: Could not find Antigravity CDP port. Is Antigravity running with --remote-debugging-port?');
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
    
    let overallSuccess = false;
    for (const target of pageTargets) {
      const success = await sendTestCommand(target);
      if (success) {
        overallSuccess = true;
        break; // If one succeeds, the test is successful
      }
    }
    
    return overallSuccess;
  } catch (e) {
    console.error(`❌ Error: ${e.message}`);
    return false;
  }
}

function sendTestCommand(target) {
  return new Promise((resolve) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    let finished = false;

    // ANSI colors
    const green = '\x1b[32m';
    const red = '\x1b[31m';
    const reset = '\x1b[0m';

    const finish = (success, message) => {
      if (finished) return;
      finished = true;
      if (message) console.log(`   ${success ? green : red}${message}${reset}`);
      ws.terminate();
      resolve(success);
    };

    ws.on('open', () => {
      console.log(`🚀 Starting Auto-Accept Test for label: "${TEST_BUTTON_LABEL}"...`);
      
      const injection = `
      (function() {
        // ALWAYS overwrite to ensure we use the latest fix (TrustedHTML)
        window.__triggerAcceptTest = function(label) {
          const btnLabel = label || 'Run';
          console.log('[AutoRetry] [TEST] [STEP 1] Đã hiển thị dialog test -> OK');
          
          const container = document.createElement('div');
          container.className = 'monaco-workbench monaco-dialog-box test-accept-dialog';
          container.style.cssText = 'position:fixed;top:30%;left:50%;transform:translateX(-50%);background:#252526;color:#ccc;padding:25px;border:1px solid #3794ff;z-index:999999;box-shadow:0 10px 40px rgba(0,0,0,0.9);border-radius:8px;width:480px;font-family:sans-serif;border-left: 5px solid #3794ff;';
          
          const title = document.createElement('div');
          title.style.cssText = 'margin-bottom:15px;font-weight:bold;color:#3794ff;font-size:16px;';
          title.textContent = '🛡️ Antigravity Security Prompt (TEST)';
          
          const body = document.createElement('div');
          body.style.cssText = 'margin-bottom:20px;font-size:13px;line-height:1.5;';
          
          const p1 = document.createElement('div');
          p1.textContent = 'An agent is requesting permission to execute the following terminal command:';
          body.appendChild(p1);
          
          const br1 = document.createElement('br');
          body.appendChild(br1);
          
          const codeDiv = document.createElement('div');
          codeDiv.style.cssText = 'background:#000;padding:12px;border-radius:4px;color:#0f0;font-family:monospace;border:1px solid #333;';
          codeDiv.textContent = 'echo "Hello Antigravity!"';
          body.appendChild(codeDiv);
          
          const patternDiv = document.createElement('div');
          patternDiv.style.cssText = 'margin-top:10px;color:#888;font-style:italic;';
          patternDiv.textContent = 'Pattern: "Run" / "Execute" / "Accept"';
          body.appendChild(patternDiv);
          
          const btnContainer = document.createElement('div');
          btnContainer.style.cssText = 'display:flex;justify-content:flex-end;gap:10px;';
          
          const cancelBtn = document.createElement('button');
          cancelBtn.textContent = 'Cancel';
          cancelBtn.style.cssText = 'background:#333;color:white;border:none;padding:6px 15px;cursor:pointer;border-radius:4px;';
          
          const btn = document.createElement('button');
          btn.className = 'monaco-button main-button';
          btn.textContent = btnLabel;
          btn.style.cssText = 'background:#0e639c;color:white;border:none;padding:6px 20px;cursor:pointer;border-radius:4px;font-weight:bold;';
          
          btn.onclick = () => {
            console.log('[AutoRetry] [TEST] [STEP 3] Đã click được nút ' + btnLabel + ' -> OK');
            container.style.opacity = '0.5';
            container.style.pointerEvents = 'none';
            btn.textContent = '✅ Clicked';
            setTimeout(() => container.remove(), 1000);
          };
          
          btnContainer.appendChild(cancelBtn);
          btnContainer.appendChild(btn);
          container.appendChild(title);
          container.appendChild(body);
          container.appendChild(btnContainer);
          document.body.appendChild(container);
          
          // Debug check for daemon detection
          setTimeout(() => {
             const found = document.querySelector('.test-accept-dialog');
             if (found && found.getBoundingClientRect().width > 5) {
                console.log('[AutoRetry] [TEST] [STEP 2] Đã phát hiện được dialog test với button ' + btnLabel + ' -> OK');
             }
          }, 500);
          
          return 'triggered';
        };
        
        return window.__triggerAcceptTest("${TEST_BUTTON_LABEL}");
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
      
      if (msg.id === 1) {
        if (msg.result?.result?.value === 'triggered') {
          console.log(`✅ Test dialog injected into ${target.title}. Monitoring for Auto-Click...`);
        } else {
          console.log(`❌ Injection failed or returned unexpected result:`, JSON.stringify(msg));
        }
      }

      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = (msg.params.args || []).map(a => a.value || '').join(' ');
        if (text.includes('[AutoRetry] [TEST]')) {
          console.log(`   [Browser Console] ${text}`);
        }
        if (text.includes('[STEP 3]') && text.includes('-> OK')) {
          finish(true, `✨ [${target.title}] SUCCESS: Auto-Click detected and clicked the button!`);
        }
      }
    });

    ws.on('error', (err) => finish(false, `❌ [${target.title}] Connection error: ${err.message}`));
    
    // Auto-timeout after 15 seconds
    setTimeout(() => finish(false, `❌ [${target.title}] TIMEOUT: Auto-Click did not detect/click the button within 15s.`), 15000);
  });
}

async function run() {
  const success = await triggerAcceptTest();
  console.log('\n======================================================');
  if (success) {
    console.log('\033[32m✅ TÓM TẮT KẾT QUẢ: ĐÃ TEST THÀNH CÔNG\033[0m');
    console.log(`Hệ thống đã phát hiện và click nút "${TEST_BUTTON_LABEL}".`);
  } else {
    console.log('\033[31m❌ TÓM TẮT KẾT QUẢ: TEST THẤT BẠI\033[0m');
    console.log('Vui lòng kiểm tra lại trạng thái hệ thống và xem log tại:\n ~/Library/Logs/AntigravityAutoRetry/stdout.log');
  }
  console.log('======================================================\n');
  process.exit(success ? 0 : 1);
}

run();
