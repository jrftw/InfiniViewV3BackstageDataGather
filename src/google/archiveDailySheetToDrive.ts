/**
 * Filename: archiveDailySheetToDrive.ts
 * Purpose: On daily final run, create a dated Google Sheet + files in the daily archive Drive folder.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-23
 * Dependencies: googleapis
 * Platform Compatibility: Node.js 18+
 */

import fs from "fs";
import path from "path";
import { GathererConfig } from "../config";
import { createGoogleDriveClient } from "./driveClient";
import { createGoogleSheetsClient } from "./sheetsClient";
import { sheetDataCreatorsToValues, sheetDataRowsToValues } from "./sheetDataHelpers";
import { CombinedCreatorRecord } from "../processing/mergeBackstageReports";
import { ParsedBackstageRow } from "../processing/parseWorkbook";
import { ImportSummaryData } from "../logging/importSummary";
import { GathererRunContext } from "../jobs/gathererRunContext";
import { freezeGoogleSheetHeaderRows } from "./sheetFreezeHeaders";
import { logInfo } from "../logging/logger";

// MARK: - Archive Tab Names

const DAILY_ARCHIVE_TABS = {
  combined: "Combined Creators",
  performance: "Performance Raw",
  management: "Management Raw",
} as const;

export interface DailyDriveArchiveResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
  dateFolderId: string;
  spreadsheetTitle: string;
}

// MARK: - Drive Helpers

async function archiveDailyEnsureDateFolder(
  config: GathererConfig,
  archiveFolderId: string,
  dateKey: string
): Promise<string> {
  const drive = createGoogleDriveClient(config);
  const query = `'${archiveFolderId}' in parents and name='${dateKey}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

  const existing = await drive.files.list({
    q: query,
    fields: "files(id, name)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  if (existing.data.files?.[0]?.id) {
    return existing.data.files[0].id;
  }

  const created = await drive.files.create({
    requestBody: {
      name: dateKey,
      mimeType: "application/vnd.google-apps.folder",
      parents: [archiveFolderId],
    },
    fields: "id",
    supportsAllDrives: true,
  });

  return created.data.id!;
}

async function archiveDailyFindSpreadsheetInFolder(
  config: GathererConfig,
  folderId: string,
  title: string
): Promise<string | null> {
  const drive = createGoogleDriveClient(config);
  const query = `'${folderId}' in parents and name='${title}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`;

  const existing = await drive.files.list({
    q: query,
    fields: "files(id, name)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  return existing.data.files?.[0]?.id ?? null;
}

// MARK: - Create / Update Archive Spreadsheet

export async function archiveDailyCreatorsToDriveFolder(
  config: GathererConfig,
  runContext: GathererRunContext,
  creators: CombinedCreatorRecord[],
  performanceRows: ParsedBackstageRow[],
  managementRows: ParsedBackstageRow[],
  summary: ImportSummaryData
): Promise<DailyDriveArchiveResult | null> {
  if (!runContext.shouldUploadDailyArchiveToDrive) {
    return null;
  }

  if (!config.googleDriveDailyArchiveFolderId) {
    logInfo("Daily Drive archive folder not configured — skipping sheet copy", "archiveDailySheetToDrive");
    return null;
  }

  const drive = createGoogleDriveClient(config);
  const sheets = createGoogleSheetsClient(config);
  const dateFolderId = await archiveDailyEnsureDateFolder(
    config,
    config.googleDriveDailyArchiveFolderId,
    runContext.dailyDateKey
  );

  const spreadsheetTitle = `InfiniView Creators ${runContext.dailyDateKey}`;
  let spreadsheetId = await archiveDailyFindSpreadsheetInFolder(
    config,
    dateFolderId,
    spreadsheetTitle
  );

  if (!spreadsheetId) {
    const created = await drive.files.create({
      requestBody: {
        name: spreadsheetTitle,
        mimeType: "application/vnd.google-apps.spreadsheet",
        parents: [dateFolderId],
      },
      fields: "id, webViewLink",
      supportsAllDrives: true,
    });

    spreadsheetId = created.data.id!;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: { sheetId: 0, title: DAILY_ARCHIVE_TABS.combined },
              fields: "title",
            },
          },
          { addSheet: { properties: { title: DAILY_ARCHIVE_TABS.performance } } },
          { addSheet: { properties: { title: DAILY_ARCHIVE_TABS.management } } },
        ],
      },
    });

    logInfo(`Created daily archive spreadsheet: ${spreadsheetTitle}`, "archiveDailySheetToDrive", {
      spreadsheetId,
    });
  } else {
    logInfo(`Updating existing daily archive spreadsheet: ${spreadsheetTitle}`, "archiveDailySheetToDrive", {
      spreadsheetId,
    });
  }

  const tabValues: Array<{ tab: string; values: string[][] }> = [
    { tab: DAILY_ARCHIVE_TABS.combined, values: sheetDataCreatorsToValues(creators) },
    { tab: DAILY_ARCHIVE_TABS.performance, values: sheetDataRowsToValues(performanceRows) },
    { tab: DAILY_ARCHIVE_TABS.management, values: sheetDataRowsToValues(managementRows) },
  ];

  for (const { tab, values } of tabValues) {
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `'${tab}'!A:ZZ`,
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${tab}'!A1`,
      valueInputOption: "RAW",
      requestBody: { values },
    });
  }

  await freezeGoogleSheetHeaderRows(config, spreadsheetId, [
    DAILY_ARCHIVE_TABS.combined,
    DAILY_ARCHIVE_TABS.performance,
    DAILY_ARCHIVE_TABS.management,
  ]);

  const fileMeta = await drive.files.get({
    fileId: spreadsheetId,
    fields: "webViewLink",
    supportsAllDrives: true,
  });

  logInfo(
    `Daily archive sheet ready for ${runContext.dailyDateKey} (${summary.combinedCreatorCount} creators)`,
    "archiveDailySheetToDrive",
    {
      runId: summary.runId,
      spreadsheetId,
      url: fileMeta.data.webViewLink,
    }
  );

  return {
    spreadsheetId,
    spreadsheetUrl: fileMeta.data.webViewLink ?? "",
    dateFolderId,
    spreadsheetTitle,
  };
}

