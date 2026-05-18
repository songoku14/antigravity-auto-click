# Plan 2: Hỗ trợ Windows sau Plan 1 macOS Perf

> **Tiên quyết:** Triển khai xong [Plan 1: Nâng cấp Hiệu năng macOS](plan-perf-macos.md).
>
> **Phạm vi Plan 1 thực tế:** Plan 1 chỉ thêm Fast Path trong `src/core/daemon.js` bằng `lastPort` + `getTargets(lastPort)` để bỏ `ps aux` khỏi hot path mỗi 5 giây. Plan 1 **không** tạo PID file, **không** thay stop script, **không** đổi clipboard, và **không** thay toàn bộ macOS subprocess bằng pure Node.js.
>
> **Mục tiêu Plan 2:** Thêm Windows support mà không làm hỏng macOS flow đã có. Windows process scan chỉ nằm ở Slow Path; Extension lifecycle và install/uninstall phải có platform branch riêng.

---

## Kiến trúc Tổng thể

```
Sau Plan 1 đã có:
  Daemon Fast Path
    live WebSocket + cached CDP port -> getTargets(lastPort) -> reconcileTargets()
    => không scan process trong hot path

Plan 2 cần thêm:
  Discovery Slow Path
    macOS   -> ps aux fallback hiện có
    Windows -> PowerShell/CIM fallback mới

  Extension lifecycle
    macOS   -> pgrep/bash stop.sh/pbcopy/osascript hiện có
    Windows -> PowerShell/taskkill/VS Code clipboard hoặc platform clipboard

  Install/Uninstall
    macOS   -> LaunchAgent hiện có
    Windows -> Task Scheduler user-level
```

**Quyết định quan trọng:**
- Không dùng `wmic` làm primary path. WMIC đã deprecated và Windows 11 24H2/25H2 có thể không cài sẵn. PowerShell/CIM là primary; `wmic` chỉ là optional legacy fallback nếu cần.
- Không dựa vào PID file trong Plan 2 trừ khi thêm task riêng để tạo/maintain PID file. Plan 1 không có PID file.
- CDP port không hardcode. Port do user tự launch Antigravity với `--remote-debugging-port=...`; Windows discovery phải đọc command line process như macOS slow path.

---

## Phần 1: Core Discovery Windows

### W1: `src/core/discovery.js` - Platform Branch cho Slow Path

**Bối cảnh:** Sau Plan 1, `findAntigravityPID()` và `findCDPPort()` chỉ chạy lúc startup, mất connection, hoặc cached port fail. Windows chỉ cần support Slow Path này.

**Thay đổi:**
- Tách hàm hiện có thành macOS helpers:
  - `findAntigravityPIDMac()`
  - `findCDPPortMac()`
  - `isAntigravityRunningMac()`
- Thêm Windows helpers:
  - `getAntigravityProcessesWin()`
  - `findAntigravityPIDWin()`
  - `findCDPPortWin()`
  - `isAntigravityRunningWin()`
- Public API giữ nguyên:
  - `findAntigravityPID()`
  - `findCDPPort()`
  - `isAntigravityRunning()`

**Primary Windows command: PowerShell/CIM**

```js
function getAntigravityProcessesWin() {
  const command = [
    'powershell.exe',
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-Command',
    [
      '$p = Get-CimInstance Win32_Process -Filter "Name = \'Antigravity.exe\'"',
      '$p | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress'
    ].join('; ')
  ];

  const out = execFileSync(command[0], command.slice(1), {
    encoding: 'utf8',
    timeout: 5000,
    windowsHide: true
  }).trim();

  if (!out) return [];
  const parsed = JSON.parse(out);
  return Array.isArray(parsed) ? parsed : [parsed];
}
```

**Parse CDP port từ command line:**

