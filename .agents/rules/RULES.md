# Antigravity Auto-Retry Rules

## 1. General Principles
- **API > GUI**: Ưu tiên CDP, WebSockets, IPC. Bỏ qua AppleScript, OCR.
- **Fail Gracefully**: Lỗi thì im lặng, không block user.
- **Rate Limiting**: Bắt buộc giới hạn số lần retry/phút. Tránh crash, ban IP.

## 2. Code Standards
- **Vanilla JS**: Chỉ dùng ES6+. Không React, jQuery trong payload.
- **Non-blocking**: Tối ưu DOM. Dùng `MutationObserver` đúng cách:
  - Không observe `attributes`, `characterData` nếu không cần.
  - Debounce/setTimeout chờ DOM ổn định.

## 3. Tool Specific
- **Antigravity/VS Code**: Tìm DOM trong `.monaco-dialog-box`, `.notification-toast`. Cấm quét toàn bộ file.
- **CDP**: Cẩn thận `Runtime.evaluate`. Luôn bọc code trong IIFE.

## 4. Multi-Agent Workflow
- **Collaboration Chain**: 
  1. BA (Requirements) -> Orchestrator (Planning).
  2. Orchestrator -> Tech Leader (Plan Review).
  3. Orchestrator -> Developer (Implementation).
  4. Developer -> Tech Leader (Code Review).
  5. Tech Leader -> Tester (Validation).
  6. Tester -> Orchestrator (Final Report).
- **Mandatory Review**: Mọi thay đổi logic tại `src/injection-payload.js` hoặc cấu hình CDP bắt buộc phải được Tech Leader review trước khi chuyển sang Tester.
- **Task Tracking**: Luôn sử dụng `task.md` để theo dõi tiến độ và trạng thái của từng bước trong chain.
- **Communication Standard**: Mỗi phản hồi hoặc hành động phải được bắt đầu bằng nhãn Agent tương ứng trong dấu ngoặc vuông. Ví dụ: `[Orchestrator]`, `[Developer]`, `[Tech Leader]`. Sử dụng plain text, không dùng emoji để tiết kiệm token.

## 5. Documentation Standards
- **README Maintenance**: Cần cập nhật `README.md` ngay lập tức trong các trường hợp sau:
  - Khi thêm tính năng mới hoặc thay đổi kiến trúc hệ thống.
  - Khi thay đổi quy trình làm việc của Agent hoặc bổ sung Agent mới.
  - Khi thêm/sửa các Slash Commands (Skills).
  - Khi thay đổi hướng dẫn cài đặt hoặc debug.
- **Minimalism**: Luôn giữ phong cách viết ngắn gọn, mật độ thông tin cao, ưu tiên danh sách liệt kê.
