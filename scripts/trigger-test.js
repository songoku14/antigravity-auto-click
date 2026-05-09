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
    
    console.log(`🚀 Triggering test dialog in ${pageTargets.length} page(s)...`);
    
    for (const target of pageTargets) {
      await sendTestCommand(target);
    }
    
    console.log('\n✨ Test command sent! Check your Antigravity window.');
    console.log('If the script is running, you should see a dialog appear and disappear quickly.');
    
  } catch (e) {
    console.error(`❌ Error: ${e.message}`);
    process.exit(1);
  }
}

function sendTestCommand(target) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    let triggerSent = false;
    let testSuccess = false;
    
    // ANSI colors
    const green = '\x1b[32m';
    const yellow = '\x1b[33m';
    const red = '\x1b[31m';
    const cyan = '\x1b[36m';
    const reset = '\x1b[0m';

    ws.on('open', () => {
      // Enable Console domain to listen for logs
      ws.send(JSON.stringify({ id: 2, method: 'Runtime.enable' }));
      
      const msg = JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: {
          expression: 'window.__triggerAutoRetryTest ? window.__triggerAutoRetryTest() : "not_injected"',
          returnByValue: true
        }
      });
      ws.send(msg);
    });
    
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      
      // Handle trigger result
      if (msg.id === 1) {
        const result = msg.result?.result?.value;
        if (result === 'test_dialog_triggered') {
          console.log(`   ${cyan}🚀 [${target.title}] Trigger sent successfully.${reset}`);
          triggerSent = true;
        } else if (result === 'not_injected') {
          console.log(`   ${yellow}⚠️  [${target.title}] Failed: Script not yet injected in this page.${reset}`);
          ws.close();
          resolve();
        } else {
          console.log(`   ${red}❌ [${target.title}] Unexpected result: ${JSON.stringify(msg)}${reset}`);
          ws.close();
          resolve();
        }
      }

      // Listen for console logs
      if (msg.method === 'Runtime.consoleAPICalled') {
        const args = msg.params.args || [];
        const text = args.map(a => a.value || a.description || '').join(' ');
        
        if (text.includes('✅ Clicked') && text.includes('successfully')) {
          console.log(`   ${green}✨ [${target.title}] SUCCESS: Dialog detected and clicked!${reset}`);
          testSuccess = true;
          ws.close();
          resolve();
        } else if (text.includes('Test dialog timed out')) {
          console.log(`   ${red}❌ [${target.title}] FAILURE: Test dialog timed out without being clicked.${reset}`);
          ws.close();
          resolve();
        }
      }
    });
    
    ws.on('error', (err) => {
      console.log(`   ${red}❌ [${target.title}] Connection error: ${err.message}${reset}`);
      reject(err);
    });
    
    // 10 second timeout for the whole test
    setTimeout(() => {
      if (ws.readyState !== WebSocket.CLOSED) {
        if (triggerSent && !testSuccess) {
          console.log(`   ${red}❌ [${target.title}] TIMEOUT: No click detected after 10s.${reset}`);
        }
        ws.terminate();
        resolve();
      }
    }, 10000);
  });
}

triggerTest();
