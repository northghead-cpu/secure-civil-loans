---
name: arena-review
description: Optional, human-invoked competing-solution review for difficult engineering decisions.
---
# Riverbanc Arena Review (safe integration guidance)
Reference implementation: https://github.com/Jakeschincariol/arena-skill/tree/main/skills/arena
This is a project-local safety wrapper, NOT a bundled runnable Arena implementation. Full upstream Arena requires Claude Code Agent tool and Python >=3.8; install and inspect its source separately before use.
## Procedure
1. Confirm Claude Code runtime and explicit user request; never launch tournaments automatically.
2. Prefer --quick (16 agents; ~91 sub-agent calls). Disclose anticipated usage and obtain approval for larger runs.
3. Sanitize the standalone task: no customer data, passwords, API keys, production logs, or proprietary documents unless separately authorized.
4. Run in an isolated working directory with no production credentials, database write access, deployment tokens, or privileged MCP tools.
5. Keep generated output under .arena/ and do not apply proposed code changes automatically.
6. Evaluate the winning solution against independent tests, threat models, and acceptance criteria. A tournament win is not proof of correctness.
7. Submit proposed code through an ordinary reviewable pull request; no auto-merge or deployment.
## Forbidden
No production mutations, no database table/data deletion, no destructive SQL, no changes to tenant authorization, no secrets in prompts, and no bypass of existing CI/security checks.
