/**
 * Filename: updateSheetTabs.ts
 * Purpose: Update Google Sheet tabs — latest master, daily day sheet, import log append.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-24
 * Dependencies: googleapis
 * Platform Compatibility: Node.js 18+
 */

import { GathererConfig } from "../config";
import { createGoogleSheetsClient } from "./sheetsClient";
import { sheetDataCreatorsToValues, sheetDataRowsToValues } from "./sheetDataHelpers";
import { CombinedCreatorRecord } from "../processing/mergeBackstageReports";
import { ParsedBackstageRow } from "../processing/parseWorkbook";
import { ImportSummaryData } from "../logging/importSummary";
import { GathererRunContext } from "../jobs/gathererRunContext";
import { freezeGoogleSheetHeaderRow } from "./sheetFreezeHeaders";
import { ensureGathererSyncSheetTabs, appendGathererSyncLogRow, SyncLogAppendRow } from "./syncSheetTabs";
import { publishMasterCreatorsTabIncremental } from "./masterSheetIncrementalPublish";
import { logInfo } from "../logging/logger";

// MARK: - Tab Names

export const SHEET_TABS = {
  latestMaster: "01_Latest_Master_Creators",
  performanceRaw: "02_Backstage_Performance_Raw",
  managementRaw: "03_Backstage_Management_Raw",
  importLog: "04_Import_Log",
  errors: "05_Export_Errors",
  unmatched: "06_Unmatched_Rows",
  changeLog: "07_Change_Log",
  crmLinkQueue: "08_CRM_Link_Queue",
  emailPhoneEnrichment: "09_Email_Phone_Enrichment",
  managerAssignments: "10_Manager_Assignments",
  legacyHistory: "11_Legacy_History",
} as const;

const PROTECTED_FROM_OVERWRITE = new Set<string>([
  SHEET_TABS.emailPhoneEnrichment,
  SHEET_TABS.managerAssignments,
  SHEET_TABS.legacyHistory,
]);

const IMPORT_LOG_HEADERS = [
  "run_id",
  "started_at",
  "finished_at",
  "status",
  "creator_count",
  "unmatched_count",
  "errors",
  "run_trigger",
  "scheduled_slot",
  "is_daily_final",
  "daily_date",
  "daily_sheet_tab",
];

// MARK: - Helpers

async function ensureSheetTabExists(config: GathererConfig, tabName: string): Promise<void> {
  const sheets = createGoogleSheetsClient(config);
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: config.googleMasterSheetId,
    fields: "sheets.properties.title",
  });

  const existingTitles =
    meta.data.sheets?.map((sheet) => sheet.properties?.title).filter(Boolean) ?? [];

  if (existingTitles.includes(tabName)) {
    return;
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: config.googleMasterSheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title: tabName } } }],
    },
  });

  logInfo(`Created sheet tab: ${tabName}`, "updateSheetTabs");
}

async function overwriteSheetTab(
  config: GathererConfig,
  tabName: string,
  values: string[][]
): Promise<void> {
  if (PROTECTED_FROM_OVERWRITE.has(tabName)) {
    logInfo(`Skipping protected tab: ${tabName}`, "updateSheetTabs");
    return;
  }

  await ensureSheetTabExists(config, tabName);
  const sheets = createGoogleSheetsClient(config);

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

  logInfo(`Updated sheet tab: ${tabName}`, "updateSheetTabs");
}

