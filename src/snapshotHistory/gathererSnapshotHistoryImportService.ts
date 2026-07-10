/**
 * Filename: gathererSnapshotHistoryImportService.ts
 * Purpose: Import Drive daily archives into creator_daily_snapshots (Priority 1 history engine).
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-07-09
 * Dependencies: mongodb, snapshot history modules, gathererMongoIndexBootstrap
 * Platform Compatibility: Node.js 18+
 */

import { createHash } from "crypto";
import { AnyBulkWriteOperation } from "mongodb";
import { GathererConfig, gathererIsMongoConfigured } from "../config";
import { CombinedCreatorRecord } from "../processing/mergeBackstageReports";
import { normalizeTikTokUsername } from "../processing/normalizeUsername";
import { logError, logInfo, logWarn } from "../logging/logger";
import { gathererConnectMongo } from "../mongo/gathererMongoClient";
import { gathererBootstrapMongoIndexes } from "../mongo/gathererMongoIndexBootstrap";
import {
  GATHERER_MONGO_COLLECTION_CREATOR_DAILY_SNAPSHOTS,
  GATHERER_MONGO_COLLECTION_SNAPSHOT_IMPORT_RUNS,
} from "../mongo/gathererMongoCollections";
import {
  GathererCreatorDailySnapshotDocument,
  GathererSnapshotCumulativeMetrics,
  GathererSnapshotImportRunDocument,
} from "../types/gathererCreatorDailySnapshot";
import {
  gathererSnapshotDeltaEngineDeriveDailyMetrics,
  gathererSnapshotDeltaEnginePriorDateKey,
  gathererSnapshotDeltaEngineSnapshotMonth,
} from "./gathererSnapshotDeltaEngine";
import {
  GathererSnapshotHistoryArchiveEntry,
  gathererSnapshotHistoryListArchiveEntries,
} from "./gathererSnapshotHistoryDriveScanner";
import { gathererSnapshotHistoryReadCombinedCreatorsFromSpreadsheet } from "./gathererSnapshotHistorySheetReader";
import { gathererSnapshotMonthlyGoalsUpsertFromCreators } from "./gathererSnapshotMonthlyGoalsService";

const GATHERER_SNAPSHOT_HISTORY_IMPORT_SERVICE_SOURCE = "gathererSnapshotHistoryImportService";

const GATHERER_SNAPSHOT_HISTORY_BULK_CHUNK_SIZE = 200;

// MARK: Import Options

export interface GathererSnapshotHistoryImportOptions {
  trigger: "scheduled" | "backfill" | "manual";
  /** Import only this date (YYYY-MM-DD). When omitted, imports all discovered archives. */
  snapshotDate?: string;
  /** Scheduled nightly: only import archives on or before this date (typically yesterday ET). */
  importThroughDate?: string;
  /** Re-import dates even if already present (idempotent upsert). Default true. */
  forceReimport?: boolean;
  /** Skip dates already imported unless forceReimport. Default false for backfill, true for scheduled single-day. */
  skipExistingDates?: boolean;
}

export interface GathererSnapshotHistoryImportResult {
  importRunId: string;
  success: boolean;
  filesScanned: number;
  filesImported: number;
  snapshotsUpserted: number;
  snapshotsSkipped: number;
  errors: Array<{ fileName: string; date: string; message: string }>;
}

// MARK: Identity Helpers

function gathererSnapshotHistoryResolveCreatorId(creator: CombinedCreatorRecord): string | null {
  const backstageId = String(creator.backstage_creator_id ?? "").trim();
  if (backstageId) {
    return backstageId;
  }
  const username = normalizeTikTokUsername(
    String(creator.normalized_username ?? creator.tiktok_username ?? "")
  );
  return username || null;
}

function gathererSnapshotHistoryResolveUsername(creator: CombinedCreatorRecord): string {
  return (
    normalizeTikTokUsername(String(creator.normalized_username ?? creator.tiktok_username ?? "")) ||
    "unknown"
  );
}

function gathererSnapshotHistoryBuildRowChecksum(creator: CombinedCreatorRecord): string | null {
  const raw = creator.row_checksum ?? null;
  if (raw) {
    return String(raw);
  }
  const payload = JSON.stringify({
    id: creator.backstage_creator_id,
    diamonds: creator.total_diamonds,
    hours: creator.live_duration_total_hours,
    days: creator.valid_live_days_total,
  });
  return createHash("sha256").update(payload).digest("hex");
}

