/**
 * Filename: gathererSnapshotMonthlyGoalsRepair.ts
 * Purpose: Repair unresolved creator_monthly_goals rows from sheet tier codes (NM_2, RU_9, etc.).
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-07-09
 * Platform Compatibility: Node.js 18+
 */

import { loadGathererConfig } from "../src/config";
import { gathererConnectMongo } from "../src/mongo/gathererMongoClient";
import { GATHERER_MONGO_COLLECTION_CREATOR_MONTHLY_GOALS } from "../src/mongo/gathererMongoCollections";
import { GathererCreatorMonthlyGoalsDocument } from "../src/types/gathererCreatorDailySnapshot";
import {
  gathererSnapshotMonthlyGoalsResolveTierByIndex,
  gathererSnapshotMonthlyGoalsResolveTierByLabel,
} from "../src/snapshotHistory/gathererSnapshotMonthlyGoalsCatalog";
import { logInfo } from "../src/logging/logger";

const GATHERER_SNAPSHOT_MONTHLY_GOALS_REPAIR_SOURCE = "gathererSnapshotMonthlyGoalsRepair";

// MARK: Repair Logic

function gathererSnapshotMonthlyGoalsRepairBuildResolvedDocument(
  existing: GathererCreatorMonthlyGoalsDocument,
  assignedAt: string
): GathererCreatorMonthlyGoalsDocument | null {
  const tierFromIndex = gathererSnapshotMonthlyGoalsResolveTierByIndex(existing.dipTierIndex);
  const tierFromStoredLabel = gathererSnapshotMonthlyGoalsResolveTierByLabel(existing.dipTier);
  const tierRow = tierFromIndex ?? tierFromStoredLabel;

  if (!tierRow) {
    return null;
  }

  return {
    ...existing,
    dipTier: tierRow.tierLabel,
    dipTierIndex: tierRow.tierIndex,
    targetDiamonds: tierRow.targetDiamonds,
    targetLiveHours: tierRow.targetLiveHours,
    targetValidDays: tierRow.targetValidDays,
    source: tierFromIndex ? "dip_tier_index" : "current_tier_label",
    assignedAt,
    assignedBy: "snapshot_history_import",
  };
}

// MARK: Main

async function gathererSnapshotMonthlyGoalsRepairMain(): Promise<void> {
  const month = process.argv[2] ?? "2026-07";
  const config = loadGathererConfig();
  const db = await gathererConnectMongo(config);
  const collection = db.collection<GathererCreatorMonthlyGoalsDocument>(
    GATHERER_MONGO_COLLECTION_CREATOR_MONTHLY_GOALS
  );

  const assignedAt = new Date().toISOString();
  const candidates = await collection
    .find({
      month,
      $or: [{ source: "unresolved" }, { targetDiamonds: 0 }],
    })
    .toArray();

  let repaired = 0;
  let skipped = 0;

  for (const existing of candidates) {
    const resolved = gathererSnapshotMonthlyGoalsRepairBuildResolvedDocument(existing, assignedAt);
    if (!resolved) {
      skipped += 1;
      continue;
    }

    await collection.updateOne(
      { creatorId: resolved.creatorId, month: resolved.month },
      { $set: resolved },
      { upsert: true }
    );
    repaired += 1;
  }

  logInfo(
    `Repaired ${repaired} creator_monthly_goals rows for ${month} (skipped ${skipped})`,
    GATHERER_SNAPSHOT_MONTHLY_GOALS_REPAIR_SOURCE
  );
}

gathererSnapshotMonthlyGoalsRepairMain().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// Suggestions For Features and Additions Later:
// - Pull latest master creator row per creator when dipTier is empty
