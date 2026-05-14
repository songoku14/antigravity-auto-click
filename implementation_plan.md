# [Orchestrator] Implementation Plan

## 1. Mục tiêu

- Chuyển vai trò UI vận hành chính từ CLI sang Extension của Antigravity.
- Giữ nguyên `core detection`, `config schema`, `test assets`, và các cơ chế an toàn hiện có.
- Làm mới hoàn toàn lớp Extension UI để:
  - bật/tắt nhanh `Auto Retry`
  - bật/tắt nhanh `Auto Accept`
  - cấu hình riêng cho từng category `terminal`, `reviewChange`, `systemReview`
  - theo dõi trạng thái daemon, injection, activity, skip reasons
- Không triển khai tính năng mới vào payload ngoài phạm vi cần thiết để phục vụ Extension UX.

## 2. Kết quả mong muốn

- Có một Extension mới/được làm lại đóng vai trò `Control Center`.
- Người dùng có thể thao tác hằng ngày mà không cần mở CLI cho các tác vụ phổ biến.
- CLI vẫn tồn tại như fallback, dev tools, regression tools.
- Cấu hình giữa CLI và Extension không lệch nhau.
- Các category Auto Accept dùng chung đúng 1 chuẩn tên:
  - `terminal`
  - `reviewChange`
  - `systemReview`

## 3. Quyết định kiến trúc

- Không vá tiếp QuickPick/status-bar flow cũ như UI chính.
- Rewrite lớp `extension UX` và `extension state orchestration`.
- Reuse tối đa:
  - `src/core/config-schema.js`
  - `config.json`
  - `src/core/auto-retry.js`
  - payload hiện có
  - activity log / test scripts / status scripts

## 4. Phạm vi triển khai

### 4.1 Trong phạm vi

- Thiết kế lại extension package metadata.
- Thiết kế lại command surface.
- Xây `Control Center` cho vận hành.
- Thêm trang/khối cấu hình `Auto Retry`.
- Thêm trang/khối cấu hình `Auto Accept`.
- Thêm khả năng chỉnh category riêng.
- Thêm activity/diagnostics view.
- Đồng bộ config file với UI.
- Chuẩn hóa migration từ extension cũ sang model mới.
- Cập nhật tài liệu sử dụng Extension.

### 4.2 Ngoài phạm vi

- Không thay đổi thuật toán detect/click nếu không bị block bởi UI mới.
- Không thêm category Auto Accept mới ở phase đầu.
- Không thay đổi format sample DOM.
- Không thay CLI bằng extension hoàn toàn.
- Không làm wizard AI/auto-discovery pattern ở phase này.
- Không làm sync cloud/profile roaming ở phase này.

## 5. Guardrails chỉnh sửa

### 5.1 Được sửa ở đâu

- `src/extension/**`
- `package.json`
- `README.md`
- `tutorial.md`
- `implementation_plan.md`
- Có thể sửa `config.schema.json` nếu cần khai báo thêm metadata phục vụ UI validation, nhưng không đổi semantics hiện tại.
- Có thể sửa `src/core/config-schema.js` nếu chỉ để:
  - chuẩn hóa mapping config
  - thêm helper validate/serialize cho extension
  - hỗ trợ migration key cũ sang key mới

### 5.2 Chỉ được sửa khi thật sự cần

- `src/core/auto-retry.js`
- `src/payload/**`
- `scripts/core/status.sh`
- `scripts/menu.sh`
- `scripts/tools/list-activity-stats.js`

Điều kiện:
- Chỉ sửa nếu UI mới cần đọc/truyền trạng thái mà lớp hiện tại chưa expose đủ.
- Mọi thay đổi phải giữ backward compatibility cho CLI và regression flow hiện có.

### 5.3 Không được sửa ở đâu

- `samples/**` trừ khi user yêu cầu cập nhật test cases mới.
- `logs/**` trừ việc đọc để hiển thị diagnostics.
- `activity-log.json` như dữ liệu seed/demo.
- Cấu trúc logic detection trong payload chỉ để “tiện UI”.
- Không rename category:
  - không dùng lại `review`
  - không dùng lại `system`
- Không đổi contract config hiện có theo kiểu phá CLI.

### 5.4 Quy tắc cập nhật Plan
- **BẮT BUỘC**: Không được thay đổi nội dung các Phase trong `implementation_plan.md` sau khi đã chốt roadmap.
- Nếu cần bổ sung chi tiết triển khai hoặc chia nhỏ bước, phải cập nhật vào `TASK.md`.

