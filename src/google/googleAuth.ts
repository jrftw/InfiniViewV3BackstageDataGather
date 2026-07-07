/**
 * Filename: googleAuth.ts
 * Purpose: Google service account authentication for Drive and Sheets.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-07-07
 * Dependencies: googleapis
 * Platform Compatibility: Node.js 18+
 */

import { google } from "googleapis";
import { GathererConfig } from "../config";

// MARK: - Scopes

const GOOGLE_AUTH_SCOPE_DRIVE_FILE = "https://www.googleapis.com/auth/drive.file";
const GOOGLE_AUTH_SCOPE_DRIVE_FULL = "https://www.googleapis.com/auth/drive";
const GOOGLE_AUTH_SCOPE_SPREADSHEETS = "https://www.googleapis.com/auth/spreadsheets";

const GOOGLE_AUTH_SCOPE_GMAIL_SEND = "https://www.googleapis.com/auth/gmail.send";

function googleAuthResolveScopes(config: GathererConfig): string[] {
  if (config.googleScopes.length > 0) {
    return config.googleScopes;
  }

  const delegatedUser = config.googleDelegatedUser.trim();
  const driveScope = delegatedUser ? GOOGLE_AUTH_SCOPE_DRIVE_FULL : GOOGLE_AUTH_SCOPE_DRIVE_FILE;

  return [driveScope, GOOGLE_AUTH_SCOPE_SPREADSHEETS];
}

export function gathererGmailSendConfigured(config: GathererConfig): boolean {
  return Boolean(
    config.googleServiceAccountEmail &&
      config.googleServiceAccountPrivateKey &&
      config.googleDelegatedUser.trim()
  );
}

export function createGoogleGmailAuthClient(config: GathererConfig) {
  if (!gathererGmailSendConfigured(config)) {
    throw new Error(
      "Gmail send requires GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, and GOOGLE_DELEGATED_USER"
    );
  }

  const delegatedUser = config.googleDelegatedUser.trim();
  const scopes = config.googleScopes.includes(GOOGLE_AUTH_SCOPE_GMAIL_SEND)
    ? config.googleScopes
    : [...config.googleScopes, GOOGLE_AUTH_SCOPE_GMAIL_SEND];

  return new google.auth.JWT({
    email: config.googleServiceAccountEmail,
    key: config.googleServiceAccountPrivateKey,
    scopes: scopes.length > 0 ? scopes : [GOOGLE_AUTH_SCOPE_GMAIL_SEND],
    subject: delegatedUser,
  });
}

// MARK: - Google Auth Client

export function createGoogleAuthClient(config: GathererConfig) {
  if (!config.googleServiceAccountEmail || !config.googleServiceAccountPrivateKey) {
    throw new Error(
      "Google credentials missing. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY in .env"
    );
  }

  const delegatedUser = config.googleDelegatedUser.trim();

  return new google.auth.JWT({
    email: config.googleServiceAccountEmail,
    key: config.googleServiceAccountPrivateKey,
    scopes: googleAuthResolveScopes(config),
    ...(delegatedUser ? { subject: delegatedUser } : {}),
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
// - OAuth user flow as alternative to service account + domain-wide delegation
