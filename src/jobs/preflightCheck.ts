/**
 * Filename: preflightCheck.ts
 * Purpose: Verify gatherer config, Backstage auth, Google, and local paths before a run.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-23
 * Dependencies: googleapis, playwright
 * Platform Compatibility: Node.js 18+ (Windows server PC)
 */

import fs from "fs";
import { chromium } from "playwright";
import { GathererConfig } from "../config";
import { isGoogleConfigured } from "../google/googleAuth";
import { createGoogleSheetsClient } from "../google/sheetsClient";
import { createGoogleDriveClient } from "../google/driveClient";
import {
  gathererLogBanner,
  gathererLogFail,
  gathererLogInfo,
  gathererLogOk,
  gathererLogSection,
  gathererLogWarn,
  gathererLogWorking,
  isGathererFriendlyLoggingEnabled,
} from "../logging/friendlyLog";
import { logInfo, logWarn, logError } from "../logging/logger";
import {
  gathererFormatBusinessDateKey,
  gathererFormatClosingBusinessDateKey,
} from "../utils/dates";

// MARK: - Types

export type PreflightCheckStatus = "pass" | "warn" | "fail";

export interface PreflightCheckItem {
  id: string;
  label: string;
  status: PreflightCheckStatus;
  message: string;
  blocking: boolean;
}

export interface PreflightCheckResult {
  ok: boolean;
  checks: PreflightCheckItem[];
  blockingErrors: string[];
  warnings: string[];
}

// MARK: - Check Helpers

function preflightAddCheck(
  checks: PreflightCheckItem[],
  item: PreflightCheckItem
): void {
  checks.push(item);
  if (!isGathererFriendlyLoggingEnabled()) return;

  if (item.status === "pass") {
    gathererLogOk(item.label, item.message);
  } else if (item.status === "warn") {
    gathererLogWarn(item.label, item.message);
  } else {
    gathererLogFail(item.label, item.message);
  }
}

