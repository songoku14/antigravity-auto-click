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
- [x] Thêm safe-read cho `config.json` để fail gracefully khi JSON lỗi.
- [x] Thêm normalize alias category trong `src/core/config-schema.js`.
- [x] Cập nhật `config.schema.json` để phản ánh đúng shape config hiện tại và legacy compatibility.
- [x] Giữ backward compatibility tối thiểu cho command cũ:
  - `antigravity-auto-retry.showMenu`
  - `antigravity-auto-retry.start`
  - `antigravity-auto-retry.stop`
  - `antigravity-auto-retry.editConfig`
- [x] Chạy verify hẹp:
  - syntax check các module chính
  - smoke test `normalizeConfig()`
  - smoke test `inspectConfig()`

## 2. File đã chỉnh ở Phase 0/1

- [x] `src/core/config-schema.js`
- [x] `src/extension/extension.js`
- [x] `src/extension/constants.js`
- [x] `src/extension/config-contract.js`
- [x] `src/extension/config-service.js`
- [x] `src/extension/daemon-service.js`
- [x] `src/extension/status-service.js`
- [x] `src/extension/activity-service.js`
- [x] `src/extension/PHASE0_CONTRACT.md`
- [x] `package.json`
- [x] `config.schema.json`
- [x] `implementation_plan.md`

## 3. Cây thư mục extension mới

```text
src/
├── core/
│   └── config-schema.js
└── extension/
    ├── PHASE0_CONTRACT.md
    ├── activity-service.js
    ├── config-contract.js
    ├── config-service.js
    ├── constants.js
    ├── daemon-service.js
    ├── extension.js
    └── status-service.js
```

### `src/core/config-schema.js`

- Vai trò:
  - nguồn normalize config dùng chung cho CLI, daemon, extension
  - xử lý backward compatibility cho config cũ
- Những gì đã bổ sung:
  - alias category `review -> reviewChange`
  - alias category `system -> systemReview`
  - normalize raw categories về canonical keys
  - merge dữ liệu legacy để không mất `buttons/context/patterns`
- Ý nghĩa:
  - đây là lớp “sự thật nghiệp vụ” cho config
  - UI extension không được tự nghĩ logic mapping riêng ngoài file này

### `src/extension/PHASE0_CONTRACT.md`

- Vai trò:
  - tài liệu kỹ thuật chốt contract của Phase 0
- Nội dung chính:
  - source of truth là `config.json`
  - canonical category keys
  - migration rules
  - hướng triển khai UI theo phase
  - guardrails không phá core detection
- Ý nghĩa:
  - file này dùng để giữ thống nhất team/agent trước khi làm tiếp các phase UI

### `src/extension/constants.js`

- Vai trò:
  - chứa constants dùng chung cho extension
- Nội dung chính:
  - command ids mới
  - priority cho status bar
- Ý nghĩa:
  - tránh hardcode command string rải rác nhiều nơi
  - giúp đổi command surface có kiểm soát

### `src/extension/config-contract.js`

- Vai trò:
  - mô tả contract giữa config và UI
- Nội dung chính:
  - metadata cho từng category
  - danh sách field definitions
  - default values lấy từ `DEFAULT_CONFIG`
  - migration rules ở mức UI/config semantics
- Ý nghĩa:
  - là cầu nối giữa `config-schema` và các màn hình UI phase sau
  - giúp biết field nào thuộc surface nào: `controlCenter`, `autoRetry`, `autoAccept`, `autoAcceptCategory`

### `src/extension/config-service.js`

- Vai trò:
  - service đọc/ghi/inspect config cho extension
- Trách nhiệm:
  - tìm `config.json`
  - đọc raw config
  - fallback an toàn nếu JSON lỗi
  - normalize trước khi trả ra cho UI
  - ghi config đã normalize
  - cung cấp warnings migration/config invalid
  - mở file config trong editor khi cần
- Ý nghĩa:
  - đây là cổng duy nhất extension nên dùng để chạm vào config
  - giúp phase sau không ghi config bừa bãi

### `src/extension/daemon-service.js`

- Vai trò:
  - service điều khiển lifecycle daemon từ extension
- Trách nhiệm:
  - start daemon
  - stop daemon
  - reload daemon
  - giữ state đang chạy trong phạm vi extension
  - stream stdout/stderr vào output channel
- Ý nghĩa:
  - tách orchestration process ra khỏi UI
  - phase sau có thể mở rộng thêm trạng thái `starting/stopping/reloading`

### `src/extension/status-service.js`

- Vai trò:
  - build dữ liệu hiển thị cho status bar
- Trách nhiệm:
  - tổng hợp feature summary
  - map category sang badge ngắn `t/r/s`
  - sinh text và tooltip theo config + daemon state
- Ý nghĩa:
  - gom logic hiển thị status vào 1 nơi
  - tránh để `extension.js` tự xử lý text formatting quá nhiều

### `src/extension/activity-service.js`

- Vai trò:
  - service đọc và tóm tắt `activity-log.json`
- Trách nhiệm:
  - đọc activity log
  - parse an toàn
  - tổng hợp số liệu retry/accept/category
- Ý nghĩa:
  - là foundation cho Phase 5 Activity + Diagnostics
  - hiện mới ở mức summary, chưa phải analytics đầy đủ

### `src/extension/extension.js`

- Vai trò:
  - entry point chính của extension
- Trách nhiệm:
  - activate extension
  - khởi tạo output channel, status bar, services
  - register command handlers
  - bootstrap control-center flow tạm thời ở Phase 1
  - refresh status bar
  - bridge giữa commands và các services
- Ý nghĩa:
  - đây là file orchestration cấp cao
  - file này không nên chứa logic config/process/activity chi tiết nữa

