/**
 * Filename: exportManagementReport.ts
 * Purpose: Export management/creator list from /portal/anchor/list via notification download.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-23
 * Platform Compatibility: Playwright (Chromium)
 */

import path from "path";
import { Page } from "playwright";
import { GathererConfig } from "../config";
import { BACKSTAGE_SELECTORS } from "./backstageSelectors";
import {
  waitForBackstagePageReady,
  dismissBackstagePopups,
  backstageClickRace,
} from "./backstagePageHelpers";
import {
  backstageEnsureAllExportColumnsSelected,
  backstageClickSelectAllCreatorsIfNeeded,
} from "./backstageTransferModal";
import { downloadBackstageExportFromNotifications } from "./backstageNotificationDownload";
import { gathererEnsureDir } from "../utils/files";
import { gathererRetry } from "../utils/retry";
import { logInfo, logError } from "../logging/logger";

// MARK: - Confirm Bulk Export

async function backstageManagementConfirmBulkExport(page: Page): Promise<void> {
  const exportSelectors = [
    BACKSTAGE_SELECTORS.managementBulkExportButton,
    'div.liveplatform-flex-item > button.semi-button-primary:has-text("Export")',
    'div.liveplatform-flex-item > button.semi-button-primary',
  ];

  await backstageClickRace(page, exportSelectors, "Management — Export (bulk confirm)");
}

// MARK: - Export Management Report

export async function exportBackstageManagementReport(
  page: Page,
  config: GathererConfig,
  timestamp: string
): Promise<string> {
  const targetPath = path.join(config.localRawDir, `backstage-management-${timestamp}.xlsx`);
  gathererEnsureDir(config.localRawDir);

  return gathererRetry(
    async () => {
      const url = `${config.backstageBaseUrl}${BACKSTAGE_SELECTORS.managementListPath}`;
      logInfo(`Navigating to management list: ${url}`, "exportManagement");

      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: BACKSTAGE_SELECTORS.navigationTimeoutMs,
      });
      await waitForBackstagePageReady(page);
      await dismissBackstagePopups(page);

      if (page.url().includes(BACKSTAGE_SELECTORS.loginUrlFragment)) {
        throw new Error("Session lost during management export. Run gather again after logging in.");
      }

      await backstageClickRace(
        page,
        [
          "div.semi-tabs-bar button:nth-of-type(2) > span",
          BACKSTAGE_SELECTORS.managementListTabSecond,
          "div.semi-tabs-bar button:nth-of-type(2)",
        ],
        "Management — second tab"
      );
      await page.waitForTimeout(BACKSTAGE_SELECTORS.modalSettleMs);

      await backstageEnsureAllExportColumnsSelected(page, "Management");

      await dismissBackstagePopups(page);

      await backstageClickRace(
        page,
        [
          BACKSTAGE_SELECTORS.managementExportTrigger,
          "div.semi-tabs-bar-extra > button:nth-of-type(1)",
          '#neo-layout-fmp div.semi-tabs-bar-extra > button:nth-of-type(1)',
          'button:has-text("Export")',
        ],
        "Management — Export button (tabs bar)"
      );
      await page.waitForTimeout(BACKSTAGE_SELECTORS.modalSettleMs);

      await backstageClickSelectAllCreatorsIfNeeded(page, "Management");
      await backstageManagementConfirmBulkExport(page);

      await page.waitForTimeout(3000);
      await downloadBackstageExportFromNotifications(page, targetPath, "management");

      logInfo(`Management export saved: ${targetPath}`, "exportManagement");
      return targetPath;
    },
    { maxAttempts: 2, source: "exportManagement" }
  ).catch(async (error) => {
    const screenshotPath = path.join(config.localLogDir, `fail-management-${timestamp}.png`);
    gathererEnsureDir(config.localLogDir);
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);
    logError("Management export failed", "exportManagement", {
      error: error instanceof Error ? error.message : String(error),
      screenshotPath,
    });
    throw error;
  });
}

// Suggestions For Features and Additions Later:
// - Validate downloaded file columns before returning
