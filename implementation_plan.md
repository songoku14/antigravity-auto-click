# Refactor Plan: Đưa toàn bộ config Auto Retry / Auto Accept ra config

## 1. Mục tiêu
- Chuẩn hóa toàn bộ cấu hình `Auto Retry` và `Auto Accept` vào `config.json` + lớp đọc config trung tâm.
- Lấy hành vi đang chạy trong `src/payload/injection-payload.js` làm nguồn sự thật, không lấy schema cũ trong `config.json` làm chuẩn.
- Giữ nguyên behavior detection/click hiện tại trước khi refactor.
- Kiểm tra và cập nhật lại các nơi hiển thị trạng thái (`scripts/core/status.sh`, `scripts/menu.sh`, VS Code extension) để phản ánh schema mới.
- Không xử lý sample lỗi đã biết `Accept_all(Complex_do_not_reconize)_1778631735007` trong pha này.

## 2. Hiện trạng đã xác nhận

### 2.1. Auto Retry
- Payload đang hardcode trong code:
  - `dialogContainerSelectors`
  - `errorPatterns`
  - `retryButtonPatterns`
  - `retryContextPatterns`
  - `maxRetriesPerMinute`
  - `cooldownMs`
- Payload chỉ lấy một phần từ config:
  - `autoRetry`
  - `pollInterval`
  - `clickDelay`
  - `minClickInterval`
  - `customRetryPatterns`

### 2.2. Auto Accept
- `config.json` hiện có `autoAccept.categories.*.patterns`, nhưng payload thực tế không dùng field này.
- Payload thực tế đang dùng schema ngầm trong code:
  - `actionCategories.<category>.buttons`
  - `actionCategories.<category>.context`
  - `performClickAutoAccept`
  - `blacklist`
- Categories hiện hành trong code:
  - `terminal`
  - `review`
  - `system`
- Nút bấm và context hiện được quyết định bởi hardcode trong payload, không phải bởi config hiện tại.

### 2.3. Trạng thái / CLI / UI
- `scripts/core/status.sh`, `scripts/menu.sh`, `src/extension/extension.js` mới hiểu schema bật/tắt tổng quát:
  - `autoRetry`
  - `autoAccept.enabled`
  - `autoAccept.categories.<cat>.enabled`
- Các thành phần này chưa đọc hoặc hiển thị phần config detection/pattern/rate-limit mới nếu ta đưa hết ra config.

## 3. Nguồn sự thật cần preserve
- Hành vi đang chạy trong payload là chuẩn cho pha refactor này.
- Các regex / selector / category hiện có trong payload phải được chuyển nguyên trạng ra config mặc định.
- Mọi giá trị đang dùng implicit default trong code phải được gom thành default config tập trung để:
  - payload chỉ làm nhiệm vụ consume config
  - CLI / extension có thể đọc cùng một schema
  - test regression không đổi hành vi

## 4. Schema config mục tiêu

### 4.1. Hướng thiết kế
- Tạo schema rõ ràng theo nhóm tính năng, ví dụ:
  - `autoRetry.enabled`
  - `autoRetry.dialogContainerSelectors`
  - `autoRetry.retryButtonPatterns`
  - `autoRetry.retryContextPatterns`
  - `autoRetry.errorPatterns`
  - `autoRetry.rateLimit.maxRetriesPerMinute`
  - `autoRetry.rateLimit.cooldownMs`
  - `autoRetry.timing.pollInterval`
  - `autoRetry.timing.clickDelay`
  - `autoRetry.timing.minClickInterval`
  - `autoRetry.customRetryPatterns`
  - `autoAccept.enabled`
  - `autoAccept.performClick`
  - `autoAccept.blacklist`
  - `autoAccept.customAcceptPatterns`
  - `autoAccept.categories.<cat>.enabled`
  - `autoAccept.categories.<cat>.buttons`
  - `autoAccept.categories.<cat>.context`
- Có thể giữ compatibility layer với schema cũ:
  - `autoRetry: true/false`
  - `performClickAutoAccept`
  - `blacklist`
  - `pollInterval`
  - `clickDelay`
  - `minClickInterval`
  - `autoAccept.categories.<cat>.patterns`

### 4.2. Quy tắc tương thích ngược
- Nếu config mới có mặt: ưu tiên config mới.
- Nếu config mới chưa có: fallback sang field cũ để không làm hỏng môi trường hiện tại.
- `patterns` cũ của Auto Accept cần được ánh xạ sang `context` nếu chưa có `context`.
- `performClickAutoAccept` cũ cần được ánh xạ sang `autoAccept.performClick`.
- `blacklist` root cần được ánh xạ sang `autoAccept.blacklist`.
- `pollInterval` / `clickDelay` / `minClickInterval` root cần được ánh xạ sang `autoRetry.timing.*`.

