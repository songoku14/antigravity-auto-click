# [Tech Leader] Implementation Plan — Webview Control Center (v3 — Final)

## Tổng quan

Chuyển giao diện extension từ QuickPick sang **Webview Panel** (Bottom Panel). Giao diện tối giản: **liệt kê chức năng + toggle slide** + **blacklist editable** + **Click Stats bar chart**.

---

## Quyết định thiết kế (đã chốt)

| # | Quyết định | Chi tiết |
|---|-----------|----------|
| 1 | UI style | Feature list + Toggle slide ON/OFF |
| 2 | Perform Click | **Giấu khỏi UI** — chỉ sửa qua `config.json` |
| 3 | Blacklist | **Hiển thị trên webview** — 1 ô text editable, comma-separated |
| 4 | Poll Interval input | **Không có** — không cần trên UI |
| 5 | Button Templates | **Không có** — không cần dạng tag/badge |
| 6 | QuickPick | Giữ song song, sau stable sẽ redirect |
| 7 | Click Stats | **Hiển thị inline** trên webview — horizontal bar chart per button name + total badge + Reset |

---

## Proposed Changes

> [!IMPORTANT]
> **Quy tắc TDD bắt buộc**: Mỗi phase phải **viết test trước → chạy fail → code implement → chạy pass**. Không được code trước test.

---

### Phase 1: Foundation — Webview Provider Setup [COMPLETED]

#### Bước 1.1: Viết test trước

##### [NEW] [extension-webview-phase1.js](file:///Users/lehoangthang/Documents/antigravity-auto-click/scripts/tests/extension-webview-phase1.js)
Test cases:
- `ControlCenterViewProvider` class tồn tại và export được
- `resolveWebviewView()` method tồn tại
- HTML output chứa CSP meta tag với nonce
- `_updateWebview()` gọi `postMessage` với type `UPDATE_STATE`
- Constants chứa `VIEW_ID` và message types

```bash
node scripts/tests/extension-webview-phase1.js  # → FAIL (chưa có code)
```

#### Bước 1.2: Implement code

##### [NEW] [webview-provider.js](file:///Users/lehoangthang/Documents/antigravity-auto-click/src/extension/webview-provider.js)
- Class `ControlCenterViewProvider` implements `vscode.WebviewViewProvider`
- `resolveWebviewView()`: set HTML template, enable scripts, CSP với nonce
- Message handler cho tất cả UI events
- `_updateWebview()`: đọc config + daemon state → `postMessage('UPDATE_STATE')`
- Config file watcher: `vscode.workspace.createFileSystemWatcher` → auto refresh UI

##### [MODIFY] [package.json](file:///Users/lehoangthang/Documents/antigravity-auto-click/package.json)
- Thêm `viewsContainers.panel` + `views`:
```json
"viewsContainers": {
  "panel": [{
    "id": "antigravity-panel",
    "title": "Auto Click",
    "icon": "$(zap)"
  }]
},
"views": {
  "antigravity-panel": [{
    "type": "webview",
    "id": "antigravity-auto-click.controlCenter",
    "name": "Control Center"
  }]
}
```
- Thêm `activationEvents: onView:antigravity-auto-click.controlCenter`

##### [MODIFY] [extension.js](file:///Users/lehoangthang/Documents/antigravity-auto-click/src/extension/extension.js)
- Register `ControlCenterViewProvider` trong `activate()`
- Truyền dependencies (configService, daemonService)
- Expose `refreshWebview()` cho các handlers khác

##### [MODIFY] [constants.js](file:///Users/lehoangthang/Documents/antigravity-auto-click/src/extension/constants.js)
- Thêm `VIEW_ID` constant
- Thêm message type constants (`TOGGLE_FEATURE`, `UPDATE_BLACKLIST`, `UPDATE_STATE`, `OPEN_CONFIG`, `RESET_STATS`)

#### Bước 1.3: Chạy test → PASS
```bash
node scripts/tests/extension-webview-phase1.js  # → PASS
```

---

### Phase 2: UI Template — HTML/CSS/JS [COMPLETED]

#### Bước 2.1: Viết test trước

##### [NEW] [extension-webview-phase2.js](file:///Users/lehoangthang/Documents/antigravity-auto-click/scripts/tests/extension-webview-phase2.js)
Test cases:
- HTML output chứa **2 pages** (div): `page-main` và `page-stats`
- `page-main`: đủ toggle elements cho 5 features, blacklist input, status indicator, link "Xem thống kê"
- `page-stats`: bar chart container, total clicks badge, Reset button, link "Quay lại"
- HTML output **không** chứa `performClick` toggle
- CSS file tồn tại và không rỗng
- JS file tồn tại và không rỗng

```bash
node scripts/tests/extension-webview-phase2.js  # → FAIL
```

#### Bước 2.2: Implement code

