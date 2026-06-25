/**
 * Filename: readExternalDipSheet.ts
 * Purpose: Read Diamond Incentive Program (DIP) fields from external Google Sheet.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-24
 * Dependencies: googleapis, applyDipSheetEnrichment
 * Platform Compatibility: Node.js 18+
 */

import { GathererConfig } from "../config";
import { createGoogleSheetsClient } from "./sheetsClient";
import { resolveGoogleSheetTabName } from "./resolveGoogleSheetTab";
import { DipSheetEnrichmentRow } from "../processing/applyDipSheetEnrichment";
import { logInfo, logWarn } from "../logging/logger";

// MARK: - Column Aliases

const READ_EXTERNAL_DIP_SHEET_HEADER_ALIASES: Record<string, keyof DipSheetEnrichmentRow> = {
  userid: "tiktok_username",
  user_id: "tiktok_username",
  tiktok_username: "tiktok_username",
  username: "tiktok_username",
  cid: "backstage_creator_id",
  creator_id: "backstage_creator_id",
  backstage_creator_id: "backstage_creator_id",
  prior_month_diamonds: "prior_month_diamonds",
  priormonthdiamonds: "prior_month_diamonds",
  prior_month_valid_days: "prior_month_valid_days",
  priormonthvaliddays: "prior_month_valid_days",
  prior_month_hours: "prior_month_hours",
  priormonthhours: "prior_month_hours",
  last_month_tier_index: "last_month_tier_index",
  lastmonthtierindex: "last_month_tier_index",
  current_tier_index: "current_tier_index",
  currenttierindex: "current_tier_index",
  status: "tier_rank_status",
  tier_rank_status: "tier_rank_status",
  current_tier: "current_tier",
  currenttier: "current_tier",
  streamer_diamond_bonus: "streamer_diamond_bonus",
  streamerdiamondbonus: "streamer_diamond_bonus",
  maintained_bonus_eligible_80pct: "maintained_bonus_eligible_80pct",
  maintainedbonuseligible80pct: "maintained_bonus_eligible_80pct",
  progress_to_next_tier: "progress_to_next_tier",
  progresstonexttier: "progress_to_next_tier",
};

// MARK: - Header Helpers

function readExternalDipSheetNormalizeHeader(raw: string): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function readExternalDipSheetMapHeader(raw: string): keyof DipSheetEnrichmentRow | null {
  const normalized = readExternalDipSheetNormalizeHeader(raw);
  return READ_EXTERNAL_DIP_SHEET_HEADER_ALIASES[normalized] ?? null;
}

function readExternalDipSheetEmptyRow(): DipSheetEnrichmentRow {
  return {
    backstage_creator_id: null,
    tiktok_username: null,
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
  };
}

function readExternalDipSheetParseRows(rows: string[][]): DipSheetEnrichmentRow[] {
  if (rows.length < 2) {
    return [];
  }

  const columnMap: Array<{ index: number; field: keyof DipSheetEnrichmentRow }> = [];

  rows[0].forEach((header, index) => {
    const field = readExternalDipSheetMapHeader(String(header));
    if (field) {
      columnMap.push({ index, field });
    }
  });

  if (columnMap.length === 0) {
    logWarn(
      "DIP sheet has no recognized columns (expected userId, cid, prior_month_diamonds, …)",
      "readExternalDipSheet"
    );
    return [];
  }

  const parsed: DipSheetEnrichmentRow[] = [];

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const record = readExternalDipSheetEmptyRow();
    let hasData = false;

    for (const { index, field } of columnMap) {
      const raw = row[index];
      if (raw === undefined || raw === null || String(raw).trim() === "") {
        continue;
      }
      const value = String(raw).trim();
      if (field === "backstage_creator_id") {
        record[field] = value.replace(/\D/g, "");
      } else {
        record[field] = value;
      }
      hasData = true;
    }

    if (hasData && (record.backstage_creator_id || record.tiktok_username)) {
      parsed.push(record);
    }
  }

  return parsed;
}

// MARK: - Public Reader

export async function readExternalDipSheetTab(config: GathererConfig): Promise<DipSheetEnrichmentRow[]> {
  if (!config.googleDipSheetId) {
    return [];
  }

  const sheets = createGoogleSheetsClient(config);
  const { tabName, spreadsheetTitle } = await resolveGoogleSheetTabName(config, {
    spreadsheetId: config.googleDipSheetId,
    tabTitle: config.googleDipSheetTab || undefined,
    tabGid: config.googleDipSheetGid || undefined,
    preferLeftmost: !config.googleDipSheetTab && !config.googleDipSheetGid,
  });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.googleDipSheetId,
    range: `'${tabName.replace(/'/g, "''")}'!A:Z`,
  });

  const rows = (response.data.values ?? []) as string[][];
  const parsed = readExternalDipSheetParseRows(rows);

  logInfo(
    `Loaded ${parsed.length} DIP rows from "${spreadsheetTitle}" tab "${tabName}"`,
    "readExternalDipSheet"
  );

  return parsed;
}

// Suggestions For Features and Additions Later:
// - Auto-select newest month tab by name pattern (e.g. June 2026)
