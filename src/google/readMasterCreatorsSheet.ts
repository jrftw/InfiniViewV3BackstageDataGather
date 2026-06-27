/**
 * Filename: readMasterCreatorsSheet.ts
 * Purpose: Read 01_Latest_Master_Creators from the master Google Sheet into creator records.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-26
 * Dependencies: googleapis, crmEnrichmentFields, mergeBackstageReports
 * Platform Compatibility: Node.js 18+
 */

import { GathererConfig } from "../config";
import { createGoogleSheetsClient } from "./sheetsClient";
import { SHEET_TABS } from "./updateSheetTabs";
import { CombinedCreatorRecord } from "../processing/mergeBackstageReports";
import {
  crmEnrichmentBuildHeaderAliases,
  crmEnrichmentBuildNullDefaults,
} from "../processing/crmEnrichmentFields";
import { normalizeCreatorRecordForApp } from "../processing/normalizeCreatorForCache";
import { normalizeBackstageCreatorId } from "../processing/normalizeCreatorId";
import { normalizeTikTokUsername } from "../processing/normalizeUsername";
import { logInfo, logWarn } from "../logging/logger";

// MARK: - Header Aliases

const READ_MASTER_CREATORS_SHEET_HEADER_ALIASES: Record<string, keyof CombinedCreatorRecord> = {
  ...crmEnrichmentBuildHeaderAliases(),
  backstage_creator_id: "backstage_creator_id",
  creator_id: "backstage_creator_id",
  cid: "backstage_creator_id",
  tiktok_username: "tiktok_username",
  username: "tiktok_username",
  userid: "tiktok_username",
  display_name: "display_name",
  normalized_username: "normalized_username",
  joined_time: "joined_time",
  days_since_joining: "days_since_joining",
  graduation_status: "graduation_status",
  tier_status: "tier_status",
  tier_last_month: "tier_last_month",
  relationship_status: "relationship_status",
  last_live: "last_live",
  performance_data_period: "performance_data_period",
  total_diamonds: "total_diamonds",
  diamonds_l30d: "diamonds_l30d",
  live_duration_l30d_hours: "live_duration_l30d_hours",
  valid_live_days_l30d: "valid_live_days_l30d",
  live_duration_total_hours: "live_duration_total_hours",
  valid_live_days_total: "valid_live_days_total",
  followers: "followers",
  videos: "videos",
  likes: "likes",
  new_followers: "new_followers",
  live_streams: "live_streams",
  matches: "matches",
  diamonds_from_matches: "diamonds_from_matches",
  fan_club_total_diamonds: "fan_club_total_diamonds",
  diamonds_from_fan_club_l30d: "diamonds_from_fan_club_l30d",
  fan_contribution_percent: "fan_contribution_percent",
  active_fans_from_fan_club: "active_fans_from_fan_club",
  active_fans_from_fan_club_l30d: "active_fans_from_fan_club_l30d",
  total_fans: "total_fans",
  new_fans: "new_fans",
  diamonds_from_multi_guest: "diamonds_from_multi_guest",
  diamonds_from_multi_guest_host: "diamonds_from_multi_guest_host",
  diamonds_from_multi_guest_guest: "diamonds_from_multi_guest_guest",
  notes: "notes",
  management_start_date: "management_start_date",
  management_end_date: "management_end_date",
  renewed_management_start_date: "renewed_management_start_date",
  renewed_management_end_date: "renewed_management_end_date",
  invited_by: "invited_by",
  promote_permission: "promote_permission",
  subscription_status: "subscription_status",
  invitation_type: "invitation_type",
  new_live_creator_this_month: "new_live_creator_this_month",
  prior_month_diamonds: "prior_month_diamonds",
  prior_month_valid_days: "prior_month_valid_days",
  prior_month_hours: "prior_month_hours",
  last_month_tier_index: "last_month_tier_index",
  current_tier_index: "current_tier_index",
  tier_rank_status: "tier_rank_status",
  current_tier: "current_tier",
  streamer_diamond_bonus: "streamer_diamond_bonus",
  maintained_bonus_eligible_80pct: "maintained_bonus_eligible_80pct",
  progress_to_next_tier: "progress_to_next_tier",
  preferred_manager: "preferred_manager",
  manual_notes: "manual_notes",
  special_status: "special_status",
  do_not_reassign: "do_not_reassign",
  import_run_id: "import_run_id",
  imported_at: "imported_at",
  source_performance_file: "source_performance_file",
  source_management_file: "source_management_file",
  match_method: "match_method",
  warnings: "warnings",
  schema_version: "schema_version",
  row_checksum: "row_checksum",
  last_successful_sync_at: "last_successful_sync_at",
  last_sync_status: "last_sync_status",
  last_sync_error: "last_sync_error",
  last_cache_published_at: "last_cache_published_at",
  cache_record_version: "cache_record_version",
};

