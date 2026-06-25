/**
 * Filename: readManualEnrichment.ts
 * Purpose: Read manual enrichment tabs without overwriting them.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-23
 * Dependencies: googleapis
 * Platform Compatibility: Node.js 18+
 */

import { GathererConfig } from "../config";
import { createGoogleSheetsClient } from "./sheetsClient";
import { ManualEnrichmentRow } from "../processing/applyManualEnrichment";
import { SHEET_TABS } from "./updateSheetTabs";
import { logInfo } from "../logging/logger";

// MARK: - Tab Names

export const MANUAL_ENRICHMENT_TABS = [
  SHEET_TABS.emailPhoneEnrichment,
  SHEET_TABS.managerAssignments,
] as const;

// MARK: - Read Helpers

function readManualEnrichmentParseRows(rows: string[][]): ManualEnrichmentRow[] {
  if (rows.length < 2) {
    return [];
  }

  const headers = rows[0].map((h) =>
    String(h).trim().toLowerCase().replace(/\s+/g, "_")
  );

  const enrichment: ManualEnrichmentRow[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const record: ManualEnrichmentRow = {};
    headers.forEach((header, idx) => {
      const val = row[idx];
      if (val !== undefined && val !== "") {
        (record as Record<string, unknown>)[header] = val;
      }
    });
    if (Object.keys(record).length > 0) {
      enrichment.push(record);
    }
  }

  return enrichment;
}

function readManualEnrichmentMergeRows(
  primary: ManualEnrichmentRow[],
  secondary: ManualEnrichmentRow[]
): ManualEnrichmentRow[] {
  const merged = new Map<string, ManualEnrichmentRow>();

  const mergeKey = (row: ManualEnrichmentRow): string | null => {
    const id = row.backstage_creator_id?.toString().trim();
    if (id) return `id:${id}`;
    const username = row.tiktok_username?.toString().trim().toLowerCase();
    if (username) return `user:${username}`;
    return null;
  };

  for (const row of primary) {
    const key = mergeKey(row);
    if (key) merged.set(key, { ...row });
  }

  for (const row of secondary) {
    const key = mergeKey(row);
    if (!key) continue;
    merged.set(key, { ...merged.get(key), ...row });
  }

  return Array.from(merged.values());
}

// MARK: - Read Enrichment

export async function readManualEnrichmentTab(
  config: GathererConfig
): Promise<ManualEnrichmentRow[]> {
  const sheets = createGoogleSheetsClient(config);
  const tabRows: ManualEnrichmentRow[][] = [];

  for (const tabName of MANUAL_ENRICHMENT_TABS) {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.googleMasterSheetId,
      range: `${tabName}!A:Z`,
    });

    const rows = (response.data.values ?? []) as string[][];
    const parsed = readManualEnrichmentParseRows(rows);
    tabRows.push(parsed);
    logInfo(`Loaded ${parsed.length} rows from ${tabName}`, "readManualEnrichment");
  }

  const combined = readManualEnrichmentMergeRows(tabRows[0] ?? [], tabRows[1] ?? []);
  logInfo(`Combined ${combined.length} manual enrichment rows`, "readManualEnrichment");
  return combined;
}

// Suggestions For Features and Additions Later:
// - Validate enrichment schema on read
