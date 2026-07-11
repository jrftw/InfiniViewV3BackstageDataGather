# Architecture — InfiniView V3 Backstage Gatherer

**Audit date:** 2026-07-11

---

## System context

```mermaid
flowchart LR
  subgraph external [External Services]
    BS[TikTok LIVE Backstage]
    GD[Google Drive]
    GS[Google Sheets]
    MDB[(MongoDB InfiniViewV3)]
    TT[TikTok Public Web]
    IVAPI[InfiniView API]
    AGENT[Infinitum Server Agent]
  end

  subgraph gatherer [Backstage Gatherer - Windows Server PC]
    IDX[index.ts]
    SRV[Express server :3099]
    SCH[node-cron scheduler]
    GIT[gitAutoUpdate]
    JOB[runGathererJob]
    PW[Playwright Chromium]
    PIPE[gathererProcessPipeline]
  end

  IDX --> SRV
  IDX --> SCH
  IDX --> GIT
  SRV --> JOB
  SCH --> JOB
  JOB --> PW
  PW --> BS
  JOB --> PIPE
  PIPE --> GD
  PIPE --> GS
  PIPE --> MDB
  JOB --> TT
  SCH --> IVAPI
  JOB -. optional .-> AGENT
```

---

## Main components

| Component | File(s) | Role |
|-----------|---------|------|
| Entry | `src/index.ts` | Bootstrap dirs, PID file, start server + scheduler + git watcher |
| Config | `src/config.ts` | Load `.env`, expose `GathererConfig` |
| Server | `src/server.ts` | Express dashboard + manual trigger routes |
| Scheduler | `src/scheduler.ts` | Cron for gathers, snapshot import, highlights |
| Gather job | `src/jobs/runGathererJob.ts` | Orchestrates export → pipeline → cleanup |
| Pipeline | `src/jobs/gathererProcessPipeline.ts` | Merge, enrich, publish |
| Backstage | `src/backstage/*` | Playwright login, export, selectors |
| Google | `src/google/*` | Drive, Sheets, auth |
| Mongo | `src/mongo/*` | Connect, indexes, publish |
| Profile Acquirer | `src/profileAcquirer/*` | TikTok public profile scrape |
| Snapshot history | `src/snapshotHistory/*` | Drive archive import engine |
| Services | `src/services/*` | Highlights scan, Infinitum Agent hooks |

---

## Request / job flow

```mermaid
sequenceDiagram
  participant Cron as Scheduler / API
  participant Job as runGathererJob
  participant PF as Preflight
  participant BS as Playwright Backstage
  participant Pipe as Process Pipeline
  participant Out as Outputs

  Cron->>Job: trigger (scheduled/manual)
  Job->>PF: optional preflight
  Job->>BS: export management + performance xlsx
  BS-->>Job: raw files in data/raw
  Job->>Pipe: merge + enrich + filter
  Pipe->>Out: Drive, Sheets, MongoDB, local files
  Job-->>Cron: GathererJobResult + summary JSON
```

---

## Scheduling architecture

`src/scheduler/gathererSchedulePlanner.ts` supports:

- **fixed** — `RUN_SCHEDULE_1`–`RUN_SCHEDULE_4` or comma-separated `RUN_SCHEDULES`
- **random** — jittered times within active hours (`GATHERER_SCHEDULE_MODE=random`)

Additional cron jobs registered in `src/scheduler.ts`:

| Job | Default | Env gate |
|-----|---------|----------|
| Gather runs | 08:00, 12:00, 16:00, 20:00 ET | always |
| Snapshot history import | 00:30 ET | `GATHERER_SNAPSHOT_HISTORY_IMPORT_ENABLED` |
| Auto Highlights scan | hourly 8–20 ET | `GATHERER_AUTO_HIGHLIGHTS_SCAN_ENABLED` + secret |
| Startup catch-up | 3 min after boot | `GATHERER_CATCHUP_ON_STARTUP` |

Midnight handler regenerates the daily plan for random mode.

---

## Authentication flow (Backstage)

```mermaid
sequenceDiagram
  participant Op as Operator
  participant Login as loginOnce.ts
  participant Browser as Chromium
  participant BS as Backstage
  participant Disk as backstage-auth.json

  Op->>Login: npm run login
  Login->>Browser: launch (headed)
  Op->>Browser: complete login + 2FA if needed
  Login->>Disk: save storageState
  Note over Disk: Used by all subsequent headless runs
```

Session refresh: `GATHERER_BACKSTAGE_FORCE_RELOGIN_HOURS` or manual `npm run login`.

---

## Deployment flow (two-PC)

```mermaid
flowchart LR
  Dev[Dev PC push] --> GH[GitHub main]
  GH --> Poll[gitAutoUpdate 15min]
  Poll --> Pull[git pull]
  Pull --> Build[npm ci + build]
  Build --> Restart[start-server.bat loop]
```

Dashboard **Check for Updates** calls `POST /api/update` for immediate pull.

---

## State management

- **Run lock** — in-memory `gathererRunLock` in `runState.ts` (single process)
- **Last summary** — `data/logs/last-run-summary.json` persisted to disk
- **PID file** — `.server.pid` written at startup
- **Update lock** — `.update-lock` during git pull

No Redis or external queue.

---

## Error handling

- Job failures return `{ success: false, errors: string[] }`
- Optional failure email via Gmail API (`gathererFailureEmailNotifier.ts`)
- Highlights scan and Infinitum Agent hooks log warnings only — do not fail the gather
- `start-server.bat` restarts the Node process after exit (5 s delay)

---

## Logging

Centralized pino logger — see [OBSERVABILITY_AND_LOGGING.md](OBSERVABILITY_AND_LOGGING.md).

---

## Platform-specific behavior

- **Windows:** Primary target; PowerShell scheduled tasks in `scripts/`
- **Timezone:** `TZ=America/New_York` default; cron uses `config.timezone`
- **Playwright:** `postinstall` installs Chromium only
