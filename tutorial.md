# 🤖 Antigravity Auto-Click: Hướng Dẫn Toàn Tập

Chào mừng bạn đến với bộ công cụ tự động hóa mạnh mẽ dành cho **Antigravity IDE**. Kể từ phiên bản mới nhất, hệ thống đã chuyển sang mô hình **Extension-First**, nơi bạn có thể điều phối mọi hoạt động ngay trong IDE.

---

## 🛠️ Bước 1: Thiết lập Bắt buộc (Chỉ làm 1 lần)

Để công cụ có thể giao tiếp với Antigravity, bạn **bắt buộc** phải mở IDE ở chế độ Debug.

### ⌨️ Thiết lập Alias (Khuyên dùng)
Dán lệnh này vào Terminal để tạo phím tắt `antigravity`:
```bash
echo 'alias antigravity="open -a Antigravity --args --remote-debugging-port=31905"' >> ~/.zshrc && source ~/.zshrc
```

> [!IMPORTANT]
> Hãy luôn khởi động IDE bằng lệnh `antigravity`. Nếu quên, hãy đóng hẳn IDE và mở lại bằng alias này để bật đúng cổng debug.

---

## 🧩 Giao diện Chính: Extension Control Center

Đây là trung tâm điều khiển chính cho mọi thao tác hằng ngày.

### 📥 Cách cài đặt
Công cụ hiện được phân phối dưới dạng file `.vsix` tiện lợi:
1.  **Cài đặt**: Mở Antigravity, kéo thả file `antigravity-auto-click-x.x.x.vsix` vào IDE.
2.  **Sử dụng**: Sau khi cài đặt, extension sẽ tự động quản lý cấu hình và dữ liệu của bạn. Nếu bạn đã dùng bản cũ, hệ thống sẽ tự động cập nhật dữ liệu mà không cần thao tác gì thêm.

### 🛰️ Status Bar (Góc dưới phải)
Theo dõi trạng thái thời gian thực:
- `(R)` : Auto-Retry đang Bật.
- `(A:t,r,s)` : Auto-Accept đang Bật (t: Terminal, r: Review Change, s: System Review).
- `STOPPED` : Daemon chưa chạy.

### ⚡ Control Center (Click vào Status Bar)
Menu này cung cấp các lệnh nhanh:
- **Enable/Disable Features**: Toggles cho từng tính năng và category.
- **Auto Retry/Accept Settings**: Mở menu con để cấu hình chi tiết (Timing, Patterns, Blacklist).
- **Activity Summary**: Xem thống kê click và lý do skip gần nhất.
- **System Diagnostics**: Kiểm tra cổng CDP, trạng thái config và xem nhanh logs.
- **Start/Stop/Reload Daemon**: Điều khiển tiến trình chạy ngầm.

---

## 💻 Giao diện Phụ: CLI Menu

Phù hợp cho các tác vụ nâng cao hoặc khi cần khắc phục sự cố.

### 🎮 Cách truy cập
```bash
./scripts/menu.sh
```

### 📋 Khi nào dùng CLI?
- **Cài đặt LaunchAgent**: Để hệ thống tự khởi động cùng macOS.
- **Developer Tools**: Phân tích DOM trực tiếp hoặc Dump DOM Snapshot.
- **Regression Testing**: Chạy kiểm thử hàng loạt trên các mẫu dữ liệu thực tế để đảm bảo logic detect không bị sai.

---

## ⚙️ Giải thích các Category Auto-Accept

Hệ thống phân loại các yêu cầu Accept thành 3 nhóm chính để đảm bảo an toàn:

1.  **terminal**: Tự động xác nhận các yêu cầu chạy lệnh trong Terminal.
    - *Lưu ý*: Luôn được kiểm tra qua danh sách `blacklist` trước khi click để tránh chạy các lệnh nguy hiểm.
2.  **reviewChange**: Tự động duyệt các thay đổi code (nút Proceed, Accept All).
3.  **systemReview**: Các xác nhận hệ thống hoặc Agent side panel.

---

## 📂 Vị trí Dữ liệu & Cấu hình

Cả Extension và CLI đều dùng chung một bộ dữ liệu để đảm bảo đồng bộ. Nếu cần can thiệp thủ công, bạn có thể tìm thấy chúng tại:
- **Đường dẫn**: ` ~/Library/Application\ Support/Antigravity/Auto\ Click `
- **File quan trọng**: `config.json` (Cấu hình) và `logs/activity-log.json` (Thống kê).

---

## ❓ Xử lý sự cố (Troubleshooting & Fallback)

| Vấn đề | Cách xử lý |
|:---|:---|
| **Extension báo "Config Invalid"** | Dùng menu **System Diagnostics** để xem lỗi cụ thể, sau đó dùng **Open Raw Config** để sửa. |
| **Daemon không khởi động được** | Kiểm tra Output Channel `Antigravity Auto-Click` trong IDE. Đảm bảo không có tiến trình `node src/core/auto-retry.js` nào bị treo (dùng `pgrep -f auto-retry`). |
| **Không nhận diện được nút mới** | Dùng CLI > Developer Tools > **Dump DOM Snapshot** và gửi mẫu cho đội phát triển. |
| **CDP không kết nối được** | Đảm bảo bạn đã tắt hẳn IDE trước khi mở lại bằng lệnh `antigravity`. |

---
*Chúc bạn có trải nghiệm lập trình mượt mà cùng Antigravity!*
