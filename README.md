# 🤖 Antigravity Auto-Click (Retry & Accept)

Bộ công cụ tự động hóa thao tác click cho Antigravity IDE: Tự động thử lại khi lỗi (Auto-Retry) và Tự động chấp nhận đề xuất từ Agent (Auto-Accept). 

Kể từ phiên bản mới nhất, hệ thống đã chuyển sang mô hình **Extension-First**, cho phép bạn điều phối mọi hoạt động ngay trong IDE thông qua **Control Center** trực quan.

---

## 🛠️ Hướng Dẫn Cài Đặt & Sử Dụng Nhanh (Quick Start)

### Bước 1: Thiết lập chế độ Debug cho IDE (Chỉ làm 1 lần)
Để công cụ có thể giao tiếp với Antigravity IDE qua Chrome DevTools Protocol (CDP), bạn **bắt buộc** phải khởi động IDE với cổng debug.
Dán lệnh sau vào Terminal của macOS để tạo phím tắt `antigravity`:
```bash
echo 'alias antigravity="open -a \"Antigravity IDE\" --args --remote-debugging-port=31905"' >> ~/.zshrc && source ~/.zshrc
```
> [!IMPORTANT]
> Hãy luôn khởi động IDE bằng lệnh `antigravity`. Nếu quên, hãy đóng hẳn IDE và mở lại bằng alias này để kích hoạt đúng cổng debug.

### Bước 2: Cài đặt Extension
Công cụ được đóng gói dưới dạng file `.vsix` tiện lợi:
1. Mở Antigravity IDE.
2. Kéo thả file `antigravity-auto-click-1.0.0.vsix` vào IDE để cài đặt.
3. Nếu bạn đã sử dụng phiên bản cũ, hệ thống sẽ tự động cập nhật dữ liệu cấu hình cũ mà không cần thao tác gì thêm.

### Bước 3: Sử dụng qua Giao diện Control Center
- **Status Bar (Góc dưới phải)**: Click vào để bật/tắt nhanh **Control Center**. Trạng thái hiển thị theo thời gian thực:
  - `Auto Click R / A (t|r|s)`:
    - `R`: Auto-Retry đang Bật.
    - `A`: Auto-Accept đang Bật.
    - `t|r|s`: Các category đang hoạt động (`terminal`, `reviewChange`, `systemReview`).
  - `STOPPED`: Daemon chưa hoạt động.
- **Control Center Dashboard**:
  - **Toggles**: Bật/tắt nhanh Auto Retry và Auto Accept (bao gồm 3 phân cấp: Terminal, Review Change, System Review).
  - **Statistics**: Biểu đồ thống kê số lần click thành công theo từng loại hành động trực quan.
  - **Blacklist Management**: Thêm/xóa các lệnh bị chặn bằng giao diện tags vô cùng đơn giản.
  - **System Diagnostics**: Kiểm tra cổng CDP, trạng thái cấu hình và xem nhanh log hệ thống để xử lý sự cố.

---

## ⚙️ Giải thích các Category Auto-Accept

Hệ thống phân loại các yêu cầu tự động chấp nhận thành 3 nhóm chính để đảm bảo an toàn tối đa:
1. **terminal**: Tự động xác nhận các yêu cầu chạy lệnh trong Terminal.
   - *Lưu ý*: Lệnh luôn được đối chiếu qua danh sách `blacklist` trước khi tự động click để tránh chạy các lệnh nguy hiểm.
2. **reviewChange**: Tự động duyệt các thay đổi mã nguồn (nút `Proceed`, `Accept All`).
3. **systemReview**: Các xác nhận hệ thống hoặc hội thoại trên Side Panel của Agent (yêu cầu an toàn cao hơn, master toggle tự động đồng bộ hóa).

---

## 📂 Vị trí Dữ liệu & Cấu hình

Cả Extension và CLI đều dùng chung một bộ dữ liệu để đảm bảo đồng bộ. Hệ thống tự động nhận diện và sử dụng đường dẫn tương ứng với phiên bản IDE bạn cài đặt (ưu tiên Antigravity IDE):
- **Đường dẫn trên macOS**:
  - `~/Library/Application Support/Antigravity IDE/Auto Click` (mặc định cho IDE mới)
  - `~/Library/Application Support/Antigravity/Auto Click` (mặc định cho IDE cũ)
- **Đường dẫn trên Windows**:
  - `%APPDATA%\Antigravity IDE\Auto Click` (mặc định cho IDE mới)
  - `%APPDATA%\Antigravity\Auto Click` (mặc định cho IDE cũ)

### Các file quan trọng:
- `config.json`: Cấu hình toàn bộ hệ thống.
- `logs/activity-log.json`: Thống kê click (có thể tắt qua `logging.activityLog` trong cấu hình).
- `logs/daemon.log`: Nhật ký hệ thống chạy ngầm (có thể tắt qua `logging.enabled` để tiết kiệm bộ nhớ).

