---
name: test
description: Trigger dummy dialogs in Antigravity to verify Auto-Retry (High Traffic) and Auto-Accept (Agent Prompt) features. Reporting only.
---
# Skill: Antigravity Test (/test)

## Agent Roles
- **Tester**: Executes the test trigger scripts and reports findings.

## Constraints
- **READ-ONLY**: This skill is strictly for status verification and reporting.
- **NO CODE MODIFICATIONS**: Do not modify source code, scripts, or configurations during this task.

## Usage
Choose the appropriate mode based on what you need to verify:

### MODE 1: Auto-Retry (High Traffic)
Verify that the system automatically clicks "Retry" when Antigravity is busy.
```bash
node scripts/trigger-test.js
```
- **Observe**: A dialog labeled "[TEST] High Traffic Simulation" appears and should be clicked automatically.

### MODE 2: Auto-Accept (Agent Prompt)
Verify that the system automatically clicks safe action buttons or blocks dangerous ones.

**A. Positive Test (Safe Command)**
```bash
node scripts/trigger-accept-test.js [Run|Execute|Accept]
```
- **Example**: `node scripts/trigger-accept-test.js Execute`
- **Observe**: A dialog with a "Run" (or "Execute") button appears and should be clicked automatically.

**B. Negative Test (Dangerous Command)**
```bash
node scripts/trigger-danger-test.js
```
- **Observe**: A dialog with a dangerous command (e.g., `rm -rf`) appears. The system should **NOT** click it and instead mark it as **🚫 Blocked**.

## Execution Steps
1. **Prerequisite**: Ensure Antigravity is running and the auto-retry daemon is active.
2. **Execute**: Run one of the trigger scripts above.
3. **Verify**: Check terminal output and Antigravity UI for expected behavior.
4. **Report**: Confirm if the automation correctly handled the dialog according to its type.
