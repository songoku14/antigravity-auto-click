---
name: dialog-detection-regression
description: Verify the accuracy of dialog detection and regex patterns using captured DOM samples. Ensures no regression after logic updates.
---
# Skill: Dialog Detection Regression Testing

This skill is used to verify that the Antigravity injection payload correctly identifies dialogs and action buttons across different UI states and versions of the application.

## Agent Roles
- **Tester**: Runs the regression suite and analyzes failures.
- **Developer**: Fixes regex patterns or detection logic based on test failures.

## Usage

### Run All Tests
To run the full regression suite against all samples in the `samples/` directory, select **Option 2 (Test DOM samples)** from the main menu, then select **Option a (Run ALL)**.
```bash
### Realistic Full-DOM Testing
The regression tool focuses on **Realistic Full-DOM Testing**. It runs the actual detection logic against full HTML snapshots captured from the real IDE using JSDOM.

- **Headless execution**: Automatically simulates the environment, mocks layout/visibility, and verifies that the logic would trigger the correct `click()` action.

### Adding a New Test Case
1.  **Capture the DOM**: Run `node scripts/tools/dump-dom.js` (Option 1 in Developer Tools) while the desired state is visible in Antigravity.
2.  **Verify**: The new snapshot (`full_dom_*.html`) will automatically be included in the next run of **Test DOM samples** (Option 2 in main menu).

## Test Data Structure
- **HTML file**: Contains the captured DOM structure.
If a test fails:
1.  Check the "Found buttons" list in the terminal output.
2.  Open the failing `.html` sample in a browser to inspect its structure.
3.  Adjust the regex patterns in `src/injection-payload.js` (e.g., `dialogContainerSelectors`, `retryButtonPatterns`, or `actionButtonPatterns`).
4.  Rerun the test to ensure the fix works and hasn't broken other samples.
