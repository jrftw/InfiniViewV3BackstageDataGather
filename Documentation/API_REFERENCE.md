# API Reference — InfiniView V3 Backstage Gatherer

**Audit date:** 2026-07-11  
**Base URL:** `http://localhost:3099` (default `APP_PORT`)  
**Implementation:** `src/server.ts`

---

## Authentication

**None.** All endpoints are unauthenticated. Intended for trusted LAN on the server PC only.

---

## Dashboard

### `GET /`

| | |
|---|---|
| **Purpose** | HTML dashboard with buttons for manual runs, status, sheet link, update check |
| **Response** | `text/html` |
| **Status** | Implemented |

---

## Status

### `GET /api/status`

| | |
|---|---|
| **Purpose** | Last run summary and in-memory run lock state |
| **Response** | JSON `GathererRunState` |

```json
{
  "isRunning": false,
  "lastSummary": { "success": true, "startedAt": "...", "runId": "..." },
  "lastError": null
}
```

| Field | Source |
|-------|--------|
| `isRunning` | In-memory lock (`runState.ts`) |
| `lastSummary` | Memory or `data/logs/last-run-summary.json` |
| `lastError` | Derived from last failed summary |

---

## Gatherer triggers

### `POST /run-now`

| | |
|---|---|
| **Purpose** | Run full Backstage gather synchronously |
| **Body** | None required |
| **Response** | `GathererJobResult` JSON |
| **Timeout** | Blocks until job completes (may take many minutes) |
| **Side effects** | Playwright export, publish pipeline, optional profile acquirer chain |

### `GET /run-now`

Same as POST — convenience for browser address bar.

**Response shape (`GathererJobResult`):**

```json
{
  "success": true,
  "summaryPath": "data/logs/import-summary-....json",
  "errors": []
}
```

---

## Profile Acquirer triggers

### `POST /run-profile-acquirer`

| | |
|---|---|
| **Purpose** | Run profile acquirer batch or single user |
| **Body (JSON)** | Optional: `normalized_username`, `trigger`, `force`, `username_changed` |
| **Query** | `username`, `trigger`, `force`, `username_changed` |
| **Default trigger** | `signup` when username provided via this route |

### `GET /run-profile-acquirer`

Same options via query string.

### `POST /run-profile-acquirer/signup`

Forces `trigger: signup`. Requires `normalized_username` in body for signup flow.

### `POST /run-profile-acquirer/login`

Forces `trigger: login`. Requires `normalized_username`.

### `GET /run-profile-acquirer/login`

Login trigger via query `username`.

**400 response** when login/signup trigger without username:

```json
{ "success": false, "error": "login requires normalized_username" }
```

---

## Git update

### `POST /api/update`

| | |
|---|---|
| **Purpose** | Fetch, pull, `npm ci`, `npm run build` if remote changed |
| **Response** | `{ "updated": boolean, "message": string }` |
| **Side effect** | If `updated: true`, process exits after 1 s (restart via `start-server.bat`) |

---

## Logs helper

### `GET /open-logs`

| | |
|---|---|
| **Purpose** | Returns path to log directory (does not stream logs) |
| **Response** | `{ "logsPath": "<absolute path to LOCAL_LOG_DIR>" }` |

---

## External API consumed (not owned by this repo)

### InfiniView API — Community Highlights Scan

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `{INFINIVIEW_API_BASE_URL}/internal/community/highlights/scan` |
| **Auth** | `Authorization: Bearer {INFINIVIEW_INTERNAL_SERVICE_SECRET}` |
| **Body** | Optional `{ "monthKey": "YYYY-MM" }` |
| **Client** | `src/services/gathererInfiniviewCommunityHighlightScanClient.ts` |
| **Status** | Disabled unless `GATHERER_AUTO_HIGHLIGHTS_SCAN_ENABLED=true` and secret set |
| **Failure behavior** | Logged warning only |

**Response fields (when successful):**

- `scannedCreators`, `highlightsCreated`, `skippedOptOut`, `skippedRateLimit`, `skippedDuplicate`, `skippedNetworkDailyCap`, `skippedNetworkMinuteCooldown`, `createdPostIds`

---

## External API consumed — Infinitum Server Agent

Optional post-publish hooks via `src/services/infinitumServerAgentClient.ts` when `INFINITUM_AGENT_ENABLED=true`.

Exact routes depend on agent version — see Infinitum Server Agent documentation. Failures do not fail the gather.

---

## Error responses

Express returns JSON error bodies from job results (`success: false`, `errors: string[]`). Uncaught exceptions may return Express default 500 HTML.

---

## Client usage locations

| Endpoint | Called from |
|----------|-------------|
| `/api/status`, `/run-now`, etc. | Dashboard HTML in `server.ts` |
| `/run-profile-acquirer/*` | InfiniView signup/login flows (when wired to server URL) |
| InfiniView highlight scan | `scheduler.ts`, snapshot import post-hook |
