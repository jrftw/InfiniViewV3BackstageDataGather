/**
 * Filename: backstageNotificationDownload.ts
 * Purpose: Download exported files via Backstage notification toast → View → download.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-23
 * Dependencies: playwright
 * Platform Compatibility: Playwright (Chromium)
 */

import { Page } from "playwright";
import { BACKSTAGE_SELECTORS } from "./backstageSelectors";
import { backstageClickRace } from "./backstagePageHelpers";
import { logInfo, logDebug } from "../logging/logger";

// MARK: - Visibility Helper

async function backstageRaceVisible(
  page: Page,
  selectors: string[],
  timeoutMs: number
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const selector of selectors) {
      if (await page.locator(selector).first().isVisible().catch(() => false)) {
        return true;
      }
    }
    await page.waitForTimeout(500);
  }
  return false;
}

// MARK: - Management Export Notification Flow (recorded)

async function backstageOpenManagementExportNotifications(page: Page): Promise<void> {
  logInfo("Waiting for export ready notification", "backstageNotificationDownload");

  const toastSelectors = [
    "div.semi-notification-notice-inner",
    "div.semi-notification-notice-content",
  ];

  await backstageRaceVisible(page, toastSelectors, 60_000);

  const toastInner = page.locator("div.semi-notification-notice-inner").first();
  if (await toastInner.isVisible().catch(() => false)) {
    logDebug("Export toast visible", "backstageNotificationDownload");
  }

  const viewSelectors = [
    BACKSTAGE_SELECTORS.notificationViewButton,
    'div.semi-notification-notice-content button:has-text("View")',
    'button:has-text("View")',
  ];

  await backstageClickRace(page, viewSelectors, "Notification View");
  await page.waitForTimeout(1000);

  const noticeMenuSelectors = [
    BACKSTAGE_SELECTORS.noticeMenuItemFirst,
    "#notice-menu-item-0 > span.semi-badge",
    "#notice-menu-item-0",
  ];

  const menuVisible = await backstageRaceVisible(page, noticeMenuSelectors, 15_000);
  if (menuVisible) {
    await backstageClickRace(page, noticeMenuSelectors, "Notice menu first item");
    await page.waitForTimeout(800);
  } else {
    logDebug("Notice menu item not found — trying bell fallback", "backstageNotificationDownload");
    const bellSelectors = [
      BACKSTAGE_SELECTORS.notificationBellButton,
      "#header button:has(svg)",
    ];
    if (await backstageRaceVisible(page, bellSelectors, 5000)) {
      await backstageClickRace(page, bellSelectors, "Notification bell fallback");
      await page.waitForTimeout(1000);
    }
  }
}

// MARK: - Download From Notifications

export async function downloadBackstageExportFromNotifications(
  page: Page,
  savePath: string,
  exportKind: "management" | "performance" = "management"
): Promise<void> {
  logInfo(`Starting notification download (${exportKind})`, "backstageNotificationDownload");

  if (exportKind === "management") {
    await backstageOpenManagementExportNotifications(page);
  } else {
    await backstageOpenPerformanceExportNotifications(page);
  }

  const downloadSelectors = [
    BACKSTAGE_SELECTORS.notificationDownloadLink,
    "#backstage-notice-list-content div.footer-j6nxQJ > span",
    '#backstage-notice-list-content span:has-text("Download")',
    '#backstage-notice-list-content a:has-text("Download")',
  ];

  const ready = await backstageRaceVisible(page, downloadSelectors, BACKSTAGE_SELECTORS.notificationWaitMs);
  if (!ready) {
    throw new Error("Export download link did not appear in Backstage notifications");
  }

  const downloadPromise = page.waitForEvent("download", {
    timeout: BACKSTAGE_SELECTORS.downloadTimeoutMs,
  });

  await backstageClickRace(page, downloadSelectors, "Notification download link");

  const download = await downloadPromise;
  await download.saveAs(savePath);

  logInfo(`Export downloaded to ${savePath}`, "backstageNotificationDownload");
}

async function backstageOpenPerformanceExportNotifications(page: Page): Promise<void> {
  const viewSelectors = [
    BACKSTAGE_SELECTORS.notificationViewButton,
    'div.semi-notification-notice-content button:has-text("View")',
    'button:has-text("View")',
  ];

  if (await backstageRaceVisible(page, viewSelectors, 60_000)) {
    await backstageClickRace(page, viewSelectors, "Notification View");
    await page.waitForTimeout(1500);
    return;
  }

  const bellSelectors = [BACKSTAGE_SELECTORS.notificationBellButton, "#header button:has(svg)"];
  await backstageClickRace(page, bellSelectors, "Notification bell");
  await page.waitForTimeout(1500);
}

// Suggestions For Features and Additions Later:
// - Poll until export status shows complete before download click
