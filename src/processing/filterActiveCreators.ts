/**
 * Filename: filterActiveCreators.ts
 * Purpose: Remove inactive creators (quit, expired, removed, or not on the management roster) from combined output.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-24
 * Dependencies: mergeBackstageReports (CombinedCreatorRecord)
 * Platform Compatibility: Node.js 18+
 */

import { logDebug, logInfo } from "../logging/logger";
import { CombinedCreatorRecord } from "./mergeBackstageReports";

// MARK: - Filter Options

export interface FilterActiveCreatorsOptions {
  /** Exclude performance-only rows that never matched Manage creators (default true). */
  requireManagementMatch?: boolean;
  /** When set, relationship_status must be Effective (default true). */
  requireEffectiveRelationship?: boolean;
  /** Case-insensitive graduation_status substrings that exclude a creator. */
  excludeGraduationStatusTerms?: string[];
}

export interface FilterActiveCreatorsExcludedEntry {
  creator: CombinedCreatorRecord;
  reason: string;
}

export interface FilterActiveCreatorsResult {
  activeCreators: CombinedCreatorRecord[];
  excludedCreators: FilterActiveCreatorsExcludedEntry[];
  excludedCount: number;
  excludedByReason: Record<string, number>;
}

// MARK: - Default Exclusion Terms

const FILTER_ACTIVE_CREATORS_DEFAULT_GRADUATION_EXCLUSIONS = [
  "quit",
  "removed",
  "expired",
];

// MARK: - Helpers

function filterActiveCreatorsNormalizeTerm(value: string): string {
  return value.trim().toLowerCase();
}

function filterActiveCreatorsGraduationExcluded(
  graduationStatus: string | null,
  excludeTerms: string[]
): boolean {
  if (!graduationStatus) {
    return false;
  }
  const normalized = filterActiveCreatorsNormalizeTerm(graduationStatus);
  return excludeTerms.some((term) => normalized.includes(term));
}

function filterActiveCreatorsRecordKey(creator: CombinedCreatorRecord): string {
  return (
    creator.backstage_creator_id ??
    creator.normalized_username ??
    creator.tiktok_username ??
    creator.import_run_id
  );
}

// MARK: - Filter Engine

/**
 * Keeps only creators that belong to the active management roster and are not quit/removed/expired.
 * Creator Data alone can include historical or inactive accounts; Manage creators is the roster source of truth.
 */
export function filterActiveCreatorsForOutput(
  creators: CombinedCreatorRecord[],
  options: FilterActiveCreatorsOptions = {}
): FilterActiveCreatorsResult {
  const requireManagementMatch = options.requireManagementMatch ?? true;
  const requireEffectiveRelationship = options.requireEffectiveRelationship ?? true;
  const excludeGraduationStatusTerms =
    options.excludeGraduationStatusTerms ??
    FILTER_ACTIVE_CREATORS_DEFAULT_GRADUATION_EXCLUSIONS;

  const activeCreators: CombinedCreatorRecord[] = [];
  const excludedCreators: FilterActiveCreatorsExcludedEntry[] = [];
  const excludedByReason: Record<string, number> = {};

  for (const creator of creators) {
    let excludeReason: string | null = null;

    if (requireManagementMatch && creator.match_method === "pending") {
      excludeReason = "not_in_management_roster";
    } else if (
      requireEffectiveRelationship &&
      creator.relationship_status &&
      filterActiveCreatorsNormalizeTerm(creator.relationship_status) !== "effective"
    ) {
      excludeReason = "inactive_relationship_status";
    } else if (
      filterActiveCreatorsGraduationExcluded(
        creator.graduation_status,
        excludeGraduationStatusTerms
      )
    ) {
      excludeReason = "excluded_graduation_status";
    }

    if (excludeReason) {
      excludedCreators.push({ creator, reason: excludeReason });
      excludedByReason[excludeReason] = (excludedByReason[excludeReason] ?? 0) + 1;
      logDebug(
        `Excluded creator ${filterActiveCreatorsRecordKey(creator)} (${excludeReason}, graduation=${creator.graduation_status ?? "—"})`,
        "filterActiveCreators"
      );
      continue;
    }

    activeCreators.push(creator);
  }

  if (excludedCreators.length > 0) {
    logInfo(
      `Filtered ${excludedCreators.length} inactive creators from output (${activeCreators.length} remain): ${JSON.stringify(excludedByReason)}`,
      "filterActiveCreators"
    );
  }

  return {
    activeCreators,
    excludedCreators,
    excludedCount: excludedCreators.length,
    excludedByReason,
  };
}

/**
 * Parses comma-separated exclusion terms from env (e.g. GATHERER_EXCLUDE_GRADUATION_STATUSES).
 */
export function parseFilterActiveCreatorsGraduationExclusionsFromEnv(
  rawValue: string | undefined
): string[] | undefined {
  if (!rawValue || !rawValue.trim()) {
    return undefined;
  }
  const terms = rawValue
    .split(",")
    .map((term) => filterActiveCreatorsNormalizeTerm(term))
    .filter(Boolean);
  return terms.length > 0 ? terms : undefined;
}

// Suggestions For Features and Additions Later:
// - Optional separate tab/sheet for excluded creators audit trail
// - Configurable allow-list for graduation statuses instead of block-list
