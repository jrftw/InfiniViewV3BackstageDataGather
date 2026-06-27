/**
 * Filename: masterSheetIncrementalPublish.ts
 * Purpose: Update 01_Latest_Master_Creators by row checksum — skip unchanged rows, no full-tab clear.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-26
 * Dependencies: googleapis, sheetDataHelpers, creatorRowChecksum, readMasterCreatorsSheet
 * Platform Compatibility: Node.js 18+
 */

import { GathererConfig } from "../config";
import { createGoogleSheetsClient } from "./sheetsClient";
import { SHEET_TABS } from "./updateSheetTabs";
import { CombinedCreatorRecord } from "../processing/mergeBackstageReports";
import { normalizeTikTokUsername } from "../processing/normalizeUsername";
import { buildCreatorRowChecksum } from "../processing/creatorRowChecksum";
import { normalizeCreatorRecordForApp } from "../processing/normalizeCreatorForCache";
import {
  sheetDataCreatorToRowValues,
  sheetDataResolveCreatorHeaders,
  sheetDataBuildPatchedRowWithHeaderLabels,
} from "./sheetDataHelpers";
import {
  readMasterCreatorsSheetRawRows,
  readMasterCreatorsSheetResolveHeaderField,
} from "./readMasterCreatorsSheet";
import { freezeGoogleSheetHeaderRow } from "./sheetFreezeHeaders";
import { logInfo } from "../logging/logger";
import { publishMasterCreatorsTabFullOverwrite } from "./publishMasterCreatorsTab";
import { PROFILE_ACQUIRER_WRITABLE_FIELD_SET } from "../profileAcquirer/profileAcquirerWritableFields";

// MARK: - Result

export interface MasterSheetIncrementalPublishResult {
  published: boolean;
  skippedNoChanges: boolean;
  fullOverwrite: boolean;
  rowsUpdated: number;
  rowsAppended: number;
  rowsRemoved: number;
  rowsUnchanged: number;
}

interface MasterSheetIndexedRow {
  sheetRowNumber: number;
  creator: CombinedCreatorRecord;
  checksum: string;
}

interface MasterSheetRowUpdatePlan {
  sheetRowNumber: number;
  values: string[];
}

// MARK: - Match Keys

function masterSheetIncrementalPublishMatchKey(creator: CombinedCreatorRecord): string | null {
  const creatorId = creator.backstage_creator_id?.trim();
  if (creatorId) {
    return `id:${creatorId}`;
  }
  const username =
    creator.normalized_username ?? normalizeTikTokUsername(creator.tiktok_username);
  return username ? `user:${username}` : null;
}

function masterSheetIncrementalPublishHeadersEqual(
  existing: string[],
  incoming: string[]
): boolean {
  if (existing.length !== incoming.length) {
    return false;
  }
  return existing.every((header, index) => header === incoming[index]);
}

async function masterSheetIncrementalPublishResolveSheetId(
  config: GathererConfig,
  tabName: string
): Promise<number | null> {
  const sheets = createGoogleSheetsClient(config);
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: config.googleMasterSheetId,
    fields: "sheets.properties.sheetId,sheets.properties.title",
  });

  const sheet = meta.data.sheets?.find((entry) => entry.properties?.title === tabName);
  return sheet?.properties?.sheetId ?? null;
}

async function masterSheetIncrementalPublishDeleteRows(
  config: GathererConfig,
  tabName: string,
  sheetRowNumbers: number[]
): Promise<void> {
  if (sheetRowNumbers.length === 0) {
    return;
  }

  const sheetId = await masterSheetIncrementalPublishResolveSheetId(config, tabName);
  if (sheetId === null) {
    return;
  }

  const sheets = createGoogleSheetsClient(config);
  const sortedRows = [...sheetRowNumbers].sort((a, b) => b - a);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: config.googleMasterSheetId,
    requestBody: {
      requests: sortedRows.map((rowNumber) => ({
        deleteDimension: {
          range: {
            sheetId,
            dimension: "ROWS",
            startIndex: rowNumber - 1,
            endIndex: rowNumber,
          },
        },
      })),
    },
  });
}

