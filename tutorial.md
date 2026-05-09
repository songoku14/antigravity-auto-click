# Tutorial: Hướng Dẫn Sử Dụng Antigravity Auto-Retry

Sản phẩm được thiết kế để bạn có toàn quyền điều khiển. Bạn có thể chọn chạy tự động hoàn toàn hoặc chạy thủ công khi cần.

### 🚀 Bắt đầu nhanh

1. Mở ứng dụng **Terminal** trên Mac.
2. Di chuyển vào thư mục dự án này: 
   ```bash
   cd /đường/dẫn/đến/antigravity-auto-click
   ```
3. Chạy giao diện quản lý (Menu):
   ```bash
   ./scripts/menu.sh
   ```

### 🛠️ Các chế độ hoạt động

Từ giao diện Menu, bạn có hai lựa chọn chính:

#### 1. Chế độ Chạy Tự Động (Khuyên dùng)
- **Cách làm:** Nhấn phím **1** trong Menu.
- **Tác dụng:** Hệ thống sẽ cài đặt một "LaunchAgent". Công cụ sẽ tự động khởi động cùng máy Mac, chạy ngầm và ghi nhật ký vào file log. Bạn không cần mở Terminal sau khi cài đặt xong.
- **Khi nào dùng:** Khi bạn muốn máy tính tự động xử lý lỗi "High Traffic" mà không cần bận tâm.

#### 2. Chế độ Chạy Thủ Công (Tự điều khiển)
- **Cách làm:** Nhấn phím **3** trong Menu.
- **Tác dụng:** Công cụ sẽ chạy trực tiếp ngay trong cửa sổ Terminal hiện tại. Bạn sẽ thấy các thông báo "Clicking Retry..." hiện ra ngay lập tức.
- **Khi nào dùng:** Khi bạn chỉ muốn bật công cụ khi cần, hoặc muốn theo dõi trực tiếp xem nó đang làm gì. Nhấn `Ctrl + C` để dừng.

### 📊 Quản lý và Kiểm tra
- 📊 **Xem chi tiết trạng thái hệ thống:** Nhấn **5** để biết hệ thống đang chạy hay đã dừng.
- 📄 **Xem nhật ký:** Nhấn **6** để xem lịch sử các lần click (chỉ dành cho chế độ chạy tự động).
- 🧪 **Kiểm tra hoạt động (Test Script):** Nhấn **7** để giả lập một hộp thoại lỗi "High Traffic". Nếu script đang chạy, nó sẽ tự động nhận diện và click nút "Retry" trên hộp thoại giả này. Đây là cách tốt nhất để xác nhận hệ thống đang hoạt động bình thường.
- 🗑️ **Gỡ cài đặt:** Nhấn **2** nếu bạn muốn xóa hoàn toàn các thiết lập chạy ngầm.

---
*Lưu ý: Hệ thống được cấu hình để click tối đa 10 lần/phút để đảm bảo an toàn cho tài khoản và tránh spam server.*
