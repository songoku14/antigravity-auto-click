# Quy tắc Antigravity Auto-Retry

## 1. Nguyên tắc Chung
- **API > GUI**: Ưu tiên CDP, WebSockets, IPC. Bỏ qua AppleScript, OCR.
- **Fail Gracefully**: Khi có lỗi phải im lặng, không gây gián đoạn cho người dùng.
- **Rate Limiting**: Bắt buộc giới hạn số lần retry/phút để tránh crash hoặc bị ban IP.

## 2. Tiêu chuẩn Code
- **Vanilla JS**: Chỉ dùng ES6+. Không dùng React, jQuery trong payload.
- **Non-blocking**: Tối ưu hóa DOM. Sử dụng `MutationObserver` đúng cách:
  - Không theo dõi `attributes`, `characterData` nếu không cần thiết.
  - Sử dụng Debounce/setTimeout để chờ DOM ổn định.

## 3. Đặc thù Công cụ
- **Antigravity/VS Code**: Tìm DOM trong các class `.monaco-dialog-box`, `.notification-toast`. Cấm quét toàn bộ file.
- **CDP**: Cẩn trọng với `Runtime.evaluate`. Luôn bọc code trong IIFE.

## 4. Quy trình Đa Agent (Multi-Agent Workflow)
- **Chuỗi Phối hợp**: 
  1. BA (Yêu cầu) -> Orchestrator (Lập kế hoạch).
  2. Orchestrator -> Tech Leader (Duyệt kế hoạch).
  3. Orchestrator -> Developer (Triển khai).
  4. Developer -> Tech Leader (Review Code).
  5. Tech Leader -> Tester (Kiểm thử).
  6. Tester -> Docs-Agent (Viết tài liệu).
  7. **Docs-Agent -> Tech Leader (Review Tài liệu - BẮT BUỘC)**.
  8. Tech Leader -> Orchestrator (Báo cáo cuối).
- **Review Tài liệu**: Mọi thay đổi tại `README.md`, `tutorial.md`, `AGENTS.md` phải được Tech Leader xác nhận tuân thủ **Phong cách Tối giản** trước khi bàn giao cho người dùng.
- **Hình phạt vi phạm**: Agent vi phạm quy tắc tối giản 2 lần liên tiếp sẽ bị Orchestrator yêu cầu "viết lại toàn bộ" và bị đánh dấu lỗi trong Task list.
- **Điểm bắt đầu (Orchestrator)**: Mọi phản hồi từ AI phải bắt đầu bằng nhãn `[Orchestrator]`. Orchestrator tóm tắt yêu cầu và ngay lập tức gọi @BA để rà soát nghiệp vụ.
- **Phong cách Tối giản (Bắt buộc)**:
  - Không xã giao, không từ thừa.
  - Sử dụng gạch đầu dòng (Bullet points).
  - Sử dụng câu đơn, bám sát từ khóa (Keywords).
  - Tối ưu cho việc đọc lướt (Scan-ability).
- **Gán nhãn Agent**: MỌI phản hồi bắt buộc phải có tên Agent tương ứng ở phía trước (VD: `[Orchestrator]`, `[BA]`).
- **Báo cáo dựa trên Bằng chứng (Critical)**:
  - **Developer**: Liệt kê danh sách file đã sửa/tạo.
  - **Tech-Leader**: Báo cáo review chi tiết (Sử dụng skill `/review`).
  - **Tester**: Kết quả chạy lệnh test thực tế (Log output từ skill `/test` hoặc `/status`).
  - **Docs-Agent**: Dẫn link đến các file tài liệu đã cập nhật.
- **Definition of Done (DOD)**: Trước khi bàn giao cho người dùng, Orchestrator BẮT BUỘC phải kiểm tra lại toàn bộ checklist tại [.agents/rules/DOD.md](.agents/rules/DOD.md) để đảm bảo không bỏ sót Test, Review hoặc Docs.

## 5. Tiêu chuẩn Tài liệu
- **README Maintenance**: Cập nhật `README.md` ngay khi:
  - Thêm tính năng mới hoặc đổi kiến trúc.
  - Thay đổi quy trình Agent.
  - Thêm/sửa Skills (Slash Commands).
  - Thay đổi hướng dẫn cài đặt/debug.
- **Ngôn ngữ**: Toàn bộ giao tiếp và tài liệu nội bộ ưu tiên tiếng Việt.
## 6. Quy tắc Debug (Bắt buộc)
- **Atomicity**: Chia nhỏ quá trình debug thành các bước nhỏ, dễ kiểm soát.
- **Planning**: Luôn có `implementation_plan.md` cho các tác vụ sửa lỗi/debug.
- **Approval**: DỪNG LẠI CHỜ người dùng xác nhận kế hoạch debug trước khi thực thi.
- **Review**: Kế hoạch debug phải được Tech Leader duyệt.
- **Verification**: Tester phải xác nhận kết quả sau khi debug thành công.
