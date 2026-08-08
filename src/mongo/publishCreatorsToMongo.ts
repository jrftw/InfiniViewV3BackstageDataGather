/**
 * Filename: publishCreatorsToMongo.ts
 * Purpose: Upsert creators, tombstone departed creators, upsert one daily performance snapshot per creator, and record import runs in MongoDB.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-08-08
 * Dependencies: mongodb, config, logger, gathererMongoClient, gathererMongoIndexBootstrap, gathererCreatorMongoMapper, gathererMongoRosterMembership
 * Platform Compatibility: Node.js 18+
 */

import { AnyBulkWriteOperation } from "mongodb";
import { GathererConfig } from "../config";
import { CombinedCreatorRecord } from "../processing/mergeBackstageReports";
import { FilterActiveCreatorsExcludedEntry } from "../processing/filterActiveCreators";
import { ImportSummaryData } from "../logging/importSummary";
import { logError, logInfo } from "../logging/logger";
import { gathererFormatDateKeyInTimezone } from "../utils/dates";
import {
  GATHERER_MONGO_COLLECTION_CREATORS,
  GATHERER_MONGO_COLLECTION_CREATOR_PERFORMANCE_SNAPSHOTS,
  GATHERER_MONGO_COLLECTION_IMPORT_RUNS,
} from "./gathererMongoCollections";
import { gathererConnectMongo, gathererGetMongoDb } from "./gathererMongoClient";
import { gathererBootstrapMongoIndexes } from "./gathererMongoIndexBootstrap";
import {
  gathererMongoMapperCreatorToDocument,
  gathererMongoMapperCreatorToPerformanceSnapshot,
  gathererMongoMapperSummaryToImportRunDocument,
  GathererMongoCreatorDocument,
  GathererMongoPerformanceSnapshotDocument,
} from "./gathererCreatorMongoMapper";
import {
  gathererRosterMembershipBuildActiveStampFields,
  gathererRosterMembershipBuildDeparturesFromExclusions,
  gathererRosterMembershipMarkDepartedCreators,
  GathererRosterMembershipSweepResult,
} from "./gathererMongoRosterMembership";
import { gathererPerformanceDataPeriodCoversMonth } from "../processing/gathererPerformanceDataPeriodCoverage";

const GATHERER_PUBLISH_CREATORS_TO_MONGO_SOURCE = "publishCreatorsToMongo";

const GATHERER_MONGO_BULK_WRITE_CHUNK_SIZE = 250;

/**
 * MTD fields that must not carry prior-month totals forward when performance_data_period still
 * describes the previous calendar month (common on the 1st before the first August export lands).
 */
const GATHERER_MONGO_MONTHLY_MTD_FIELDS = [
  "total_diamonds",
  "live_duration_total_hours",
  "valid_live_days_total",
] as const;

/** Non-monthly fields only — monthly totals must not carry stale prior-month values forward. */
const GATHERER_MONGO_PRESERVE_ON_NULL_FIELDS = [
  "matches",
  "fan_club_total_diamonds",
  "new_followers",
  "live_streams",
] as const;

// MARK: Publish Result

export interface GathererMongoPublishResult {
  published: boolean;
  creatorsUpserted: number;
  creatorsSkipped: number;
  snapshotsInserted: number;
  importRunRecorded: boolean;
  /** Outcome of the departed-creator tombstone sweep, or null when no creators were published. */
  rosterMembershipSweep: GathererRosterMembershipSweepResult | null;
}

// MARK: Bulk Write Helpers

function gathererMongoPublishChunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

function gathererMongoPublishApplyStaleMtdPreservation(
  setFields: Record<string, unknown>,
  performanceDataPeriod: string | null | undefined,
  currentMonthKey: string,
  suppressStaleMtd: boolean
): boolean {
  if (!suppressStaleMtd) {
    return false;
  }

  const periodCoversCurrentMonth = gathererPerformanceDataPeriodCoversMonth(
    performanceDataPeriod,
    currentMonthKey
  );

  if (periodCoversCurrentMonth) {
    return false;
  }

  for (const monthlyField of GATHERER_MONGO_MONTHLY_MTD_FIELDS) {
    setFields[monthlyField] = {
      $ifNull: [`$${monthlyField}`, null],
    };
  }

  return true;
}

