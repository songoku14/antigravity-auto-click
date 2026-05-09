# Tutorial: Hướng Dẫn Cài Đặt và Sử Dụng Antigravity Auto-Retry

Tài liệu này hướng dẫn bạn 2 cách để cài đặt và sử dụng công cụ Antigravity Auto-Retry. Vui lòng chọn 1 trong 2 cách phù hợp với nhu cầu của bạn.

## Cách 1: Cài đặt và sử dụng qua Giao diện Dòng lệnh (CLI)

Cách này phù hợp nếu bạn muốn thiết lập hệ thống chạy ngầm hoặc quản lý chi tiết qua Terminal.

### 1. Cài đặt

1. Mở ứng dụng **Terminal** trên Mac.
2. Di chuyển vào thư mục dự án chứa mã nguồn:
   ```bash
   cd /đường/dẫn/đến/antigravity-auto-click
   ```
3. Khởi chạy giao diện Menu của công cụ:
   ```bash
   ./scripts/menu.sh
   ```

### 2. Sử dụng (Vận hành)

Sau khi mở Menu qua lệnh trên, bạn có thể thực hiện các thao tác vận hành sau bằng cách nhấn phím tương ứng:

- **Chạy tự động cùng hệ thống (Khuyên dùng):** Nhấn phím **1** để cài đặt LaunchAgent. Công cụ sẽ tự động chạy ngầm dưới nền mỗi khi bạn mở máy tính, tự động theo dõi và xử lý hộp thoại lỗi.
- **Chạy theo yêu cầu (Thủ công):** 
  - Nhấn phím **3** để **Start** (bắt đầu chạy công cụ ngay lập tức).
  - Nhấn phím **4** để **Stop** (dừng công cụ lại khi không cần thiết).
- **Gỡ cài đặt chạy ngầm:** Nhấn phím **2** để gỡ bỏ hoàn toàn cấu hình tự khởi động (LaunchAgent) khỏi hệ thống của bạn.

---

## Cách 2: Cài đặt và sử dụng qua Tiện ích mở rộng (Antigravity Extension)

Cách này cực kỳ tiện lợi nếu bạn thường xuyên sử dụng IDE và muốn điều khiển công cụ nhanh chóng, trực tiếp từ giao diện lập trình.

### 1. Cài đặt

1. Mở ứng dụng **Terminal** trên Mac.
2. Di chuyển vào thư mục dự án chứa mã nguồn:
   ```bash
   cd /đường/dẫn/đến/antigravity-auto-click
   ```
3. Chạy lệnh sau để liên kết dự án vào thư mục tiện ích của Antigravity IDE:
   ```bash
   ln -s $(pwd) ~/.antigravity/extensions/auto-retry
   ```
4. Khởi động lại Antigravity IDE để phần mềm nhận diện Extension mới.

### 2. Sử dụng (Vận hành)

- Sau khi khởi động IDE, hãy tìm biểu tượng tiện ích **Auto-Retry** nằm ở thanh Status Bar (góc dưới cùng bên phải của giao diện).
- **Bắt đầu (Start):** Nhấn chuột vào biểu tượng để kích hoạt tiến trình auto-click.
- **Dừng lại (Stop):** Nhấn vào biểu tượng lần nữa để dừng tiến trình khi đã xong việc.
- Sử dụng qua Extension giúp thao tác bật/tắt nhanh chóng trong quá trình code và hỗ trợ xem log trực tiếp mà không cần mở Terminal.

---

## 🌟 Các Tính Năng Quản Lý và Kiểm Tra

Bất kể bạn chọn phương thức cài đặt nào (CLI hay Extension), công cụ đều cung cấp bộ tính năng hoàn chỉnh giúp bạn kiểm soát toàn diện:

1. 📊 **Kiểm tra trạng thái (Status):** Hiển thị cho bạn biết chính xác tiến trình Auto-Retry đang chạy ngầm hay đang dừng (Ví dụ: phím **5** trên CLI).
2. 📄 **Xem nhật ký (Logs):** Hệ thống ghi nhận đầy đủ lịch sử các lần tự động click "Retry" cũng như các thông báo lỗi, giúp bạn dễ dàng theo dõi quá trình chạy (Ví dụ: phím **6** trên CLI hoặc tính năng xem log trên Extension).
3. 🧪 **Giả lập lỗi "High Traffic" (Test):** Chức năng này sẽ tự động bật lên một hộp thoại giả lập báo lỗi "High Traffic". Nếu Auto-Retry đang hoạt động tốt, công cụ sẽ ngay lập tức phát hiện và click nút "Retry". Đây là công cụ hữu hiệu nhất để kiểm tra tính sẵn sàng của hệ thống (Ví dụ: phím **7** trên CLI).
4. 🛡️ **Bảo vệ tài khoản (Rate Limiting):** Hệ thống có cơ chế giới hạn tốc độ (tối đa 10 lần click mỗi phút). Tính năng này bảo vệ an toàn tuyệt đối cho tài khoản của bạn, đồng thời ngăn chặn việc gửi yêu cầu rác (spam) làm quá tải server.
