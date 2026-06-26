/**
 * Filename: uploadProfileImageToDrive.ts
 * Purpose: Upload cached creator profile images to Google Drive for app-ready HTTPS URLs.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-26
 * Dependencies: googleapis, driveClient, uploadDriveFile
 * Platform Compatibility: Node.js 18+
 */

import fs from "fs";
import { GathererConfig } from "../config";
import { createGoogleDriveClient } from "./driveClient";
import { gathererDriveEnsureSubfolder } from "./uploadDriveFile";
import { logInfo, logWarn } from "../logging/logger";

// MARK: - Result

export interface UploadProfileImageToDriveResult {
  fileId: string;
  publicViewUrl: string;
  webViewLink: string | null;
  folderId: string;
}

// MARK: - URL Builder

export function uploadProfileImageToDriveBuildPublicViewUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=view&id=${fileId}`;
}

const UPLOAD_PROFILE_IMAGE_DRIVE_SUBFOLDER_DEFAULT = "Profile Pictures";

// MARK: - Permissions

async function uploadProfileImageToDriveEnsurePublicRead(
  config: GathererConfig,
  fileId: string
): Promise<void> {
  const drive = createGoogleDriveClient(config);

  const existing = await drive.permissions.list({
    fileId,
    fields: "permissions(id, type, role)",
    supportsAllDrives: true,
  });

  const hasPublicRead = (existing.data.permissions ?? []).some(
    (permission) => permission.type === "anyone" && permission.role === "reader"
  );

  if (hasPublicRead) {
    return;
  }

  await drive.permissions.create({
    fileId,
    requestBody: {
      role: "reader",
      type: "anyone",
    },
    supportsAllDrives: true,
  });
}

async function uploadProfileImageToDriveResolveFolderCandidates(
  config: GathererConfig
): Promise<string[]> {
  const candidates: string[] = [];
  const subfolderName =
    config.googleDriveProfileImagesSubfolder.trim() || UPLOAD_PROFILE_IMAGE_DRIVE_SUBFOLDER_DEFAULT;

  if (config.googleDriveFolderId) {
    const dataHubProfileFolderId = await gathererDriveEnsureSubfolder(
      config,
      config.googleDriveFolderId,
      subfolderName
    );
    candidates.push(dataHubProfileFolderId);
  }

  const legacyProfileFolderId = config.googleDriveProfileImagesFolderId.trim();
  if (legacyProfileFolderId && !candidates.includes(legacyProfileFolderId)) {
    candidates.push(legacyProfileFolderId);
  }

  return candidates;
}

async function uploadProfileImageToDriveUpsertInFolder(
  config: GathererConfig,
  folderId: string,
  localFilePath: string,
  normalizedUsername: string
): Promise<UploadProfileImageToDriveResult> {
  const drive = createGoogleDriveClient(config);
  const fileName = `${normalizedUsername}.jpg`;

  const existing = await drive.files.list({
    q: `'${folderId}' in parents and name='${fileName}' and trashed=false`,
    fields: "files(id, name, webViewLink)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const existingId = existing.data.files?.[0]?.id;
  let fileId = existingId ?? "";
  let webViewLink = existing.data.files?.[0]?.webViewLink ?? null;

  if (existingId) {
    const updated = await drive.files.update({
      fileId: existingId,
      media: {
        mimeType: "image/jpeg",
        body: fs.createReadStream(localFilePath),
      },
      fields: "id, webViewLink",
      supportsAllDrives: true,
    });
    fileId = updated.data.id ?? existingId;
    webViewLink = updated.data.webViewLink ?? webViewLink;
    logInfo(`Updated Drive profile image: ${fileName}`, "uploadProfileImageToDrive", { fileId, folderId });
  } else {
    const created = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
        mimeType: "image/jpeg",
      },
      media: {
        mimeType: "image/jpeg",
        body: fs.createReadStream(localFilePath),
      },
      fields: "id, webViewLink",
      supportsAllDrives: true,
    });
    fileId = created.data.id ?? "";
    webViewLink = created.data.webViewLink ?? null;
    logInfo(`Uploaded Drive profile image: ${fileName}`, "uploadProfileImageToDrive", { fileId, folderId });
  }

  if (!fileId) {
    throw new Error("Drive upload returned no file id");
  }

  await uploadProfileImageToDriveEnsurePublicRead(config, fileId);

  return {
    fileId,
    publicViewUrl: uploadProfileImageToDriveBuildPublicViewUrl(fileId),
    webViewLink,
    folderId,
  };
}

// MARK: - Upsert

export async function uploadProfileImageToDrive(
  config: GathererConfig,
  localFilePath: string,
  normalizedUsername: string
): Promise<UploadProfileImageToDriveResult | null> {
  if (!fs.existsSync(localFilePath)) {
    logWarn(`Profile image file missing: ${localFilePath}`, "uploadProfileImageToDrive");
    return null;
  }

  const folderCandidates = await uploadProfileImageToDriveResolveFolderCandidates(config);
  if (folderCandidates.length === 0) {
    logWarn(
      "No Drive folder configured for profile images — set GOOGLE_DRIVE_PROFILE_IMAGES_FOLDER_ID or GOOGLE_DRIVE_FOLDER_ID",
      "uploadProfileImageToDrive"
    );
    return null;
  }

  const errors: string[] = [];

  for (const folderId of folderCandidates) {
    try {
      return await uploadProfileImageToDriveUpsertInFolder(
        config,
        folderId,
        localFilePath,
        normalizedUsername
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${folderId}: ${message}`);
    }
  }

  logWarn(
    `Drive profile image upload failed for @${normalizedUsername}. Tried ${folderCandidates.length} folder(s). Share profile folder with ${config.googleServiceAccountEmail} (Editor), move Data Hub to a Shared Drive, or set GOOGLE_DELEGATED_USER for My Drive uploads. Last errors: ${errors.join(" | ")}`,
    "uploadProfileImageToDrive"
  );
  return null;
}

// Suggestions For Features and Additions Later:
// - JPEG resize/compress before upload when file exceeds max KB threshold
