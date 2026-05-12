/**
 * scripts/tools/analyze-live.js
 * 
 * Utility to connect to the active Antigravity page via CDP and
 * analyze the current DOM for actionable cards and buttons.
 */

const WebSocket = require('ws');
const { findCDPPort, getTargets, filterPageTargets } = require('../../src/core/discovery');
const { getInjectionScript } = require('../../src/payload/injection-payload');

async function analyzeLive() {
  const port = findCDPPort();
  if (!port) {
    console.error('❌ CDP port not found. Đảm bảo Antigravity đang chạy với cờ CDP (--remote-debugging-port).');
    return;
  }

  const targets = await getTargets(port);
  let pageTargets = filterPageTargets(targets);
  
  // Bỏ qua các target không liên quan như Launchpad để tránh rối log
  pageTargets = pageTargets.filter(t => !t.title.includes('Launchpad') && !t.title.includes('SharedProcess'));

  if (pageTargets.length === 0) {
    console.error('❌ No active pages found.');
    return;
  }

  for (const target of pageTargets) {
    console.log('\x1b[36m======================================================\x1b[0m');
    console.log(`\x1b[36m🔍 PHÂN TÍCH TRỰC TIẾP TARGET: "${target.title}"\x1b[0m`);
    console.log('\x1b[36m======================================================\x1b[0m');
    await runAnalysis(target);
  }
}

function runAnalysis(target) {
  return new Promise((resolve) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    
    const evalCode = `
      (function() {
        try {
          if (typeof window.__analyzeDialog === 'function') {
            return window.__analyzeDialog();
          }
          return { error: 'Hệ thống Auto-Click chưa được inject vào trang này (hoặc chưa bật Daemon).' };
        } catch(e) {
          return { error: e.message };
        }
      })();
    `;

    ws.on('open', () => {
      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: { expression: evalCode, returnByValue: true }
      }));
    });

    let timeoutId = setTimeout(() => { 
      ws.terminate(); 
      console.log('   ❌ Lỗi: Phản hồi quá lâu (Timeout).'); 
      resolve(); 
    }, 5000);

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === 1) {
        clearTimeout(timeoutId);
        ws.terminate();
        const analysis = msg.result?.result?.value;
        if (!analysis) {
           console.log('   ❌ Lỗi: Không nhận được kết quả.');
           resolve();
           return;
        }
        if (analysis.error) {
           console.log(`   ❌ Lỗi: ${analysis.error}`);
           resolve();
           return;
        }
        
        console.log(`   🔍 Phân tích DOM trực tiếp:`);
        console.log(`      - Tìm thấy Agent Panel: ${analysis.foundAgentPanel ? '✅ CÓ' : '❌ KHÔNG'}`);
        console.log(`      - Số lượng Actionable Cards: \x1b[1m${analysis.containerCount}\x1b[0m`);
        console.log(`      - Tổng số nút bấm phát hiện: \x1b[1m${analysis.totalButtons || 0}\x1b[0m`);
        
        analysis.containers.forEach((c, idx) => {
          const location = c.isAgentWindow ? ' [Agent Panel]' : ' [Main Window]';
          console.log(`      \x1b[34mCard #${idx + 1}${location}:\x1b[0m`);
          
          if (c.buttons.retry && c.buttons.retry.length > 0) {
            c.buttons.retry.forEach(b => {
              console.log(`         🔄 Btn: \x1b[32m${b.text}\x1b[0m | Cạnh đó: \x1b[2m${b.context || 'N/A'}\x1b[0m`);
            });
          }
          
          if (c.buttons.accept && c.buttons.accept.length > 0) {
            c.buttons.accept.forEach(b => {
              console.log(`         ⚡ Btn: \x1b[36m${b.text}\x1b[0m | Cạnh đó: \x1b[2m${b.context || 'N/A'}\x1b[0m`);
            });
          }

          if ((!c.buttons.retry || c.buttons.retry.length === 0) && (!c.buttons.accept || c.buttons.accept.length === 0)) {
            console.log(`         (Không tìm thấy nút Retry/Accept)`);
          }
        });
        
        resolve();
      }
    });

    ws.on('error', (e) => {
      clearTimeout(timeoutId);
      console.log('   ❌ Lỗi kết nối WS:', e.message);
      resolve();
    });
  });
}

analyzeLive();
