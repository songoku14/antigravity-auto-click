# Antigravity Auto-Click (Retry & Accept)

Bộ công cụ tự động hóa thao tác click cho Antigravity IDE: Tự động thử lại khi lỗi và Tự động chấp nhận đề xuất từ Agent.

## 1. Bài Toán & Giải Pháp

| Đặc điểm | Chi tiết |
| :--- | :--- |
| **Vấn đề** | Lỗi "High Traffic" yêu cầu click thủ công hoặc các đề xuất Agent cần Accept liên tục. |
| **Công nghệ** | Chrome DevTools Protocol (CDP). Daemon tự dò `--remote-debugging-port` từ tiến trình Antigravity đang chạy. |
| **Giao diện chính** | **Extension (Control Center)**: Tích hợp trực tiếp vào IDE, điều khiển bằng GUI hiện đại, hỗ trợ cài đặt chi tiết và chẩn đoán hệ thống. |
| **Giao diện phụ** | **CLI Menu**: Dùng cho quản trị, cài đặt daemon, developer tools và chạy regression tests. |
| **Tính năng** | **Auto-Retry**: Click "Retry" khi gặp lỗi High Traffic.<br>**Auto-Accept**: Nhận diện nút "Run", "Accept", "Proceed"... theo category: `terminal`, `reviewChange`, `systemReview`. |
| **Bảo vệ** | **Blacklist** chặn các lệnh Terminal nguy hiểm; **Visibility checks** & **Rate-limit** đảm bảo an toàn. |
| **Ưu điểm** | Chính xác cao, linh hoạt, an toàn, hỗ trợ Shadow DOM traversal và đa dạng môi trường (IDE + CLI). |

## 2. Giao diện Vận hành (Control Center)

Antigravity Auto-Click cung cấp trải nghiệm điều khiển hiện đại thông qua **Webview Control Center** tích hợp:

- **Status Bar**: Theo dõi nhanh trạng thái daemon (ON/OFF) và các tính năng (`R` cho Retry, `A` cho Accept). Định dạng: `Auto Click R / A (t|r|s)` hiển thị rõ các category đang hoạt động.
- **Floating Control Center**: Click vào Status Bar để mở bảng điều khiển dạng nổi. Tự động đóng khi bạn quay lại làm việc với code.
- **Bảng Điều Khiển (Dashboard)**:
    - **Toggles**: Bật/tắt nhanh Auto Retry và Auto Accept (với 3 phân cấp: Terminal, Review Change, System Review).
    - **Statistics**: Biểu đồ thống kê số lần click thành công theo từng loại hành động, giúp bạn đánh giá hiệu quả công cụ.
    - **Blacklist Management**: Quản lý danh sách lệnh bị chặn bằng giao diện **Tags** trực quan. Thêm lệnh mới hoặc xóa lệnh cũ chỉ với một click.
- **System Diagnostics**: Kiểm tra sức khỏe hệ thống (CDP port, Config validity, Logs) ngay trong Webview để xử lý sự cố nhanh chóng.

## 3. Cấu Trúc Dự Án

```text
antigravity-auto-click/
├── src/                   # Mã nguồn chính
│   ├── extension/         # Logic điều khiển Extension (VS Code)
│   │   └── media/         # UI Assets (CSS, JS) cho Webview
│   ├── core/              # Daemon kết nối CDP & Engine chính
│   └── payload/           # JavaScript inject vào IDE (Detection Logic)
├── scripts/               # Bộ công cụ điều khiển & Script tiện ích
├── package.json           # Cấu hình dự án & scripts build
├── .vscodeignore          # Cấu hình lọc file khi đóng gói VSIX
└── tutorial.md            # Hướng dẫn sử dụng chi tiết
```

## 4. Hướng Dẫn Nhanh

**Bước 1: Bật chế độ Debug cho IDE**
Chạy lệnh sau để IDE luôn mở với port debug:
```bash
echo 'alias antigravity="open -a Antigravity --args --remote-debugging-port=31905"' >> ~/.zshrc && source ~/.zshrc
```

**Bước 2: Cài đặt Extension**
1. Tải file `.vsix` từ bản phát hành mới nhất.
2. Mở Antigravity, kéo thả file `.vsix` vào IDE để cài đặt.