## 6. Rủi ro chính cần kiểm soát

- Extension cũ đang lệch tên category với config hiện tại.
- UI extension có thể ghi config sai format và làm daemon lỗi.
- Start/stop daemon từ extension có thể xung đột với LaunchAgent hoặc CLI session.
- `performClick=true` có rủi ro an toàn nếu UI không cảnh báo rõ.
- Activity/diagnostics dễ bị lệch nếu extension đọc nguồn dữ liệu không đồng nhất.

## 7. Nguyên tắc thiết kế sản phẩm

- Extension là lớp điều khiển chính cho use case hằng ngày.
- CLI là fallback, debug, regression, maintenance.
- Ưu tiên thao tác nhanh:
  - 1 click mở control center
  - 1 click toggle feature
  - 1 nơi duy nhất để xem trạng thái tổng
- Safety-first:
  - mặc định observe-only nếu cần
  - cảnh báo rõ khi bật `performClick`
  - cảnh báo rõ khi bật `systemReview`
- Không duplicate nguồn sự thật:
  - config phải có 1 nguồn chính
  - UI chỉ là lớp đọc/ghi hợp lệ

## 8. Thiết kế chức năng cần chốt

### 8.1 Core surfaces

- Status Bar
- Command Palette
- Control Center
- Auto Retry Settings
- Auto Accept Settings
- Activity & Diagnostics

### 8.2 Chức năng tối thiểu bản đầu

- Xem trạng thái daemon
- Xem trạng thái CDP/debug readiness
- Start/Stop daemon
- Toggle `autoRetry.enabled`
- Toggle `autoAccept.enabled`
- Toggle `autoAccept.performClick`
- Toggle từng category
- Chỉnh blacklist
- Chỉnh button/context patterns cơ bản
- Xem activity summary
- Xem recent skip reasons
- Open raw config / logs

### 8.3 Quy định về Kiểm thử (AutoTest)

> [!IMPORTANT]
> **Từ Phase 3 trở đi, quy trình bắt buộc là: Viết AutoTest TRƯỚC khi implement logic (Test-Driven Development style).**
> - Phải tạo/cập nhật file test trong `scripts/tests/` phản ánh các yêu cầu của phase.
> - Chạy test (kỳ vọng fail) sau đó mới viết logic để test pass.
> - Đảm bảo không có hồi quy (regression) cho các service đã ổn định.

## 9. Kế hoạch triển khai theo phase

### Phase 0. Discovery + thiết kế contract

Mục tiêu:
- Chốt contract Extension mới trước khi code.

Việc cần làm:
- Đọc lại extension cũ, config schema, CLI settings flow.
- Chốt 1 bảng mapping giữa:
  - UI fields
  - config keys
  - default values
  - validation rules
- Chốt source of truth:
  - ưu tiên `config.json`
  - extension đọc/ghi qua helper chung
- Chốt event flow:
  - activate
  - read config
  - render status
  - update config
  - restart/reload daemon nếu cần

Deliverables:
- Bảng mapping config-to-UI
- Danh sách command IDs mới
- Quyết định state model extension

Checklist verify:
- [ ] Mọi field trong UI map được tới key config cụ thể.
- [ ] Không còn key mơ hồ kiểu `review`/`system`.
- [ ] Có rule rõ field nào đổi xong cần restart daemon, field nào chỉ hot-reload.
- [ ] Có rule validation cho boolean/number/pattern arrays/blacklist.

### Phase 1. Foundation + migration layer

Mục tiêu:
- Dựng lại bộ khung extension và lớp config an toàn.

Việc cần làm:
- Cập nhật `package.json`:
  - commands
  - menus nếu cần
  - configuration contributes
  - activation events phù hợp
- Tách extension code thành module rõ ràng:
  - config service
  - daemon service
  - status service
  - activity service
  - UI entrypoints
- Thêm migration helper:
  - map legacy category keys
  - normalize config trước khi render
  - chặn ghi config sai schema

Deliverables:
- Extension bootstrap mới
- Config read/write/normalize layer mới
- Migration notes

Checklist verify:
- [ ] Extension activate không crash khi `config.json` cũ tồn tại.
- [ ] Legacy config đọc vào được normalize đúng schema hiện tại.
- [ ] Config invalid không làm hỏng toàn bộ extension.
- [ ] Không có ghi đè mất dữ liệu custom patterns/blacklist.
- [ ] Không thay semantics của CLI hiện tại.

