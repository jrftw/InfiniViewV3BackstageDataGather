# Data Flow and Sources — InfiniView V3 Backstage Gatherer

**Audit date:** 2026-07-11

---

## Source-of-truth matrix

| Data domain | Authoritative source | Mirror / staging | Consumers |
|-------------|---------------------|------------------|-----------|
| Creator LIVE performance (current) | MongoDB `creators` + `creator_performance_snapshots` | Google Sheets master tab | InfiniView API → app |
| Creator daily history (Command Center) | MongoDB `creator_daily_snapshots` | Drive daily archive spreadsheets | InfiniView API |
| Monthly D.I.P. goals | MongoDB `creator_monthly_goals` | Derived from snapshot history | InfiniView API |
| CRM contact fields | External CRM Google Sheet | Merged into creator rows at gather time | Sheets + MongoDB |
| DIP tier/bonus fields | External DIP Google Sheet | Merged at gather time | Sheets + MongoDB |
| Profile images / TikTok bio | TikTok public web (Profile Acquirer) | Drive profile folder, MongoDB | App avatars |
| Raw Backstage exports | Local `data/raw/` | Drive uploads | Ops/debug |
| Run audit | MongoDB `gatherer_import_runs`, local summary JSON | — | Ops |

**Google Sheets is not the production database.** It is a human-review and staging layer.

---

## Read / write matrix

| System | Read | Write | When |
|--------|------|-------|------|
| TikTok Backstage | Management + performance exports | None (browser automation only) | Each gather |
| TikTok public web | Profile HTML/oEmbed | None | Profile Acquirer |
| Google Drive | Daily archive workbooks (snapshot import) | Raw/processed files, profile images, daily archives | Each gather / nightly import |
| Google Sheets | CRM, DIP, manual enrichment, master tab | Master tab, sync tabs, optional daily tab | Each gather / enrich job |
| MongoDB InfiniViewV3 | Existing creators (merge/preserve) | 6 collections | Each gather / snapshot import |
| InfiniView API | — | POST highlight scan (opt-in) | Scheduled / post-import |
| Infinitum Server Agent | — | Optional post-publish hooks | After gather if enabled |
| Local filesystem | Cache, last summary, auth state | raw/processed/logs/cache | Continuous |

---

## Dual-write behavior (MongoDB + Sheets)

When `MONGODB_URI` is set and `GATHERER_MONGODB_ENABLED=true`:

1. Pipeline builds `CombinedCreatorRecord[]`
2. `publishToAllOutputTargets` writes Sheets/Drive/local **and** calls `publishCreatorsToMongo`
3. Mongo index bootstrap runs before publish
4. Performance snapshots dedupe to one document per creator per calendar day when `GATHERER_MONGO_SNAPSHOT_ONE_PER_DAY=true`

Failure in Mongo publish fails the gather unless caught upstream — verify in `outputTargets.ts` behavior during live runs.

---

## Fallback order

| Scenario | Behavior |
|----------|----------|
| MongoDB unavailable | Gather may fail at publish phase if Mongo enabled — not a silent Sheets-only fallback |
| Google Sheets unavailable | Typically fails publish; local files may still exist from pipeline |
| Infinitum Agent down | Warning logged; gather succeeds (`gathererInfinitumAgentPostPublish.ts`) |
| Highlights scan failure | Warning logged; gather / import succeeds |
| CRM/DIP sheet missing | Enrichment skipped or partial; logged |

---

## Snapshot history flow

```text
Daily final gather run
    → archiveDailySheetToDrive (InfiniView Creators YYYY-MM-DD)
Nightly 00:30 ET (default)
    → runSnapshotHistoryImportJob
    → read Combined Creators tab from archive
    → upsert creator_daily_snapshots
    → optional monthly goals repair
    → optional highlight scan post-hook
```

---

## Freshness indicators

| Output | Freshness |
|--------|-----------|
| `creators.last_successful_sync_at` | Last successful gather |
| `creator_performance_snapshots.snapshot_date_key` | Calendar day of snapshot |
| `creator_daily_snapshots.snapshotDate` | Archive business date |
| `data/logs/last-run-summary.json` | Last run timestamps + counts |
| Dashboard `/api/status` | In-memory + last summary file |

---

## Data ownership

| Collection | Owner process | Key |
|------------|---------------|-----|
| `creators` | Gatherer | `backstage_creator_id` |
| `creator_performance_snapshots` | Gatherer | `backstage_creator_id` + `snapshot_date_key` |
| `gatherer_import_runs` | Gatherer | `run_id` |
| `creator_daily_snapshots` | Snapshot history import | `creatorId` + `snapshotDate` |
| `creator_monthly_goals` | Snapshot history / goals service | `creatorId` + `month` |
| `creator_snapshot_import_runs` | Snapshot history import | `importRunId` |

InfiniView API is the read path for the creator app — gatherer does not serve HTTP to creators directly.

---

## Failure modes

| Failure | Symptom | Mitigation |
|---------|---------|------------|
| Backstage logout | Export fails | `npm run login` |
| Selector drift | Element not found | Update `backstageSelectors.ts` |
| Google permission | 403 from API | Share folder/sheet with service account |
| Mongo duplicate key | Index conflict | Run retention/dedup bootstrap |
| Rate limit (TikTok profile) | Skipped creators | Lower batch limit, increase stale hours |
