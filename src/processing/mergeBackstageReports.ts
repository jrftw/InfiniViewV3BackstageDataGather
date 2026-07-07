/**
 * Filename: mergeBackstageReports.ts
 * Purpose: Merge performance and management exports by Creator ID with username fallback.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-24
 * Platform Compatibility: Node.js 18+
 */

import { normalizeBackstageCreatorId } from "./normalizeCreatorId";
import { normalizeTikTokUsername } from "./normalizeUsername";
import {
  normalizeBackstageDays,
  normalizeBackstageDiamonds,
  normalizeBackstageNumber,
  normalizeBackstagePercent,
} from "./normalizeNumbers";
import { normalizeBackstageDurationHours } from "./normalizeDurations";
import { deriveNewLiveCreatorThisMonthFromJoinedTime } from "./normalizeJoinedTime";
import { normalizeBackstageManagementDateRange } from "./normalizeManagementDateRange";
import { CrmSheetEnrichmentDataField, crmEnrichmentBuildNullDefaults } from "./crmEnrichmentFields";
import { gathererBasenameFilePath } from "../utils/gathererBasenameFilePath";
import { ParsedBackstageRow } from "./parseWorkbook";
import {
  GATHERER_BACKSTAGE_CREATOR_DATA_FIELD_ALIASES,
  GATHERER_BACKSTAGE_MANAGE_CREATORS_FIELD_ALIASES,
  gathererBackstageFieldResolveRawRowValue,
} from "./gathererBackstageFieldAliasCatalog";

// MARK: - Combined Creator Type

export type CombinedCreatorRecord = {
  backstage_creator_id: string | null;
  tiktok_username: string | null;
  display_name: string | null;
  normalized_username: string | null;
  joined_time: string | null;
  days_since_joining: number | null;
  graduation_status: string | null;
  tier_status: string | null;
  tier_last_month: string | null;
  relationship_status: string | null;
  last_live: string | null;
  performance_data_period: string | null;
  total_diamonds: number | null;
  diamonds_l30d: number | null;
  live_duration_l30d_hours: number | null;
  valid_live_days_l30d: number | null;
  live_duration_total_hours: number | null;
  valid_live_days_total: number | null;
  followers: number | null;
  videos: number | null;
  likes: number | null;
  new_followers: number | null;
  live_streams: number | null;
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
  notes: string | null;
  management_start_date: string | null;
  management_end_date: string | null;
  renewed_management_start_date: string | null;
  renewed_management_end_date: string | null;
  invited_by: string | null;
  promote_permission: string | null;
  subscription_status: string | null;
  invitation_type: string | null;
  new_live_creator_this_month: string | null;
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
  preferred_manager: string | null;
  manual_notes: string | null;
  special_status: string | null;
  do_not_reassign: boolean | null;
  import_run_id: string;
  imported_at: string;
  source_performance_file: string;
  source_management_file: string;
  match_method: string;
  warnings: string[];
  schema_version: string | null;
  row_checksum: string | null;
  last_successful_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  last_cache_published_at: string | null;
  cache_record_version: string | null;
} & Record<CrmSheetEnrichmentDataField, string | null>;

export interface MergeBackstageResult {
  combined: CombinedCreatorRecord[];
  unmatchedPerformance: ParsedBackstageRow[];
  unmatchedManagement: ParsedBackstageRow[];
  duplicateWarnings: string[];
}

export interface MergeBackstageReportsOptions {
  timezone?: string;
  referenceDate?: Date;
}

// MARK: - Field Helpers

function mergeGetString(row: ParsedBackstageRow, ...keys: string[]): string | null {
  for (const key of keys) {
    const val = row[key];
    if (val !== null && val !== undefined && String(val).trim() !== "" && String(val).trim() !== "-") {
      return String(val).trim();
    }
  }
  return null;
}

function mergeGetDiamondsFromDefinition(
  row: ParsedBackstageRow,
  definition: (typeof GATHERER_BACKSTAGE_CREATOR_DATA_FIELD_ALIASES)[number]
): number | null {
  return normalizeBackstageDiamonds(gathererBackstageFieldResolveRawRowValue(row, definition));
}

function mergeGetDurationHoursFromDefinition(
  row: ParsedBackstageRow,
  definition: (typeof GATHERER_BACKSTAGE_CREATOR_DATA_FIELD_ALIASES)[number]
): number | null {
  return normalizeBackstageDurationHours(gathererBackstageFieldResolveRawRowValue(row, definition));
}

