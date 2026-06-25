/**
 * Filename: readExternalCrmSheet.ts
 * Purpose: Read creator CRM fields from the external CRM Google Sheet (leftmost tab).
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-24
 * Dependencies: googleapis, crmEnrichmentFields
 * Platform Compatibility: Node.js 18+
 */

import { GathererConfig } from "../config";
import { createGoogleSheetsClient } from "./sheetsClient";
import { resolveGoogleSheetTabName } from "./resolveGoogleSheetTab";
import {
  CrmSheetEnrichmentRow,
  crmEnrichmentBuildEmptyRow,
  crmEnrichmentBuildHeaderAliases,
} from "../processing/crmEnrichmentFields";
import { logInfo, logWarn } from "../logging/logger";

// MARK: - Header Aliases (external sheet → internal)

const READ_EXTERNAL_CRM_SHEET_HEADER_ALIASES = crmEnrichmentBuildHeaderAliases();

// MARK: - Header Helpers

function readExternalCrmSheetNormalizeHeader(raw: string): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function readExternalCrmSheetMapHeader(raw: string): keyof CrmSheetEnrichmentRow | null {
  const normalized = readExternalCrmSheetNormalizeHeader(raw);
  return READ_EXTERNAL_CRM_SHEET_HEADER_ALIASES[normalized] ?? null;
}

function readExternalCrmSheetParseRows(rows: string[][]): CrmSheetEnrichmentRow[] {
  if (rows.length < 2) {
    return [];
  }

  const headerRow = rows[0];
  const columnMap: Array<{ index: number; field: keyof CrmSheetEnrichmentRow }> = [];

  headerRow.forEach((header, index) => {
    const field = readExternalCrmSheetMapHeader(String(header));
    if (field) {
      columnMap.push({ index, field });
    }
  });

  if (columnMap.length === 0) {
    logWarn(
      "External CRM sheet has no recognized columns (expected cid, userId, email, phone, …)",
      "readExternalCrmSheet"
    );
    return [];
  }

  const parsed: CrmSheetEnrichmentRow[] = [];

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const record = crmEnrichmentBuildEmptyRow();
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

// MARK: - Tab Resolution

async function readExternalCrmSheetResolveTabName(
  config: GathererConfig
): Promise<{ tabName: string; spreadsheetTitle: string }> {
  return resolveGoogleSheetTabName(config, {
    spreadsheetId: config.googleCrmSheetId,
    tabTitle: config.googleCrmSheetTab || undefined,
    preferLeftmost: !config.googleCrmSheetTab,
  });
}

// MARK: - Public Reader

export async function readExternalCrmSheetTab(config: GathererConfig): Promise<CrmSheetEnrichmentRow[]> {
  if (!config.googleCrmSheetId) {
    return [];
  }

  const sheets = createGoogleSheetsClient(config);
  const { tabName, spreadsheetTitle } = await readExternalCrmSheetResolveTabName(config);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.googleCrmSheetId,
    range: `'${tabName.replace(/'/g, "''")}'!A:ZZ`,
  });

  const rows = (response.data.values ?? []) as string[][];
  const parsed = readExternalCrmSheetParseRows(rows);

  logInfo(
    `Loaded ${parsed.length} CRM rows from "${spreadsheetTitle}" tab "${tabName}" (leftmost when unset)`,
    "readExternalCrmSheet"
  );

  return parsed;
}

// Suggestions For Features and Additions Later:
// - Support reading multiple CRM tabs and merging newest-first
