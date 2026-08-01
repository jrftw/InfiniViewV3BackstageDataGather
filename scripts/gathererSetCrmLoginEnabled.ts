/**
 * Filename: gathererSetCrmLoginEnabled.ts
 * Purpose: Ops tool to set the CRM sheet login_enabled flag that gates InfiniView sign-in.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-07-30
 * Dependencies: googleapis, gatherer config, sheetsClient, readExternalCrmSheet header/tab resolvers
 * Platform Compatibility: Node.js 18+
 *
 * Why this exists:
 *   login_enabled is the single field that hard-denies InfiniView login, and the
 *   external CRM sheet is its only source of truth. Editing the master sheet or
 *   MongoDB does not stick: the gatherer re-derives login_enabled from CRM on
 *   every publish and $sets it back. Before this tool the only way to unblock a
 *   creator was to hand-edit a cell in a 2,000-row spreadsheet and hope the
 *   right row was found.
 *
 * Safety model:
 *   - Dry run by default. Nothing is written without --apply.
 *   - Refuses to run without an explicit target selector.
 *   - Only writes cells whose value would actually change.
 *   - Never inserts rows, never touches any other column.
 *   - Resolves the tab and the login_enabled column with the same helpers the
 *     read pipeline uses, so it cannot drift onto the wrong column.
 *
 * Usage (from the gatherer project root):
 *   npx tsx scripts/gathererSetCrmLoginEnabled.ts --username=tony_montanaa313
 *   npx tsx scripts/gathererSetCrmLoginEnabled.ts --username=tony_montanaa313 --apply
 *   npx tsx scripts/gathererSetCrmLoginEnabled.ts --all-disabled
 *   npx tsx scripts/gathererSetCrmLoginEnabled.ts --all-disabled --apply
 *   npx tsx scripts/gathererSetCrmLoginEnabled.ts --username=someone --value=false --apply
 *   npx tsx scripts/gathererSetCrmLoginEnabled.ts --id=7668060407902519309 --apply
 *
 * After applying, the change reaches InfiniView on the next gatherer publish.
 */

import { loadGathererConfig, GathererConfig } from "../src/config";
import { createGoogleSheetsClient } from "../src/google/sheetsClient";
import {
  readExternalCrmSheetMapHeader,
  readExternalCrmSheetResolveTabName,
} from "../src/google/readExternalCrmSheet";
import { logError, logInfo, logWarn } from "../src/logging/logger";

const GATHERER_SET_CRM_LOGIN_ENABLED_SOURCE = "gathererSetCrmLoginEnabled";

// MARK: - Argument Parsing

interface GathererSetCrmLoginEnabledArgs {
  usernames: Set<string>;
  creatorIds: Set<string>;
  allDisabled: boolean;
  desiredEnabled: boolean;
  apply: boolean;
}

function gathererSetCrmLoginEnabledCollectListArg(
  arg: string,
  prefix: string,
  target: Set<string>,
  normalize: (value: string) => string
): void {
  const raw = arg.slice(prefix.length);
  for (const part of raw.split(",")) {
    const normalized = normalize(part);
    if (normalized) {
      target.add(normalized);
    }
  }
}

