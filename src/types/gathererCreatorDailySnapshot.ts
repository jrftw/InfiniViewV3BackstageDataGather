/**
 * Filename: gathererCreatorDailySnapshot.ts
 * Purpose: Types for Priority 1 Daily Snapshot History Engine (creator_daily_snapshots).
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-07-09
 * Dependencies: none
 * Platform Compatibility: Node.js 18+
 */

// MARK: Data Status

export type GathererCreatorDailySnapshotDataStatus = "complete" | "missing_data" | "partial";

// MARK: Daily Snapshot Document

export interface GathererCreatorDailySnapshotDocument {
  creatorId: string;
  tiktokUsername: string;
  backstageCreatorId: string;
  snapshotDate: string;
  snapshotMonth: string;
  diamonds: number | null;
  liveHours: number | null;
  validLiveDay: boolean;
  liveDays: number;
  liveSessions: number | null;
  followers: number | null;
  region: string;
  currentDipTier: string | null;
  cumulativeDiamondsMonth: number | null;
  cumulativeLiveHoursMonth: number | null;
  cumulativeValidDaysMonth: number | null;
  sourceFileName: string;
  sourceSheet: string;
  sourceFileId: string;
  sourceDateFolder: string;
  importRunId: string;
  importedAt: string;
  rowChecksum: string | null;
  dataStatus: GathererCreatorDailySnapshotDataStatus;
  dataStatusNote: string | null;
  validLiveDayRule: "61_minutes";
  schemaVersion: number;
}

// MARK: Monthly Goals Document

export interface GathererCreatorMonthlyGoalsDocument {
  creatorId: string;
  month: string;
  dipTier: string | null;
  dipTierIndex: number | null;
  targetDiamonds: number;
  targetLiveHours: number;
  targetValidDays: number;
  source: "dip_tier_index" | "current_tier_label" | "unresolved";
  rulesVersionLabel: string | null;
  assignedAt: string;
  assignedBy: "snapshot_history_import";
  schemaVersion: number;
}

// MARK: Import Run Document

export interface GathererSnapshotImportRunDocument {
  importRunId: string;
  startedAt: string;
  finishedAt: string;
  trigger: "scheduled" | "backfill" | "manual";
  filesScanned: number;
  filesImported: number;
  snapshotsUpserted: number;
  snapshotsSkipped: number;
  errors: Array<{ fileName: string; date: string; message: string }>;
  success: boolean;
}

// MARK: Cumulative Row (sheet / prior day)

export interface GathererSnapshotCumulativeMetrics {
  diamonds: number | null;
  liveHours: number | null;
  validDays: number | null;
}

// MARK: Verification

export interface GathererSnapshotMonthVerificationRow {
  creatorId: string;
  tiktokUsername: string;
  month: string;
  sumDailyDiamonds: number;
  sumDailyLiveHours: number;
  sumValidLiveDays: number;
  latestCumulativeDiamonds: number | null;
  latestCumulativeLiveHours: number | null;
  latestCumulativeValidDays: number | null;
  latestSnapshotDate: string | null;
  diamondsMatch: boolean;
  liveHoursMatch: boolean;
  validDaysMatch: boolean;
  snapshotDayCount: number;
}

export interface GathererSnapshotMonthVerificationReport {
  month: string;
  verifiedAt: string;
  creatorsChecked: number;
  creatorsMatched: number;
  creatorsMismatched: number;
  rows: GathererSnapshotMonthVerificationRow[];
}

// Suggestions For Features and Additions Later:
// - Per-creator verification tolerance config for rounding drift
// - Historical schemaVersion migration helpers
