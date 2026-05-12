/**
 * scripts/tests/regression.js
 * 
 * Bộ test hồi quy (Regression Testing) chạy trên toàn bộ samples DOM.
 * Đảm bảo logic nhận diện không bị lỗi sau khi cập nhật mã nguồn (Passive Polling).
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { getInjectionScript } = require('../../src/payload/injection-payload');

const SAMPLES_DIR = path.join(__dirname, '..', '..', 'samples');

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

  total++;
  console.log(`\n📄 Đang kiểm tra: \x1b[34mstale_retry_button_replacement\x1b[0m`);
  const staleReplacementResult = await verifyStaleReplacementScenario();
  if (staleReplacementResult.success) passed++;

  total++;
  console.log(`\n📄 Đang kiểm tra: \x1b[34mfilename_retry_false_positive\x1b[0m`);
  const filenameFalsePositiveResult = await verifyFilenameRetryFalsePositive();
  if (filenameFalsePositiveResult.success) passed++;

  total++;
  console.log(`\n📄 Đang kiểm tra: \x1b[34mhistory_title_retry_false_positive\x1b[0m`);
  const historyTitleFalsePositiveResult = await verifyHistoryTitleRetryFalsePositive();
  if (historyTitleFalsePositiveResult.success) passed++;

  total++;
  console.log(`\n📄 Đang kiểm tra: \x1b[34mcleanup_cancels_pending_click\x1b[0m`);
  const cleanupPendingClickResult = await verifyCleanupCancelsPendingClick();
  if (cleanupPendingClickResult.success) passed++;

  total++;
  console.log(`\n📄 Đang kiểm tra: \x1b[34mephemeral_dialog_is_ignored_between_polls\x1b[0m`);
  const ephemeralDialogResult = await verifyEphemeralDialogIgnoredBetweenPolls();
  if (ephemeralDialogResult.success) passed++;

  total++;
  console.log(`\n📄 Đang kiểm tra: \x1b[34mmin_click_interval_blocks_click_not_detection\x1b[0m`);
  const minClickIntervalResult = await verifyMinClickIntervalBlocksClickNotDetection();
  if (minClickIntervalResult.success) passed++;

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
          const decision = b.decision === 'wouldClick' ? '\x1b[32mWOULD_CLICK\x1b[0m' : `\x1b[31mSKIP\x1b[0m ${b.reason || ''}`;
          const clickMark = b.clickedFlag ? ' [CLICKED ✅]' : '';
          console.log(`         🔄 Btn: \x1b[32m${b.text}\x1b[0m | ${decision}${clickMark} | Cạnh đó: \x1b[2m${b.context || 'N/A'}\x1b[0m`);
        });
      }
      
      if (c.buttons.accept.length > 0) {
        c.buttons.accept.forEach(b => {
          const decision = b.decision === 'wouldClick' ? '\x1b[32mWOULD_CLICK\x1b[0m' : `\x1b[31mSKIP\x1b[0m ${b.reason || ''}`;
          const clickMark = b.clickedFlag ? ' [CLICKED ✅]' : '';
          console.log(`         ⚡ Btn: \x1b[36m${b.text}\x1b[0m | ${decision}${clickMark} | Cạnh đó: \x1b[2m${b.context || 'N/A'}\x1b[0m`);
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

async function verifyStaleReplacementScenario() {
  const html = `
    <html>
      <body>
        <div class="antigravity-agent-side-panel">
          <div class="bg-agent-convo-background">
            <div>Agent terminated due to error. Try again.</div>
            <footer>
              <button id="retry-btn">Retry</button>
            </footer>
          </div>
        </div>
      </body>
    </html>
  `;

  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    url: "http://localhost/workbench.html"
  });

  const { window } = dom;
  window.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  window.innerWidth = 1440;
  window.innerHeight = 900;

  const card = window.document.querySelector('.bg-agent-convo-background');
  let activeButton = window.document.getElementById('retry-btn');

  window.HTMLElement.prototype.click = function() {
    this.__clicked = true;
    this.setAttribute('data-clicked', 'true');
  };

  window.Element.prototype.getBoundingClientRect = function() {
    if (this === card) {
      return { left: 992, top: 610, width: 440, height: 149, right: 1432, bottom: 759, x: 992, y: 610 };
    }
    if ((this.textContent || '').trim() === 'Retry') {
      return { left: 1375, top: 724, width: 48, height: 26, right: 1423, bottom: 750, x: 1375, y: 724 };
    }
    return { left: 0, top: 0, width: 10, height: 10, right: 10, bottom: 10, x: 0, y: 0 };
  };

  window.document.elementFromPoint = function(x, y) {
    const rect = activeButton.getBoundingClientRect();
    const withinButton = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    return withinButton ? activeButton : window.document.body;
  };

  try {
    const scriptText = getInjectionScript({ autoRetry: true, autoAccept: false, pollInterval: 1000 });
    window.eval(scriptText);

    setTimeout(() => {
      const replacement = activeButton.cloneNode(true);
      replacement.removeAttribute('data-clicked');
      activeButton.replaceWith(replacement);
      activeButton = replacement;
    }, 200);

    await new Promise(resolve => setTimeout(resolve, 2500));

    if (activeButton.getAttribute('data-clicked') === 'true') {
      console.log(`   ✅ \x1b[32mPASS\x1b[0m: Button thay thế vẫn được click sau khi rerender.`);
      return { success: true };
    }

    console.log(`   ❌ \x1b[31mFAIL\x1b[0m: Button thay thế không được click.`);
    return { success: false };
  } catch (e) {
    console.error('   ❌ Error in stale replacement scenario:', e.message);
    return { success: false };
  } finally {
    window.close();
  }
}

async function verifyFilenameRetryFalsePositive() {
  const html = `
    <html>
      <body>
        <div class="antigravity-agent-side-panel">
          <div role="menu">
            <div role="menuitem" class="cursor-pointer">src/core/auto-retry.js</div>
          </div>
        </div>
      </body>
    </html>
  `;

  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    url: "http://localhost/workbench.html"
  });

  const { window } = dom;
  window.innerWidth = 1440;
  window.innerHeight = 900;

  let clickCount = 0;
  window.HTMLElement.prototype.click = function() {
    clickCount++;
    this.__clicked = true;
  };

  window.Element.prototype.getBoundingClientRect = function() {
    return { left: 1050, top: 100, width: 240, height: 30, right: 1290, bottom: 130, x: 1050, y: 100 };
  };
  window.document.elementFromPoint = function() {
    return window.document.querySelector('[role="menuitem"]');
  };

  try {
    const scriptText = getInjectionScript({ autoRetry: true, autoAccept: false, pollInterval: 1000 });
    window.eval(scriptText);
    const analysis = window.__analyzeDialog();

    await new Promise(resolve => setTimeout(resolve, 1500));

    if (clickCount === 0 && !analysis.wouldClick) {
      console.log(`   ✅ \x1b[32mPASS\x1b[0m: Tên file/menu chứa "retry" không bị click.`);
      return { success: true };
    }

    console.log(`   ❌ \x1b[31mFAIL\x1b[0m: False positive vẫn có thể click. clickCount=${clickCount}, wouldClick=${analysis.wouldClick}`);
    return { success: false };
  } catch (e) {
    console.error('   ❌ Error in filename false-positive scenario:', e.message);
    return { success: false };
  } finally {
    window.close();
  }
}

async function verifyHistoryTitleRetryFalsePositive() {
  const html = `
    <html>
      <body>
        <div class="antigravity-agent-side-panel">
          <div class="history-list">
            <button id="history-btn" title="Analyzing Retry Statistics Discrepancy" class="group cursor-pointer">
              <span>Analyzing Retry Statistics Discrepancy</span>
              <span>38m</span>
              <span>delete</span>
            </button>
          </div>
          <div class="bg-agent-convo-background">
            <div>Agent terminated due to error. Try again.</div>
            <footer><button id="retry-btn">Retry</button></footer>
          </div>
        </div>
      </body>
    </html>
  `;

  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    url: "http://localhost/workbench.html"
  });

  const { window } = dom;
  window.innerWidth = 1440;
  window.innerHeight = 900;

  const historyButton = window.document.getElementById('history-btn');
  const retryButton = window.document.getElementById('retry-btn');
  let historyClickCount = 0;
  let retryClickCount = 0;

  window.HTMLElement.prototype.click = function() {
    this.__clicked = true;
    if (this === historyButton) historyClickCount++;
    if (this === retryButton) retryClickCount++;
  };

  window.Element.prototype.getBoundingClientRect = function() {
    if (this === historyButton) {
      return { left: 988, top: 811, width: 435, height: 26, right: 1423, bottom: 837, x: 988, y: 811 };
    }
    if (this === retryButton) {
      return { left: 1350, top: 700, width: 70, height: 30, right: 1420, bottom: 730, x: 1350, y: 700 };
    }
    if (this.classList && this.classList.contains('bg-agent-convo-background')) {
      return { left: 990, top: 610, width: 440, height: 150, right: 1430, bottom: 760, x: 990, y: 610 };
    }
    return { left: 980, top: 560, width: 460, height: 280, right: 1440, bottom: 840, x: 980, y: 560 };
  };

  window.document.elementFromPoint = function(x, y) {
    const retryRect = retryButton.getBoundingClientRect();
    const historyRect = historyButton.getBoundingClientRect();
    const inRetry = x >= retryRect.left && x <= retryRect.right && y >= retryRect.top && y <= retryRect.bottom;
    if (inRetry) return retryButton;
    const inHistory = x >= historyRect.left && x <= historyRect.right && y >= historyRect.top && y <= historyRect.bottom;
    if (inHistory) return historyButton;
    return window.document.body;
  };

  try {
    const scriptText = getInjectionScript({ autoRetry: true, autoAccept: false, pollInterval: 1000, clickDelay: 100 });
    window.eval(scriptText);
    const analysis = window.__analyzeDialog();

    await new Promise(resolve => setTimeout(resolve, 1500));

    const historyCandidate = analysis.containers
      .flatMap(container => container.buttons.retry || [])
      .find(button => button.text.includes('Analyzing Retry Statistics Discrepancy'));

    if (retryClickCount === 1 && historyClickCount === 0 && (!historyCandidate || historyCandidate.decision !== 'wouldClick')) {
      console.log(`   ✅ \x1b[32mPASS\x1b[0m: History item chứa chữ "Retry" không bị click nhầm; nút dialog thật vẫn được click.`);
      return { success: true };
    }

    console.log(`   ❌ \x1b[31mFAIL\x1b[0m: Vẫn có false positive từ history item. retryClickCount=${retryClickCount}, historyClickCount=${historyClickCount}, historyDecision=${historyCandidate && historyCandidate.decision}`);
    return { success: false };
  } catch (e) {
    console.error('   ❌ Error in history-title false-positive scenario:', e.message);
    return { success: false };
  } finally {
    window.close();
  }
}

async function verifyCleanupCancelsPendingClick() {
  const html = `
    <html>
      <body>
        <div class="antigravity-agent-side-panel">
          <div class="bg-agent-convo-background">
            <div>Agent terminated due to error. Try again.</div>
            <footer><button id="retry-btn">Retry</button></footer>
          </div>
        </div>
      </body>
    </html>
  `;

  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    url: "http://localhost/workbench.html"
  });

  const { window } = dom;
  window.innerWidth = 1440;
  window.innerHeight = 900;

  const button = window.document.getElementById('retry-btn');
  let clickCount = 0;
  window.HTMLElement.prototype.click = function() {
    clickCount++;
    this.__clicked = true;
  };

  window.Element.prototype.getBoundingClientRect = function() {
    if (this === button) {
      return { left: 1350, top: 700, width: 70, height: 30, right: 1420, bottom: 730, x: 1350, y: 700 };
    }
    return { left: 1000, top: 600, width: 430, height: 160, right: 1430, bottom: 760, x: 1000, y: 600 };
  };
  window.document.elementFromPoint = function() {
    return button;
  };

  try {
    const scriptText = getInjectionScript({ autoRetry: true, autoAccept: false, pollInterval: 1000 });
    window.eval(scriptText);
    window.__autoRetryCleanup();

    await new Promise(resolve => setTimeout(resolve, 1500));

    if (clickCount === 0 && window.__autoRetryDisabled === true) {
      console.log(`   ✅ \x1b[32mPASS\x1b[0m: Cleanup hủy click timeout đang chờ.`);
      return { success: true };
    }

    console.log(`   ❌ \x1b[31mFAIL\x1b[0m: Cleanup không hủy pending click. clickCount=${clickCount}`);
    return { success: false };
  } catch (e) {
    console.error('   ❌ Error in cleanup pending-click scenario:', e.message);
    return { success: false };
  } finally {
    window.close();
  }
}

async function verifyEphemeralDialogIgnoredBetweenPolls() {
  const html = `
    <html>
      <body>
        <div class="antigravity-agent-side-panel"></div>
      </body>
    </html>
  `;

  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    url: "http://localhost/workbench.html"
  });

  const { window } = dom;
  window.innerWidth = 1440;
  window.innerHeight = 900;

  let clickCount = 0;
  window.HTMLElement.prototype.click = function() {
    clickCount++;
    this.__clicked = true;
  };

  window.Element.prototype.getBoundingClientRect = function() {
    if ((this.textContent || '').trim() === 'Retry') {
      return { left: 1350, top: 700, width: 70, height: 30, right: 1420, bottom: 730, x: 1350, y: 700 };
    }
    return { left: 1000, top: 600, width: 430, height: 160, right: 1430, bottom: 760, x: 1000, y: 600 };
  };
  window.document.elementFromPoint = function() {
    return window.document.querySelector('button') || window.document.body;
  };

  try {
    const scriptText = getInjectionScript({ autoRetry: true, autoAccept: false, pollInterval: 1000, clickDelay: 100 });
    window.eval(scriptText);

    setTimeout(() => {
      const dialog = window.document.createElement('div');
      dialog.className = 'bg-agent-convo-background';
      dialog.innerHTML = '<div>Agent terminated due to error. Try again.</div><footer><button>Retry</button></footer>';
      window.document.body.appendChild(dialog);

      setTimeout(() => {
        dialog.remove();
      }, 300);
    }, 50);

    await new Promise(resolve => setTimeout(resolve, 1500));
    const analysis = window.__analyzeDialog();

    if (clickCount === 0 && analysis.wouldClick === false) {
      console.log(`   ✅ \x1b[32mPASS\x1b[0m: Dialog ngắn hạn biến mất giữa hai kỳ poll được bỏ qua theo thiết kế.`);
      return { success: true };
    }

    console.log(`   ❌ \x1b[31mFAIL\x1b[0m: Dialog ngắn hạn vẫn bị xử lý ngoài expected polling behavior. clickCount=${clickCount}, wouldClick=${analysis.wouldClick}`);
    return { success: false };
  } catch (e) {
    console.error('   ❌ Error in ephemeral dialog scenario:', e.message);
    return { success: false };
  } finally {
    window.close();
  }
}

async function verifyMinClickIntervalBlocksClickNotDetection() {
  const html = `
    <html>
      <body>
        <div class="antigravity-agent-side-panel">
          <div class="bg-agent-convo-background">
            <div>Agent terminated due to error. Try again.</div>
            <footer><button id="retry-btn">Retry</button></footer>
          </div>
        </div>
      </body>
    </html>
  `;

  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    url: "http://localhost/workbench.html"
  });

  const { window } = dom;
  window.innerWidth = 1440;
  window.innerHeight = 900;

  const button = window.document.getElementById('retry-btn');
  let clickCount = 0;
  window.HTMLElement.prototype.click = function() {
    clickCount++;
    this.__clicked = true;
  };

  window.Element.prototype.getBoundingClientRect = function() {
    if (this === button) {
      return { left: 1350, top: 700, width: 70, height: 30, right: 1420, bottom: 730, x: 1350, y: 700 };
    }
    return { left: 1000, top: 600, width: 430, height: 160, right: 1430, bottom: 760, x: 1000, y: 600 };
  };
  window.document.elementFromPoint = function() {
    return button;
  };

  try {
    const scriptText = getInjectionScript({
      autoRetry: true,
      autoAccept: false,
      pollInterval: 1000,
      clickDelay: 100,
      minClickInterval: 5000
    });
    window.eval(scriptText);

    await new Promise(resolve => setTimeout(resolve, 1200));
    const firstClickCount = clickCount;
    const analysis = window.__analyzeDialog();

    await new Promise(resolve => setTimeout(resolve, 1200));

    if (firstClickCount === 1 && clickCount === 1 && analysis.wouldClick === true && analysis.clickGate.reason === 'minClickInterval') {
      console.log(`   ✅ \x1b[32mPASS\x1b[0m: minClickInterval chặn click lặp nhưng dry-run vẫn detect được action.`);
      return { success: true };
    }

    console.log(`   ❌ \x1b[31mFAIL\x1b[0m: minClickInterval không giữ đúng semantics detect-vs-click. firstClickCount=${firstClickCount}, clickCount=${clickCount}, wouldClick=${analysis.wouldClick}, gate=${analysis.clickGate && analysis.clickGate.reason}`);
    return { success: false };
  } catch (e) {
    console.error('   ❌ Error in minClickInterval scenario:', e.message);
    return { success: false };
  } finally {
    window.close();
  }
}

runRegressionTests();
