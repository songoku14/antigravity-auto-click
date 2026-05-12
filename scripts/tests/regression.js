/**
 * scripts/tests/regression.js
 * 
 * Realistic Full-DOM Regression Testing Tool.
 * Verifies detection logic against captured HTML snapshots using JSDOM.
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { getInjectionScript } = require('../../src/payload/injection-payload');

const SAMPLES_DIR = fs.existsSync(path.join(__dirname, '..', '..', 'samples')) 
  ? path.join(__dirname, '..', '..', 'samples')
  : path.join(__dirname, '..', 'samples');

async function runRegressionTests() {
  const args = process.argv.slice(2);
  const pattern = args.find(arg => !arg.startsWith('--'));
  
  console.log('\x1b[36m======================================================\x1b[0m');
  console.log('\x1b[36m🧪 BẮT ĐẦU TEST DOM SAMPLES (REGRESSION)\x1b[0m');
  if (pattern) {
    console.log(`\x1b[33m🔍 Tìm kiếm mẫu khớp với: "${pattern}"\x1b[0m`);
  }
  console.log('\x1b[36m======================================================\x1b[0m');

  if (!fs.existsSync(SAMPLES_DIR)) {
    console.error('❌ Thư mục samples/ không tồn tại.');
    return;
  }

  // Strictly filter for dom snapshots (full_dom or sample)
  let files = fs.readdirSync(SAMPLES_DIR)
    .filter(f => f.endsWith('.html'))
    .filter(f => f.startsWith('full_dom_') || f.startsWith('sample_'));
  
  if (pattern) {
    const lowerPattern = pattern.toLowerCase();
    files = files.filter(f => f.toLowerCase().includes(lowerPattern));
  }

  if (files.length === 0) {
    console.log('ℹ️ Không tìm thấy mẫu "full_dom_" phù hợp trong thư mục samples/.');
    return;
  }

  let passed = 0;
  let total = 0;

  for (const htmlFile of files) {
    total++;
    const htmlPath = path.join(SAMPLES_DIR, htmlFile);
    const baseName = htmlFile.replace('.html', '');
    const jsonPath = path.join(SAMPLES_DIR, baseName + '.json');
    
    let metadata = null;
    if (fs.existsSync(jsonPath)) {
      try {
        metadata = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      } catch (e) {}
    }

    console.log(`\n📄 Đang kiểm tra: \x1b[34m${htmlFile}\x1b[0m`);
    
    const result = await verifySample(htmlPath, metadata);
    if (result.success) passed++;
  }

  console.log('\n\x1b[36m======================================================\x1b[0m');
  console.log(`🏁 KẾT QUẢ: \x1b[1m${passed}/${total}\x1b[0m trường hợp vượt qua.`);
  console.log('\x1b[36m======================================================\x1b[0m');
  
  if (passed < total) process.exit(1);
}

async function verifySample(htmlPath, metadata) {
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  // Pre-process HTML to remove script tags
  const cleanHtml = htmlContent.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  const dom = new JSDOM(cleanHtml, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    url: "http://localhost/workbench.html"
  });

  const { window } = dom;
  window.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  
  // Mock click to track execution
  window.HTMLElement.prototype.click = function() {
    this.__clicked = true;
    const event = new window.MouseEvent('click', { bubbles: true });
    this.dispatchEvent(event);
  };

  // Mock getBoundingClientRect and elementFromPoint to support visibility checks
  const rectMap = new Map();
  let nextCoord = 10;
  window.Element.prototype.getBoundingClientRect = function() {
    const coord = nextCoord++;
    const rect = { 
      width: 100, height: 40, 
      top: coord, left: coord, 
      bottom: coord + 40, right: coord + 100, 
      x: coord, y: coord 
    };
    // Map the center point to this element
    rectMap.set(`${rect.left + 50},${rect.top + 20}`, this);
    return rect;
  };

  window.document.elementFromPoint = function(x, y) {
    return rectMap.get(`${x},${y}`) || window.document.body;
  };
  
  try {
    // Run injection script with explicit feature flags. Analyze immediately so
    // the dry-run observes the same DOM before the scheduled auto-scan clicks.
    const scriptText = getInjectionScript({ testMode: true, autoRetry: true, autoAccept: true });
    window.eval(scriptText);

    if (typeof window.__analyzeDialog !== 'function') {
      return { success: false };
    }

    const analysis = window.__analyzeDialog();

    // Give the real daemon-equivalent scan a moment to execute for click checks.
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log(`   🔍 Phân tích DOM:`);
    console.log(`      - Tìm thấy Agent Panel: ${analysis.foundAgentPanel ? '✅ CÓ' : '❌ KHÔNG'}`);
    console.log(`      - Số lượng Actionable Cards: \x1b[1m${analysis.containerCount}\x1b[0m`);
    console.log(`      - Tổng số nút bấm phát hiện: \x1b[1m${analysis.totalButtons || 0}\x1b[0m`);
    
    analysis.containers.forEach((c, idx) => {
      const location = c.isAgentWindow ? ' [Agent Panel]' : ' [Main Window]';
      console.log(`      \x1b[34mCard #${idx + 1}${location}:\x1b[0m`);
      
      if (c.buttons.retry.length > 0) {
        c.buttons.retry.forEach(b => {
          console.log(`         🔄 Btn: \x1b[32m${b.text}\x1b[0m | Cạnh đó: \x1b[2m${b.context || 'N/A'}\x1b[0m`);
        });
      }
      
      if (c.buttons.accept.length > 0) {
        c.buttons.accept.forEach(b => {
          console.log(`         ⚡ Btn: \x1b[36m${b.text}\x1b[0m | Cạnh đó: \x1b[2m${b.context || 'N/A'}\x1b[0m`);
        });
      }

      if (c.buttons.retry.length === 0 && c.buttons.accept.length === 0) {
        console.log(`         (Không tìm thấy nút Retry/Accept)`);
      }
    });

    // Final Result Verification
    let expectedBtnText = metadata?.metadata?.expectedButton || metadata?.expectedButton || '';
    if (expectedBtnText) {
      const allBtns = Array.from(window.document.querySelectorAll('button, [role="button"], .monaco-button, .action-label'));
      const expectedBtnEl = allBtns.find(b => (b.textContent || '').toLowerCase().includes(expectedBtnText.toLowerCase()));
      
      if (expectedBtnEl && expectedBtnEl.__clicked) {
        console.log(`   ✅ \x1b[32mPASS\x1b[0m: Logic đã tự động CLICK nút \x1b[1m"${expectedBtnText}"\x1b[0m`);
        return { success: true };
      }
      console.log(`   ❌ \x1b[31mFAIL\x1b[0m: Không tìm thấy hoặc không click được nút "${expectedBtnText}".`);
      return { success: false };
    }

    // Heuristic success check if no expected button
    const hasAnyAction = analysis.containers.some(c => c.buttons.retry.length > 0 || c.buttons.accept.length > 0);
    if (hasAnyAction) {
      console.log(`   ✅ \x1b[32mPASS\x1b[0m: Tìm thấy nút bấm có thể xử lý.`);
      return { success: true };
    }
    
    return { success: false };
  } catch (e) {
    console.error('   ❌ Error in analysis:', e.message);
    return { success: false };
  } finally {
    window.close();
  }
}

runRegressionTests();