### Phase 2. Status Bar + Command Palette + Control Center

Mục tiêu:
- Có điểm vào chính để vận hành hằng ngày.

Việc cần làm:
- Thiết kế status bar text/badge:
  - daemon state
  - feature badge `R`, `A:t,r,s`
- Thêm commands:
  - open control center
  - start daemon
  - stop daemon
  - reload daemon
  - toggle retry
  - toggle accept
  - open logs
  - open config
- Xây Control Center:
  - daemon state
  - debug port/detection state
  - last activity / last inject
  - quick toggles
  - quick actions

Deliverables:
- Status bar mới
- Control Center hoạt động
- Command surface đầy đủ

Checklist verify:
- [ ] Status bar hiển thị đúng khi daemon ON/OFF.
- [ ] Badge category phản ánh đúng config thật.
- [ ] Toggle từ command palette cập nhật ngay UI.
- [ ] Control Center mở được từ status bar và command palette.
- [ ] Không cần mở raw config để bật/tắt các tác vụ phổ biến.

### Phase 3. Auto Retry Settings

Mục tiêu:
- Quản trị đầy đủ `Auto Retry` trong extension.

Việc cần làm:
- Thêm UI chỉnh các field: `enabled`, `patterns`, `timing`, `rateLimit`.
- Thêm validate input số và regex string list.
- Thêm action restore defaults cho Retry block.

Deliverables:
- Retry settings UI
- Retry validation rules

Checklist verify:
- [ ] Bật/tắt Retry từ UI ghi đúng `config.json`.
- [ ] Regex list hợp lệ được lưu nguyên vẹn.
- [ ] Regex lỗi không làm hỏng extension; có thông báo rõ.
- [ ] Numeric fields không nhận giá trị âm/NaN nếu không hợp lệ.
- [ ] Restore defaults chỉ reset block Retry.

### Phase 4. Auto Accept Settings + per-category control

Mục tiêu:
- Quản trị đúng domain Auto Accept với từng category riêng.

Việc cần làm:
- Thêm UI chỉnh:
  - `autoAccept.enabled`
  - `autoAccept.performClick`
  - `autoAccept.blacklist`
  - `autoAccept.customAcceptPatterns`
- Thêm khối riêng cho từng category:
  - `terminal`
  - `reviewChange`
  - `systemReview`
- Mỗi category có:
  - toggle enable
  - button patterns
  - context patterns
  - help text giải thích hành vi
- Thêm warning UX:
  - khi bật `performClick`
  - khi bật `systemReview`
  - khi blacklist trống hoặc yếu

Deliverables:
- Accept settings UI
- Category cards/panels
- Safety prompts

Checklist verify:
- [ ] Toggle master Accept không làm mất trạng thái category con.
- [ ] Toggle category ghi đúng key schema hiện tại.
- [ ] `terminal`, `reviewChange`, `systemReview` hiển thị đúng tên và đúng dữ liệu.
- [ ] Bật `performClick` có xác nhận hoặc cảnh báo rõ.
- [ ] Blacklist sửa từ UI được daemon đọc đúng.
- [ ] Không còn hardcode legacy keys `review` hoặc `system`.

### Phase 5. Activity + diagnostics

Mục tiêu:
- Đưa các thông tin quan sát chính từ CLI sang extension.

Việc cần làm:
- Hiển thị summary:
  - retry clicked
  - accept clicked
  - clicks by category
  - skip reasons
- Hiển thị recent events/log snippets.
- Hiển thị diagnostics:
  - daemon running?
  - config valid?
  - debug port detected?
  - last inject time?
- Xác định data source:
  - log file
  - activity log
  - status command
  - daemon in-memory output

Deliverables:
- Activity panel/tab
- Diagnostics panel/tab

Checklist verify:
- [ ] Activity numbers không lệch rõ so với CLI stats hiện có.
- [ ] Category stats tách đúng `terminal/reviewChange/systemReview`.
- [ ] Khi daemon dừng, diagnostics phản ánh ngay.
- [ ] Có đường dẫn rõ để mở logs/raw data khi cần debug sâu.
- [ ] Nếu dữ liệu vắng, UI hiển thị empty state rõ ràng.

### Phase 6. Start/stop/reload orchestration

Mục tiêu:
- Điều khiển daemon an toàn từ extension.

