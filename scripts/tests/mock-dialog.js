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
        const MOCK_CLASS = 'antigravity-mock-dialog';
        console.log('[Mock] Injecting sample dialog...');
        
        // Cleanup existing
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
        
        // Apply premium styles
        container.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%, -50%);background:#252526;color:#ccc;padding:20px;border:1px solid #3794ff;z-index:999999;box-shadow:0 10px 40px rgba(0,0,0,0.8);border-radius:8px;width:600px;max-width:90vw;font-family:sans-serif;border-left:5px solid #3794ff;pointer-events:auto;';
        
        // Robust HTML Injection with Trusted Types bypass
        // Robust HTML Injection with Trusted Types bypass
        try {
          const fragment = document.createRange().createContextualFragment(\`${escapedHtml}\`);
          container.appendChild(fragment);
          console.log('[Mock] Injected via ContextualFragment');
        } catch (e) {
          console.error('[Mock] Fragment injection failed, trying DOMParser:', e);
          try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(\`${escapedHtml}\`, 'text/html');
            while (doc.body.firstChild) {
              container.appendChild(doc.body.firstChild);
            }
            console.log('[Mock] Injected via DOMParser');
          } catch (e2) {
            console.error('[Mock] DOMParser also failed:', e2);
            if (window.trustedTypes && window.trustedTypes.createPolicy) {
              try {
                const policy = window.trustedTypes.createPolicy('antigravity-bypass-' + Date.now(), { createHTML: s => s });
                container.innerHTML = policy.createHTML(\`${escapedHtml}\`);
                console.log('[Mock] Injected via TrustedTypes Policy');
              } catch (policyErr) {
                container.innerText = 'Trusted Types Blocked: ' + policyErr.message;
              }
            } else {
              try {
                container.innerHTML = \`${escapedHtml}\`;
              } catch (e3) {
                container.innerText = 'Injection Blocked: ' + e3.message;
              }
            }
          }
        }
        
        document.body.appendChild(backdrop);
        document.body.appendChild(container);
        
        // Auto-cleanup after 60s for manual inspection
        setTimeout(() => {
          if (document.contains(container)) container.remove();
          if (document.contains(backdrop)) backdrop.remove();
        }, 60000);
        
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
        
        if (msg.result?.exceptionDetails) {
          console.error('   ❌ Browser Exception:', msg.result.exceptionDetails.exception?.description || msg.result.exceptionDetails.text);
          resolve(false);
        } else {
          const success = msg.result?.result?.value === true;
          resolve(success);
        }
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
