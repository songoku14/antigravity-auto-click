---
name: status
description: Check the status of the auto-retry daemon, LaunchAgent, and view logs.
---
# Skill: System Status (/status)

## Agent Roles
- **Tester**: Executes system verification commands.
- **Orchestrator**: Summarizes findings.

## Execution Steps
1. **Check Process**: Run `ps aux | grep auto-retry | grep -v grep`.
2. **Check LaunchAgent**: Run `launchctl list | grep AntigravityAutoRetry`.
3. **Check Logs**: Tail last 10 lines of `~/Library/Logs/AntigravityAutoRetry/auto-retry.log`.
4. **Report**: State (Running/Stopped) and any errors.
