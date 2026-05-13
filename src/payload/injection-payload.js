/**
 * injection-payload.js - JavaScript code to inject into Antigravity's DOM
 * 
 * This script runs INSIDE the Electron renderer process.
 * It uses passive polling to scan for error dialogs and auto-click Retry/Accept.
 */

const { normalizeConfig } = require('../core/config-schema');

const INJECTION_VERSION = 50;

/**
 * Trả về string JavaScript sẽ được inject vào DOM qua CDP Runtime.evaluate
 */
function getInjectionScript(userConfig = {}) {
  const normalizedConfig = normalizeConfig(userConfig);
  const configJson = JSON.stringify(normalizedConfig);

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
  window.__autoRetryDisabled = false;

  // ============================================================
  // 2. Configuration & Patterns
  // ============================================================
  const RETRY_CONFIG = USER_CONFIG.autoRetry || {};
  const ACCEPT_CONFIG = USER_CONFIG.autoAccept || {};
  const CONFIG = {
    dialogContainerSelectors: Array.isArray(RETRY_CONFIG.dialogContainerSelectors)
      ? ['.' + MOCK_MARKER_CLASS, ...RETRY_CONFIG.dialogContainerSelectors.filter((selector) => selector !== '.' + MOCK_MARKER_CLASS)]
      : ['.' + MOCK_MARKER_CLASS],
    errorPatterns: [],
    retryButtonPatterns: [],
    actionButtonPatterns: [],
    retryContextPatterns: [],
    actionCategories: {},
    blacklist: Array.isArray(ACCEPT_CONFIG.blacklist) ? ACCEPT_CONFIG.blacklist.slice() : [],
    pollInterval: RETRY_CONFIG.timing && RETRY_CONFIG.timing.pollInterval || 3000,
    clickDelay: RETRY_CONFIG.timing && RETRY_CONFIG.timing.clickDelay || 800,
    maxRetriesPerMinute: RETRY_CONFIG.rateLimit && RETRY_CONFIG.rateLimit.maxRetriesPerMinute || 15,
    cooldownMs: RETRY_CONFIG.rateLimit && RETRY_CONFIG.rateLimit.cooldownMs || 60000,
    minClickInterval: RETRY_CONFIG.timing && RETRY_CONFIG.timing.minClickInterval || 5000
  };

  const toRegex = (p) => {
    try {
      const match = p.match(/^\\/(.*)\\/(.*)$/);
      if (match) return new RegExp(match[1], match[2]);
      return new RegExp(p, 'i');
    } catch(e) { return null; }
  };

  CONFIG.errorPatterns = Array.isArray(RETRY_CONFIG.errorPatterns)
    ? RETRY_CONFIG.errorPatterns.map(toRegex).filter(Boolean)
    : [];
  CONFIG.retryButtonPatterns = Array.isArray(RETRY_CONFIG.retryButtonPatterns)
    ? RETRY_CONFIG.retryButtonPatterns.map(toRegex).filter(Boolean)
    : [];
  CONFIG.retryContextPatterns = Array.isArray(RETRY_CONFIG.retryContextPatterns)
    ? RETRY_CONFIG.retryContextPatterns.map(toRegex).filter(Boolean)
    : [];

  const categoryEntries = ACCEPT_CONFIG.categories && typeof ACCEPT_CONFIG.categories === 'object'
    ? Object.entries(ACCEPT_CONFIG.categories)
    : [];
  for (const [categoryName, categoryConfig] of categoryEntries) {
    CONFIG.actionCategories[categoryName] = {
      buttons: Array.isArray(categoryConfig.buttons) ? categoryConfig.buttons.map(toRegex).filter(Boolean) : [],
      context: Array.isArray(categoryConfig.context) ? categoryConfig.context.map(toRegex).filter(Boolean) : []
    };
  }

  // Tổng hợp actionButtonPatterns từ các category buttons
  // Chỉ những nút được định nghĩa rõ ràng trong phần 'buttons' mới được tìm kiếm.
  CONFIG.actionButtonPatterns = Object.values(CONFIG.actionCategories).flatMap(cat => cat.buttons);

  if (Array.isArray(RETRY_CONFIG.customRetryPatterns)) {
    RETRY_CONFIG.customRetryPatterns.forEach(p => {
      const re = toRegex(p);
      if (re) CONFIG.retryButtonPatterns.push(re);
    });
  }
  if (Array.isArray(ACCEPT_CONFIG.customAcceptPatterns)) {
    ACCEPT_CONFIG.customAcceptPatterns.forEach(p => {
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
  let pollIntervalRef = null;
  let isActive = true;
  const timeoutRefs = new Set();
  function log(msg) {
    console.log('[AutoRetry] ' + msg);
  }

  function logDetectedStat(type, category = '') {
    if (type === 'RETRY') {
      log('[STAT] RETRY_DETECTED');
      return;
    }
    const normalizedCategory = String(category || 'unknown').toLowerCase();
    log('[STAT] ACCEPT_DETECTED:' + normalizedCategory);
  }

  function logSkippedStat(type, reason) {
    log('[STAT] ' + type + '_SKIPPED: ' + reason);
  }

  function logAcceptBlockedStat(category = '') {
    const normalizedCategory = String(category || 'unknown').toLowerCase();
    log('[STAT] ACCEPT_BLOCKED:' + normalizedCategory);
  }

  function isAutoAcceptEnabled() {
    return ACCEPT_CONFIG.enabled !== false;
  }

  function getAutoAcceptCategories() {
    if (!isAutoAcceptEnabled()) return {};
    if (ACCEPT_CONFIG && typeof ACCEPT_CONFIG === 'object' && ACCEPT_CONFIG.categories) {
      return ACCEPT_CONFIG.categories;
    }
    return {};
  }

  function getCategoryForButton(btnText) {
    if (!btnText) return null;
    const normalized = btnText.trim();
    for (const [catName, catObj] of Object.entries(CONFIG.actionCategories)) {
      if (catObj.buttons.some(p => p.test(normalized))) return catName;
    }
    return null;
  }

  function getCategoryForContainer(container) {
    const text = (container.textContent || '') + ' ' + getSurroundingText(container);
    for (const [catName, catObj] of Object.entries(CONFIG.actionCategories)) {
      // Chỉ kiểm tra các mẫu ngữ cảnh (Context)
      if (catObj.context.some(p => p.test(text))) return catName;
    }
    return 'system';
  }

  function debug(msg) {
    if (USER_CONFIG.debug) console.log('[AutoRetry] [DEBUG] ' + msg);
  }

  function schedule(fn, delay) {
    const ref = setTimeout(() => {
      timeoutRefs.delete(ref);
      if (!isActive || window.__autoRetryDisabled) return;
      fn();
    }, delay);
    timeoutRefs.add(ref);
    return ref;
  }

  function formatRect(rect) {
    if (!rect) return 'n/a';
    return 'x=' + Math.round(rect.left) +
      ',y=' + Math.round(rect.top) +
      ',w=' + Math.round(rect.width) +
      ',h=' + Math.round(rect.height);
  }

  function summarizeElement(el) {
    if (!el || !el.tagName) return '<unknown>';
    const tag = el.tagName.toLowerCase();
    const id = el.id ? '#' + el.id : '';
    const className = typeof el.className === 'string'
      ? '.' + el.className.trim().replace(/\s+/g, '.')
      : '';
    return '<' + tag + id + className + '>';
  }

  function elementPath(el, maxDepth = 5) {
    const parts = [];
    let curr = el;
    for (let i = 0; curr && i < maxDepth; i++) {
      parts.push(summarizeElement(curr));
      curr = curr.parentElement || (curr.getRootNode && curr.getRootNode().host);
    }
    return parts.join(' <- ');
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
      debug('[RATE] Resetting counters after ' + (now - lastResetTime) + 'ms. Previous actionCount=' + actionCount + ', cooldown=' + isInCooldown);
      actionCount = 0;
      lastResetTime = now;
      isInCooldown = false;
    }
  }

  function canClick(type = 'RETRY') {
    resetCounterIfNeeded();
    const now = Date.now();
    if (isInCooldown) {
      logSkippedStat(type, 'rate_limit_cooldown');
      debug('[RATE] Blocked by cooldown. actionCount=' + actionCount + ', sinceLastClick=' + (now - lastClickTime) + 'ms');
      return false;
    }
    if (now - lastClickTime < CONFIG.minClickInterval) {
      logSkippedStat(type, 'rate_limit_min_interval');
      debug('[RATE] Blocked by minClickInterval. sinceLastClick=' + (now - lastClickTime) + 'ms < ' + CONFIG.minClickInterval + 'ms');
      return false;
    }
    if (actionCount >= CONFIG.maxRetriesPerMinute) {
      isInCooldown = true;
      logSkippedStat(type, 'rate_limit_max_per_minute');
      log('Rate limit reached. Cooling down.');
      debug('[RATE] Entering cooldown. actionCount=' + actionCount + ', cooldownMs=' + CONFIG.cooldownMs);
      schedule(() => { isInCooldown = false; actionCount = 0; }, CONFIG.cooldownMs);
      return false;
    }
    return true;
  }

  function getClickGateStatus() {
    const now = Date.now();
    const wouldReset = now - lastResetTime > 60000;
    const effectiveActionCount = wouldReset ? 0 : actionCount;
    const effectiveCooldown = wouldReset ? false : isInCooldown;
    const sinceLastClick = now - lastClickTime;

    if (effectiveCooldown) {
      return {
        ok: false,
        reason: 'cooldown',
        actionCount: effectiveActionCount,
        sinceLastClick
      };
    }
    if (sinceLastClick < CONFIG.minClickInterval) {
      return {
        ok: false,
        reason: 'minClickInterval',
        actionCount: effectiveActionCount,
        sinceLastClick,
        minClickInterval: CONFIG.minClickInterval
      };
    }
    if (effectiveActionCount >= CONFIG.maxRetriesPerMinute) {
      return {
        ok: false,
        reason: 'maxRetriesPerMinute',
        actionCount: effectiveActionCount,
        maxRetriesPerMinute: CONFIG.maxRetriesPerMinute
      };
    }
    return {
      ok: true,
      reason: 'ok',
      actionCount: effectiveActionCount,
      sinceLastClick
    };
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

  function isPrimaryClickable(el, tag, role) {
    return tag === 'button' ||
      role === 'button' ||
      el.classList.contains('monaco-button') ||
      el.classList.contains('action-label');
  }

  function hasLooseClickability(el) {
    return el.classList.contains('button') ||
      el.classList.contains('btn') ||
      el.classList.contains('cursor-pointer') ||
      el.style.cursor === 'pointer' ||
      window.getComputedStyle(el).cursor === 'pointer';
  }

  function matchesButtonPatterns(text, patterns, isRetryScan) {
    if (!text || !patterns) return false;
    for (const pattern of patterns) {
      if (!pattern.test(text)) continue;
      if (isRetryScan && !isSafeRetryButtonText(text)) return false;
      return true;
    }
    return false;
  }

  function hasNestedMatchingClickable(el, patterns, isRetryScan) {
    try {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT);
      let child;
      while (child = walker.nextNode()) {
        if (child === el) continue;
        const tag = child.tagName.toLowerCase();
        const role = child.getAttribute('role');
        const isClickable = isRetryScan
          ? isPrimaryClickable(child, tag, role)
          : (isPrimaryClickable(child, tag, role) || hasLooseClickability(child));
        if (!isClickable || isUnsafeClickableContext(child)) continue;
        if (child.disabled || child.getAttribute('disabled') !== null) continue;
        const text = (child.textContent || '').trim();
        if (text.length === 0 || text.length > 50) continue;
        const rect = child.getBoundingClientRect();
        if (rect.width <= 2 || rect.height <= 2) continue;
        if (matchesButtonPatterns(text, patterns, isRetryScan)) return true;
      }
    } catch (e) {}
    return false;
  }

  function findButtonsIn(root, patterns, typeLabel) {
    let buttons = [];
    const isRetryScan = patterns === CONFIG.retryButtonPatterns;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let el;
    while (el = walker.nextNode()) {
      const tag = el.tagName.toLowerCase();
      const role = el.getAttribute('role');
      const isPrimaryButton = isPrimaryClickable(el, tag, role);
      const isLooseClickable = hasLooseClickability(el);
      const isClickable = isRetryScan ? isPrimaryButton : (isPrimaryButton || isLooseClickable);
      
      if (isClickable) {
        if (isUnsafeClickableContext(el)) {
          debug('[SCAN] Skipping unsafe clickable context ' + summarizeElement(el));
          continue;
        }
        const text = (el.textContent || '').trim();
        if (text.length > 0 && text.length <= 50) {
          if (el.disabled || el.getAttribute('disabled') !== null) {
            debug('[SCAN] Skipping disabled clickable ' + summarizeElement(el) + ' text="' + text + '"');
            continue;
          }
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
              if (matchesButtonPatterns(text, patterns, isRetryScan)) {
                if (hasNestedMatchingClickable(el, patterns, isRetryScan)) {
                  debug('[SCAN] Skipping wrapper candidate in favor of nested actionable element ' + summarizeElement(el) + ' text="' + text + '"');
                  continue;
                }
                if (typeLabel) {
                  debug('[SCAN] Found matching ' + typeLabel + ' button: "' + text + '" ' + summarizeElement(el) + ' rect=' + formatRect(rect) + ' inFooter=' + inFooter + ' path=' + elementPath(el, 4));
                }
                buttons.push({ el, text, rect, inFooter });
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

  function isUnsafeClickableContext(el) {
    try {
      const role = el.getAttribute('role');
      if (role === 'menuitem' || role === 'option' || role === 'treeitem' || role === 'tab') return true;
      return !!el.closest([
        '[role="menu"]',
        '[role="listbox"]',
        '.quick-input-widget',
        '.quick-input-list',
        '.monaco-list',
        '.monaco-menu-container',
        '.explorer-viewlet',
        '.tabs-container',
        '.monaco-breadcrumbs',
        '.part.titlebar',
        '.monaco-editor'
      ].join(','));
    } catch (e) {
      return false;
    }
  }

  function getVisibilityStatus(el, rect) {
    if (USER_CONFIG.testMode) {
      return { ok: true, reason: 'testMode' };
    }

    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    
    if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) {
      return {
        ok: false,
        reason: 'outOfViewport',
        point: { x: Math.round(x), y: Math.round(y) },
        viewport: { width: window.innerWidth, height: window.innerHeight }
      };
    }

    let topEl = document.elementFromPoint(x, y);
    if (!topEl) {
      return {
        ok: false,
        reason: 'noElementAtPoint',
        point: { x: Math.round(x), y: Math.round(y) }
      };
    }

    while (topEl && topEl.shadowRoot) {
      const shadowTopEl = topEl.shadowRoot.elementFromPoint(x, y);
      if (!shadowTopEl || shadowTopEl === topEl) break;
      topEl = shadowTopEl;
    }
    
    let curr = topEl;
    while (curr) {
      if (curr === el) {
        return {
          ok: true,
          reason: 'targetOnTop',
          point: { x: Math.round(x), y: Math.round(y) },
          topElement: summarizeElement(topEl)
        };
      }
      curr = curr.parentElement || (curr.getRootNode && curr.getRootNode().host);
    }
    return {
      ok: false,
      reason: 'coveredByElement',
      point: { x: Math.round(x), y: Math.round(y) },
      topElement: summarizeElement(topEl),
      topElementPath: elementPath(topEl, 4)
    };
  }

  function isVisibleAtPoint(el, rect) {
    const status = getVisibilityStatus(el, rect);
    if (USER_CONFIG.testMode) {
      debug('[STEP 4] Test mode enabled, bypassing visibility check');
    } else if (status.point) {
      debug('[STEP 4] Checking visibility at (' + status.point.x + ', ' + status.point.y + ')');
    }
    if (status.ok) {
      debug('[STEP 4.3] Visibility confirmed: ' + status.reason);
      return true;
    }
    if (status.reason === 'outOfViewport') {
      debug('[STEP 4.1] Point out of viewport bounds');
      return false;
    }
    if (status.reason === 'noElementAtPoint') {
      debug('[STEP 4.2] No element found at point');
      return false;
    }
    debug(
      '[STEP 4.4] Visibility failed for ' + summarizeElement(el) + ' rect=' + formatRect(rect) + '. ' +
      'Top element: ' + status.topElement + ' path=' + status.topElementPath
    );
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

  function normalizeText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function isSafeRetryButtonText(text) {
    const normalized = normalizeText(text);
    if (!normalized) return false;
    return normalized === 'retry' ||
      normalized === 'try again' ||
      normalized === 'thử lại' ||
      normalized === 'reconnect';
  }

  function resolveLiveButton(btnObj, container) {
    if (!btnObj || !btnObj.el) return null;
    if (document.contains(btnObj.el)) return btnObj.el;

    const searchRoot = container && document.contains(container) ? container : document.body;
    const allCandidates = findButtonsIn(searchRoot, null, null);
    const wantedText = normalizeText(btnObj.text);
    const matches = allCandidates.filter(candidate => normalizeText(candidate.text) === wantedText);
    if (matches.length === 0) return null;

    if (!btnObj.rect) return matches[0].el;

    matches.sort((a, b) => {
      const distA = Math.abs(a.rect.left - btnObj.rect.left) + Math.abs(a.rect.top - btnObj.rect.top);
      const distB = Math.abs(b.rect.left - btnObj.rect.left) + Math.abs(b.rect.top - btnObj.rect.top);
      return distA - distB;
    });
    return matches[0].el;
  }

  function hasEquivalentVisibleButton(btnObj, container) {
    const liveBtn = resolveLiveButton(btnObj, container);
    if (!liveBtn) return false;
    const liveRect = liveBtn.getBoundingClientRect();
    if (liveRect.width <= 2 || liveRect.height <= 2) return false;
    return isVisibleAtPoint(liveBtn, liveRect);
  }

  function buttonDiagnostic(btnObj, container, kind, category) {
    const surroundingText = getSurroundingText(btnObj.el);
    const isAgentWindow = !!(container.closest && container.closest('.antigravity-agent-side-panel'));
    const isRightSide = btnObj.rect.left > window.innerWidth * 0.4;
    return {
      kind,
      category: category || null,
      text: btnObj.text,
      element: summarizeElement(btnObj.el),
      path: elementPath(btnObj.el, 4),
      rect: {
        left: Math.round(btnObj.rect.left),
        top: Math.round(btnObj.rect.top),
        width: Math.round(btnObj.rect.width),
        height: Math.round(btnObj.rect.height)
      },
      inFooter: !!btnObj.inFooter,
      isAgentWindow,
      isRightSide,
      clickedFlag: !!btnObj.el.__clicked,
      disabled: !!(btnObj.el.disabled || btnObj.el.getAttribute('disabled') !== null),
      context: surroundingText.replace(/\s+/g, ' ').substring(0, 160),
      visibility: getVisibilityStatus(btnObj.el, btnObj.rect)
    };
  }

  function createScanReport(clickGate) {
    return {
      timestamp: new Date().toISOString(),
      scriptVersion: SCRIPT_VERSION,
      config: {
        autoRetry: RETRY_CONFIG.enabled !== false,
        autoAccept: isAutoAcceptEnabled(),
        testMode: !!USER_CONFIG.testMode
      },
      clickGate,
      foundAgentPanel: findInShadows(document, '.antigravity-agent-side-panel').length > 0,
      containerCount: 0,
      totalButtons: 0,
      wouldClick: false,
      action: null,
      containers: []
    };
  }

  function rememberUniqueButton(seenButtons, btnObj) {
    if (!seenButtons || !btnObj || !btnObj.el) return true;
    if (seenButtons.has(btnObj.el)) return false;
    seenButtons.add(btnObj.el);
    return true;
  }

  function hasContainerButtons(containerReport) {
    return !!(
      containerReport &&
      containerReport.buttons &&
      ((containerReport.buttons.retry && containerReport.buttons.retry.length > 0) ||
       (containerReport.buttons.accept && containerReport.buttons.accept.length > 0))
    );
  }

  // ============================================================
  // 6. Main Action Logic
  // ============================================================
  function scanAndAction(options = {}) {
    if (!isActive || window.__autoRetryDisabled) return;
    const dryRun = !!options.dryRun;
    const clickGate = getClickGateStatus();
    const report = dryRun ? createScanReport(clickGate) : null;
    const reportSeenButtons = dryRun ? new Set() : null;

    let containers = findValidContainers();
    const useFallback = containers.length === 0 && (isAutoAcceptEnabled() || RETRY_CONFIG.enabled !== false);
    if (useFallback) containers = [document.body];

    for (const container of containers) {
      const isAgentWindow = container.closest && container.closest('.antigravity-agent-side-panel');
      const containerRect = container.getBoundingClientRect();
      const snippet = (container.textContent || '').replace(/\s+/g, ' ').trim().substring(0, 120);
      const containerReport = dryRun ? {
        element: summarizeElement(container),
        rect: {
          left: Math.round(containerRect.left),
          top: Math.round(containerRect.top),
          width: Math.round(containerRect.width),
          height: Math.round(containerRect.height)
        },
        isAgentWindow: !!isAgentWindow,
        fallback: useFallback,
        textSnippet: snippet,
        buttons: { retry: [], accept: [] }
      } : null;
      // Silent inspection in loops
      
      // Case 1: Auto-Retry
      if (RETRY_CONFIG.enabled !== false) {
        // debug(\`[STEP 1] Found matching RETRY container: <\${container.tagName.toLowerCase()}> (ID: \${container.id})\`);
        const btns = findButtonsIn(container, CONFIG.retryButtonPatterns, dryRun ? null : 'RETRY');
        btns.sort((a, b) => (a.inFooter !== b.inFooter ? (b.inFooter ? 1 : -1) : b.rect.top - a.rect.top));
        // debug('[SCAN] RETRY candidates in container: ' + btns.length);

        for (const btnObj of btns) {
          if (dryRun && !rememberUniqueButton(reportSeenButtons, btnObj)) continue;
          if (dryRun) report.totalButtons++;
          const diag = dryRun ? buttonDiagnostic(btnObj, container, 'retry') : null;
          // debug('[STEP 2] Found matching RETRY button: "' + btnObj.text + '"...');
          const isRightSide = btnObj.rect.left > window.innerWidth * 0.4;
          if (!USER_CONFIG.testMode && !isAgentWindow && !isRightSide) {
            if (dryRun) {
              diag.decision = 'skip';
              diag.reason = 'notRightSide';
              containerReport.buttons.retry.push(diag);
            }
            if (!dryRun) logSkippedStat('RETRY', 'not_right_side');
            debug('[STEP 3] Skipping RETRY button: not on right side (' + Math.round(btnObj.rect.left) + ' < ' + Math.round(window.innerWidth * 0.4) + ')');
            continue;
          }
          if (useFallback && !CONFIG.retryContextPatterns.some(p => p.test(getSurroundingText(btnObj.el)))) {
            if (dryRun) {
              diag.decision = 'skip';
              diag.reason = 'contextMismatch';
              containerReport.buttons.retry.push(diag);
            }
            if (!dryRun) logSkippedStat('RETRY', 'context_mismatch');
            debug(\`[STEP 3.1] Skipping RETRY button: context mismatch\`);
            continue;
          }
          if (!useFallback) {
            const retryContext = (container.textContent || '') + ' ' + getSurroundingText(btnObj.el);
            if (!CONFIG.retryContextPatterns.some(p => p.test(retryContext))) {
              if (dryRun) {
                diag.decision = 'skip';
                diag.reason = 'retryContextMismatch';
                containerReport.buttons.retry.push(diag);
              }
              if (!dryRun) logSkippedStat('RETRY', 'retry_context_mismatch');
              debug('[STEP 3.2] Skipping RETRY button: no retry/error context in container');
              continue;
            }
          }
          if (dryRun && !diag.visibility.ok) {
            diag.decision = 'skip';
            diag.reason = 'visibility:' + diag.visibility.reason;
            containerReport.buttons.retry.push(diag);
            continue;
          }
          if (!dryRun) {
            const visibility = getVisibilityStatus(btnObj.el, btnObj.rect);
            if (!visibility.ok) {
              if (!dryRun) {
                logSkippedStat('RETRY', 'visibility_' + visibility.reason);
                if (visibility.reason === 'outOfViewport') {
                  debug('[STEP 4.5] Visibility check bypassed: point out of viewport bounds');
                } else if (visibility.reason === 'noElementAtPoint') {
                  debug('[STEP 4.5] Visibility check bypassed: no element found at point');
                  debug(
                    '[STEP 4.5] Visibility check bypassed for ' + summarizeElement(btnObj.el) + ' rect=' + formatRect(btnObj.rect) + '. ' +
                    'Top element: ' + visibility.topElement + ' path=' + visibility.topElementPath
                  );
                }
              }
            } else {
              debug('[STEP 4.3] Visibility confirmed: ' + visibility.reason);
            }
          }

          if (dryRun) {
            diag.decision = 'wouldClick';
            diag.reason = 'passedAllGates';
            containerReport.buttons.retry.push(diag);
            if (hasContainerButtons(containerReport)) report.containers.push(containerReport);
            report.wouldClick = true;
            report.action = diag;
            report.containerCount = report.containers.length;
            return report;
          }
          logDetectedStat('RETRY');
          if (!canClick('RETRY')) return;
          performClick(btnObj, container, '🔄 RETRY', 'retry');
          return;
        }
      }

      // Case 2: Auto-Accept
      if (isAutoAcceptEnabled()) {
        const btns = findButtonsIn(container, CONFIG.actionButtonPatterns, null);
        if (btns.length > 0) {
          const categories = getAutoAcceptCategories();
          btns.sort((a, b) => (a.inFooter !== b.inFooter ? (b.inFooter ? 1 : -1) : b.rect.top - a.rect.top));

          for (const btnObj of btns) {
            // Logic phân loại ưu tiên: Nút bấm -> Ngữ cảnh -> Mặc định
            const buttonCat = getCategoryForButton(btnObj.text);
            const matchedCat = buttonCat || getCategoryForContainer(container);
            const catConfig = categories[matchedCat];

            if (catConfig && catConfig.enabled !== false) {
              if (dryRun && !rememberUniqueButton(reportSeenButtons, btnObj)) continue;
              if (dryRun) report.totalButtons++;
              const diag = dryRun ? buttonDiagnostic(btnObj, container, 'accept', matchedCat) : null;
              
              const isRightSide = btnObj.rect.left > window.innerWidth * 0.4;
              if (!USER_CONFIG.testMode && !isAgentWindow && !isRightSide) {
                if (dryRun) {
                  diag.decision = 'skip';
                  diag.reason = 'notRightSide';
                  containerReport.buttons.accept.push(diag);
                }
                if (!dryRun) logSkippedStat('ACCEPT', 'not_right_side');
                debug('[STEP 3] Skipping ACCEPT button: not on right side (' + Math.round(btnObj.rect.left) + ' < ' + Math.round(window.innerWidth * 0.4) + ')');
                continue;
              }
              if (dryRun && !diag.visibility.ok) {
                diag.decision = 'skip';
                diag.reason = 'visibility:' + diag.visibility.reason;
                containerReport.buttons.accept.push(diag);
                continue;
              }
              if (!dryRun) {
                const visibility = getVisibilityStatus(btnObj.el, btnObj.rect);
                if (!visibility.ok) {
                  if (!dryRun) {
                    logSkippedStat('ACCEPT', 'visibility_' + visibility.reason);
                    if (visibility.reason === 'outOfViewport') {
                      debug('[STEP 4.5] Visibility check bypassed: point out of viewport bounds');
                    } else if (visibility.reason === 'noElementAtPoint') {
                      debug('[STEP 4.5] Visibility check bypassed: no element found at point');
                      debug(
                        '[STEP 4.5] Visibility check bypassed for ' + summarizeElement(btnObj.el) + ' rect=' + formatRect(btnObj.rect) + '. ' +
                        'Top element: ' + visibility.topElement + ' path=' + visibility.topElementPath
                      );
                    }
                  }
                } else {
                  debug('[STEP 4.3] Visibility confirmed: ' + visibility.reason);
                }
              }

              const cmdText = extractCommandText(btnObj.el);
              if (dryRun) {
                diag.commandText = (cmdText || '').substring(0, 200);
                if (isCommandBlocked(cmdText)) {
                  diag.decision = 'skip';
                  diag.reason = 'blacklist';
                  containerReport.buttons.accept.push(diag);
                  continue;
                }
                diag.decision = 'wouldClick';
                diag.reason = 'passedAllGates';
                containerReport.buttons.accept.push(diag);
                if (hasContainerButtons(containerReport)) report.containers.push(containerReport);
                report.wouldClick = true;
                report.action = diag;
                report.containerCount = report.containers.length;
                return report;
              }

              logDetectedStat('ACCEPT', matchedCat);
              debug('[ACTION] ACCEPT command context for "' + btnObj.text + '": "' + (cmdText || '').substring(0, 200) + '"');
              if (isCommandBlocked(cmdText)) {
                debug('[ACTION] Command BLOCKED by blacklist: "' + (cmdText || '').substring(0, 50) + '..."');
                const shouldClick = ACCEPT_CONFIG.performClick === true || ACCEPT_CONFIG.performClick === 'true';
                if (shouldClick) {
                  if (!btnObj.el.__blocked) {
                    btnObj.el.__blocked = true;
                    logSkippedStat('ACCEPT', 'blacklist');
                    logAcceptBlockedStat(matchedCat);
                    btnObj.el.style.border = '2px solid red';
                    setTimeout(() => { btnObj.el.__blocked = false; }, 5000);
                  }
                }
                continue;
              }
              const shouldClick = ACCEPT_CONFIG.performClick === true || ACCEPT_CONFIG.performClick === 'true';
              if (shouldClick) {
                if (!canClick('ACCEPT')) {
                  debug('[ACTION] Click blocked by rate limit or cooldown for category: ' + matchedCat);
                  return;
                }
                performClick(btnObj, container, '⚡ ACTION (' + matchedCat.toUpperCase() + ')', matchedCat);
              } else {
                debug('[ACTION] performClickAutoAccept is OFF (' + ACCEPT_CONFIG.performClick + '), skipping click but logged to statistics.');
              }
              return;
            }
          }
        }
      }

      if (dryRun && hasContainerButtons(containerReport)) {
        report.containers.push(containerReport);
      }
    }

    // debug('[SCAN] Pass completed without any actionable button');
    if (dryRun) {
      report.containerCount = report.containers.length;
      return report;
    }
  }

  function performClick(btnObj, container, typeLabel, category = '') {
    if (!isActive || window.__autoRetryDisabled) return;
    if (!btnObj || !btnObj.el) return;
    const originalBtn = btnObj.el;
    const btnText = btnObj.text;

    if (document.contains(originalBtn) && originalBtn.__clicked) {
      debug('[ACTION] Skipping click because __clicked is already true for ' + summarizeElement(originalBtn) + ' text="' + btnText + '"');
      return;
    }
    if (originalBtn.__clicked && !document.contains(originalBtn)) {
      originalBtn.__clicked = false;
    }

    const executeClick = (btn, isFallback = false) => {
      try {
        if (!isFallback) {
          debug('[STEP 5.1] Executing DOM click() on <' + btn.tagName.toLowerCase() + '>');
          btn.click();
        } else {
          debug('[STEP 5.2] Executing fallback MouseEvent sequence on <' + btn.tagName.toLowerCase() + '>');
          const liveRect = btn.getBoundingClientRect();
          const opts = {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: liveRect.left + liveRect.width / 2,
            clientY: liveRect.top + liveRect.height / 2
          };
          btn.dispatchEvent(new PointerEvent('pointerdown', opts));
          btn.dispatchEvent(new MouseEvent('mousedown', opts));
          btn.dispatchEvent(new PointerEvent('pointerup', opts));
          btn.dispatchEvent(new MouseEvent('mouseup', opts));
          btn.dispatchEvent(new MouseEvent('click', opts));
        }
        return true;
      } catch (e) {
        debug('[STEP 5.3] Click execution failed: ' + e.message);
        return false;
      }
    };

    schedule(() => {
      if (!isActive || window.__autoRetryDisabled) return;
      const liveBtn = resolveLiveButton(btnObj, container);
      if (!liveBtn) {
        debug('[STEP 5] Aborting click because live target could not be resolved for "' + btnText + '"');
        originalBtn.__clicked = false;
        return;
      }

      if (liveBtn.__clicked) {
        debug('[STEP 5] Live target already marked __clicked for "' + btnText + '"');
        return;
      }

      liveBtn.__clicked = true;
      actionCount++;
      lastClickTime = Date.now();
      const initialRect = liveBtn.getBoundingClientRect();
      log(typeLabel + '! [STEP 5] Clicking button "' + btnText + '"');
      debug(
        '[ACTION] Preparing click for ' + summarizeElement(liveBtn) + ' rect=' + formatRect(initialRect) +
        ' path=' + elementPath(liveBtn, 4) + ' actionCount=' + actionCount
      );

      const isMock = liveBtn.closest('.' + MOCK_MARKER_CLASS);
      liveBtn.style.outline = '3px solid #3794ff';
      executeClick(liveBtn, false);
      
      // Verify after a short delay
      schedule(() => {
        if (!isActive || window.__autoRetryDisabled) return;
        const stillPresent = hasEquivalentVisibleButton(btnObj, container);
        debug('[STEP 6/7] Post-click verification for "' + btnText + '": stillPresent=' + stillPresent);
        if (stillPresent) {
          if (isMock) {
            log('⚠️ [STEP 7] Mock button still visible. Triggering robust cleanup...');
            cleanupMocks();
          } else {
            log('⚠️ [STEP 7] Button still visible after click. Retrying with fallback...');
            const retryBtn = resolveLiveButton(btnObj, container);
            if (!retryBtn) {
              debug('[STEP 7] Fallback skipped because live target disappeared for "' + btnText + '"');
              liveBtn.__clicked = false;
              originalBtn.__clicked = false;
              return;
            }
            executeClick(retryBtn, true);
            
            schedule(() => {
              if (!isActive || window.__autoRetryDisabled) return;
              const finalCheck = hasEquivalentVisibleButton(btnObj, container);
              debug('[STEP 8] Final verification for "' + btnText + '": finalCheck=' + finalCheck);
              if (finalCheck) {
                log('❌ [STEP 8] Dialog persistent even after fallback click. Manual intervention may be required.');
              } else {
                log('✅ [STEP 8] Fallback click worked. Dialog dismissed.');
                log(typeLabel.includes('RETRY') ? '[STAT] RETRY_CLICKED' : '[STAT] ACCEPT_CLICKED:' + category.toLowerCase());
              }
              liveBtn.__clicked = false;
              originalBtn.__clicked = false;
            }, 500);
          }
        } else {
          log('✅ [STEP 6] Clicked successfully, dialog dismissed.');
          log(typeLabel.includes('RETRY') ? '[STAT] RETRY_CLICKED' : '[STAT] ACCEPT_CLICKED:' + category.toLowerCase());
          if (isMock) cleanupMocks(); // Clean up other potential mocks
          liveBtn.__clicked = false;
          originalBtn.__clicked = false;
        }
      }, 500);
    }, CONFIG.clickDelay);
  }

  // ============================================================
  // 7. Initialization & Lifecycle
  // ============================================================
  pollIntervalRef = setInterval(scanAndAction, CONFIG.pollInterval);
  debug('[SCAN] Polling started. interval=' + CONFIG.pollInterval + 'ms, autoRetry=' + (RETRY_CONFIG.enabled !== false) + ', autoAccept=' + isAutoAcceptEnabled());

  window.__autoRetryCleanup = function() {
    isActive = false;
    window.__autoRetryDisabled = true;
    if (pollIntervalRef) clearInterval(pollIntervalRef);
    timeoutRefs.forEach(ref => clearTimeout(ref));
    timeoutRefs.clear();
    pollIntervalRef = null;
    log('Cleaned up.');
  };

  // Helper for manual analysis
  window.__analyzeDialog = function() {
    log('Analyzing current DOM with daemon-equivalent dry-run...');
    return scanAndAction({ dryRun: true });
  };

  schedule(scanAndAction, 1000);
  log('v' + SCRIPT_VERSION + ' active. Retry: ' + (RETRY_CONFIG.enabled !== false ? 'ON' : 'OFF') + ', Accept: ' + (isAutoAcceptEnabled() ? 'ON' : 'OFF'));
  return 'injection_success';
})();
`;
}

module.exports = { getInjectionScript };
