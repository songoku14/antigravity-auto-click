---
name: deploy
description: Install and start the Antigravity Auto-Retry daemon.
---
# Skill: Deploy (/deploy)

## Agent Roles
- **Developer**: Runs installation scripts.
- **Tester**: Verifies success.

## Execution Steps
1. **Permissions**: `chmod +x scripts/*.sh`.
2. **Install**: `./scripts/install.sh`.
3. **Start**: `./scripts/start.sh`.
4. **Verification**: Confirm with `/status` logic.