##### [NEW] [main.css](file:///Users/lehoangthang/Documents/antigravity-auto-click/src/extension/media/main.css)
- Dark theme (`--bg: #1a1b2e`, `--card: #252640`, `--accent: #6c63ff`)
- Toggle slide component (CSS-only, smooth animation 0.3s)
- Feature row: flex, icon + label + slide
- Status badge: green dot (running) / red dot (stopped)
- Blacklist section: editable text input (single line)
- **Stats page**: horizontal bar rows, gradient fills, proportional widths
- Bar gradient colors: blue→cyan (Run), green→mint (Allow), pink (Keep Waiting), lavender (Accept all)...
- Page transition: fade hoặc slide animation
- VS Code theme-aware CSS variables (`var(--vscode-*)`)

##### [NEW] [main.js](file:///Users/lehoangthang/Documents/antigravity-auto-click/src/extension/media/main.js)
- **Page navigation**: show/hide `page-main` ↔ `page-stats` (không reload webview)
- Nhận `UPDATE_STATE` → render toggle states + blacklist + stats data
- Gửi events:
  - `TOGGLE_FEATURE` + `{ feature: 'autoRetry.enabled' }`
  - `UPDATE_BLACKLIST` + `{ value: 'rm, sudo, force' }` (toàn bộ text)
  - `RESET_STATS`
  - `OPEN_CONFIG`
- Stats rendering: nhận `byButton` data → render bar chart proportional
- Error banner rendering khi config corrupt

#### Bước 2.3: Chạy test → PASS
```bash
node scripts/tests/extension-webview-phase2.js  # → PASS
```

#### UI Layout (chốt cuối cùng — 2 pages):

**📄 Page Main (mặc định):**
```
┌─────────────────────────────────────────┐
│  ⚡ Auto Click              ● Đang chạy │  ← Status header
├─────────────────────────────────────────┤
│                                         │
│  🔄 Auto Retry               [====ON ] │  ← Toggle slide
│  ✅ Auto Accept               [====ON ] │
│                                         │
│  ─── Categories ───                     │
│  💻 Terminal                  [====ON ] │
│  📝 Review Change             [====ON ] │
│  🔒 System Review            [ OFF===] │
│                                         │
│  ─── Blacklist ───                      │
│  ┌─────────────────────────────────┐    │
│  │ rm, sudo, force, push, delete  │    │  ← Editable text field
│  └─────────────────────────────────┘    │
│  Sửa trực tiếp text để thêm/bớt        │
│                                         │
├─────────────────────────────────────────┤
│  📊 Xem thống kê       ⚙️ Mở config    │  ← Click để chuyển trang
└─────────────────────────────────────────┘
```

**📊 Page Stats (sau khi click "Xem thống kê"):**
```
┌─────────────────────────────────────────┐
│  ← Quay lại          📊 Click Stats    │  ← Back link + title
│                           🔄 50 clicks  │  ← Total badge
├─────────────────────────────────────────┤
│                                         │
│        Run  ████████████████████░░  20  │  ← Blue→cyan gradient bar
│      Allow  ██████████████████████  26  │  ← Green→mint gradient bar
│ Always Allow  ░░░░░░░░░░░░░░░░░░░   0  │  ← Empty bar (dark bg)
│ Keep Waiting  ███░░░░░░░░░░░░░░░░   3  │  ← Pink gradient bar
│      Retry  ░░░░░░░░░░░░░░░░░░░░░   0  │
│   Continue  ░░░░░░░░░░░░░░░░░░░░░   0  │
│ Allow Once  ░░░░░░░░░░░░░░░░░░░░░   0  │
│ Allow This  ░░░░░░░░░░░░░░░░░░░░░   0  │
│ Accept all  █░░░░░░░░░░░░░░░░░░░░   1  │  ← Lavender bar
│                                         │
│              [🔄 Reset]                 │  ← Reset stats button
│                                         │
└─────────────────────────────────────────┘
```

> [!NOTE]
> - **Perform Click** không hiển thị trên UI. Chỉ sửa qua `config.json` → `autoAccept.performClick`.
> - **Click Stats** đọc dữ liệu từ `activity-log.json` → field `clickedByButton`. Cần mở rộng `activity-store.js` để track theo button name (xem Phase 2.5).

---

### Phase 2.5: Activity Store Enhancement — Button-level Tracking [COMPLETED]

> [!IMPORTANT]
> Hiện tại `activity-store.js` chỉ track theo **category** (`clickedByCategory`), chưa track theo **button name**. Ảnh tham chiếu cần stats per button (Run, Allow, Retry...), nên cần mở rộng data model.

#### Bước 2.5.1: Viết test trước

##### [NEW] [extension-webview-phase2-5.js](file:///Users/lehoangthang/Documents/antigravity-auto-click/scripts/tests/extension-webview-phase2-5.js)
Test cases:
- `activity-log.json` chứa field mới `clickedByButton` (object)
- `ACCEPT_CLICKED` log có button name → `clickedByButton["Run"]++`
- `RETRY_CLICKED` log → `clickedByButton["Retry"]++`
- `summarizeActivity()` trả về `byButton` object
- Reset stats xoá toàn bộ activity-log và trả về initial state

