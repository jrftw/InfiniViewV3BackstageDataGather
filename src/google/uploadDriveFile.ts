/**
 * Filename: uploadDriveFile.ts
 * Purpose: Upload local files to Google Drive — daily archive folder on final scheduled run.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-23
 * Dependencies: googleapis
 * Platform Compatibility: Node.js 18+
 */

import fs from "fs";
import path from "path";
import { GathererConfig } from "../config";
import { createGoogleDriveClient } from "./driveClient";
import { gathererFormatDateFolder } from "../utils/dates";
import { GathererRunContext } from "../jobs/gathererRunContext";
import { CombinedCreatorRecord } from "../processing/mergeBackstageReports";
import { ParsedBackstageRow } from "../processing/parseWorkbook";
import { ImportSummaryData } from "../logging/importSummary";
import {
  archiveDailyCreatorsToDriveFolder,
  archiveDailyUploadFilesToDriveFolder,
  DailyDriveArchiveResult,
} from "./archiveDailySheetToDrive";
import { logInfo, logDebug } from "../logging/logger";

// MARK: - Folder Cache

const driveFolderCache = new Map<string, string>();

// MARK: - Legacy Folder Helpers

async function ensureDriveSubfolder(
  config: GathererConfig,
  parentId: string,
  folderName: string
): Promise<string> {
  const cacheKey = `${parentId}/${folderName}`;
  if (driveFolderCache.has(cacheKey)) {
    return driveFolderCache.get(cacheKey)!;
  }

  const drive = createGoogleDriveClient(config);
  const query = `'${parentId}' in parents and name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

  const existing = await drive.files.list({
    q: query,
    fields: "files(id, name)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  if (existing.data.files && existing.data.files.length > 0 && existing.data.files[0].id) {
    const id = existing.data.files[0].id;
    driveFolderCache.set(cacheKey, id);
    return id;
  }

  const created = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
    supportsAllDrives: true,
  });

  const newId = created.data.id!;
  driveFolderCache.set(cacheKey, newId);
  logDebug(`Created Drive folder: ${folderName}`, "uploadDriveFile");
  return newId;
}

function uploadDriveResolveMimeType(fileName: string): string {
  if (fileName.endsWith(".json")) return "application/json";
  if (fileName.endsWith(".csv")) return "text/csv";
  return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
}

async function upsertFileInDriveFolder(
  config: GathererConfig,
  localFilePath: string,
  parentFolderId: string
): Promise<string> {
  const drive = createGoogleDriveClient(config);
  const fileName = path.basename(localFilePath);
  const mimeType = uploadDriveResolveMimeType(fileName);

  const existing = await drive.files.list({
    q: `'${parentFolderId}' in parents and name='${fileName}' and trashed=false`,
    fields: "files(id, name)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const existingId = existing.data.files?.[0]?.id;

  if (existingId) {
    const updated = await drive.files.update({
      fileId: existingId,
      media: {
        mimeType,
        body: fs.createReadStream(localFilePath),
      },
      fields: "id, webViewLink",
      supportsAllDrives: true,
    });
    logInfo(`Updated Drive file: ${fileName}`, "uploadDriveFile", { fileId: updated.data.id });
    return updated.data.id ?? existingId;
  }

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [parentFolderId],
    },
    media: {
      mimeType,
      body: fs.createReadStream(localFilePath),
    },
    fields: "id, webViewLink",
    supportsAllDrives: true,
  });

  logInfo(`Uploaded to Drive: ${fileName}`, "uploadDriveFile", {
    fileId: response.data.id,
  });

  return response.data.id ?? "";
}

export async function uploadFileToGoogleDrive(
  config: GathererConfig,
  localFilePath: string,
  driveCategory: "Raw Backstage Exports" | "Combined Outputs" | "Import Summaries"
): Promise<string> {
  const dateFolder = gathererFormatDateFolder();
  const rootId = config.googleDriveFolderId;

  const categoryFolderId = await ensureDriveSubfolder(config, rootId, driveCategory);
  const dateFolderId = await ensureDriveSubfolder(config, categoryFolderId, dateFolder);

  return upsertFileInDriveFolder(config, localFilePath, dateFolderId);
}

// MARK: - Daily Archive Upload

export interface GathererDriveUploadContext {
  config: GathererConfig;
  files: string[];
  runContext: GathererRunContext;
  creators: CombinedCreatorRecord[];
  performanceRows: ParsedBackstageRow[];
  managementRows: ParsedBackstageRow[];
  summary: ImportSummaryData;
}

export interface GathererDriveUploadResult {
  uploaded: boolean;
  dailyArchive: DailyDriveArchiveResult | null;
}

export async function uploadGathererRunToDrive(
  context: GathererDriveUploadContext
): Promise<GathererDriveUploadResult> {
  const { config, files, runContext, creators, performanceRows, managementRows, summary } =
    context;

  if (!runContext.shouldUploadDailyArchiveToDrive) {
    logInfo(
      `Drive daily archive skipped — intraday ${runContext.runTrigger} run (final copy on scheduled slot ${runContext.scheduledSlotTotal})`,
      "uploadDriveFile"
    );
    return { uploaded: false, dailyArchive: null };
  }

  logInfo(
    `Creating daily archive for ${runContext.dailyDateKey} (scheduled slot ${runContext.scheduledSlotIndex}/${runContext.scheduledSlotTotal})`,
    "uploadDriveFile"
  );

  if (config.googleDriveDailyArchiveFolderId) {
    const dailyArchive = await archiveDailyCreatorsToDriveFolder(
      config,
      runContext,
      creators,
      performanceRows,
      managementRows,
      summary
    );

    await archiveDailyUploadFilesToDriveFolder(config, runContext, files);

    return { uploaded: Boolean(dailyArchive), dailyArchive };
  }

  if (config.googleDriveFolderId) {
    for (const filePath of files) {
      const base = path.basename(filePath);
      let category: "Raw Backstage Exports" | "Combined Outputs" | "Import Summaries" =
        "Combined Outputs";

      if (base.startsWith("backstage-")) {
        category = "Raw Backstage Exports";
      } else if (base.startsWith("import-summary")) {
        category = "Import Summaries";
      }

      await uploadFileToGoogleDrive(config, filePath, category);
    }

    return { uploaded: true, dailyArchive: null };
  }

  logInfo("No Drive folder configured for daily archive", "uploadDriveFile");
  return { uploaded: false, dailyArchive: null };
}

// Suggestions For Features and Additions Later:
// - Upload progress callbacks
