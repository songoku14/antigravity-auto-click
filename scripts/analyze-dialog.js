/**
 * scripts/analyze-dialog.js
 * 
 * CLI utility to analyze current dialog in Antigravity and categorize it.
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { findCDPPort, getTargets, filterPageTargets } = require('../src/discovery');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function analyzeDialog() {
  console.log('\x1b[36m======================================================\x1b[0m');
  console.log('\x1b[36m🔍 ĐANG PHÂN TÍCH DIALOG TRÊN ANTIGRAVITY\x1b[0m');
  console.log('\x1b[36m======================================================\x1b[0m');
  
  const port = findCDPPort();
  
  if (!port) {
    console.error('\x1b[31m❌ Lỗi: Không tìm thấy cổng CDP. Antigravity đã chạy chưa?\x1b[0m');
    console.log('Mẹo: Chạy Antigravity với --remote-debugging-port=31905');
    process.exit(1);
  }
  
  console.log(`✅ Kết nối CDP qua cổng: ${port}`);
  
  try {
    const targets = await getTargets(port);
    const pageTargets = filterPageTargets(targets);
    
    if (pageTargets.length === 0) {
      console.error('\x1b[31m❌ Lỗi: Không thấy page nào đang mở trong Antigravity.\x1b[0m');
      process.exit(1);
    }

    console.log(`\nPhát hiện ${pageTargets.length} trang có thể phân tích. Đang quét...`);
    
    let anyDialogFound = false;

    for (const target of pageTargets) {
      const analysis = await runAnalysisCommand(target);
      
      if (!analysis) continue;

      console.log(`\n\x1b[33m🎯 TRANG: "${target.title}"\x1b[0m`);
      
      if (!analysis.found) {
        console.log('   [!] Không tìm thấy dialog box chuẩn.');
      } else {
        anyDialogFound = true;
        console.log(`   [\x1b[32m✅\x1b[0m] Tìm thấy ${analysis.containers.length} dialog box.`);
      }

      for (let i = 0; i < analysis.containers.length; i++) {
        const c = analysis.containers[i];
        console.log(`\n   \x1b[34m--- [Container #${i+1}] ${c.isBody ? '(Toàn bộ trang)' : '(Dialog Box)'} ---\x1b[0m`);
        
        const cleanText = c.text.replace(/\s+/g, ' ').trim().substring(0, 500);
        console.log(`   📝 Văn bản: "${cleanText}..."`);
        
        console.log(`   🔘 Nút bấm: ${c.buttons.map(b => `[\x1b[32m${b.text}\x1b[0m]`).join(', ') || 'Không tìm thấy'}`);

        console.log('\n   ------------------------------------------------------');
        const btnText = await question('   ❓ Bạn muốn click vào nút nào? (Nhập text hoặc Enter bỏ qua): ');
        
        if (btnText) {
          console.log('\n   ❓ Phân loại Dialog này:');
          console.log('      1. \x1b[32mAuto Retry\x1b[0m  (Dành cho lỗi traffic, busy - click liên tục khi có lỗi)');
          console.log('      2. \x1b[32mAuto Accept\x1b[0m (Dành cho agent prompt, xác nhận - click 1 lần rồi thôi)');
          
          const typeChoice = await question('   👉 Lựa chọn của bạn (1/2): ');
          const category = typeChoice === '1' ? 'retry' : 'accept';

          const pattern = suggestRegex(btnText, c.buttons, category);
          
          const apply = await question('\n   ❓ Anh có muốn áp dụng (Lưu) pattern này luôn không? (y/n): ');
          if (apply.toLowerCase() === 'y') {
            await applyConfig(pattern, category);
          }

          await saveSample(targetTitle, c, btnText, category);
        }
      }
    }
    
    if (!anyDialogFound) {
      console.log('\n\x1b[33m⚠️ Lưu ý: Không phát hiện dialog container nào. Có thể dialog này dùng class CSS mới.\x1b[0m');
    }

    console.log('\n✅ Hoàn tất phân tích.');
    rl.close();
  } catch (e) {
    console.error(`\n\x1b[31m❌ Lỗi nghiêm trọng: ${e.message}\x1b[0m`);
    rl.close();
  }
}

async function applyConfig(pattern, category) {
  const configPath = path.join(__dirname, '..', 'config.json');
  let config = { blacklist: [], autoAccept: true, autoRetry: true };
  
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch(e) {}
  }
  
  const field = category === 'retry' ? 'customRetryPatterns' : 'customAcceptPatterns';
  if (!config[field]) config[field] = [];
  
  if (!config[field].includes(pattern)) {
    config[field].push(pattern);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`\n   \x1b[32m✨ ĐÃ TỰ ĐỘNG CẬP NHẬT CẤU HÌNH!\x1b[0m`);
    console.log(`      Pattern mới đã được thêm vào config.json.`);
    console.log(`      Hệ thống sẽ tự động nạp lại và áp dụng ngay lập tức.`);
  } else {
    console.log(`\n   ℹ️ Pattern này đã tồn tại trong cấu hình.`);
  }
}

function runAnalysisCommand(target) {
  return new Promise((resolve) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    let finished = false;

    ws.on('open', () => {
      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: {
          expression: 'window.__analyzeDialog ? window.__analyzeDialog() : "not_injected"',
          returnByValue: true
        }
      }));
    });
    
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.id === 1) {
          const result = msg.result?.result?.value;
          finished = true;
          ws.terminate();
          if (result === 'not_injected') {
            resolve(null);
          } else {
            resolve(result);
          }
        }
      } catch (e) {
        // ignore
      }
    });
    
    ws.on('error', () => {
      if (!finished) {
        finished = true;
        resolve(null);
      }
    });

    setTimeout(() => {
      if (!finished) {
        finished = true;
        ws.terminate();
        resolve(null);
      }
    }, 4000);
  });
}

function suggestRegex(text, buttons, category) {
  console.log(`\n   \x1b[32m💡 GỢI Ý CẤU HÌNH:\x1b[0m`);
  
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = `/\\\\b${escaped}\\\\b/i`;
  const arrayName = category === 'retry' ? 'retryButtonPatterns' : 'actionButtonPatterns';
  
  console.log(`      - Loại: \x1b[36m${category.toUpperCase()}\x1b[0m`);
  console.log(`      - Regex pattern đề xuất: \x1b[32m${pattern}\x1b[0m`);
  console.log(`      - Nơi thêm: \x1b[33m${arrayName}\x1b[0m trong \x1b[34msrc/injection-payload.js\x1b[0m`);
  
  const found = buttons.find(b => b.text.toLowerCase().includes(text.toLowerCase()));
  if (found) {
    console.log(`      - Metadata của nút:`);
    console.log(`        + Tag: ${found.tagName}`);
    console.log(`        + Class: ${found.className}`);
    if (found.id) console.log(`        + ID: ${found.id}`);
  }

  return pattern;
}

async function saveSample(targetTitle, container, expectedBtn, category) {
  const samplesDir = path.join(__dirname, '..', 'samples');
  if (!fs.existsSync(samplesDir)) {
    fs.mkdirSync(samplesDir);
  }

  const timestamp = Date.now();
  const filename = `sample_${timestamp}.json`;
  const filePath = path.join(samplesDir, filename);
  
  const sample = {
    metadata: {
      target: targetTitle,
      timestamp: new Date().toISOString(),
      category: category,
      expectedButton: expectedBtn
    },
    analysis: {
      text: container.text,
      html: container.html,
      buttons: container.buttons
    }
  };

  fs.writeFileSync(filePath, JSON.stringify(sample, null, 2));
  
  const htmlPath = path.join(samplesDir, `sample_${timestamp}.html`);
  fs.writeFileSync(htmlPath, `<!-- Category: ${category} -->\n<!-- Target: ${targetTitle} -->\n<!-- Expected Button: ${expectedBtn} -->\n` + container.html);
  
  console.log(`\n   💾 Đã lưu dữ liệu mẫu:`);
  console.log(`      - JSON: samples/${filename}`);
  console.log(`      - HTML: samples/sample_${timestamp}.html`);
}

analyzeDialog();