async function masterSheetIncrementalPublishApplyRowUpdates(
  config: GathererConfig,
  tabName: string,
  updates: MasterSheetRowUpdatePlan[]
): Promise<void> {
  if (updates.length === 0) {
    return;
  }

  const sheets = createGoogleSheetsClient(config);
  const chunkSize = 100;

  for (let offset = 0; offset < updates.length; offset += chunkSize) {
    const chunk = updates.slice(offset, offset + chunkSize);
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: config.googleMasterSheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: chunk.map((update) => ({
          range: `${tabName}!A${update.sheetRowNumber}:ZZ${update.sheetRowNumber}`,
          values: [update.values],
        })),
      },
    });
  }
}

// MARK: - Incremental Publish

export async function publishMasterCreatorsTabIncremental(
  config: GathererConfig,
  creators: CombinedCreatorRecord[]
): Promise<MasterSheetIncrementalPublishResult> {
  const normalizedCreators = creators.map((creator) => normalizeCreatorRecordForApp(creator));

  const emptyResult: MasterSheetIncrementalPublishResult = {
    published: false,
    skippedNoChanges: true,
    fullOverwrite: false,
    rowsUpdated: 0,
    rowsAppended: 0,
    rowsRemoved: 0,
    rowsUnchanged: 0,
  };

  if (!config.googleMasterSheetId) {
    logInfo(
      "Master sheet publish skipped — GOOGLE_MASTER_SHEET_ID not set",
      "masterSheetIncrementalPublish"
    );
    return emptyResult;
  }

  if (creators.length === 0) {
    logInfo("Master sheet publish skipped — no creators", "masterSheetIncrementalPublish");
    return emptyResult;
  }

  const tabName = SHEET_TABS.latestMaster;
  const headers = sheetDataResolveCreatorHeaders(normalizedCreators[0]);
  const headerLabels = headers as string[];
  const incomingByKey = new Map<string, CombinedCreatorRecord>();

  for (const creator of normalizedCreators) {
    const key = masterSheetIncrementalPublishMatchKey(creator);
    if (key) {
      incomingByKey.set(key, creator);
    }
  }

  if (!config.gathererMasterSheetIncrementalUpdates) {
    await publishMasterCreatorsTabFullOverwrite(config, normalizedCreators);
    return {
      published: true,
      skippedNoChanges: false,
      fullOverwrite: true,
      rowsUpdated: normalizedCreators.length,
      rowsAppended: 0,
      rowsRemoved: 0,
      rowsUnchanged: 0,
    };
  }

  const rawSheet = await readMasterCreatorsSheetRawRows(config);
  if (!rawSheet || rawSheet.rows.length === 0) {
    await publishMasterCreatorsTabFullOverwrite(config, normalizedCreators);
    logInfo(
      `Master sheet initialized with full write (${normalizedCreators.length} creators)`,
      "masterSheetIncrementalPublish"
    );
    return {
      published: true,
      skippedNoChanges: false,
      fullOverwrite: true,
      rowsUpdated: normalizedCreators.length,
      rowsAppended: 0,
      rowsRemoved: 0,
      rowsUnchanged: 0,
    };
  }

  const existingHeaderLabels = rawSheet.headerLabels;
  const headersMatch = masterSheetIncrementalPublishHeadersEqual(
    existingHeaderLabels,
    headerLabels
  );

  if (!headersMatch) {
    await publishMasterCreatorsTabFullOverwrite(config, normalizedCreators);
    logInfo(
      "Master sheet column headers changed — full tab rewrite",
      "masterSheetIncrementalPublish"
    );
    return {
      published: true,
      skippedNoChanges: false,
      fullOverwrite: true,
      rowsUpdated: normalizedCreators.length,
      rowsAppended: 0,
      rowsRemoved: 0,
      rowsUnchanged: 0,
    };
  }

  const existingByKey = new Map<string, MasterSheetIndexedRow>();
  for (const row of rawSheet.rows) {
    const key = masterSheetIncrementalPublishMatchKey(row.creator);
    if (key) {
      existingByKey.set(key, {
        sheetRowNumber: row.sheetRowNumber,
        creator: row.creator,
        checksum: buildCreatorRowChecksum(row.creator),
      });
    }
  }

  const rowUpdates: MasterSheetRowUpdatePlan[] = [];
  const rowsToAppend: string[][] = [];
  let rowsUnchanged = 0;

  for (const [key, incomingCreator] of incomingByKey.entries()) {
    const incomingChecksum = buildCreatorRowChecksum(incomingCreator);
    const existing = existingByKey.get(key);
    const rowValues = sheetDataCreatorToRowValues(incomingCreator, headers);

    if (!existing) {
      rowsToAppend.push(rowValues);
      continue;
    }

    if (existing.checksum === incomingChecksum) {
      rowsUnchanged += 1;
      existingByKey.delete(key);
      continue;
    }

    rowUpdates.push({
      sheetRowNumber: existing.sheetRowNumber,
      values: rowValues,
    });
    existingByKey.delete(key);
  }

  const rowsToRemove = [...existingByKey.values()].map((row) => row.sheetRowNumber);

  if (
    rowUpdates.length === 0 &&
    rowsToAppend.length === 0 &&
    rowsToRemove.length === 0
  ) {
    logInfo(
      `Master sheet unchanged — skipped publish (${rowsUnchanged} creators, no diffs)`,
      "masterSheetIncrementalPublish"
    );
    return {
      published: false,
      skippedNoChanges: true,
      fullOverwrite: false,
      rowsUpdated: 0,
      rowsAppended: 0,
      rowsRemoved: 0,
      rowsUnchanged,
    };
  }

  const changeRatio =
    (rowUpdates.length + rowsToAppend.length + rowsToRemove.length) /
    Math.max(rawSheet.rows.length, 1);

  if (changeRatio > 0.6) {
    await publishMasterCreatorsTabFullOverwrite(config, creators);
    logInfo(
      `Master sheet large diff (${Math.round(changeRatio * 100)}%) — full tab rewrite`,
      "masterSheetIncrementalPublish"
    );
    return {
      published: true,
      skippedNoChanges: false,
      fullOverwrite: true,
      rowsUpdated: normalizedCreators.length,
      rowsAppended: 0,
      rowsRemoved: 0,
      rowsUnchanged,
    };
  }

  await masterSheetIncrementalPublishDeleteRows(config, tabName, rowsToRemove);
  await masterSheetIncrementalPublishApplyRowUpdates(config, tabName, rowUpdates);

  if (rowsToAppend.length > 0) {
    const sheets = createGoogleSheetsClient(config);
    await sheets.spreadsheets.values.append({
      spreadsheetId: config.googleMasterSheetId,
      range: `${tabName}!A:A`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: rowsToAppend },
    });
  }

  await freezeGoogleSheetHeaderRow(config, config.googleMasterSheetId, tabName);

  logInfo(
    `Master sheet incremental publish — ${rowUpdates.length} updated, ${rowsToAppend.length} appended, ${rowsToRemove.length} removed, ${rowsUnchanged} unchanged`,
    "masterSheetIncrementalPublish"
  );

  return {
    published: true,
    skippedNoChanges: false,
    fullOverwrite: false,
    rowsUpdated: rowUpdates.length,
    rowsAppended: rowsToAppend.length,
    rowsRemoved: rowsToRemove.length,
    rowsUnchanged,
  };
}