Việc cần làm:
- Xác định rõ:
  - start bằng process spawn nội bộ
  - stop bằng script hay by pid
  - reload config thế nào
- Chốt tương thích với:
  - LaunchAgent
  - session do CLI start
  - session do extension start
- Ngăn duplicate daemon.
- Thêm trạng thái đang xử lý:
  - starting
  - stopping
  - reloading

Deliverables:
- Daemon orchestration contract
- UX trạng thái chuyển tiếp

Checklist verify:
- [ ] Start từ extension không tạo process trùng.
- [ ] Stop từ extension không để UI báo sai trạng thái.
- [ ] Reload config không cần restart toàn bộ nếu logic hỗ trợ.
- [ ] Trường hợp start lỗi có error message rõ.
- [ ] Không phá workflow LaunchAgent hiện tại.

### Phase 7. Regression + compatibility

Mục tiêu:
- Đảm bảo extension mới không làm gãy hệ thống cũ.

Việc cần làm:
- Test lại CLI sau thay đổi.
- Test lại regression samples.
- Test migration từ config hiện tại.
- Test các edge cases:
  - thiếu field
  - field legacy
  - regex lỗi
  - blacklist rỗng
  - daemon đang chạy trước khi extension activate

Deliverables:
- Test evidence
- Compatibility notes

Checklist verify:
- [ ] `npm test` hoặc regression script liên quan pass.
- [ ] CLI menu vẫn đọc đúng config sau thay đổi.
- [ ] Status script vẫn báo đúng trạng thái chính.
- [ ] Extension mới không làm hỏng config cũ của user.
- [ ] Edge cases có hành vi fail gracefully.

### Phase 8. Docs + rollout

Mục tiêu:
- Hoàn thiện tài liệu và hướng dẫn chuyển đổi sang extension-first workflow.

Việc cần làm:
- Cập nhật `README.md`
- Cập nhật `tutorial.md`
- Viết phần:
  - dùng extension để vận hành hằng ngày
  - khi nào dùng CLI
  - lưu ý safety cho `performClick`
  - migration notes từ extension cũ

Deliverables:
- README mới
- Tutorial mới

Checklist verify:
- [ ] README mô tả đúng UI và flow mới.
- [ ] Tutorial có đủ bước cho user mới.
- [ ] Có phần fallback khi extension gặp lỗi.
- [ ] Tài liệu không còn mô tả extension cũ như UI chính.

## 10. Danh sách chức năng cần verify sau khi hoàn tất

### 10.1 Control Center

- [ ] Mở được từ status bar.
- [ ] Mở được từ command palette.
- [ ] Hiển thị daemon state đúng.
- [ ] Hiển thị feature state đúng.
- [ ] Có quick actions đủ dùng.

### 10.2 Auto Retry

- [ ] Toggle được.
- [ ] Sửa timing được.
- [ ] Sửa rate limit được.
- [ ] Sửa pattern được.
- [ ] Validate sai thì không ghi bừa.

### 10.3 Auto Accept

- [ ] Toggle master được.
- [ ] Toggle `performClick` được.
- [ ] Sửa blacklist được.
- [ ] Sửa custom patterns được.
- [ ] Có cảnh báo khi bật chế độ nguy hiểm.

### 10.4 Categories

- [ ] `terminal` toggle được.
- [ ] `reviewChange` toggle được.
- [ ] `systemReview` toggle được.
- [ ] Mỗi category sửa button/context riêng được.
- [ ] Không category nào bị map sai key.

### 10.5 Diagnostics

- [ ] Xem logs được.
- [ ] Xem recent events được.
- [ ] Xem stats theo category được.
- [ ] Xem skip reasons được.
- [ ] Empty/error states rõ ràng.

### 10.6 Compatibility

- [ ] CLI vẫn dùng được.
- [ ] LaunchAgent flow không vỡ.
- [ ] Config cũ được normalize.
- [ ] Extension cũ key naming không còn gây lỗi.

## 11. Chấp nhận kỹ thuật

Một bản triển khai chỉ được coi là đạt nếu:
- Không còn mismatch category names giữa UI và config.
- Không còn phụ thuộc vào QuickPick như UI quản trị chính.
- Không yêu cầu user chỉnh `config.json` cho các tác vụ phổ biến.
- Không làm gãy CLI hiện có.
- Có ít nhất một bề mặt diagnostics để debug khi automation không chạy.

