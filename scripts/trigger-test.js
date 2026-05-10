/**
 * scripts/trigger-test.js
 * 
 * CLI utility to trigger a dummy "High Traffic" dialog in Antigravity
 * to verify the auto-retry script is working.
 */

const WebSocket = require('ws');
const { findCDPPort, getTargets, filterPageTargets } = require('../src/discovery');

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
    
    let overallSuccess = false;
    for (const target of pageTargets) {
      const success = await sendTestCommand(target);
      if (success) overallSuccess = true;
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
      ws.send(JSON.stringify({ id: 2, method: 'Runtime.enable' }));
      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: {
          expression: 'window.__triggerAutoRetryTest ? window.__triggerAutoRetryTest() : "not_injected"',
          returnByValue: true
        }
      }));
    });
    
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      
      if (msg.id === 1) {
        const result = msg.result?.result?.value;
        if (result === 'test_dialog_triggered') {
          // console.log(`   ${cyan}🚀 [${target.title}] Trigger sent.${reset}`);
        } else if (result === 'not_injected') {
          finish(false, `⚠️  [${target.title}] Failed: Script not injected.`);
        } else {
          finish(false, `❌ [${target.title}] Unexpected result.`);
        }
      }

      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = (msg.params.args || []).map(a => a.value || '').join(' ');
        if (text.includes('✅ Clicked') && text.includes('successfully')) {
          finish(true, `✨ [${target.title}] SUCCESS: Dialog handled!`);
        } else if (text.includes('Test dialog timed out')) {
          // Ignore timeout messages if they keep coming, wait for the actual 10s timeout here
          // Unless we want to fail immediately on first timeout message
          // finish(false, `❌ [${target.title}] FAILURE: Dialog timed out.`);
        }
      }
    });
    
    ws.on('error', () => finish(false, `❌ [${target.title}] Connection error.`));
    
    setTimeout(() => finish(false, `❌ [${target.title}] TIMEOUT: No action detected.`), 10000);
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
}

run();
