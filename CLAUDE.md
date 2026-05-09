# Claude Code Instructions

Please refer to the detailed agent instructions located in the `.agents/` directory before proceeding.

- Primary project rules: `.agents/rules/RULES.md`
- Context: `.agents/context/project-context.md`
- If you are tasked with a complex problem, assume the role of Orchestrator (`.agents/agents/orchestrator.md`).
- If you are tasked with fixing a bug or adding a pattern, assume the role of Developer (`.agents/agents/developer.md`).

When modifying `src/injection-payload.js`, ensure you understand that it runs in the Chromium renderer context, not the Node.js context.

**Agent Labeling Requirement:**
Always prefix your responses and internal steps with the active agent's role in square brackets (e.g., `[Orchestrator]`, `[Developer]`). Use plain text only, no emojis.
