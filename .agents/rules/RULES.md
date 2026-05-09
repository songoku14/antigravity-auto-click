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
- Đọc `agents/` theo role (Orchestrator, Developer).
- Hoàn thành task -> Test -> Chuyển tiếp.
