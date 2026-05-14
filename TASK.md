# [Orchestrator] Task Tracking

## 1. Worklog đã thực hiện

### Phase 0. Discovery + thiết kế contract

- [x] Rà lại extension cũ để xác định giới hạn kiến trúc hiện tại.
- [x] Đối chiếu `config.json`, `config.schema.json`, `src/core/config-schema.js`, CLI menu và status flow.
- [x] Chốt source of truth là `config.json` + `normalizeConfig()`.
- [x] Chốt canonical category keys:
  - `terminal`
  - `reviewChange`
  - `systemReview`
- [x] Chốt migration rules cho legacy keys:
  - `review` -> `reviewChange`
  - `system` -> `systemReview`
  - `patterns` -> `context`
  - `performClickAutoAccept` -> `autoAccept.performClick`
  - các key timing/rate-limit dạng flat -> nested `autoRetry.*`
- [x] Tạo tài liệu contract tại `src/extension/PHASE0_CONTRACT.md`.
- [x] Tạo bảng contract config/UI và migration metadata tại `src/extension/config-contract.js`.

### Phase 1. Foundation + migration layer

- [x] Tách extension thành các module riêng:
  - `src/extension/constants.js`
  - `src/extension/config-service.js`
  - `src/extension/daemon-service.js`
  - `src/extension/status-service.js`
  - `src/extension/activity-service.js`
- [x] Viết lại `src/extension/extension.js` theo kiểu bootstrap module-based.
- [x] Thêm command surface mới trong `package.json`.
- [x] Thêm extension-level settings trong `package.json`:
  - `antigravityAutoClick.extension.autoStartDaemon`
  - `antigravityAutoClick.extension.showConfigWarningsOnStartup`
- [x] Thêm config inspection và migration warnings.
- [x] Thêm safe-read for `config.json` để fail gracefully khi JSON lỗi.
- [x] Thêm normalize alias category trong `src/core/config-schema.js`.
- [x] Cập nhật `config.schema.json` để phản ánh đúng shape config hiện tại và legacy compatibility.
- [x] Giữ backward compatibility tối thiểu cho command cũ:
  - `antigravity-auto-retry.showMenu`
  - `antigravity-auto-retry.start`
  - `antigravity-auto-retry.stop`
  - `antigravity-auto-retry.editConfig`

### Phase 2. Status Bar + Command Palette + Control Center

- [x] Hoàn thiện status bar text/badge theo state thật.
- [x] Hoàn thiện control center thành bề mặt vận hành chính.
- [x] Bổ sung quick actions rõ ràng cho start/stop/reload/open logs/open config.
- [x] Hiển thị daemon state, feature state, warnings, activity summary.
- [x] Rà lại command palette flow để thao tác hằng ngày không cần mở raw config.
- [x] **Auto Test**: Tạo `scripts/tests/extension-phase2.js` để kiểm thử logic service.
- [x] **File đã chỉnh**: `src/extension/activity-service.js`, `src/extension/status-service.js`, `src/extension/extension.js`, `package.json`, `scripts/tests/extension-phase2.js`.
- [x] **Chi tiết**:
  - Sửa đường dẫn log file sang `logs/activity-log.json`.
  - Cập nhật parser cho format Object của `ActivityStore`.
  - Thêm activity summary vào Status Bar Tooltip.
  - Làm mới Control Center UI với Codicons, Separators và Quick Toggles.
  - Cải thiện hiển thị Activity Summary với chi tiết Category và Skip Reasons.

## 2. Các file đã chỉnh sửa qua các Phase

- [x] `src/core/config-schema.js` (Phase 0/1)
- [x] `src/extension/extension.js` (Phase 0/1, Phase 2)
- [x] `src/extension/constants.js` (Phase 0/1)
- [x] `src/extension/config-contract.js` (Phase 0/1)
- [x] `src/extension/config-service.js` (Phase 0/1)
- [x] `src/extension/daemon-service.js` (Phase 0/1)
- [x] `src/extension/status-service.js` (Phase 0/1, Phase 2)
- [x] `src/extension/activity-service.js` (Phase 0/1, Phase 2)
- [x] `src/extension/PHASE0_CONTRACT.md` (Phase 0)
- [x] `package.json` (Phase 1)
- [x] `config.schema.json` (Phase 1)
- [x] `implementation_plan.md` (Phase 0)
- [x] `TASK.md` (Phase 2)

## 3. Phase Implement còn lại

### Phase 3. Auto Retry Settings [x]

Step chính:
- [x] Xây dựng Validation Layer trong `config-service.js`.
  - [x] Thêm `validateConfigField(path, value)`.
  - [x] Rule `number`: Phải là số dương, `pollInterval` >= 100.
  - [x] Rule `pattern-list`: Mọi phần tử phải là Regex hợp lệ.
- [x] Triển khai giao diện Auto Retry Settings (QuickPick sub-menu).
  - [x] Command `antigravity.openAutoRetrySettings`.
  - [x] Menu items: Enabled, Patterns (CSV input), Timing, Rate Limit.
  - [x] Restore Defaults (reset block `autoRetry`).
- [x] Tích hợp vào Control Center.
- [x] Đồng bộ trạng thái: `refreshStatusBar()` và thông báo StatusBar.
- [x] **Auto Test**: Viết `scripts/tests/extension-phase3.js` (TDD).
- [x] Verify kết quả và checklist.

### Phase 4. Auto Accept Settings + per-category control [x]

