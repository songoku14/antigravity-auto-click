# Quy trình Phân tích Nút bấm (Target Button) - Chi tiết Kỹ thuật

Tài liệu này mô tả chi tiết thuật toán nhận diện và click tự động của Antigravity, được chia thành 3 giai đoạn chính để dễ theo dõi.

---

## Giai đoạn 1: Tìm kiếm & Phân loại Container

Giai đoạn này xác định **phạm vi** mà hệ thống sẽ tìm kiếm nút bấm. Thay vì quét toàn bộ màn hình, hệ thống ưu tiên các vùng chứa thông báo hoặc cửa sổ Agent.

```mermaid
graph TD
    Start(["Bắt đầu chu kỳ quét (Polling)"]) --> FindC["Quét selector: .antigravity-agent-side-panel"]
    
    FindC --> Found{Tìm thấy Container?}
    Found -- Không --> End([Thoát chu kỳ])
    Found -- Có --> Stage2([Chuyển sang Giai đoạn 2])
```

---

## Giai đoạn 2: Quét & Phân tích Nút bấm (`findButtonsIn`)

Trong mỗi Container, hệ thống sẽ duyệt qua từng phần tử (bao gồm cả Shadow DOM) để tìm ra các ứng viên nút bấm tiềm năng.

```mermaid
graph TD
    Start2([Bắt đầu duyệt container]) --> FastPath{"Fast Path: Có chứa keyword (Retry/Run...)"}
    
    FastPath -- Không --> End2([Thoát sớm])
    FastPath -- Có --> TreeWalker["Duyệt DOM & Shadow Roots (TreeWalker)"]
    
    TreeWalker --> IsClickable{"Kỹ thuật: Có đặc điểm Click?"}
    
    IsClickable -- Không --> Next["Bỏ qua, chuyển sang phần tử tiếp theo"]
    IsClickable -- Có --> SafeCtx{"Kiểm tra vùng an toàn?"}
    
    SafeCtx -- Không (Menu/List/Editor) --> Next
    SafeCtx -- Có --> FilterText{"Độ dài chữ (1-50) & Không bị disabled?"}
    
    FilterText -- Không --> Next
    FilterText -- Có --> Semantic{"Đặc điểm Ngữ nghĩa?"}
    
    Semantic -- Nút Loose (cursor:pointer hoặc class button/btn/cursor-pointer) --> SemanticMatch{"Chữ khớp 'Accept All', 'Reject All', 'Proceed'?"}
    Semantic -- Nút Primary (Tag/Role/Class chuẩn) --> MatchRegex["Khớp Regex mẫu (Retry/Accept Patterns)?"]
    
    SemanticMatch -- Không --> Next
    SemanticMatch -- Có --> MatchRegex
    
    MatchRegex -- Không --> Next
    MatchRegex -- Có --> WrapCheck{"Có phần tử con khớp hơn (innermost)?"}
    
    WrapCheck -- Có --> Next
    WrapCheck -- Không --> FoundCandidate([Tìm thấy Ứng viên Nút bấm])
```

---

## Giai đoạn 3: Thực thi & Xác thực Click

Khi đã có ứng viên, hệ thống thực hiện các "chốt chặn" vật lý cuối cùng trước khi ra lệnh click thực sự.

```mermaid
graph TD
    Start3([Ứng viên Nút bấm]) --> ContextMatch{"Khớp ngữ cảnh (Context Match)?"}
    
    ContextMatch -- Không khớp chữ xung quanh --> Reject
    ContextMatch -- Khớp (Thấy chữ Error/Fail/Command) --> Visibility{"isVisibleAtPoint (Kiểm tra che khuất)?"}
    
    Visibility -- Bị che bởi phần tử khác --> Reject
    Visibility -- Nhìn thấy trực tiếp --> RateLimit{"Kiểm tra Tần suất (Rate Limit)?"}
    
    RateLimit -- Vượt ngưỡng --> Reject
    RateLimit -- An toàn --> Perform["Thực hiện Click (Giai đoạn thực thi)"]
    
    Perform --> Delay["Chờ clickDelay (800ms)"]
    Delay --> Resolve["Xác định vị trí thực tế (Live Position)"]
    Resolve --> Click1["DOM Click: btn.click()"]
    
    Click1 --> Verify{"Sau 500ms: Nút còn tồn tại?"}
    Verify -- Biến mất --> Success([Thành công])
    Verify -- Còn tồn tại --> FallbackClick["Fallback: Gửi chuỗi sự kiện Pointer/Mouse cấp thấp"]
    
    FallbackClick --> FinalVerify{"Kiểm tra lần cuối?"}
    FinalVerify -- Biến mất --> Success
    FinalVerify -- Còn tồn tại --> Fail([Cần can thiệp thủ công])
```