function gathererSnapshotHistoryExtractCumulative(
  creator: CombinedCreatorRecord
): GathererSnapshotCumulativeMetrics {
  return {
    diamonds: typeof creator.total_diamonds === "number" ? creator.total_diamonds : null,
    liveHours:
      typeof creator.live_duration_total_hours === "number"
        ? creator.live_duration_total_hours
        : null,
    validDays:
      typeof creator.valid_live_days_total === "number" ? creator.valid_live_days_total : null,
  };
}

function gathererSnapshotHistoryBuildImportRunId(trigger: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `snapshot_import_${trigger}_${stamp}`;
}

// MARK: Prior Snapshot Lookup

interface GathererSnapshotHistoryPriorLookup {
  metrics: GathererSnapshotCumulativeMetrics;
  priorSnapshotDate: string;
}

async function gathererSnapshotHistoryLoadPriorCumulativeMap(
  config: GathererConfig,
  snapshotDate: string,
  creatorIds: string[]
): Promise<Map<string, GathererSnapshotHistoryPriorLookup>> {
  const map = new Map<string, GathererSnapshotHistoryPriorLookup>();

  if (creatorIds.length === 0) {
    return map;
  }

  const db = await gathererConnectMongo(config);
  const collection = db.collection<GathererCreatorDailySnapshotDocument>(
    GATHERER_MONGO_COLLECTION_CREATOR_DAILY_SNAPSHOTS
  );

  const pipeline = [
    {
      $match: {
        creatorId: { $in: creatorIds },
        snapshotDate: { $lt: snapshotDate },
        dataStatus: { $ne: "missing_data" },
        $or: [
          { cumulativeDiamondsMonth: { $type: "number" } },
          { cumulativeLiveHoursMonth: { $type: "number" } },
          { cumulativeValidDaysMonth: { $type: "number" } },
        ],
      },
    },
    { $sort: { snapshotDate: -1 as const } },
    {
      $group: {
        _id: "$creatorId",
        cumulativeDiamondsMonth: { $first: "$cumulativeDiamondsMonth" },
        cumulativeLiveHoursMonth: { $first: "$cumulativeLiveHoursMonth" },
        cumulativeValidDaysMonth: { $first: "$cumulativeValidDaysMonth" },
        priorSnapshotDate: { $first: "$snapshotDate" },
      },
    },
  ];

  const grouped = await collection.aggregate(pipeline).toArray();

  for (const row of grouped) {
    map.set(String(row._id), {
      priorSnapshotDate: String(row.priorSnapshotDate),
      metrics: {
        diamonds:
          typeof row.cumulativeDiamondsMonth === "number" ? row.cumulativeDiamondsMonth : null,
        liveHours:
          typeof row.cumulativeLiveHoursMonth === "number" ? row.cumulativeLiveHoursMonth : null,
        validDays:
          typeof row.cumulativeValidDaysMonth === "number" ? row.cumulativeValidDaysMonth : null,
      },
    });
  }

  return map;
}

async function gathererSnapshotHistoryHasSnapshotsForDate(
  config: GathererConfig,
  snapshotDate: string
): Promise<boolean> {
  const db = await gathererConnectMongo(config);
  const collection = db.collection(GATHERER_MONGO_COLLECTION_CREATOR_DAILY_SNAPSHOTS);
  const existing = await collection.findOne({ snapshotDate }, { projection: { _id: 1 } });
  return existing !== null;
}

// MARK: Build Snapshot Documents

