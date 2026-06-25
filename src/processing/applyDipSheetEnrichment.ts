/**
 * Filename: applyDipSheetEnrichment.ts
 * Purpose: Merge Diamond Incentive Program (DIP) sheet fields into combined creators.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-24
 * Dependencies: mergeBackstageReports, externalSheetCreatorMatch
 * Platform Compatibility: Node.js 18+
 */

import { CombinedCreatorRecord } from "./mergeBackstageReports";
import {
  externalSheetCreatorFindMatchingRow,
  externalSheetCreatorMatchRowCreatorId,
  externalSheetCreatorMatchRowUsername,
  externalSheetCreatorRowMatchesCreator,
} from "./externalSheetCreatorMatch";
import { logDebug, logWarn } from "../logging/logger";

// MARK: - DIP Row Type

export interface DipSheetEnrichmentRow {
  backstage_creator_id: string | null;
  tiktok_username: string | null;
  prior_month_diamonds: string | null;
  prior_month_valid_days: string | null;
  prior_month_hours: string | null;
  last_month_tier_index: string | null;
  current_tier_index: string | null;
  tier_rank_status: string | null;
  current_tier: string | null;
  streamer_diamond_bonus: string | null;
  maintained_bonus_eligible_80pct: string | null;
  progress_to_next_tier: string | null;
}

export interface ApplyDipSheetEnrichmentResult {
  creators: CombinedCreatorRecord[];
  appliedCount: number;
  skippedMismatchCount: number;
}

// MARK: - Merge Fields

function applyDipSheetEnrichmentMergeFields(
  creator: CombinedCreatorRecord,
  row: DipSheetEnrichmentRow
): CombinedCreatorRecord {
  return {
    ...creator,
    prior_month_diamonds: row.prior_month_diamonds ?? creator.prior_month_diamonds,
    prior_month_valid_days: row.prior_month_valid_days ?? creator.prior_month_valid_days,
    prior_month_hours: row.prior_month_hours ?? creator.prior_month_hours,
    last_month_tier_index: row.last_month_tier_index ?? creator.last_month_tier_index,
    current_tier_index: row.current_tier_index ?? creator.current_tier_index,
    tier_rank_status: row.tier_rank_status ?? creator.tier_rank_status,
    current_tier: row.current_tier ?? creator.current_tier,
    streamer_diamond_bonus: row.streamer_diamond_bonus ?? creator.streamer_diamond_bonus,
    maintained_bonus_eligible_80pct:
      row.maintained_bonus_eligible_80pct ?? creator.maintained_bonus_eligible_80pct,
    progress_to_next_tier: row.progress_to_next_tier ?? creator.progress_to_next_tier,
  };
}

// MARK: - Apply Engine

export function applyDipSheetEnrichmentToCreators(
  creators: CombinedCreatorRecord[],
  dipRows: DipSheetEnrichmentRow[]
): ApplyDipSheetEnrichmentResult {
  const byCreatorId = new Map<string, DipSheetEnrichmentRow>();
  const byUsername = new Map<string, DipSheetEnrichmentRow>();

  for (const row of dipRows) {
    const cid = externalSheetCreatorMatchRowCreatorId(row);
    const username = externalSheetCreatorMatchRowUsername(row);

    if (cid) {
      byCreatorId.set(cid, row);
    }
    if (username) {
      byUsername.set(username, row);
    }
  }

  let appliedCount = 0;
  let skippedMismatchCount = 0;

  const enriched = creators.map((creator) => {
    const candidate = externalSheetCreatorFindMatchingRow(creator, byCreatorId, byUsername);

    if (!candidate) {
      return creator;
    }

    if (!externalSheetCreatorRowMatchesCreator(candidate, creator)) {
      skippedMismatchCount++;
      logWarn(
        `DIP row skipped — cid/userId mismatch for creator ${creator.backstage_creator_id ?? candidate.tiktok_username ?? "unknown"} (DIP userId=${candidate.tiktok_username ?? "—"}, cid=${candidate.backstage_creator_id ?? "—"})`,
        "applyDipSheetEnrichment"
      );
      return creator;
    }

    appliedCount++;
    logDebug(
      `DIP enrichment applied to ${creator.backstage_creator_id ?? candidate.tiktok_username}`,
      "applyDipSheetEnrichment"
    );

    return applyDipSheetEnrichmentMergeFields(creator, candidate);
  });

  return { creators: enriched, appliedCount, skippedMismatchCount };
}

// Suggestions For Features and Additions Later:
// - Map tier_rank_status to a normalized enum for reporting
