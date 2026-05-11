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
const WebSocket = require('ws');
const { getInjectionScript } = require('../../src/payload/injection-payload');
const { findCDPPort, getTargets, filterPageTargets } = require('../../src/core/discovery');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

const SAMPLES_DIR = path.join(__dirname, '..', '..', 'samples');

async function runRegressionTests() {
  // Lấy patterns và flags
  const args = process.argv.slice(2);
  const pattern = args.find(arg => !arg.startsWith('--'));
  const verifyExecution = args.includes('--verify');
  
  console.log('\x1b[36m======================================================\x1b[0m');
  console.log('\x1b[36m🧪 BẮT ĐẦU KIỂM TRA HỒI QUY (REGRESSION TEST)\x1b[0m');
  if (pattern) {
    console.log(`\x1b[33m🔍 Tìm kiếm mẫu khớp với: "${pattern}"\x1b[0m`);
  }
  if (verifyExecution) {
    console.log('\x1b[35m⚡ CHẾ ĐỘ XÁC MINH THỰC THI (VERIFY EXECUTION) ĐANG BẬT\x1b[0m');
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
    
    const result = await verifySample(htmlPath, metadata, verifyExecution);
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

async function verifySample(htmlPath, metadata, verifyExecution = false) {
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');
  
  // Tự động inject vào Antigravity nếu app đang mở
  const executionResult = await injectToAntigravity(htmlContent, path.basename(htmlPath), metadata, verifyExecution);

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

      // If execution verification was requested, check the result
      if (verifyExecution) {
        if (executionResult && executionResult.clicked) {
          console.log(`   ✨ \x1b[32mEXECUTION PASS\x1b[0m: Auto-Click daemon đã xử lý thành công.`);
          return { success: true, analysis, matchedButton, matchedContainer };
        } else {
          console.log(`   ❌ \x1b[31mEXECUTION FAIL\x1b[0m: Auto-Click daemon không phản hồi hoặc không thể click.`);
          return { success: false, analysis, matchedButton, matchedContainer };
        }
      }

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

async function injectToAntigravity(html, filename, metadata, verifyExecution = false) {
  const port = findCDPPort();
  if (!port) return { success: false, error: 'no_port' };

  try {
    const targets = await getTargets(port);
    const pageTargets = filterPageTargets(targets);
    if (pageTargets.length === 0) return { success: false, error: 'no_targets' };

    const target = pageTargets.find(t => t.url?.endsWith('workbench.html')) || 
                   pageTargets.find(t => !t.title.includes('Launchpad')) ||
                   pageTargets[0];

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    let executionStatus = { success: false, clicked: false, removed: false };
    const MOCK_CLASS = 'antigravity-mock-dialog';

    // Extract useful info from metadata if available
    const sampleData = {
      text: metadata?.analysis?.text || "Regression Sample: " + filename,
      buttons: metadata?.analysis?.buttons?.filter(b => b.tagName === 'button').map(b => b.text) || ["Retry"],
      category: metadata?.metadata?.category || "retry"
    };

    await new Promise((resolve) => {
      ws.on('open', () => {
        const sampleJson = JSON.stringify(sampleData);
        const injectionCode = `
          (function() {
            const MOCK_CLASS = '${MOCK_CLASS}';
            const data = ${sampleJson};
            console.log('[Regression] Injecting sample (SAFE MODE): ' + data.category);
            
            // Cleanup
            document.querySelectorAll('.' + MOCK_CLASS).forEach(m => m.remove());
            const old = document.querySelector('.test-mock-container');
            if (old) old.remove();

            // Create Backdrop
            const backdrop = document.createElement('div');
            backdrop.className = 'test-mock-container ' + MOCK_CLASS;
            backdrop.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:999998;background-color:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px);pointer-events:none;';
            
            // Create Dialog Container (Standard structure)
            const container = document.createElement('div');
            container.className = 'monaco-workbench monaco-dialog-box test-dialog ' + MOCK_CLASS;
            
            // Standard Premium Styles (from trigger-test.js)
            const isRetry = data.category === 'retry';
            const themeColor = isRetry ? '#f14c4c' : '#3794ff';
            
            container.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%, -50%);background:#252526;color:#ccc;padding:25px;border:1px solid ' + themeColor + ';z-index:999999;box-shadow:0 10px 40px rgba(0,0,0,0.8);border-radius:8px;width:500px;max-width:90vw;font-family:sans-serif;border-left:5px solid ' + themeColor + ';pointer-events:auto;';
            
            // Build Content safely using textContent
            const title = document.createElement('div');
            title.style.cssText = 'margin-bottom:10px;font-weight:bold;color:' + themeColor + ';';
            title.textContent = isRetry ? 'High Traffic / Error (SAMPLE)' : 'Agent Prompt (SAMPLE)';
            
            const body = document.createElement('div');
            body.style.cssText = 'margin-bottom:20px;font-size:13px;line-height:1.4;max-height:300px;overflow-y:auto;';
            // Clean up text (remove button text at the end if it was concatenated)
            let cleanText = data.text;
            data.buttons.forEach(btn => {
              if (cleanText.endsWith(btn)) cleanText = cleanText.substring(0, cleanText.length - btn.length);
            });
            body.textContent = cleanText;
            
            const btnContainer = document.createElement('div');
            btnContainer.className = 'footer';
            btnContainer.style.cssText = 'display:flex;justify-content:flex-end;gap:10px;';
            
            // Create buttons from sample metadata
            data.buttons.forEach(btnText => {
              const btn = document.createElement('button');
              btn.className = 'monaco-button';
              btn.textContent = btnText;
              
              const isPrimary = /retry|accept|run|execute|allow|approve|yes|proceed|ok|confirm|continue/i.test(btnText);
              btn.style.cssText = isPrimary 
                ? 'background:#0e639c;color:white;border:none;padding:6px 15px;cursor:pointer;border-radius:2px;' 
                : 'background:#3a3d41;color:white;border:none;padding:6px 15px;cursor:pointer;border-radius:2px;';
              
              btn.onclick = () => {
                console.log('[Regression] Sample button CLICKED: ' + btnText);
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

        if (verifyExecution) {
          ws.send(JSON.stringify({ id: 2, method: 'Runtime.enable' }));
        }

        ws.send(JSON.stringify({
          id: 1,
          method: 'Runtime.evaluate',
          params: { expression: injectionCode, returnByValue: true }
        }));
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        
        if (msg.id === 1) {
          if (msg.result?.exceptionDetails) {
            console.error('   ❌ BROWSER ERROR:', msg.result.exceptionDetails.exception?.description || msg.result.exceptionDetails.text);
            executionStatus.success = false;
            if (!verifyExecution) {
              ws.terminate();
              resolve(executionStatus);
            }
          } else {
            console.log(`   📺 \x1b[32mINJECTED\x1b[0m: Đã đẩy lên giao diện Antigravity (Safe Mode).`);
            executionStatus.success = true;
            if (!verifyExecution) {
              ws.terminate();
              resolve(executionStatus);
            }
          }
        }

        if (verifyExecution && msg.method === 'Runtime.consoleAPICalled') {
          const text = (msg.params.args || []).map(a => a.value || '').join(' ');
          
          // Kiểm tra log từ daemon
          if (text.includes('RETRY_CLICKED') || text.includes('ACCEPT_CLICKED') || text.includes('Clicked successfully')) {
            executionStatus.clicked = true;
          }
          
          // Kiểm tra log từ script sample (onclick handler)
          if (text.includes('Sample button CLICKED')) {
            executionStatus.clicked = true;
          }
          
          // Nếu đã click, đợi thêm một chút để kiểm tra xem dialog có biến mất không
          if (executionStatus.clicked) {
            setTimeout(() => {
              ws.send(JSON.stringify({
                id: 100,
                method: 'Runtime.evaluate',
                params: { expression: `document.querySelector(".${MOCK_CLASS}") === null`, returnByValue: true }
              }));
            }, 1000);
          }
        }

        if (verifyExecution && msg.id === 100) {
          if (msg.result?.result?.value === true) {
            executionStatus.removed = true;
            ws.terminate();
            resolve(executionStatus);
          }
        }
      });

      ws.on('error', () => {
        ws.terminate();
        resolve(executionStatus);
      });

      // Tăng timeout nếu cần verify
      const timeoutMs = verifyExecution ? 15000 : 3000;
      setTimeout(() => {
        ws.terminate();
        resolve(executionStatus);
      }, timeoutMs);
    });

    if (!verifyExecution) {
      await new Promise(r => setTimeout(r, 1000));
    }
    
    return executionStatus;

  } catch (e) {
    console.error('   ⚠️ Error in live injection:', e.message);
  }
}

runRegressionTests();
