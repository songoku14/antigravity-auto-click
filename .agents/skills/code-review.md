# Skill: Code Review (/review)

## Description
Use this skill to perform a mandatory technical review of the current changes. It focuses on architecture, CDP safety, and project standards.

## Agent Roles
- **Tech Leader**: Analyzes changes and provides feedback.

## Execution Steps
1. **Analyze Diff**: Look at all changed files in the current workspace.
2. **CDP Safety Check**: Verify that `Runtime.evaluate` is scoped in IIFEs and uses proper rate-limiting.
3. **Standards Check**: Ensure ES6+ Vanilla JS is used and no disallowed libraries are imported.
4. **Approval**: Explicitly state if the changes are approved or need fixes.
