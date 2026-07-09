/**
 * Filename: gathererSnapshotHistoryReviewSample.ts
 * Purpose: One-off review helper — sample creator_daily_snapshots in MongoDB for QA.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-07-09
 * Dependencies: config, gathererMongoClient
 * Platform Compatibility: Node.js 18+
 */

import { loadGathererConfig } from "../src/config";
import { gathererConnectMongo } from "../src/mongo/gathererMongoClient";
import { GATHERER_MONGO_COLLECTION_CREATOR_DAILY_SNAPSHOTS } from "../src/mongo/gathererMongoCollections";

// MARK: Main

async function gathererSnapshotHistoryReviewSampleMain(): Promise<void> {
  const config = loadGathererConfig();
  const db = await gathererConnectMongo(config);
  const collection = db.collection(GATHERER_MONGO_COLLECTION_CREATOR_DAILY_SNAPSHOTS);

  const totalDocuments = await collection.countDocuments();
  const byMonth = await collection
    .aggregate([{ $group: { _id: "$snapshotMonth", count: { $sum: 1 } } }, { $sort: { _id: 1 } }])
    .toArray();

  const sampleCreatorGroup = await collection
    .aggregate([
      { $match: { snapshotMonth: "2026-07", dataStatus: "complete", diamonds: { $type: "number" } } },
      {
        $group: {
          _id: "$creatorId",
          days: { $sum: 1 },
          tiktokUsername: { $first: "$tiktokUsername" },
        },
      },
      { $match: { days: { $gte: 5 } } },
      { $sort: { days: -1 } },
      { $limit: 1 },
    ])
    .toArray();

  const creatorId = sampleCreatorGroup[0]?._id ? String(sampleCreatorGroup[0]._id) : null;
  const snapshots = creatorId
    ? await collection
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
          tiktokUsername: 1,
        })
        .toArray()
    : [];

  console.log(
    JSON.stringify(
      {
        dbName: config.mongodbDbName,
        collection: GATHERER_MONGO_COLLECTION_CREATOR_DAILY_SNAPSHOTS,
        totalDocuments,
        byMonth,
        sampleCreator: {
          creatorId,
          username: sampleCreatorGroup[0]?.tiktokUsername ?? null,
          julySnapshotCount: snapshots.length,
          snapshots,
        },
      },
      null,
      2
    )
  );
}

gathererSnapshotHistoryReviewSampleMain().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// Suggestions For Features and Additions Later:
// - Remove after Priority 1 sign-off or fold into verify CLI
