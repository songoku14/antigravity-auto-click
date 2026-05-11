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

  const samplesDir = path.join(__dirname, '..', 'samples');
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
    const target = pageTargets[0];
    console.log(`🎯 Đang inject vào: "${target.title}"`);

    const success = await injectMockHtml(target, selected.analysis.html);
    
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

function injectMockHtml(target, html) {
  return new Promise((resolve) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    let finished = false;

    // We wrap the HTML in a container to ensure it's visible and fixed
    // and we escape backticks for the template string
    const escapedHtml = html.replace(/`/g, '\\`').replace(/\$/g, '\\$');
    const injectionCode = `
      (function() {
        console.log('[Mock] Injecting sample dialog...');
        // Remove existing test dialogs if any
        const old = document.querySelector('.test-mock-container');
        if (old) old.remove();

        const container = document.createElement('div');
        container.className = 'test-mock-container';
        
        // Use DOMParser to bypass TrustedHTML if enabled
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(\`${escapedHtml}\`, 'text/html');
          if (doc.body.firstChild) {
            container.appendChild(doc.body.firstChild);
          } else {
            container.textContent = 'Failed to parse HTML';
          }
        } catch (e) {
          console.error('[Mock] DOMParser failed:', e);
          container.textContent = 'Injection error: ' + e.message;
        }
        
        // Ensure it's appended to body
        document.body.appendChild(container);
        
        // Optional: ensure it's visible if it wasn't
        const dialog = container.firstElementChild;
        if (dialog) {
          dialog.style.display = 'block';
          dialog.style.visibility = 'visible';
          dialog.style.opacity = '1';
          // Ensure it's on top
          dialog.style.zIndex = '999999';
        }
        
        return true;
      })()
    `;

    ws.on('open', () => {
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
        finished = true;
        ws.terminate();
        const success = msg.result?.result?.value === true;
        resolve(success);
      }
    });
    
    ws.on('error', () => {
      if (!finished) {
        finished = true;
        resolve(false);
      }
    });

    setTimeout(() => {
      if (!finished) {
        finished = true;
        ws.terminate();
        resolve(false);
      }
    }, 5000);
  });
}

mockDialog();
