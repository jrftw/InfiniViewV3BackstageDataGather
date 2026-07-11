# Feature Inventory — InfiniView V3 Backstage Gatherer

**Audit date:** 2026-07-11  
**Status labels:** Implemented | Implemented with external configuration required | Partially implemented | Disabled | Experimental | Deprecated | Planned only | Historical | Unable to verify

---

| Feature | Entry points | Data sources | Write destinations | Status | Limitations |
|---------|--------------|--------------|-------------------|--------|-------------|
| Backstage management export | `exportManagementReport.ts`, `backstageExportRunner.ts` | TikTok Backstage UI | `data/raw/*.xlsx` | Implemented with external configuration required | UI selector breakage |
| Backstage performance export | `exportPerformanceReport.ts` | TikTok Backstage UI | `data/raw/*.xlsx` | Implemented with external configuration required | Column customize flow |
| Report merge + normalize | `gathererProcessPipeline.ts`, `mergeBackstageReports.ts` | Raw xlsx | Combined creator records | Implemented | — |
| Active creator filter | `filterActiveCreators.ts` | Management + performance rows | Filtered output | Implemented | Configurable graduation exclusions |
| CRM sheet enrichment | `applyCrmSheetEnrichment.ts` | External CRM Google Sheet | Enriched rows | Implemented with external configuration required | Read-only |
| DIP sheet enrichment | `applyDipSheetEnrichment.ts` | DIP Google Sheet | Enriched rows | Implemented with external configuration required | GID/tab matching |
| Manual enrichment tab | `applyManualEnrichment.ts` | Master sheet manual tab | Enriched rows | Implemented with external configuration required | — |
| Local combined outputs | `buildOutputs.ts` | Merged creators | xlsx/csv/json in `data/processed` | Implemented | Retention via `KEEP_LOCAL_FILES_DAYS` |
| Google Drive archive | `uploadDriveFile.ts`, `archiveDailySheetToDrive.ts` | Combined files | Drive folder | Implemented with external configuration required | Quota/delegation |
| Google Sheets master tab | `publishMasterCreatorsTab.ts`, `masterSheetIncrementalPublish.ts` | Combined creators | Master sheet | Implemented with external configuration required | Incremental default on |
| MongoDB creators upsert | `publishCreatorsToMongo.ts` | Combined creators | `creators` | Implemented with external configuration required | Requires `MONGODB_URI` |
| MongoDB performance snapshots | `publishCreatorsToMongo.ts` | Per-run metrics | `creator_performance_snapshots` | Implemented with external configuration required | One per day default |
| MongoDB import run log | `publishCreatorsToMongo.ts` | Run metadata | `gatherer_import_runs` | Implemented with external configuration required | — |
| MongoDB daily snapshots | `gathererSnapshotHistoryImportService.ts` | Drive archives | `creator_daily_snapshots` | Implemented with external configuration required | Nightly import job |
| MongoDB monthly goals | `gathererSnapshotMonthlyGoalsService.ts` | Snapshot history | `creator_monthly_goals` | Implemented with external configuration required | Repair tooling in verify job |
| MongoDB snapshot import audit | `gathererSnapshotHistoryImportService.ts` | Import runs | `creator_snapshot_import_runs` | Implemented with external configuration required | — |
| Profile Acquirer (batch) | `runProfileAcquirerJob.ts` | MongoDB + TikTok web | MongoDB, Drive images | Implemented | Rate limits; batch cap 25 default |
| Profile Acquirer (post-gather chain) | `runGathererJob.ts` | After successful gather | Same | Implemented | `GATHERER_PROFILE_ACQUIRER_AFTER_BACKSTAGE=true` default in `.env.example` |
| Express dashboard | `server.ts` GET `/` | Run state | HTML UI | Implemented | No auth |
| Manual gather API | `POST/GET /run-now` | — | Triggers job | Implemented | Blocks until complete; no auth |
| Profile acquirer API | `/run-profile-acquirer*` | — | Triggers job | Implemented | login/signup triggers need username |
| Status API | `GET /api/status` | `runState.ts` | JSON | Implemented | — |
| Git auto-update | `gitAutoUpdate.ts`, `POST /api/update` | GitHub | Pull + rebuild | Implemented | Requires git remote; restarts via exit |
| Scheduled gathers | `scheduler.ts` | Cron plan | Job triggers | Implemented | Min 50 min between runs default |
| Startup catch-up | `scheduleGathererStartupCatchUp` | Last summary file | One gather | Implemented | 3 min delay |
| Snapshot history import | `runSnapshotHistoryImportJob.ts` | Drive archives | Mongo daily snapshots | Implemented | Enabled by default |
| Snapshot history verify | `runSnapshotHistoryVerifyJob.ts` | Mongo + Drive | Console report | Implemented | CLI only |
| Snapshot history backfill | CLI `--backfill` flags | Drive archives | Mongo | Implemented | Manual CLI |
| Auto Highlights scan | `gathererInfiniviewCommunityHighlightScanClient.ts` | InfiniView API | Community posts | **Disabled** | Requires explicit env enable + secret |
| Infinitum Agent post-publish | `gathererInfinitumAgentPostPublish.ts` | — | Agent HTTP | Disabled | `INFINITUM_AGENT_ENABLED=false` default |
| Failure email alerts | `gathererFailureEmailNotifier.ts` | Run errors | Gmail send | Implemented with external configuration required | Needs delegation + gmail.send |
| Preflight checks | `runPreflightCheck.ts`, `preflightCheck.ts` | Local + Google + Mongo | Console | Implemented | Skippable via env |
| Enrichment-only job | `runEnrichmentJob.ts` | Sheets | Sheet updates | Implemented with external configuration required | Separate from gather |
| Creator JSON cache | `publishCreatorCache.ts` | Combined creators | `cache/creators` | Implemented | Local disk |
| Backstage US+ region force | `backstageUsPlusRegion.ts` | Backstage header | Session | Implemented | — |
| Performance column reset | `exportPerformanceReport.ts` | Backstage customize UI | Export columns | Implemented | Retry/fallback behavior |
| Unit/integration tests | `scripts/*.test.ts` | — | — | Partially implemented | Not run in CI |
| Dashboard auth | — | — | — | Planned only | Suggested in server.ts comments |

---

## npm scripts inventory

| Script | Source file | Status |
|--------|-------------|--------|
| `build` | `tsc` | Implemented — CI gate |
| `start` | `dist/index.js` | Implemented |
| `dev` | `tsx src/index.ts` | Implemented |
| `login` | `src/backstage/loginOnce.ts` | Implemented |
| `login:test` | `src/backstage/backstageLoginTest.ts` | Implemented |
| `gather` | `src/jobs/runGathererJob.ts` | Implemented |
| `snapshot-history:*` | `src/jobs/runSnapshotHistory*.ts` | Implemented |
| `enrich` | `src/jobs/runEnrichmentJob.ts` | Implemented |
| `profile-acquire` | `src/jobs/runProfileAcquirerJob.ts` | Implemented |
| `preflight` | `src/jobs/runPreflightCheck.ts` | Implemented |
| `snapshot-history:test-delta` | `scripts/gathererSnapshotDeltaEngine.test.ts` | Implemented — manual only |
| `test:performance-columns` | `scripts/test-performance-columns-local.ts` | Implemented — manual only |
