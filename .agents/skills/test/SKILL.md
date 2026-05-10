---
name: test
description: Trigger a dummy "High Traffic" dialog in Antigravity to verify the auto-retry script. Reporting only.
---
# Skill: Antigravity Test (/test)

## Agent Roles
- **Tester**: Executes the test trigger scripts and reports findings.

## Constraints
- **READ-ONLY**: This skill is strictly for status verification and reporting.
- **NO CODE MODIFICATIONS**: Do not modify source code, scripts, or configurations during this task.

## Usage
Run the following commands from the project root:

### 1. Auto-Retry Test (High Traffic)
```bash
node scripts/trigger-test.js
```
- **Observe**: A dialog labeled "[TEST] High Traffic Simulation" appears and should be clicked automatically.

### 2. Auto-Accept Test (Safe Command)
```bash
node scripts/trigger-accept-test.js [Run|Execute|Accept]
```
- **Example**: `node scripts/trigger-accept-test.js Execute`
- **Observe**: A dialog with a "Run" (or "Execute") button appears and should be clicked automatically.

### 3. Safety/Blacklist Test (Dangerous Command)
```bash
node scripts/trigger-danger-test.js
```
- **Observe**: A dialog with a dangerous command (e.g., `rm -rf`) appears. The system should **NOT** click it and instead mark it as **🚫 Blocked**.

## Execution Steps
1. **Prerequisite**: Ensure Antigravity is running and the auto-retry daemon is active.
2. **Execute**: Run one of the trigger scripts above.
3. **Verify**: Check terminal output and Antigravity UI for expected behavior.
4. **Report**: Confirm if the automation correctly handled the dialog according to its type.
