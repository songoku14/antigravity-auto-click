# Hướng Dẫn: Antigravity Auto-Retry

Tài liệu hướng dẫn cài đặt và vận hành công cụ tự động.

---

## Yêu cầu Bắt buộc (Chỉ làm 1 lần)

Để công cụ tự động click có thể kết nối, Antigravity IDE **bắt buộc** phải được khởi chạy ở chế độ Debug. 
Mở Terminal và copy/paste lệnh sau để thiết lập tự động:

```bash
echo 'alias antigravity="open -a Antigravity --args --remote-debugging-port=9222"' >> ~/.zshrc && source ~/.zshrc
```

Từ nay về sau, bạn chỉ cần mở Terminal và gõ `antigravity` để khởi động IDE một cách chính xác.

---

## Cách 1: Giao diện Dòng lệnh (CLI)

Phù hợp cho chạy ngầm hệ thống.

### 1. Cài đặt
- **Truy cập thư mục:** `cd /đường/dẫn/dến/antigravity-auto-click`
- **Mở Menu:** `./scripts/menu.sh`

### 2. Vận hành
- **Chạy ngầm (LaunchAgent):** Phím **1**. Tự khởi động cùng máy tính.
- **Chạy thủ công (Manual):** Phím **3** để Start, phím **4** để Stop.
- **Gỡ bỏ:** Phím **2** để xóa LaunchAgent.

---

## Cách 2: Tiện ích IDE (Extension)

Phù hợp cho thao tác nhanh trong IDE.

### 1. Cài đặt
- **Liên kết Extension:** 
  ```bash
  ln -s $(pwd) ~/.antigravity/extensions/auto-retry
  ```
- **Khởi động lại:** Restart Antigravity IDE.

### 2. Vận hành
- **Trạng thái:** Biểu tượng **Auto-Retry** tại Status Bar (Góc dưới phải).
- **Bắt đầu:** Click biểu tượng -> Start.
- **Dừng:** Click biểu tượng -> Stop.

### 3. Gỡ cài đặt
- **Xóa liên kết:** 
  ```bash
  rm ~/.antigravity/extensions/auto-retry
  ```
- **Khởi động lại:** Restart Antigravity IDE.

---

## Tính năng Quản lý
- 📊 **Status:** Xem trạng thái qua màu sắc hình tròn (Green: RUNNING, Grey: STOPPED).
- 🧪 **Test:** Giả lập lỗi "High Traffic" để xác nhận click thành công.
- 🛡️ **Rate Limit:** Tối đa 10 lần click/phút (Bảo vệ tài khoản).