function gathererSetCrmLoginEnabledNormalizeUsername(value: string): string {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

function gathererSetCrmLoginEnabledNormalizeCreatorId(value: string): string {
  return value.trim().replace(/\D/g, "");
}

function gathererSetCrmLoginEnabledParseArgs(
  argv: string[]
): GathererSetCrmLoginEnabledArgs | null {
  const usernames = new Set<string>();
  const creatorIds = new Set<string>();
  let allDisabled = false;
  let desiredEnabled = true;
  let apply = false;

  for (const raw of argv) {
    const arg = raw.trim();
    if (!arg) {
      continue;
    }
    if (arg === "--apply") {
      apply = true;
    } else if (arg === "--all-disabled") {
      allDisabled = true;
    } else if (arg.startsWith("--username=")) {
      gathererSetCrmLoginEnabledCollectListArg(
        arg,
        "--username=",
        usernames,
        gathererSetCrmLoginEnabledNormalizeUsername
      );
    } else if (arg.startsWith("--id=")) {
      gathererSetCrmLoginEnabledCollectListArg(
        arg,
        "--id=",
        creatorIds,
        gathererSetCrmLoginEnabledNormalizeCreatorId
      );
    } else if (arg.startsWith("--value=")) {
      const value = arg.slice("--value=".length).trim().toLowerCase();
      if (value !== "true" && value !== "false") {
        logError(`--value must be true or false, received "${value}"`, GATHERER_SET_CRM_LOGIN_ENABLED_SOURCE);
        return null;
      }
      desiredEnabled = value === "true";
    } else {
      logError(`Unrecognized argument "${arg}"`, GATHERER_SET_CRM_LOGIN_ENABLED_SOURCE);
      return null;
    }
  }

  if (usernames.size === 0 && creatorIds.size === 0 && !allDisabled) {
    return null;
  }

  // --all-disabled means "re-enable everyone currently blocked"; pairing it with
  // --value=false would disable the entire roster, which is never intended.
  if (allDisabled && !desiredEnabled) {
    logError(
      "--all-disabled cannot be combined with --value=false",
      GATHERER_SET_CRM_LOGIN_ENABLED_SOURCE
    );
    return null;
  }

  return { usernames, creatorIds, allDisabled, desiredEnabled, apply };
}

// MARK: - Sheet Helpers

/** Converts a zero-based column index to an A1 column reference (0 -> A, 26 -> AA). */
function gathererSetCrmLoginEnabledColumnToA1(index: number): string {
  let remaining = index + 1;
  let reference = "";
  while (remaining > 0) {
    const remainder = (remaining - 1) % 26;
    reference = String.fromCharCode(65 + remainder) + reference;
    remaining = Math.floor((remaining - 1) / 26);
  }
  return reference;
}

/**
 * Mirrors infiniviewLoginAccessParseLoginEnabledField on the InfiniView backend:
 * only explicit falsey values deny login, blank means enabled.
 */
function gathererSetCrmLoginEnabledCellDeniesLogin(rawCell: string): boolean {
  const normalized = rawCell.trim().toLowerCase();
  return normalized === "false" || normalized === "0";
}

interface GathererSetCrmLoginEnabledColumnMap {
  loginEnabledIndex: number;
  usernameIndex: number;
  creatorIdIndex: number;
}

function gathererSetCrmLoginEnabledResolveColumns(
  headerRow: string[]
): GathererSetCrmLoginEnabledColumnMap | null {
  let loginEnabledIndex = -1;
  let usernameIndex = -1;
  let creatorIdIndex = -1;

  headerRow.forEach((header, index) => {
    const field = readExternalCrmSheetMapHeader(String(header ?? ""));
    if (field === "login_enabled" && loginEnabledIndex === -1) {
      loginEnabledIndex = index;
    } else if (field === "tiktok_username" && usernameIndex === -1) {
      usernameIndex = index;
    } else if (field === "backstage_creator_id" && creatorIdIndex === -1) {
      creatorIdIndex = index;
    }
  });

  if (loginEnabledIndex === -1) {
    logError(
      'CRM sheet has no login_enabled column (accepted headers include "Login Enable", "Login Enabled", "login_enabled")',
      GATHERER_SET_CRM_LOGIN_ENABLED_SOURCE
    );
    return null;
  }
  if (usernameIndex === -1 && creatorIdIndex === -1) {
    logError(
      "CRM sheet has neither a TikTok username nor a creator id column, so rows cannot be matched",
      GATHERER_SET_CRM_LOGIN_ENABLED_SOURCE
    );
    return null;
  }

  return { loginEnabledIndex, usernameIndex, creatorIdIndex };
}

// MARK: - Target Tab Durability Warning

/**
 * When GOOGLE_CRM_SHEET_TAB is unset the pipeline reads the leftmost tab. If the
 * CRM exports a fresh dated tab on each run, that leftmost tab is transient and
 * an edit written here is superseded the moment a newer export lands. Operators
 * must know that before they treat a write as permanent.
 */
async function gathererSetCrmLoginEnabledWarnIfTargetTabIsTransient(
  config: GathererConfig,
  targetTabName: string
): Promise<void> {
  if (config.googleCrmSheetTab) {
    return;
  }

  const sheets = createGoogleSheetsClient(config);
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: config.googleCrmSheetId,
    fields: "sheets.properties.title",
  });
  const tabNames = (meta.data.sheets ?? [])
    .map((sheet) => sheet.properties?.title ?? "")
    .filter((title) => title.length > 0);

  if (tabNames.length <= 1) {
    return;
  }

  logWarn(
    `CRM sheet has ${tabNames.length} tabs and GOOGLE_CRM_SHEET_TAB is unset, so the pipeline ` +
      `reads the leftmost tab ("${targetTabName}"). If the CRM publishes a new export tab, ` +
      "this edit stops being read. Fix login_enabled in the upstream CRM for a durable change.",
    GATHERER_SET_CRM_LOGIN_ENABLED_SOURCE
  );
  logInfo(
    `Leftmost tabs: ${tabNames.slice(0, 5).join(", ")}`,
    GATHERER_SET_CRM_LOGIN_ENABLED_SOURCE
  );
}

