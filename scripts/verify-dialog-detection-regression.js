/**
 * scripts/verify-dialog-detection-regression.js
 * 
 * Regression testing tool to verify dialog detection logic against captured DOM samples.
 * Uses jsdom to simulate a browser environment and runs the injection payload.
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { getInjectionScript } = require('../src/injection-payload');

const SAMPLES_DIR = path.join(__dirname, '..', 'samples');

async function runRegressionTests() {
  console.log('\x1b[36m======================================================\x1b[0m');
  console.log('\x1b[36m🧪 BẮT ĐẦU KIỂM TRA HỒI QUY (REGRESSION TEST)\x1b[0m');
  console.log('\x1b[36m======================================================\x1b[0m');

  if (!fs.existsSync(SAMPLES_DIR)) {
    console.error('❌ Thư mục samples/ không tồn tại.');
    return;
  }

  const files = fs.readdirSync(SAMPLES_DIR).filter(f => f.endsWith('.html'));
  
  if (files.length === 0) {
    console.log('ℹ️ Không tìm thấy file HTML nào trong thư mục samples/.');
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
    
    const success = await verifySample(htmlPath, metadata);
    if (success) passed++;
  }

  console.log('\n\x1b[36m======================================================\x1b[0m');
  console.log(`🏁 KẾT QUẢ: \x1b[1m${passed}/${total}\x1b[0m trường hợp vượt qua.`);
  console.log('\x1b[36m======================================================\x1b[0m');
  
  if (passed < total) {
    process.exit(1);
  }
}

async function verifySample(htmlPath, metadata) {
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');
  // Pre-process HTML to remove script tags that might break jsdom
  const cleanHtml = htmlContent.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Create a JSDOM instance
  const dom = new JSDOM(cleanHtml, {
    runScripts: "dangerously",
    pretendToBeVisual: true
  });

  const { window } = dom;
  
  // Polyfills for jsdom
  window.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  window.cancelAnimationFrame = (id) => clearTimeout(id);
  
  // Suppress jsdom navigation errors or external resource errors
  dom.virtualConsole.on('error', () => {});
  dom.virtualConsole.on('jsdomError', () => {});

  try {
    // 1. Get and run injection script
    const scriptText = getInjectionScript();
    
    // Run it directly in the window context
    window.eval(scriptText);

    // 2. Give it a moment to initialize and scan
    await new Promise(resolve => setTimeout(resolve, 800));

    // 3. Run analysis
    if (typeof window.__analyzeDialog !== 'function') {
      console.log('   ❌ \x1b[31mFAIL\x1b[0m: Không thể khởi tạo script nhận diện trong DOM.');
      return false;
    }

    const analysis = window.__analyzeDialog();
    
    // 4. Verify results
    if (!analysis.found && (!metadata || metadata.metadata?.category !== 'none')) {
      // If we didn't find a container, check if it was supposed to be in body
      const bodyContainer = analysis.containers.find(c => c.isBody);
      if (!bodyContainer || bodyContainer.buttons.length === 0) {
        console.log(`   ❌ \x1b[31mFAIL\x1b[0m: Không phát hiện thấy Dialog nào.`);
        return false;
      }
    }

    // Match with expectations
    const allButtons = analysis.containers.flatMap(c => c.buttons);
    const foundButtonTexts = allButtons.map(b => b.text.toLowerCase());
    
    if (metadata && metadata.metadata && metadata.metadata.expectedButton) {
      const expected = metadata.metadata.expectedButton.toLowerCase();
      const hasMatch = foundButtonTexts.some(t => t.includes(expected) || expected.includes(t));
      
      if (hasMatch) {
        console.log(`   ✅ \x1b[32mPASS\x1b[0m: Tìm thấy nút bấm kỳ vọng "${metadata.metadata.expectedButton}".`);
        return true;
      } else {
        console.log(`   ❌ \x1b[31mFAIL\x1b[0m: Không tìm thấy nút "${metadata.metadata.expectedButton}".`);
        console.log(`      Nút hiện có: ${foundButtonTexts.join(', ') || 'None'}`);
        return false;
      }
    } else {
      // Heuristic check for "full_dom" or unknown samples
      const isRetry = foundButtonTexts.some(t => /retry|thử lại/i.test(t));
      const isAccept = foundButtonTexts.some(t => /accept|run|execute|allow/i.test(t));
      
      if (isRetry || isAccept) {
        console.log(`   ✅ \x1b[32mPASS\x1b[0m: Tự động phát hiện Dialog (${isRetry ? 'Retry' : 'Accept'}).`);
        return true;
      } else {
        console.log(`   ⚠️ \x1b[33mWARN\x1b[0m: Không xác định được nút bấm quan trọng. (Found: ${foundButtonTexts.join(', ') || 'None'})`);
        return false;
      }
    }

  } catch (e) {
    console.error(`   ❌ \x1b[31mERROR\x1b[0m:`, e);
    return false;
  } finally {
    window.close();
  }
}

runRegressionTests();
