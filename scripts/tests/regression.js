/**
 * scripts/verify-dialog-detection-regression.js
 * 
 * Regression testing tool to verify dialog detection logic against captured DOM samples.
 * Uses jsdom to simulate a browser environment and runs the injection payload.
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const readline = require('readline');
const { getInjectionScript } = require('../../src/payload/injection-payload');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

const SAMPLES_DIR = path.join(__dirname, '..', '..', 'samples');

async function runRegressionTests() {
  const pattern = process.argv[2];
  
  console.log('\x1b[36m======================================================\x1b[0m');
  console.log('\x1b[36m🧪 BẮT ĐẦU KIỂM TRA HỒI QUY (REGRESSION TEST)\x1b[0m');
  if (pattern) {
    console.log(`\x1b[33m🔍 Tìm kiếm mẫu khớp với: "${pattern}"\x1b[0m`);
  }
  console.log('\x1b[36m======================================================\x1b[0m');

  if (!fs.existsSync(SAMPLES_DIR)) {
    console.error('❌ Thư mục samples/ không tồn tại.');
    return;
  }

  let files = fs.readdirSync(SAMPLES_DIR).filter(f => f.endsWith('.html'));
  
  if (pattern) {
    const lowerPattern = pattern.toLowerCase();
    files = files.filter(f => f.toLowerCase().includes(lowerPattern));
    
    if (files.length === 0) {
      console.log(`\x1b[31m❌ Không tìm thấy mẫu nào khớp với "${pattern}" trong thư mục samples/.\x1b[0m`);
      process.exit(1);
    }
    
    if (files.length > 1) {
      console.log(`\x1b[33m⚠️ Tìm thấy nhiều mẫu khớp với "${pattern}":\x1b[0m`);
      files.forEach((f, i) => console.log(`   ${i + 1}. ${f}`));
      console.log(`\n\x1b[36m👉 Vui lòng cung cấp tên cụ thể hơn.\x1b[0m`);
      process.exit(1);
    }
  }

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
    
    const result = await verifySample(htmlPath, metadata);
    if (result.success) passed++;
    
    // Store last result for single-file runs
    if (files.length === 1) {
      await handleSingleFileResult(htmlFile, htmlPath, result);
    }
  }

  console.log('\n\x1b[36m======================================================\x1b[0m');
  console.log(`🏁 KẾT QUẢ: \x1b[1m${passed}/${total}\x1b[0m trường hợp vượt qua.`);
  console.log('\x1b[36m======================================================\x1b[0m');
  
  if (passed < total) {
    rl.close();
    process.exit(1);
  }
  rl.close();
}

async function handleSingleFileResult(htmlFile, htmlPath, result) {
  // If it's already a formal sample, don't prompt to save
  if (htmlFile.startsWith('sample_')) return;

  console.log('\n\x1b[36m------------------------------------------------------\x1b[0m');
  const save = await question('❓ Bạn có muốn lưu bản dump này làm mẫu (Sample) chính thức không? (y/n): ');
  
  if (save.toLowerCase() === 'y') {
    console.log('\n❓ Phân loại Dialog này:');
    console.log('   1. \x1b[32mAuto Retry\x1b[0m  (Dành cho lỗi traffic, busy)');
    console.log('   2. \x1b[32mAuto Accept\x1b[0m (Dành cho agent prompt, xác nhận)');
    
    const typeChoice = await question('👉 Lựa chọn của bạn (1/2): ');
    const category = typeChoice === '1' ? 'retry' : 'accept';
    
    let expectedBtn = result.matchedButton ? result.matchedButton.text : '';
    if (!expectedBtn) {
      const allButtons = result.analysis?.containers.flatMap(c => c.buttons).map(b => b.text) || [];
      if (allButtons.length > 0) {
        console.log(`   Nút hiện có: ${allButtons.join(', ')}`);
      }
      expectedBtn = await question('❓ Nhập tên nút bấm mong đợi (Expected Button): ');
    } else {
      const confirmBtn = await question(`❓ Dùng nút "${expectedBtn}" làm nút mong đợi? (Enter = Có / Nhập text mới): `);
      if (confirmBtn) expectedBtn = confirmBtn;
    }

    await saveAsSample(htmlPath, result.analysis, expectedBtn, category);
  }
}

async function getNextSampleId(samplesDir) {
  if (!fs.existsSync(samplesDir)) return 1;
  const files = fs.readdirSync(samplesDir);
  let maxId = 0;
  files.forEach(file => {
    const match = file.match(/^sample_(\d+)/);
    if (match) {
      const id = parseInt(match[1], 10);
      if (id > maxId) maxId = id;
    }
  });
  return maxId + 1;
}

async function saveAsSample(originalHtmlPath, analysis, expectedBtn, category) {
  const nextId = await getNextSampleId(SAMPLES_DIR);
  const idStr = String(nextId).padStart(3, '0');
  
  // New naming convention: sample_NNN_category.html
  const baseName = `sample_${idStr}_${category}`;
  const filename = `${baseName}.json`;
  const filePath = path.join(SAMPLES_DIR, filename);
  const htmlFilename = `${baseName}.html`;
  const htmlPath = path.join(SAMPLES_DIR, htmlFilename);

  // Find the container that was matched or use the first one
  const container = analysis.containers.find(c => 
    c.buttons.some(b => b.text.toLowerCase().includes(expectedBtn.toLowerCase()))
  ) || analysis.containers[0];

  const sample = {
    id: idStr,
    metadata: {
      source: path.basename(originalHtmlPath),
      timestamp: new Date().toISOString(),
      category: category,
      expectedButton: expectedBtn
    },
    analysis: {
      text: container?.text || "",
      html: container?.html || "",
      buttons: container?.buttons || []
    }
  };

  fs.writeFileSync(filePath, JSON.stringify(sample, null, 2));
  fs.writeFileSync(htmlPath, `<!-- ID: ${idStr} -->\n<!-- Category: ${category} -->\n<!-- Source: ${path.basename(originalHtmlPath)} -->\n<!-- Expected Button: ${expectedBtn} -->\n` + (container?.html || fs.readFileSync(originalHtmlPath, 'utf8')));

  console.log(`\n   💾 \x1b[32mĐÃ LƯU MẪU MỚI!\x1b[0m`);
  console.log(`      - JSON: samples/${filename}`);
  console.log(`      - HTML: samples/${htmlFilename}`);
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
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    rectMap.set(`${centerX},${centerY}`, this);
    return rect;
  };

  window.document.elementFromPoint = function(x, y) {
    return rectMap.get(`${x},${y}`) || window.document.body;
  };
  
  // Suppress jsdom navigation errors or external resource errors
  dom.virtualConsole.on('error', () => {});
  dom.virtualConsole.on('jsdomError', () => {});

  try {
    // 1. Get and run injection script
    const scriptText = getInjectionScript();
    
    // Run it directly in the window context
    try {
      window.eval(scriptText);
    } catch (e) {
      console.error('   ❌ ERROR at eval: ', e.message);
      fs.writeFileSync(path.join(__dirname, '..', '..', 'scratch', 'failing-script.js'), scriptText);
      console.log('      Script saved to scratch/failing-script.js for inspection.');
      throw e;
    }

    // 2. Give it a moment to initialize and scan
    await new Promise(resolve => setTimeout(resolve, 800));

    // 3. Run analysis
    if (typeof window.__analyzeDialog !== 'function') {
      console.log('   ❌ \x1b[31mFAIL\x1b[0m: Không thể khởi tạo script nhận diện trong DOM.');
      return false;
    }

    const analysis = window.__analyzeDialog();
    
    // 4. Verify results
    let success = true;
    if (!analysis.found && (!metadata || metadata.metadata?.category !== 'none')) {
      // If we didn't find a container, check if it was supposed to be in body
      const bodyContainer = analysis.containers.find(c => c.isBody);
      if (!bodyContainer || bodyContainer.buttons.length === 0) {
        console.log(`   ❌ \x1b[31mFAIL\x1b[0m: Không phát hiện thấy Dialog nào.`);
        success = false;
      }
    }

    // Match with expectations
    let matchedButton = null;
    let matchedContainer = null;

    for (const container of analysis.containers) {
      for (const btn of container.buttons) {
        const btnText = btn.text.toLowerCase();
        
        if (metadata && metadata.metadata && metadata.metadata.expectedButton) {
          const expected = metadata.metadata.expectedButton.toLowerCase();
          if (btnText.includes(expected) || expected.includes(btnText)) {
            matchedButton = btn;
            matchedContainer = container;
            break;
          }
        } else {
          // Heuristic check
          if (/retry|thử lại/i.test(btnText) || /accept|run|execute|allow|approve|yes|proceed|ok|confirm|continue/i.test(btnText)) {
            matchedButton = btn;
            matchedContainer = container;
            break;
          }
        }
      }
      if (matchedButton) break;
    }

    if (matchedButton) {
      const type = /retry|thử lại/i.test(matchedButton.text) ? 'Retry' : 'Accept';
      console.log(`   ✅ \x1b[32mPASS\x1b[0m: Tìm thấy nút \x1b[1m"${matchedButton.text}"\x1b[0m (${type})`);
      
      const snippet = matchedContainer.text.replace(/\s+/g, ' ').substring(0, 160).trim();
      console.log(`      \x1b[90mDialog Content: "${snippet}..."\x1b[0m`);
      return { success: true, analysis, matchedButton, matchedContainer };
    } else {
      const allButtons = analysis.containers.flatMap(c => c.buttons).map(b => b.text);
      if (metadata && metadata.metadata && metadata.metadata.expectedButton) {
        console.log(`   ❌ \x1b[31mFAIL\x1b[0m: Không tìm thấy nút "${metadata.metadata.expectedButton}".`);
        console.log(`      Nút hiện có: ${allButtons.join(', ') || 'None'}`);
      } else {
        console.log(`   ⚠️ \x1b[33mWARN\x1b[0m: Không xác định được nút bấm quan trọng. (Found: ${allButtons.join(', ') || 'None'})`);
      }
      return { success: false, analysis };
    }

  } catch (e) {
    console.error(`   ❌ \x1b[31mERROR\x1b[0m:`, e);
    return { success: false };
  } finally {
    window.close();
  }
}

runRegressionTests();
