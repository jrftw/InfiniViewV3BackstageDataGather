# Authentication and Roles — InfiniView V3 Backstage Gatherer

**Audit date:** 2026-07-11

---

## Overview

The gatherer is a **single-tenant automation service**, not a multi-user application. There are no creator login flows, JWT sessions, or role-based route guards in this repository.

Authentication applies to **external systems** the gatherer accesses on behalf of the agency.

---

## TikTok LIVE Backstage

### Session lifecycle

| Step | Mechanism |
|------|-----------|
| Initial login | `npm run login` → `src/backstage/loginOnce.ts` |
| Session storage | Playwright `storageState` → `data/auth/backstage-auth.json` |
| Subsequent runs | `backstageSession.ts` loads saved state into Chromium |
| Credentials fallback | `BACKSTAGE_EMAIL` / `BACKSTAGE_PASSWORD` (or `TIKTOK_*` aliases) in `.env` |
| Forced re-login | `GATHERER_BACKSTAGE_FORCE_RELOGIN_HOURS` deletes stale auth file |
| Manual re-login | `npm run login` after password change or locale change |

### Locale / region

US English Backstage experience is enforced via:

- `BACKSTAGE_LOCALE`, `BACKSTAGE_TIMEZONE`, `BACKSTAGE_REGION`
- `BACKSTAGE_AGENCY_REGION=US+` with `BACKSTAGE_FORCE_US_PLUS=true`
- Geolocation hints (`BACKSTAGE_GEO_LAT/LNG`)

Re-run login after changing locale settings.

### Headless vs headed

| Env | Browser |
|-----|---------|
| Default (no env) | Headless (`gathererParseBackstageHeadless` returns true) |
| `BACKSTAGE_HEADLESS=false` | Visible window |
| `npm run gather:visible` | Sets headless false + slow-mo |

---

## Google APIs

### Service account

- `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- Drive folder and master sheet must be **shared with the service account email** (Editor)

### Domain-wide delegation (optional)

- `GOOGLE_DELEGATED_USER` — impersonate a Workspace user for My Drive quota and Gmail send
- Required for failure email alerts when using Gmail API

### Scopes (default)

```
https://www.googleapis.com/auth/drive
https://www.googleapis.com/auth/spreadsheets
```

Additional Gmail scope needed in Admin Console for failure emails.

---

## MongoDB

- Connection via `MONGODB_URI`
- Database name: `MONGODB_DB_NAME` (default `InfiniViewV3`)
- Can disable writes while keeping URI: `GATHERER_MONGODB_ENABLED=false`
- No application-level Mongo user roles — uses connection string permissions

---

## InfiniView API (internal)

| Variable | Purpose |
|----------|---------|
| `INFINIVIEW_API_BASE_URL` | Cloud Function base URL |
| `INFINIVIEW_INTERNAL_SERVICE_SECRET` | Bearer token for `/internal/*` routes |

Highlight scan requires **both** `GATHERER_AUTO_HIGHLIGHTS_SCAN_ENABLED=true` and a non-empty secret (`gathererIsInfiniviewHighlightScanEnabled` in `config.ts`).

---

## Infinitum Server Agent

| Variable | Purpose |
|----------|---------|
| `INFINITUM_AGENT_ENABLED` | Master switch (default false) |
| `INFINITUM_AGENT_BASE_URL` | e.g. `http://10.0.0.65:9090` |
| `INFINITUM_AGENT_API_TOKEN` | Internal API token |

---

## Express dashboard — no roles

| Endpoint | Auth |
|----------|------|
| `/` | None |
| `/run-now` | None |
| `/run-profile-acquirer` | None |
| `/api/status` | None |
| `/api/update` | None |

**Permission model:** Physical/network access to the server PC and port 3099 equals full control.

Suggested future improvement noted in `server.ts`: basic auth or shared secret header.

---

## Role matrix

This service does not implement RBAC. Operational roles are organizational:

| Role | Capabilities |
|------|--------------|
| Server PC administrator | Full access — run, configure, view auth file |
| Dev engineer | Push code; may run visible gathers on dev PC |
| Creator app user | No direct gatherer access |

---

## Known limitations

- Hiding the dashboard behind firewall ≠ cryptographic authorization
- Backstage session file is plaintext JSON cookies on disk
- `.env` stores Backstage password if configured for auto-login
- No audit log of who triggered manual runs

See [SECURITY_MODEL.md](SECURITY_MODEL.md).
