/**
 * Filename: googleAuth.ts
 * Purpose: Google service account authentication for Drive and Sheets.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-23
 * Dependencies: googleapis
 * Platform Compatibility: Node.js 18+
 */

import { google } from "googleapis";
import { GathererConfig } from "../config";

// MARK: - Google Auth Client

export function createGoogleAuthClient(config: GathererConfig) {
  if (!config.googleServiceAccountEmail || !config.googleServiceAccountPrivateKey) {
    throw new Error(
      "Google credentials missing. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY in .env"
    );
  }

  return new google.auth.JWT({
    email: config.googleServiceAccountEmail,
    key: config.googleServiceAccountPrivateKey,
    scopes: [
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/spreadsheets",
    ],
  });
}

export function isGoogleConfigured(config: GathererConfig): boolean {
  return Boolean(
    config.googleServiceAccountEmail &&
      config.googleServiceAccountPrivateKey &&
      config.googleMasterSheetId &&
      (config.googleDriveFolderId || config.googleDriveDailyArchiveFolderId)
  );
}

// Suggestions For Features and Additions Later:
// - OAuth user flow as alternative to service account
