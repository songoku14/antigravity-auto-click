/**
 * scripts/mock-dialog.js
 * 
 * CLI utility to simulate a dialog in Antigravity using a saved sample.
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { findCDPPort, getTargets, filterPageTargets } = require('../../src/core/discovery');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function mockDialog() {
  console.log('\x1b[36m======================================================\x1b[0m');
  console.log('\x1b[36m🎭 GIẢ LẬP DIALOG TỪ SAMPLE\x1b[0m');
  console.log('\x1b[36m======================================================\x1b[0m');

  const samplesDir = path.join(__dirname, '..', '..', 'samples');
  if (!fs.existsSync(samplesDir)) {
    console.log('❌ Thư mục samples/ không tồn tại. Hãy chạy tính năng Phân tích trước.');
    process.exit(0);
  }

  const files = fs.readdirSync(samplesDir).filter(f => f.endsWith('.json')).sort();
  if (files.length === 0) {
    console.log('❌ Không tìm thấy file sample nào trong thư mục samples/.');
    process.exit(0);
  }

  console.log('Danh sách Sample hiện có:');
  const samples = [];
  files.forEach(file => {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(samplesDir, file), 'utf8'));
      console.log(`  [${data.id}] - ${data.metadata.category.toUpperCase()}: "${data.analysis.text.substring(0, 60)}..."`);
      samples.push(data);
    } catch (e) {}
  });

  const choiceId = await question('\n👉 Nhập ID của sample bạn muốn giả lập (ví dụ: 001): ');
  const selected = samples.find(s => s.id === choiceId);

  if (!selected) {
    console.log('❌ ID không hợp lệ.');
    rl.close();
    return;
  }

  const port = findCDPPort();
  if (!port) {
    console.log('❌ Không tìm thấy cổng CDP. Antigravity đã chạy chưa?');
    rl.close();
    return;
  }

  try {
    const targets = await getTargets(port);
    const pageTargets = filterPageTargets(targets);
    
    if (pageTargets.length === 0) {
      console.log('❌ Không thấy page nào đang mở.');
      rl.close();
      return;
    }

    console.log(`\nPhát hiện ${pageTargets.length} trang. Đang thực hiện giả lập...`);

    // Inject into the first active page found
    // Ưu tiên workbench, bỏ qua Launchpad nếu có thể
    const target = pageTargets.find(t => t.url?.endsWith('workbench.html')) || 
                   pageTargets.find(t => !t.title.includes('Launchpad')) ||
                   pageTargets[0];
    console.log(`🎯 Đang inject vào: "${target.title || target.url}"`);

    const success = await injectMockHtml(target, selected);
    
    if (success) {
      console.log('\n\x1b[32m✅ ĐÃ GIẢ LẬP THÀNH CÔNG!\x1b[0m');
      console.log('Dialog sẽ xuất hiện trên giao diện Antigravity ngay bây giờ.');
      console.log('Hệ thống Auto-Click (nếu đang chạy) sẽ nhận diện và xử lý nó.');
    } else {
      console.log('\n❌ Lỗi khi inject HTML.');
    }

  } catch (e) {
    console.error(`❌ Lỗi: ${e.message}`);
  }

  rl.close();
}

function injectMockHtml(target, sample) {
  return new Promise((resolve) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);

    // Extract info for safe injection
    const sampleData = {
      text: sample.analysis?.text || "Mock Sample",
      buttons: sample.analysis?.buttons?.filter(b => b.tagName === 'button').map(b => b.text) || ["Retry"],
      category: sample.metadata?.category || "retry"
    };

    ws.on('open', () => {
      const sampleJson = JSON.stringify(sampleData);
      const injectionCode = `
        (function() {
          const MOCK_CLASS = 'antigravity-mock-dialog';
          const data = ${sampleJson};
          console.log('[Mock] Injecting sample (SAFE MODE): ' + data.category);
          
          // Cleanup
          document.querySelectorAll('.' + MOCK_CLASS).forEach(m => m.remove());
          const old = document.querySelector('.test-mock-container');
          if (old) old.remove();

          // Create Backdrop
          const backdrop = document.createElement('div');
          backdrop.className = 'test-mock-container ' + MOCK_CLASS;
          backdrop.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:999998;background-color:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px);pointer-events:none;';
          
          // Create Dialog Container
          const container = document.createElement('div');
          container.className = 'monaco-workbench monaco-dialog-box test-dialog ' + MOCK_CLASS;
          
          const isRetry = data.category === 'retry';
          const themeColor = isRetry ? '#f14c4c' : '#3794ff';
          
          container.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%, -50%);background:#252526;color:#ccc;padding:25px;border:1px solid ' + themeColor + ';z-index:999999;box-shadow:0 10px 40px rgba(0,0,0,0.8);border-radius:8px;width:500px;max-width:90vw;font-family:sans-serif;border-left:5px solid ' + themeColor + ';pointer-events:auto;';
          
          const title = document.createElement('div');
          title.style.cssText = 'margin-bottom:10px;font-weight:bold;color:' + themeColor + ';';
          title.textContent = isRetry ? 'High Traffic / Error (SAMPLE)' : 'Agent Prompt (SAMPLE)';
          
          const body = document.createElement('div');
          body.style.cssText = 'margin-bottom:20px;font-size:13px;line-height:1.4;max-height:300px;overflow-y:auto;';
          
          // Clean text
          let cleanText = data.text;
          data.buttons.forEach(btn => {
            if (cleanText.endsWith(btn)) cleanText = cleanText.substring(0, cleanText.length - btn.length);
          });
          body.textContent = cleanText;
          
          const btnContainer = document.createElement('div');
          btnContainer.className = 'footer';
          btnContainer.style.cssText = 'display:flex;justify-content:flex-end;gap:10px;';
          
          data.buttons.forEach(btnText => {
            const btn = document.createElement('button');
            btn.className = 'monaco-button';
            btn.textContent = btnText;
            
            const isPrimary = /retry|accept|run|execute|allow|approve|yes|proceed|ok|confirm|continue/i.test(btnText);
            btn.style.cssText = isPrimary 
              ? 'background:#0e639c;color:white;border:none;padding:6px 15px;cursor:pointer;border-radius:2px;' 
              : 'background:#3a3d41;color:white;border:none;padding:6px 15px;cursor:pointer;border-radius:2px;';
            
            btn.onclick = () => {
              container.remove();
              backdrop.remove();
            };
            btnContainer.appendChild(btn);
          });
          
          container.appendChild(title);
          container.appendChild(body);
          container.appendChild(btnContainer);
          
          document.body.appendChild(backdrop);
          document.body.appendChild(container);
          
          return true;
        })()
      `;

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
        if (msg.result?.exceptionDetails) {
          console.error('   ❌ Browser Exception:', msg.result.exceptionDetails.exception?.description || msg.result.exceptionDetails.text);
          resolve(false);
        } else {
          resolve(true);
        }
        ws.terminate();
      }
    });

    ws.on('error', () => {
      resolve(false);
    });
  });
}

mockDialog();
