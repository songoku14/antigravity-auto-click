/**
 * scripts/tools/analyze-live.js
 * 
 * Công cụ phân tích DOM trực tiếp từ Antigravity qua CDP.
 * Giúp kiểm tra xem Daemon đang nhìn thấy gì và có định click hay không.
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { findCDPPort, getTargets, filterPageTargets } = require('../../src/core/discovery');

function formatKindAndCategory(button) {
  if (!button) return 'UNKNOWN';
  const kind = (button.kind || 'unknown').toUpperCase();
  if (kind !== 'ACCEPT') return kind;
  const category = button.category ? String(button.category).toUpperCase() : 'UNKNOWN';
  return `${kind}/${category}`;
}

function padText(text, width, align = 'left') {
  const str = String(text);
  const pad = Math.max(0, width - str.length);
  if (pad === 0) return str;
  return align === 'right' ? `${' '.repeat(pad)}${str}` : `${str}${' '.repeat(pad)}`;
}

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

  const projectRoot = path.join(__dirname, '../..');
  const activityFile = path.join(projectRoot, 'logs', 'activity-log.json');
  
  let statsSummary = 'N/A';
  try {
    if (fs.existsSync(activityFile)) {
      const data = JSON.parse(fs.readFileSync(activityFile, 'utf8'));
      const retryClicked = data.retry?.clicked || 0;
      const acceptClicked = data.accept?.clicked || 0;
      statsSummary = {
        retryClicked,
        acceptClicked
      };
    }
  } catch (e) {}

  for (const target of pageTargets) {
    console.log('\x1b[36m======================================================\x1b[0m');
    console.log(`\x1b[36m🔍 PHÂN TÍCH TRỰC TIẾP TARGET: "${target.title}"\x1b[0m`);
    if (typeof statsSummary === 'object') {
      console.log('📊 Thống kê hiện tại:');
      console.log('   ┌──────────────────┬──────────┐');
      console.log('   │ ' + padText('METRIC', 16) + ' │ ' + padText('COUNT', 8, 'right') + ' │');
      console.log('   ├──────────────────┼──────────┤');
      console.log(`   │ ${padText('Retry Clicked', 16)} │ ${padText(String(statsSummary.retryClicked), 8, 'right')} │`);
      console.log(`   │ ${padText('Accept Clicked', 16)} │ ${padText(String(statsSummary.acceptClicked), 8, 'right')} │`);
      console.log('   └──────────────────┴──────────┘');
    } else {
      console.log(`📊 Thống kê hiện tại: ${statsSummary}`);
    }
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
            return window.__analyzeDialog({ ignoreCategoryConfig: true });
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
        
        console.log(`   🔍 Phân tích DOM trực tiếp (cùng pipeline với daemon):`);
        console.log(`      - Payload version: ${analysis.scriptVersion || 'unknown'}`);
        console.log(`      - Analysis mode: bỏ qua category enable/disable để đối chiếu với Test DOM Samples`);
        console.log(`      - Tìm thấy Agent Panel: ${analysis.foundAgentPanel ? '✅ CÓ' : '❌ KHÔNG'}`);
        console.log(`      - Số lượng Actionable Cards: \x1b[1m${analysis.containerCount}\x1b[0m`);
        console.log(`      - Tổng số nút bấm phát hiện: \x1b[1m${analysis.totalButtons || 0}\x1b[0m`);
        if (analysis.clickGate) {
          const gateStatus = analysis.clickGate.ok ? '✅ PASS' : `❌ BLOCKED (${analysis.clickGate.reason})`;
          console.log(`      - Click gate: ${gateStatus}`);
        }
        if (analysis.wouldClick && analysis.action) {
          console.log(`      - Kết luận daemon: \x1b[32mSẼ CLICK\x1b[0m ${formatKindAndCategory(analysis.action)} "${analysis.action.text}"`);
        } else {
          console.log(`      - Kết luận daemon: \x1b[31mKHÔNG CLICK\x1b[0m`);
        }
        
        analysis.containers.forEach((c, idx) => {
          const location = c.isAgentWindow ? ' [Agent Panel]' : ' [Main Window]';
          console.log(`      \x1b[34mCard #${idx + 1}${location}:\x1b[0m`);
          
          if (c.buttons.retry && c.buttons.retry.length > 0) {
            c.buttons.retry.forEach(b => {
              const decision = b.decision === 'wouldClick' ? '\x1b[32mWOULD_CLICK\x1b[0m' : `\x1b[31mSKIP\x1b[0m ${b.reason || ''}`;
              const rect = b.rect ? `x=${b.rect.left},y=${b.rect.top},w=${b.rect.width},h=${b.rect.height}` : 'rect=N/A';
              const visibility = b.visibility ? `${b.visibility.ok ? 'visible' : 'hidden'}:${b.visibility.reason}` : 'visibility=N/A';
              console.log(`         🔄 ${formatKindAndCategory(b)}: \x1b[32m${b.text}\x1b[0m | ${decision} | ${rect} | ${visibility} | Cạnh đó: \x1b[2m${b.context || 'N/A'}\x1b[0m`);
            });
          }
          
          if (c.buttons.accept && c.buttons.accept.length > 0) {
            c.buttons.accept.forEach(b => {
              const decision = b.decision === 'wouldClick' ? '\x1b[32mWOULD_CLICK\x1b[0m' : `\x1b[31mSKIP\x1b[0m ${b.reason || ''}`;
              const rect = b.rect ? `x=${b.rect.left},y=${b.rect.top},w=${b.rect.width},h=${b.rect.height}` : 'rect=N/A';
              const visibility = b.visibility ? `${b.visibility.ok ? 'visible' : 'hidden'}:${b.visibility.reason}` : 'visibility=N/A';
              console.log(`         ⚡ ${formatKindAndCategory(b)}: \x1b[36m${b.text}\x1b[0m | ${decision} | ${rect} | ${visibility} | Cạnh đó: \x1b[2m${b.context || 'N/A'}\x1b[0m`);
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