```js
function findCDPPortWin() {
  for (const proc of getAntigravityProcessesWin()) {
    const match = String(proc.CommandLine || '').match(/--remote-debugging-port=(\d+)/);
    if (match) return Number.parseInt(match[1], 10);
  }
  return null;
}
```

**Fallback optional:** Nếu PowerShell/CIM fail, có thể thử `wmic` để hỗ trợ Windows cũ, nhưng không ghi trong docs là bắt buộc.

**Files thay đổi:**
- `src/core/discovery.js`

---

## Phần 2: Extension Lifecycle Cross-Platform

### W2: `src/extension/daemon-service.js` - Running/Stop không phụ thuộc `pgrep` trên Windows

**Vấn đề hiện tại:** Extension đang dùng `pgrep -f "node.*src/core/auto-retry.js"` và `bash scripts/core/stop.sh`, không chạy trên Windows.

**Thay đổi đề xuất:**
- Tạo helper `isDaemonRunning()` có platform branch.
- macOS giữ logic hiện có để giảm blast radius.
- Windows dùng PowerShell/CIM scan Node command line:

```powershell
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
  Where-Object { $_.CommandLine -match 'src[\\/]+core[\\/]+auto-retry\.js' }
```

**Stop Windows:**
- Nếu daemon do extension spawn và còn `daemonProcess`: `daemonProcess.kill('SIGTERM')`.
- Nếu là external process: PowerShell Stop-Process các `node.exe` có command line match `src/core/auto-retry.js`.
- Không gọi `bash scripts/core/stop.sh` trên Windows.

**Files thay đổi:**
- `src/extension/daemon-service.js`

---

### W3: `src/extension/daemon-service.js` - CDP Launch Command và Clipboard

**Vấn đề hiện tại:** `copyCDPCommand()` hardcode macOS command và dùng `pbcopy`.

**Thay đổi đề xuất:**
- Tách helper `getCDPLaunchCommand()`.
- macOS giữ command hiện có:
  ```sh
  open -a "/Applications/Antigravity.app" --args --remote-debugging-port=31905
  ```
- Windows trả về command PowerShell hướng dẫn user launch bằng app alias/path:
  ```powershell
  Start-Process -FilePath "Antigravity.exe" -ArgumentList "--remote-debugging-port=31905"
  ```
- Nếu extension layer có sẵn `vscode.env.clipboard`, ưu tiên dùng API đó thay vì shell clipboard.
- Nếu cần shell fallback:
  - macOS: `pbcopy`
  - Windows: PowerShell `Set-Clipboard`

**Open point:** Cần xác nhận Windows app executable/app alias của Antigravity. Không hardcode `C:\Program Files\...` vào runtime cho tới khi có bằng chứng.

**Files thay đổi:**
- `src/extension/daemon-service.js`

---

### W4: `src/extension/daemon-service.js` - Quit Antigravity trên Windows

**Thay đổi đề xuất:**
- macOS giữ `osascript`, fallback `pkill`.
- Windows dùng `taskkill`:
  - Thử graceful: `taskkill /IM Antigravity.exe`
  - Nếu fail hoặc timeout: `taskkill /F /IM Antigravity.exe`
- Luôn resolve true/false theo kết quả, không throw ra UI.

**Files thay đổi:**
- `src/extension/daemon-service.js`

---

## Phần 3: Windows Install/Uninstall Lifecycle

### W5: `scripts/install.ps1` - Windows Installer bằng Task Scheduler

**Cơ chế:** Windows Task Scheduler user-level thay macOS LaunchAgent.

**Lý do chọn Task Scheduler:**
| Tiêu chí | Task Scheduler | Windows Service |
|----------|----------------|-----------------|
| Cần admin | Không | Có |
| Chạy trong user session | Có | Phức tạp |
| Kết nối CDP của user | Phù hợp | Dễ sai session |
| Độ phức tạp | Thấp | Cao |

**Nội dung chính:**

