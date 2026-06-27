/**
 * Filename: gathererCreatorMongoMapper.ts
 * Purpose: Map CombinedCreatorRecord rows to MongoDB creator and snapshot documents.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-27
 * Dependencies: mergeBackstageReports, importSummary
 * Platform Compatibility: Node.js 18+
 */

import { CombinedCreatorRecord } from "../processing/mergeBackstageReports";
import { ImportSummaryData } from "../logging/importSummary";

// MARK: Document Types

export type GathererMongoScalarValue = string | number | boolean | null;

export interface GathererMongoCreatorDocument {
  backstage_creator_id: string;
  [field: string]: GathererMongoScalarValue | string[];
}

export interface GathererMongoPerformanceSnapshotDocument {
  backstage_creator_id: string;
  import_run_id: string;
  imported_at: string;
  row_checksum: string | null;
  performance_data_period: string | null;
  total_diamonds: number | null;
  diamonds_l30d: number | null;
  dollars: number | null;
  live_duration_total_hours: number | null;
  valid_live_days_total: number | null;
  live_duration_l30d_hours: number | null;
  valid_live_days_l30d: number | null;
  followers: number | null;
  videos: number | null;
  likes: number | null;
  new_followers: number | null;
  live_streams: number | null;
  tier_status: string | null;
  tier_last_month: string | null;
  current_tier: string | null;
  progress_to_next_tier: string | null;
  matches: number | null;
  diamonds_from_matches: number | null;
  fan_club_total_diamonds: number | null;
  diamonds_from_fan_club_l30d: number | null;
  fan_contribution_percent: number | null;
  active_fans_from_fan_club: number | null;
  active_fans_from_fan_club_l30d: number | null;
  total_fans: number | null;
  new_fans: number | null;
  diamonds_from_multi_guest: number | null;
  diamonds_from_multi_guest_host: number | null;
  diamonds_from_multi_guest_guest: number | null;
  gatherer_mongo_snapshot_written_at: string;
}

export interface GathererMongoImportRunDocument {
  run_id: string;
  started_at: string;
  finished_at: string;
  success: boolean;
  performance_row_count: number;
  management_row_count: number;
  combined_creator_count: number;
  excluded_creator_count: number | null;
  unmatched_performance_count: number;
  unmatched_management_count: number;
  enrichment_applied_count: number;
  drive_uploaded: boolean;
  sheets_updated: boolean;
  mongo_published: boolean;
  run_trigger: string | null;
  scheduled_slot_index: number | null;
  scheduled_slot_total: number | null;
  is_daily_final_run: boolean | null;
  daily_date_key: string | null;
  daily_sheet_tab_name: string | null;
  errors: string[];
  gatherer_mongo_written_at: string;
}

// MARK: Performance Snapshot Fields

const GATHERER_MONGO_PERFORMANCE_SNAPSHOT_FIELDS = [
  "performance_data_period",
  "total_diamonds",
  "diamonds_l30d",
  "dollars",
  "live_duration_total_hours",
  "valid_live_days_total",
  "live_duration_l30d_hours",
  "valid_live_days_l30d",
  "followers",
  "videos",
  "likes",
  "new_followers",
  "live_streams",
  "tier_status",
  "tier_last_month",
  "current_tier",
  "progress_to_next_tier",
  "matches",
  "diamonds_from_matches",
  "fan_club_total_diamonds",
  "diamonds_from_fan_club_l30d",
  "fan_contribution_percent",
  "active_fans_from_fan_club",
  "active_fans_from_fan_club_l30d",
  "total_fans",
  "new_fans",
  "diamonds_from_multi_guest",
  "diamonds_from_multi_guest_host",
  "diamonds_from_multi_guest_guest",
] as const;

// MARK: Mapping Helpers

function gathererMongoMapperNormalizeScalar(value: unknown): GathererMongoScalarValue | string[] {
  if (value === null || value === undefined) {
    return null;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry));
  }
  if (typeof value === "boolean" || typeof value === "number") {
    return value;
  }
  return String(value);
}

function gathererMongoMapperReadNumberField(
  creator: CombinedCreatorRecord,
  field: (typeof GATHERER_MONGO_PERFORMANCE_SNAPSHOT_FIELDS)[number]
): number | null {
  const value = creator[field];
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "number") {
    return value;
  }
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isNaN(parsed) ? null : parsed;
}

function gathererMongoMapperReadStringField(
  creator: CombinedCreatorRecord,
  field: (typeof GATHERER_MONGO_PERFORMANCE_SNAPSHOT_FIELDS)[number]
): string | null {
  const value = creator[field];
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }
  return String(value);
}

// MARK: Public Mappers

export function gathererMongoMapperCreatorToDocument(
  creator: CombinedCreatorRecord,
  mongoWrittenAt: string
): GathererMongoCreatorDocument | null {
  const backstageCreatorId = String(creator.backstage_creator_id ?? "").trim();
  if (!backstageCreatorId) {
    return null;
  }

  const document: GathererMongoCreatorDocument = {
    backstage_creator_id: backstageCreatorId,
    gatherer_mongo_updated_at: mongoWrittenAt,
    gatherer_mongo_import_run_id: creator.import_run_id,
  };

  for (const [key, value] of Object.entries(creator)) {
    if (key === "backstage_creator_id") {
      continue;
    }
    document[key] = gathererMongoMapperNormalizeScalar(value);
  }

  return document;
}

