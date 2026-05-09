# Skill: System Status (/status)

## Description
Use this skill to check if the Antigravity Auto-Retry daemon is running, if the LaunchAgent is loaded, and to view the latest logs.

## Agent Roles
- **Tester**: Executes commands to verify process and service status.
- **Orchestrator**: Summarizes the findings for the user.

## Execution Steps
1. **Check Process**: Run `ps aux | grep auto-retry | grep -v grep`.
2. **Check LaunchAgent**: Run `launchctl list | grep AntigravityAutoRetry`.
3. **Check Logs**: Tail the last 10 lines of `~/Library/Logs/AntigravityAutoRetry/auto-retry.log`.
4. **Report**: Summarize the state (Running/Stopped) and highlight any recent errors.