async function gathererMongoPublishUpsertCreators(
  creatorDocuments: GathererMongoCreatorDocument[],
  runId: string,
  seenAt: string,
  currentMonthKey: string,
  suppressStaleMtd: boolean
): Promise<{ upsertedCount: number; staleMtdPreservedCount: number }> {
  const db = gathererGetMongoDb();
  const collection = db.collection<GathererMongoCreatorDocument>(GATHERER_MONGO_COLLECTION_CREATORS);
  const activeStampFields = gathererRosterMembershipBuildActiveStampFields(runId, seenAt);
  let upsertedCount = 0;
  let staleMtdPreservedCount = 0;

  for (const chunk of gathererMongoPublishChunkArray(creatorDocuments, GATHERER_MONGO_BULK_WRITE_CHUNK_SIZE)) {
    const operations: AnyBulkWriteOperation<GathererMongoCreatorDocument>[] = chunk.map((document) => {
      // The active membership stamp is what the tombstone sweep keys off, so it must be
      // written in the same operation that proves the creator is still on the roster.
      const setFields: Record<string, unknown> = { ...document, ...activeStampFields };

      for (const preserveField of GATHERER_MONGO_PRESERVE_ON_NULL_FIELDS) {
        const incomingValue = document[preserveField];
        if (incomingValue === null || incomingValue === undefined) {
          setFields[preserveField] = {
            $ifNull: [`$${preserveField}`, null],
          };
        }
      }

      const staleMtdPreserved = gathererMongoPublishApplyStaleMtdPreservation(
        setFields,
        typeof document.performance_data_period === "string"
          ? document.performance_data_period
          : null,
        currentMonthKey,
        suppressStaleMtd
      );
      if (staleMtdPreserved) {
        staleMtdPreservedCount += 1;
      }

      return {
        updateOne: {
          filter: { backstage_creator_id: document.backstage_creator_id },
          update: [{ $set: setFields }],
          upsert: true,
        },
      };
    });

    const result = await collection.bulkWrite(operations, { ordered: false });
    upsertedCount += result.upsertedCount + result.modifiedCount + result.matchedCount;
  }

  return { upsertedCount, staleMtdPreservedCount };
}

async function gathererMongoPublishUpsertPerformanceSnapshots(
  snapshotDocuments: GathererMongoPerformanceSnapshotDocument[],
  currentMonthKey: string,
  suppressStaleMtd: boolean
): Promise<{ upsertedCount: number; staleMtdPreservedCount: number }> {
  const db = gathererGetMongoDb();
  const collection = db.collection<GathererMongoPerformanceSnapshotDocument>(
    GATHERER_MONGO_COLLECTION_CREATOR_PERFORMANCE_SNAPSHOTS
  );

  let upsertedCount = 0;
  let staleMtdPreservedCount = 0;

  for (const chunk of gathererMongoPublishChunkArray(snapshotDocuments, GATHERER_MONGO_BULK_WRITE_CHUNK_SIZE)) {
    const operations: AnyBulkWriteOperation<GathererMongoPerformanceSnapshotDocument>[] = chunk.map(
      (document) => {
        const setFields: Record<string, unknown> = { ...document };
        const staleMtdPreserved = gathererMongoPublishApplyStaleMtdPreservation(
          setFields,
          document.performance_data_period,
          currentMonthKey,
          suppressStaleMtd
        );
        if (staleMtdPreserved) {
          staleMtdPreservedCount += 1;
        }

        return {
          updateOne: {
            filter: {
              backstage_creator_id: document.backstage_creator_id,
              snapshot_date_key: document.snapshot_date_key,
            },
            update: [{ $set: setFields }],
            upsert: true,
          },
        };
      }
    );

    const result = await collection.bulkWrite(operations, { ordered: false });
    upsertedCount += result.upsertedCount + result.modifiedCount + result.matchedCount;
  }

  return { upsertedCount, staleMtdPreservedCount };
}

async function gathererMongoPublishRecordImportRun(
  summary: ImportSummaryData,
  mongoPublished: boolean,
  mongoWrittenAt: string
): Promise<void> {
  const db = gathererGetMongoDb();
  const importRunDocument = gathererMongoMapperSummaryToImportRunDocument(
    summary,
    mongoPublished,
    mongoWrittenAt
  );

  await db.collection(GATHERER_MONGO_COLLECTION_IMPORT_RUNS).updateOne(
    { run_id: importRunDocument.run_id },
    { $set: importRunDocument },
    { upsert: true }
  );
}

// MARK: Public Publish API

