/**
 * Filename: gathererMongoCollections.ts
 * Purpose: MongoDB collection name constants for Backstage Gatherer production output.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-27
 * Dependencies: none
 * Platform Compatibility: Node.js 18+
 */

// MARK: Collection Names

/** Current merged creator row — one document per backstage_creator_id (upserted each run). */
export const GATHERER_MONGO_COLLECTION_CREATORS = "creators";

/** One performance snapshot per creator per calendar day (newest run wins). */
export const GATHERER_MONGO_COLLECTION_CREATOR_PERFORMANCE_SNAPSHOTS =
  "creator_performance_snapshots";

/** Gatherer run metadata (success, counts, timestamps). */
export const GATHERER_MONGO_COLLECTION_IMPORT_RUNS = "gatherer_import_runs";

/** Daily contribution snapshots — one row per creator per calendar day (Priority 1 history engine). */
export const GATHERER_MONGO_COLLECTION_CREATOR_DAILY_SNAPSHOTS = "creator_daily_snapshots";

/** Monthly D.I.P. goal targets per creator (source of truth for goal math). */
export const GATHERER_MONGO_COLLECTION_CREATOR_MONTHLY_GOALS = "creator_monthly_goals";

/** Audit log for Drive history snapshot import runs. */
export const GATHERER_MONGO_COLLECTION_SNAPSHOT_IMPORT_RUNS = "creator_snapshot_import_runs";

export const GATHERER_MONGO_ALL_COLLECTIONS = [
  GATHERER_MONGO_COLLECTION_CREATORS,
  GATHERER_MONGO_COLLECTION_CREATOR_PERFORMANCE_SNAPSHOTS,
  GATHERER_MONGO_COLLECTION_IMPORT_RUNS,
  GATHERER_MONGO_COLLECTION_CREATOR_DAILY_SNAPSHOTS,
  GATHERER_MONGO_COLLECTION_CREATOR_MONTHLY_GOALS,
  GATHERER_MONGO_COLLECTION_SNAPSHOT_IMPORT_RUNS,
] as const;

// Suggestions For Features and Additions Later:
// - Separate unmatched_rows collection for ops dashboards
// - crm_sync_logs collection when CRM push is automated
