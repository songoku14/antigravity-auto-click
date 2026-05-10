/**
 * injection-payload.js - JavaScript code to inject into Antigravity's DOM
 * 
 * This script runs INSIDE the Electron renderer process.
 * It uses MutationObserver to watch for error dialogs and auto-click Retry/Accept.
 */

const INJECTION_VERSION = 19;

/**
 * Trả về string JavaScript sẽ được inject vào DOM qua CDP Runtime.evaluate
 */
function getInjectionScript(userConfig = {}) {
  const configJson = JSON.stringify(userConfig);
  
  return `
(function() {
  const SCRIPT_VERSION = 20;
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
      '.test-dialog',
      '.test-accept-dialog',
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
      /\\bretry\\b/i,
      /\\btry\\s*again\\b/i,
      /\\bthử\\s*lại\\b/i,
      /\\breconnect\\b/i
    ],

    actionButtonPatterns: [
      /\\baccept\\b/i,
      /\\brun\\b/i,
      /\\bexecute\\b/i,
      /\\ballow\\b/i,
      /\\bjoin\\b/i,
      /\\byes\\b/i,
      /\\bapprove\\b/i,
      /\\bcontinue\\b/i,
      /\\balways\\s*allow\\b/i
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
    
    // We only need to find elements with shadowRoot to recurse
    // Using querySelectorAll('*') is expensive, but better than TreeWalker in some cases
    // Actually, let's just stick to a faster walker or specific common roots
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
      acceptNode: function(node) {
        return node.shadowRoot ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    
    let node;
    while (node = walker.nextNode()) {
      elements = elements.concat(findInShadows(node.shadowRoot, selector));
    }
    return elements;
  }

  function findValidContainers() {
    const containers = new Set();
    for (const selector of CONFIG.dialogContainerSelectors) {
      try {
        const found = findInShadows(document, selector);
        if (found.length > 0) {
          found.forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.width > 2 && rect.height > 2) {
              containers.add(el);
            }
          });
        }
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
        if (text.length > 50) continue;
        
        for (const pattern of patterns) {
          if (pattern.test(text)) {
            log('Found matching ' + typeLabel + ' button: "' + text + '"');
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
    if (containers.length > 0) {
      // log('Found ' + containers.length + ' potential containers');
    }
    const useFallback = containers.length === 0 && USER_CONFIG.autoAccept !== false;
    
    if (useFallback) {
      containers = [document.body];
    }

    for (const container of containers) {
      const containerText = (container.textContent || '').substring(0, 2000);
      
      // Case 1: Error/Retry
      if (USER_CONFIG.autoRetry !== false) {
        const errorMatched = CONFIG.errorPatterns.some(p => p.test(containerText));
        if (errorMatched) {
          log('Error pattern matched in container. Searching for retry buttons...');
          const btns = findButtonsIn(container, CONFIG.retryButtonPatterns, 'RETRY');
          if (btns.length > 0) {
            log('[STAT] RETRY_DETECTED');
            performClick(btns[0].el, btns[0].text, '🔄 RETRY');
            return;
          } else {
            log('No retry buttons found in matching container.');
          }
        }
      }

      // Case 2: Action/Accept
      if (USER_CONFIG.autoAccept !== false) {
        const btns = findButtonsIn(container, CONFIG.actionButtonPatterns, 'ACTION');
        if (btns.length > 0) {
          const btn = btns[0].el;
          const btnText = btns[0].text;

          log('[STAT] ACCEPT_DETECTED');

          const cmdText = extractCommandText(btn);
          if (isCommandBlocked(cmdText)) {
            if (!btn.__blockedByFilter) {
              btn.__blockedByFilter = true;
              log('[STAT] ACCEPT_BLOCKED');
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

    const oldStyle = btn.style.cssText;
    btn.style.cssText += '; outline: 3px solid #3794ff !important; outline-offset: 2px !important;';

    setTimeout(() => {
      try {
        btn.click();
        log('✅ Clicked successfully.');
        if (typeLabel.includes('RETRY')) {
          log('[STAT] RETRY_CLICKED');
        } else {
          log('[STAT] ACCEPT_CLICKED');
        }
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
    container.setAttribute('role', 'alertdialog');
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
