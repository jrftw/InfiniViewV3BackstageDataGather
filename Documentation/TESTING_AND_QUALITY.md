# Testing and Quality — InfiniView V3 Backstage Gatherer

**Audit date:** 2026-07-11

---

## Summary

| Gate | Present | Blocks merge |
|------|---------|--------------|
| TypeScript build (`npm run build`) | Yes | Yes (CI) |
| Unit tests | Manual scripts only | No |
| Integration tests | No | No |
| Playwright E2E in CI | No | No |
| Lint / format | No | No |
| `npm audit` in CI | No | No |

---

## Commands run during audit

| Command | Exit | Result |
|---------|------|--------|
| `npm run build` | 0 | TypeScript compile succeeded |
| `node --version` | 0 | v22.22.1 |
| `npm --version` | 0 | 11.9.0 |

CI configuration (not executed locally during audit): `windows-latest`, Node 20, `npm ci` + `npm run build`.

---

## Manual test scripts

These exist in `package.json` but are **not** run in CI:

| Script | File | Purpose |
|--------|------|---------|
| `snapshot-history:test-delta` | `scripts/gathererSnapshotDeltaEngine.test.ts` | Delta engine unit checks |
| `test:performance-columns` | `scripts/test-performance-columns-local.ts` | Local performance column parsing |

Both files exist on disk (verified during audit).

---

## Recommended manual regression matrix

When changing Backstage automation or pipeline logic:

| Area | Command / action |
|------|----------------|
| Compile | `npm run build` |
| Login | `npm run login:test` |
| Visible export | `npm run gather:visible` |
| Preflight | `npm run preflight` |
| Full publish | `npm run gather` with Google + Mongo configured |
| Profile acquirer | `npm run profile-acquire` |
| Snapshot import | `npm run snapshot-history:verify` |
| API dashboard | Manual POST `/run-now`, check `/api/status` |
| Selectors | After Backstage UI change, re-run visible gather |

---

## CI workflow details

File: `.github/workflows/ci.yml`

```yaml
on:
  push: [main, master]
  pull_request: [main, master]
jobs:
  build:
    runs-on: windows-latest
    steps:
      - checkout
      - setup-node (20, npm cache)
      - npm ci
      - npm run build
```

No `continue-on-error`. Build failure blocks the check.

---

## Coverage

No coverage tooling configured. No Istanbul/nyc/Jest.

---

## Static analysis

TypeScript `strict: true` in `tsconfig.json`. No ESLint or Prettier config in repository root.

---

## Known gaps

1. No automated Backstage export test (requires live session + credentials)
2. No mocked Google API tests in CI
3. No MongoDB integration test in CI
4. Manual scripts not wired to `npm test`
5. No pre-commit hooks in repository

---

## Platform build matrix

| Target | Validated in audit |
|--------|-------------------|
| Windows + Node 18+ | Yes (build) |
| GitHub Actions Windows | Config present |
| Linux/macOS Node | Unable to verify |

---

## Quality recommendations (documentation only — not implemented)

- Add `npm test` aggregating script tests
- Optional nightly workflow with secrets for smoke gather (owner-controlled)
- ESLint for TypeScript consistency
- Health check endpoint that verifies auth file age and last run success
