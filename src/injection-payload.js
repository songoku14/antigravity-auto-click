/**
 * injection-payload.js - JavaScript code to inject into Antigravity's DOM
 * 
 * This script runs INSIDE the Electron renderer process.
 * It uses MutationObserver to watch for error dialogs and auto-click Retry.
 * 
 * IMPORTANT: Only targets dialog/notification containers, NOT editor content.
 */

const INJECTION_VERSION = 6;

/**
 * Trả về string JavaScript sẽ được inject vào DOM qua CDP Runtime.evaluate
 */
function getInjectionScript() {
  return `
(function() {
  const SCRIPT_VERSION = ${INJECTION_VERSION};
  
  // Kill old versions
  if (window.__autoRetryVersion && window.__autoRetryVersion < SCRIPT_VERSION) {
    // Stop old observer and intervals
    if (window.__autoRetryCleanup) {
      window.__autoRetryCleanup();
    }
    console.log('[AutoRetry] Upgrading from v' + window.__autoRetryVersion + ' to v' + SCRIPT_VERSION);
    window.__autoRetryInjected = false;
  }
  
  // Prevent double injection of same version
  if (window.__autoRetryInjected && window.__autoRetryVersion === SCRIPT_VERSION) {
    console.log('[AutoRetry] v' + SCRIPT_VERSION + ' already running, skipping.');
    return 'already_injected';
  }
  
  window.__autoRetryInjected = true;
  window.__autoRetryVersion = SCRIPT_VERSION;

  const CONFIG = {
    // === DIALOG/NOTIFICATION CONTAINER SELECTORS ===
    // ONLY look inside these - never the editor content area
    dialogContainerSelectors: [
      '.monaco-dialog-box',
      '.dialog-shadow',
      '.notifications-toasts',
      '.notification-toast-container',
      '.notification-list-item',
      '.notification-toast',
      '.notifications-center',
      // Antigravity agent specific
      '.jetski-error',
      '.error-overlay',
      // Generic modal overlays
      '[role="dialog"]',
      '[role="alertdialog"]'
    ],

    // Error text patterns - checked WITHIN dialog containers only
    errorPatterns: [
      /high\\s*traffic/i,
      /server\\s*(is\\s*)?busy/i,
      /too\\s*many\\s*requests/i,
      /rate\\s*limit(ed)?/i,
      /overloaded/i,
      /temporarily\\s*unavailable/i,
      /service\\s*unavailable/i,
      /request\\s*failed/i,
      /something\\s*went\\s*wrong/i,
      /an?\\s*error\\s*occur/i,
      /please\\s*try\\s*again\\s*later/i,
      /agent\\s*terminated/i,
      /try\\s*again/i
    ],

    // Button text patterns - STRICT match on trimmed text only
    retryButtonPatterns: [
      /^retry$/i,
      /^try again$/i,
      /^thử lại$/i,
      /^reconnect$/i
    ],

    pollInterval: 3000,
    clickDelay: 800,
    maxRetriesPerMinute: 10,
    cooldownMs: 120000,
    minClickInterval: 3000
  };

  let retryCount = 0;
  let lastResetTime = Date.now();
  let lastClickTime = 0;
  let isInCooldown = false;
  let observerRef = null;
  let pollIntervalRef = null;

  function log(msg) {
    console.log('[AutoRetry] ' + msg);
  }

  function resetCounterIfNeeded() {
    const now = Date.now();
    if (now - lastResetTime > 60000) {
      retryCount = 0;
      lastResetTime = now;
      isInCooldown = false;
    }
  }

  function canRetry() {
    resetCounterIfNeeded();
    if (isInCooldown) return false;
    if (Date.now() - lastClickTime < CONFIG.minClickInterval) return false;
    if (retryCount >= CONFIG.maxRetriesPerMinute) {
      isInCooldown = true;
      log('Rate limit reached. Cooling down for ' + (CONFIG.cooldownMs/1000) + 's');
      setTimeout(() => {
        isInCooldown = false;
        retryCount = 0;
        lastResetTime = Date.now();
        log('Cooldown ended.');
      }, CONFIG.cooldownMs);
      return false;
    }
    return true;
  }

  /**
   * Find visible dialog/notification containers.
   * This is the KEY safety filter - never scans editor content.
   */
  function findDialogContainers() {
    const containers = [];
    for (const selector of CONFIG.dialogContainerSelectors) {
      try {
        document.querySelectorAll(selector).forEach(el => {
          // Must be visible (has dimensions)
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            containers.push(el);
          }
        });
      } catch(e) {}
    }
    return containers;
  }

  /**
   * Check if a container has error-related text
   */
  function containerHasError(container) {
    const text = (container.textContent || '');
    for (const pattern of CONFIG.errorPatterns) {
      if (pattern.test(text)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Find retry buttons WITHIN a specific container.
   * Uses STRICT text matching to avoid false positives.
   */
  function findRetryButtonsIn(container) {
    const buttons = [];
    const clickableSelectors = 'button, [role="button"], .monaco-button, .action-label, .dialog-button';
    
    container.querySelectorAll(clickableSelectors).forEach(el => {
      // Get the DIRECT text of this element, trimmed
      const text = (el.textContent || '').trim();
      
      // Skip if text is too long (likely not a button label)
      if (text.length > 30) return;
      
      for (const pattern of CONFIG.retryButtonPatterns) {
        if (pattern.test(text)) {
          buttons.push({ el, text });
          break;
        }
      }
    });
    return buttons;
  }

  /**
   * Main scan: find error dialog containers, then find retry buttons inside them
   */
  function scanAndRetry() {
    if (!canRetry()) return;

    const containers = findDialogContainers();
    if (containers.length === 0) return;

    for (const container of containers) {
      if (!containerHasError(container)) continue;
      
      const retryButtons = findRetryButtonsIn(container);
      if (retryButtons.length === 0) continue;

      // Found an error dialog with a retry button!
      retryCount++;
      lastClickTime = Date.now();
      const { el: btn, text: btnText } = retryButtons[0];

      const isTest = !!container.__isTestDialog;
      log((isTest ? '🧪' : '🔄') + ' ' + (isTest ? 'TEST' : 'Error') + ' dialog detected! Clicking "' + btnText + '" (retry #' + retryCount + ')');

      setTimeout(() => {
        try {
          btn.click();
          log('✅ Clicked "' + btnText + '" successfully.');
        } catch (e) {
          try {
            btn.dispatchEvent(new MouseEvent('click', {
              bubbles: true, cancelable: true, view: window
            }));
            log('✅ Clicked via dispatchEvent.');
          } catch (e2) {
            log('❌ Click failed: ' + e2.message);
          }
        }
      }, CONFIG.clickDelay);

      return; // One click per scan cycle
    }
  }

  // === MutationObserver ===
  observerRef = new MutationObserver((mutations) => {
    const hasNewNodes = mutations.some(m => m.addedNodes.length > 0);
    if (hasNewNodes) {
      setTimeout(scanAndRetry, 500);
    }
  });

  observerRef.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true,
    attributes: false,
    characterData: false
  });

  // === Backup polling ===
  pollIntervalRef = setInterval(scanAndRetry, CONFIG.pollInterval);

  // === Test Mode Helper ===
  window.__triggerAutoRetryTest = function() {
    log('🧪 Triggering REALISTIC test dialog...');
    const testDiv = document.createElement('div');
    testDiv.className = 'monaco-dialog-box test-auto-retry-dialog';
    testDiv.style.cssText = 'position:fixed;top:20%;left:50%;transform:translateX(-50%);background:#252526;color:#ccc;padding:25px;border:1px solid #444;z-index:99999;box-shadow:0 5px 25px rgba(0,0,0,0.6);border-radius:6px;text-align:left;min-width:400px;max-width:500px;font-family:sans-serif;';
    
    const title = document.createElement('div');
    title.style.cssText = 'margin-bottom:15px;font-weight:bold;color:#f14c4c;font-size:16px;';
    title.textContent = 'Agent terminated due to error';
    
    const body = document.createElement('div');
    body.style.cssText = 'margin-bottom:20px;line-height:1.5;font-size:13px;';
    body.textContent = 'You can prompt the model to try again or start a new conversation if the error persists. See our documentation for more help.';
    
    const btnContainer = document.createElement('div');
    btnContainer.style.cssText = 'display:flex;justify-content:flex-end;gap:10px;';
    
    const createBtn = (text, isPrimary) => {
      const b = document.createElement('button');
      b.className = 'monaco-button';
      b.textContent = text;
      b.style.cssText = isPrimary 
        ? 'background:#0e639c;color:white;border:none;padding:6px 14px;cursor:pointer;border-radius:2px;font-size:12px;'
        : 'background:#3a3d41;color:white;border:none;padding:6px 14px;cursor:pointer;border-radius:2px;font-size:12px;';
      b.onclick = () => {
        log('🖱️ User/Script clicked: "' + text + '"');
        testDiv.remove();
      };
      return b;
    };
    
    const btn1 = createBtn('New Conversation', false);
    const btn2 = createBtn('Try Again', true);
    const btn3 = createBtn('Dismiss', false);
    
    btnContainer.appendChild(btn1);
    btnContainer.appendChild(btn2);
    btnContainer.appendChild(btn3);
    
    testDiv.appendChild(title);
    testDiv.appendChild(body);
    testDiv.appendChild(btnContainer);
    
    document.body.appendChild(testDiv);
    
    // Add internal flag for the script to recognize this as a test
    testDiv.__isTestDialog = true;
    
    // Cleanup if not clicked (safety)
    setTimeout(() => {
      if (testDiv.parentElement) {
        log('Test dialog timed out and was removed.');
        testDiv.remove();
      }
    }, 15000);
    
    return 'test_dialog_triggered';
  };

  // === Cleanup function for version upgrades ===
  window.__autoRetryCleanup = function() {
    if (observerRef) { observerRef.disconnect(); observerRef = null; }
    if (pollIntervalRef) { clearInterval(pollIntervalRef); pollIntervalRef = null; }
    log('Old version cleaned up.');
  };

  // === Initial scan after delay ===
  setTimeout(scanAndRetry, 2000);

  log('v' + SCRIPT_VERSION + ' injected. Watching dialogs only (no editor scanning).');
  log('Dialog selectors: ' + CONFIG.dialogContainerSelectors.length);
  log('Error patterns: ' + CONFIG.errorPatterns.length);
  
  return 'injection_success';
})();
`;
}

module.exports = { getInjectionScript };