```powershell
param(
  [string]$NodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
)

$TaskName = "AntigravityAutoRetry"
$ScriptRoot = Split-Path -Parent $PSScriptRoot
$ScriptPath = Join-Path $ScriptRoot "src\core\auto-retry.js"
$ConfigDir = Join-Path $env:APPDATA "Antigravity\Auto Click"
$LogDir = Join-Path $ConfigDir "logs"
$DaemonLog = Join-Path $LogDir "daemon.log"

if (-not $NodePath) {
  Write-Error "Node.js not found. Install Node.js >= 18."
  exit 1
}

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

Push-Location $ScriptRoot
npm install --production
Pop-Location

$NodeArgs = @(
  "`"$ScriptPath`"",
  "--config", "`"$ConfigDir\config.json`"",
  "--logs", "`"$LogDir`""
) -join " "

# Task Scheduler không có stdout/stderr redirect trực tiếp trong New-ScheduledTaskAction.
# Chạy qua powershell để redirect log.
$PsArgs = "-NoProfile -ExecutionPolicy Bypass -Command `"cd '$ScriptRoot'; & '$NodePath' $NodeArgs *>> '$DaemonLog'`""

$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $PsArgs
$Trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$Settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit 0 -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -RunLevel Limited | Out-Null
Start-ScheduledTask -TaskName $TaskName
```

**Files thêm mới:**
- `scripts/install.ps1`

---

### W6: `scripts/uninstall.ps1` - Windows Uninstaller

**Không dùng PID file** vì Plan 1 không tạo PID file.

**Nội dung chính:**
- `Stop-ScheduledTask -TaskName AntigravityAutoRetry`
- Kill external daemon process bằng PowerShell/CIM match `node.exe` command line có `src/core/auto-retry.js`
- `Unregister-ScheduledTask`
- Giữ lại config/log files

```powershell
$TaskName = "AntigravityAutoRetry"

Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
  Where-Object { $_.CommandLine -match 'src[\\/]+core[\\/]+auto-retry\.js' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
```

**Files thêm mới:**
- `scripts/uninstall.ps1`

---

### W7: `package.json` - Thêm npm scripts Windows

```json
{
  "scripts": {
    "install-agent:win": "powershell -ExecutionPolicy Bypass -File scripts/install.ps1",
    "uninstall-agent:win": "powershell -ExecutionPolicy Bypass -File scripts/uninstall.ps1"
  }
}
```

**Ghi chú:** Không đổi `"stop"` sang Node trong Plan 2 trừ khi có task riêng port `scripts/core/stop.sh` thành `scripts/core/stop.js`. Nếu cần stop cross-platform qua CLI, thêm W9 riêng.

**Files thay đổi:**
- `package.json`

---

## Phần 4: Documentation

### W8: `README.md` - Thêm Windows Installation Section

Cần ghi rõ:
- Windows 10/11
- Node.js >= 18
- PowerShell 5+
- Cài bằng:
  ```powershell
  npm run install-agent:win
  ```
- Gỡ cài bằng:
  ```powershell
  npm run uninstall-agent:win
  ```
- User phải launch Antigravity với CDP flag. Port trong docs có thể dùng `31905` làm ví dụ, không nói là bắt buộc:
  ```powershell
  Start-Process -FilePath "Antigravity.exe" -ArgumentList "--remote-debugging-port=31905"
  ```

**Files thay đổi:**
- `README.md`

---

### W9: `.agents/context/project-context.md` - Cập nhật Architecture

Cập nhật:
- Storage Windows đã có sẵn trong `src/core/storage-paths.js`: `%APPDATA%\Antigravity\Auto Click\`
- Auto-start: macOS LaunchAgent / Windows Task Scheduler
- Tech stack: thêm Windows Task Scheduler, PowerShell/CIM
- Operational boundary: discovery process scan chỉ là fallback, hot path ưu tiên cached CDP port từ Plan 1.

**Files thay đổi:**
- `.agents/context/project-context.md`

---

## Thứ tự Thực hiện

```
[Tiên quyết] Plan 1 hoàn thành:
  P1: lastPort Fast Path trong daemon.js
  P2: reconcileTargets() dùng chung fast/slow path
     |
     v