export function gathererMongoMapperCreatorToPerformanceSnapshot(
  creator: CombinedCreatorRecord,
  mongoWrittenAt: string
): GathererMongoPerformanceSnapshotDocument | null {
  const backstageCreatorId = String(creator.backstage_creator_id ?? "").trim();
  if (!backstageCreatorId) {
    return null;
  }

  const snapshot: GathererMongoPerformanceSnapshotDocument = {
    backstage_creator_id: backstageCreatorId,
    import_run_id: creator.import_run_id,
    imported_at: creator.imported_at,
    row_checksum: creator.row_checksum ?? null,
    performance_data_period: gathererMongoMapperReadStringField(creator, "performance_data_period"),
    total_diamonds: gathererMongoMapperReadNumberField(creator, "total_diamonds"),
    diamonds_l30d: gathererMongoMapperReadNumberField(creator, "diamonds_l30d"),
    dollars: gathererMongoMapperReadNumberField(creator, "dollars"),
    live_duration_total_hours: gathererMongoMapperReadNumberField(
      creator,
      "live_duration_total_hours"
    ),
    valid_live_days_total: gathererMongoMapperReadNumberField(creator, "valid_live_days_total"),
    live_duration_l30d_hours: gathererMongoMapperReadNumberField(
      creator,
      "live_duration_l30d_hours"
    ),
    valid_live_days_l30d: gathererMongoMapperReadNumberField(creator, "valid_live_days_l30d"),
    followers: gathererMongoMapperReadNumberField(creator, "followers"),
    videos: gathererMongoMapperReadNumberField(creator, "videos"),
    likes: gathererMongoMapperReadNumberField(creator, "likes"),
    new_followers: gathererMongoMapperReadNumberField(creator, "new_followers"),
    live_streams: gathererMongoMapperReadNumberField(creator, "live_streams"),
    tier_status: gathererMongoMapperReadStringField(creator, "tier_status"),
    tier_last_month: gathererMongoMapperReadStringField(creator, "tier_last_month"),
    current_tier: gathererMongoMapperReadStringField(creator, "current_tier"),
    progress_to_next_tier: gathererMongoMapperReadStringField(creator, "progress_to_next_tier"),
    matches: gathererMongoMapperReadNumberField(creator, "matches"),
    diamonds_from_matches: gathererMongoMapperReadNumberField(creator, "diamonds_from_matches"),
    fan_club_total_diamonds: gathererMongoMapperReadNumberField(creator, "fan_club_total_diamonds"),
    diamonds_from_fan_club_l30d: gathererMongoMapperReadNumberField(
      creator,
      "diamonds_from_fan_club_l30d"
    ),
    fan_contribution_percent: gathererMongoMapperReadNumberField(creator, "fan_contribution_percent"),
    active_fans_from_fan_club: gathererMongoMapperReadNumberField(
      creator,
      "active_fans_from_fan_club"
    ),
    active_fans_from_fan_club_l30d: gathererMongoMapperReadNumberField(
      creator,
      "active_fans_from_fan_club_l30d"
    ),
    total_fans: gathererMongoMapperReadNumberField(creator, "total_fans"),
    new_fans: gathererMongoMapperReadNumberField(creator, "new_fans"),
    diamonds_from_multi_guest: gathererMongoMapperReadNumberField(
      creator,
      "diamonds_from_multi_guest"
    ),
    diamonds_from_multi_guest_host: gathererMongoMapperReadNumberField(
      creator,
      "diamonds_from_multi_guest_host"
    ),
    diamonds_from_multi_guest_guest: gathererMongoMapperReadNumberField(
      creator,
      "diamonds_from_multi_guest_guest"
    ),
    gatherer_mongo_snapshot_written_at: mongoWrittenAt,
  };

  return snapshot;
}

export function gathererMongoMapperSummaryToImportRunDocument(
  summary: ImportSummaryData,
  mongoPublished: boolean,
  mongoWrittenAt: string
): GathererMongoImportRunDocument {
  return {
    run_id: summary.runId,
    started_at: summary.startedAt,
    finished_at: summary.finishedAt,
    success: summary.success,
    performance_row_count: summary.performanceRowCount,
    management_row_count: summary.managementRowCount,
    combined_creator_count: summary.combinedCreatorCount,
    excluded_creator_count: summary.excludedCreatorCount ?? null,
    unmatched_performance_count: summary.unmatchedPerformanceCount,
    unmatched_management_count: summary.unmatchedManagementCount,
    enrichment_applied_count: summary.enrichmentAppliedCount,
    drive_uploaded: summary.driveUploaded,
    sheets_updated: summary.sheetsUpdated,
    mongo_published: mongoPublished,
    run_trigger: summary.runTrigger ?? null,
    scheduled_slot_index: summary.scheduledSlotIndex ?? null,
    scheduled_slot_total: summary.scheduledSlotTotal ?? null,
    is_daily_final_run: summary.isDailyFinalRun ?? null,
    daily_date_key: summary.dailyDateKey ?? null,
    daily_sheet_tab_name: summary.dailySheetTabName ?? null,
    errors: summary.errors,
    gatherer_mongo_written_at: mongoWrittenAt,
  };
}

// Suggestions For Features and Additions Later:
// - Diff-only snapshots when row_checksum matches previous run
// - Separate identity vs performance document split for smaller hot reads
