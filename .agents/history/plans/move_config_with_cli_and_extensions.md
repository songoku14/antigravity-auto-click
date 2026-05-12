# Move Config and Logs to User Directory

Currently, `config.json`, `activity-log.json`, and daemon logs are stored within the project source directory. This makes the project "dirty" and is not ideal for end-users. We will move these files to `~/.antigravity-auto-click/`.

## User Review Required

> [!IMPORTANT]
> The new location for all persistent data will be `~/.antigravity-auto-click/`. This includes the configuration file and activity logs.

## Proposed Changes

### Core Logic (Node.js)

#### [NEW] [paths.js](file:///Users/lehoangthang/Documents/antigravity-auto-click/src/core/paths.js)
Create a utility to manage application paths. It will handle:
- Determining the user's home directory using `os.homedir()`.
- Ensuring the `~/.antigravity-auto-click` directory exists.
- Providing paths for `config.json`, `activity-log.json`, and the `logs` folder.
- Exporting a consistent set of paths for both the Daemon and the VS Code Extension.

#### [MODIFY] [daemon.js](file:///Users/lehoangthang/Documents/antigravity-auto-click/src/core/daemon.js)
- Import `paths.js`.
- Use the new paths for `ConfigStore` and `ActivityStore`.

#### [MODIFY] [config-store.js](file:///Users/lehoangthang/Documents/antigravity-auto-click/src/core/config-store.js)
- Add logic to migrate `config.json` from the project root to the new location if it exists.

#### [MODIFY] [activity-store.js](file:///Users/lehoangthang/Documents/antigravity-auto-click/src/core/activity-store.js)
- Add logic to migrate `activity-log.json` from the project root to the new location.

#### [MODIFY] [extension.js](file:///Users/lehoangthang/Documents/antigravity-auto-click/src/extension/extension.js)
- Update `readConfig`, `writeConfig`, and `editConfig` to use the global configuration path.
- This ensures the UI in the IDE and the background daemon share the same settings.

### CLI and Scripts

#### [MODIFY] [menu.sh](file:///Users/lehoangthang/Documents/antigravity-auto-click/scripts/menu.sh)
- Update paths to `config.json` and `activity-log.json` when displaying status or opening files.

#### [MODIFY] [status.sh](file:///Users/lehoangthang/Documents/antigravity-auto-click/scripts/core/status.sh)
- Update paths to `activity-log.json`.

#### [MODIFY] [install.sh](file:///Users/lehoangthang/Documents/antigravity-auto-click/scripts/install.sh)
- Update the LaunchAgent plist to store `daemon.log` in `~/.antigravity-auto-click/logs/`.

#### [MODIFY] [uninstall.sh](file:///Users/lehoangthang/Documents/antigravity-auto-click/scripts/uninstall.sh)
- (Optional) Decide whether to keep the config/logs on uninstall (usually best to keep them unless asked).

## Verification Plan

### Automated Tests
- Run `npm test` (regression tests) to ensure detection logic still works.
- Manually verify that the `~/.antigravity-auto-click` directory is created and files are migrated.

### Manual Verification
1. Run the system.
2. Check if `~/.antigravity-auto-click/config.json` exists.
3. Check if `~/.antigravity-auto-click/activity-log.json` exists.
4. Check if logs are written to `~/.antigravity-auto-click/logs/daemon.log`.
5. Verify the CLI menu still displays correct statistics.