### Tinh chỉnh Thời gian & Rate Limit (Advanced Timing Config)
Trong file `config.json`, bạn có thể tinh chỉnh các tham số nâng cao:
1. **`autoRetry.timing`**:
   - `pollInterval` (mặc định `3000` ms): Tần suất quét DOM của IDE để tìm hộp thoại lỗi.
   - `clickDelay` (mặc định `800` ms): Khoảng trễ trước khi click (giả lập thao tác người dùng).
   - `minClickInterval` (mặc định `5000` ms): Khoảng cách tối thiểu giữa 2 lần click liên tiếp (tránh double-click).
2. **`autoRetry.rateLimit`**:
   - `maxRetriesPerMinute` (mặc định `15` lần): Số lần click tối đa trong 1 phút để tránh lặp vô hạn khi hệ thống lỗi liên tiếp.
   - `cooldownMs` (mặc định `60000` ms): Thời gian tạm dừng sau khi đạt giới hạn rate-limit.

---

## ❓ Xử lý sự cố (Troubleshooting & CLI Diagnostics)

Nếu hệ thống gặp sự cố, bạn có thể kiểm tra nhanh:

| Vấn đề | Cách xử lý |
| :--- | :--- |
| **Extension báo "Config Invalid"** | Dùng menu **System Diagnostics** để xem chi tiết, sau đó click **Open Raw Config** để sửa. |
| **Daemon không khởi động được** | Kiểm tra Output Channel `Antigravity Auto-Click` trong IDE. Đảm bảo không có tiến trình `node src/core/auto-retry.js` nào bị treo (sử dụng `pgrep -f auto-retry`). |
| **Không nhận diện được nút mới** | Dùng CLI > Developer Tools > **Dump DOM Snapshot** và gửi file mẫu cho đội phát triển. |
| **CDP không kết nối được** | Đảm bảo bạn đã tắt hẳn IDE trước khi mở lại bằng lệnh debug `antigravity`. |

### Giao diện phụ: CLI Menu
Dành cho quản trị nâng cao hoặc khắc phục sự cố nghiêm trọng. Chạy lệnh:
```bash
./scripts/menu.sh
```
**Các tính năng trên CLI:**
- **Cài đặt LaunchAgent**: Để daemon tự động khởi động cùng hệ thống macOS.
- **Developer Tools**: Phân tích DOM trực tiếp hoặc kết xuất DOM Snapshot để phân tích.
- **Reset statistics**: Xóa thống kê click và có tùy chọn xóa sạch file `daemon.log` để giải phóng dung lượng đĩa.

---

## 💻 Dành Cho Nhà Phát Triển (Technical & Development)

### 1. Kiến trúc & Công nghệ (Tech Stack)
- **Core Engine**: Node.js daemon kết nối với Electron renderer qua Chrome DevTools Protocol (CDP) thông qua WebSocket.
- **Extension API**: VS Code extension đóng vai trò là tầng điều khiển, sử dụng `WebviewViewProvider` cho UI.
- **DOM Automation Payload**: Vanilla JS được inject trực tiếp vào DOM của IDE để dò và tương tác với các hộp thoại.
- **Passive Polling & Scoping**: Quét DOM định kỳ, giới hạn phạm vi quét trong các dialog container (e.g., `.monaco-dialog-box`, `.notification-toast`) để giảm thiểu CPU overhead.

### 2. Cấu Trúc Dự Án
```text
antigravity-auto-click/
├── src/                   # Mã nguồn chính
│   ├── extension/         # Logic điều khiển Extension (VS Code)
│   │   └── media/         # UI Assets (CSS, JS) cho Webview
│   ├── core/              # Daemon kết nối CDP & Engine chính
│   └── payload/           # JavaScript inject vào IDE (Detection Logic)
├── scripts/               # Bộ công cụ điều khiển & Script tiện ích
├── package.json           # Cấu hình dự án & scripts build
└── .vscodeignore          # Cấu hình lọc file khi đóng gói VSIX
```

### 3. Quy trình Đóng gói (Packaging VSIX)
Nếu bạn chỉnh sửa mã nguồn và muốn đóng gói lại extension:
1. Chạy lệnh cài đặt thư viện: `npm install`
2. Đóng gói Extension: `npm run package`
   - Lệnh này bỏ qua các kiểm tra nghiêm ngặt về License/Git để nhanh chóng xuất ra file `.vsix` nằm ở thư mục gốc.

### 4. Kiểm thử TDD (Regression Testing)
Trước khi release hoặc sau khi chỉnh sửa logic quét DOM, bắt buộc phải chạy bộ test để tránh regression:
- Chạy toàn bộ suite test trên các mẫu DOM: `npm run test` (hoặc chạy qua CLI tool).
- Tích hợp kiểm thử tính ổn định của extension: `npm run test:extension`.
- Tài liệu chi tiết về cơ chế click và nhận diện nút bấm có thể tham khảo tại [button-identification.md](button-identification.md).
