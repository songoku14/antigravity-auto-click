# Tài liệu Kiến trúc & Implementation Plan: Antigravity Auto-Retry

Tài liệu này ghi lại toàn bộ quá trình phân tích, cơ chế hoạt động và cách tôi (AI) đã tư duy để giải quyết bài toán: **Tự động ấn nút Retry khi Antigravity gặp lỗi "High Traffic"**.

---

## 1. Bài toán và Khảo sát ban đầu

**Vấn đề:** 
Người dùng rất bực mình vì Antigravity thường xuyên hiện lỗi "High Traffic" / "Server is busy". Mỗi lần như vậy, người dùng phải tự dùng chuột ấn nút "Retry" thủ công. Yêu cầu là phải tự động hoá việc click này.

**Khảo sát môi trường:**
Antigravity không phải là một Native App thông thường của macOS. Nó được build dựa trên nền tảng **Electron** (tương tự như VS Code). Điều này có nghĩa là giao diện của nó thực chất là các trang web (HTML/CSS/JS) chạy trong một trình duyệt Chromium ẩn.

---

## 2. Quá trình Tư duy & Chọn Giải pháp

Khi đối mặt với việc tự động hoá một Electron App, tôi đã cân nhắc 3 phương án:

### Phương án A: AppleScript / macOS Accessibility (Bị loại bỏ)
Ban đầu, tôi dự định dùng AppleScript để mô phỏng thao tác click chuột.
- **Cách làm:** Dùng `System Events` của macOS để quét cây giao diện (Accessibility Tree) tìm nút "Retry".
- **Lý do thất bại:** Khi dùng lệnh test thử, tôi phát hiện Electron App chặn/không phơi bày (expose) các thành phần giao diện web ra cho hệ điều hành macOS. Nó chỉ báo cáo đúng 11 elements cơ bản (như nút tắt, thu nhỏ cửa sổ). Hộp thoại "High Traffic" hoàn toàn vô hình với macOS Accessibility.

### Phương án B: Screen Capture + Nhận diện hình ảnh/OCR (Bị loại bỏ)
- **Cách làm:** Dùng Python chụp màn hình liên tục mỗi giây, quét chữ "High Traffic" bằng Tesseract OCR, rồi tính toán toạ độ pixel để click chuột vào chữ "Retry".
- **Lý do thất bại:** Quá cồng kềnh (Overkill). Tiêu tốn cực kỳ nhiều CPU và RAM của người dùng. Dễ click trượt nếu người dùng kéo thả, resize cửa sổ hoặc đổi theme giao diện.

### Phương án C: Chrome DevTools Protocol (CDP) (Giải pháp được chọn 🏆)
- **Phát hiện đột phá:** Tôi dùng lệnh `ps aux` để kiểm tra các tiến trình (processes) đang chạy của Antigravity và phát hiện ra một điều cực kỳ quan trọng:
  Antigravity luôn chạy kèm cờ `--remote-debugging-port=31905`.
- **Cơ chế:** Cờ này mở ra một cổng mạng bí mật (WebSocket) cho phép kết nối thẳng vào "não bộ" của Chromium. Qua cổng này, chúng ta có thể trực tiếp đẩy (inject) các đoạn mã JavaScript vào thẳng bên trong trang web của Antigravity đang hiển thị.
- **Lợi ích:** 
  - Biết chính xác 100% khi nào có hộp thoại nhờ công nghệ theo dõi DOM (`MutationObserver`).
  - Click chính xác 100% bằng cách gọi hàm `button.click()` của JavaScript thay vì toạ độ chuột.
  - Cực kỳ nhẹ, tốn gần như 0% CPU.

---

## 3. Cơ chế Hoạt động Chi tiết (Bản v3 Hoàn thiện)

Kiến trúc bao gồm 2 phần chính: **Node.js Daemon (Bên ngoài)** và **Injected Payload (Bên trong)**.

