/**
 * Filename: sheetDataHelpers.ts
 * Purpose: Shared row-to-Sheet values conversion for master and daily archive tabs.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-24
 * Platform Compatibility: Node.js 18+
 */

import { CombinedCreatorRecord } from "../processing/mergeBackstageReports";
import { CRM_ENRICHMENT_MASTER_SHEET_PROFILE_BLOCK } from "../processing/crmEnrichmentFields";

// MARK: - Sheet Column Presets

/** Columns omitted from Google Sheet / export views (still kept in JSON for processing). */
export const SHEET_DATA_OMIT_CREATOR_COLUMNS: (keyof CombinedCreatorRecord)[] = [];

/** Force plain-text cells in Google Sheets (preserves leading zeros). */
export const SHEET_DATA_PLAIN_TEXT_COLUMNS: (keyof CombinedCreatorRecord)[] = ["phone"];

/** Column order for 01_Latest_Master_Creators and daily archive combined tabs. */
export const SHEET_DATA_MASTER_CREATOR_COLUMN_ORDER: (keyof CombinedCreatorRecord)[] = [
  "backstage_creator_id",
  "tiktok_username",
  "display_name",
  "normalized_username",
  "email",
  "phone",
  "login_enabled",
  "crm_contact_id",
  ...CRM_ENRICHMENT_MASTER_SHEET_PROFILE_BLOCK,
  "manager_name",
  "director_name",
  "portal_user_id",
  "portal_login_enabled",
  "last_portal_login_at",
  "record_created_at",
  "record_updated_at",
  "last_reviewed_at",
  "last_contacted_at",
  "risk_status",
  "next_action_due_at",
  "joined_time",
  "days_since_joining",
  "graduation_status",
  "relationship_status",
  "subscription_status",
  "invitation_type",
  "new_live_creator_this_month",
  "last_live",
  "management_start_date",
  "management_end_date",
  "renewed_management_start_date",
  "renewed_management_end_date",
  "invited_by",
  "agent_email",
  "preferred_manager",
  "promote_permission",
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
  "prior_month_diamonds",
  "prior_month_valid_days",
  "prior_month_hours",
  "last_month_tier_index",
  "current_tier_index",
  "current_tier",
  "tier_rank_status",
  "progress_to_next_tier",
  "z_dip_status",
  "z_dip_payment_email",
  "streamer_diamond_bonus",
  "maintained_bonus_eligible_80pct",
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
  "notes",
  "manual_notes",
  "special_status",
  "do_not_reassign",
  "warnings",
  "import_run_id",
  "imported_at",
  "source_performance_file",
  "source_management_file",
  "match_method",
  "schema_version",
  "row_checksum",
  "last_successful_sync_at",
  "last_sync_status",
  "last_sync_error",
  "last_cache_published_at",
  "cache_record_version",
];

// MARK: - Header Resolution

export function sheetDataResolveCreatorHeaders(
  sample: CombinedCreatorRecord,
  options?: {
    omitColumns?: (keyof CombinedCreatorRecord)[];
    columnOrder?: (keyof CombinedCreatorRecord)[];
  }
): (keyof CombinedCreatorRecord)[] {
  const omitSet = new Set(options?.omitColumns ?? SHEET_DATA_OMIT_CREATOR_COLUMNS);
  const presetOrder = options?.columnOrder ?? SHEET_DATA_MASTER_CREATOR_COLUMN_ORDER;
  const allKeys = Object.keys(sample) as (keyof CombinedCreatorRecord)[];
  const headers: (keyof CombinedCreatorRecord)[] = [];

  for (const key of presetOrder) {
    if (key in sample && !omitSet.has(key) && !headers.includes(key)) {
      headers.push(key);
    }
  }

  for (const key of allKeys) {
    if (!omitSet.has(key) && !headers.includes(key)) {
      headers.push(key);
    }
  }

  return headers;
}

function sheetDataFormatCreatorCellValue(
  field: keyof CombinedCreatorRecord,
  val: unknown
): string {
  if (Array.isArray(val)) {
    return val.join("; ");
  }
  if (val === null || val === undefined) {
    return "";
  }

  const text = String(val);
  if (SHEET_DATA_PLAIN_TEXT_COLUMNS.includes(field) && text !== "") {
    return `'${text}`;
  }

  return text;
}

// MARK: - Row Converters

export function sheetDataRowsToValues(rows: Record<string, unknown>[]): string[][] {
  if (rows.length === 0) {
    return [["(empty)"]];
  }
  const headers = Object.keys(rows[0]).filter((k) => !k.startsWith("_"));
  const values: string[][] = [headers];
  for (const row of rows) {
    values.push(headers.map((h) => (row[h] === null || row[h] === undefined ? "" : String(row[h]))));
  }
  return values;
}

export function sheetDataCreatorsToValues(
  creators: CombinedCreatorRecord[],
  options?: {
    omitColumns?: (keyof CombinedCreatorRecord)[];
    columnOrder?: (keyof CombinedCreatorRecord)[];
  }
): string[][] {
  if (creators.length === 0) {
    return [["(empty)"]];
  }
  const headers = sheetDataResolveCreatorHeaders(creators[0], options);
  const values: string[][] = [headers as string[]];
  for (const creator of creators) {
    values.push(
      headers.map((h) => sheetDataFormatCreatorCellValue(h, creator[h]))
    );
  }
  return values;
}

export function sheetDataCreatorToRowValues(
  creator: CombinedCreatorRecord,
  headers: (keyof CombinedCreatorRecord)[]
): string[] {
  return headers.map((header) => sheetDataFormatCreatorCellValue(header, creator[header]));
}

// Suggestions For Features and Additions Later:
// - Per-tab column order overrides via config