W1: discovery.js platform branch cho Windows Slow Path
     |
     v
W2: daemon-service.js isRunning/stop Windows
W3: daemon-service.js launch command/clipboard
W4: daemon-service.js quitAntigravity Windows
     |
     v
W5: scripts/install.ps1
W6: scripts/uninstall.ps1
W7: package.json scripts
     |
     v
W8: README.md
W9: project-context.md
```

---

## Bảng Tóm tắt

| ID | Công việc | Files | Effort |
|----|-----------|-------|--------|
| W1 | Windows process/CDP discovery Slow Path | `src/core/discovery.js` | 1.5h |
| W2 | Windows daemon running/stop trong Extension | `src/extension/daemon-service.js` | 1h |
| W3 | CDP launch command + clipboard cross-platform | `src/extension/daemon-service.js` | 0.75h |
| W4 | Quit Antigravity Windows | `src/extension/daemon-service.js` | 0.5h |
| W5 | Windows installer Task Scheduler | `scripts/install.ps1` | 1.5h |
| W6 | Windows uninstaller | `scripts/uninstall.ps1` | 0.75h |
| W7 | npm scripts Windows | `package.json` | 0.25h |
| W8 | README Windows docs | `README.md` | 0.75h |
| W9 | Project context docs | `.agents/context/project-context.md` | 0.5h |
| **Total** | | | **~7.5h** |

---

## Open Questions

> **Q1:** Windows executable/app alias của Antigravity là gì?
> Ví dụ `Antigravity.exe`, App Installer alias, hay path trong `%LOCALAPPDATA%`/`C:\Program Files`. Q này ảnh hưởng command copy/README, không chặn discovery nếu app đang chạy.

> **Q2:** Extension UI có thể truyền `vscode.env.clipboard` vào `daemon-service.js` không?
> Nếu có, dùng VS Code Clipboard API để tránh shell clipboard. Nếu không, dùng platform shell fallback.

> **Q3:** CLI shell scripts (`menu.sh`, `status.sh`, `scripts/core/stop.sh`) có cần port sang Windows trong scope này không?
> Đề xuất: không. Plan 2 ưu tiên Extension UI + installer. CLI Windows nên là Plan 3 nếu cần.

---

## Hiệu năng Kỳ vọng Windows

| Thao tác | Sau Plan 1+2 |
|----------|---------------|
| Daemon hot path mỗi 5 giây | Không scan process; chỉ `getTargets(lastPort)` local HTTP |
| Startup / cached port fail | PowerShell/CIM process scan Slow Path |
| Extension check running | PowerShell/CIM khi cần hiển thị state |
| Extension stop | Kill spawned process hoặc Stop-Process theo command line |
| Copy CDP command | VS Code clipboard nếu có; fallback `Set-Clipboard` |

**Không claim:** `Check daemon running ~1ms`, `Stop by PID ~10ms`, hay PID file cho đến khi có task tạo PID file thật.

---

## Test/Verification Bắt buộc

- macOS regression sau Plan 1+2:
  - Daemon vẫn inject được target.
  - Fast Path không gọi `findAntigravityPID()`/`findCDPPort()` khi connection sống.
  - Extension start/stop/copy/quit vẫn hoạt động trên macOS.
- Windows manual/VM:
  - `npm run install-agent:win` tạo Scheduled Task và start daemon.
  - `npm run uninstall-agent:win` dừng task và kill daemon process.
  - Antigravity không chạy: daemon fail gracefully, không spam error.
  - Antigravity chạy không có CDP flag: discovery trả `null`, UI hiện chưa detected.
  - Antigravity chạy có CDP flag: tìm port, get targets, inject payload.