function preflightDirWritable(dirPath: string): boolean {
  try {
    fs.accessSync(dirPath, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

// MARK: - Run Preflight

export async function runGathererPreflightCheck(
  config: GathererConfig
): Promise<PreflightCheckResult> {
  const checks: PreflightCheckItem[] = [];

  if (isGathererFriendlyLoggingEnabled()) {
    gathererLogBanner(
      "InfiniView V3 Backstage Gatherer — Preflight Check",
      "Verifying connections before export…"
    );
    gathererLogSection("Environment & folders");
  }

  const nodeMajor = Number(process.version.replace("v", "").split(".")[0]);
  preflightAddCheck(checks, {
    id: "node_version",
    label: "Node.js version",
    status: nodeMajor >= 18 ? "pass" : "fail",
    message: nodeMajor >= 18 ? process.version : `${process.version} (need 18+)`,
    blocking: nodeMajor < 18,
  });

  const businessDayKey = gathererFormatBusinessDateKey(
    config.timezone,
    config.gathererDailyArchiveTime
  );
  const scheduleSummary =
    config.gathererScheduleMode === "random"
      ? `random ~${config.gathererRunsPerDay}/day ${config.gathererActiveHoursStart}-${config.gathererActiveHoursEnd}`
      : config.runSchedules.join(", ");

  preflightAddCheck(checks, {
    id: "timezone",
    label: "Timezone",
    status: "pass",
    message: `${config.timezone} (${scheduleSummary})`,
    blocking: false,
  });

  preflightAddCheck(checks, {
    id: "business_day_cutoff",
    label: "Business day cutoff",
    status: "pass",
    message: `${config.gathererDailyArchiveTime} ${config.timezone} (today: ${businessDayKey}; closes ${gathererFormatClosingBusinessDateKey(config.timezone, config.gathererDailyArchiveTime)})`,
    blocking: false,
  });

  for (const dir of [
    config.localRawDir,
    config.localProcessedDir,
    config.localLogDir,
  ]) {
    const exists = fs.existsSync(dir);
    const writable = exists && preflightDirWritable(dir);
    preflightAddCheck(checks, {
      id: `dir_${dir}`,
      label: `Folder ${dir}`,
      status: writable ? "pass" : exists ? "warn" : "pass",
      message: writable ? "ready" : exists ? "exists but not writable" : "will be created",
      blocking: false,
    });
  }

  if (isGathererFriendlyLoggingEnabled()) {
    gathererLogSection("Backstage login");
  }

  const hasCredentials = Boolean(config.backstageEmail && config.backstagePassword);
  const authFileExists = fs.existsSync(config.backstageAuthStatePath);

  preflightAddCheck(checks, {
    id: "backstage_credentials",
    label: "Backstage .env login",
    status: hasCredentials ? "pass" : authFileExists ? "warn" : "fail",
    message: hasCredentials
      ? "email + password set"
      : authFileExists
        ? "no password in .env — using saved session only"
        : "set BACKSTAGE_EMAIL/PASSWORD or run npm run login",
    blocking: !hasCredentials && !authFileExists,
  });

  if (authFileExists) {
    try {
      const raw = fs.readFileSync(config.backstageAuthStatePath, "utf-8");
      const parsed = JSON.parse(raw) as { cookies?: unknown[] };
      const cookieCount = parsed.cookies?.length ?? 0;
      preflightAddCheck(checks, {
        id: "backstage_session",
        label: "Saved Backstage session",
        status: cookieCount > 0 ? "pass" : "warn",
        message:
          cookieCount > 0
            ? `${cookieCount} cookies in data/auth/backstage-auth.json`
            : "session file empty — login may be required",
        blocking: false,
      });
    } catch {
      preflightAddCheck(checks, {
        id: "backstage_session",
        label: "Saved Backstage session",
        status: "warn",
        message: "auth file invalid — run npm run login:test",
        blocking: false,
      });
    }
  } else {
    preflightAddCheck(checks, {
      id: "backstage_session",
      label: "Saved Backstage session",
      status: hasCredentials ? "warn" : "fail",
      message: hasCredentials
        ? "no saved session yet — first run will log in"
        : "missing data/auth/backstage-auth.json",
      blocking: !hasCredentials,
    });
  }

  preflightAddCheck(checks, {
    id: "backstage_region",
    label: "Agency region target",
    status: "pass",
    message: `${config.backstageAgencyRegion}${config.backstageForceUsPlus ? " (auto-switch on)" : ""}`,
    blocking: false,
  });

  if (isGathererFriendlyLoggingEnabled()) {
    gathererLogSection("Playwright browser");
    gathererLogWorking("Checking Chromium install");
  }

  try {
    const browserPath = chromium.executablePath();
    const browserReady = fs.existsSync(browserPath);
    preflightAddCheck(checks, {
      id: "playwright_chromium",
      label: "Playwright Chromium",
      status: browserReady ? "pass" : "fail",
      message: browserReady ? "installed" : "run: npx playwright install chromium",
      blocking: !browserReady,
    });
  } catch (error) {
    preflightAddCheck(checks, {
      id: "playwright_chromium",
      label: "Playwright Chromium",
      status: "fail",
      message: error instanceof Error ? error.message : "not available",
      blocking: true,
    });
  }

  if (isGathererFriendlyLoggingEnabled()) {
    gathererLogSection("Google Sheets & Drive");
  }

  const googlePartial =
    Boolean(config.googleServiceAccountEmail) ||
    Boolean(config.googleServiceAccountPrivateKey) ||
    Boolean(config.googleDriveFolderId) ||
    Boolean(config.googleMasterSheetId);

  if (!googlePartial) {
    preflightAddCheck(checks, {
      id: "google_config",
      label: "Google integration",
      status: "warn",
      message: "not configured — local files only",
      blocking: false,
    });
  } else if (!isGoogleConfigured(config)) {
    preflightAddCheck(checks, {
      id: "google_config",
      label: "Google .env variables",
      status: "fail",
      message: "incomplete — need email, private key, folder ID, and sheet ID",
      blocking: false,
    });
  } else {
    preflightAddCheck(checks, {
      id: "google_config",
      label: "Google .env variables",
      status: "pass",
      message: "all four values set",
      blocking: false,
    });

    if (isGathererFriendlyLoggingEnabled()) {
      gathererLogWorking("Connecting to Google Sheet");
    }

    try {
      const sheets = createGoogleSheetsClient(config);
      const meta = await sheets.spreadsheets.get({
        spreadsheetId: config.googleMasterSheetId,
        fields: "properties.title,sheets.properties.title",
      });
      const tabCount = meta.data.sheets?.length ?? 0;
      preflightAddCheck(checks, {
        id: "google_sheet",
        label: "Google Sheet",
        status: "pass",
        message: `"${meta.data.properties?.title ?? "Sheet"}" (${tabCount} tabs)`,
        blocking: false,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      preflightAddCheck(checks, {
        id: "google_sheet",
        label: "Google Sheet",
        status: "fail",
        message: `${msg} — share sheet with service account email`,
        blocking: false,
      });
    }

    if (config.googleCrmSheetId) {
      if (isGathererFriendlyLoggingEnabled()) {
        gathererLogWorking("Connecting to external CRM sheet (email/phone)");
      }

      try {
        const sheets = createGoogleSheetsClient(config);
        const meta = await sheets.spreadsheets.get({
          spreadsheetId: config.googleCrmSheetId,
          fields: "properties.title,sheets.properties.title",
        });
        const leftmostTab = meta.data.sheets?.[0]?.properties?.title ?? "(none)";
        const tabLabel = config.googleCrmSheetTab || leftmostTab;
        preflightAddCheck(checks, {
          id: "google_crm_sheet",
          label: "External CRM sheet",
          status: "pass",
          message: `"${meta.data.properties?.title ?? "CRM Sheet"}" tab "${tabLabel}"`,
          blocking: false,
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        preflightAddCheck(checks, {
          id: "google_crm_sheet",
          label: "External CRM sheet",
          status: "warn",
          message: `${msg} — share CRM sheet with service account (Viewer or Editor)`,
          blocking: false,
        });
      }
    }

    if (config.googleDipSheetId) {
      if (isGathererFriendlyLoggingEnabled()) {
        gathererLogWorking("Connecting to external DIP sheet (Diamond Incentive)");
      }

      try {
        const sheets = createGoogleSheetsClient(config);
        const meta = await sheets.spreadsheets.get({
          spreadsheetId: config.googleDipSheetId,
          fields: "properties.title,sheets.properties(title,sheetId)",
        });
        const sheetTabs = meta.data.sheets ?? [];
        let tabLabel = config.googleDipSheetTab;
        if (!tabLabel && config.googleDipSheetGid) {
          tabLabel =
            sheetTabs.find(
              (sheet) => String(sheet.properties?.sheetId ?? "") === String(config.googleDipSheetGid)
            )?.properties?.title ?? `gid ${config.googleDipSheetGid}`;
        }
        if (!tabLabel) {
          tabLabel = sheetTabs[0]?.properties?.title ?? "(none)";
        }
        preflightAddCheck(checks, {
          id: "google_dip_sheet",
          label: "External DIP sheet",
          status: "pass",
          message: `"${meta.data.properties?.title ?? "DIP Sheet"}" tab "${tabLabel}"`,
          blocking: false,
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        preflightAddCheck(checks, {
          id: "google_dip_sheet",
          label: "External DIP sheet",
          status: "warn",
          message: `${msg} — share DIP sheet with service account (Viewer or Editor)`,
          blocking: false,
        });
      }
    }

    if (isGathererFriendlyLoggingEnabled()) {
      gathererLogWorking("Connecting to Google Drive daily archive folder");
    }

    const driveFolderToTest =
      config.googleDriveDailyArchiveFolderId || config.googleDriveFolderId;

    if (driveFolderToTest) {
      try {
        const drive = createGoogleDriveClient(config);
        const folder = await drive.files.get({
          fileId: driveFolderToTest,
          fields: "id,name",
          supportsAllDrives: true,
        });
        const folderLabel = config.googleDriveDailyArchiveFolderId
          ? "Google Drive daily archive folder"
          : "Google Drive folder";
        preflightAddCheck(checks, {
          id: "google_drive",
          label: folderLabel,
          status: "pass",
          message: `"${folder.data.name ?? "Folder"}"`,
          blocking: false,
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        preflightAddCheck(checks, {
          id: "google_drive",
          label: config.googleDriveDailyArchiveFolderId
            ? "Google Drive daily archive folder"
            : "Google Drive folder",
          status: "warn",
          message: `${msg} — share folder with service account (Editor)`,
          blocking: false,
        });
      }
    } else {
      preflightAddCheck(checks, {
        id: "google_drive",
        label: "Google Drive folder",
        status: "warn",
        message: "no GOOGLE_DRIVE_DAILY_ARCHIVE_FOLDER_ID or GOOGLE_DRIVE_FOLDER_ID set",
        blocking: false,
      });
    }
  }

  const blockingErrors = checks
    .filter((c) => c.blocking && c.status === "fail")
    .map((c) => `${c.label}: ${c.message}`);

  const warnings = checks
    .filter((c) => c.status === "warn" || (c.status === "fail" && !c.blocking))
    .map((c) => `${c.label}: ${c.message}`);

  const ok = blockingErrors.length === 0;

  if (isGathererFriendlyLoggingEnabled()) {
    gathererLogSection("Preflight result");
    if (ok) {
      gathererLogOk(
        blockingErrors.length === 0 && warnings.length === 0
          ? "All checks passed — starting gatherer"
          : "Ready to run",
        warnings.length > 0 ? `${warnings.length} warning(s) — see above` : undefined
      );
    } else {
      gathererLogFail("Preflight failed — fix blocking issues before running");
      for (const err of blockingErrors) {
        gathererLogFail(err);
      }
    }
    gathererLogInfo("Tip: run npm run preflight anytime to re-check without exporting");
  }

  logInfo(`Preflight ${ok ? "passed" : "failed"}`, "preflightCheck", {
    pass: checks.filter((c) => c.status === "pass").length,
    warn: checks.filter((c) => c.status === "warn").length,
    fail: checks.filter((c) => c.status === "fail").length,
  });

  for (const warning of warnings) {
    logWarn(warning, "preflightCheck");
  }
  for (const err of blockingErrors) {
    logError(err, "preflightCheck");
  }

  return { ok, checks, blockingErrors, warnings };
}

// Suggestions For Features and Additions Later:
// - Cache Google probe results for 5 minutes on scheduled runs
