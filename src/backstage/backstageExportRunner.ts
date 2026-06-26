/**
 * Filename: backstageExportRunner.ts
 * Purpose: Orchestrates both Backstage exports in one browser session.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-23
 * Platform Compatibility: Playwright (Chromium)
 */

import fs from "fs";
import { GathererConfig } from "../config";
import { launchBackstageBrowser, closeBackstageBrowser } from "./browser";
import { exportBackstagePerformanceReport } from "./exportPerformanceReport";
import { exportBackstageManagementReport } from "./exportManagementReport";
import { applyBackstageViewport, dismissBackstagePopups } from "./backstagePageHelpers";
import { ensureBackstageAuthenticated } from "./backstageSession";
import { gathererInvalidateStaleBackstageAuthIfNeeded } from "./backstageSessionRelogin";
import { logInfo, logError } from "../logging/logger";

// MARK: - Export Result

export interface BackstageExportResult {
  performanceFile: string;
  managementFile: string;
}

// MARK: - Validate Downloaded Files

function validateBackstageExportFileExists(filePath: string, label: string): void {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} file was not saved: ${filePath}`);
  }
  const size = fs.statSync(filePath).size;
  if (size < 100) {
    throw new Error(`${label} file appears empty (${size} bytes): ${filePath}`);
  }
}

// MARK: - Run Exports

export async function runBackstageExports(
  config: GathererConfig,
  timestamp: string
): Promise<BackstageExportResult> {
  logInfo("Starting Backstage browser exports", "backstageExportRunner");
  gathererInvalidateStaleBackstageAuthIfNeeded(config);
  const session = await launchBackstageBrowser(config);

  try {
    await applyBackstageViewport(session.page);
    pageSetDefaultTimeout(session.page);

    await ensureBackstageAuthenticated(session, config);
    await dismissBackstagePopups(session.page);

    logInfo("Export 1/2 — Manage creators (anchor/list)", "backstageExportRunner");
    const managementFile = await exportBackstageManagementReport(session.page, config, timestamp);
    validateBackstageExportFileExists(managementFile, "Management");

    await dismissBackstagePopups(session.page);

    logInfo("Export 2/2 — Creator Data (data/data)", "backstageExportRunner");
    const performanceFile = await exportBackstagePerformanceReport(session.page, config, timestamp);
    validateBackstageExportFileExists(performanceFile, "Performance");

    logInfo("Both Backstage exports completed", "backstageExportRunner", {
      managementFile,
      performanceFile,
    });

    return { performanceFile, managementFile };
  } catch (error) {
    logError("Backstage export runner failed", "backstageExportRunner", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    await closeBackstageBrowser(session);
  }
}

function pageSetDefaultTimeout(page: import("playwright").Page): void {
  page.setDefaultTimeout(60_000);
}

// Suggestions For Features and Additions Later:
// - Headed debug mode via GATHERER_BACKSTAGE_HEADED=true