## 5. Phạm vi sửa mã nguồn

### Step 1. Tạo lớp normalize config dùng chung
- Cập nhật `src/core/config-store.js` để:
  - khai báo default config đầy đủ theo schema mới
  - normalize config cũ sang schema mới khi load
  - export ra object nhất quán cho daemon/payload
- Cân nhắc tách helper normalize sang module riêng nếu cần dùng lại ở extension.

### Step 2. Refactor payload để chỉ consume config đã normalize
- Cập nhật `src/payload/injection-payload.js`:
  - bỏ hardcode selector/pattern/category/rate-limit ra khỏi thân payload
  - chỉ giữ fallback tối thiểu nếu config lỗi
  - đọc `autoRetry` và `autoAccept` từ schema mới
  - thay logic `performClickAutoAccept`, `blacklist`, category matching sang config normalized
- Giữ nguyên thứ tự ưu tiên detection/click hiện tại.

### Step 3. Đồng bộ `config.json`
- Viết lại `config.json` mẫu theo schema mới và giá trị đang chạy thực tế.
- Giữ hoặc chú thích rõ các field legacy nếu còn cần cho compatibility giai đoạn chuyển tiếp.

### Step 4. Đồng bộ CLI / extension status
- Rà `scripts/core/status.sh`
  - đọc đúng `autoRetry.enabled` / `autoAccept.enabled`
  - fallback sang boolean schema cũ khi cần
  - không báo sai trạng thái khi config đã migrate
- Rà `scripts/menu.sh`
  - toggle đúng field mới
  - nếu menu vẫn chỉ hỗ trợ on/off thì phải ghi vào schema mới
  - giữ hiển thị category enable đúng
- Rà `src/extension/extension.js`
  - đọc/ghi đúng schema mới
  - không tiếp tục tạo ra object `patterns` cũ nếu đã chuyển schema

### Step 5. Cập nhật test / verify
- Điều chỉnh các test/unit helpers nếu đang khởi tạo config theo schema cũ.
- Chạy regression để xác nhận behavior không đổi trên sample hiện có.
- Chấp nhận duy nhất failure đã biết:
  - `Accept_all(Complex_do_not_reconize)_1778631735007`

## 6. Rủi ro kỹ thuật cần kiểm soát
- Sai khác giữa `autoAccept.categories.*.patterns` cũ và `context` thực dùng có thể làm mất detection nếu migrate không chuẩn.
- Đổi schema quá sớm trong `menu.sh` / extension có thể làm người dùng toggle xong nhưng payload không nhận đúng.
- Root config và nested config có thể xung đột nếu không định nghĩa rõ precedence.
- Regex serialize/deserialize phải giữ nguyên semantics hiện tại.

## 7. Kế hoạch kiểm chứng sau khi code
- Chạy regression sample:
  - kỳ vọng pass toàn bộ sample cũ, ngoại trừ case đã biết.
- Kiểm tra `status.sh`:
  - config mới bật/tắt đúng
  - fallback config cũ vẫn đọc đúng
- Kiểm tra `menu.sh` / extension:
  - bật/tắt `Auto Retry`
  - bật/tắt master `Auto Accept`
  - bật/tắt category `terminal/review/system`
- Kiểm tra payload dry-run:
  - `window.__analyzeDialog()` vẫn trả action/category như trước trên sample đại diện.

## 8. File dự kiến tác động
- `src/core/config-store.js`
- `src/payload/injection-payload.js`
- `config.json`
- `scripts/core/status.sh`
- `scripts/menu.sh`
- `src/extension/extension.js`
- Có thể gồm test/script liên quan nếu cần cập nhật bootstrap config.

## 9. Ngoài phạm vi pha này
- Không sửa heuristic cho sample lỗi đã biết `Accept_all(Complex_do_not_reconize)_1778631735007`.
- Không mở rộng category mới nếu chưa có nhu cầu thực tế.
- Không thay đổi kiến trúc daemon/CDP ngoài phần consume config.

## 10. Điểm dừng bắt buộc
- Chưa thực hiện code refactor.
- Chưa chạy test.
- Chờ người dùng xác nhận plan trước khi chuyển sang pha triển khai.

Dừng lại chờ xác nhận từ người dùng.