// MARK: - Change Planning

interface GathererSetCrmLoginEnabledChange {
  /** 1-based sheet row number, matching what the operator sees in Google Sheets. */
  sheetRowNumber: number;
  username: string;
  creatorId: string;
  currentValue: string;
  nextValue: string;
  a1Range: string;
}

function gathererSetCrmLoginEnabledReadCell(row: string[], index: number): string {
  if (index < 0) {
    return "";
  }
  const value = row[index];
  return value === undefined || value === null ? "" : String(value).trim();
}

function gathererSetCrmLoginEnabledBuildChanges(
  rows: string[][],
  columns: GathererSetCrmLoginEnabledColumnMap,
  args: GathererSetCrmLoginEnabledArgs,
  tabName: string
): {
  changes: GathererSetCrmLoginEnabledChange[];
  alreadyCorrect: number;
  matchedUsernames: Set<string>;
  matchedCreatorIds: Set<string>;
} {
  const nextValue = args.desiredEnabled ? "TRUE" : "FALSE";
  const changes: GathererSetCrmLoginEnabledChange[] = [];
  const matchedUsernames = new Set<string>();
  const matchedCreatorIds = new Set<string>();
  let alreadyCorrect = 0;

  const columnLetter = gathererSetCrmLoginEnabledColumnToA1(columns.loginEnabledIndex);
  const escapedTab = tabName.replace(/'/g, "''");

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex] ?? [];
    const username = gathererSetCrmLoginEnabledNormalizeUsername(
      gathererSetCrmLoginEnabledReadCell(row, columns.usernameIndex)
    );
    const creatorId = gathererSetCrmLoginEnabledNormalizeCreatorId(
      gathererSetCrmLoginEnabledReadCell(row, columns.creatorIdIndex)
    );
    const currentValue = gathererSetCrmLoginEnabledReadCell(
      row,
      columns.loginEnabledIndex
    );

    const targetedByUsername = username.length > 0 && args.usernames.has(username);
    const targetedByCreatorId = creatorId.length > 0 && args.creatorIds.has(creatorId);
    const targetedByAllDisabled =
      args.allDisabled && gathererSetCrmLoginEnabledCellDeniesLogin(currentValue);

    if (!targetedByUsername && !targetedByCreatorId && !targetedByAllDisabled) {
      continue;
    }

    if (targetedByUsername) {
      matchedUsernames.add(username);
    }
    if (targetedByCreatorId) {
      matchedCreatorIds.add(creatorId);
    }

    const currentlyEnabled = !gathererSetCrmLoginEnabledCellDeniesLogin(currentValue);
    if (currentlyEnabled === args.desiredEnabled) {
      alreadyCorrect += 1;
      continue;
    }

    changes.push({
      sheetRowNumber: rowIndex + 1,
      username,
      creatorId,
      currentValue: currentValue || "(blank)",
      nextValue,
      a1Range: `'${escapedTab}'!${columnLetter}${rowIndex + 1}`,
    });
  }

  return { changes, alreadyCorrect, matchedUsernames, matchedCreatorIds };
}

// MARK: - Apply

async function gathererSetCrmLoginEnabledApplyChanges(
  config: GathererConfig,
  changes: GathererSetCrmLoginEnabledChange[]
): Promise<void> {
  const sheets = createGoogleSheetsClient(config);
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: config.googleCrmSheetId,
    requestBody: {
      // USER_ENTERED writes a real boolean so the cell matches the rows that
      // already read as TRUE, rather than a text value that only looks the same.
      valueInputOption: "USER_ENTERED",
      data: changes.map((change) => ({
        range: change.a1Range,
        values: [[change.nextValue]],
      })),
    },
  });
}

// MARK: - Main