function gathererSnapshotHistoryBuildSnapshotDocuments(input: {
  creators: CombinedCreatorRecord[];
  archive: GathererSnapshotHistoryArchiveEntry;
  importRunId: string;
  importedAt: string;
  priorCumulativeByCreator: Map<string, GathererSnapshotHistoryPriorLookup>;
  defaultRegion: string;
}): GathererCreatorDailySnapshotDocument[] {
  const { creators, archive, importRunId, importedAt, priorCumulativeByCreator, defaultRegion } =
    input;

  const documents: GathererCreatorDailySnapshotDocument[] = [];

  for (const creator of creators) {
    const creatorId = gathererSnapshotHistoryResolveCreatorId(creator);
    if (!creatorId) {
      continue;
    }

    const cumulative = gathererSnapshotHistoryExtractCumulative(creator);
    const priorLookup = priorCumulativeByCreator.get(creatorId) ?? null;
    const prior = priorLookup?.metrics ?? null;
    const derived = gathererSnapshotDeltaEngineDeriveDailyMetrics({
      snapshotDate: archive.snapshotDate,
      current: cumulative,
      prior,
      priorSnapshotDate: priorLookup?.priorSnapshotDate ?? null,
    });

    documents.push({
      creatorId,
      tiktokUsername: gathererSnapshotHistoryResolveUsername(creator),
      backstageCreatorId: String(creator.backstage_creator_id ?? creatorId),
      snapshotDate: archive.snapshotDate,
      snapshotMonth: gathererSnapshotDeltaEngineSnapshotMonth(archive.snapshotDate),
      diamonds: derived.diamonds,
      liveHours: derived.liveHours,
      validLiveDay: derived.validLiveDay,
      liveDays: derived.liveDays,
      liveSessions:
        typeof creator.live_streams === "number" ? Math.max(0, Math.round(creator.live_streams)) : null,
      followers: typeof creator.followers === "number" ? creator.followers : null,
      region: defaultRegion,
      currentDipTier: creator.current_tier ?? null,
      cumulativeDiamondsMonth: cumulative.diamonds,
      cumulativeLiveHoursMonth: cumulative.liveHours,
      cumulativeValidDaysMonth: cumulative.validDays,
      sourceFileName: archive.sourceFileName,
      sourceSheet: "Combined Creators",
      sourceFileId: archive.spreadsheetId,
      sourceDateFolder: archive.snapshotDate,
      importRunId,
      importedAt,
      rowChecksum: gathererSnapshotHistoryBuildRowChecksum(creator),
      dataStatus: derived.dataStatus,
      dataStatusNote: derived.dataStatusNote,
      validLiveDayRule: "61_minutes",
      schemaVersion: 1,
    });
  }

  return documents;
}

// MARK: Upsert Snapshots

async function gathererSnapshotHistoryUpsertSnapshots(
  config: GathererConfig,
  documents: GathererCreatorDailySnapshotDocument[]
): Promise<number> {
  if (documents.length === 0) {
    return 0;
  }

  const db = await gathererConnectMongo(config);
  const collection = db.collection<GathererCreatorDailySnapshotDocument>(
    GATHERER_MONGO_COLLECTION_CREATOR_DAILY_SNAPSHOTS
  );

  let upserted = 0;

  for (let index = 0; index < documents.length; index += GATHERER_SNAPSHOT_HISTORY_BULK_CHUNK_SIZE) {
    const chunk = documents.slice(index, index + GATHERER_SNAPSHOT_HISTORY_BULK_CHUNK_SIZE);
    const operations: AnyBulkWriteOperation<GathererCreatorDailySnapshotDocument>[] = chunk.map(
      (document) => ({
        updateOne: {
          filter: { creatorId: document.creatorId, snapshotDate: document.snapshotDate },
          update: { $set: document },
          upsert: true,
        },
      })
    );

    const result = await collection.bulkWrite(operations, { ordered: false });
    upserted += result.upsertedCount + result.modifiedCount + result.matchedCount;
  }

  return upserted;
}

// MARK: Import Single Date

async function gathererSnapshotHistoryImportArchiveEntry(
  config: GathererConfig,
  archive: GathererSnapshotHistoryArchiveEntry,
  importRunId: string,
  importedAt: string
): Promise<{ upserted: number; skipped: number }> {
  const creators = await gathererSnapshotHistoryReadCombinedCreatorsFromSpreadsheet(
    config,
    archive.spreadsheetId,
    archive.snapshotDate
  );

  const creatorIds = creators
    .map((creator) => gathererSnapshotHistoryResolveCreatorId(creator))
    .filter((id): id is string => Boolean(id));

  const priorCumulativeByCreator = await gathererSnapshotHistoryLoadPriorCumulativeMap(
    config,
    archive.snapshotDate,
    creatorIds
  );

  const documents = gathererSnapshotHistoryBuildSnapshotDocuments({
    creators,
    archive,
    importRunId,
    importedAt,
    priorCumulativeByCreator,
    defaultRegion: config.backstageAgencyRegion,
  });

  const upserted = await gathererSnapshotHistoryUpsertSnapshots(config, documents);

  const month = gathererSnapshotDeltaEngineSnapshotMonth(archive.snapshotDate);
  await gathererSnapshotMonthlyGoalsUpsertFromCreators(config, creators, month, importedAt);

  return { upserted, skipped: 0 };
}

