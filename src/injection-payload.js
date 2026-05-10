/**
 * injection-payload.js - JavaScript code to inject into Antigravity's DOM
 * 
 * This script runs INSIDE the Electron renderer process.
 * It uses MutationObserver to watch for error dialogs and auto-click Retry/Accept.
 */

const INJECTION_VERSION = 8;

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
    console.log('[AutoRetry] v' + SCRIPT_VERSION + ' already running.');
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
      '.monaco-workbench', // Broad scan for inline buttons
      '[role="dialog"]',
      '[role="alertdialog"]'
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
  const clickCooldowns = new Map(); // Store individual button cooldowns

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

  /**
   * Shadow DOM aware element finder
   */
  function findInShadows(root, selector) {
    let elements = Array.from(root.querySelectorAll(selector));
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node;
    while (node = walker.nextNode()) {
      if (node.shadowRoot) {
        elements = elements.concat(findInShadows(node.shadowRoot, selector));
      }
    }
    return elements;
  }

  /**
   * Find container having specific text patterns
   */
  function findValidContainers() {
    const containers = [];
    for (const selector of CONFIG.dialogContainerSelectors) {
      try {
        const found = findInShadows(document, selector);
        if (found.length > 0) {
          // debug log
          // console.log('[AutoRetry] Found ' + found.length + ' elements for selector: ' + selector);
        }
        found.forEach(el => {
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
   * Extract command text from vicinity of button
   */
  function extractCommandText(btn) {
    try {
      let el = btn;
      // Search up to 10 parent levels for code/pre blocks
      for (let i = 0; i < 10 && el && el !== document.body; i++) {
        el = el.parentElement;
        if (!el) break;
        const codes = el.querySelectorAll('pre, code, .monaco-editor-background');
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

  function findButtonsIn(container, patterns) {
    const buttons = [];
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT);
    let el;
    while (el = walker.nextNode()) {
      const tag = el.tagName.toLowerCase();
      const isClickable = tag === 'button' || el.getAttribute('role') === 'button' || 
                          el.classList.contains('monaco-button') || el.classList.contains('action-label');
      
      if (isClickable) {
        const text = (el.textContent || '').trim();
        if (text.length > 40) continue;
        
        for (const pattern of patterns) {
          if (pattern.test(text)) {
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

    const containers = findValidContainers();
    if (containers.length === 0) return;

    for (const container of containers) {
      const containerText = container.textContent || '';
      
      // Case 1: Error/Retry (Only if autoRetry is enabled)
      if (USER_CONFIG.autoRetry !== false && CONFIG.errorPatterns.some(p => p.test(containerText))) {
        const btns = findButtonsIn(container, CONFIG.retryButtonPatterns);
        if (btns.length > 0) {
          performClick(btns[0].el, btns[0].text, '🔄 RETRY');
          return;
        }
      }

      // Case 2: Action/Accept (Only if autoAccept is enabled)
      if (USER_CONFIG.autoAccept !== false) {
        const btns = findButtonsIn(container, CONFIG.actionButtonPatterns);
        if (btns.length > 0) {
          const btn = btns[0].el;
          const btnText = btns[0].text;

          // Safety check for Terminal commands
          const cmdText = extractCommandText(btn);
          if (isCommandBlocked(cmdText)) {
            if (!btn.__blockedByFilter) {
              btn.__blockedByFilter = true;
              log('🚫 Blocked dangerous command: ' + cmdText.substring(0, 50) + '...');
              btn.style.cssText += ';border: 2px solid red !important; opacity: 0.7;';
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
    actionCount++;
    lastClickTime = Date.now();
    log(typeLabel + ' dialog detected! Clicking "' + btnText + '"');

    setTimeout(() => {
      try {
        btn.click();
        log('✅ Clicked successfully.');
      } catch (e) {
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      }
    }, CONFIG.clickDelay);
  }

  // === Initialization ===
  observerRef = new MutationObserver((mutations) => {
    if (mutations.some(m => m.addedNodes.length > 0)) {
      setTimeout(scanAndAction, 300);
    }
  });

  observerRef.observe(document.documentElement, { childList: true, subtree: true });
  pollIntervalRef = setInterval(scanAndAction, CONFIG.pollInterval);

  window.__autoRetryCleanup = function() {
    if (observerRef) observerRef.disconnect();
    if (pollIntervalRef) clearInterval(pollIntervalRef);
    log('Cleaned up.');
  };

  setTimeout(scanAndAction, 1000);
  log('v' + SCRIPT_VERSION + ' injected. AutoRetry: ON, AutoAccept: ' + (USER_CONFIG.autoAccept !== false ? 'ON' : 'OFF'));
  return 'injection_success';
})();
`;
}

module.exports = { getInjectionScript };
