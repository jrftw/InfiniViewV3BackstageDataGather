/**
 * Filename: exportPerformanceReport.ts
 * Purpose: Export performance/analytics data from /portal/data/data via notification download.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-07-07
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
  backstageEnsurePerformanceCreatorDataColumnsSelected,
  backstageClickSelectAllCreatorsIfNeeded,
} from "./backstageTransferModal";
import { downloadBackstageExportFromNotifications } from "./backstageNotificationDownload";
import { gathererBackstageExportShapeValidateCreatorDataFile } from "../processing/gathererBackstageExportShapeValidator";
import { gathererEnsureDir } from "../utils/files";
import { gathererRetry } from "../utils/retry";
import { logInfo, logError, logWarn } from "../logging/logger";

// MARK: - Export Strategy

function exportPerformanceShouldCustomizeColumnsOnAttempt(attemptIndex: number): boolean {
  if (process.env.GATHERER_PERFORMANCE_CUSTOMIZE_COLUMNS === "true") {
    return true;
  }
  if (process.env.GATHERER_PERFORMANCE_CUSTOMIZE_COLUMNS === "false") {
    return false;
  }
  // Default: first attempt matches manual Backstage export (no Customize data); retry with customize.
  return attemptIndex > 1;
}

async function exportPerformanceOpenBulkExportModal(page: Page): Promise<void> {
  await backstageClickRace(
    page,
    [
      BACKSTAGE_SELECTORS.performanceExportTrigger,
      "div.semi-card-body button:nth-of-type(2)",
      '#neo-layout-fmp button:has-text("Export")',
      'button:has-text("Export")',
    ],
    "Performance — open export"
  );
  await page.waitForTimeout(BACKSTAGE_SELECTORS.modalSettleMs);
}

async function exportPerformanceConfirmBulkExport(page: Page): Promise<void> {
  await backstageClickSelectAllCreatorsIfNeeded(page, "Performance");
  await dismissBackstagePopups(page);
  await page.waitForTimeout(BACKSTAGE_SELECTORS.modalSettleMs);

  const performanceExportButton = page
    .getByRole("button", { name: /^Export$/i })
    .or(page.locator(BACKSTAGE_SELECTORS.performanceBulkExportButton))
    .or(page.locator('div.liveplatform-flex-item > button.semi-button-primary:has-text("Export")'))
    .or(page.locator('div.liveplatform-flex-item > button.semi-button-primary'))
    .first();

  await performanceExportButton.waitFor({
    state: "visible",
    timeout: BACKSTAGE_SELECTORS.modalWaitTimeoutMs,
  });
  logInfo("Performance — confirm bulk export", "exportPerformance");
  await performanceExportButton.click({ timeout: BACKSTAGE_SELECTORS.actionTimeoutMs });
}

function exportPerformanceValidateDownloadedFile(targetPath: string): void {
  const shape = gathererBackstageExportShapeValidateCreatorDataFile(targetPath);
  logInfo(
    `Performance export shape — profile=${shape.profile}, total_diamonds=${shape.columnMap.total_diamonds ?? "MISSING"}, data_period=${shape.columnMap.data_period ?? "MISSING"}`,
    "exportPerformance",
    { rawHeaderSample: shape.rawHeaders.slice(0, 12) }
  );

  if (!shape.valid) {
    throw new Error(
      `Creator Data export has wrong column shape (${shape.profile}). Expected Data period + Diamonds. Got: ${shape.rawHeaders.slice(0, 12).join(" | ")}`
    );
  }

  if (shape.profile === "hybrid_l30d_labeled") {
    logWarn(
      "Creator Data export used hybrid L30D-labeled fallback — classic analytics columns were not present",
      "exportPerformance"
    );
  }
}

// MARK: - Export Performance Report

export async function exportBackstagePerformanceReport(
  page: Page,
  config: GathererConfig,
  timestamp: string
): Promise<string> {
  const targetPath = path.join(config.localRawDir, `backstage-performance-${timestamp}.xlsx`);
  gathererEnsureDir(config.localRawDir);

  return gathererRetry(
    async (attemptIndex) => {
      const customizeColumns = exportPerformanceShouldCustomizeColumnsOnAttempt(attemptIndex);
      const url = buildBackstagePerformanceDataUrl(config);
      const range = gathererUnixPerformanceRange(
        config.timezone,
        config.backstagePerformanceDateRange,
        config.backstagePerformanceDays
      );
      logInfo(
        `Navigating to Creator Data (${config.backstagePerformanceDateRange} range): ${url}`,
        "exportPerformance",
        { rangeLabel: range.label, attemptIndex, customizeColumns }
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

      if (customizeColumns) {
        logInfo("Performance — using Customize data column reset (retry/fallback path)", "exportPerformance");
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
        await backstageEnsurePerformanceCreatorDataColumnsSelected(page, "Performance");
      } else {
        logInfo(
          "Performance — skipping Customize data (default analytics export, matches manual Backstage download)",
          "exportPerformance"
        );
      }

      await exportPerformanceOpenBulkExportModal(page);
      await exportPerformanceConfirmBulkExport(page);

      await page.waitForTimeout(3000);
      await downloadBackstageExportFromNotifications(page, targetPath, "performance");
      exportPerformanceValidateDownloadedFile(targetPath);

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
