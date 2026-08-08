# Snapshot Daily Delta Fix Plan

**Audit date:** 2026-08-08  
**Author:** Kevin Doyle Jr. / Infinitum Imagery LLC  
**Status:** Pieces 1–4 implemented in repo; Piece 5 (one-time August heal) is operational  

---

## Problem Summary

InfiniView tracks valid LIVE days from **TikTok Creator Data MTD cumulatives** archived daily by the Backstage Gatherer — not from Lark per-session tables.

Daily rows are computed as:

```
daily(Aug 6) = cumulativeMTD(Aug 6 archive) − prior(Aug 5)
```

Three defects caused false “did not stream” rows (example: `bellavlogzdaily`, Aug 6 2026):

| Defect | Effect |
|--------|--------|
| **Skip-if-exists** | First import of a day was never revised when later archives had corrected cumulatives |
| **Mongo prior lookup** | Prior day came from already-stored snapshots, not the previous **archive file** in the batch — errors cascaded and missing hours rolled into the next day |
| **Month rollover** | `performance_data_period` still described July on Aug 1; July MTD totals overwrote roster fields |

Lark can show a 73-minute session while the Aug 6 **aggregate archive** still matched Aug 5 MTD at first import → daily locked at **0 hours** forever.

---

## Root Cause Proof (bellavlogzdaily, Aug 2026)

| Source | Aug 6 live hours | Valid day |
|--------|------------------|-----------|
| Lark session list | ~1.21 h (1h 12m 54s) | Should qualify |
| `creator_daily_snapshots` (before fix) | **0.00** | **No** |
| Roster MTD (`live_duration_total_hours`) | **6.35** (sum of dailies was ~5.13) | **4** valid days vs **3** daily flags |

~1.22 missing hours ≈ the uncredited session. Data existed in MTD but not on the correct daily row.

---

## Fix Pieces (backwards compatible)

### Piece 1 — Archive prior chain ✅

**Files:** `gathererSnapshotHistoryArchivePriorChain.ts`, `gathererSnapshotHistoryImportService.ts`

During a batch import, when processing day **D**, prefer cumulative from archive **D−1** processed in the same run. Fall back to Mongo when the prior calendar day is missing (month boundary, archive gap).

- Default: **on** (`GATHERER_SNAPSHOT_HISTORY_DERIVE_PRIOR_FROM_ARCHIVE_CHAIN` ≠ `false`)
- Legacy behavior: set env to `false`

### Piece 2 — Nightly current-month re-derive ✅

**Files:** `runSnapshotHistoryImportJob.ts`, `gathererSnapshotHistoryImportService.ts`, `config.ts`, `scheduler.ts`

At **00:30 ET** (and startup catch-up), the scheduled job now:

1. Sets `importThroughDate` = **yesterday** (unchanged)
2. Sets `rederiveMonthKey` = **current month** (e.g. `2026-08`)
3. Re-imports **every archive day in that month** through yesterday (archive chain on)
4. Skips older months unless a day is still missing entirely
5. On **month rollover**, still imports **yesterday** even when it belongs to the prior month

Scoped filter: `gathererSnapshotHistoryFilterEntriesForScheduledRederive()` — avoids scanning all 39 history folders nightly.

- Default: **on** (`GATHERER_SNAPSHOT_HISTORY_REDERIVE_CURRENT_MONTH_ON_SCHEDULED` ≠ `false`)
- Legacy behavior: set env to `false`
- Test: `npm run snapshot-history:test-scheduled`

### Piece 3 — Gatherer month-rollover gate ✅

**Files:** `gathererPerformanceDataPeriodCoverage.ts`, `publishCreatorsToMongo.ts`, `config.ts`

When `performance_data_period` does **not** start with the current month, roster publish **preserves** existing `total_diamonds`, `live_duration_total_hours`, and `valid_live_days_total` instead of writing prior-month totals. The same gate applies to **daily performance snapshots** (`creator_performance_snapshots`).

- Default: **on** (`GATHERER_MONGO_SUPPRESS_STALE_MTD_ON_ROSTER_PUBLISH` ≠ `false`)
- Legacy behavior: set env to `false`
- Test: `npm run mongo:test-mtd-rollover-gate`
- Publish logs: `staleMtdPreservedOnCreators`, `staleMtdPreservedOnSnapshots`

Complements the existing Command Center KPI resolver guard (RC-1).

### Piece 4 — Streak UI guard while reconstructing ✅

**Files:** `infiniviewCommandCenterGpsEngine.ts`, `infiniviewCommandCenterService.ts`

When `validDaysReconstructionIncomplete` is true, streak treats data as **incomplete** — no “you didn’t stream on August 6” break copy.

### Piece 5 — One-time heal (operations)

After deploying Pieces 1–3, run once:

```bash
cd "InfiniView-V3 Backstage Gatherer"
npm run snapshot-history:reimport
```

Or scope to August:

```bash
npx tsx src/jobs/runSnapshotHistoryImportJob.ts --backfill --force-reimport
```

Then verify:

```bash
cd Infiniview-V3-Unified-App/backend
npx tsx scripts/infiniviewProgressionForensicsInspect.ts bellavlogzdaily 2026-08
```

**Expected after heal:** Aug 6 shows ~1.21 live hours and `validLiveDay: true` if the Aug 6 Drive archive cumulative reflects the session.

---

## What This Does NOT Fix

| Limit | Reason |
|-------|--------|
| Session-level attribution when TikTok MTD increments on a **later** calendar day than the LIVE occurred | Aggregate-only pipeline — no per-session source |
| Lark vs Creator Data export disagreement on the **same** archive date | Escalate to TikTok; InfiniView mirrors the export |
| Missing Aug 1 archive folder | Still flagged `EARLY_MONTH_ARCHIVE_GAP`; first in-month day remains partial |

---

## Regression Checklist

- [ ] `npm run snapshot-history:test-delta`
- [ ] `npm run snapshot-history:test-archive-chain`
- [ ] Scheduled import logs show `rederiveMonthKey=YYYY-MM` and current-month dates not skipped
- [ ] `bellavlogzdaily` Aug 6 daily hours > 0 after reimport (if archive supports it)
- [ ] Aug 1 roster publish with July `performance_data_period` does not overwrite August MTD fields
- [ ] Command Center streak shows incomplete notice, not break copy, when `VALID_DAYS_RECONSTRUCTION_INCOMPLETE`
- [ ] Prior-month snapshot history unchanged (skip still applies outside `rederiveMonthKey`)

---

## Environment Flags (all opt-out)

| Variable | Default | Purpose |
|----------|---------|---------|
| `GATHERER_SNAPSHOT_HISTORY_DERIVE_PRIOR_FROM_ARCHIVE_CHAIN` | `true` | Archive chain priors |
| `GATHERER_SNAPSHOT_HISTORY_REDERIVE_CURRENT_MONTH_ON_SCHEDULED` | `true` | Nightly month re-derive |

Set either to `false` to restore pre-fix behavior without code rollback.

---

## Suggestions For Features and Additions Later

- Post-import reconciliation job when `sum(daily validLiveDay) < valid_live_days_total`
- `--month=YYYY-MM` CLI flag for scoped reimport
- Surface `dataStatusNote` in Command Center UI when daily row was healed
