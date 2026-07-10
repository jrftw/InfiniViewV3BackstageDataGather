/**
 * Filename: gathererInspectCreatorSnapshots.ts
 * Purpose: Debug helper — print daily snapshot diamonds for a creator/month.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-07-10
 * Dependencies: config, gathererMongoClient
 * Platform Compatibility: Node.js 18+
 */

import { loadGathererConfig } from "../src/config";
import { gathererConnectMongo } from "../src/mongo/gathererMongoClient";

// MARK: CLI

async function gathererInspectCreatorSnapshotsMain(): Promise<void> {
  const usernameQuery = process.argv[2]?.trim() ?? "queen";
  const month = process.argv[3]?.trim() ?? "2026-07";

  const config = loadGathererConfig();
  const db = await gathererConnectMongo(config);
  const collection = db.collection("creator_daily_snapshots");

  const rows = await collection
    .find({
      snapshotMonth: month,
      tiktokUsername: { $regex: usernameQuery, $options: "i" },
    })
    .sort({ snapshotDate: 1 })
    .toArray();

  console.log(
    JSON.stringify(
      rows.map((row) => ({
        date: row.snapshotDate,
        username: row.tiktokUsername,
        creatorId: row.creatorId,
        diamonds: row.diamonds,
        cumulativeDiamondsMonth: row.cumulativeDiamondsMonth,
        liveHours: row.liveHours,
        dataStatus: row.dataStatus,
        dataStatusNote: row.dataStatusNote,
      })),
      null,
      2
    )
  );
}

gathererInspectCreatorSnapshotsMain().catch((error) => {
  console.error(error);
  process.exit(1);
});

// Suggestions For Features and Additions Later:
// - Accept --creator-id for exact match
// - Print chart points from infiniviewSnapshotMathEngine for parity checks