// MARK: - Profile Acquirer Patch Publish

const PROFILE_ACQUIRER_MASTER_SHEET_PATCH_EXTRA_FIELDS = new Set<string>([
  ...PROFILE_ACQUIRER_WRITABLE_FIELD_SET,
  "row_checksum",
  "record_updated_at",
]);

function masterSheetProfileAcquirerPreparePatchedCreator(
  creator: CombinedCreatorRecord
): CombinedCreatorRecord {
  const patched = { ...creator, record_updated_at: new Date().toISOString() };
  patched.row_checksum = buildCreatorRowChecksum(patched);
  return patched;
}

/**
 * Patch only creators updated by the profile acquirer — uses existing sheet column layout.
 * Avoids full-tab rewrite when code headers differ from the live sheet (e.g. new columns pending).
 */
export async function publishProfileAcquirerMasterSheetPatches(
  config: GathererConfig,
  patchedCreators: CombinedCreatorRecord[]
): Promise<MasterSheetIncrementalPublishResult> {
  const emptyResult: MasterSheetIncrementalPublishResult = {
    published: false,
    skippedNoChanges: true,
    fullOverwrite: false,
    rowsUpdated: 0,
    rowsAppended: 0,
    rowsRemoved: 0,
    rowsUnchanged: 0,
  };

  if (!config.googleMasterSheetId) {
    logInfo(
      "Profile acquirer sheet patch skipped — GOOGLE_MASTER_SHEET_ID not set",
      "masterSheetIncrementalPublish"
    );
    return emptyResult;
  }

  if (patchedCreators.length === 0) {
    return emptyResult;
  }

  const sheets = createGoogleSheetsClient(config);
  const tabName = SHEET_TABS.latestMaster;
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.googleMasterSheetId,
    range: `${tabName}!A:ZZ`,
  });

  const gridRows = (response.data.values ?? []) as string[][];
  if (gridRows.length < 2) {
    await publishMasterCreatorsTabFullOverwrite(config, patchedCreators);
    logInfo(
      "Profile acquirer sheet patch — tab empty, initialized with full write",
      "masterSheetIncrementalPublish"
    );
    return {
      published: true,
      skippedNoChanges: false,
      fullOverwrite: true,
      rowsUpdated: patchedCreators.length,
      rowsAppended: 0,
      rowsRemoved: 0,
      rowsUnchanged: 0,
    };
  }

  const headerLabels = gridRows[0].map((header) => String(header).trim());
  const rawSheet = await readMasterCreatorsSheetRawRows(config);
  if (!rawSheet || rawSheet.rows.length === 0) {
    await publishMasterCreatorsTabFullOverwrite(config, patchedCreators);
    return {
      published: true,
      skippedNoChanges: false,
      fullOverwrite: true,
      rowsUpdated: patchedCreators.length,
      rowsAppended: 0,
      rowsRemoved: 0,
      rowsUnchanged: 0,
    };
  }

  const rowIndexByKey = new Map<string, number>();
  for (const row of rawSheet.rows) {
    const key = masterSheetIncrementalPublishMatchKey(row.creator);
    if (key) {
      rowIndexByKey.set(key, row.sheetRowNumber);
    }
  }

  const rowUpdates: MasterSheetRowUpdatePlan[] = [];
  let rowsUnchanged = 0;

  for (const creator of patchedCreators) {
    const key = masterSheetIncrementalPublishMatchKey(creator);
    if (!key) {
      continue;
    }

    const sheetRowNumber = rowIndexByKey.get(key);
    if (!sheetRowNumber) {
      logInfo(
        `Profile acquirer patch skipped — creator not found on master sheet (${key})`,
        "masterSheetIncrementalPublish"
      );
      continue;
    }

    const preparedCreator = masterSheetProfileAcquirerPreparePatchedCreator(
      normalizeCreatorRecordForApp(creator)
    );
    const existingRow = gridRows[sheetRowNumber - 1] ?? [];
    const patchedValues = sheetDataBuildPatchedRowWithHeaderLabels(preparedCreator, headerLabels, {
      existingRow,
      resolveHeaderField: readMasterCreatorsSheetResolveHeaderField,
      overwriteFields: PROFILE_ACQUIRER_MASTER_SHEET_PATCH_EXTRA_FIELDS,
    });

    const existingChecksumIndex = headerLabels.findIndex(
      (label) => readMasterCreatorsSheetResolveHeaderField(label) === "row_checksum"
    );
    const existingChecksum =
      existingChecksumIndex >= 0 ? existingRow[existingChecksumIndex]?.trim() : "";
    const incomingChecksum = preparedCreator.row_checksum ?? "";

    if (existingChecksum && incomingChecksum && existingChecksum === incomingChecksum) {
      rowsUnchanged += 1;
      continue;
    }

    rowUpdates.push({
      sheetRowNumber,
      values: patchedValues,
    });
  }

  if (rowUpdates.length === 0) {
    logInfo(
      `Profile acquirer sheet patch — no row diffs (${rowsUnchanged} unchanged)`,
      "masterSheetIncrementalPublish"
    );
    return {
      published: false,
      skippedNoChanges: true,
      fullOverwrite: false,
      rowsUpdated: 0,
      rowsAppended: 0,
      rowsRemoved: 0,
      rowsUnchanged,
    };
  }

  await masterSheetIncrementalPublishApplyRowUpdates(config, tabName, rowUpdates);

  logInfo(
    `Profile acquirer sheet patch — ${rowUpdates.length} row(s) updated, ${rowsUnchanged} unchanged (existing column layout)`,
    "masterSheetIncrementalPublish"
  );

  return {
    published: true,
    skippedNoChanges: false,
    fullOverwrite: false,
    rowsUpdated: rowUpdates.length,
    rowsAppended: 0,
    rowsRemoved: 0,
    rowsUnchanged,
  };
}

// Suggestions For Features and Additions Later:
// - Append changed-field names to 07_Change_Log for audit trail