### Phần 1: Node.js Daemon (`src/auto-retry.js`)
Đây là đoạn mã chạy ngầm liên tục trên máy Mac.
1. **Discovery:** Nó liên tục chạy lệnh `ps aux` để theo dõi xem Antigravity có đang mở không. Nếu có, nó sẽ đọc port (ví dụ: `31905`).
2. **Target Filtering:** Nó gọi API `http://localhost:31905/json` để liệt kê các khung hình (tabs/iframes) bên trong Antigravity. Nó sẽ chỉ lọc ra `Launchpad` (khu vực chat AI) và `Review Changes` (khu vực review code) để nhắm mục tiêu.
3. **Websocket Connect & Inject:** Nó mở kết nối WebSocket đến các khung hình đó, gửi lệnh `Runtime.evaluate` để nhét đoạn mã JavaScript (Payload) của chúng ta vào. Nếu người dùng F5 hoặc tắt Antigravity mở lại, Daemon sẽ tự động phát hiện và kết nối/nhét code lại từ đầu.

### Phần 2: JavaScript Payload (`src/injection-payload.js` - Chạy trong Antigravity)
Đây là "điệp viên" nằm vùng trực tiếp trên giao diện của Antigravity.

**Cơ chế phát hiện thông minh (Anti False-Positive):**
Ở những phiên bản đầu, tôi gặp lỗi nghiêm trọng: Mã JS thấy người dùng đang mở file tên `auto-retry.js`, trong file có chữ "retry" -> Nó tưởng lầm đó là nút báo lỗi và click loạn xạ. Để giải quyết dứt điểm, tôi đã thiết kế phiên bản 3 (v3) với tư duy phòng thủ cực cao:

1. **Zone Scoping (Khoanh vùng giới hạn):** 
   Thay vì quét toàn bộ trang web (bao gồm cả trình soạn thảo code), điệp viên này *chỉ được phép* nhìn vào các class đặc thù của hộp thoại lỗi, ví dụ: `.monaco-dialog-box`, `.notification-toast`, `.jetski-error`. 
2. **Text Verification:**
   Nó kiểm tra xem bên trong các hộp thoại đó có chứa đoạn text dạng `/high traffic/` hoặc `/server busy/` không.
3. **Strict Button Matching:**
   Nó tìm thẻ `button` nằm *bên trong* hộp thoại đó. Chữ trên button phải khớp chính xác tuyệt đối `/^retry$/i` (không thừa một ký tự nào).
4. **Visibility Check:**
   Nó dùng `getBoundingClientRect()` để đảm bảo nút đó đang thực sự hiển thị trên màn hình chứ không phải bị ẩn bằng CSS.
5. **MutationObserver:**
   Thay vì lặp đi lặp lại quét trang (setInterval), nó dùng `MutationObserver` yêu cầu trình duyệt báo cáo lại mỗi khi HTML thay đổi (khi có hộp thoại mới nổi lên). Điều này giúp tiết kiệm pin và CPU cho Mac.
6. **Rate Limiting & Cooldown:**
   Để tránh kịch bản code lỗi ấn nút Retry 1000 lần/giây khiến API của Google sập, tôi đặt giới hạn: Chỉ cho phép ấn tối đa 10 lần/phút. Nếu vượt quá, script sẽ bị "đóng băng" (cooldown) 2 phút trước khi được chạy lại.

### Phần 3: Tự động khởi chạy (LaunchAgent)
Để người dùng không bao giờ phải gõ lệnh bật tool, tôi đã tạo file `scripts/install.sh` để sinh ra một file cấu hình `.plist` của macOS (Launchd).
- Máy Mac sẽ tự động chạy file Node.js dưới nền (background) mỗi khi người dùng đăng nhập vào hệ thống.
- Nhật ký (Logs) được lưu vào `~/Library/Logs/AntigravityAutoRetry/`.

---

## 4. Tổng kết

Giải pháp này không chỉ giải quyết triệt để sự khó chịu của người dùng mà còn được xây dựng theo tiêu chuẩn cấp hệ thống (Production-grade):
- Không chiếm chuột / màn hình của người dùng.
- Tự động khắc phục khi Antigravity khởi động lại.
- Tránh hoàn toàn việc click nhầm vào code đang soạn thảo.
- Tự động khởi chạy cùng macOS.