## 12. Bằng chứng cần thu khi triển khai xong

- Ảnh/chứng cứ trạng thái status bar.
- Log command hoặc output xác nhận daemon start/stop đúng.
- Kết quả test regression liên quan.
- So sánh config trước/sau migration.
- Minh chứng UI chỉnh được từng category.

## 13. Quy tắc cập nhật tài liệu theo phase

### 13.1 `project-context.md`

Cần cập nhật khi phase làm thay đổi một trong các nhóm sau:
- kiến trúc extension
- trách nhiệm giữa các module/service
- boundary giữa CLI / extension / daemon
- source of truth của config
- compatibility / migration rules
- orchestration daemon / LaunchAgent / CLI interaction

Áp dụng cho roadmap hiện tại:
- Phase 2:
  - cập nhật nhẹ
  - vì Control Center và command surface chuyển từ bootstrap sang UX chính thức
- Phase 3:
  - thường không bắt buộc
  - chỉ cập nhật nếu cấu trúc module/config contract đổi
- Phase 4:
  - cập nhật nhẹ
  - vì Auto Accept per-category là bề mặt sản phẩm quan trọng
- Phase 5:
  - nên cập nhật
  - vì có activity/diagnostics architecture
- Phase 6:
  - bắt buộc cập nhật
  - vì orchestration daemon là kiến trúc vận hành
- Phase 7:
  - chỉ cập nhật nếu compatibility rules thay đổi
- Phase 8:
  - thường không phải điểm cập nhật chính cho `project-context.md`

Nguyên tắc thực hiện:
- không rewrite toàn file mỗi phase
- ưu tiên cập nhật các mục:
  - `Current Product Direction`
  - `Extension Architecture`
  - `Operational Boundaries`

### 13.2 `README.md` và `tutorial.md`

- `README.md` là tài liệu user-facing:
  - không nên cập nhật sớm khi UI còn bootstrap hoặc chưa ổn định
  - nên cập nhật mạnh sau Phase 2 hoặc Phase 4
- `tutorial.md` nên cập nhật khi đã có flow thao tác đủ ổn để hướng dẫn user thật
- Phase 8 là điểm chốt chính cho `README.md` và `tutorial.md`

## 14. Checklist DOD cuối cùng

### Developer

- [ ] Mã nguồn đã được viết đúng logic và tối ưu.
- [ ] Không có lỗi cú pháp hoặc lỗi logic hiển nhiên.
- [ ] Tuân thủ tiêu chuẩn code (Vanilla JS, Non-blocking).

### Tech Leader

- [ ] Đã thực hiện review mã nguồn chi tiết.
- [ ] Đã xác nhận kiến trúc an toàn và hiệu quả.
- [ ] Đã kiểm tra tính bảo mật (đặc biệt là các lệnh terminal).

### Tester

- [ ] Đã chạy các script test liên quan.
- [ ] Có bằng chứng log/output xác nhận test thành công.
- [ ] Đã kiểm tra các trường hợp biên.

### Docs-Agent

- [ ] Cập nhật `README.md` nếu có thay đổi tính năng/kiến trúc.
- [ ] Cập nhật `tutorial.md` với hướng dẫn sử dụng mới.
- [ ] Đã được review tài liệu theo phong cách tối giản.

### Orchestrator

- [ ] Đối chiếu kết quả cuối với yêu cầu ban đầu của user.
- [ ] Đảm bảo daemon hoạt động ổn định với cấu hình mới.
- [ ] Báo cáo kết quả kèm bằng chứng cụ thể.

## 15. Thứ tự thực hiện đề xuất

1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 3
5. Phase 4
6. Phase 6
7. Phase 5
8. Phase 7
9. Phase 8

Lý do:
- Phải dựng foundation và control flow trước.
- Activity/diagnostics nên làm sau khi orchestration và config flow đã ổn.
- Docs chỉ chốt sau khi hành vi thật đã ổn định.

## 16. Tiêu chí dừng để xin xác nhận tiếp

Sau khi plan này được user duyệt:
- mới bắt đầu implementation
- implementation phải đi theo phase
- nếu phát hiện cần sửa sâu vào `src/core/auto-retry.js` hoặc `src/payload/**` ngoài dự kiến, phải báo lại rõ phạm vi impact trước khi làm tiếp

---

**Trạng thái hiện tại:** Plan đã sẵn sàng để phê duyệt triển khai.
