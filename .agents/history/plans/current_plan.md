# Debug: Auto-Retry / Auto-Accept Không Hoạt Động

## Quyết định Thiết kế (Final)

> **Scan toàn bộ `.antigravity-agent-side-panel` — đơn giản, đủ mạnh, không cần zone.**  
> Lý do: nhiều card có thể xuất hiện đồng thời, zone-based chỉ thêm complexity mà không cover hết.

`.antigravity-agent-side-panel` đã có sẵn trong `dialogContainerSelectors`. Vấn đề **không phải thiếu container** mà là **gate logic sai** ngăn không cho tìm button.

---

## Root Cause

```
scanAndAction()
  → container = .antigravity-agent-side-panel  ✅ (tìm đúng)
  → containerText = container.textContent.substring(0, 2000)
  → errorPatterns.some(p => p.test(containerText))  ← LUÔN FALSE ❌
```

**Tại sao luôn false:** 2000 chars đầu của panel = toàn CSS boilerplate (`@media`, `.markdown-alert`...). Error text thật nằm ở offset 4571–9084, ngoài tầm với.

→ Gate này block toàn bộ button detection. **Xóa nó đi.**

---

## 4 Bug Fixes Cụ Thể

### 🔴 Fix #1 — Xóa `containerText` gate trong `scanAndAction()`

**File:** `src/payload/injection-payload.js`

```diff
  for (const container of containers) {
-   const containerText = (container.textContent || '').substring(0, 2000);
    const isAgentWindow = container.closest && container.closest('.antigravity-agent-side-panel');
    
    // Case 1: Auto-Retry
-   if (USER_CONFIG.autoRetry !== false && CONFIG.errorPatterns.some(p => p.test(containerText))) {
+   if (USER_CONFIG.autoRetry !== false) {
      const btns = findButtonsIn(container, CONFIG.retryButtonPatterns, 'RETRY');
      ...
    }

    // Case 2: Auto-Accept
-   for (const [catName, catConfig] of Object.entries(categories)) {
-     if (catConfig.enabled === false) continue;
-     const catPatterns = CONFIG.actionCategories[catName] || [];
-     if (!catPatterns.some(p => p.test(containerText)) && ...) continue;  // ← XÓA gate này
      const btns = findButtonsIn(container, CONFIG.actionButtonPatterns, 'ACTION');
      ...
-   }
  }
```

> [!IMPORTANT]
> Sau khi bỏ gate, `findButtonsIn()` sẽ scan toàn panel và tìm buttons theo text pattern. Text pattern (Retry, Run, Proceed, Accept all) đã đủ unique để phân biệt — confirmed từ 5 DOM samples.

---

### 🔴 Fix #2 — `/^run$/i` → `/^run\b/i` (khớp `"Run⌥Enter"`)

**File:** `src/payload/injection-payload.js`

Button "Run" thực tế là `<button><span>Run</span><span>⌥Enter</span></button>`.  
`el.textContent.trim()` = `"Run⌥Enter"` → `/^run$/i` không khớp.

```diff
  actionButtonPatterns: [
    /^accept$/i,
-   /^run$/i,
+   /^run\b/i,          // matches "Run⌥Enter" ✅
    /^execute$/i,
    ...
  ],
```

---

### 🔴 Fix #3 — `isClickable` bỏ sót `<span class="cursor-pointer">` (Accept all)

**File:** `src/payload/injection-payload.js`

"Accept all" là `<span class="...cursor-pointer...">Accept all</span>` — không phải `<button>`. Cần check Tailwind class explicitly.

```diff
  const isClickable = tag === 'button' || 
                      el.getAttribute('role') === 'button' || 
                      el.classList.contains('monaco-button') || 
                      el.classList.contains('action-label') ||
                      el.classList.contains('button') ||
                      el.classList.contains('btn') ||
+                     el.classList.contains('cursor-pointer') ||
                      el.style.cursor === 'pointer' ||
                      window.getComputedStyle(el).cursor === 'pointer';
```

---

### 🔴 Fix #4 — Thêm `disabled` check để không click Proceed sai

**File:** `src/payload/injection-payload.js`

"Proceed" xuất hiện ở **mọi sample** nhưng `disabled=""` khi không có plan cần duyệt.

```diff
  if (isClickable) {
    const text = (el.textContent || '').trim();
    if (text.length > 0 && text.length <= 50) {
+     if (el.disabled || el.getAttribute('disabled') !== null) continue;
      const rect = el.getBoundingClientRect();
```

---

## Tóm tắt Thay đổi

| File | Thay đổi |
|------|----------|
| `injection-payload.js` | Xóa `containerText.substring(0,2000)` gate trong `scanAndAction()` |
| `injection-payload.js` | Xóa `actionCategories` category loop gate |  
| `injection-payload.js` | `/^run$/i` → `/^run\b/i` |
| `injection-payload.js` | Thêm `classList.contains('cursor-pointer')` vào `isClickable` |
| `injection-payload.js` | Thêm `disabled` check trong `findButtonsIn()` |

**Không thay đổi:**
- `dialogContainerSelectors` — `.antigravity-agent-side-panel` đã có sẵn ✅
- Cấu trúc module daemon/cdp-connection ✅
- Script commands, LaunchAgent ✅

---

## Verification Plan

```bash
npm test  # regression samples phải pass
```

Manual sau khi deploy:
- Trigger error dialog thật → log `[STAT] RETRY_DETECTED` + `RETRY_CLICKED`
- Trigger command card (Run) → log `[STAT] ACCEPT_DETECTED` + `ACCEPT_CLICKED`
- Trigger plan card (Proceed enabled) → log `[STAT] ACCEPT_DETECTED` + `ACCEPT_CLICKED`
- Trigger diff (Accept all) → log `[STAT] ACCEPT_DETECTED` + `ACCEPT_CLICKED`
- Confirm: Proceed disabled **không** bị click
