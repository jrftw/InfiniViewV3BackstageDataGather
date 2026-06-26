/**
 * Filename: publishMasterCreatorsTab.ts
 * Purpose: Publish creator rows to 01_Latest_Master_Creators (incremental by default).
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-26
 * Dependencies: masterSheetIncrementalPublish, sheetDataHelpers
 * Platform Compatibility: Node.js 18+
 */

import { GathererConfig } from "../config";
import { createGoogleSheetsClient } from "./sheetsClient";
import { sheetDataCreatorsToValues } from "./sheetDataHelpers";
import { SHEET_TABS } from "./updateSheetTabs";
import { CombinedCreatorRecord } from "../processing/mergeBackstageReports";
import { freezeGoogleSheetHeaderRow } from "./sheetFreezeHeaders";
import { logInfo } from "../logging/logger";
import {
  MasterSheetIncrementalPublishResult,
  publishMasterCreatorsTabIncremental,
} from "./masterSheetIncrementalPublish";

// MARK: - Full Overwrite (fallback / first-time)

export async function publishMasterCreatorsTabFullOverwrite(
  config: GathererConfig,
  creators: CombinedCreatorRecord[]
): Promise<void> {
  if (!config.googleMasterSheetId) {
    return;
  }

  const sheets = createGoogleSheetsClient(config);
  const tabName = SHEET_TABS.latestMaster;
  const values = sheetDataCreatorsToValues(creators);

  await sheets.spreadsheets.values.clear({
    spreadsheetId: config.googleMasterSheetId,
    range: `${tabName}!A:ZZ`,
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: config.googleMasterSheetId,
    range: `${tabName}!A1`,
    valueInputOption: "RAW",
    requestBody: { values },
  });

  await freezeGoogleSheetHeaderRow(config, config.googleMasterSheetId, tabName);
  logInfo(`Full overwrite published ${creators.length} creators to ${tabName}`, "publishMasterCreatorsTab");
}

// MARK: - Publish API

export async function publishMasterCreatorsTab(
  config: GathererConfig,
  creators: CombinedCreatorRecord[]
): Promise<MasterSheetIncrementalPublishResult> {
  return publishMasterCreatorsTabIncremental(config, creators);
}

// Suggestions For Features and Additions Later:
// - Expose publish stats on dashboard API
