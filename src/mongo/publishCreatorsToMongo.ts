/**
 * Filename: publishCreatorsToMongo.ts
 * Purpose: Upsert creators, append performance snapshots, and record import runs in MongoDB.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-27
 * Dependencies: mongodb, config, logger, gathererMongoClient, gathererMongoIndexBootstrap, gathererCreatorMongoMapper
 * Platform Compatibility: Node.js 18+
 */

import { AnyBulkWriteOperation } from "mongodb";
import { GathererConfig } from "../config";
import { CombinedCreatorRecord } from "../processing/mergeBackstageReports";
import { ImportSummaryData } from "../logging/importSummary";
import { logDebug, logError, logInfo } from "../logging/logger";
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

const GATHERER_PUBLISH_CREATORS_TO_MONGO_SOURCE = "publishCreatorsToMongo";

const GATHERER_MONGO_BULK_WRITE_CHUNK_SIZE = 250;

// MARK: Publish Result

export interface GathererMongoPublishResult {
  published: boolean;
  creatorsUpserted: number;
  creatorsSkipped: number;
  snapshotsInserted: number;
  importRunRecorded: boolean;
}

// MARK: Bulk Write Helpers

function gathererMongoPublishChunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

async function gathererMongoPublishUpsertCreators(
  creatorDocuments: GathererMongoCreatorDocument[]
): Promise<number> {
  const db = gathererGetMongoDb();
  const collection = db.collection<GathererMongoCreatorDocument>(GATHERER_MONGO_COLLECTION_CREATORS);
  let upsertedCount = 0;

  for (const chunk of gathererMongoPublishChunkArray(creatorDocuments, GATHERER_MONGO_BULK_WRITE_CHUNK_SIZE)) {
    const operations: AnyBulkWriteOperation<GathererMongoCreatorDocument>[] = chunk.map((document) => ({
      updateOne: {
        filter: { backstage_creator_id: document.backstage_creator_id },
        update: { $set: document },
        upsert: true,
      },
    }));

    const result = await collection.bulkWrite(operations, { ordered: false });
    upsertedCount += result.upsertedCount + result.modifiedCount + result.matchedCount;
  }

  return upsertedCount;
}

async function gathererMongoPublishInsertPerformanceSnapshots(
  snapshotDocuments: GathererMongoPerformanceSnapshotDocument[]
): Promise<number> {
  const db = gathererGetMongoDb();
  const collection = db.collection<GathererMongoPerformanceSnapshotDocument>(
    GATHERER_MONGO_COLLECTION_CREATOR_PERFORMANCE_SNAPSHOTS
  );

  let insertedCount = 0;

  for (const chunk of gathererMongoPublishChunkArray(snapshotDocuments, GATHERER_MONGO_BULK_WRITE_CHUNK_SIZE)) {
    try {
      const result = await collection.insertMany(chunk, { ordered: false });
      insertedCount += result.insertedCount;
    } catch (error) {
      const bulkError = error as { code?: number; writeErrors?: Array<{ code?: number }> };
      const duplicateOnly =
        bulkError.code === 11000 ||
        (bulkError.writeErrors?.length &&
          bulkError.writeErrors.every((writeError) => writeError.code === 11000));

      if (duplicateOnly) {
        const attempted = chunk.length - (bulkError.writeErrors?.length ?? 0);
        insertedCount += Math.max(0, attempted);
        logDebug(
          "Skipped duplicate performance snapshots for this import run",
          GATHERER_PUBLISH_CREATORS_TO_MONGO_SOURCE,
          { chunkSize: chunk.length }
        );
        continue;
      }

      throw error;
    }
  }

  return insertedCount;
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
  summary: ImportSummaryData
): Promise<GathererMongoPublishResult> {
  const mongoWrittenAt = new Date().toISOString();
  const emptyResult: GathererMongoPublishResult = {
    published: false,
    creatorsUpserted: 0,
    creatorsSkipped: creators.length,
    snapshotsInserted: 0,
    importRunRecorded: false,
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

    const snapshotDocument = gathererMongoMapperCreatorToPerformanceSnapshot(creator, mongoWrittenAt);
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
    const creatorsUpserted = await gathererMongoPublishUpsertCreators(creatorDocuments);
    const snapshotsInserted = await gathererMongoPublishInsertPerformanceSnapshots(snapshotDocuments);
    await gathererMongoPublishRecordImportRun(summary, true, mongoWrittenAt);

    logInfo(
      `MongoDB publish complete — ${creatorsUpserted} creators upserted, ${snapshotsInserted} snapshots inserted`,
      GATHERER_PUBLISH_CREATORS_TO_MONGO_SOURCE,
      {
        creatorsSkipped,
        database: config.mongodbDbName,
      }
    );

    return {
      published: true,
      creatorsUpserted,
      creatorsSkipped,
      snapshotsInserted,
      importRunRecorded: true,
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
// - Mark creators missing from latest run with stale flag instead of deleting