## 4. Luồng dữ liệu extension

```text
config.json
   │
   ▼
src/core/config-schema.js
   - normalize config
   - map legacy keys
   - chuẩn hóa category names
   │
   ▼
src/extension/config-service.js
   - read raw config
   - fallback nếu JSON lỗi
   - inspect warnings
   - write normalized config
   │
   ├──────────────► src/extension/status-service.js
   │                 - build status text / tooltip
   │
   ├──────────────► src/extension/activity-service.js
   │                 - đọc activity-log
   │                 - build summary
   │
   └──────────────► src/extension/extension.js
                     - register commands
                     - khởi tạo status bar
                     - mở control center
                     - bridge UI <-> services
                        │
                        ├────────────► src/extension/daemon-service.js
                        │               - start / stop / reload daemon
                        │               - stream stdout / stderr
                        │
                        └────────────► VS Code / Antigravity Extension UI
                                        - status bar
                                        - command palette
                                        - control center
                                        - settings pages ở phase sau
```

### Ý nghĩa của luồng này

- `config-schema.js` là tầng normalize nghiệp vụ, không phải UI layer.
- `config-service.js` là gateway duy nhất để extension đọc/ghi config.
- `extension.js` chỉ nên điều phối command và UI state cấp cao.
- `daemon-service.js` và `activity-service.js` là các nhánh chức năng tách riêng khỏi UI.
- Các phase sau chỉ nên mở rộng UI và orchestration, không kéo logic detection vào extension layer nếu chưa thật sự cần.

## 5. Phase Implement còn lại

### Phase 2. Status Bar + Command Palette + Control Center

Step chính:
- [ ] Hoàn thiện status bar text/badge theo state thật.
- [ ] Hoàn thiện control center thành bề mặt vận hành chính.
- [ ] Bổ sung quick actions rõ ràng cho start/stop/reload/open logs/open config.
- [ ] Hiển thị daemon state, feature state, warnings, activity summary.
- [ ] Rà lại command palette flow để thao tác hằng ngày không cần mở raw config.

### Phase 3. Auto Retry Settings

Step chính:
- [ ] Tạo UI riêng cho `Auto Retry`.
- [ ] Thêm chỉnh sửa các pattern:
  - `errorPatterns`
  - `retryButtonPatterns`
  - `retryContextPatterns`
  - `customRetryPatterns`
- [ ] Thêm chỉnh timing:
  - `pollInterval`
  - `clickDelay`
  - `minClickInterval`
- [ ] Thêm chỉnh rate limit:
  - `maxRetriesPerMinute`
  - `cooldownMs`
- [ ] Thêm validation và restore defaults cho block Retry.

### Phase 4. Auto Accept Settings + per-category control

Step chính:
- [ ] Tạo UI riêng cho `Auto Accept`.
- [ ] Thêm toggle:
  - `autoAccept.enabled`
  - `autoAccept.performClick`
- [ ] Thêm chỉnh `blacklist` và `customAcceptPatterns`.
- [ ] Tạo block riêng cho từng category:
  - `terminal`
  - `reviewChange`
  - `systemReview`
- [ ] Thêm chỉnh `buttons` và `context` cho từng category.
- [ ] Thêm warning UX cho `performClick` và `systemReview`.

### Phase 5. Activity + diagnostics

Step chính:
- [ ] Tạo panel hoặc view cho activity.
- [ ] Hiển thị summary retry/accept.
- [ ] Hiển thị stats theo category.
- [ ] Hiển thị skip reasons / recent events.
- [ ] Hiển thị diagnostics:
  - daemon running
  - config valid
  - debug port detected
  - last inject time
- [ ] Thêm empty state và error state rõ ràng.

### Phase 6. Start/stop/reload orchestration

Step chính:
- [ ] Chuẩn hóa contract điều khiển daemon từ extension.
- [ ] Ngăn duplicate daemon process.
- [ ] Xử lý tương thích với LaunchAgent và CLI session.
- [ ] Phân biệt state:
  - starting
  - stopping
  - reloading
- [ ] Chốt field nào hot-reload được, field nào cần restart daemon.

### Phase 7. Regression + compatibility

Step chính:
- [ ] Test lại CLI sau các thay đổi extension.
- [ ] Test lại normalize với legacy config.
- [ ] Test lại regression scripts liên quan.
- [ ] Test edge cases:
  - thiếu field
  - JSON config lỗi
  - regex lỗi
  - blacklist rỗng
  - daemon đã chạy trước khi extension activate
- [ ] Đảm bảo không phá backward compatibility quan trọng.

### Phase 8. Docs + rollout

Step chính:
- [ ] Cập nhật `README.md`.
- [ ] Cập nhật `tutorial.md`.
- [ ] Viết hướng dẫn extension-first workflow.
- [ ] Viết migration notes từ extension cũ.
- [ ] Viết fallback flow khi extension gặp lỗi.

## 6. Guardrails khi implement tiếp

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

## 7. Checklist cập nhật tài liệu theo phase

### `project-context.md`

- [x] Phase 0/1: cập nhật
- [ ] Phase 2: cập nhật nhẹ
- [ ] Phase 3: chỉ cập nhật nếu đổi cấu trúc module hoặc config contract
- [ ] Phase 4: cập nhật nhẹ
- [ ] Phase 5: cập nhật
- [ ] Phase 6: bắt buộc cập nhật
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

## 8. Verify checklist tổng cho các phase sau

- [ ] UI dùng đúng canonical category keys.
- [ ] Config ghi ra luôn normalize hợp lệ.
- [ ] Không làm gãy CLI hiện có.
- [ ] Không làm gãy regression flow hiện có.
- [ ] Có bằng chứng test/log cho từng phase hoàn tất.
