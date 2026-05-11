/**
 * scripts/trigger-test.js
 * 
 * CLI utility to trigger a dummy "High Traffic" dialog in Antigravity
 * to verify the auto-retry script is working.
 * 
 * This version is self-contained and injects the mock dialog directly.
 */

const WebSocket = require('ws');
const { findCDPPort, getTargets, filterPageTargets } = require('../../src/core/discovery');

async function triggerTest() {
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

    // Refinement: Pick the best target
    // 1. Prefer the main workbench.html
    // 2. Avoid "Launchpad" if others are available
    const bestTarget = pageTargets.find(t => t.url?.endsWith('workbench.html')) || 
                       pageTargets.find(t => !t.title.includes('Launchpad')) ||
                       pageTargets[0];
    
    if (pageTargets.length > 1) {
      console.log(`ℹ️ Found ${pageTargets.length} targets. Testing on: ${bestTarget.title || bestTarget.url}`);
    }
    
    const success = await sendTestCommand(bestTarget);
    return success;
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
    const yellow = '\x1b[33m';
    const red = '\x1b[31m';
    const cyan = '\x1b[36m';
    const reset = '\x1b[0m';

    const finish = (success, message) => {
      if (finished) return;
      finished = true;
      if (message) console.log(`   ${success ? green : red}${message}${reset}`);
      ws.terminate();
      resolve(success);
    };

    ws.on('open', () => {
      const injectionCode = `
      (function() {
        const MOCK_CLASS = 'antigravity-mock-dialog';
        window.__triggerAutoRetryTest = function() {
          console.log('[AutoRetry] [TEST] Simulating HIGH TRAFFIC dialog...');
          
          // Cleanup
          document.querySelectorAll('.' + MOCK_CLASS).forEach(m => m.remove());

          const container = document.createElement('div');
          container.className = 'monaco-workbench monaco-dialog-box test-dialog ' + MOCK_CLASS;
          container.style.cssText = 'position:fixed;top:60%;left:70%;transform:translate(-50%, -50%);background:#252526;color:#ccc;padding:25px;border:1px solid #3794ff;z-index:999999;box-shadow:0 10px 40px rgba(0,0,0,0.8);border-radius:8px;width:400px;font-family:sans-serif;border-left: 5px solid #f14c4c;';
          
          const title = document.createElement('div');
          title.style.cssText = 'margin-bottom:10px;font-weight:bold;color:#f14c4c;';
          title.textContent = 'High Traffic (TEST)';
          
          const body = document.createElement('div');
          body.style.cssText = 'margin-bottom:15px;';
          body.textContent = 'Server is currently experiencing high traffic. Please try again later.';
          
          const btnContainer = document.createElement('div');
          btnContainer.className = 'footer'; // Match real Antigravity structure
          btnContainer.style.cssText = 'display:flex;justify-content:flex-end;';
          
          const btn = document.createElement('button');
          btn.className = 'monaco-button';
          btn.textContent = 'Retry';
          btn.style.cssText = 'background:#0e639c;color:white;border:none;padding:4px 15px;cursor:pointer;';
          
          btn.onclick = () => {
            console.log('[AutoRetry] [TEST] Dialog button CLICKED successfully!');
            try {
              container.remove();
              setTimeout(() => {
                if (document.contains(container)) {
                  console.error('[AutoRetry] [TEST] CRITICAL: container.remove() failed to remove the element!');
                } else {
                  console.log('[AutoRetry] [TEST] Verification: Dialog removed from DOM.');
                }
              }, 100);
            } catch (e) {
              console.error('[AutoRetry] [TEST] Error removing container: ' + e.message);
            }
          };
          
          btnContainer.appendChild(btn);
          container.appendChild(title);
          container.appendChild(body);
          container.appendChild(btnContainer);
          document.body.appendChild(container);
          
          return 'test_dialog_triggered';
        };
        
        return window.__triggerAutoRetryTest();
      })();
      `;

      ws.send(JSON.stringify({ id: 2, method: 'Runtime.enable' }));
      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: {
          expression: injectionCode,
          returnByValue: true
        }
      }));
    });
    
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      
      if (msg.id === 1) {
        const result = msg.result?.result?.value;
        if (result === 'test_dialog_triggered') {
          console.log(`✅ [${target.title}] Test dialog injected. Monitoring for Auto-Click...`);
        } else {
          finish(false, `❌ [${target.title}] Injection failed: ${JSON.stringify(msg.result)}`);
        }
      }

      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = (msg.params.args || []).map(a => a.value || '').join(' ');
        
        if (text.includes('Verification: Dialog removed from DOM.')) {
          finish(true, `✨ [${target.title}] SUCCESS: Dialog handled and verified removed!`);
        } else if (text.includes('CRITICAL: container.remove() failed')) {
          finish(false, `❌ [${target.title}] FAILURE: Dialog click registered but removal failed!`);
        } else if (text.includes('✅ [STEP 8] Fallback click worked')) {
          console.log(`   ${yellow}ℹ️ Fallback click was required but worked.${reset}`);
        }
      }
    });
    
    ws.on('error', (err) => finish(false, `❌ [${target.title}] Connection error: ${err.message}`));
    
    setTimeout(() => finish(false, `❌ [${target.title}] TIMEOUT: No action detected within 15s.`), 15000);
  });
}

async function run() {
  const success = await triggerTest();
  console.log('\n======================================================');
  if (success) {
    console.log('\033[32m✅ TÓM TẮT KẾT QUẢ: ĐÃ TEST THÀNH CÔNG\033[0m');
    console.log('Hệ thống đã phát hiện và xử lý Dialog giả lập.');
  } else {
    console.log('\033[31m❌ TÓM TẮT KẾT QUẢ: TEST THẤT BẠI\033[0m');
    console.log('Vui lòng kiểm tra lại trạng thái hệ thống.');
  }
  console.log('======================================================\n');
  process.exit(success ? 0 : 1);
}

run();

