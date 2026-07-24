# GitHub Copilot Instructions

<!-- BEGIN CONSTRUCT AGENTS -->
## Construct Agent Prompts

Select `construct` from the chat mode dropdown to enter the orchestrator: describe an outcome and it classifies the request and dispatches the required Worker Profiles through the `construct-mcp` tools (`orchestration_policy` then `orchestration_run`). You ask for outcomes; Construct routes internally. Requires the `construct-mcp` server (wired in `.vscode/mcp.json`); if its tools are unavailable, the mode cannot route and will say so rather than guess.

- `construct`: use `.github/prompts/construct.prompt.md`.
- `architect`: use `.github/prompts/architect.prompt.md`.
- `data-analyst`: use `.github/prompts/data-analyst.prompt.md`.
- `debugger`: use `.github/prompts/debugger.prompt.md`.
- `designer`: use `.github/prompts/designer.prompt.md`.
- `engineer`: use `.github/prompts/engineer.prompt.md`.
- `operations`: use `.github/prompts/operations.prompt.md`.
- `product-manager`: use `.github/prompts/product-manager.prompt.md`.
- `qa`: use `.github/prompts/qa.prompt.md`.
- `researcher`: use `.github/prompts/researcher.prompt.md`.
- `reviewer`: use `.github/prompts/reviewer.prompt.md`.
- `security`: use `.github/prompts/security.prompt.md`.
<!-- END CONSTRUCT AGENTS -->
