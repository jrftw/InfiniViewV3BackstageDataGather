# Known Limitations — InfiniView V3 Backstage Gatherer

**Audit date:** 2026-07-11

---

## Product

- Single-agency, single-server deployment model — not multi-tenant
- Google Sheets remains a parallel staging surface; MongoDB is the app source of truth
- Profile Acquirer enriches public TikTok data only — not private Backstage fields
- Auto Highlights scan is **disabled by default** and requires InfiniView API coordination
- No web UI for editing creator records — ops use Google Sheets or downstream apps

---

## Platform

- **Windows-first** — batch files and Task Scheduler scripts assume cmd/PowerShell
- Playwright Chromium requires desktop/server environment with display or headless support
- macOS/Linux not validated during 2026-07-11 audit
- Server must stay awake — sleep disables scheduled runs

---

## Architecture

- **Single Node process** — in-memory run lock does not coordinate across multiple processes
- `/run-now` runs synchronously on Express thread — concurrent manual triggers blocked by lock, not queued
- Git auto-update exits process — brief downtime during restart loop
- No horizontal scaling — one gatherer instance per agency server PC
- Midnight scheduler uses setTimeout to local midnight — long uptime dependent on process stability

---

## Data

- Backstage export column layout can change without notice
- CRM/DIP enrichment depends on external sheet structure matching expected columns ([docs/FIELD_MAP.md](../docs/FIELD_MAP.md))
- Snapshot history import depends on Drive archive naming conventions
- Mongo performance snapshot retention policy beyond dedupe-by-day is not TTL-indexed
- One document per creator per day for snapshots — reruns overwrite same-day snapshot

---

## Security

- Dashboard and manual APIs have **no authentication**
- Backstage session and `.env` on disk are high-value targets
- Failure notification emails may leak operational error strings
- Internal highlight scan secret in `.env` — same class as API key

---

## Testing

- CI runs **build only** — no automated regression for Playwright flows
- Manual test scripts exist but are not gating merges
- Live Backstage/Google/Mongo paths **unable to verify** during documentation audit
- Prior full-project audit (2026-07-10) noted gatherer type-check passes but live automation not executed

---

## Deployment

- `.env` and auth state are manual per machine — not in git
- No container/Kubernetes deployment path documented
- Rollback is manual git checkout + rebuild
- Google sharing and MongoDB user provisioning outside repository automation

---

## External integrations

- **Backstage UI changes** break selectors — requires engineer update
- Google API quotas and Workspace admin settings not monitored in-app
- TikTok public profile scraping subject to HTML/SSR changes and rate limits
- InfiniView API highlight endpoint caps (10 posts/day network) enforced server-side — gatherer can schedule up to 13 attempts/day when enabled
- Infinitum Agent integration optional and off by default

---

## Performance

- Full gather duration dominated by Backstage export generation wait (notification poll)
- Large creator rosters increase merge and Mongo upsert time — no parallel shard
- Profile Acquirer batch capped at 25 creators default per run

---

## Documentation

- Legacy `docs/` and `Plan/` may contain stale claims — prefer `Documentation/` + code
- Previous README listed 4 MongoDB collections; codebase defines **6** (corrected in 2026-07-11 docs)

---

## Accessibility

- Dashboard is minimal HTML with no accessibility audit performed
- Operator workflows assume sighted debugging for visible Playwright runs
