/**
 * Filename: syncSheetTabs.ts
 * Purpose: Hidden Sync_Queue and Sync_Log tabs for profile/login job queue and debugging.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-24
 * Dependencies: googleapis
 * Platform Compatibility: Node.js 18+
 */

import { GathererConfig } from "../config";
import { createGoogleSheetsClient } from "./sheetsClient";
import { freezeGoogleSheetHeaderRow } from "./sheetFreezeHeaders";
import { logInfo } from "../logging/logger";

// MARK: - Tab Names

export const SYNC_SHEET_TABS = {
  syncQueue: "Sync_Queue",
  syncLog: "Sync_Log",
} as const;

export const SYNC_QUEUE_HEADERS = [
  "job_id",
  "job_type",
  "backstage_creator_id",
  "tiktok_username",
  "normalized_username",
  "priority",
  "status",
  "requested_at",
  "not_before_at",
  "attempts",
  "last_error",
  "locked_at",
  "completed_at",
] as const;

export const SYNC_LOG_HEADERS = [
  "run_id",
  "run_type",
  "started_at",
  "finished_at",
  "status",
  "rows_read",
  "rows_changed",
  "rows_failed",
  "warnings_count",
  "error_summary",
  "source_file",
  "created_by",
] as const;

export interface SyncLogAppendRow {
  runId: string;
  runType: string;
  startedAt: string;
  finishedAt: string;
  status: string;
  rowsRead: number;
  rowsChanged: number;
  rowsFailed: number;
  warningsCount: number;
  errorSummary: string;
  sourceFile: string;
  createdBy: string;
}

// MARK: - Sheet Helpers

async function syncSheetTabsGetSheetId(
  config: GathererConfig,
  tabTitle: string
): Promise<number | null> {
  const sheets = createGoogleSheetsClient(config);
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: config.googleMasterSheetId,
    fields: "sheets.properties(sheetId,title)",
  });

  const match = meta.data.sheets?.find((sheet) => sheet.properties?.title === tabTitle);
  return match?.properties?.sheetId ?? null;
}

async function syncSheetTabsEnsureHiddenTab(
  config: GathererConfig,
  tabTitle: string,
  headers: readonly string[]
): Promise<void> {
  const sheets = createGoogleSheetsClient(config);
  let sheetId = await syncSheetTabsGetSheetId(config, tabTitle);

  if (sheetId === null) {
    const createResult = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: config.googleMasterSheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: tabTitle,
                hidden: true,
              },
            },
          },
        ],
      },
    });

    sheetId = createResult.data.replies?.[0]?.addSheet?.properties?.sheetId ?? null;
    logInfo(`Created hidden sheet tab: ${tabTitle}`, "syncSheetTabs");
  } else {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: config.googleMasterSheetId,
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: {
                sheetId,
                hidden: true,
              },
              fields: "hidden",
            },
          },
        ],
      },
    });
  }

  const headerCheck = await sheets.spreadsheets.values.get({
    spreadsheetId: config.googleMasterSheetId,
    range: `'${tabTitle.replace(/'/g, "''")}'!A1:A1`,
  });

  if (!headerCheck.data.values?.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: config.googleMasterSheetId,
      range: `'${tabTitle.replace(/'/g, "''")}'!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [[...headers]] },
    });
    await freezeGoogleSheetHeaderRow(config, config.googleMasterSheetId, tabTitle);
    logInfo(`Initialized headers on hidden tab: ${tabTitle}`, "syncSheetTabs");
  }
}

// MARK: - Public API

export async function ensureGathererSyncSheetTabs(config: GathererConfig): Promise<void> {
  if (!config.googleMasterSheetId) {
    return;
  }

  await syncSheetTabsEnsureHiddenTab(config, SYNC_SHEET_TABS.syncQueue, SYNC_QUEUE_HEADERS);
  await syncSheetTabsEnsureHiddenTab(config, SYNC_SHEET_TABS.syncLog, SYNC_LOG_HEADERS);
}

export async function appendGathererSyncLogRow(
  config: GathererConfig,
  row: SyncLogAppendRow
): Promise<void> {
  if (!config.googleMasterSheetId) {
    return;
  }

  await ensureGathererSyncSheetTabs(config);

  const sheets = createGoogleSheetsClient(config);
  const logRow = [
    row.runId,
    row.runType,
    row.startedAt,
    row.finishedAt,
    row.status,
    String(row.rowsRead),
    String(row.rowsChanged),
    String(row.rowsFailed),
    String(row.warningsCount),
    row.errorSummary,
    row.sourceFile,
    row.createdBy,
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: config.googleMasterSheetId,
    range: `'${SYNC_SHEET_TABS.syncLog.replace(/'/g, "''")}'!A:A`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [logRow] },
  });

  logInfo(`Appended Sync_Log row (${row.runType})`, "syncSheetTabs");
}

// Suggestions For Features and Additions Later:
// - Append profile_check jobs to Sync_Queue when profile_needs_review = yes
