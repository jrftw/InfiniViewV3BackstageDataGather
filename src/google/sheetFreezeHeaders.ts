/**
 * Filename: sheetFreezeHeaders.ts
 * Purpose: Freeze header row on Google Sheet tabs so sorting keeps column titles visible.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-23
 * Dependencies: googleapis
 * Platform Compatibility: Node.js 18+
 */

import { GathererConfig } from "../config";
import { createGoogleSheetsClient } from "./sheetsClient";
import { logDebug } from "../logging/logger";

// MARK: - Resolve Tab ID

async function freezeSheetResolveTabId(
  config: GathererConfig,
  spreadsheetId: string,
  tabName: string
): Promise<number | null> {
  const sheets = createGoogleSheetsClient(config);
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title)",
  });

  const match = meta.data.sheets?.find((sheet) => sheet.properties?.title === tabName);
  const sheetId = match?.properties?.sheetId;

  return sheetId === undefined || sheetId === null ? null : sheetId;
}

// MARK: - Freeze Header Row

export async function freezeGoogleSheetHeaderRow(
  config: GathererConfig,
  spreadsheetId: string,
  tabName: string,
  frozenRowCount: number = 1
): Promise<void> {
  const sheetId = await freezeSheetResolveTabId(config, spreadsheetId, tabName);
  if (sheetId === null) {
    logDebug(`Could not freeze headers — tab not found: ${tabName}`, "sheetFreezeHeaders");
    return;
  }

  const sheets = createGoogleSheetsClient(config);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateSheetProperties: {
            properties: {
              sheetId,
              gridProperties: { frozenRowCount },
            },
            fields: "gridProperties.frozenRowCount",
          },
        },
      ],
    },
  });

  logDebug(`Froze header row on tab: ${tabName}`, "sheetFreezeHeaders");
}

export async function freezeGoogleSheetHeaderRows(
  config: GathererConfig,
  spreadsheetId: string,
  tabNames: string[],
  frozenRowCount: number = 1
): Promise<void> {
  const sheets = createGoogleSheetsClient(config);
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title)",
  });

  const requests: Array<{
    updateSheetProperties: {
      properties: { sheetId: number; gridProperties: { frozenRowCount: number } };
      fields: string;
    };
  }> = [];

  for (const tabName of tabNames) {
    const match = meta.data.sheets?.find((sheet) => sheet.properties?.title === tabName);
    const sheetId = match?.properties?.sheetId;
    if (sheetId === undefined || sheetId === null) {
      continue;
    }

    requests.push({
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: { frozenRowCount },
        },
        fields: "gridProperties.frozenRowCount",
      },
    });
  }

  if (requests.length === 0) {
    return;
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });

  logDebug(`Froze header rows on ${requests.length} tab(s)`, "sheetFreezeHeaders");
}

// Suggestions For Features and Additions Later:
// - Bold header row styling via repeatCell
