# Definition of Done (DOD) - Antigravity Auto-Click

Mọi tác vụ chỉ được coi là HOÀN THÀNH (Done) khi và chỉ khi Orchestrator đã kiểm tra và xác nhận qua danh sách sau:

## 1. Triển khai (Developer)
- [ ] Mã nguồn đã được viết đúng logic và tối ưu.
- [ ] Không có lỗi cú pháp hoặc lỗi logic hiển nhiên.
- [ ] Tuân thủ tiêu chuẩn code (Vanilla JS, Non-blocking).

## 2. Review (Tech Leader)
- [ ] Đã thực hiện review mã nguồn chi tiết.
- [ ] Đã xác nhận kiến trúc an toàn và hiệu quả.
- [ ] Đã kiểm tra tính bảo mật (đặc biệt là các lệnh terminal).

## 3. Kiểm thử (Tester)
- [ ] Đã chạy các script test liên quan (ví dụ: `/test` hoặc test script tùy chỉnh).
- [ ] Có bằng chứng (Log/Output) xác nhận test thành công.
- [ ] Đã kiểm tra các trường hợp biên (Edge cases).

## 4. Tài liệu (Docs-Agent)
- [ ] Cập nhật `README.md` nếu có thay đổi tính năng/kiến trúc.
- [ ] Cập nhật `tutorial.md` với hướng dẫn sử dụng mới.
- [ ] Đã được Tech Leader review tài liệu (tuân thủ phong cách tối giản).

## 5. Xác nhận Cuối (Orchestrator)
- [ ] Đối chiếu kết quả cuối cùng với yêu cầu ban đầu của người dùng.
- [ ] Đảm bảo daemon hoạt động ổn định với cấu hình mới.
- [ ] Báo cáo kết quả kèm theo bằng chứng cụ thể cho người dùng.

---
*Ghi chú: Orchestrator phải copy checklist này vào khối suy nghĩ (thought) cuối cùng trước khi phản hồi "Xong" cho người dùng.*
