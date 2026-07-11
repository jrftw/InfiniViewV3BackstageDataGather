# Contributing to InfiniView V3 Backstage Gatherer

Thank you for helping maintain the Backstage Gatherer. This project is proprietary software owned by Infinitum Imagery LLC.

---

## Development workflow

### Two-PC model

| PC | Responsibility |
|----|----------------|
| **Dev PC** | Feature work, local visible runs, push to `main` |
| **Server PC** | 24/7 production runs, auto-update from GitHub |

Changes pushed to `main` are picked up by the server PC within ~15 minutes when the gatherer process and auto-update task are running.

### Branching

- Default branch: `main`
- Use feature branches for large changes when practical
- Keep commits focused; reference Plan docs or issue IDs when relevant

---

## Prerequisites

- Windows 10/11 (primary target platform)
- Node.js 18+ (CI validates with Node 20)
- Git
- Google Cloud service account (for full publish testing)
- TikTok LIVE Backstage agency credentials (for export testing)

---

## Setup

```bat
git clone https://github.com/jrftw/InfiniViewV3BackstageDataGather.git
cd InfiniViewV3BackstageDataGather
npm ci
npm run build
copy .env.example .env
```

Edit `.env` with safe local values. **Never commit `.env` or `data/auth/backstage-auth.json`.**

See [Documentation/LOCAL_DEVELOPMENT.md](Documentation/LOCAL_DEVELOPMENT.md) for full setup.

---

## Commands

| Command | Purpose |
|---------|---------|
| `npm run build` | TypeScript compile (`tsc` → `dist/`) |
| `npm run dev` | Run entry point via tsx (no compile) |
| `npm run start` | Run compiled `dist/index.js` |
| `npm run gather` | One-shot gatherer job |
| `npm run gather:visible` | Gather with visible browser |
| `npm run login` | Interactive Backstage login (saves session) |
| `npm run login:test` | Headless login smoke test |
| `npm run preflight` | Pre-run health check |
| `npm run profile-acquire` | Profile acquirer batch |
| `npm run snapshot-history:import` | Snapshot history import |
| `npm run snapshot-history:verify` | Verify snapshot history |

---

## Code standards

### File headers

Production TypeScript files use a header block:

```typescript
/**
 * Filename: example.ts
 * Purpose: ...
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: YYYY-MM-DD
 * Dependencies: ...
 * Platform Compatibility: Node.js 18+
 */
```

Not every file may fully comply — see [Documentation/AUDIT_2026-07-11.md](Documentation/AUDIT_2026-07-11.md).

### Section markers

Use `// MARK: - Section Name` to divide logic in larger files.

### Naming

- Functions and constants must be uniquely named per module (avoid generic names like `parse` at module scope)
- Prefix gatherer-specific helpers with `gatherer` where the codebase already does so

### Logging

Use centralized logging from `src/logging/logger.ts`:

- `logInfo()`, `logError()`, `logWarn()`, `logDebug()`
- Respect `GATHERER_ENABLE_DEBUG_LOGGING` and `GATHERER_FRIENDLY_LOGS`

### Suggestions section

New production files should end with:

```typescript
// Suggestions For Features and Additions Later:
// - ...
```

---

## Static analysis and build

Before opening a PR:

```bat
npm run build
```

CI runs the same on `windows-latest` with Node 20. There is no lint script or test gate.

---

## Documentation requirements

When changing behavior, update:

- [README.md](README.md) — if user-facing quick start or capabilities change
- [Documentation/API_REFERENCE.md](Documentation/API_REFERENCE.md) — for Express route changes
- [Documentation/CONFIGURATION_REFERENCE.md](Documentation/CONFIGURATION_REFERENCE.md) — for new/changed env vars
- [Documentation/FEATURE_INVENTORY.md](Documentation/FEATURE_INVENTORY.md) — for feature status changes
- [CHANGELOG.md](CHANGELOG.md) — under `[Unreleased]`

Do not delete `docs/` or `Plan/HOW_TO_RUN.md` without explicit approval.

---

## Pull request checklist

- [ ] `npm run build` passes locally
- [ ] No secrets, credentials, or real sheet IDs added to tracked files
- [ ] Backstage selector changes documented in `docs/BACKSTAGE_EXPORT_STEPS.md` if UI navigation changed
- [ ] README and relevant `Documentation/` files updated
- [ ] CHANGELOG `[Unreleased]` entry added
- [ ] Visible gather run tested when touching Backstage automation (if credentials available)

---

## Security

- Never commit `.env`, auth state JSON, service account keys, or internal API tokens
- Never paste production secrets in issues or PRs
- See [SECURITY.md](SECURITY.md) for vulnerability reporting

---

## Backwards compatibility

- Preserve existing env var names; add aliases rather than renaming when possible
- MongoDB schema changes require index bootstrap updates in `gathererMongoIndexBootstrap.ts`
- Bump `GATHERER_CREATOR_SCHEMA_VERSION` only when combined creator columns change materially
