/**
 * Filename: gathererSnapshotHistoryReviewCreatorTrace.ts
 * Purpose: Trace one creator's July snapshots for QA review.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-07-09
 * Dependencies: config, gathererMongoClient
 * Platform Compatibility: Node.js 18+
 */

import { loadGathererConfig } from "../src/config";
import { gathererConnectMongo } from "../src/mongo/gathererMongoClient";
import { GATHERER_MONGO_COLLECTION_CREATOR_DAILY_SNAPSHOTS } from "../src/mongo/gathererMongoCollections";

// MARK: Main

async function gathererSnapshotHistoryReviewCreatorTraceMain(): Promise<void> {
  const creatorId = process.argv[2] ?? "7359134441639346182";
  const config = loadGathererConfig();
  const db = await gathererConnectMongo(config);
  const collection = db.collection(GATHERER_MONGO_COLLECTION_CREATOR_DAILY_SNAPSHOTS);

  const docs = await collection
    .find({ creatorId, snapshotMonth: "2026-07" })
    .sort({ snapshotDate: 1 })
    .project({
      snapshotDate: 1,
      diamonds: 1,
      cumulativeDiamondsMonth: 1,
      liveHours: 1,
      cumulativeLiveHoursMonth: 1,
      validLiveDay: 1,
      cumulativeValidDaysMonth: 1,
      dataStatus: 1,
      dataStatusNote: 1,
      tiktokUsername: 1,
    })
    .toArray();

  const dayCoverage = await collection.aggregate([
    { $match: { snapshotMonth: "2026-07" } },
    { $group: { _id: "$snapshotDate", creators: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]).toArray();

  console.log(
    JSON.stringify(
      {
        creatorId,
        julySnapshots: docs,
        julyCreatorsPerDay: dayCoverage,
      },
      null,
      2
    )
  );
}

gathererSnapshotHistoryReviewCreatorTraceMain().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// Suggestions For Features and Additions Later:
// - Remove after Priority 1 sign-off
