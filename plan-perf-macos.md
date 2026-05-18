# Plan 1: Nâng cấp Hiệu năng macOS

> **Mục tiêu:** Loại bỏ `ps aux` ra khỏi hot path (mỗi 5 giây).
> Các thao tác 1 lần (stop, quit, clipboard, check-running) hoặc các thao tác fallback (khi mất kết nối) **không cần tối ưu**.

---

## Phân tích Vấn đề

Mỗi 5 giây, `daemon.js` → `cycle()` gọi 2 lần `ps aux | grep`:

```
cycle() mỗi 5s:
  ├── findAntigravityPID()  → ps aux | grep "Antigravity.app"   ← ~80ms
  └── findCDPPort()         → ps aux | grep "remote-debugging"  ← ~80ms
                                                      Tổng: ~160ms/5s
```

**Context đã biết qua QA:**
- **Q1:** Port CDP do **user tự cấu hình** khi launch Antigravity (không cố định). Vì vậy không thể hardcode list port.
- **Q2:** Việc gọi `ps aux` nếu chỉ chạy 1 lần lúc startup hoặc khi fallback (mất kết nối) thì **không cần tối ưu**. 

Do đó, chúng ta chỉ cần giải quyết vấn đề gọi `ps aux` lặp đi lặp lại mỗi 5s bằng một **Fast Path**, và giữ nguyên `ps aux` ở **Slow Path** (fallback).

---

## Giải pháp: Fast Path (Cached CDP Port, Bỏ qua `ps aux`)

**Logic:** Sau khi slow path tìm được PID/port lần đầu, daemon lưu lại `lastPID` và `lastPort`.

Khi còn WebSocket connection sống và có `lastPort`:
- **Không gọi** `findAntigravityPID()` → bỏ `ps aux`
- **Không gọi** `findCDPPort()` → bỏ `ps aux`
- Vẫn gọi `getTargets(lastPort)` qua local HTTP để phát hiện target mới và dọn target stale như logic hiện tại
- Nếu `getTargets(lastPort)` fail hoặc không còn live connection → quay lại slow path để rediscover PID/port bằng `ps aux`

Điểm quan trọng: fast path **không return ngay chỉ vì còn connection sống**, vì `cycle()` hiện tại còn có trách nhiệm phát hiện page target mới từ `/json`.

```js
async cycle() {
  // FAST PATH: connections alive + cached port → skip ps aux
  const liveConns = [...this.connections.values()].filter(c => c.isConnected);
  if (liveConns.length > 0 && this.lastPort) {
    try {
      const targets = await getTargets(this.lastPort);
      await this.reconcileTargets(targets);
      return; // Không gọi findAntigravityPID/findCDPPort
    } catch (e) {
      this.debug(`Cached CDP port failed: ${e.message}`);
      this.disconnectAll();
      this.lastPID = null;
      this.lastPort = null;
      // fall through sang slow path
    }
  }

  // SLOW PATH: startup / mất connection / cached port fail
  const currentPID = findAntigravityPID();
  if (!currentPID) {
    this.disconnectAll();
    this.lastPID = null;
    this.lastPort = null;
    return;
  }

  if (this.lastPID && this.lastPID !== currentPID) {
    this.disconnectAll();
    this.lastPort = null;
  }
  this.lastPID = currentPID;

  const port = findCDPPort();
  if (!port) return;

  this.lastPort = port;
  const targets = await getTargets(port);
  await this.reconcileTargets(targets);
}
```

`reconcileTargets(targets)` là phần logic hiện đang nằm trong `cycle()`:
- `filterPageTargets(targets)`
- connect/inject target mới
- re-inject target cũ nếu cần
- dọn connection không còn nằm trong `pageTargets`

**Kết quả:**
- Khi Antigravity chạy ổn định → bỏ cả 2 lần `ps aux`; chỉ còn local HTTP `/json` để đồng bộ target
- Chỉ vào slow path khi khởi động hoặc mất connection (fallback), thỏa mãn yêu cầu không cần cải thiện đoạn này.

**Files cần sửa:** `src/core/daemon.js`

---

## Bảng Tóm tắt

| ID | Công việc | Files | Effort | Kết quả |
|----|-----------|-------|--------|---------|
| P1 | Lưu `lastPort`, fast path dùng `getTargets(lastPort)` thay vì `ps aux` | `src/core/daemon.js` | 0.5h | Bỏ `findAntigravityPID()` và `findCDPPort()` khỏi hot path |
| P2 | Tách reconcile target khỏi `cycle()` để dùng chung fast/slow path | `src/core/daemon.js` | 0.5h | Giữ nguyên khả năng inject target mới và cleanup stale target |

**Không làm (giữ nguyên logic cũ vì chạy 1 lần/fallback - không cần tối ưu):**
- Tìm port bằng TCP Probe (bỏ qua do user có thể chọn port bất kỳ và logic fallback `ps aux` đã đủ tốt).
- Check daemon running (pgrep, 1 lần).
- Stop daemon (bash+pkill, 1 lần).
- Copy CDP command (pbcopy, 1 lần).
- Quit Antigravity (osascript, 1 lần).

---

## Luồng Hoàn chỉnh Sau Khi Làm

```
cycle() mỗi 5s:
  ├─ [FAST PATH] Có live connection + cached port?
  │    ├─ Có → getTargets(lastPort)
  │    │      ├─ Thành công → reconcile targets → return
  │    │      └─ Fail → clear cache/connections → slow path
  │
  └─ [SLOW PATH] Mất connection / Khởi động:
       ├─ findAntigravityPID() (ps aux)
       │    ├─ Không có PID → clear cache/connections → return
       │    └─ PID đổi → disconnect old connections
       └─ findCDPPort() (ps aux)
            ├─ Không có port → return
            └─ Lưu lastPID/lastPort → getTargets(port) → reconcile targets
```
