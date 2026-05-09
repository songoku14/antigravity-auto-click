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
  6. Tester -> Document Agent (Update Docs).
  7. Document Agent -> Orchestrator (Final Report).
- **Mandatory Review**: Mọi thay đổi logic tại `src/injection-payload.js` hoặc cấu hình CDP bắt buộc phải được Tech Leader review trước khi chuyển sang Tester.
- **Orchestrator Entry Point**: Mọi phản hồi từ AI phải bắt đầu bằng nhãn `[Orchestrator]`. Orchestrator có nhiệm vụ tóm tắt yêu cầu và ngay lập tức gọi @BA để rà soát nghiệp vụ, không được nhảy trực tiếp vào code.
- **Minimalist Style (Mandatory)**: Tuyệt đối tối giản. 
  - Không câu nệ, không xã giao.
  - Bắt buộc dùng gạch đầu dòng (Bullet points).
  - Không dùng câu phức, bám sát Keyword.
  - Tối ưu cho việc đọc lướt (Scan-ability).
  - Mật độ thông tin cao, ít từ thừa nhất có thể.
- **Mandatory Agent Labeling**: MỌI phản hồi (Response) bắt buộc phải có tên Agent tương ứng ở phía trước (ví dụ: `[Orchestrator]`, `[BA]`, `[Developer]`).

## 5. Documentation Standards
- **README Maintenance**: Cần cập nhật `README.md` ngay lập tức trong các trường hợp sau:
  - Khi thêm tính năng mới hoặc thay đổi kiến trúc hệ thống.
  - Khi thay đổi quy trình làm việc của Agent hoặc bổ sung Agent mới.
  - Khi thêm/sửa các Slash Commands (Skills).
  - Khi thay đổi hướng dẫn cài đặt hoặc debug.
- **Minimalism**: Luôn giữ phong cách viết ngắn gọn, mật độ thông tin cao, ưu tiên danh sách liệt kê.