export async function publishCreatorsToMongo(
  config: GathererConfig,
  creators: CombinedCreatorRecord[],
  summary: ImportSummaryData,
  excludedCreators: readonly FilterActiveCreatorsExcludedEntry[] = []
): Promise<GathererMongoPublishResult> {
  const mongoWrittenAt = new Date().toISOString();
  const snapshotDateKey = gathererFormatDateKeyInTimezone(config.timezone, new Date(mongoWrittenAt));
  const currentMonthKey = snapshotDateKey.slice(0, 7);
  const emptyResult: GathererMongoPublishResult = {
    published: false,
    creatorsUpserted: 0,
    creatorsSkipped: creators.length,
    snapshotsInserted: 0,
    importRunRecorded: false,
    rosterMembershipSweep: null,
  };

  await gathererConnectMongo(config);
  await gathererBootstrapMongoIndexes(config);

  const creatorDocuments: GathererMongoCreatorDocument[] = [];
  const snapshotDocuments: GathererMongoPerformanceSnapshotDocument[] = [];
  let creatorsSkipped = 0;

  for (const creator of creators) {
    const creatorDocument = gathererMongoMapperCreatorToDocument(creator, mongoWrittenAt);
    if (!creatorDocument) {
      creatorsSkipped += 1;
      continue;
    }
    creatorDocuments.push(creatorDocument);

    const snapshotDocument = gathererMongoMapperCreatorToPerformanceSnapshot(
      creator,
      mongoWrittenAt,
      snapshotDateKey
    );
    if (snapshotDocument) {
      snapshotDocuments.push(snapshotDocument);
    }
  }

  if (creatorDocuments.length === 0) {
    logInfo("MongoDB publish skipped — no valid creator documents", GATHERER_PUBLISH_CREATORS_TO_MONGO_SOURCE);
    await gathererMongoPublishRecordImportRun(summary, false, mongoWrittenAt);
    return { ...emptyResult, importRunRecorded: true };
  }

  try {
    const creatorUpsertResult = await gathererMongoPublishUpsertCreators(
      creatorDocuments,
      summary.runId,
      mongoWrittenAt,
      currentMonthKey,
      config.gathererMongoSuppressStaleMtdOnRosterPublish
    );
    const creatorsUpserted = creatorUpsertResult.upsertedCount;

    // Runs only after the upsert above resolved without throwing, so every creator on the
    // active roster is guaranteed to carry this run's membership stamp before the sweep
    // decides who is missing.
    const rosterMembershipSweep = await gathererRosterMembershipMarkDepartedCreators(
      config,
      summary.runId,
      mongoWrittenAt,
      gathererRosterMembershipBuildDeparturesFromExclusions(excludedCreators)
    );

    const snapshotUpsertResult = await gathererMongoPublishUpsertPerformanceSnapshots(
      snapshotDocuments,
      currentMonthKey,
      config.gathererMongoSuppressStaleMtdOnRosterPublish
    );
    const snapshotsInserted = snapshotUpsertResult.upsertedCount;
    await gathererMongoPublishRecordImportRun(summary, true, mongoWrittenAt);

    logInfo(
      `MongoDB publish complete — ${creatorsUpserted} creators upserted, ${snapshotsInserted} daily snapshots upserted, ${rosterMembershipSweep.markedDepartedCount} creators marked departed`,
      GATHERER_PUBLISH_CREATORS_TO_MONGO_SOURCE,
      {
        creatorsSkipped,
        database: config.mongodbDbName,
        snapshotDateKey,
        currentMonthKey,
        staleMtdPreservedOnCreators: creatorUpsertResult.staleMtdPreservedCount,
        staleMtdPreservedOnSnapshots: snapshotUpsertResult.staleMtdPreservedCount,
        suppressStaleMtdOnRosterPublish: config.gathererMongoSuppressStaleMtdOnRosterPublish,
        rosterMembershipSweepSkippedReason: rosterMembershipSweep.skippedReason,
      }
    );

    return {
      published: true,
      creatorsUpserted,
      creatorsSkipped,
      snapshotsInserted,
      importRunRecorded: true,
      rosterMembershipSweep,
    };
  } catch (error) {
    logError("MongoDB publish failed", GATHERER_PUBLISH_CREATORS_TO_MONGO_SOURCE, {
      error: error instanceof Error ? error.message : String(error),
      database: config.mongodbDbName,
    });

    try {
      await gathererMongoPublishRecordImportRun(summary, false, mongoWrittenAt);
    } catch (recordError) {
      logError("MongoDB import run record failed", GATHERER_PUBLISH_CREATORS_TO_MONGO_SOURCE, {
        error: recordError instanceof Error ? recordError.message : String(recordError),
      });
    }

    throw error;
  }
}

// Suggestions For Features and Additions Later:
// - Transaction wrapper for creators + snapshots + import_run atomic commit
// - Record the tombstone sweep counts on the import run document for run-history reporting
// - Optional TTL purge for snapshots older than N months
