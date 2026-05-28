# Claude Code Instructions

Please refer to the detailed agent instructions located in the `.agents/` directory before proceeding.

- Primary project rules: `.agents/rules/RULES.md`
- Context: `.agents/context/project-context.md`
- If you are tasked with a complex problem, assume the role of Orchestrator (`.agents/agents/orchestrator.md`).
- If you are tasked with fixing a bug or adding a pattern, assume the role of Developer (`.agents/agents/developer.md`).

When modifying `src/injection-payload.js`, ensure you understand that it runs in the Chromium renderer context, not the Node.js context.

**Agent Labeling Requirement:**
Always prefix your responses and internal steps with the active agent's role in square brackets (e.g., `[Orchestrator]`, `[Developer]`). Use plain text only, no emojis.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **antigravity-auto-click** (1304 symbols, 2386 relationships, 113 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/antigravity-auto-click/context` | Codebase overview, check index freshness |
| `gitnexus://repo/antigravity-auto-click/clusters` | All functional areas |
| `gitnexus://repo/antigravity-auto-click/processes` | All execution flows |
| `gitnexus://repo/antigravity-auto-click/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
