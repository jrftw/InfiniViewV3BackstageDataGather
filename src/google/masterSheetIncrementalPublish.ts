/**
 * Filename: masterSheetIncrementalPublish.ts
 * Purpose: Update 01_Latest_Master_Creators by row checksum — skip unchanged rows (still refreshing their sync metadata), no full-tab clear.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-07-29
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
  /** Data-identical rows that had only their sync-metadata cells refreshed. */
  rowsSyncMetadataRefreshed: number;
}

interface MasterSheetIndexedRow {
  sheetRowNumber: number;
  creator: CombinedCreatorRecord;
  checksum: string;
}

export interface MasterSheetRowUpdatePlan {
  sheetRowNumber: number;
  values: string[];
}

// MARK: - Sync Metadata Refresh
//
// WHY THIS EXISTS
//
// `row_checksum` deliberately excludes the sync/cache metadata fields, so two runs that produce
// identical creator data produce identical checksums. The incremental publisher then skips those
// rows entirely to stay inside Sheets write quota — which also means their
// `last_successful_sync_at` cell never moves. For any creator whose stats did not change (very
// common intraday, and permanent for inactive creators) the master sheet's "Last Sync" column
// froze at whatever run last changed their numbers, so anything reading the sheet believed the
// gatherer had stopped publishing.
//
// The fix keeps the row-level skip but adds a narrow write covering just the sync-metadata
// columns for skipped rows. Those columns are contiguous at the tail of the canonical column
// order, so this is normally one small range per row inside the same batched request the row
// updates already use — not a full row rewrite.

/** Columns refreshed on data-identical rows so their sync stamp tracks every successful run. */
const MASTER_SHEET_SYNC_METADATA_REFRESH_FIELDS: readonly (keyof CombinedCreatorRecord)[] = [
  "schema_version",
  "row_checksum",
  "last_successful_sync_at",
  "last_sync_status",
  "last_sync_error",
  "last_cache_published_at",
  "cache_record_version",
] as const;

export interface MasterSheetSyncMetadataColumnRun {
  startColumnIndex: number;
  endColumnIndex: number;
}

/** Zero-based column index to an A1 column label (0 -> A, 25 -> Z, 26 -> AA). */
export function masterSheetIncrementalPublishColumnLabel(columnIndex: number): string {
  let remaining = columnIndex;
  let label = "";

  while (remaining >= 0) {
    label = String.fromCharCode((remaining % 26) + 65) + label;
    remaining = Math.floor(remaining / 26) - 1;
  }

  return label;
}

/**
 * Group the sync-metadata columns into contiguous runs of the live header row.
 *
 * Normally yields a single run. Returning runs rather than assuming one block keeps this correct
 * if the sheet's column order ever diverges from the canonical order.
 */
export function masterSheetIncrementalPublishResolveSyncMetadataRuns(
  headers: (keyof CombinedCreatorRecord)[]
): MasterSheetSyncMetadataColumnRun[] {
  const refreshFieldSet = new Set<string>(MASTER_SHEET_SYNC_METADATA_REFRESH_FIELDS as readonly string[]);
  const columnIndexes: number[] = [];

  headers.forEach((header, columnIndex) => {
    if (refreshFieldSet.has(header as string)) {
      columnIndexes.push(columnIndex);
    }
  });

  const runs: MasterSheetSyncMetadataColumnRun[] = [];
  for (const columnIndex of columnIndexes) {
    const lastRun = runs[runs.length - 1];
    if (lastRun && columnIndex === lastRun.endColumnIndex + 1) {
      lastRun.endColumnIndex = columnIndex;
      continue;
    }
    runs.push({ startColumnIndex: columnIndex, endColumnIndex: columnIndex });
  }

  return runs;
}

/**
 * Write only the sync-metadata cells for rows whose creator data was unchanged.
 *
 * Returns the number of rows refreshed. Chunked the same way as row updates so a large roster
 * cannot exceed the Sheets request size limit.
 */
async function masterSheetIncrementalPublishApplySyncMetadataRefresh(
  config: GathererConfig,
  tabName: string,
  headers: (keyof CombinedCreatorRecord)[],
  unchangedRows: MasterSheetRowUpdatePlan[]
): Promise<number> {
  if (unchangedRows.length === 0) {
    return 0;
  }

  const runs = masterSheetIncrementalPublishResolveSyncMetadataRuns(headers);
  if (runs.length === 0) {
    logInfo(
      "Sync metadata refresh skipped — no sync columns present in master sheet headers",
      "masterSheetIncrementalPublish"
    );
    return 0;
  }

  const sheets = createGoogleSheetsClient(config);
  const rowChunkSize = 100;

  for (let offset = 0; offset < unchangedRows.length; offset += rowChunkSize) {
    const chunk = unchangedRows.slice(offset, offset + rowChunkSize);
    const data: { range: string; values: string[][] }[] = [];

    for (const row of chunk) {
      for (const run of runs) {
        const startLabel = masterSheetIncrementalPublishColumnLabel(run.startColumnIndex);
        const endLabel = masterSheetIncrementalPublishColumnLabel(run.endColumnIndex);
        data.push({
          range: `${tabName}!${startLabel}${row.sheetRowNumber}:${endLabel}${row.sheetRowNumber}`,
          values: [row.values.slice(run.startColumnIndex, run.endColumnIndex + 1)],
        });
      }
    }

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: config.googleMasterSheetId,
      requestBody: {
        valueInputOption: "RAW",
        data,
      },
    });
  }

  return unchangedRows.length;
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

