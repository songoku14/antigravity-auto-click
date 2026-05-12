/**
 * injection-payload.js - JavaScript code to inject into Antigravity's DOM
 * 
 * This script runs INSIDE the Electron renderer process.
 * It uses MutationObserver to watch for error dialogs and auto-click Retry/Accept.
 */

const INJECTION_VERSION = 36;

/**
 * Trả về string JavaScript sẽ được inject vào DOM qua CDP Runtime.evaluate
 */
function getInjectionScript(userConfig = {}) {
  const configJson = JSON.stringify(userConfig);

  return `
(function() {
  const SCRIPT_VERSION = ${INJECTION_VERSION};
  const USER_CONFIG = ${configJson};
  const MOCK_MARKER_CLASS = 'antigravity-mock-dialog';
  
  // ============================================================
  // 1. Versioning & Cleanup Logic
  // ============================================================
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

  // ============================================================
  // 2. Configuration & Patterns
  // ============================================================
  const CONFIG = {
    dialogContainerSelectors: [
      '.' + MOCK_MARKER_CLASS,
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
      '.bg-agent-convo-background',
      '.antigravity-agent-side-panel',
      '#antigravity\\.agentSidePanelInputBox',
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
      /^try\\s*again$/i,
      /^thử\\s*lại$/i,
      /^reconnect$/i,
      /\\bretry\\b/i
    ],

    actionButtonPatterns: [
      /^accept$/i,
      /^run\b/i,
      /^execute$/i,
      /^allow$/i,
      /^approve$/i,
      /^yes$/i,
      /^ok$/i,
      /^confirm$/i,
      /^continue$/i,
      /^proceed$/i,
      /\baccept\s*all\b/i,
      /\balways\s*allow\b/i
    ],

    retryContextPatterns: [
      /high\\s*traffic/i,
      /server\\s*(is\\s*)?busy/i,
      /too\\s*many\\s*requests/i,
      /rate\\s*limit(ed)?/i,
      /overloaded/i,
      /unavailable/i,
      /request\\s*failed/i,
      /something\\s*went\\s*wrong/i,
      /agent\\s*terminated/i,
      /try\\s*again/i,
      /connection\\s*lost/i
    ],

    actionCategories: {
      terminal: [
        /allow\\s*the\\s*following\\s*command/i,
        /run\\s*this\\s*command/i,
        /execute\\s*the\\s*following/i,
        /do\\s*you\\s*want\\s*to\\s*run/i
      ],
      review: [
        /review\\s*the\\s*changes/i,
        /agent\\s*prompt/i,
        /approve\\s*request/i,
        /click\\s*run\\s*to\\s*continue/i
      ],
      system: [
        /security\\s*confirmation/i,
        /allow\\s*this\\s*action/i,
        /accept\\s*terms/i
      ]
    },

    blacklist: USER_CONFIG.blacklist || [
      "rm ", "sudo ", "force ", "push ", "delete ", "terminate ", "pkill ", "kill ", "mkfs"
    ],

    pollInterval: 3000,
    clickDelay: 800,
    maxRetriesPerMinute: 15,
    cooldownMs: 60000,
    minClickInterval: 2000
  };

  const toRegex = (p) => {
    try {
      const match = p.match(/^\\/(.*)\\/(.*)$/);
      if (match) return new RegExp(match[1], match[2]);
      return new RegExp(p, 'i');
    } catch(e) { return null; }
  };

  // Merge custom patterns
  if (Array.isArray(USER_CONFIG.customRetryPatterns)) {
    USER_CONFIG.customRetryPatterns.forEach(p => {
      const re = toRegex(p);
      if (re) CONFIG.retryButtonPatterns.push(re);
    });
  }
  if (Array.isArray(USER_CONFIG.customAcceptPatterns)) {
    USER_CONFIG.customAcceptPatterns.forEach(p => {
      const re = toRegex(p);
      if (re) CONFIG.actionButtonPatterns.push(re);
    });
  }

  // ============================================================
  // 3. Runtime State
  // ============================================================
  let actionCount = 0;
  let lastResetTime = Date.now();
  let lastClickTime = 0;
  let isInCooldown = false;
  let observerRef = null;
  let pollIntervalRef = null;

  function log(msg) {
    console.log('[AutoRetry] ' + msg);
  }

  function debug(msg) {
    if (USER_CONFIG.debug) console.log('[AutoRetry] [DEBUG] ' + msg);
  }

  function cleanupMocks() {
    try {
      const mocks = document.querySelectorAll('.' + MOCK_MARKER_CLASS);
      if (mocks.length > 0) {
        log('Cleaning up ' + mocks.length + ' mock dialogs...');
        mocks.forEach(m => m.remove());
      }
    } catch (e) {
      debug('Cleanup error: ' + e.message);
    }
  }

  // ============================================================
  // 4. Rate Limiting & Safety
  // ============================================================
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

  function isCommandBlocked(cmdText) {
    if (!cmdText) return false;
    const lowerCmd = cmdText.toLowerCase();
    return CONFIG.blacklist.some(pattern => lowerCmd.includes(pattern.toLowerCase()));
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

  // ============================================================
  // 5. DOM Exploration Utilities
  // ============================================================
  function findInShadows(root, selector) {
    let elements = Array.from(root.querySelectorAll(selector));
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
        found.forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.width > 2 && rect.height > 2) containers.add(el);
        });
      } catch(e) {}
    }
    return Array.from(containers);
  }

  function findButtonsIn(root, patterns, typeLabel) {
    let buttons = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let el;
    while (el = walker.nextNode()) {
      const tag = el.tagName.toLowerCase();
      const isClickable = tag === 'button' || 
                          el.getAttribute('role') === 'button' || 
                          el.classList.contains('monaco-button') || 
                          el.classList.contains('action-label') ||
                          el.classList.contains('button') ||
                          el.classList.contains('btn') ||
                          el.classList.contains('cursor-pointer') ||
                          el.style.cursor === 'pointer' ||
                          window.getComputedStyle(el).cursor === 'pointer';
      
      if (isClickable) {
        const text = (el.textContent || '').trim();
        if (text.length > 0 && text.length <= 50) {
          if (el.disabled || el.getAttribute('disabled') !== null) continue;
          const rect = el.getBoundingClientRect();
          if (rect.width > 2 && rect.height > 2) {
            let inFooter = false;
            let parent = el.parentElement;
            for (let i = 0; i < 5 && parent; i++) {
              if (parent.tagName.toLowerCase() === 'footer' || parent.classList.contains('footer')) {
                inFooter = true;
                break;
              }
              parent = parent.parentElement;
            }

            if (patterns) {
              for (const pattern of patterns) {
                if (pattern.test(text)) {
                  if (typeLabel) log('Found matching ' + typeLabel + ' button: "' + text + '"');
                  buttons.push({ el, text, rect, inFooter });
                  break;
                }
              }
            } else {
              buttons.push({ el, text, rect, inFooter, tagName: tag, className: el.className, id: el.id });
            }
          }
        }
      }
      if (el.shadowRoot) {
        buttons = buttons.concat(findButtonsIn(el.shadowRoot, patterns, typeLabel));
      }
    }
    return buttons;
  }

  function isVisibleAtPoint(el, rect) {
    if (USER_CONFIG.testMode) {
      debug('[STEP 4] Test mode enabled, bypassing visibility check');
      return true;
    }

    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    debug(\`[STEP 4] Checking visibility at (\${Math.round(x)}, \${Math.round(y)})\`);
    
    if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) {
      debug('[STEP 4.1] Point out of viewport bounds');
      return false;
    }

    let topEl = document.elementFromPoint(x, y);
    if (!topEl) {
      debug('[STEP 4.2] No element found at point');
      return false;
    }

    while (topEl && topEl.shadowRoot) {
      const shadowTopEl = topEl.shadowRoot.elementFromPoint(x, y);
      if (!shadowTopEl || shadowTopEl === topEl) break;
      topEl = shadowTopEl;
    }
    
    let curr = topEl;
    while (curr) {
      if (curr === el) {
        debug('[STEP 4.3] Visibility confirmed: target button is on top');
        return true;
      }
      curr = curr.parentElement || (curr.getRootNode && curr.getRootNode().host);
    }
    debug(\`[STEP 4.4] Visibility failed: another element is on top: <\${topEl.tagName.toLowerCase()}> (ID: \${topEl.id}, Class: \${topEl.className})\`);
    return false;
  }

  function getSurroundingText(el) {
    try {
      let contextEl = el.parentElement;
      for (let i = 0; i < 2 && contextEl && contextEl.textContent.length < 50; i++) {
        if (contextEl.parentElement) contextEl = contextEl.parentElement;
      }
      return (contextEl ? contextEl.textContent : '').substring(0, 1000).trim();
    } catch (e) { return ''; }
  }

  // ============================================================
  // 6. Main Action Logic
  // ============================================================
  function scanAndAction() {
    if (!canClick()) return;

    let containers = findValidContainers();
    const useFallback = containers.length === 0 && (USER_CONFIG.autoAccept !== false || USER_CONFIG.autoRetry !== false);
    if (useFallback) containers = [document.body];

    for (const container of containers) {
      const isAgentWindow = container.closest && container.closest('.antigravity-agent-side-panel');
      
      // Case 1: Auto-Retry
      if (USER_CONFIG.autoRetry !== false) {
        debug(\`[STEP 1] Found matching RETRY container: <\${container.tagName.toLowerCase()}> (ID: \${container.id})\`);
        const btns = findButtonsIn(container, CONFIG.retryButtonPatterns, 'RETRY');
        btns.sort((a, b) => (a.inFooter !== b.inFooter ? (b.inFooter ? 1 : -1) : b.rect.top - a.rect.top));

        for (const btnObj of btns) {
          debug('[STEP 2] Found matching RETRY button: "' + btnObj.text + '"');
          const isRightSide = btnObj.rect.left > window.innerWidth * 0.4;
          if (!USER_CONFIG.testMode && !isAgentWindow && !isRightSide) {
            debug('[STEP 3] Skipping RETRY button: not on right side (' + Math.round(btnObj.rect.left) + ' < ' + Math.round(window.innerWidth * 0.4) + ')');
            continue;
          }
          if (useFallback && !CONFIG.retryContextPatterns.some(p => p.test(getSurroundingText(btnObj.el)))) {
            debug(\`[STEP 3.1] Skipping RETRY button: context mismatch\`);
            continue;
          }
          if (!isVisibleAtPoint(btnObj.el, btnObj.rect)) {
            continue;
          }

          log('[STAT] RETRY_DETECTED');
          performClick(btnObj.el, btnObj.text, '🔄 RETRY');
          return;
        }
      }

      // Case 2: Auto-Accept
      const autoAcceptConfig = USER_CONFIG.autoAccept;
      if (autoAcceptConfig === true || (autoAcceptConfig && autoAcceptConfig.enabled !== false)) {
        const categories = (autoAcceptConfig && typeof autoAcceptConfig === 'object' && autoAcceptConfig.categories) 
                           ? autoAcceptConfig.categories 
                           : { terminal: { enabled: true }, review: { enabled: true }, system: { enabled: true } };

        for (const [catName, catConfig] of Object.entries(categories)) {
          if (catConfig.enabled === false) continue;
          
          debug(\`[STEP 1] Found matching ACCEPT container for category "\${catName}": <\${container.tagName.toLowerCase()}>\`);
          const btns = findButtonsIn(container, CONFIG.actionButtonPatterns, 'ACTION (' + catName.toUpperCase() + ')');
          btns.sort((a, b) => (a.inFooter !== b.inFooter ? (b.inFooter ? 1 : -1) : b.rect.top - a.rect.top));

          for (const btnObj of btns) {
            debug('[STEP 2] Found matching ACCEPT button: "' + btnObj.text + '"');
            const isRightSide = btnObj.rect.left > window.innerWidth * 0.4;
            if (!USER_CONFIG.testMode && !isAgentWindow && !isRightSide) {
              debug('[STEP 3] Skipping ACCEPT button: not on right side (' + Math.round(btnObj.rect.left) + ' < ' + Math.round(window.innerWidth * 0.4) + ')');
              continue;
            }
            if (!isVisibleAtPoint(btnObj.el, btnObj.rect)) {
              continue;
            }

            log('[STAT] ACCEPT_DETECTED (' + catName + ')');
            const cmdText = extractCommandText(btnObj.el);
            if (isCommandBlocked(cmdText)) {
              if (!btnObj.el.__blocked) {
                btnObj.el.__blocked = true;
                log('[STAT] ACCEPT_BLOCKED');
                btnObj.el.style.border = '2px solid red';
                setTimeout(() => { btnObj.el.__blocked = false; }, 5000);
              }
              continue;
            }
            performClick(btnObj.el, btnObj.text, '⚡ ACTION (' + catName.toUpperCase() + ')');
            return;
          }
        }
      }
    }
  }

  function performClick(btn, btnText, typeLabel) {
    if (btn.__clicked) return;
    btn.__clicked = true;
    actionCount++;
    lastClickTime = Date.now();
    log(typeLabel + '! [STEP 5] Clicking button "' + btnText + '"');

    const isMock = btn.closest('.' + MOCK_MARKER_CLASS);
    btn.style.outline = '3px solid #3794ff';
    
    const executeClick = (isFallback = false) => {
      try {
        if (!isFallback) {
          debug('[STEP 5.1] Executing DOM click() on <' + btn.tagName.toLowerCase() + '>');
          btn.click();
        } else {
          debug('[STEP 5.2] Executing fallback MouseEvent sequence on <' + btn.tagName.toLowerCase() + '>');
          const opts = { bubbles: true, cancelable: true, view: window };
          btn.dispatchEvent(new MouseEvent('mousedown', opts));
          btn.dispatchEvent(new MouseEvent('mouseup', opts));
          btn.dispatchEvent(new MouseEvent('click', opts));
        }
        return true;
      } catch (e) {
        debug('[STEP 5.3] Click execution failed: ' + e.message);
        return false;
      }
    };

    setTimeout(() => {
      executeClick(false);
      
      // Verify after a short delay
      setTimeout(() => {
        // Check if button is still in DOM and visible
        const stillPresent = document.contains(btn) && btn.offsetParent !== null;
        if (stillPresent) {
          if (isMock) {
            log('⚠️ [STEP 7] Mock button still visible. Triggering robust cleanup...');
            cleanupMocks();
          } else {
            log('⚠️ [STEP 7] Button still visible after click. Retrying with fallback...');
            executeClick(true);
            
            setTimeout(() => {
              const finalCheck = document.contains(btn) && btn.offsetParent !== null;
              if (finalCheck) {
                log('❌ [STEP 8] Dialog persistent even after fallback click. Manual intervention may be required.');
              } else {
                log('✅ [STEP 8] Fallback click worked. Dialog dismissed.');
                log(typeLabel.includes('RETRY') ? '[STAT] RETRY_CLICKED' : '[STAT] ACCEPT_CLICKED');
              }
              btn.__clicked = false;
            }, 500);
          }
        } else {
          log('✅ [STEP 6] Clicked successfully, dialog dismissed.');
          log(typeLabel.includes('RETRY') ? '[STAT] RETRY_CLICKED' : '[STAT] ACCEPT_CLICKED');
          if (isMock) cleanupMocks(); // Clean up other potential mocks
          btn.__clicked = false;
        }
      }, 500);
    }, CONFIG.clickDelay);
  }

  // ============================================================
  // 7. Initialization & Lifecycle
  // ============================================================
  observerRef = new MutationObserver((mutations) => {
    if (mutations.some(m => m.addedNodes.length > 0)) setTimeout(scanAndAction, 400);
  });
  observerRef.observe(document.documentElement, { childList: true, subtree: true });

  pollIntervalRef = setInterval(scanAndAction, CONFIG.pollInterval);

  window.__autoRetryCleanup = function() {
    if (observerRef) observerRef.disconnect();
    if (pollIntervalRef) clearInterval(pollIntervalRef);
    log('Cleaned up.');
  };

  // Helper for manual analysis
  window.__analyzeDialog = function() {
    log('Analyzing current DOM for dialogs...');
    const containers = findValidContainers();
    const results = [];
    let totalProcessedButtons = 0;
    const seenButtons = new Set();
    
    // Check for agent panel specifically
    const agentPanel = document.querySelector('.antigravity-agent-side-panel');
    const hasAgentPanel = !!agentPanel;

    const getContext = (el) => {
      try {
        // Try to find text before the button in the same parent
        let context = '';
        let prev = el.previousSibling;
        while (prev) {
          const text = (prev.textContent || '').trim();
          if (text) {
            context = text + ' ' + context;
            if (context.length > 40) break;
          }
          prev = prev.previousSibling;
        }
        
        if (!context.trim()) {
          // Fallback to parent's text (excluding the button itself)
          const parentText = (el.parentElement.textContent || '').replace(el.textContent, '').trim();
          context = parentText.substring(0, 60);
        }
        return context.trim().replace(/\s+/g, ' ').substring(0, 100);
      } catch (e) { return ''; }
    };

    for (const container of containers) {
      const isAgentWindow = !!(container.closest && container.closest('.antigravity-agent-side-panel'));
      
      // Find buttons by category
      const retryBtns = findButtonsIn(container, CONFIG.retryButtonPatterns, null);
      const actionBtns = findButtonsIn(container, CONFIG.actionButtonPatterns, null);
      
      // Deduplicate buttons to avoid double counting in nested containers
      const uniqueRetry = retryBtns.filter(b => {
        if (seenButtons.has(b.el)) return false;
        seenButtons.add(b.el);
        return true;
      });
      const uniqueAccept = actionBtns.filter(b => {
        if (seenButtons.has(b.el)) return false;
        seenButtons.add(b.el);
        return true;
      });

      totalProcessedButtons += uniqueRetry.length + uniqueAccept.length;

      results.push({
        isAgentWindow,
        textSnippet: (container.textContent || '').replace(/\s+/g, ' ').substring(0, 160).trim(),
        buttons: {
          retry: uniqueRetry.map(b => ({ text: b.text, context: getContext(b.el) })),
          accept: uniqueAccept.map(b => ({ text: b.text, context: getContext(b.el) }))
        }
      });
    }
    
    return {
      timestamp: new Date().toISOString(),
      foundAgentPanel: hasAgentPanel,
      containerCount: containers.length,
      totalButtons: totalProcessedButtons,
      containers: results
    };
  };

  setTimeout(scanAndAction, 1000);
  log('v' + SCRIPT_VERSION + ' active. Retry: ' + (USER_CONFIG.autoRetry !== false ? 'ON' : 'OFF') + ', Accept: ' + (USER_CONFIG.autoAccept !== false ? 'ON' : 'OFF'));
  return 'injection_success';
})();
`;
}

module.exports = { getInjectionScript };