const READ_MASTER_CREATORS_SHEET_NUMERIC_FIELDS = new Set<keyof CombinedCreatorRecord>([
  "days_since_joining",
  "total_diamonds",
  "diamonds_l30d",
  "live_duration_l30d_hours",
  "valid_live_days_l30d",
  "live_duration_total_hours",
  "valid_live_days_total",
  "followers",
  "videos",
  "likes",
  "new_followers",
  "live_streams",
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
]);

// MARK: - Parse Helpers

function readMasterCreatorsSheetNormalizeHeader(raw: string): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function readMasterCreatorsSheetMapHeader(raw: string): keyof CombinedCreatorRecord | null {
  const normalized = readMasterCreatorsSheetNormalizeHeader(raw);
  return READ_MASTER_CREATORS_SHEET_HEADER_ALIASES[normalized] ?? null;
}

/** Resolve a master sheet header label to a creator field key (shared by read + patch publish). */
export function readMasterCreatorsSheetResolveHeaderField(
  raw: string
): keyof CombinedCreatorRecord | null {
  return readMasterCreatorsSheetMapHeader(raw);
}

function readMasterCreatorsSheetParseCell(
  field: keyof CombinedCreatorRecord,
  raw: string
): string | number | boolean | string[] | null {
  const text = raw.trim();
  if (!text) {
    return null;
  }

  if (field === "do_not_reassign") {
    const lowered = text.toLowerCase();
    if (lowered === "true" || lowered === "yes" || lowered === "1") {
      return true;
    }
    if (lowered === "false" || lowered === "no" || lowered === "0") {
      return false;
    }
    return null;
  }

  if (field === "warnings") {
    return text.split(";").map((part) => part.trim()).filter(Boolean);
  }

  if (READ_MASTER_CREATORS_SHEET_NUMERIC_FIELDS.has(field)) {
    const cleaned = text.replace(/,/g, "");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (field === "backstage_creator_id") {
    return normalizeBackstageCreatorId(text);
  }

  if (field === "tiktok_username" || field === "normalized_username") {
    return normalizeTikTokUsername(text);
  }

  if (field === "phone" && text.startsWith("'")) {
    return text.slice(1);
  }

  return text;
}

function readMasterCreatorsSheetBuildEmptyCreator(): CombinedCreatorRecord {
  return {
    backstage_creator_id: null,
    tiktok_username: null,
    display_name: null,
    normalized_username: null,
    joined_time: null,
    days_since_joining: null,
    graduation_status: null,
    tier_status: null,
    tier_last_month: null,
    relationship_status: null,
    last_live: null,
    performance_data_period: null,
    total_diamonds: null,
    diamonds_l30d: null,
    live_duration_l30d_hours: null,
    valid_live_days_l30d: null,
    live_duration_total_hours: null,
    valid_live_days_total: null,
    followers: null,
    videos: null,
    likes: null,
    new_followers: null,
    live_streams: null,
    matches: null,
    diamonds_from_matches: null,
    fan_club_total_diamonds: null,
    diamonds_from_fan_club_l30d: null,
    fan_contribution_percent: null,
    active_fans_from_fan_club: null,
    active_fans_from_fan_club_l30d: null,
    total_fans: null,
    new_fans: null,
    diamonds_from_multi_guest: null,
    diamonds_from_multi_guest_host: null,
    diamonds_from_multi_guest_guest: null,
    notes: null,
    management_start_date: null,
    management_end_date: null,
    renewed_management_start_date: null,
    renewed_management_end_date: null,
    invited_by: null,
    promote_permission: null,
    subscription_status: null,
    invitation_type: null,
    new_live_creator_this_month: null,
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
    import_run_id: "",
    imported_at: "",
    source_performance_file: "",
    source_management_file: "",
    match_method: "",
    warnings: [],
    schema_version: null,
    row_checksum: null,
    last_successful_sync_at: null,
    last_sync_status: null,
    last_sync_error: null,
    last_cache_published_at: null,
    cache_record_version: null,
    ...crmEnrichmentBuildNullDefaults(),
  };
}

function readMasterCreatorsSheetParseRows(rows: string[][]): CombinedCreatorRecord[] {
  return readMasterCreatorsSheetParseIndexedRows(rows).map((entry) =>
    normalizeCreatorRecordForApp(entry.creator)
  );
}

export interface MasterCreatorsSheetIndexedRow {
  sheetRowNumber: number;
  creator: CombinedCreatorRecord;
}

export interface MasterCreatorsSheetRawRows {
  headerLabels: string[];
  rows: MasterCreatorsSheetIndexedRow[];
}

function readMasterCreatorsSheetParseIndexedRows(rows: string[][]): MasterCreatorsSheetIndexedRow[] {
  if (rows.length < 2) {
    return [];
  }

  const headerRow = rows[0];
  const headerLabels = headerRow.map((header) => String(header).trim());
  const columnMap: Array<{ index: number; field: keyof CombinedCreatorRecord }> = [];

  headerRow.forEach((header, index) => {
    const field = readMasterCreatorsSheetMapHeader(String(header));
    if (field) {
      columnMap.push({ index, field });
    }
  });

  if (columnMap.length === 0) {
    logWarn("Master creators sheet has no recognized columns", "readMasterCreatorsSheet");
    return [];
  }

  const parsed: MasterCreatorsSheetIndexedRow[] = [];

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const record = readMasterCreatorsSheetBuildEmptyCreator();
    let hasIdentity = false;

    for (const { index, field } of columnMap) {
      const raw = row[index];
      if (raw === undefined || raw === null || String(raw).trim() === "") {
        continue;
      }
      const value = readMasterCreatorsSheetParseCell(field, String(raw));
      (record as Record<string, unknown>)[field] = value;
      if (field === "backstage_creator_id" || field === "tiktok_username" || field === "normalized_username") {
        hasIdentity = true;
      }
    }

    if (hasIdentity) {
      if (!record.normalized_username) {
        record.normalized_username = normalizeTikTokUsername(record.tiktok_username);
      }
      parsed.push({
        sheetRowNumber: rowIndex + 1,
        creator: record,
      });
    }
  }

  return parsed;
}

