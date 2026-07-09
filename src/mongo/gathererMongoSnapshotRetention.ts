/**
 * Filename: gathererMongoSnapshotRetention.ts
 * Purpose: Deduplicate creator_performance_snapshots to one newest row per creator per calendar day.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-07-09
 * Dependencies: mongodb, gathererMongoCollections, gathererMongoClient, dates, logger
 * Platform Compatibility: Node.js 18+
 */

import { Db, ObjectId } from "mongodb";
import { GathererConfig } from "../config";
import { logDebug, logInfo } from "../logging/logger";
import { gathererFormatDateKeyInTimezone } from "../utils/dates";
import { GATHERER_MONGO_COLLECTION_CREATOR_PERFORMANCE_SNAPSHOTS } from "./gathererMongoCollections";
import { gathererGetMongoDb } from "./gathererMongoClient";

const GATHERER_MONGO_SNAPSHOT_RETENTION_SOURCE = "gathererMongoSnapshotRetention";

const GATHERER_MONGO_SNAPSHOT_RETENTION_DEDUP_BATCH_SIZE = 500;

// MARK: Snapshot Date Key

export function gathererMongoSnapshotRetentionResolveDateKey(
  timezone: string,
  importedAt: string | null | undefined,
  existingDateKey: string | null | undefined,
  fallbackDate: Date = new Date()
): string {
  const trimmedExisting = String(existingDateKey ?? "").trim();
  if (trimmedExisting) {
    return trimmedExisting;
  }

  const trimmedImportedAt = String(importedAt ?? "").trim();
  if (trimmedImportedAt) {
    const parsedImportedAt = new Date(trimmedImportedAt);
    if (!Number.isNaN(parsedImportedAt.getTime())) {
      return gathererFormatDateKeyInTimezone(timezone, parsedImportedAt);
    }
  }

  return gathererFormatDateKeyInTimezone(timezone, fallbackDate);
}

// MARK: Backfill Missing Date Keys

async function gathererMongoSnapshotRetentionBackfillDateKeys(
  db: Db,
  timezone: string
): Promise<number> {
  const collection = db.collection(GATHERER_MONGO_COLLECTION_CREATOR_PERFORMANCE_SNAPSHOTS);
  const cursor = collection.find(
    {
      $or: [
        { snapshot_date_key: { $exists: false } },
        { snapshot_date_key: null },
        { snapshot_date_key: "" },
      ],
    },
    {
      projection: {
        _id: 1,
        imported_at: 1,
        gatherer_mongo_snapshot_written_at: 1,
      },
    }
  );

  let backfilledCount = 0;
  const pendingUpdates: Array<{ filter: { _id: ObjectId }; update: { $set: { snapshot_date_key: string } } }> =
    [];

  for await (const document of cursor) {
    const snapshotDateKey = gathererMongoSnapshotRetentionResolveDateKey(
      timezone,
      typeof document.imported_at === "string" ? document.imported_at : null,
      null,
      typeof document.gatherer_mongo_snapshot_written_at === "string"
        ? new Date(document.gatherer_mongo_snapshot_written_at)
        : new Date()
    );

    pendingUpdates.push({
      filter: { _id: document._id as ObjectId },
      update: { $set: { snapshot_date_key: snapshotDateKey } },
    });

    if (pendingUpdates.length >= GATHERER_MONGO_SNAPSHOT_RETENTION_DEDUP_BATCH_SIZE) {
      await collection.bulkWrite(
        pendingUpdates.map((entry) => ({
          updateOne: {
            filter: entry.filter,
            update: entry.update,
          },
        })),
        { ordered: false }
      );
      backfilledCount += pendingUpdates.length;
      pendingUpdates.length = 0;
    }
  }

  if (pendingUpdates.length > 0) {
    await collection.bulkWrite(
      pendingUpdates.map((entry) => ({
        updateOne: {
          filter: entry.filter,
          update: entry.update,
        },
      })),
      { ordered: false }
    );
    backfilledCount += pendingUpdates.length;
  }

  if (backfilledCount > 0) {
    logInfo(
      `Backfilled snapshot_date_key on ${backfilledCount} performance snapshots`,
      GATHERER_MONGO_SNAPSHOT_RETENTION_SOURCE
    );
  }

  return backfilledCount;
}

// MARK: Deduplicate By Creator + Day

export async function gathererMongoSnapshotRetentionDeduplicateByDay(
  config: GathererConfig
): Promise<{ backfilledCount: number; deletedCount: number }> {
  const db = gathererGetMongoDb();
  const collection = db.collection(GATHERER_MONGO_COLLECTION_CREATOR_PERFORMANCE_SNAPSHOTS);

  const backfilledCount = await gathererMongoSnapshotRetentionBackfillDateKeys(db, config.timezone);

  const duplicateGroupCursor = collection.aggregate<{
    _id: { backstage_creator_id: string; snapshot_date_key: string };
    docs: Array<{ id: ObjectId; w: string | null; i: string | null }>;
    duplicateCount: number;
  }>(
    [
      {
        $match: {
          backstage_creator_id: { $exists: true, $ne: "" },
          snapshot_date_key: { $exists: true, $ne: "" },
        },
      },
      {
        $group: {
          _id: {
            backstage_creator_id: "$backstage_creator_id",
            snapshot_date_key: "$snapshot_date_key",
          },
          docs: {
            $push: {
              id: "$_id",
              w: "$gatherer_mongo_snapshot_written_at",
              i: "$imported_at",
            },
          },
          duplicateCount: { $sum: 1 },
        },
      },
      { $match: { duplicateCount: { $gt: 1 } } },
    ],
    { allowDiskUse: true }
  );

  const deleteIds: ObjectId[] = [];
  let duplicateGroups = 0;

  for await (const group of duplicateGroupCursor) {
    duplicateGroups += 1;
    const sortedDocs = [...group.docs].sort((left, right) => {
      const leftWritten = Date.parse(String(left.w ?? "")) || 0;
      const rightWritten = Date.parse(String(right.w ?? "")) || 0;
      if (rightWritten !== leftWritten) {
        return rightWritten - leftWritten;
      }
      const leftImported = Date.parse(String(left.i ?? "")) || 0;
      const rightImported = Date.parse(String(right.i ?? "")) || 0;
      return rightImported - leftImported;
    });

    for (const doc of sortedDocs.slice(1)) {
      deleteIds.push(doc.id);
    }
  }

  if (duplicateGroups === 0) {
    logDebug("No duplicate performance snapshots found for daily retention", GATHERER_MONGO_SNAPSHOT_RETENTION_SOURCE);
    return { backfilledCount, deletedCount: 0 };
  }

  let deletedCount = 0;
  for (
    let index = 0;
    index < deleteIds.length;
    index += GATHERER_MONGO_SNAPSHOT_RETENTION_DEDUP_BATCH_SIZE
  ) {
    const chunk = deleteIds.slice(index, index + GATHERER_MONGO_SNAPSHOT_RETENTION_DEDUP_BATCH_SIZE);
    const result = await collection.deleteMany({ _id: { $in: chunk } });
    deletedCount += result.deletedCount;
  }

  logInfo(
    `Removed ${deletedCount} duplicate performance snapshots (${duplicateGroups} creator-day groups)`,
    GATHERER_MONGO_SNAPSHOT_RETENTION_SOURCE,
    {
      backfilledCount,
      duplicateGroups,
    }
  );

  return { backfilledCount, deletedCount };
}

// Suggestions For Features and Additions Later:
// - TTL index for snapshots older than N days/months
// - Archive removed duplicates to cold storage before delete
