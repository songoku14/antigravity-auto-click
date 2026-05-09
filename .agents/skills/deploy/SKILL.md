---
name: deploy
description: Install and start the Antigravity Auto-Retry daemon. Execution and reporting only.
---
# Skill: Deploy (/deploy)

## Agent Roles
- **Developer**: Runs installation and startup scripts.
- **Tester**: Verifies success.

## Constraints
- **NO CODE MODIFICATIONS**: This skill is for executing deployment scripts ONLY. Do not modify source code, scripts, or configurations.
- **STRICT EXECUTION**: Only run existing scripts (`install.sh`, `start.sh`).

## Execution Steps
1. **Permissions**: `chmod +x scripts/*.sh`.
2. **Install**: `./scripts/install.sh`.
3. **Start**: `./scripts/start.sh`.
4. **Verification**: Confirm with `/status` logic.
