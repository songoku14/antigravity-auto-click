# Tutorial: Hướng Dẫn Sử Dụng Antigravity Auto-Retry

Sản phẩm được thiết kế để chạy ngầm và không cần sự tương tác liên tục. Chỉ cần cài đặt một lần duy nhất:

1. Mở ứng dụng **Terminal** trên Mac.
2. Di chuyển vào thư mục dự án này: 
   ```bash
   cd /đường/dẫn/đến/antigravity-auto-click
   ```
3. Chạy tệp cài đặt:
   ```bash
   ./scripts/install.sh
   ```
4. **Xong.** Từ giờ, hệ thống sẽ tự động theo dõi, mỗi khi Antigravity bật lên và gặp lỗi "High Traffic" hoặc "Server is busy", công cụ sẽ click vào "Retry" cho bạn với tối đa 10 lần/phút để tránh spam. Nó tự động chạy lại mỗi khi bạn khởi động lại máy Mac.