async function appendImportLogRow(
  config: GathererConfig,
  summary: ImportSummaryData,
  runContext: GathererRunContext
): Promise<void> {
  await ensureSheetTabExists(config, SHEET_TABS.importLog);
  const sheets = createGoogleSheetsClient(config);

  const headerCheck = await sheets.spreadsheets.values.get({
    spreadsheetId: config.googleMasterSheetId,
    range: `${SHEET_TABS.importLog}!A1:A1`,
  });

  if (!headerCheck.data.values?.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: config.googleMasterSheetId,
      range: `${SHEET_TABS.importLog}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [IMPORT_LOG_HEADERS] },
    });
  }

  const scheduledSlotLabel =
    runContext.scheduledSlotIndex !== null
      ? `${runContext.scheduledSlotIndex}/${runContext.scheduledSlotTotal}`
      : "manual";

  const logRow = [
    summary.runId,
    summary.startedAt,
    summary.finishedAt,
    summary.success ? "SUCCESS" : "FAILED",
    String(summary.combinedCreatorCount),
    String(summary.unmatchedPerformanceCount + summary.unmatchedManagementCount),
    summary.errors.join("; "),
    runContext.runTrigger,
    scheduledSlotLabel,
    runContext.isDailyFinalRun ? "YES" : "NO",
    runContext.dailyDateKey,
    runContext.dailySheetTabName,
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: config.googleMasterSheetId,
    range: `${SHEET_TABS.importLog}!A:A`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [logRow] },
  });

  await freezeGoogleSheetHeaderRow(config, config.googleMasterSheetId, SHEET_TABS.importLog);

  logInfo(`Appended import log row (${runContext.runTrigger})`, "updateSheetTabs");
}

// MARK: - Update All Tabs

export async function updateGoogleSheetTabs(
  config: GathererConfig,
  creators: CombinedCreatorRecord[],
  performanceRows: ParsedBackstageRow[],
  managementRows: ParsedBackstageRow[],
  unmatchedPerformance: ParsedBackstageRow[],
  unmatchedManagement: ParsedBackstageRow[],
  summary: ImportSummaryData,
  runContext: GathererRunContext,
  syncLog?: SyncLogAppendRow
): Promise<void> {
  await ensureGathererSyncSheetTabs(config);

  const creatorValues = sheetDataCreatorsToValues(creators);
  const masterPublishResult = await publishMasterCreatorsTabIncremental(config, creators);

  if (masterPublishResult.skippedNoChanges) {
    logInfo(
      `Skipped master tab rewrite — ${masterPublishResult.rowsUnchanged} creators unchanged`,
      "updateSheetTabs"
    );
  }

  if (config.gathererUpdateMasterDailyTab) {
    await overwriteSheetTab(config, runContext.dailySheetTabName, creatorValues);
  }

  await overwriteSheetTab(config, SHEET_TABS.performanceRaw, sheetDataRowsToValues(performanceRows));
  await overwriteSheetTab(config, SHEET_TABS.managementRaw, sheetDataRowsToValues(managementRows));

  await appendImportLogRow(config, summary, runContext);

  const unmatchedCombined = [
    ...unmatchedPerformance.map((r) => ({ ...r, _unmatched_source: "performance" })),
    ...unmatchedManagement.map((r) => ({ ...r, _unmatched_source: "management" })),
  ];
  await overwriteSheetTab(config, SHEET_TABS.unmatched, sheetDataRowsToValues(unmatchedCombined));

  const errorRows = summary.errors.map((e) => [summary.runId, e]);
  await overwriteSheetTab(config, SHEET_TABS.errors, [
    ["run_id", "error"],
    ...(errorRows.length ? errorRows : [["", "none"]]),
  ]);

  const crmQueue = creators
    .filter((c) => c.email || c.phone)
    .filter((c) => !c.crm_contact_id)
    .map((c) => [
      c.backstage_creator_id ?? "",
      c.tiktok_username ?? "",
      c.email ?? "",
      c.phone ?? "",
      "pending",
    ]);

  await overwriteSheetTab(config, SHEET_TABS.crmLinkQueue, [
    ["backstage_creator_id", "tiktok_username", "email", "phone", "status"],
    ...crmQueue,
  ]);

  if (syncLog) {
    await appendGathererSyncLogRow(config, syncLog);
  }
}

// Suggestions For Features and Additions Later:
// - Append profile_check jobs to Sync_Queue when profile_needs_review = yes
// - Master tab updates remain batch + header-name based via sheetDataCreatorsToValues