// MARK: - Read API

export async function readMasterCreatorsSheetRawRows(
  config: GathererConfig
): Promise<MasterCreatorsSheetRawRows | null> {
  if (!config.googleMasterSheetId) {
    return null;
  }

  const sheets = createGoogleSheetsClient(config);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.googleMasterSheetId,
    range: `${SHEET_TABS.latestMaster}!A:ZZ`,
  });

  const rows = (response.data.values ?? []) as string[][];
  if (rows.length === 0) {
    return null;
  }

  return {
    headerLabels: rows[0].map((header) => String(header).trim()),
    rows: readMasterCreatorsSheetParseIndexedRows(rows),
  };
}

export async function readMasterCreatorsSheet(
  config: GathererConfig
): Promise<CombinedCreatorRecord[]> {
  if (!config.googleMasterSheetId) {
    logWarn("GOOGLE_MASTER_SHEET_ID not configured — cannot read master creators", "readMasterCreatorsSheet");
    return [];
  }

  const sheets = createGoogleSheetsClient(config);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.googleMasterSheetId,
    range: `${SHEET_TABS.latestMaster}!A:ZZ`,
  });

  const rows = (response.data.values ?? []) as string[][];
  const creators = readMasterCreatorsSheetParseRows(rows);
  logInfo(`Loaded ${creators.length} creators from ${SHEET_TABS.latestMaster}`, "readMasterCreatorsSheet");
  return creators;
}

// Suggestions For Features and Additions Later:
// - Read from local combined JSON cache when sheet is unavailable