Step chính:
- [x] Tạo UI riêng cho `Auto Accept`.
- [x] Thêm toggle:
  - [x] `autoAccept.enabled`
  - [x] `autoAccept.performClick`
- [x] Thêm chỉnh `blacklist` và `customAcceptPatterns`.
- [x] Tạo block riêng cho từng category:
  - [x] `terminal`
  - [x] `reviewChange`
  - [x] `systemReview`
- [x] Mỗi category có:
  - [x] toggle enable
  - [x] button patterns
  - [x] context patterns
- [x] Thêm warning UX cho `performClick` và `systemReview`.
- [x] **Auto Test**: Viết `scripts/tests/extension-phase4.js` (TDD).
- [x] Verify kết quả và checklist.
- [x] **Phase 5. Activity + diagnostics**
  - [x] Tạo diagnostics service và tích hợp vào extension.
  - [x] Hiển thị Activity Summary chi tiết (QuickPick).
  - [x] Hiển thị System Diagnostics (CDP, Config, Files, Logs).
  - [x] Chuẩn hóa category name normalization trong activity summary.
  - [x] **Auto Test**: Viết `scripts/tests/extension-phase5.js` (TDD).
  - [x] **File đã chỉnh**: `src/extension/activity-service.js`, `src/extension/diagnostics-service.js`, `src/extension/extension.js`, `src/extension/constants.js`, `package.json`, `scripts/tests/extension-phase5.js`.


### Phase 6. Start/stop/reload orchestration [x]

Step chính:
- [x] Chuẩn hóa contract điều khiển daemon từ extension.
- [x] Ngăn duplicate daemon process (với pgrep và state management).
- [x] Xử lý tương thích với LaunchAgent và CLI session.
- [x] Phân biệt state:
  - [x] starting
  - [x] stopping
  - [x] reloading
- [x] Chốt field nào hot-reload được, field nào cần restart daemon.
- [x] **Auto Test**: Viết `scripts/tests/extension-phase6.js` (TDD).
- [x] **Rà soát lại Phase 6**: Đã xác nhận cơ chế state management, pgrep prevention, và stop.sh integration hoạt động ổn định.

### Phase 7. Regression + compatibility [x]

Step chính:
- [x] Test lại CLI sau các thay đổi extension.
- [x] Test lại normalize với legacy config.
- [x] Test lại regression scripts liên quan.
- [x] Test edge cases:
  - [x] thiếu field
  - [x] JSON config lỗi
  - [x] regex lỗi
  - [x] blacklist rỗng
  - [x] daemon đã chạy trước khi extension activate
- [x] Đảm bảo không phá backward compatibility quan trọng.
- [x] **Auto Test**: Đã viết và chạy `scripts/tests/extension-phase7.js`.

### Phase 8. Docs + rollout [x]

Step chính:
- [x] Cập nhật `README.md`.
- [x] Cập nhật `tutorial.md`.
- [x] Viết hướng dẫn extension-first workflow.
- [x] Viết migration notes từ extension cũ.
- [x] Viết fallback flow khi extension gặp lỗi.

## 4. Guardrails khi implement tiếp

### Được sửa

- [ ] `src/extension/**`
- [ ] `package.json`
- [ ] `README.md`
- [ ] `tutorial.md`
- [ ] `implementation_plan.md`

### Chỉ sửa khi thật sự cần

- [ ] `src/core/auto-retry.js`
- [ ] `src/payload/**`
- [ ] `scripts/core/status.sh`
- [ ] `scripts/menu.sh`
- [ ] `scripts/tools/list-activity-stats.js`

### Không được sửa

- [ ] `samples/**`
- [ ] `logs/**`
- [ ] `activity-log.json`
- [ ] Không đổi semantics detection chỉ để tiện UI
- [ ] Không dùng lại legacy category names `review`, `system`
- [ ] **Bắt buộc từ Phase 3**: Viết AutoTest TRƯỚC khi implement logic.

## 5. Checklist cập nhật tài liệu theo phase

### `project-context.md`

- [x] Phase 0/1: cập nhật
- [ ] Phase 2: cập nhật nhẹ
- [ ] Phase 3: chỉ cập nhật nếu đổi cấu trúc module hoặc config contract
- [ ] Phase 4: cập nhật nhẹ
- [x] Phase 5: cập nhật
- [x] Phase 6: bắt buộc cập nhật
- [ ] Phase 7: chỉ cập nhật nếu đổi compatibility rules
- [ ] Phase 8: thường không phải điểm cập nhật chính

Vùng ưu tiên cần sửa trong `project-context.md`:
- [ ] `Current Product Direction`
- [ ] `Extension Architecture`
- [ ] `Operational Boundaries`

### `README.md`

- [ ] Không cập nhật sớm khi UI còn bootstrap
- [ ] Ưu tiên cập nhật sau Phase 2 nếu Control Center đã đủ ổn
- [ ] Hoặc cập nhật mạnh sau Phase 4 khi settings UI đã đủ rõ
- [ ] Phase 8 là điểm chốt chính

### `tutorial.md`

- [ ] Cập nhật khi flow thao tác thực tế đã ổn định
- [ ] Phase 8 là điểm chốt chính

## 6. Verify checklist tổng cho các phase sau

- [ ] UI dùng đúng canonical category keys.
- [ ] Config ghi ra luôn normalize hợp lệ.
- [ ] Không làm gãy CLI hiện có.
- [ ] Không làm gãy regression flow hiện có.
- [ ] Có bằng chứng test/log cho từng phase hoàn tất.
