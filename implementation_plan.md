# Debug Plan: Auto-Retry detect được card/button nhưng không click

## 1. Mục tiêu
- Xác định chính xác vì sao live flow đã detect được card + button nhưng Auto Retry không tạo ra click hiệu lực.
- Tách lỗi theo từng pha: inject -> scan -> chọn button -> pass safety gate -> click -> verify dialog biến mất.

## 2. Triệu chứng hiện tại
- Live test trên Antigravity:
  - Card mục tiêu đã được phát hiện.
  - Button mục tiêu đã được phát hiện.
  - Auto Retry vẫn không hoàn tất hành động mong muốn.
- Giả thuyết hiện tại:
  - AutoClick không chạy.
  - Hoặc click có chạy nhưng bị gate/chặn/fail silently.

## 3. Bằng chứng kỹ thuật hiện có
- `scanAndAction()` hiện đã tìm container và button trực tiếp, không còn gate `errorPatterns` ở đầu flow.
- `performClick()` có 2 tầng click:
  - `btn.click()`
  - fallback `mousedown` -> `mouseup` -> `click`
- Có nhiều gate trước khi click thực thi:
  - `canClick()`
  - `isRightSide`
  - `isVisibleAtPoint()`
  - `__clicked`
  - `disabled`
- Thành công hiện đang được xác định bằng việc button/dialog biến mất khỏi DOM sau click.

## 4. Giả thuyết ưu tiên
- H1. `scanAndAction()` detect đúng nhưng bị chặn bởi `canClick()` do cooldown/rate-limit/min interval.
- H2. Detect đúng nhưng bị chặn bởi `isRightSide` hoặc `isVisibleAtPoint()`.
- H3. `performClick()` được gọi nhưng `btn.click()` không kích hoạt handler thật của Antigravity.
- H4. Fallback mouse events không đủ dữ kiện toạ độ hoặc event chain để UI thật xử lý.
- H5. Click đã bắn nhưng logic verify đánh giá sai, khiến hệ thống tưởng click thất bại hoặc reset trạng thái không đúng.
- H6. Inject đúng vào target có console log, nhưng không phải đúng renderer đang nhận tương tác người dùng.

## 5. Kế hoạch phân tích atom

### Step 1. Xác nhận pha inject và target
- Kiểm tra daemon đang inject vào target nào (`Antigravity`, `Workbench`, `Launchpad`).
- Đối chiếu target live nơi dialog xuất hiện với target đang nhận log `[AutoRetry]`.
- Mục tiêu:
  - Loại trừ lỗi inject sai page hoặc stale target.

### Step 2. Xác nhận detect đi tới trước ngưỡng click
- Bật debug log cho live run.
- Ghi nhận đầy đủ các mốc:
  - `[STEP 1]`
  - `[STEP 2]`
  - `[STEP 3]`
  - `[STEP 4]`
  - `[STEP 5]`
- Mục tiêu:
  - Xác định flow dừng ở bước nào trước `performClick()`.

### Step 3. Kiểm tra nhóm safety gates
- Với button live đang detect được, kiểm tra:
  - `canClick()` có trả `false` không.
  - `isRightSide` có loại nhầm button không.
  - `isVisibleAtPoint()` có fail do overlay/shadow DOM/z-index không.
  - `disabled` hoặc `__clicked` có bị giữ trạng thái sai không.
- Mục tiêu:
  - Xác định có false negative trong gate logic hay không.

### Step 4. Kiểm tra click execution
- Nếu đã vào `[STEP 5]`, kiểm tra:
  - `btn.click()` có thực sự được gọi.
  - fallback MouseEvent có được gọi không.
  - Sau click, DOM có thay đổi gì ngay lập tức không.
- Mục tiêu:
  - Phân biệt rõ:
    - click không chạy
    - click chạy nhưng UI không nhận
    - UI nhận nhưng dialog không dismiss

### Step 5. Kiểm tra tiêu chí verify sau click
- Kiểm tra logic:
  - `document.contains(btn)`
  - `btn.offsetParent !== null`
- Mục tiêu:
  - Xác định việc "button vẫn visible" có phản ánh đúng thực tế UI hay chỉ là kiểm tra chưa đủ chính xác.

### Step 6. So sánh DOM sample với live DOM
- Dùng `window.__analyzeDialog()` trên live state để lấy:
  - container count
  - button text
  - context
  - agent panel presence
- So sánh với các sample HTML đã lưu.
- Mục tiêu:
  - Tìm khác biệt live-only như:
    - button nằm trong overlay khác
    - text giống nhau nhưng node click target khác
    - shadow DOM/portal làm sai `elementFromPoint`

### Step 7. Cô lập nguyên nhân bằng instrumentation nhỏ
- Chỉ khi đã xác định điểm dừng, thêm log/instrumentation tối thiểu vào đúng chỗ đó.
- Không sửa heuristic hàng loạt trước khi biết chính xác gate nào fail.
- Mục tiêu:
  - Fix theo nguyên nhân, tránh làm detection quá rộng hoặc tăng false click.

## 6. Dữ liệu cần thu trong pha execute
- Log daemon khi bật `DEBUG=1`.
- Log console `[AutoRetry]` từ target live.
- Kết quả `window.__analyzeDialog()` tại thời điểm dialog đang hiện.
- Nếu có:
  - toạ độ button
  - top element tại `elementFromPoint`
  - trạng thái `disabled`
  - trạng thái `__clicked`

## 7. Kỳ vọng đầu ra của pha phân tích
- Chốt được lỗi thuộc 1 trong 3 nhóm:
  - Detection false positive
  - Safety gate false negative
  - Click execution incompatibility với UI thật
- Có patch nhỏ, đúng nguyên nhân.
- Có plan verify lại live cho Auto Retry sau khi fix.

## 8. Chưa thực hiện trong giai đoạn này
- Chưa sửa code.
- Chưa chạy live debug sequence.
- Chưa thay đổi heuristic click.

## 9. Điều kiện để chuyển sang execute
- User xác nhận cho phép bắt đầu pha debug thực thi theo plan này.
