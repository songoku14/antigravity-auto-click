# Ke hoach toi uu cau truc du an Antigravity Auto-Click

## Muc tieu

- Chuan hoa cau truc du an.
- Giam nham lan giua Auto-Retry va Auto-Click.
- Tach runtime state khoi source/config.
- Lam extension manifest khop voi code.
- Chuan bi nen de refactor daemon/payload sau nay voi rui ro thap.

## Pham vi

- Khong thay doi logic click/retry/accept o buoc dau.
- Khong doi behavior runtime neu khong can.
- Uu tien chinh cau truc, naming, tai lieu, command wiring.
- Refactor daemon chi lam o muc tach module an toan, co test hoi quy.

## Pha 1: Audit va chot baseline

- Kiem tra trang thai git hien tai.
- Liet ke file tracked/untracked lien quan.
- Chay test hien co:
  - `npm test`
  - regression theo tung sample trong `samples/` neu can.
- Ghi nhan baseline:
  - test pass/fail hien tai.
  - daemon entry hien tai.
  - log path hien tai.
  - LaunchAgent/script path dang dung.

Ket qua mong muon:

- Co trang thai truoc khi sua.
- Biet chac thay doi nao la cua minh.

## Pha 2: Chuan hoa naming

- Chon ten canonical: `Antigravity Auto-Click`.
- Cap nhat metadata:
  - `package.json.name`: can nhac doi tu `antigravity-auto-retry` sang `antigravity-auto-click`.
  - `package.json.displayName`: `Antigravity Auto-Click`.
  - `package.json.description`: mo ta ca Auto-Retry va Auto-Accept.
- Giu command id cu `antigravity-auto-retry.*` tam thoi neu extension/LaunchAgent dang phu thuoc.
- Khong doi ten file `auto-retry.js` ngay o pha nay de tranh pha script.

Ket qua mong muon:

- Ten hien thi thong nhat.
- Khong lam gay script dang goi path cu.

## Pha 3: Sua extension manifest

- Doi chieu command trong `package.json` voi command dang ky trong `src/extension/extension.js`.
- Them command con thieu vao `contributes.commands`:
  - `antigravity-auto-retry.restartIDE`
  - `antigravity-auto-retry.editConfig`
  - `antigravity-auto-retry.testRetry`
  - `antigravity-auto-retry.testAccept`
- Xu ly command dang lech:
  - `antigravity-auto-retry.test` hien co trong manifest nhung code khong dang ky.
  - Chon mot trong hai:
    - them handler `test` goi menu test hoac `testRetry`;
    - hoac xoa khoi manifest neu khong dung.
- Kiem tra menu QuickPick van goi dung command.

Ket qua mong muon:

- Command Palette khong co command chet.
- Extension UI va manifest dong bo.

## Pha 4: Runtime state va logs

- Chon lai vi tri state:
  - de xuat: `logs/activity-log.json`.
- Cap nhat code doc/ghi activity:
  - tu root `activity-log.json`.
  - sang `logs/activity-log.json`.
- Dam bao tu tao `logs/` neu chua ton tai.
- Cap nhat `scripts/menu.sh` neu dang doc root activity file.
- Giu fallback doc file cu root trong mot thoi gian de khong mat thong ke cu:
  - neu `logs/activity-log.json` chua co;
  - neu root `activity-log.json` ton tai;
  - migrate/copy noi dung sang path moi.
- Cap nhat `.gitignore` neu can:
  - `logs/`
  - `activity-log.json` root van ignore de tuong thich.

Ket qua mong muon:

- Runtime output gom vao `logs/`.
- Root project sach hon.

## Pha 5: README va tai lieu

- Cap nhat README:
  - cau truc thu muc thuc te.
  - log path dung.
  - phan biet CLI / daemon / extension / LaunchAgent.
  - sua cau "an toan tuyet doi" thanh mo ta thuc te hon, vi du "co lop bao ve blacklist/rate-limit".
- Cap nhat `.agents/context/project-context.md`:
  - bo sung Auto-Accept.
  - bo sung `logs/activity-log.json`.
  - cap nhat cau truc daemon/payload hien tai.