async function gathererSetCrmLoginEnabledMain(): Promise<void> {
  const args = gathererSetCrmLoginEnabledParseArgs(process.argv.slice(2));
  if (!args) {
    console.error(
      [
        "",
        "Set the CRM login_enabled flag that gates InfiniView sign-in.",
        "",
        "Usage:",
        "  npx tsx scripts/gathererSetCrmLoginEnabled.ts --username=<name>[,<name>] [--value=true|false] [--apply]",
        "  npx tsx scripts/gathererSetCrmLoginEnabled.ts --id=<backstageCreatorId>[,<id>] [--value=true|false] [--apply]",
        "  npx tsx scripts/gathererSetCrmLoginEnabled.ts --all-disabled [--apply]",
        "",
        "Runs as a dry run unless --apply is passed.",
        "",
      ].join("\n")
    );
    process.exitCode = 1;
    return;
  }

  const config = loadGathererConfig();
  if (!config.googleCrmSheetId) {
    logError(
      "GOOGLE_CRM_SHEET_ID is not configured; nothing to update",
      GATHERER_SET_CRM_LOGIN_ENABLED_SOURCE
    );
    process.exitCode = 1;
    return;
  }

  const sheets = createGoogleSheetsClient(config);
  const { tabName, spreadsheetTitle } = await readExternalCrmSheetResolveTabName(config);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.googleCrmSheetId,
    range: `'${tabName.replace(/'/g, "''")}'!A:ZZ`,
  });
  const rows = (response.data.values ?? []) as string[][];

  if (rows.length < 2) {
    logError(
      `CRM sheet "${spreadsheetTitle}" tab "${tabName}" has no data rows`,
      GATHERER_SET_CRM_LOGIN_ENABLED_SOURCE
    );
    process.exitCode = 1;
    return;
  }

  const columns = gathererSetCrmLoginEnabledResolveColumns(rows[0]);
  if (!columns) {
    process.exitCode = 1;
    return;
  }

  await gathererSetCrmLoginEnabledWarnIfTargetTabIsTransient(config, tabName);

  const { changes, alreadyCorrect, matchedUsernames, matchedCreatorIds } =
    gathererSetCrmLoginEnabledBuildChanges(rows, columns, args, tabName);

  logInfo(
    `CRM sheet "${spreadsheetTitle}" tab "${tabName}": scanned ${rows.length - 1} rows, ` +
      `${changes.length} to change, ${alreadyCorrect} already correct`,
    GATHERER_SET_CRM_LOGIN_ENABLED_SOURCE
  );

  for (const username of args.usernames) {
    if (!matchedUsernames.has(username)) {
      logWarn(
        `No CRM row found for username "${username}"`,
        GATHERER_SET_CRM_LOGIN_ENABLED_SOURCE
      );
    }
  }
  for (const creatorId of args.creatorIds) {
    if (!matchedCreatorIds.has(creatorId)) {
      logWarn(
        `No CRM row found for creator id "${creatorId}"`,
        GATHERER_SET_CRM_LOGIN_ENABLED_SOURCE
      );
    }
  }

  console.log("");
  console.log(`Planned login_enabled changes (${changes.length})`);
  console.log("------------------------------------------------");
  if (changes.length === 0) {
    console.log("Nothing to change.");
  }
  for (const change of changes) {
    console.log(
      `row ${change.sheetRowNumber} | @${change.username || "(no username)"} | id=${
        change.creatorId || "(none)"
      } | ${change.currentValue} -> ${change.nextValue}`
    );
  }
  console.log("");

  if (changes.length === 0) {
    return;
  }

  if (!args.apply) {
    console.log("Dry run. Re-run with --apply to write these cells to the CRM sheet.");
    console.log("");
    return;
  }

  await gathererSetCrmLoginEnabledApplyChanges(config, changes);
  logInfo(
    `Wrote ${changes.length} login_enabled cell(s) to the CRM sheet. ` +
      "InfiniView picks the change up after the next gatherer publish.",
    GATHERER_SET_CRM_LOGIN_ENABLED_SOURCE
  );
}

gathererSetCrmLoginEnabledMain().catch((error) => {
  logError(
    `Failed to set CRM login_enabled: ${String(error)}`,
    GATHERER_SET_CRM_LOGIN_ENABLED_SOURCE
  );
  process.exitCode = 1;
});

// Suggestions For Features and Additions Later:
// - Record an audit trail row (who/when/why) alongside each login_enabled flip.
// - Reject re-enabling a creator who has an active InfiniView account ban.