---

## Chi tiết Kỹ thuật bổ sung

### 1. Cách xác định "Có thể Click" (IsClickable)
Hệ thống sử dụng tổ hợp các điều kiện sau:
- **Thẻ HTML**: `<button>` hoặc `<input type="button">`.
- **Thuộc tính ARIA**: `role="button"`.
- **CSS Classes**: `.monaco-button`, `.action-label`, `.bg-ide-button-background`.
- **Cursor**: Bất kỳ phần tử nào có `cursor: pointer` được thiết lập trong CSS (được kiểm tra qua `getComputedStyle`).

### 2. Cách xác định Container
- **Agent Window**: Được xác định duy nhất qua class `.antigravity-agent-side-panel`. Hệ thống hiện nay chỉ tập trung quét vùng này để đảm bảo an toàn tuyệt đối và hiệu năng cao nhất.

### 3. Kiểm tra khả năng hiển thị (Visibility)
Sử dụng hàm `document.elementFromPoint(x, y)` tại điểm trung tâm của nút. 
- Nếu kết quả trả về là chính nút đó hoặc một phần tử con của nó -> **Nhìn thấy**.
- Nếu kết quả trả về là một phần tử khác (ví dụ: một lớp phủ mờ) -> **Bị che khuất**.

### 4. Cơ chế Click Dự phòng (Fallback)
Một số framework (như React) có thể không nhận diện lệnh `.click()` đơn thuần nếu nó không đi kèm với các sự kiện trạng thái. Do đó, hệ thống sẽ giả lập đầy đủ:
1. `pointerdown`
2. `mousedown`
3. `pointerup`
4. `mouseup`
5. `click`
### 5. Tại sao giới hạn độ dài chữ (1-50 ký tự)?
Hệ thống chỉ kiểm tra các nút có độ dài văn bản từ 1 đến 50 ký tự để đảm bảo:
- **Hiệu năng (Early Exit)**: Phép so sánh độ dài chuỗi cực nhanh, giúp bỏ qua ngay lập tức các khối văn bản lớn (đoạn chat, log file) mà không cần tốn tài nguyên chạy bộ máy Regex phức tạp.
- **Tránh khớp nhầm (False Positive)**: Ngăn việc các từ khóa như "Run" hay "Retry" bị nhận diện nhầm khi chúng nằm giữa một đoạn văn bản dài không phải là nút bấm.
- **Độ chính xác**: Các nút hành động thực tế trong IDE hầu hết đều ngắn gọn (thường dưới 20 ký tự). Ngưỡng 50 là con số an toàn để bao quát cả các nhãn dài nhất mà vẫn lọc được nhiễu.
### 6. Kiểm tra vùng an toàn (Safe Context Check)
Đây là bước lọc để đảm bảo hệ thống không click nhầm vào các thành phần điều hướng của IDE. Hệ thống sẽ **bỏ qua** các nút nếu chúng nằm trong:
- **Menu & List**: Menu chuột phải, danh sách gợi ý (Quick Input), hoặc bảng chọn (Listbox).
- **Điều hướng File**: Trình quản lý file (Explorer), thanh Tab, hoặc thanh Breadcrumbs.
- **Vùng soạn thảo**: Bên trong trình soạn thảo code (Editor) để tránh click vào các từ khóa trong code.
- **Thanh tiêu đề**: Các nút trên Title bar của IDE.

