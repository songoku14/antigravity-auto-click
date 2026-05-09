# Skill: Deploy (/deploy)

## Description
Use this skill to install the LaunchAgent, start the daemon, and ensure everything is set up correctly for background execution.

## Agent Roles
- **Developer**: Runs the installation and start scripts.
- **Tester**: Verifies the deployment success after the scripts run.

## Execution Steps
1. **Grant Permissions**: Ensure scripts are executable (`chmod +x scripts/*.sh`).
2. **Install**: Run `./scripts/install.sh`.
3. **Start**: Run `./scripts/start.sh`.
4. **Verification**: Call the `/status` skill logic to confirm it's running.