- Neu co `tutorial.md`, kiem tra cac lenh:
  - `npm start`
  - `npm run menu`
  - `npm run test`
  - `scripts/install.sh`
  - log path.

Ket qua mong muon:

- Tai lieu khop code.
- Nguoi dung moi khong bi huong dan sai file log/path.

## Pha 6: Refactor nhe daemon

Chi lam sau khi cac pha tren pass test.

Tach `src/core/auto-retry.js` thanh module nho:

- `src/core/auto-retry.js`
  - chi giu entry point.
  - khoi tao daemon.
- `src/core/daemon.js`
  - class `AutoRetryDaemon`.
  - main loop.
  - target lifecycle.
- `src/core/cdp-connection.js`
  - class `CDPConnection`.
  - connect/send/inject/reinject/disconnect.
- `src/core/config-store.js`
  - load config.
  - watch config.
  - default config.
- `src/core/activity-store.js`
  - load/save activity.
  - migrate root activity file neu can.
  - update counters.

Nguyen tac:

- Khong doi public behavior.
- Khong doi payload.
- Khong doi script command.
- Sau moi file tach, chay test nhanh.

Ket qua mong muon:

- Daemon de doc hon.
- Moi module co trach nhiem ro.

## Pha 7: Config schema

- Them `config.schema.json`.
- Mo ta:
  - `blacklist`
  - `autoRetry`
  - `autoAccept.enabled`
  - `autoAccept.categories.terminal/review/system.enabled`
  - `patterns`
  - `customRetryPatterns`
  - `customAcceptPatterns`
- Cap nhat README hoac tutorial tro toi schema.
- Khong bat buoc validate runtime ngay o pha dau.
- Neu them validate runtime:
  - chi warning;
  - khong crash daemon.

Ket qua mong muon:

- Nguoi dung sua config it sai hon.
- Developer hieu shape config ro hon.

## Pha 8: Payload maintainability

Day la pha rui ro cao hon, nen lam sau.

- Khong can tach payload string ngay neu chua co bundler.
- Truoc mat chi sap xep lai trong `src/payload/injection-payload.js`:
  - default config block.
  - pattern conversion.
  - container detection.
  - command extraction.
  - accept/retry decision.
  - click execution.
  - cleanup/versioning.
- Dam bao regression samples van pass.
- Neu muon di xa hon:
  - tach source payload thanh file browser-native rieng.
  - build thanh injectable string.
  - nhung buoc nay chua nen lam ngay neu project van nho.

Ket qua mong muon:

- Payload de review hon.
- Khong pha co che inject hien tai.

## Pha 9: Verification

Sau tung pha chinh:

- `npm test`
- kiem tra `npm run menu` khong loi syntax.
- kiem tra scripts shell con dung path.
- neu Antigravity dang chay debug:
  - chay status.
  - thu trigger Auto-Retry.
  - thu trigger Auto-Accept.
- kiem tra log/activity duoc ghi vao path moi.

Ket qua cuoi:

- Test regression pass.
- CLI menu doc dung activity count.
- Extension command khong lech manifest.
- README khop cau truc thuc te.

## Thu tu implement de xuat

1. Pha 1: Audit baseline.
2. Pha 3: Sua extension manifest.
3. Pha 4: Chuyen activity log vao `logs/`.
4. Pha 2: Chuan hoa naming metadata.
5. Pha 5: Cap nhat README/context/tutorial.
6. Pha 6: Refactor daemon nhe.
7. Pha 7: Them config schema.
8. Pha 8: Don payload.
9. Pha 9: Verification cuoi.

## Rui ro chinh

- LaunchAgent co the hardcode path cu.
- Extension command id doi qua manh co the lam mat command binding.
- Activity log chuyen path co the lam mat count neu khong migrate.
- Refactor daemon de gay loi lifecycle WebSocket neu lam qua rong.
- Payload refactor de lam regression dialog detection.

## Nguyen tac chot

- Khong doi command id/runtime path quan trong trong cung luc.
- Moi pha co test rieng.
- README cap nhat sau khi code thuc te da on.
- Refactor daemon truoc payload.
- Payload chi dong vao sau khi regression du chac.
