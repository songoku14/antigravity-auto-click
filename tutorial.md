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

### 📥 Cách cài đặt & Migration
Nếu bạn đang dùng phiên bản cũ, hãy thực hiện các bước sau để đảm bảo tính tương thích:
1.  **Cập nhật Link**: Chạy lệnh `ln -s $(pwd) ~/.antigravity/extensions/auto-retry` (dùng đường dẫn tuyệt đối).
2.  **Khởi động lại IDE**: Extension sẽ tự động phát hiện và **Normalize** các cấu hình cũ (ví dụ: chuyển `review` thành `reviewChange`).
3.  **Kiểm tra Warning**: Nếu cấu hình cũ của bạn không hợp lệ, Extension sẽ hiển thị cảnh báo khi khởi động.

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

1.  **terminal**: Các yêu cầu chạy lệnh trong Terminal.
    - *Lưu ý*: Luôn được kiểm tra qua `blacklist` trước khi click.
2.  **reviewChange**: Các yêu cầu duyệt thay đổi code (Proceed, Accept All).
3.  **systemReview**: Các xác nhận hệ thống hoặc Agent side panel.

> [!CAUTION]
> Cờ `autoAccept.performClick` phải được bật (ON) thì hệ thống mới thực hiện click thật. Nếu tắt, hệ thống chỉ ghi nhận thống kê (Observe Mode).

---

## ❓ Xử lý sự cố (Troubleshooting & Fallback)

| Vấn đề | Cách xử lý |
|:---|:---|
| **Extension báo "Config Invalid"** | Dùng menu **System Diagnostics** để xem lỗi cụ thể, sau đó dùng **Open Raw Config** để sửa. |
| **Daemon không khởi động được** | Kiểm tra xem có tiến trình `node src/core/auto-retry.js` nào đang treo không bằng lệnh `pgrep -f auto-retry`. Dùng mục **Dừng tất cả tính năng** trong CLI để dọn dẹp. |
| **Không nhận diện được nút mới** | Dùng CLI > Developer Tools > **Dump DOM Snapshot** và gửi mẫu cho đội phát triển. |
| **CDP không kết nối được** | Đảm bảo bạn đã tắt hẳn IDE trước khi mở lại bằng lệnh `antigravity`. |

---
*Chúc bạn có trải nghiệm lập trình mượt mà cùng Antigravity!*
