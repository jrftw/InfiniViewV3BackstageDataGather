# Build and Deployment — InfiniView V3 Backstage Gatherer

**Audit date:** 2026-07-11

---

## Version source of truth

| Item | Location | Value (audit) |
|------|----------|---------------|
| Package version | `package.json` `"version"` | `1.0.0` |
| Creator schema id | `src/constants/gathererSchemaVersion.ts` | `creator_master_v1` |
| Git commit | `main` HEAD | `70496a5` |

There is no separate build number file.

---

## Build

### Local / server

```bat
npm ci
npm run build
```

Compiles `src/` → `dist/` via TypeScript (`tsconfig.json`: ES2022, CommonJS, strict).

### Run compiled output

```bat
npm run start
```

Entry: `dist/index.js` (from `src/index.ts`).

### Development (no compile)

```bat
npm run dev
```

Uses `tsx` to run `src/index.ts` directly.

---

## CI/CD

**Workflow:** `.github/workflows/ci.yml`

| Setting | Value |
|---------|-------|
| Trigger | Push/PR to `main` or `master` |
| Runner | `windows-latest` |
| Node | 20 |
| Steps | `npm ci` → `npm run build` |
| Tests | **None** |
| Deploy | **None** |

CI validates TypeScript compilation only — not Playwright, Google, MongoDB, or Backstage connectivity.

---

## Server PC deployment

### First-time

```bat
install-server.bat
```

Equivalent to `npm ci`, `npm run build`, copy `.env.example` → `.env` if missing.

### Start 24/7 server

```bat
start-server.bat
```

Loop: `npm run start` → on exit wait 5 s → restart.

Writes PID to `.server.pid`.

### Reliability tasks (run once)

```bat
setup-server-reliability.bat
```

Registers Windows scheduled tasks (via `scripts/`):

| Task | Purpose |
|------|---------|
| InfiniViewBackstageGathererServer | Start at boot/logon |
| InfiniViewBackstageGathererWatchdog | Restart if port 3099 down (every 5 min) |
| InfiniViewBackstageGathererAutoUpdate | Git pull backup every 15 min |

Also: `setup-auto-update.bat`, `setup-server-startup.bat`.

Set Windows Power → Sleep = **Never**.

---

## Two-PC update flow

```text
Dev PC: git push origin main
    ↓
Server: gitAutoUpdate polls every GIT_UPDATE_CHECK_MINUTES (15)
    ↓
If remote changed: git pull → npm ci → npm run build
    ↓
/api/update or auto-update task → process exit → start-server.bat restarts
```

Manual immediate update: dashboard **Check for Updates** (`POST /api/update`).

---

## Post-deploy verification

| Check | How |
|-------|-----|
| Process running | Port 3099 listening |
| Dashboard loads | http://localhost:3099 |
| Last run | `/api/status` or dashboard |
| Backstage auth | Preflight or visible gather |
| Mongo writes | Verify `gatherer_import_runs` after manual run |
| Scheduled tasks | Windows Task Scheduler |

---

## Rollback

1. On server PC: `git checkout <previous-commit>`
2. `npm ci && npm run build`
3. Restart `start-server.bat`
4. No automated rollback in CI — manual git operation

---

## What is NOT automatically deployed

- `.env` (manual on each PC)
- `data/auth/backstage-auth.json`
- MongoDB schema (indexes created at runtime on first publish)
- Google sharing permissions
- InfiniView API secrets for highlight scan

---

## Environments

| Environment | Typical host | Notes |
|-------------|--------------|-------|
| Dev PC | Developer workstation | Visible browser, partial config |
| Server PC | Office Windows server | Full config, 24/7 |
| CI | GitHub Actions windows-latest | Build only |

There is no separate staging Cloud Run / Firebase deployment for the gatherer itself.

---

## Required permissions (external)

| System | Permission |
|--------|------------|
| Google Drive folder | Editor for service account |
| Google master sheet | Editor for service account |
| MongoDB | Read/write on `InfiniViewV3` |
| GitHub | Pull access on server PC |
| TikTok Backstage | Agency operator account |

---

## Hosting URLs

| Service | Default URL |
|---------|-------------|
| Gatherer dashboard | `http://localhost:3099` |
| InfiniView API (highlight scan) | `INFINIVIEW_API_BASE_URL` env |

Do not expose port 3099 to the public internet without a reverse proxy and authentication layer.