// MARK: Public API

export async function gathererSnapshotHistoryRunImport(
  config: GathererConfig,
  options: GathererSnapshotHistoryImportOptions
): Promise<GathererSnapshotHistoryImportResult> {
  if (!gathererIsMongoConfigured(config)) {
    throw new Error("MongoDB is not configured — set MONGODB_URI and GATHERER_MONGODB_ENABLED=true");
  }

  if (!config.googleDriveDailyArchiveFolderId.trim()) {
    throw new Error("GOOGLE_DRIVE_DAILY_ARCHIVE_FOLDER_ID is not configured");
  }

  await gathererBootstrapMongoIndexes(config);

  const importRunId = gathererSnapshotHistoryBuildImportRunId(options.trigger);
  const startedAt = new Date().toISOString();
  const errors: GathererSnapshotHistoryImportResult["errors"] = [];

  let filesScanned = 0;
  let filesImported = 0;
  let snapshotsUpserted = 0;
  let snapshotsSkipped = 0;

  let entries = await gathererSnapshotHistoryListArchiveEntries(config);

  if (options.snapshotDate) {
    entries = entries.filter((entry) => entry.snapshotDate === options.snapshotDate);
  } else if (options.importThroughDate) {
    entries = entries.filter((entry) => entry.snapshotDate <= options.importThroughDate!);
  }

  filesScanned = entries.length;

  logInfo(
    `Starting snapshot history import (${options.trigger}) — ${entries.length} archive file(s)`,
    GATHERER_SNAPSHOT_HISTORY_IMPORT_SERVICE_SOURCE,
    { importRunId }
  );

  for (const archive of entries) {
    try {
      if (options.skipExistingDates && options.forceReimport !== true) {
        const exists = await gathererSnapshotHistoryHasSnapshotsForDate(config, archive.snapshotDate);
        if (exists) {
          snapshotsSkipped += 1;
          logInfo(
            `Skipping ${archive.snapshotDate} — snapshots already imported`,
            GATHERER_SNAPSHOT_HISTORY_IMPORT_SERVICE_SOURCE
          );
          continue;
        }
      }

      const result = await gathererSnapshotHistoryImportArchiveEntry(
        config,
        archive,
        importRunId,
        new Date().toISOString()
      );

      snapshotsUpserted += result.upserted;
      snapshotsSkipped += result.skipped;
      filesImported += 1;

      logInfo(
        `Imported ${archive.snapshotDate} — ${result.upserted} creator daily snapshots`,
        GATHERER_SNAPSHOT_HISTORY_IMPORT_SERVICE_SOURCE
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({
        fileName: archive.sourceFileName,
        date: archive.snapshotDate,
        message,
      });
      logError(
        `Failed to import ${archive.snapshotDate}`,
        GATHERER_SNAPSHOT_HISTORY_IMPORT_SERVICE_SOURCE,
        { error: message }
      );
    }
  }

  const finishedAt = new Date().toISOString();
  const success = errors.length === 0;

  const runDocument: GathererSnapshotImportRunDocument = {
    importRunId,
    startedAt,
    finishedAt,
    trigger: options.trigger,
    filesScanned,
    filesImported,
    snapshotsUpserted,
    snapshotsSkipped,
    errors,
    success,
  };

  const db = await gathererConnectMongo(config);
  await db
    .collection<GathererSnapshotImportRunDocument>(GATHERER_MONGO_COLLECTION_SNAPSHOT_IMPORT_RUNS)
    .insertOne(runDocument);

  if (!success) {
    logWarn(
      `Snapshot history import finished with ${errors.length} error(s)`,
      GATHERER_SNAPSHOT_HISTORY_IMPORT_SERVICE_SOURCE,
      { importRunId }
    );
  } else {
    logInfo(
      `Snapshot history import complete — ${snapshotsUpserted} snapshots upserted`,
      GATHERER_SNAPSHOT_HISTORY_IMPORT_SERVICE_SOURCE,
      { importRunId, filesImported }
    );
  }

  return {
    importRunId,
    success,
    filesScanned,
    filesImported,
    snapshotsUpserted,
    snapshotsSkipped,
    errors,
  };
}

// Suggestions For Features and Additions Later:
// - Parallel import workers for large backfills
// - Checksum-based skip when source file unchanged
