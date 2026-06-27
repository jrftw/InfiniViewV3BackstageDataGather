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

/** Append-only performance history per gatherer import run. */
export const GATHERER_MONGO_COLLECTION_CREATOR_PERFORMANCE_SNAPSHOTS =
  "creator_performance_snapshots";

/** Gatherer run metadata (success, counts, timestamps). */
export const GATHERER_MONGO_COLLECTION_IMPORT_RUNS = "gatherer_import_runs";

export const GATHERER_MONGO_ALL_COLLECTIONS = [
  GATHERER_MONGO_COLLECTION_CREATORS,
  GATHERER_MONGO_COLLECTION_CREATOR_PERFORMANCE_SNAPSHOTS,
  GATHERER_MONGO_COLLECTION_IMPORT_RUNS,
] as const;

// Suggestions For Features and Additions Later:
// - Separate unmatched_rows collection for ops dashboards
// - crm_sync_logs collection when CRM push is automated
