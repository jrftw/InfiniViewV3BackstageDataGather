/**
 * Filename: applyCrmSheetEnrichment.ts
 * Purpose: Merge external CRM sheet fields into combined creators (cid + userId confirmation).
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-24
 * Dependencies: mergeBackstageReports, externalSheetCreatorMatch, crmEnrichmentFields
 * Platform Compatibility: Node.js 18+
 */

import { CombinedCreatorRecord } from "./mergeBackstageReports";
import {
  externalSheetCreatorFindMatchingRow,
  externalSheetCreatorMatchRowCreatorId,
  externalSheetCreatorMatchRowUsername,
  externalSheetCreatorRowMatchesCreator,
} from "./externalSheetCreatorMatch";
import {
  CrmSheetEnrichmentRow,
  crmEnrichmentMergeRowIntoCreator,
} from "./crmEnrichmentFields";
import { logDebug, logWarn } from "../logging/logger";

export type { CrmSheetEnrichmentRow };

export interface ApplyCrmSheetEnrichmentResult {
  creators: CombinedCreatorRecord[];
  appliedCount: number;
  skippedMismatchCount: number;
}

// MARK: - Apply Engine

export function applyCrmSheetEnrichmentToCreators(
  creators: CombinedCreatorRecord[],
  crmRows: CrmSheetEnrichmentRow[]
): ApplyCrmSheetEnrichmentResult {
  const byCreatorId = new Map<string, CrmSheetEnrichmentRow>();
  const byUsername = new Map<string, CrmSheetEnrichmentRow>();

  for (const row of crmRows) {
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
        `CRM row skipped — cid/userId mismatch for creator ${creator.backstage_creator_id ?? candidate.tiktok_username ?? "unknown"} (CRM userId=${candidate.tiktok_username ?? "—"}, cid=${candidate.backstage_creator_id ?? "—"})`,
        "applyCrmSheetEnrichment"
      );
      return creator;
    }

    appliedCount++;
    logDebug(
      `CRM enrichment applied to ${creator.backstage_creator_id ?? candidate.tiktok_username}`,
      "applyCrmSheetEnrichment"
    );

    return crmEnrichmentMergeRowIntoCreator(creator, candidate);
  });

  return { creators: enriched, appliedCount, skippedMismatchCount };
}

// Suggestions For Features and Additions Later:
// - Write skipped mismatches to 05_Export_Errors tab for manual review
