/**
 * Filename: gathererSnapshotHistoryDriveScanner.ts
 * Purpose: Scan Google Drive History folder for daily archive folders and spreadsheets.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-07-09
 * Dependencies: googleapis, config, logger
 * Platform Compatibility: Node.js 18+
 */

import { GathererConfig } from "../config";
import { createGoogleDriveClient } from "../google/driveClient";
import { logDebug, logInfo } from "../logging/logger";

// MARK: Types

export interface GathererSnapshotHistoryArchiveEntry {
  snapshotDate: string;
  dateFolderId: string;
  spreadsheetId: string;
  spreadsheetTitle: string;
  sourceFileName: string;
}

const GATHERER_SNAPSHOT_HISTORY_DRIVE_SCANNER_SOURCE = "gathererSnapshotHistoryDriveScanner";

const GATHERER_SNAPSHOT_HISTORY_DATE_FOLDER_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// MARK: Helpers

function gathererSnapshotHistoryExpectedSpreadsheetTitle(snapshotDate: string): string {
  return `InfiniView Creators ${snapshotDate}`;
}

function gathererSnapshotHistoryCompareDateKeys(a: string, b: string): number {
  return a.localeCompare(b);
}

// MARK: Scan API

export async function gathererSnapshotHistoryListArchiveEntries(
  config: GathererConfig
): Promise<GathererSnapshotHistoryArchiveEntry[]> {
  const archiveFolderId = config.googleDriveDailyArchiveFolderId.trim();
  if (!archiveFolderId) {
    throw new Error("GOOGLE_DRIVE_DAILY_ARCHIVE_FOLDER_ID is not configured");
  }

  const drive = createGoogleDriveClient(config);
  const entries: GathererSnapshotHistoryArchiveEntry[] = [];

  let pageToken: string | undefined;

  do {
    const response = await drive.files.list({
      q: `'${archiveFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "nextPageToken, files(id, name)",
      pageSize: 200,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageToken,
    });

    const folders = response.data.files ?? [];

    for (const folder of folders) {
      const folderName = String(folder.name ?? "").trim();
      if (!GATHERER_SNAPSHOT_HISTORY_DATE_FOLDER_PATTERN.test(folderName)) {
        continue;
      }

      const expectedTitle = gathererSnapshotHistoryExpectedSpreadsheetTitle(folderName);
      const spreadsheetQuery = `'${folder.id}' in parents and name='${expectedTitle.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`;

      const spreadsheetList = await drive.files.list({
        q: spreadsheetQuery,
        fields: "files(id, name)",
        pageSize: 5,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      const spreadsheet = spreadsheetList.data.files?.[0];
      if (!spreadsheet?.id) {
        logDebug("Daily archive folder missing expected spreadsheet", GATHERER_SNAPSHOT_HISTORY_DRIVE_SCANNER_SOURCE, {
          snapshotDate: folderName,
          expectedTitle,
        });
        continue;
      }

      entries.push({
        snapshotDate: folderName,
        dateFolderId: folder.id!,
        spreadsheetId: spreadsheet.id,
        spreadsheetTitle: String(spreadsheet.name ?? expectedTitle),
        sourceFileName: expectedTitle,
      });
    }

    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  entries.sort((left, right) =>
    gathererSnapshotHistoryCompareDateKeys(left.snapshotDate, right.snapshotDate)
  );

  logInfo(
    `Found ${entries.length} daily archive spreadsheets in Drive History folder`,
    GATHERER_SNAPSHOT_HISTORY_DRIVE_SCANNER_SOURCE
  );

  return entries;
}

export async function gathererSnapshotHistoryFindArchiveEntryForDate(
  config: GathererConfig,
  snapshotDate: string
): Promise<GathererSnapshotHistoryArchiveEntry | null> {
  const entries = await gathererSnapshotHistoryListArchiveEntries(config);
  return entries.find((entry) => entry.snapshotDate === snapshotDate) ?? null;
}

// Suggestions For Features and Additions Later:
// - Cache folder listing for large history folders
// - Support flat spreadsheet layout without date subfolders
