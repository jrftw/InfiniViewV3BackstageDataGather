/**
 * Filename: gathererSnapshotHistorySheetReader.ts
 * Purpose: Read Combined Creators tab from a daily Drive archive spreadsheet.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-07-09
 * Dependencies: googleapis, readMasterCreatorsSheet, mergeBackstageReports
 * Platform Compatibility: Node.js 18+
 */

import { GathererConfig } from "../config";
import { createGoogleSheetsClient } from "../google/sheetsClient";
import { readMasterCreatorsSheetParseCombinedCreatorsValues } from "../google/readMasterCreatorsSheet";
import { CombinedCreatorRecord } from "../processing/mergeBackstageReports";
import { logInfo } from "../logging/logger";

const GATHERER_SNAPSHOT_HISTORY_SHEET_READER_SOURCE = "gathererSnapshotHistorySheetReader";

// MARK: Read API

export async function gathererSnapshotHistoryReadCombinedCreatorsFromSpreadsheet(
  config: GathererConfig,
  spreadsheetId: string,
  snapshotDate: string
): Promise<CombinedCreatorRecord[]> {
  const sheets = createGoogleSheetsClient(config);
  const tabName = config.gathererSnapshotHistoryCombinedTab;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tabName.replace(/'/g, "''")}'!A:ZZ`,
  });

  const rows = (response.data.values ?? []) as string[][];
  const creators = readMasterCreatorsSheetParseCombinedCreatorsValues(rows);

  logInfo(
    `Loaded ${creators.length} creators from ${tabName} for ${snapshotDate}`,
    GATHERER_SNAPSHOT_HISTORY_SHEET_READER_SOURCE,
    { spreadsheetId }
  );

  return creators;
}

// Suggestions For Features and Additions Later:
// - Fallback to local xlsx when Drive API is unavailable
