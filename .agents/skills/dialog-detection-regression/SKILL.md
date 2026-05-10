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
To run the full regression suite against all samples in the `samples/` directory:
```bash
node scripts/verify-dialog-detection-regression.js
```

### Adding a New Test Case
1.  **Capture the DOM**: Use Option 11 in the CLI menu or run `node scripts/dump-dom.js` while the dialog is visible in Antigravity.
2.  **Analyze & Save**: Use Option 9 in the CLI menu (`node scripts/analyze-dialog.js`) to analyze the live dialog. 
    - When prompted to save, choose **Yes**.
    - This creates a paired `sample_XXX.json` and `sample_XXX.html` in the `samples/` directory.
3.  **Verify**: The new sample will automatically be included in the next regression run.

## Test Data Structure
- **HTML file**: Contains the captured DOM structure.
- **JSON file (Optional)**: Contains metadata and the `expectedButton`. If present, the test will verify that the detection logic finds this specific button text.

## Troubleshooting Failures
If a test fails:
1.  Check the "Found buttons" list in the terminal output.
2.  Open the failing `.html` sample in a browser to inspect its structure.
3.  Adjust the regex patterns in `src/injection-payload.js` (e.g., `dialogContainerSelectors`, `retryButtonPatterns`, or `actionButtonPatterns`).
4.  Rerun the test to ensure the fix works and hasn't broken other samples.