// MARK: - Upload Files To Daily Archive Folder

export async function archiveDailyUploadFilesToDriveFolder(
  config: GathererConfig,
  runContext: GathererRunContext,
  localFilePaths: string[]
): Promise<void> {
  if (!runContext.shouldUploadDailyArchiveToDrive || !config.googleDriveDailyArchiveFolderId) {
    return;
  }

  const drive = createGoogleDriveClient(config);
  const dateFolderId = await archiveDailyEnsureDateFolder(
    config,
    config.googleDriveDailyArchiveFolderId,
    runContext.dailyDateKey
  );

  for (const filePath of localFilePaths) {
    const fileName = path.basename(filePath);
    const mimeType = fileName.endsWith(".json")
      ? "application/json"
      : fileName.endsWith(".csv")
        ? "text/csv"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    const existing = await drive.files.list({
      q: `'${dateFolderId}' in parents and name='${fileName}' and trashed=false`,
      fields: "files(id)",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const existingId = existing.data.files?.[0]?.id;

    if (existingId) {
      await drive.files.update({
        fileId: existingId,
        media: { mimeType, body: fs.createReadStream(filePath) },
        supportsAllDrives: true,
      });
      logInfo(`Updated daily archive file: ${fileName}`, "archiveDailySheetToDrive");
    } else {
      await drive.files.create({
        requestBody: { name: fileName, parents: [dateFolderId] },
        media: { mimeType, body: fs.createReadStream(filePath) },
        supportsAllDrives: true,
      });
      logInfo(`Uploaded daily archive file: ${fileName}`, "archiveDailySheetToDrive");
    }
  }
}

// Suggestions For Features and Additions Later:
// - Copy master spreadsheet instead of rebuilding tabs