**Bước 3: Sử dụng**
- Click vào biểu tượng **Auto Click** ở Status Bar để bật **Control Center**.
- Các tính năng sẽ tự động đồng bộ hóa trạng thái giữa UI và Daemon.
- Dùng CLI (`./scripts/menu.sh`) cho các tác vụ nâng cao như cài đặt LaunchAgent hoặc Regression Tests.

## 5. Kiến trúc Dữ liệu & Tính Đồng bộ

Hệ thống đảm bảo tính nhất quán tuyệt đối giữa CLI và Extension thông qua cơ chế lưu trữ tập trung.

### Thư mục Lưu trữ Chuẩn (Canonical Storage)
Mọi cấu hình và dữ liệu hoạt động được lưu trữ tại một vị trí cố định trên hệ điều hành, độc lập với thư mục cài đặt mã nguồn:
- **macOS**: `~/Library/Application Support/Antigravity/Auto Click/`
- **Cấu trúc**:
    - `config.json`: File cấu hình chung duy nhất.
    - `logs/activity-log.json`: Nhật ký click và thống kê real-time.
    - `logs/daemon.log`: Log chi tiết quá trình chạy ngầm.

> [!TIP]
> Bạn có thể thay đổi vị trí này bằng cách thiết lập biến môi trường `ANTIGRAVITY_AUTO_CLICK_HOME`.

### Cơ chế Đồng bộ (Single Source of Truth)
- **Tất cả các thành phần** (Extension UI, Background Daemon, CLI Scripts) đều trỏ về cùng một file `config.json` và `activity-log.json` nêu trên.
- Khi bạn gạt nút trên Webview, Extension sẽ ghi vào `config.json`. Daemon đang chạy ngầm sẽ nhận thấy thay đổi thông qua **Watcher** và tải lại logic ngay lập tức. Ngược lại, khi Daemon click thành công, nó ghi vào `activity-log.json` và UI sẽ cập nhật biểu đồ thống kê sau 1 giây.

## 6. Phát triển & Đóng gói (Development)

Nếu bạn muốn chỉnh sửa code và đóng gói lại:
1. **Cài đặt dependencies**: `npm install`
2. **Build & Package**: `npm run package`
   - Câu lệnh này sẽ tự động bỏ qua các kiểm tra nghiêm ngặt về License/Git để đảm bảo build file `.vsix` thành công ngay lập tức.
   - File `.vsix` sinh ra sẽ nằm ngay tại thư mục gốc.
3. **Kiểm thử TDD**: 
    - `npm run test`: Chạy Regression tests trên DOM samples.
    - `npm run test:extension`: Kiểm tra tính ổn định của Extension.

## 7. Tham chiếu Kỹ thuật (Technical Reference)

### Cấu trúc file `config.json`
Hệ thống sử dụng schema tự động chuẩn hóa (`src/core/config-schema.js`):
- **interval**: Tốc độ quét DOM (mặc định: `1000ms`).
- **maxRetries**: Giới hạn số lần click retry cho cùng một lỗi (mặc định: `5`).
- **actionCategories**:
    - `terminal`: Target các nút `Run`, `Execute`. Có kiểm tra `blacklist`.
    - `reviewChange`: Target các nút `Proceed`, `Accept All`.
    - `systemReview`: Các hội thoại hệ thống (Agent Side Panel).
- **blacklist**: Mảng các prefix lệnh bị chặn (ví dụ: `rm `, `sudo `, `push `).

### Cơ chế Watcher (Đồng bộ thời gian thực)
Để đảm bảo UI và CLI luôn khớp nhau mà không cần restart:
- **Daemon Layer**: `ConfigStore` sử dụng `fs.watch` trên thư mục chứa config. Khi file `config.json` thay đổi, hệ thống sẽ đợi 300ms (debounce) rồi tải lại toàn bộ logic.
- **Extension Layer**:
    - Sử dụng `fs.watch` (với fallback sang `createFileSystemWatcher` của VS Code) để theo dõi `config.json` (cập nhật UI Toggles - debounce 300ms) và `activity-log.json` (cập nhật thống kê real-time - debounce 1000ms).
    - Các mức debounce này đảm bảo hiệu năng và tránh tranh chấp file khi nhiều tiến trình ghi đồng thời.

---
*Xem thêm chi tiết tại [tutorial.md](tutorial.md).*
