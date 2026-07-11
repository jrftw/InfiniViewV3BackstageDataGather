# Repository Map — InfiniView V3 Backstage Gatherer

**Audit date:** 2026-07-11

---

## Top-level layout

```text
InfiniView-V3 Backstage Gatherer/
├── .github/workflows/ci.yml    # CI build workflow
├── .env.example                # Environment template (no secrets)
├── package.json / package-lock.json
├── tsconfig.json               # TypeScript → dist/
├── README.md                   # Landing page + doc index
├── CHANGELOG.md
├── CONTRIBUTING.md
├── SECURITY.md
├── Documentation/              # Canonical reference docs (this audit)
├── docs/                       # Legacy Backstage runbooks (preserved)
├── Plan/                       # HOW_TO_RUN and planning docs (preserved)
├── scripts/                    # PowerShell + manual test scripts
├── *.bat                       # Windows operator scripts
├── src/                        # TypeScript source (runtime)
├── dist/                       # Compiled output (generated, gitignored)
├── data/                       # Runtime data (gitignored)
└── cache/                      # Creator JSON cache (gitignored)
```

---

## `src/` — application source

| Directory | Purpose | Key files |
|-----------|---------|-----------|
| `backstage/` | Playwright Backstage automation | `backstageExportRunner.ts`, `backstageSelectors.ts`, `loginOnce.ts` |
| `cache/` | Local creator JSON cache | `publishCreatorCache.ts` |
| `constants/` | Schema version constants | `gathererSchemaVersion.ts` |
| `google/` | Drive + Sheets clients and publish | `publishMasterCreatorsTab.ts`, `googleAuth.ts` |
| `jobs/` | CLI and scheduled job entry points | `runGathererJob.ts`, `gathererProcessPipeline.ts` |
| `logging/` | Pino logger, friendly logs, summaries | `logger.ts`, `importSummary.ts` |
| `mongo/` | MongoDB client, indexes, publish | `gathererMongoCollections.ts`, `publishCreatorsToMongo.ts` |
| `notifications/` | Failure email | `gathererFailureEmailNotifier.ts` |
| `outputs/` | Output target orchestration | `outputTargets.ts` |
| `processing/` | Merge, normalize, enrich, parse xlsx | `mergeBackstageReports.ts`, `parseWorkbook.ts` |
| `profileAcquirer/` | TikTok public profile scrape | `tiktokPublicProfileCollector.ts` |
| `scheduler/` | Daily run planning | `gathererSchedulePlanner.ts` |
| `services/` | Cross-cutting HTTP clients | highlight scan, Infinitum Agent |
| `snapshotHistory/` | Drive archive import engine | `gathererSnapshotHistoryImportService.ts` |
| `types/` | Shared TS types | `gathererCreatorDailySnapshot.ts` |
| `utils/` | Files, dates, retry | `files.ts`, `dates.ts` |
| Root files | `index.ts`, `config.ts`, `server.ts`, `scheduler.ts`, `gitAutoUpdate.ts` | Entry + wiring |

---

## `scripts/` — operations and tests

| File | Purpose |
|------|---------|
| `auto-update.ps1` | Git pull helper for scheduled task |
| `gatherer-server-watchdog.ps1` | Port 3099 health check |
| `register-server-*.ps1` | Task Scheduler registration |
| `setup-auto-update-task.ps1` | Auto-update task installer |
| `gathererSnapshotDeltaEngine.test.ts` | Manual delta engine test |
| `test-performance-columns-local.ts` | Manual column parse test |

---

## Batch files (operator)

| File | Purpose |
|------|---------|
| `install-server.bat` | First-time npm ci + build |
| `start-server.bat` | Restart loop for `npm run start` |
| `run-now.bat` | Manual gather |
| `run-now-visible.bat` | Visible Playwright gather |
| `run-profile-acquirer.bat` | Profile batch |
| `run-gather-then-profile.bat` | Pipeline shortcut |
| `setup-server-reliability.bat` | All reliability tasks |
| `setup-auto-update.bat` | Auto-update task only |
| `setup-server-startup.bat` | Startup task only |

---

## `Documentation/`

Canonical engineering reference created 2026-07-11. Linked from README.

---

## `docs/` (legacy, preserved)

| File | Topic |
|------|-------|
| `BACKSTAGE_EXPORT_STEPS.md` | Manual export navigation |
| `BACKSTAGE_PLAYWRIGHT_LOGIN_README.md` | Login automation notes |
| `FIELD_MAP.md` | Column mapping |
| `GOOGLE_SHEETS_SETUP.md` | Google configuration |
| `TROUBLESHOOTING.md` | Original troubleshooting |

---

## `Plan/` (preserved)

| File | Topic |
|------|-------|
| `HOW_TO_RUN.md` | Detailed install/run guide |
| `Plan.md`, `TotalPlan.md`, `Firebase.md` | Historical planning |

---

## Generated / runtime (do not commit)

| Path | Contents |
|------|----------|
| `dist/` | Compiled JavaScript |
| `node_modules/` | npm packages |
| `data/auth/` | Backstage session |
| `data/raw/`, `data/processed/` | Export files |
| `data/logs/` | Run summaries |
| `.server.pid`, `.update-lock` | Process/update markers |

---

## Ownership

| Area | Owner |
|------|-------|
| Source code | Infinitum Imagery LLC engineering |
| `.env` on server PC | Agency operator |
| Google Cloud resources | Agency Google Workspace admin |
| MongoDB Atlas | Shared InfiniView platform DBA |
