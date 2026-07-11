# Observability and Logging — InfiniView V3 Backstage Gatherer

**Audit date:** 2026-07-11

---

## Logging framework

| Component | Technology |
|-----------|------------|
| Core logger | **pino** (`src/logging/logger.ts`) |
| Pretty console | **pino-pretty** when friendly logs enabled |
| Step progress | `src/logging/gathererStepLogger.ts` |
| Human-readable banners | `src/logging/friendlyLog.ts` |

---

## Log levels

| Function | Level | When |
|----------|-------|------|
| `logInfo` | info | Normal operations |
| `logWarn` | warn | Recoverable issues (Agent, highlights) |
| `logError` | error | Failures |
| `logDebug` | debug | Verbose — gated by `GATHERER_ENABLE_DEBUG_LOGGING` |

Default debug enabled when `NODE_ENV !== production` or explicit `GATHERER_ENABLE_DEBUG_LOGGING=true`.

---

## Environment toggles

| Variable | Effect |
|----------|--------|
| `GATHERER_FRIENDLY_LOGS=true` | Emoji step banners to console |
| `GATHERER_VERBOSE_STEPS=true` | Log each gatherer step |
| `GATHERER_ENABLE_DEBUG_LOGGING` | Enable debug level |
| `NODE_ENV=production` | JSON-only logs when friendly logs false |

---

## Major log sources

| Source tag | Module |
|------------|--------|
| `index` | Application bootstrap |
| `server` | HTTP triggers |
| `scheduler` | Cron events |
| `gitAutoUpdate` | Pull/build |
| `runGathererJob` | Main job orchestration |
| `gathererProcessPipeline` | Merge/publish |
| `gathererMongoIndexBootstrap` | Index ensure |
| `gathererInfiniviewCommunityHighlightScanClient` | Highlight API |

Each log line includes optional structured `data` object in pino JSON.

---

## Persistent artifacts

| File | Contents |
|------|----------|
| `data/logs/last-run-summary.json` | Last run success, counts, timestamps, errors |
| `data/logs/import-summary-*.json` | Per-run detailed summary |
| `data/processed/import-summary-*.json` | Copy alongside outputs |

`/api/status` exposes last summary to dashboard.

---

## Health endpoints

| Endpoint | Health signal |
|----------|---------------|
| `GET /api/status` | Last run + `isRunning` lock |
| Port 3099 listening | Process up (watchdog checks this) |

There is no dedicated `/health` or `/ready` route.

---

## Error capture

- Job errors collected in `GathererJobResult.errors[]`
- Fatal exceptions logged via `logError` + friendly `gathererLogFatal`
- Optional email via `gathererSendFailureEmailNotification`
- Highlight scan / Agent errors → `logWarn` only

No Sentry/Datadog integration in codebase.

---

## Sensitive data redaction

- Logger should not receive raw private keys or passwords
- Config loader does not log `.env` contents
- Import summaries may include creator counts and run IDs — treat logs as confidential
- **Do not** paste full summary JSON in public tickets if CRM fields present

---

## Remote logging

Not implemented. Logs go to stdout/stderr of Node process.

Windows Task Scheduler / batch loop captures console only if redirected by operator.

---

## Diagnostic collection checklist

When reporting an issue, provide:

1. `git rev-parse HEAD`
2. Redacted `.env` keys (names only, not values)
3. `data/logs/last-run-summary.json` (redact PII if sharing externally)
4. Whether failure is Backstage, Google, or Mongo phase
5. Output snippet from `npm run gather:visible` around failure
6. `/api/status` JSON

Never share: `backstage-auth.json`, private keys, MongoDB URI, internal API secret.

---

## Known blind spots

- No centralized log aggregation across server restarts
- No metrics for export duration percentiles
- No alerting except optional failure email on gather failure (not on watchdog restart)
- Profile Acquirer partial failures may not email
- Highlight scan failures silent unless logs inspected

---

## Suggestions (not implemented)

- Rotate daily log files under `LOCAL_LOG_DIR`
- Expose last highlight scan result on `/api/status`
- Structured run ID in all log lines for correlation
