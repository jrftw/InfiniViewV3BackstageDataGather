# Deprecations and Legacy — InfiniView V3 Backstage Gatherer

**Audit date:** 2026-07-11

---

## Disabled features (off by default)

| Feature | Env flag | Default | Notes |
|---------|----------|---------|-------|
| Auto Highlights scan | `GATHERER_AUTO_HIGHLIGHTS_SCAN_ENABLED` | `false` | Added `6d4c96b`; opt-in when API ready |
| Infinitum Agent hooks | `INFINITUM_AGENT_ENABLED` | `false` | Additive post-publish |
| Master daily tab | `GATHERER_UPDATE_MASTER_DAILY_TAB` | `false` | Prefer Drive archive folder |
| Startup catch-up | `GATHERER_CATCHUP_ON_STARTUP` | `true` | Disable with `false` if undesired |

---

## Legacy Mongo index

**Index name:** `gatherer_performance_snapshots_creator_run_unique`

When `GATHERER_MONGO_SNAPSHOT_ONE_PER_DAY=true` (default), bootstrap in `gathererMongoIndexBootstrap.ts`:

1. Deduplicates legacy append-only snapshots
2. Drops legacy unique index on `(backstage_creator_id, import_run_id)`
3. Creates `(backstage_creator_id, snapshot_date_key)` unique index

Set `GATHERER_MONGO_SNAPSHOT_ONE_PER_DAY=false` only for legacy append-only mode.

---

## Environment aliases ( retained for compatibility )

| Preferred | Alias |
|-----------|-------|
| `BACKSTAGE_EMAIL` | `TIKTOK_EMAIL` |
| `BACKSTAGE_PASSWORD` | `TIKTOK_PASSWORD` |
| `BACKSTAGE_HEADLESS=false` | `HEADLESS=false`, `GATHERER_BACKSTAGE_HEADED=true` |
| `GOOGLE_DELEGATED_USER` | `GOOGLE_WORKSPACE_DELEGATED_USER` |

Do not remove aliases without migration notice.

---

## Historical documentation

| Path | Status |
|------|--------|
| [Plan/HOW_TO_RUN.md](../Plan/HOW_TO_RUN.md) | **Preserved** — operational reference; may predate some env vars |
| [Plan/Plan.md](../Plan/Plan.md), [Plan/TotalPlan.md](../Plan/TotalPlan.md) | Historical planning |
| [docs/](../docs/) | **Preserved** — Backstage-specific runbooks |

README pre-2026-07-11 listed 4 Mongo collections — superseded by current code (6 collections).

---

## Schema versioning

`GATHERER_CREATOR_SCHEMA_VERSION = "creator_master_v1"` in `gathererSchemaVersion.ts`

Bump to `creator_master_v2` only when combined creator column layout changes materially — coordinate with InfiniView API consumers.

---

## Commented / optional code paths

- `GATHERER_EARLY_MONTH_FALLBACK` — export previous month on day 1 (commented in `.env.example`)
- `GATHERER_SKIP_PREFLIGHT` — skip preflight on scheduled runs (commented)
- `RUN_SCHEDULES` hourly 24/7 example commented in `.env.example`
- Server.ts suggestions: basic auth for `/run-now` — not implemented

---

## Safe removal prerequisites

Before removing legacy code paths:

1. Confirm MongoDB has no documents relying on legacy index mode
2. Confirm no production `.env` sets deprecated flags
3. Update InfiniView API if schema version bumps
4. Run full visible gather + snapshot verify on staging server PC

---

## Files retained for rollback

- Entire `src/snapshotHistory/` module — added for Priority 1 history engine
- `gathererMongoSnapshotRetention.ts` — dedup helper for index migration
- Legacy `docs/` field map — still referenced for enrichment columns

Do not delete during documentation-only tasks.
