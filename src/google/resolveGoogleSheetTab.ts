/**
 * Filename: resolveGoogleSheetTab.ts
 * Purpose: Resolve Google Sheet tab name by title, gid (sheetId), or leftmost tab.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-24
 * Dependencies: googleapis
 * Platform Compatibility: Node.js 18+
 */

import { GathererConfig } from "../config";
import { createGoogleSheetsClient } from "./sheetsClient";

// MARK: - Types

export interface ResolveGoogleSheetTabOptions {
  spreadsheetId: string;
  tabTitle?: string;
  tabGid?: string;
  preferLeftmost?: boolean;
}

export interface ResolveGoogleSheetTabResult {
  tabName: string;
  spreadsheetTitle: string;
}

// MARK: - Tab Resolver

export async function resolveGoogleSheetTabName(
  config: GathererConfig,
  options: ResolveGoogleSheetTabOptions
): Promise<ResolveGoogleSheetTabResult> {
  const sheets = createGoogleSheetsClient(config);
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: options.spreadsheetId,
    fields: "properties.title,sheets.properties(title,sheetId)",
  });

  const spreadsheetTitle = meta.data.properties?.title ?? "Google Sheet";
  const sheetTabs = meta.data.sheets ?? [];

  if (options.tabTitle) {
    const configuredTab = sheetTabs.find((sheet) => sheet.properties?.title === options.tabTitle);
    if (!configuredTab?.properties?.title) {
      throw new Error(`Tab "${options.tabTitle}" not found in spreadsheet ${options.spreadsheetId}`);
    }
    return { tabName: configuredTab.properties.title, spreadsheetTitle };
  }

  if (options.tabGid) {
    const gidTab = sheetTabs.find(
      (sheet) => String(sheet.properties?.sheetId ?? "") === String(options.tabGid)
    );
    if (!gidTab?.properties?.title) {
      throw new Error(`Tab gid ${options.tabGid} not found in spreadsheet ${options.spreadsheetId}`);
    }
    return { tabName: gidTab.properties.title, spreadsheetTitle };
  }

  if (options.preferLeftmost !== false) {
    const leftmostTab = sheetTabs[0]?.properties?.title;
    if (!leftmostTab) {
      throw new Error(`Spreadsheet ${options.spreadsheetId} has no tabs`);
    }
    return { tabName: leftmostTab, spreadsheetTitle };
  }

  throw new Error(`No tab resolution strategy for spreadsheet ${options.spreadsheetId}`);
}

// Suggestions For Features and Additions Later:
// - Cache spreadsheet metadata within a single gatherer run
