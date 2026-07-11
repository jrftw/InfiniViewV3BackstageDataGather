# Master Cursor Prompt — Repository Documentation Audit and Rebuild

Use this prompt from the **root of the repository you are auditing**. Open the target repo in Cursor Agent mode and paste the entire block below (or reference this file with `@MASTER_REPOSITORY_DOCUMENTATION_AUDIT.md`).

---

## Prompt (copy from here)

```
MASTER REPOSITORY DOCUMENTATION AUDIT AND REBUILD

You are working inside the current repository.

Your job is to fully audit the repository and rebuild its documentation so it accurately represents the codebase as it exists today.

Do not rely on old README claims, old audit reports, stale comments, previous percentages, historical version labels, or assumptions. Treat the current repository files, current Git state, configuration files, tests, workflows, deployment scripts, and executable code as the source of truth.

This task is primarily documentation work. Do not change production application behavior unless a documentation-related validation command exposes a small, unambiguous defect that prevents documentation generation or verification. Do not redesign features or perform unrelated refactoring.

Follow all safety rules in this document:
- Preserve application behavior and backwards compatibility
- Do not delete production code
- Do not expose secrets
- Do not commit, push, deploy, or run destructive git/cloud operations
- Do not invent facts, percentages, or "production-ready" claims

Deliverables:
1. README.md — landing page with audit metadata, doc index, honest status
2. CHANGELOG.md — preserve history, add Unreleased documentation work
3. CONTRIBUTING.md, SECURITY.md
4. Documentation/ — full reference set (see Documentation/INDEX.md in sibling repos for examples)
5. Documentation/AUDIT_<CURRENT_DATE>.md — point-in-time audit snapshot

Status labels (use only these):
Implemented | Implemented with external configuration required | Partially implemented | Disabled | Experimental | Deprecated | Planned only | Historical | Unable to verify

Before finishing:
- Run safe validation commands (build, analyze, typecheck as applicable)
- Validate internal doc links
- Provide final report with git status --short and git diff --stat
- Do NOT commit or push

Begin by recording repository state (branch, commit, dirty files) and inspecting the complete project structure.
```

---

## When to re-run

- After major feature additions or route changes
- Before onboarding a new engineer
- Monthly documentation audit (see each repo's `Documentation/MAINTENANCE_CHECKLIST.md`)
- When README and code visibly disagree

## Per-repository documentation

Each submodule maintains its own `Documentation/` tree. After re-running this prompt in a submodule, update the mass repo submodule pointer via `push-mass-repo.ps1` (when ready to commit).

| Repository | Documentation index |
|------------|---------------------|
| [Infiniview-V3-Unified-App](Infiniview-V3-Unified-App/Documentation/INDEX.md) | Creator app + API |
| [InfiniCore API](InfiniCore%20API/Documentation/PROJECT_OVERVIEW.md) | Shared messaging/academy API |
| [InfiniView-V3 Backstage Gatherer](InfiniView-V3%20Backstage%20Gatherer/Documentation/PROJECT_OVERVIEW.md) | Backstage pipeline |
| [InfinitumServiceAgent](InfinitumServiceAgent/Documentation/PROJECT_OVERVIEW.md) | Warehouse server agent |

## Source-of-truth hierarchy

1. **Executable source and active configuration** — implementation truth
2. **CHANGELOG.md** — released change history
3. **Documentation/AUDIT_*.md** — dated snapshots (this audit process)
4. **Plan/** and legacy docs — vision/history; verify against code before trusting
5. **Production consoles** — live deployment state (cannot be verified from git alone)
