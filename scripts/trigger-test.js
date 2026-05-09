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
    
    ws.on('open', () => {
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
      const res = JSON.parse(data.toString());
      if (res.id === 1) {
        const result = res.result?.result?.value;
        if (result === 'test_dialog_triggered') {
          console.log(`   ✅ [${target.title}] Triggered successfully.`);
        } else if (result === 'not_injected') {
          console.log(`   ⚠️  [${target.title}] Failed: Script not yet injected in this page.`);
        } else {
          console.log(`   ❌ [${target.title}] Unexpected result: ${JSON.stringify(res)}`);
        }
        ws.close();
        resolve();
      }
    });
    
    ws.on('error', (err) => {
      console.log(`   ❌ [${target.title}] Connection error: ${err.message}`);
      reject(err);
    });
    
    setTimeout(() => {
      if (ws.readyState !== WebSocket.CLOSED) {
        ws.terminate();
        reject(new Error(`Timeout connecting to ${target.title}`));
      }
    }, 5000);
  });
}

triggerTest();