function mergeGetDaysFromDefinition(
  row: ParsedBackstageRow,
  definition: (typeof GATHERER_BACKSTAGE_CREATOR_DATA_FIELD_ALIASES)[number]
): number | null {
  return normalizeBackstageDays(gathererBackstageFieldResolveRawRowValue(row, definition));
}

function mergeGetStringFromDefinition(
  row: ParsedBackstageRow,
  definition: (typeof GATHERER_BACKSTAGE_CREATOR_DATA_FIELD_ALIASES)[number]
): string | null {
  const value = gathererBackstageFieldResolveRawRowValue(row, definition);
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  return text === "" || text === "-" ? null : text;
}

const GATHERER_MERGE_CREATOR_DATA_TOTAL_DIAMONDS_DEF = GATHERER_BACKSTAGE_CREATOR_DATA_FIELD_ALIASES[0];
const GATHERER_MERGE_CREATOR_DATA_LIVE_DURATION_DEF = GATHERER_BACKSTAGE_CREATOR_DATA_FIELD_ALIASES[1];
const GATHERER_MERGE_CREATOR_DATA_VALID_DAYS_DEF = GATHERER_BACKSTAGE_CREATOR_DATA_FIELD_ALIASES[2];
const GATHERER_MERGE_CREATOR_DATA_DATA_PERIOD_DEF = GATHERER_BACKSTAGE_CREATOR_DATA_FIELD_ALIASES[3];
const GATHERER_MERGE_MANAGE_DIAMONDS_L30D_DEF = GATHERER_BACKSTAGE_MANAGE_CREATORS_FIELD_ALIASES[0];
const GATHERER_MERGE_MANAGE_LIVE_DURATION_L30D_DEF = GATHERER_BACKSTAGE_MANAGE_CREATORS_FIELD_ALIASES[1];
const GATHERER_MERGE_MANAGE_VALID_DAYS_L30D_DEF = GATHERER_BACKSTAGE_MANAGE_CREATORS_FIELD_ALIASES[2];

function mergeMapPerformanceRow(
  row: ParsedBackstageRow,
  runId: string,
  importedAt: string,
  perfFile: string,
  mgmtFile: string,
  timezone: string,
  referenceDate: Date
): CombinedCreatorRecord {
  const creatorId = normalizeBackstageCreatorId(row.creator_id ?? row.creatorid);
  const username = normalizeTikTokUsername(row.creators_username ?? row.creator);
  const fanPct = normalizeBackstagePercent(row.fan_contribution ?? row.fan_contribution_);
  const joinedTime = mergeGetString(row, "join_time", "joined_time");

  return {
    backstage_creator_id: creatorId,
    tiktok_username: username,
    display_name: mergeGetString(row, "creators_username", "creator"),
    normalized_username: username,
    joined_time: joinedTime,
    days_since_joining: normalizeBackstageDays(row.days_since_joining),
    graduation_status: mergeGetString(row, "graduation_status"),
    tier_status: mergeGetString(row, "tier_status"),
    tier_last_month: null,
    relationship_status: null,
    last_live: null,
    performance_data_period: mergeGetStringFromDefinition(
      row,
      GATHERER_MERGE_CREATOR_DATA_DATA_PERIOD_DEF
    ),
    total_diamonds: mergeGetDiamondsFromDefinition(row, GATHERER_MERGE_CREATOR_DATA_TOTAL_DIAMONDS_DEF),
    diamonds_l30d: mergeGetDiamondsFromDefinition(row, GATHERER_MERGE_MANAGE_DIAMONDS_L30D_DEF),
    live_duration_l30d_hours: null,
    valid_live_days_l30d: null,
    live_duration_total_hours: mergeGetDurationHoursFromDefinition(
      row,
      GATHERER_MERGE_CREATOR_DATA_LIVE_DURATION_DEF
    ),
    valid_live_days_total: mergeGetDaysFromDefinition(row, GATHERER_MERGE_CREATOR_DATA_VALID_DAYS_DEF),
    followers: null,
    videos: null,
    likes: null,
    new_followers: normalizeBackstageNumber(row.new_followers),
    live_streams: normalizeBackstageNumber(row.live_streams),
    matches: normalizeBackstageNumber(row.matches),
    diamonds_from_matches: normalizeBackstageDiamonds(row.diamonds_from_matches),
    fan_club_total_diamonds: normalizeBackstageDiamonds(row.fan_club_total_diamonds),
    diamonds_from_fan_club_l30d: null,
    fan_contribution_percent: fanPct.value,
    active_fans_from_fan_club: normalizeBackstageNumber(row.active_fans_from_fan_club),
    active_fans_from_fan_club_l30d: null,
    total_fans: normalizeBackstageNumber(row.total_fans),
    new_fans: normalizeBackstageNumber(row.new_fans),
    diamonds_from_multi_guest: normalizeBackstageDiamonds(row.diamonds_from_multiguest ?? row.diamonds_from_multi_guest),
    diamonds_from_multi_guest_host: normalizeBackstageDiamonds(
      row.diamonds_from_multiguest_as_host ?? row.diamonds_from_multi_guest_as_host
    ),
    diamonds_from_multi_guest_guest: normalizeBackstageDiamonds(
      row.diamonds_from_multiguest_as_guest ?? row.diamonds_from_multi_guest_as_guest
    ),
    notes: null,
    management_start_date: null,
    management_end_date: null,
    renewed_management_start_date: null,
    renewed_management_end_date: null,
    invited_by: null,
    promote_permission: null,
    subscription_status: null,
    invitation_type: null,
    new_live_creator_this_month: deriveNewLiveCreatorThisMonthFromJoinedTime(
      joinedTime,
      timezone,
      referenceDate
    ),
    ...crmEnrichmentBuildNullDefaults(),
    prior_month_diamonds: null,
    prior_month_valid_days: null,
    prior_month_hours: null,
    last_month_tier_index: null,
    current_tier_index: null,
    tier_rank_status: null,
    current_tier: null,
    streamer_diamond_bonus: null,
    maintained_bonus_eligible_80pct: null,
    progress_to_next_tier: null,
    preferred_manager: null,
    manual_notes: null,
    special_status: null,
    do_not_reassign: null,
    import_run_id: runId,
    imported_at: importedAt,
    source_performance_file: gathererBasenameFilePath(perfFile),
    source_management_file: gathererBasenameFilePath(mgmtFile),
    match_method: "pending",
    warnings: fanPct.warning ? [fanPct.warning] : [],
    schema_version: null,
    row_checksum: null,
    last_successful_sync_at: null,
    last_sync_status: null,
    last_sync_error: null,
    last_cache_published_at: null,
    cache_record_version: null,
  };
}