```bash
node scripts/tests/extension-webview-phase2-5.js  # → FAIL
```

#### Bước 2.5.2: Implement code

##### [MODIFY] [activity-store.js](file:///Users/lehoangthang/Documents/antigravity-auto-click/src/core/activity-store.js)
- Thêm `clickedByButton: {}` vào `_getInitialActivity().accept` và `_getInitialActivity().retry`
- Trong `update()`: khi `ACCEPT_CLICKED` hoặc `RETRY_CLICKED`, extract button name từ log text → increment `clickedByButton[buttonName]`
- Log format cần bổ sung: `[STAT] ACCEPT_CLICKED:terminal button=Run`

##### [MODIFY] [activity-service.js](file:///Users/lehoangthang/Documents/antigravity-auto-click/src/extension/activity-service.js)
- `summarizeActivity()` trả thêm `byButton: {}` — merge `retry.clickedByButton` + `accept.clickedByButton`
- Thêm function `resetActivity()` — ghi initial state vào activity-log.json

#### Bước 2.5.3: Chạy test → PASS
```bash
node scripts/tests/extension-webview-phase2-5.js  # → PASS
```

---

### Phase 3: Message Passing & State Sync

#### Bước 3.1: Viết test trước

##### [NEW] [extension-webview-phase3.js](file:///Users/lehoangthang/Documents/antigravity-auto-click/scripts/tests/extension-webview-phase3.js)
Test cases:
- `TOGGLE_FEATURE` với `autoRetry.enabled` → config file thay đổi đúng field
- `TOGGLE_FEATURE` với `autoAccept.categories.terminal.enabled` → config file thay đổi đúng nested field
- `UPDATE_BLACKLIST` với `"rm, sudo, force"` → `autoAccept.blacklist` = `["rm", "sudo", "force"]`
- `UPDATE_BLACKLIST` với `"rm, , sudo, "` (có khoảng trống) → filter đúng = `["rm", "sudo"]`
- `systemReview` toggle cần confirmation (safety gate)
- Config file watcher: ghi file → trigger `_updateWebview()`

```bash
node scripts/tests/extension-webview-phase3.js  # → FAIL
```

#### Bước 3.2: Implement code

##### [MODIFY] [webview-provider.js](file:///Users/lehoangthang/Documents/antigravity-auto-click/src/extension/webview-provider.js)

**Message handlers:**

| Message Type | Action |
|-------------|--------|
| `TOGGLE_FEATURE` | Parse feature path → `updateConfig()` → `syncDaemonWithConfig()` → `_updateWebview()` |
| `UPDATE_BLACKLIST` | Split text by comma → trim → filter empty → ghi vào `autoAccept.blacklist` → save → refresh |
| `RESET_STATS` | Gọi `resetActivity()` → `_updateWebview()` |
| `OPEN_CONFIG` | Execute `openConfig` command |

**Safety gate:**
- Toggle `systemReview` → show `vscode.window.showWarningMessage` confirmation trước khi bật

**File watcher:**
- `config.json` thay đổi từ bên ngoài → đọc lại → `_updateWebview()`
- `activity-log.json` thay đổi → đọc lại → `_updateWebview()` (stats live update)

#### Bước 3.3: Chạy test → PASS
```bash
node scripts/tests/extension-webview-phase3.js  # → PASS
```

---

### Phase 4: Integration & Polish

#### Bước 4.1: Viết test trước

##### [NEW] [extension-webview-phase4.js](file:///Users/lehoangthang/Documents/antigravity-auto-click/scripts/tests/extension-webview-phase4.js)
Test cases:
- QuickPick commands vẫn hoạt động (backward compatible)
- `refreshStatusBar()` cũng trigger `refreshWebview()`
- Existing extension tests vẫn pass (regression)

```bash
node scripts/tests/extension-webview-phase4.js  # → FAIL
```

#### Bước 4.2: Implement code

##### [MODIFY] [extension.js](file:///Users/lehoangthang/Documents/antigravity-auto-click/src/extension/extension.js)
- QuickPick commands **giữ nguyên** (backward compatible)
- `refreshStatusBar()` cũng trigger `refreshWebview()` nếu webview đang mở
- Status bar click → focus panel webview thay vì mở QuickPick

#### Bước 4.3: Chạy test → PASS
```bash
node scripts/tests/extension-webview-phase4.js  # → PASS
```

---

### Phase 5: Final Integration & Visual Verification

#### Chạy toàn bộ test suite
```bash
node scripts/tests/run-extension-tests.js
```
- Tất cả phase 1–4 tests PASS
- Không regression với tests cũ

#### Visual Test (thủ công)
- Mở panel → verify layout toggle slides + blacklist + Click Stats
- Bật/tắt từng toggle → verify `config.json`
- Sửa blacklist text → verify `config.json` lưu đúng array
- Sửa `config.json` tay → verify UI auto-refresh
- Click Stats bar chart hiển thị đúng tỷ lệ
- Reset stats → bars về 0, total badge về 0
- Kill daemon → verify status badge chuyển đỏ
