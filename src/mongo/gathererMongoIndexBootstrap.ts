/**
 * Filename: gathererMongoIndexBootstrap.ts
 * Purpose: Ensure gatherer MongoDB collections and indexes exist before publish.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-07-09
 * Dependencies: mongodb, gathererMongoCollections, gathererMongoClient, gathererMongoSnapshotRetention, logger
 * Platform Compatibility: Node.js 18+
 */

import { Db, IndexDescription } from "mongodb";
import { GathererConfig } from "../config";
import {
  GATHERER_MONGO_ALL_COLLECTIONS,
  GATHERER_MONGO_COLLECTION_CREATORS,
  GATHERER_MONGO_COLLECTION_CREATOR_PERFORMANCE_SNAPSHOTS,
  GATHERER_MONGO_COLLECTION_IMPORT_RUNS,
} from "./gathererMongoCollections";
import { gathererConnectMongo } from "./gathererMongoClient";
import { gathererMongoSnapshotRetentionDeduplicateByDay } from "./gathererMongoSnapshotRetention";
import { logDebug, logInfo } from "../logging/logger";

const GATHERER_MONGO_INDEX_BOOTSTRAP_SOURCE = "gathererMongoIndexBootstrap";

const GATHERER_MONGO_PERFORMANCE_SNAPSHOT_LEGACY_UNIQUE_INDEX =
  "gatherer_performance_snapshots_creator_run_unique";

// MARK: Index Bootstrap

export async function gathererBootstrapMongoIndexes(config: GathererConfig): Promise<void> {
  const db = await gathererConnectMongo(config);
  await gathererEnsureMongoIndexes(db, config);
}

async function gathererMongoDropPerformanceSnapshotLegacyIndex(db: Db): Promise<void> {
  const collection = db.collection(GATHERER_MONGO_COLLECTION_CREATOR_PERFORMANCE_SNAPSHOTS);

  try {
    await collection.dropIndex(GATHERER_MONGO_PERFORMANCE_SNAPSHOT_LEGACY_UNIQUE_INDEX);
    logInfo(
      "Dropped legacy performance snapshot index (creator + import_run_id)",
      GATHERER_MONGO_INDEX_BOOTSTRAP_SOURCE
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("index not found") && !message.includes("ns not found")) {
      logDebug("Legacy performance snapshot index drop skipped", GATHERER_MONGO_INDEX_BOOTSTRAP_SOURCE, {
        error: message,
      });
    }
  }
}

async function gathererMongoHasLegacyPerformanceSnapshotIndex(db: Db): Promise<boolean> {
  const collection = db.collection(GATHERER_MONGO_COLLECTION_CREATOR_PERFORMANCE_SNAPSHOTS);
  const indexes = await collection.indexes();
  return indexes.some((index) => index.name === GATHERER_MONGO_PERFORMANCE_SNAPSHOT_LEGACY_UNIQUE_INDEX);
}

async function gathererEnsureMongoIndexes(db: Db, config: GathererConfig): Promise<void> {
  for (const collectionName of GATHERER_MONGO_ALL_COLLECTIONS) {
    await db.createCollection(collectionName).catch(() => undefined);
  }

  if (config.gathererMongoSnapshotOnePerDay !== false) {
    const hasLegacyPerformanceSnapshotIndex = await gathererMongoHasLegacyPerformanceSnapshotIndex(db);
    if (hasLegacyPerformanceSnapshotIndex) {
      await gathererMongoSnapshotRetentionDeduplicateByDay(config);
      await gathererMongoDropPerformanceSnapshotLegacyIndex(db);
    }
  }

  await db.collection(GATHERER_MONGO_COLLECTION_CREATORS).createIndexes([
    {
      key: { backstage_creator_id: 1 },
      unique: true,
      name: "gatherer_creators_backstage_creator_id_unique",
    },
    { key: { normalized_username: 1 }, name: "gatherer_creators_normalized_username" },
    { key: { tiktok_username: 1 }, name: "gatherer_creators_tiktok_username" },
    { key: { last_successful_sync_at: -1 }, name: "gatherer_creators_last_successful_sync_at" },
    { key: { import_run_id: 1 }, name: "gatherer_creators_import_run_id" },
  ]);

  const performanceSnapshotIndexes: IndexDescription[] =
    config.gathererMongoSnapshotOnePerDay === false
      ? [
          {
            key: { backstage_creator_id: 1, import_run_id: 1 },
            unique: true,
            name: GATHERER_MONGO_PERFORMANCE_SNAPSHOT_LEGACY_UNIQUE_INDEX,
          },
          { key: { import_run_id: 1 }, name: "gatherer_performance_snapshots_import_run_id" },
          { key: { imported_at: -1 }, name: "gatherer_performance_snapshots_imported_at" },
          {
            key: { backstage_creator_id: 1, imported_at: -1 },
            name: "gatherer_performance_snapshots_creator_time",
          },
        ]
      : [
          {
            key: { backstage_creator_id: 1, snapshot_date_key: 1 },
            unique: true,
            name: "gatherer_performance_snapshots_creator_day_unique",
          },
          { key: { import_run_id: 1 }, name: "gatherer_performance_snapshots_import_run_id" },
          { key: { imported_at: -1 }, name: "gatherer_performance_snapshots_imported_at" },
          { key: { snapshot_date_key: -1 }, name: "gatherer_performance_snapshots_snapshot_date_key" },
          {
            key: { backstage_creator_id: 1, imported_at: -1 },
            name: "gatherer_performance_snapshots_creator_time",
          },
        ];

  await db
    .collection(GATHERER_MONGO_COLLECTION_CREATOR_PERFORMANCE_SNAPSHOTS)
    .createIndexes(performanceSnapshotIndexes);

  await db.collection(GATHERER_MONGO_COLLECTION_IMPORT_RUNS).createIndexes([
    { key: { run_id: 1 }, unique: true, name: "gatherer_import_runs_run_id_unique" },
    { key: { started_at: -1 }, name: "gatherer_import_runs_started_at" },
    { key: { success: 1, finished_at: -1 }, name: "gatherer_import_runs_success_finished_at" },
  ]);

  logDebug("Gatherer MongoDB indexes ensured", GATHERER_MONGO_INDEX_BOOTSTRAP_SOURCE);
  logInfo("Gatherer MongoDB indexes ready", GATHERER_MONGO_INDEX_BOOTSTRAP_SOURCE);
}

// Suggestions For Features and Additions Later:
// - TTL index on creator_performance_snapshots for long-term retention policy
// - Partial index on creators where relationship_status is Effective
