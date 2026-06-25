/**
 * Filename: driveClient.ts
 * Purpose: Google Drive API client factory.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-23
 * Dependencies: googleapis
 * Platform Compatibility: Node.js 18+
 */

import { google } from "googleapis";
import { GathererConfig } from "../config";
import { createGoogleAuthClient } from "./googleAuth";

// MARK: - Drive Client

export function createGoogleDriveClient(config: GathererConfig) {
  const auth = createGoogleAuthClient(config);
  return google.drive({ version: "v3", auth });
}

// Suggestions For Features and Additions Later:
// - Shared drive support