/**
 * Re-map cached sheet row numbers to their positions after rows are deleted.
 *
 * Row numbers are captured from a single pre-write read of the tab, but `deleteDimension` shifts
 * every row below a deletion up by one. Writing the original numbers after a delete therefore
 * lands on the wrong creators — silently overwriting one creator's row with another's data, which
 * reads downstream as wrong or stuck values. Each plan's row number is reduced by the number of
 * deleted rows above it.
 *
 * Deleted rows and updated rows are always disjoint here: a row is either matched to an incoming
 * creator (update or unchanged) or left over for removal, never both.
 */
export function masterSheetIncrementalPublishRemapRowNumbersAfterDeletions(
  plans: MasterSheetRowUpdatePlan[],
  deletedSheetRowNumbers: number[]
): MasterSheetRowUpdatePlan[] {
  if (deletedSheetRowNumbers.length === 0 || plans.length === 0) {
    return plans;
  }

  const sortedDeletions = [...deletedSheetRowNumbers].sort((a, b) => a - b);

  return plans.map((plan) => {
    let deletionsAbove = 0;
    for (const deletedRowNumber of sortedDeletions) {
      if (deletedRowNumber < plan.sheetRowNumber) {
        deletionsAbove += 1;
        continue;
      }
      break;
    }

    return deletionsAbove === 0
      ? plan
      : { sheetRowNumber: plan.sheetRowNumber - deletionsAbove, values: plan.values };
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
    rowsSyncMetadataRefreshed: 0,
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
      // Full-tab rewrite already wrote every sync-metadata cell.
      rowsSyncMetadataRefreshed: 0,
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
      // Full-tab rewrite already wrote every sync-metadata cell.
      rowsSyncMetadataRefreshed: 0,
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
      // Full-tab rewrite already wrote every sync-metadata cell.
      rowsSyncMetadataRefreshed: 0,
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
  // Data-identical rows still carry a new sync stamp, so keep their values for the narrow refresh.
  const unchangedRowsForSyncMetadataRefresh: MasterSheetRowUpdatePlan[] = [];
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
      unchangedRowsForSyncMetadataRefresh.push({
        sheetRowNumber: existing.sheetRowNumber,
        values: rowValues,
      });
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
  const syncMetadataRefreshRows = config.gathererMasterSheetRefreshSyncMetadata
    ? unchangedRowsForSyncMetadataRefresh
    : [];

  if (
    rowUpdates.length === 0 &&
    rowsToAppend.length === 0 &&
    rowsToRemove.length === 0
  ) {
    // No creator data changed. The sync stamp still advanced, so refresh those cells only —
    // otherwise the sheet's Last Sync column freezes and readers think the gatherer stopped.
    const rowsSyncMetadataRefreshed =
      await masterSheetIncrementalPublishApplySyncMetadataRefresh(
        config,
        tabName,
        headers,
        syncMetadataRefreshRows
      );

    if (rowsSyncMetadataRefreshed > 0) {
      logInfo(
        `Master sheet data unchanged — refreshed sync metadata on ${rowsSyncMetadataRefreshed} row(s)`,
        "masterSheetIncrementalPublish"
      );
      return {
        published: true,
        skippedNoChanges: false,
        fullOverwrite: false,
        rowsUpdated: 0,
        rowsAppended: 0,
        rowsRemoved: 0,
        rowsUnchanged,
        rowsSyncMetadataRefreshed,
      };
    }

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
      rowsSyncMetadataRefreshed: 0,
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
      rowsSyncMetadataRefreshed: 0,
    };
  }

  await masterSheetIncrementalPublishDeleteRows(config, tabName, rowsToRemove);

  // Deletions have already shifted the tab, so every cached row number must be re-mapped before
  // it is used as a write target.
  await masterSheetIncrementalPublishApplyRowUpdates(
    config,
    tabName,
    masterSheetIncrementalPublishRemapRowNumbersAfterDeletions(rowUpdates, rowsToRemove)
  );

  const rowsSyncMetadataRefreshed =
    await masterSheetIncrementalPublishApplySyncMetadataRefresh(
      config,
      tabName,
      headers,
      masterSheetIncrementalPublishRemapRowNumbersAfterDeletions(
        syncMetadataRefreshRows,
        rowsToRemove
      )
    );

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
    `Master sheet incremental publish — ${rowUpdates.length} updated, ${rowsToAppend.length} appended, ${rowsToRemove.length} removed, ${rowsUnchanged} unchanged (${rowsSyncMetadataRefreshed} sync-metadata refreshed)`,
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
    rowsSyncMetadataRefreshed,
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
    rowsSyncMetadataRefreshed: 0,
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
      // Full-tab rewrite already wrote every sync-metadata cell.
      rowsSyncMetadataRefreshed: 0,
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
      // Full-tab rewrite already wrote every sync-metadata cell.
      rowsSyncMetadataRefreshed: 0,
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
      rowsSyncMetadataRefreshed: 0,
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
    rowsSyncMetadataRefreshed: 0,
  };
}

// Suggestions For Features and Additions Later:
// - Append changed-field names to 07_Change_Log for audit trail
// - Write one sheet-level "last gather run" cell so per-row sync refresh becomes optional
// - Re-read row numbers after deletions instead of re-mapping them arithmetically
