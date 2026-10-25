# Riverbanc agent skills — review-only rollout

This repository contains two **opt-in guidance skills**:
- `skills/self-improving-agent/SKILL.md`: reviewed, evidence-backed learning proposals.
- `skills/arena-review/SKILL.md`: safe workflow for an external Claude Code Arena installation.

These files do **not** install Claude Code or execute a tournament. Before using the upstream Arena implementation, review its Python scripts, test suite, dependencies, license, and runtime permissions.

Preserve the existing root `AGENTS.md` verbatim. Its session-security, Lovable sync, and MCP tenant-authorization notes remain authoritative.

No database tables or records may be deleted. No production mutations, automatic merges, or deployments are permitted. Treat all AI output as untrusted until reviewed and tested.
