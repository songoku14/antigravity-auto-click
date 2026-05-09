---
name: test
description: Trigger a dummy "High Traffic" dialog in Antigravity to verify the auto-retry script.
---
# Skill: Auto-Retry Test (/test)

## Agent Roles
- **Tester**: Executes the test trigger script.
- **Developer**: Ensures the injection payload is up to date.

## Execution Steps
1. **Prerequisite**: Ensure Antigravity is running and the auto-retry daemon is active.
2. **Execute Test**: Run `node scripts/trigger-test.js` from the project root.
3. **Observe**: 
   - Check the terminal output for "Triggered successfully".
   - Check the Antigravity UI for a temporary dialog labeled "[TEST] High Traffic Simulation".
   - Check the daemon logs for confirmation of the click.
4. **Report**: Confirm if the script successfully detected and handled the test dialog.