**Mục tiêu**: Đảm bảo tính chính xác và không gây gián đoạn cho các thao tác thủ công của người dùng trên giao diện IDE.

### 7. Phân biệt Button chuẩn và Văn bản có thể click (Loose Clickable)
Trong giao diện IDE, có rất nhiều thành phần khi di chuột vào sẽ xuất hiện biến thể `cursor: pointer` (hình bàn tay) nhưng không phải là một `Button` lệnh thực sự. Hệ thống phân loại như sau:

- **Button chuẩn (Primary Button)**: Sử dụng các thẻ chuẩn như `button`, `input` (type button), thuộc tính `role="button"` hoặc class `.monaco-button`. Hệ thống tin tưởng các thành phần này và cho phép click nếu văn bản khớp với mẫu.
- **Văn bản có thể click (Loose Clickable)**: Các phần tử được nhận diện là loose nếu thỏa **bất kỳ** điều kiện sau (hàm `hasLooseClickability`):
  - Có class `.button` hoặc `.btn`
  - Có class `.cursor-pointer`
  - Có inline style `cursor: pointer` (`el.style.cursor`)
  - Có computed style `cursor: pointer` (`getComputedStyle(el).cursor`)

  > **Tại sao `.button`/`.btn` (class) lại là Loose chứ không phải Primary?**
  > Vì đây là **class CSS thuần túy** — bất kỳ `<div>` hay `<span>` nào cũng có thể gắn class này để tạo kiểu dáng trông như button, nhưng không có ngữ nghĩa HTML thật. Ngược lại, Primary chỉ tin tưởng **thẻ `<button>` thật** hoặc ARIA role/class VS Code cụ thể.
  >
  > ```html
  > <button>Run</button>          <!-- Primary: tag HTML chuẩn -->
  > <div class="button">Run</div> <!-- Loose: chỉ là div mặc phong cách -->
  > <span class="btn">Run</span>  <!-- Loose: tương tự -->
  > ```

  Loại này rất dễ gây **click nhầm** (False Positive) vì nhiều thành phần UI dùng cursor pointer mà không phải button thật.

**Tại sao phải kiểm tra khắt khe?**
Để đảm bảo an toàn, nếu một phần tử chỉ là `Loose Clickable` (không phải `Button` chuẩn), hệ thống **bắt buộc** văn bản trên đó phải khớp đúng regex `/accept all|reject all|proceed/i`. Đây là 3 cụm từ duy nhất được chấp nhận — **không có thêm từ nào khác** (kể cả "Yes").

Việc này giúp loại bỏ trường hợp click vào một đoạn văn bản hay một icon điều hướng chỉ vì nó có hiệu ứng bàn tay và tình cờ chứa từ khóa (ví dụ: một dòng thông báo có chữ "run" bên trong nhưng không phải là một `Button` Run).

### 8. Ưu tiên phần tử con sâu nhất (Innermost Element Priority)
Hệ thống luôn cố gắng tìm ra phần tử nhỏ nhất và cụ thể nhất để thực hiện lệnh click.

- **Vấn đề**: Trong HTML, một `Button` thực sự thường được bao bọc bởi các thẻ cha (như `div` hay `span`). Do cơ chế cộng dồn văn bản, cả thẻ cha và thẻ con đều chứa cùng một nội dung (ví dụ: chữ "Retry").
- **Cơ chế**: Khi tìm thấy một ứng viên, hệ thống sẽ kiểm tra xem bên trong nó có phần tử con nào khác cũng khớp với điều kiện hay không. Nếu có, nó sẽ bỏ qua thẻ cha để chọn thẻ con sâu nhất.
- **Lý do**: Click vào phần tử sâu nhất đảm bảo hành động được thực hiện trực tiếp lên `Button`, kích hoạt đúng các hiệu ứng giao diện và tránh việc click nhầm vào các vùng đệm (padding) hoặc các phần tử bao quanh không liên quan.
