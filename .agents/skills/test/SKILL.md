---
name: test
description: Chạy regression test trên DOM samples theo cùng cơ chế với CLI Test DOM Samples, hỗ trợ Auto Retry, Auto Accept theo category, và tổng kết kết quả cuối.
---
# Skill: Antigravity Test (/test)

## Agent Roles
- **Tester**: Chạy regression test trên `samples/` và báo cáo kết quả có bằng chứng.

## Constraints
- **READ-ONLY**: Skill này chỉ dùng để kiểm thử và báo cáo.
- **NO CODE MODIFICATIONS**: Không sửa source code, script, config trong khi chạy `/test`.

## Nguồn kiểm thử chuẩn
- Luôn dùng cùng cơ chế như `CLI > Developer Tools > Test DOM Samples (Regression)`.
- Lệnh gốc:
```bash
node scripts/tests/regression.js [pattern]
```
- Không dùng các script trigger dialog cũ như `trigger-test.js`, `trigger-accept-test.js`, `trigger-danger-test.js`.

## Cách hiểu mode test
- `Auto Retry`: Chỉ test các mẫu liên quan tới Retry / High Traffic / Agent terminated.
- `Auto Accept`: Test các mẫu Accept. Nếu người dùng có đưa category thì chỉ test category đó.
- `Blacklist`: Kiểm tra khả năng chặn các lệnh nguy hiểm (ví dụ: `rm`, `sudo`) trong Terminal và đảm bảo Review không bị chặn nhầm.
- `All`: Chạy toàn bộ sample hiện có, kèm các scenario tổng hợp có sẵn trong `scripts/tests/regression.js`.

## Mapping mode -> lệnh chạy

### 1. Auto Retry
```bash
node scripts/tests/regression.js Retry
```

### 2. Auto Accept

#### A. Không chỉ định category
- Chạy lần lượt các pattern đại diện cho toàn bộ nhóm Auto Accept đang có trong `samples/`:
```bash
node scripts/tests/regression.js Run
node scripts/tests/regression.js Proceed
node scripts/tests/regression.js Accept_all
```

#### B. Có chỉ định category
- `terminal`
```bash
node scripts/tests/regression.js Run
```
- `review`
```bash
node scripts/tests/regression.js Proceed
node scripts/tests/regression.js Accept_all
```
- `system`
```bash
node scripts/tests/regression.js System
```
- Nếu pattern/category không tìm thấy sample phù hợp trong `samples/`, phải báo rõ `không có sample khớp` thay vì suy diễn PASS.

### 3. Blacklist
- Chạy các mẫu cụ thể có chứa keyword blacklist:
```bash
node scripts/tests/regression.js blacklist
node scripts/tests/regression.js black_list
```

### 4. All
```bash
node scripts/tests/regression.js
```

## Execution Steps
1. Xác định mode từ yêu cầu người dùng: `retry`, `accept`, `accept <category>`, `blacklist`, hoặc `all`.
2. Chạy đúng lệnh regression tương ứng như phần mapping ở trên.
3. Dùng chính output của `scripts/tests/regression.js` làm bằng chứng:
   - Tên sample/scenario đã chạy.
   - Các dòng `PASS` / `FAIL`.
   - Dòng tổng kết `KẾT QUẢ: passed/total`.
4. Nếu mode `Auto Accept` phải chạy nhiều lệnh, cần tổng hợp kết quả của tất cả lần chạy thành một báo cáo cuối.
5. Không yêu cầu quan sát UI thủ công nếu regression output đã đủ bằng chứng.

## Quy tắc báo cáo
- Báo cáo phải có 2 phần:
  1. **Kết quả từng lệnh**: command, phạm vi test, `passed/total`, các ca fail hoặc không có sample.
  2. **Tổng kết toàn bộ**: cộng dồn tất cả run trong phiên test hiện tại.
- Mẫu tổng kết tối thiểu:
  - `Mode`
  - `Commands executed`
  - `Matched samples/scenarios`
  - `Passed / Total`
  - `Failed cases`
  - `Missing categories or samples`

## Ghi chú category hiện có
- `terminal`: hiện map tốt nhất với pattern `Run`.
- `review`: hiện map với `Proceed` và `Accept_all`.
- `system`: chỉ chạy khi có yêu cầu rõ ràng; nếu repo chưa có sample khớp thì phải báo thiếu coverage.