function mergeApplyManagementFields(record: CombinedCreatorRecord, row: ParsedBackstageRow): void {
  record.tier_last_month = mergeGetString(row, "tier_last_month") ?? record.tier_last_month;
  record.relationship_status = mergeGetString(row, "relationship_status") ?? record.relationship_status;
  record.last_live = mergeGetString(row, "last_live") ?? record.last_live;
  record.diamonds_l30d =
    mergeGetDiamondsFromDefinition(row, GATHERER_MERGE_MANAGE_DIAMONDS_L30D_DEF) ?? record.diamonds_l30d;
  record.live_duration_l30d_hours =
    mergeGetDurationHoursFromDefinition(row, GATHERER_MERGE_MANAGE_LIVE_DURATION_L30D_DEF) ??
    record.live_duration_l30d_hours;
  record.valid_live_days_l30d =
    mergeGetDaysFromDefinition(row, GATHERER_MERGE_MANAGE_VALID_DAYS_L30D_DEF) ??
    record.valid_live_days_l30d;
  record.followers = normalizeBackstageNumber(row.followers) ?? record.followers;
  record.videos = normalizeBackstageNumber(row.videos) ?? record.videos;
  record.likes = normalizeBackstageNumber(row.likes) ?? record.likes;
  record.diamonds_from_fan_club_l30d =
    normalizeBackstageDiamonds(row.diamonds_from_fan_club_in_l30d) ?? record.diamonds_from_fan_club_l30d;
  record.active_fans_from_fan_club_l30d =
    normalizeBackstageNumber(row.active_fans_from_fan_club_in_l30d) ??
    record.active_fans_from_fan_club_l30d;
  record.notes = mergeGetString(row, "notes") ?? record.notes;

  const managementDates = normalizeBackstageManagementDateRange(
    mergeGetString(row, "management_relationship_dates")
  );
  if (managementDates.startDate) {
    record.management_start_date = managementDates.startDate;
  }
  if (managementDates.endDate) {
    record.management_end_date = managementDates.endDate;
  }

  const renewedDates = normalizeBackstageManagementDateRange(
    mergeGetString(row, "renewed_management_relationship_dates")
  );
  if (renewedDates.startDate) {
    record.renewed_management_start_date = renewedDates.startDate;
  }
  if (renewedDates.endDate) {
    record.renewed_management_end_date = renewedDates.endDate;
  }

  record.invited_by = mergeGetString(row, "invited_by") ?? record.invited_by;
  record.promote_permission = mergeGetString(row, "promote_permission") ?? record.promote_permission;
  record.subscription_status = mergeGetString(row, "subscription_status") ?? record.subscription_status;
  record.invitation_type = mergeGetString(row, "invitation_type") ?? record.invitation_type;
}

