/**
 * Filename: gathererSnapshotMonthlyGoalsCatalog.ts
 * Purpose: D.I.P. tier requirement catalog for creator_monthly_goals resolution.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-07-09
 * Platform Compatibility: Node.js 18+
 */

// MARK: Tier Requirement Row

export interface GathererSnapshotMonthlyGoalsTierRow {
  tierIndex: number;
  tierLabel: string;
  targetDiamonds: number;
  targetLiveHours: number;
  targetValidDays: number;
}

/** Mirrors InfiniView infiniviewTierRulesCatalog shared requirements (July 2026). */
export const GATHERER_SNAPSHOT_MONTHLY_GOALS_TIER_ROWS: readonly GathererSnapshotMonthlyGoalsTierRow[] = [
  { tierIndex: 1, tierLabel: "Tier 1", targetDiamonds: 0, targetLiveHours: 0, targetValidDays: 0 },
  { tierIndex: 2, tierLabel: "Tier 2", targetDiamonds: 100, targetLiveHours: 20, targetValidDays: 8 },
  { tierIndex: 3, tierLabel: "Tier 3", targetDiamonds: 100_000, targetLiveHours: 35, targetValidDays: 12 },
  { tierIndex: 4, tierLabel: "Tier 4", targetDiamonds: 200_000, targetLiveHours: 50, targetValidDays: 15 },
  { tierIndex: 5, tierLabel: "Graduate 5", targetDiamonds: 300_000, targetLiveHours: 70, targetValidDays: 18 },
  { tierIndex: 6, tierLabel: "Graduate 6", targetDiamonds: 500_000, targetLiveHours: 90, targetValidDays: 22 },
  { tierIndex: 7, tierLabel: "Tier 7", targetDiamonds: 1_000_000, targetLiveHours: 95, targetValidDays: 22 },
  { tierIndex: 8, tierLabel: "Tier 8", targetDiamonds: 1_600_000, targetLiveHours: 100, targetValidDays: 25 },
  { tierIndex: 9, tierLabel: "Tier 9", targetDiamonds: 3_000_000, targetLiveHours: 125, targetValidDays: 27 },
  { tierIndex: 10, tierLabel: "Tier 10", targetDiamonds: 5_000_000, targetLiveHours: 150, targetValidDays: 28 },
  { tierIndex: 11, tierLabel: "Tier 11", targetDiamonds: 10_000_000, targetLiveHours: 150, targetValidDays: 28 },
  { tierIndex: 12, tierLabel: "Tier 12", targetDiamonds: 20_000_000, targetLiveHours: 150, targetValidDays: 28 },
];

export function gathererSnapshotMonthlyGoalsResolveTierByIndex(
  tierIndex: number | null | undefined
): GathererSnapshotMonthlyGoalsTierRow | null {
  if (tierIndex === null || tierIndex === undefined || !Number.isFinite(tierIndex)) {
    return null;
  }
  return (
    GATHERER_SNAPSHOT_MONTHLY_GOALS_TIER_ROWS.find((row) => row.tierIndex === tierIndex) ?? null
  );
}

export function gathererSnapshotMonthlyGoalsResolveTierByLabel(
  tierLabel: string | null | undefined
): GathererSnapshotMonthlyGoalsTierRow | null {
  const normalized = String(tierLabel ?? "")
    .trim()
    .toLowerCase();
  if (!normalized) {
    return null;
  }

  const byExact = GATHERER_SNAPSHOT_MONTHLY_GOALS_TIER_ROWS.find(
    (row) => row.tierLabel.toLowerCase() === normalized
  );
  if (byExact) {
    return byExact;
  }

  const graduateMatch = normalized.match(/graduate\s*(\d+)/);
  if (graduateMatch) {
    return gathererSnapshotMonthlyGoalsResolveTierByIndex(Number.parseInt(graduateMatch[1], 10));
  }

  const tierMatch = normalized.match(/tier\s*(\d+)/);
  if (tierMatch) {
    return gathererSnapshotMonthlyGoalsResolveTierByIndex(Number.parseInt(tierMatch[1], 10));
  }

  const sheetCodeMatch = normalized.toUpperCase().match(/^(?:RU|R_U|NM|N_M|M)[_\s-]?(\d{1,2})$/);
  if (sheetCodeMatch) {
    return gathererSnapshotMonthlyGoalsResolveTierByIndex(Number.parseInt(sheetCodeMatch[1], 10));
  }

  return null;
}

// Suggestions For Features and Additions Later:
// - Import tier catalog from shared npm package with InfiniView API
