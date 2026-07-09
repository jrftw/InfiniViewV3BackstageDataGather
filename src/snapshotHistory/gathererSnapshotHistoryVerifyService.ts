/**
 * Filename: gathererSnapshotHistoryVerifyService.ts
 * Purpose: Verify month totals equal sum of daily snapshot contributions (Priority 1 QA gate).
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-07-09
 * Dependencies: mongodb, gathererSnapshotDeltaEngine
 * Platform Compatibility: Node.js 18+
 */

import { GathererConfig, gathererIsMongoConfigured } from "../config";
import { gathererConnectMongo } from "../mongo/gathererMongoClient";
import { GATHERER_MONGO_COLLECTION_CREATOR_DAILY_SNAPSHOTS } from "../mongo/gathererMongoCollections";
import {
  GathererCreatorDailySnapshotDocument,
  GathererSnapshotMonthVerificationReport,
  GathererSnapshotMonthVerificationRow,
} from "../types/gathererCreatorDailySnapshot";
import {
  gathererSnapshotDeltaEngineNumbersMatch,
  GATHERER_SNAPSHOT_VERIFICATION_TOLERANCE,
} from "./gathererSnapshotDeltaEngine";
import { logInfo, logWarn } from "../logging/logger";

const GATHERER_SNAPSHOT_HISTORY_VERIFY_SERVICE_SOURCE = "gathererSnapshotHistoryVerifyService";

// MARK: Verify Month

export async function gathererSnapshotHistoryListImportedDatesForMonth(
  config: GathererConfig,
  month: string
): Promise<string[]> {
  const db = await gathererConnectMongo(config);
  const collection = db.collection<GathererCreatorDailySnapshotDocument>(
    GATHERER_MONGO_COLLECTION_CREATOR_DAILY_SNAPSHOTS
  );

  const dates = await collection.distinct("snapshotDate", { snapshotMonth: month });
  return (dates as string[]).sort();
}

export async function gathererSnapshotHistoryVerifyMonthTotals(
  config: GathererConfig,
  month: string,
  creatorIdFilter?: string
): Promise<GathererSnapshotMonthVerificationReport> {
  if (!gathererIsMongoConfigured(config)) {
    throw new Error("MongoDB is not configured");
  }

  const db = await gathererConnectMongo(config);
  const collection = db.collection<GathererCreatorDailySnapshotDocument>(
    GATHERER_MONGO_COLLECTION_CREATOR_DAILY_SNAPSHOTS
  );

  const matchStage: Record<string, unknown> = { snapshotMonth: month };
  if (creatorIdFilter) {
    matchStage.creatorId = creatorIdFilter;
  }

  const pipeline = [
    { $match: matchStage },
    { $match: { dataStatus: { $ne: "missing_data" } } },
    {
      $group: {
        _id: "$creatorId",
        tiktokUsername: { $last: "$tiktokUsername" },
        sumDailyDiamonds: {
          $sum: {
            $cond: [{ $ifNull: ["$diamonds", false] }, "$diamonds", 0],
          },
        },
        sumDailyLiveHours: {
          $sum: {
            $cond: [{ $ifNull: ["$liveHours", false] }, "$liveHours", 0],
          },
        },
        sumValidLiveDays: {
          $sum: {
            $cond: ["$validLiveDay", 1, 0],
          },
        },
        latestSnapshotDate: { $max: "$snapshotDate" },
        snapshotDayCount: { $sum: 1 },
      },
    },
  ];

  const grouped = await collection.aggregate(pipeline).toArray();

  const rows: GathererSnapshotMonthVerificationRow[] = [];

  for (const group of grouped) {
    const creatorId = String(group._id);
    const latestSnapshotDate = group.latestSnapshotDate ? String(group.latestSnapshotDate) : null;

    let latestCumulativeDiamonds: number | null = null;
    let latestCumulativeLiveHours: number | null = null;
    let latestCumulativeValidDays: number | null = null;

    if (latestSnapshotDate) {
      const latestDoc = await collection.findOne({
        creatorId,
        snapshotDate: latestSnapshotDate,
      });
      latestCumulativeDiamonds = latestDoc?.cumulativeDiamondsMonth ?? null;
      latestCumulativeLiveHours = latestDoc?.cumulativeLiveHoursMonth ?? null;
      latestCumulativeValidDays = latestDoc?.cumulativeValidDaysMonth ?? null;
    }

    const sumDailyDiamonds = Number(group.sumDailyDiamonds ?? 0);
    const sumDailyLiveHours = Number(group.sumDailyLiveHours ?? 0);
    const sumValidLiveDays = Number(group.sumValidLiveDays ?? 0);

    const diamondsMatch = gathererSnapshotDeltaEngineNumbersMatch(
      sumDailyDiamonds,
      latestCumulativeDiamonds,
      GATHERER_SNAPSHOT_VERIFICATION_TOLERANCE
    );
    const liveHoursMatch = gathererSnapshotDeltaEngineNumbersMatch(
      sumDailyLiveHours,
      latestCumulativeLiveHours,
      GATHERER_SNAPSHOT_VERIFICATION_TOLERANCE
    );
    const validDaysMatch = gathererSnapshotDeltaEngineNumbersMatch(
      sumValidLiveDays,
      latestCumulativeValidDays,
      0.01
    );

    rows.push({
      creatorId,
      tiktokUsername: String(group.tiktokUsername ?? ""),
      month,
      sumDailyDiamonds,
      sumDailyLiveHours,
      sumValidLiveDays,
      latestCumulativeDiamonds,
      latestCumulativeLiveHours,
      latestCumulativeValidDays,
      latestSnapshotDate,
      diamondsMatch,
      liveHoursMatch,
      validDaysMatch,
      snapshotDayCount: Number(group.snapshotDayCount ?? 0),
    });
  }

  rows.sort((left, right) => left.creatorId.localeCompare(right.creatorId));

  const creatorsMatched = rows.filter(
    (row) => row.diamondsMatch && row.liveHoursMatch && row.validDaysMatch
  ).length;
  const creatorsMismatched = rows.length - creatorsMatched;

  const importedDates = await gathererSnapshotHistoryListImportedDatesForMonth(config, month);

  const report: GathererSnapshotMonthVerificationReport = {
    month,
    verifiedAt: new Date().toISOString(),
    creatorsChecked: rows.length,
    creatorsMatched,
    creatorsMismatched,
    rows,
  };

  if (creatorsMismatched > 0) {
    logWarn(
      `Snapshot verification: ${creatorsMismatched}/${rows.length} creators mismatched for ${month}`,
      GATHERER_SNAPSHOT_HISTORY_VERIFY_SERVICE_SOURCE,
      { importedDates, importedDayCount: importedDates.length }
    );
  } else {
    logInfo(
      `Snapshot verification passed for ${month} — ${creatorsMatched} creators matched`,
      GATHERER_SNAPSHOT_HISTORY_VERIFY_SERVICE_SOURCE
    );
  }

  return report;
}

// Suggestions For Features and Additions Later:
// - Export verification CSV for manager review