// MARK: - Merge Engine

export function mergeBackstageReports(
  performanceRows: ParsedBackstageRow[],
  managementRows: ParsedBackstageRow[],
  runId: string,
  importedAt: string,
  perfFile: string,
  mgmtFile: string,
  options: MergeBackstageReportsOptions = {}
): MergeBackstageResult {
  const timezone = options.timezone ?? process.env.TZ ?? "America/New_York";
  const referenceDate = options.referenceDate ?? new Date(importedAt);
  const byCreatorId = new Map<string, CombinedCreatorRecord>();
  const byUsername = new Map<string, CombinedCreatorRecord>();
  const duplicateWarnings: string[] = [];
  const unmatchedPerformance: ParsedBackstageRow[] = [];
  const matchedMgmtIndices = new Set<number>();

  for (const row of performanceRows) {
    const record = mergeMapPerformanceRow(
      row,
      runId,
      importedAt,
      perfFile,
      mgmtFile,
      timezone,
      referenceDate
    );
    const creatorId = record.backstage_creator_id;
    const username = record.normalized_username;

    if (creatorId) {
      if (byCreatorId.has(creatorId)) {
        duplicateWarnings.push(`Duplicate performance Creator ID: ${creatorId}`);
      }
      byCreatorId.set(creatorId, record);
    } else if (username) {
      byUsername.set(username, record);
    } else {
      unmatchedPerformance.push(row);
    }
  }

  const unmatchedManagement: ParsedBackstageRow[] = [];

  managementRows.forEach((row, index) => {
    const creatorId = normalizeBackstageCreatorId(row.creator_id ?? row.creatorid);
    const username = normalizeTikTokUsername(row.creators_username ?? row.creator);

    let record: CombinedCreatorRecord | undefined;

    if (creatorId && byCreatorId.has(creatorId)) {
      record = byCreatorId.get(creatorId);
      if (record) record.match_method = "creator_id";
    } else if (username && byUsername.has(username)) {
      record = byUsername.get(username);
      if (record) record.match_method = "username";
    } else if (creatorId) {
      record = mergeMapPerformanceRow(
        {
          creator_id: creatorId,
          creators_username: row.creators_username ?? row.creator,
          _rowIndex: row._rowIndex,
          _sourceSheet: row._sourceSheet,
        },
        runId,
        importedAt,
        perfFile,
        mgmtFile,
        timezone,
        referenceDate
      );
      record.match_method = "management_only";
      byCreatorId.set(creatorId, record);
    } else if (username) {
      record = mergeMapPerformanceRow(
        {
          creators_username: row.creators_username ?? row.creator,
          _rowIndex: row._rowIndex,
          _sourceSheet: row._sourceSheet,
        },
        runId,
        importedAt,
        perfFile,
        mgmtFile,
        timezone,
        referenceDate
      );
      record.match_method = "management_only_username";
      byUsername.set(username, record);
    }

    if (record) {
      mergeApplyManagementFields(record, row);
      matchedMgmtIndices.add(index);
    } else {
      unmatchedManagement.push(row);
    }
  });

  const combinedMap = new Map<string, CombinedCreatorRecord>();
  for (const record of byCreatorId.values()) {
    const key = record.backstage_creator_id ?? record.normalized_username ?? record.import_run_id;
    combinedMap.set(key, record);
  }
  for (const record of byUsername.values()) {
    const key = record.backstage_creator_id ?? record.normalized_username ?? record.import_run_id;
    if (!combinedMap.has(key)) {
      combinedMap.set(key, record);
    }
  }

  return {
    combined: Array.from(combinedMap.values()),
    unmatchedPerformance,
    unmatchedManagement,
    duplicateWarnings,
  };
}

// Suggestions For Features and Additions Later:
// - Fuzzy username matching with confidence score
