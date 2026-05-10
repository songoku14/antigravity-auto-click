/**
 * injection-payload.js - JavaScript code to inject into Antigravity's DOM
 * 
 * This script runs INSIDE the Electron renderer process.
 * It uses MutationObserver to watch for error dialogs and auto-click Retry/Accept.
 */

const INJECTION_VERSION = 17;

/**
 * Trả về string JavaScript sẽ được inject vào DOM qua CDP Runtime.evaluate
 */
function getInjectionScript(userConfig = {}) {
  const configJson = JSON.stringify(userConfig);
  
  return `
(function() {
  const SCRIPT_VERSION = ${INJECTION_VERSION};
  const USER_CONFIG = ${configJson};
  
  // Kill old versions
  if (window.__autoRetryVersion && window.__autoRetryVersion < SCRIPT_VERSION) {
    if (window.__autoRetryCleanup) {
      window.__autoRetryCleanup();
    }
    console.log('[AutoRetry] Upgrading from v' + window.__autoRetryVersion + ' to v' + SCRIPT_VERSION);
    window.__autoRetryInjected = false;
  }
  
  if (window.__autoRetryInjected && window.__autoRetryVersion === SCRIPT_VERSION) {
    return 'already_injected';
  }
  
  window.__autoRetryInjected = true;
  window.__autoRetryVersion = SCRIPT_VERSION;

  const CONFIG = {
    dialogContainerSelectors: [
      '.monaco-dialog-box',
      '.dialog-shadow',
      '.notifications-toasts',
      '.notification-toast-container',
      '.notification-list-item',
      '.notification-toast',
      '.notifications-center',
      '.jetski-error',
      '.error-overlay',
      '.monaco-dialog-box',
      '[role="dialog"]',
      '[role="alertdialog"]',
      '.test-accept-dialog'
    ],

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
      /agent\\s*terminated/i,
      /try\\s*again/i
    ],

    retryButtonPatterns: [
      /^retry$/i,
      /^try again$/i,
      /^thử lại$/i,
      /^reconnect$/i
    ],

    actionButtonPatterns: [
      /^accept$/i,
      /^run$/i,
      /^execute$/i,
      /^allow$/i,
      /^join$/i,
      /^yes$/i,
      /^approve$/i,
      /^continue$/i,
      /^always allow$/i
    ],

    blacklist: USER_CONFIG.blacklist || [
      "rm ", "sudo ", "force ", "push ", "delete ", "terminate ", "pkill ", "kill ", "mkfs"
    ],

    pollInterval: 3000,
    clickDelay: 800,
    maxRetriesPerMinute: 15,
    cooldownMs: 60000,
    minClickInterval: 2000
  };

  let actionCount = 0;
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
      actionCount = 0;
      lastResetTime = now;
      isInCooldown = false;
    }
  }

  function canClick() {
    resetCounterIfNeeded();
    if (isInCooldown) return false;
    if (Date.now() - lastClickTime < CONFIG.minClickInterval) return false;
    if (actionCount >= CONFIG.maxRetriesPerMinute) {
      isInCooldown = true;
      log('Rate limit reached. Cooling down.');
      setTimeout(() => { isInCooldown = false; actionCount = 0; }, CONFIG.cooldownMs);
      return false;
    }
    return true;
  }

  function findInShadows(root, selector) {
    let elements = Array.from(root.querySelectorAll(selector));
    if (elements.length > 0) {
      if (selector.includes('test') || selector.includes('dialog')) {
        log('Selector "' + selector + '" matched ' + elements.length + ' elements');
      }
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node;
    while (node = walker.nextNode()) {
      if (node.shadowRoot) {
        elements = elements.concat(findInShadows(node.shadowRoot, selector));
      }
    }
    return elements;
  }

  function findValidContainers() {
    const containers = new Set();
    for (const selector of CONFIG.dialogContainerSelectors) {
      try {
        const found = findInShadows(document, selector);
        found.forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.width > 5 && rect.height > 5) {
            log('Valid container found: ' + el.tagName + '.' + Array.from(el.classList).join('.'));
            containers.add(el);
          }
        });
      } catch(e) {}
    }
    return Array.from(containers);
  }

  function extractCommandText(btn) {
    try {
      let el = btn;
      for (let i = 0; i < 12 && el && el !== document.body; i++) {
        el = el.parentElement;
        if (!el) break;
        const codes = el.querySelectorAll('pre, code, .monaco-editor-background, .command-text');
        if (codes.length > 0) {
          let allText = '';
          codes.forEach(c => allText += ' ' + (c.textContent || '').trim());
          return allText.trim();
        }
      }
    } catch (e) {}
    return null;
  }

  function isCommandBlocked(cmdText) {
    if (!cmdText) return false;
    const lowerCmd = cmdText.toLowerCase();
    return CONFIG.blacklist.some(pattern => lowerCmd.includes(pattern.toLowerCase()));
  }

  function findButtonsIn(container, patterns, typeLabel) {
    const buttons = [];
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT);
    let el;
    while (el = walker.nextNode()) {
      const tag = el.tagName.toLowerCase();
      const isClickable = tag === 'button' || 
                          el.getAttribute('role') === 'button' || 
                          el.classList.contains('monaco-button') || 
                          el.classList.contains('action-label') ||
                          el.classList.contains('button') ||
                          el.classList.contains('btn');
      
      if (isClickable) {
        const text = (el.textContent || '').trim();
        // log('Checking button: "' + text + '" (' + tag + ')');
        if (text.length > 50) continue;
        
        for (const pattern of patterns) {
          if (pattern.test(text)) {
            log('Found matching button: "' + text + '" with pattern ' + pattern);
            buttons.push({ el, text });
            break;
          }
        }
      }
    }
    return buttons;
  }

  function scanAndAction() {
    if (!canClick()) return;

    let containers = findValidContainers();
    const useFallback = containers.length === 0 && USER_CONFIG.autoAccept !== false;
    
    if (useFallback) {
      containers = [document.body];
    }

    for (const container of containers) {
      const containerText = (container.textContent || '').substring(0, 2000); // Limit scan for performance
      
      // Case 1: Error/Retry
      if (USER_CONFIG.autoRetry !== false && CONFIG.errorPatterns.some(p => p.test(containerText))) {
        const btns = findButtonsIn(container, CONFIG.retryButtonPatterns, 'RETRY');
        if (btns.length > 0) {
          performClick(btns[0].el, btns[0].text, '🔄 RETRY');
          return;
        }
      }

      // Case 2: Action/Accept
      if (USER_CONFIG.autoAccept !== false) {
        const btns = findButtonsIn(container, CONFIG.actionButtonPatterns, 'ACTION');
        if (btns.length > 0) {
          const btn = btns[0].el;
          const btnText = btns[0].text;

          // Safety check for Terminal commands
          const cmdText = extractCommandText(btn);
          if (isCommandBlocked(cmdText)) {
            if (!btn.__blockedByFilter) {
              btn.__blockedByFilter = true;
              log('🚫 Blocked dangerous command: ' + (cmdText ? cmdText.substring(0, 50) : 'none') + '...');
              btn.style.cssText += ';border: 2px solid red !important; box-shadow: 0 0 10px red !important;';
              const oldText = btn.textContent;
              btn.textContent = '🚫 Blocked';
              setTimeout(() => { btn.textContent = oldText; btn.__blockedByFilter = false; }, 5000);
            }
            continue;
          }

          performClick(btn, btnText, '⚡ ACTION');
          return;
        }
      }
    }
  }

  function performClick(btn, btnText, typeLabel) {
    if (btn.__beingClicked) return;
    btn.__beingClicked = true;

    actionCount++;
    lastClickTime = Date.now();
    log(typeLabel + ' detected! Clicking "' + btnText + '"');

    // Visual feedback
    const oldStyle = btn.style.cssText;
    btn.style.cssText += '; outline: 3px solid #3794ff !important; outline-offset: 2px !important;';

    setTimeout(() => {
      try {
        btn.click();
        log('✅ Clicked successfully.');
      } catch (e) {
        log('⚠️ Direct click failed, trying MouseEvent...');
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      }
      btn.__beingClicked = false;
      setTimeout(() => { btn.style.cssText = oldStyle; }, 1000);
    }, CONFIG.clickDelay);
  }

  // === Initialization ===
  observerRef = new MutationObserver((mutations) => {
    let shouldScan = false;
    for (const m of mutations) {
      if (m.addedNodes.length > 0) {
        shouldScan = true;
        break;
      }
    }
    if (shouldScan) {
      setTimeout(scanAndAction, 400);
    }
  });

  observerRef.observe(document.documentElement, { childList: true, subtree: true });

  window.__triggerAutoRetryTest = function() {
    log('Simulating High Traffic dialog...');
    const container = document.createElement('div');
    container.className = 'monaco-dialog-box test-dialog';
    container.style.cssText = 'position:fixed;top:40%;left:50%;transform:translateX(-50%);background:#252526;color:#ccc;padding:20px;border:1px solid #3794ff;z-index:99999;box-shadow:0 5px 25px rgba(0,0,0,0.8);border-radius:6px;width:400px;font-family:sans-serif;';
    
    const title = document.createElement('div');
    title.style.cssText = 'margin-bottom:10px;font-weight:bold;color:#3794ff;';
    title.textContent = '[TEST] High Traffic Simulation';
    
    const body = document.createElement('div');
    body.style.cssText = 'margin-bottom:15px;font-size:13px;';
    body.textContent = 'This is a simulated high traffic dialog to test the Auto-Retry feature.';
    
    const btnContainer = document.createElement('div');
    btnContainer.style.cssText = 'display:flex;justify-content:flex-end;';
    
    const btn = document.createElement('button');
    btn.className = 'monaco-button';
    btn.textContent = 'Retry';
    btn.style.cssText = 'background:#0e639c;color:white;border:none;padding:4px 12px;cursor:pointer;border-radius:2px;';
    
    btn.onclick = () => {
      container.remove();
      log('Test dialog removed via click.');
    };

    btnContainer.appendChild(btn);
    container.appendChild(title);
    container.appendChild(body);
    container.appendChild(btnContainer);
    document.body.appendChild(container);
    
    setTimeout(() => {
      if (container.parentElement) {
        container.remove();
        log('Test dialog timed out and was removed.');
      }
    }, 12000);

    return 'test_dialog_triggered';
  };

  pollIntervalRef = setInterval(scanAndAction, CONFIG.pollInterval);

  window.__autoRetryCleanup = function() {
    if (observerRef) observerRef.disconnect();
    if (pollIntervalRef) clearInterval(pollIntervalRef);
    log('Cleaned up.');
  };

  setTimeout(scanAndAction, 1000);
  log('v' + SCRIPT_VERSION + ' active. Retry: ' + (USER_CONFIG.autoRetry !== false ? 'ON' : 'OFF') + ', Accept: ' + (USER_CONFIG.autoAccept !== false ? 'ON' : 'OFF'));
  return 'injection_success';
})();
`;
}


module.exports = { getInjectionScript };
