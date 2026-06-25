/**
 * Filename: sheetsClient.ts
 * Purpose: Google Sheets API client factory.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-23
 * Dependencies: googleapis
 * Platform Compatibility: Node.js 18+
 */

import { google } from "googleapis";
import { GathererConfig } from "../config";
import { createGoogleAuthClient } from "./googleAuth";

// MARK: - Sheets Client

export function createGoogleSheetsClient(config: GathererConfig) {
  const auth = createGoogleAuthClient(config);
  return google.sheets({ version: "v4", auth });
}

// Suggestions For Features and Additions Later:
// - Batch update rate limiting
