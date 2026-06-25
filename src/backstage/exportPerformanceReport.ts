/**
 * Filename: exportPerformanceReport.ts
 * Purpose: Export performance/analytics data from /portal/data/data via notification download.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-23
 * Platform Compatibility: Playwright (Chromium)
 */

import path from "path";
import { Page } from "playwright";
import { GathererConfig } from "../config";
import { BACKSTAGE_SELECTORS } from "./backstageSelectors";
import {
  buildBackstagePerformanceDataUrl,
  waitForBackstagePageReady,
  dismissBackstagePopups,
  backstageClickRace,
} from "./backstagePageHelpers";
import { gathererUnixPerformanceRange } from "../utils/dates";
import {
  backstageEnsureAllExportColumnsSelected,
  backstageClickSelectAllCreatorsIfNeeded,
} from "./backstageTransferModal";
import { downloadBackstageExportFromNotifications } from "./backstageNotificationDownload";
import { gathererEnsureDir } from "../utils/files";
import { gathererRetry } from "../utils/retry";
import { logInfo, logError } from "../logging/logger";

// MARK: - Export Performance Report

export async function exportBackstagePerformanceReport(
  page: Page,
  config: GathererConfig,
  timestamp: string
): Promise<string> {
  const targetPath = path.join(config.localRawDir, `backstage-performance-${timestamp}.xlsx`);
  gathererEnsureDir(config.localRawDir);

  return gathererRetry(
    async () => {
      const url = buildBackstagePerformanceDataUrl(config);
      const range = gathererUnixPerformanceRange(
        config.timezone,
        config.backstagePerformanceDateRange,
        config.backstagePerformanceDays
      );
      logInfo(
        `Navigating to Creator Data (${config.backstagePerformanceDateRange} range): ${url}`,
        "exportPerformance",
        { rangeLabel: range.label }
      );

      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: BACKSTAGE_SELECTORS.navigationTimeoutMs,
      });
      await waitForBackstagePageReady(page);
      await dismissBackstagePopups(page);

      if (page.url().includes(BACKSTAGE_SELECTORS.loginUrlFragment)) {
        throw new Error("Session lost during performance export. Run gather again after logging in.");
      }

      await backstageClickRace(
        page,
        [
          BACKSTAGE_SELECTORS.performanceCustomizeDataButton,
          'button:has-text("Customize data")',
          "div.semi-card-body button:nth-of-type(1)",
        ],
        "Performance — Customize data"
      );
      await page.waitForTimeout(BACKSTAGE_SELECTORS.modalSettleMs);

      await backstageEnsureAllExportColumnsSelected(page, "Performance");

      await backstageClickRace(
        page,
        [
          BACKSTAGE_SELECTORS.performanceExportTrigger,
          "div.semi-card-body button:nth-of-type(2)",
          '#neo-layout-fmp button:has-text("Export")',
        ],
        "Performance — open export"
      );
      await page.waitForTimeout(BACKSTAGE_SELECTORS.modalSettleMs);

      await backstageClickSelectAllCreatorsIfNeeded(page, "Performance");

      await backstageClickRace(
        page,
        [
          BACKSTAGE_SELECTORS.performanceBulkExportButton,
          "div.liveplatform-flex-item > button.semi-button-primary",
          'div.liveplatform-flex-item button:has-text("Export")',
        ],
        "Performance — confirm bulk export"
      );

      await page.waitForTimeout(3000);
      await downloadBackstageExportFromNotifications(page, targetPath, "performance");

      logInfo(`Performance export saved: ${targetPath}`, "exportPerformance");
      return targetPath;
    },
    { maxAttempts: 2, source: "exportPerformance" }
  ).catch(async (error) => {
    const screenshotPath = path.join(config.localLogDir, `fail-performance-${timestamp}.png`);
    gathererEnsureDir(config.localLogDir);
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);
    logError("Performance export failed", "exportPerformance", {
      error: error instanceof Error ? error.message : String(error),
      screenshotPath,
    });
    throw error;
  });
}

// Suggestions For Features and Additions Later:
// - Validate downloaded file columns before returning
