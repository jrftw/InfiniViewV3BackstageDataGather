/**
 * Filename: gathererSnapshotMonthlyGoalsService.ts
 * Purpose: Upsert creator_monthly_goals from D.I.P. tier fields on imported creator rows.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-07-09
 * Dependencies: mongodb, gathererCreatorDailySnapshot types, gathererSnapshotMonthlyGoalsCatalog
 * Platform Compatibility: Node.js 18+
 */

import { GathererConfig, gathererIsMongoConfigured } from "../config";
import { CombinedCreatorRecord } from "../processing/mergeBackstageReports";
import { gathererConnectMongo } from "../mongo/gathererMongoClient";
import { GATHERER_MONGO_COLLECTION_CREATOR_MONTHLY_GOALS } from "../mongo/gathererMongoCollections";
import { GathererCreatorMonthlyGoalsDocument } from "../types/gathererCreatorDailySnapshot";
import {
  gathererSnapshotMonthlyGoalsResolveTierByIndex,
  gathererSnapshotMonthlyGoalsResolveTierByLabel,
} from "./gathererSnapshotMonthlyGoalsCatalog";
import { logDebug } from "../logging/logger";

const GATHERER_SNAPSHOT_MONTHLY_GOALS_SERVICE_SOURCE = "gathererSnapshotMonthlyGoalsService";

// MARK: Resolve Creator ID

function gathererSnapshotMonthlyGoalsResolveCreatorId(creator: CombinedCreatorRecord): string | null {
  const backstageId = String(creator.backstage_creator_id ?? "").trim();
  if (backstageId) {
    return backstageId;
  }
  const username = String(creator.normalized_username ?? creator.tiktok_username ?? "").trim();
  return username || null;
}

function gathererSnapshotMonthlyGoalsParseTierIndex(creator: CombinedCreatorRecord): number | null {
  if (typeof creator.current_tier_index === "number" && Number.isFinite(creator.current_tier_index)) {
    return Math.round(creator.current_tier_index);
  }

  if (typeof creator.current_tier_index === "string" && creator.current_tier_index.trim()) {
    const parsed = Number.parseInt(creator.current_tier_index.trim(), 10);
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 12) {
      return parsed;
    }
  }

  const tierFromLabel = gathererSnapshotMonthlyGoalsResolveTierByLabel(creator.current_tier);
  return tierFromLabel?.tierIndex ?? null;
}

function gathererSnapshotMonthlyGoalsBuildDocument(
  creator: CombinedCreatorRecord,
  month: string,
  assignedAt: string
): GathererCreatorMonthlyGoalsDocument | null {
  const creatorId = gathererSnapshotMonthlyGoalsResolveCreatorId(creator);
  if (!creatorId) {
    return null;
  }

  const tierIndex = gathererSnapshotMonthlyGoalsParseTierIndex(creator);
  const tierFromIndex = gathererSnapshotMonthlyGoalsResolveTierByIndex(tierIndex);
  const tierFromLabel = gathererSnapshotMonthlyGoalsResolveTierByLabel(creator.current_tier);
  const tierRow = tierFromIndex ?? tierFromLabel;
  const resolvedTierIndex = tierRow?.tierIndex ?? tierIndex;

  if (!tierRow) {
    return {
      creatorId,
      month,
      dipTier: creator.current_tier ?? null,
      dipTierIndex: resolvedTierIndex,
      targetDiamonds: 0,
      targetLiveHours: 0,
      targetValidDays: 0,
      source: "unresolved",
      rulesVersionLabel: "2026-07-01",
      assignedAt,
      assignedBy: "snapshot_history_import",
      schemaVersion: 1,
    };
  }

  const source: GathererCreatorMonthlyGoalsDocument["source"] =
    typeof creator.current_tier_index === "number" ||
    (typeof creator.current_tier_index === "string" && creator.current_tier_index.trim())
      ? "dip_tier_index"
      : "current_tier_label";

  return {
    creatorId,
    month,
    dipTier: tierRow.tierLabel,
    dipTierIndex: tierRow.tierIndex,
    targetDiamonds: tierRow.targetDiamonds,
    targetLiveHours: tierRow.targetLiveHours,
    targetValidDays: tierRow.targetValidDays,
    source,
    rulesVersionLabel: "2026-07-01",
    assignedAt,
    assignedBy: "snapshot_history_import",
    schemaVersion: 1,
  };
}

// MARK: Upsert API

export async function gathererSnapshotMonthlyGoalsUpsertFromCreators(
  config: GathererConfig,
  creators: CombinedCreatorRecord[],
  month: string,
  assignedAt: string
): Promise<number> {
  if (!gathererIsMongoConfigured(config)) {
    return 0;
  }

  const db = await gathererConnectMongo(config);
  const collection = db.collection<GathererCreatorMonthlyGoalsDocument>(
    GATHERER_MONGO_COLLECTION_CREATOR_MONTHLY_GOALS
  );

  let upserted = 0;

  for (const creator of creators) {
    const document = gathererSnapshotMonthlyGoalsBuildDocument(creator, month, assignedAt);
    if (!document) {
      continue;
    }

    await collection.updateOne(
      { creatorId: document.creatorId, month: document.month },
      { $set: document },
      { upsert: true }
    );
    upserted += 1;
  }

  logDebug(`Upserted ${upserted} creator_monthly_goals rows for ${month}`, GATHERER_SNAPSHOT_MONTHLY_GOALS_SERVICE_SOURCE);

  return upserted;
}

// Suggestions For Features and Additions Later:
// - Manager override rows that never auto-downgrade mid-month
