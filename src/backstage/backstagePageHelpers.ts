/**
 * Filename: backstagePageHelpers.ts
 * Purpose: Shared Playwright helpers — page ready, popups, locator race, URLs.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-07-07
 * Dependencies: playwright
 * Platform Compatibility: Playwright (Chromium)
 */

import { Page, Locator } from "playwright";
import { GathererConfig } from "../config";
import { BACKSTAGE_SELECTORS } from "./backstageSelectors";
import { logDebug } from "../logging/logger";
import { gathererLogStep, gathererLogStepClick, gathererLogStepOk, gathererLogStepSkip, gathererLogStepWait } from "../logging/gathererStepLogger";
import { gathererUnixPerformanceRange } from "../utils/dates";

// MARK: - Viewport

export async function applyBackstageViewport(page: Page): Promise<void> {
  await page.setViewportSize({
    width: BACKSTAGE_SELECTORS.viewportWidth,
    height: BACKSTAGE_SELECTORS.viewportHeight,
  });
}

// MARK: - Performance Data URL

export function buildBackstagePerformanceDataUrl(config: GathererConfig): string {
  const mode = config.backstagePerformanceDateRange;
  const range = gathererUnixPerformanceRange(
    config.timezone,
    mode,
    config.backstagePerformanceDays
  );

  return `${config.backstageBaseUrl}${BACKSTAGE_SELECTORS.performanceDataPath}?anchorID&endTime=${range.endTime}&startTime=${range.startTime}`;
}

export function buildBackstagePerformanceDataUrlLegacy(
  config: GathererConfig,
  daysBack: number = config.backstagePerformanceDays
): string {
  const endTime = Math.floor(Date.now() / 1000);
  const startTime = endTime - daysBack * 24 * 60 * 60;
  return `${config.backstageBaseUrl}${BACKSTAGE_SELECTORS.performanceDataPath}?anchorID&endTime=${endTime}&startTime=${startTime}`;
}

// MARK: - Page Ready

export async function waitForBackstagePageReady(page: Page): Promise<void> {
  gathererLogStepWait("backstagePageHelpers", "Waiting for Backstage page ready (domcontentloaded + networkidle)");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle", { timeout: BACKSTAGE_SELECTORS.navigationTimeoutMs }).catch(() => {
    logDebug("networkidle timeout — continuing", "backstagePageHelpers");
    gathererLogStepSkip("backstagePageHelpers", "networkidle wait", "timed out — continuing");
  });
  await page.waitForTimeout(BACKSTAGE_SELECTORS.pageLoadWaitMs);
  gathererLogStepOk("backstagePageHelpers", "Backstage page ready", page.url());
}

/** Lighter wait for marketing/login pages — avoids 90s networkidle on heavy landing pages. */
export async function waitForBackstageLoginPageReady(page: Page): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("load", { timeout: 30_000 }).catch(() => {
    logDebug("login page load timeout — continuing", "backstagePageHelpers");
  });
  await page.waitForTimeout(3000);
}

// MARK: - Session Check (legacy helper — prefer backstageSession.ts)

export async function ensureBackstageLoggedIn(page: Page, config: GathererConfig): Promise<void> {
  const { probeBackstageSession } = await import("./backstageSession");
  const probe = await probeBackstageSession(page, config);
  if (probe.status !== "logged_in") {
    throw new Error("Backstage session expired. Run: npm run login");
  }
}

// MARK: - Popup Dismissal

export async function dismissBackstagePopups(page: Page): Promise<void> {
  gathererLogStep("backstagePageHelpers", "Dismissing Backstage popups and modals");
  logDebug("Dismissing Backstage popups/modals", "backstagePageHelpers");

  const dismissSelectors = [
    BACKSTAGE_SELECTORS.semiModalClose,
    BACKSTAGE_SELECTORS.semiModalCancel,
    'button:has-text("Got it")',
    'button:has-text("OK")',
    'button:has-text("Dismiss")',
    'button:has-text("Skip")',
    'button:has-text("Not now")',
  ];

  for (let pass = 0; pass < 3; pass++) {
    let dismissedAny = false;

    for (const selector of dismissSelectors) {
      const buttons = page.locator(selector);
      const count = await buttons.count();

      for (let i = 0; i < count; i++) {
        const btn = buttons.nth(i);
        if (await btn.isVisible().catch(() => false)) {
          await btn.click({ timeout: 2000 }).catch(() => undefined);
          dismissedAny = true;
          await page.waitForTimeout(400);
        }
      }
    }

    await page.keyboard.press("Escape").catch(() => undefined);
    await page.waitForTimeout(300);

    if (!dismissedAny) {
      break;
    }
  }
}

// MARK: - Locator Race (Playwright equivalent of Puppeteer Locator.race)

export function backstageRaceLocators(page: Page, selectors: string[]): Locator {
  if (selectors.length === 0) {
    throw new Error("backstageRaceLocators requires at least one selector");
  }

  let combined = page.locator(selectors[0]);
  for (let i = 1; i < selectors.length; i++) {
    combined = combined.or(page.locator(selectors[i]));
  }
  return combined.first();
}

export async function backstageClickRace(
  page: Page,
  selectors: string[],
  label: string
): Promise<void> {
  gathererLogStepClick("backstagePageHelpers", label, selectors);
  const locator = backstageRaceLocators(page, selectors);
  await locator.waitFor({
    state: "visible",
    timeout: BACKSTAGE_SELECTORS.actionTimeoutMs,
  });
  await locator.click({ timeout: BACKSTAGE_SELECTORS.actionTimeoutMs });
  await page.waitForTimeout(500);
  gathererLogStepOk("backstagePageHelpers", `Click completed — ${label}`);
}

export async function backstageClickUnselectAllTwice(page: Page, label: string): Promise<void> {
  const unselectSelectors = [
    BACKSTAGE_SELECTORS.managementCustomizeUnselectAll,
    'section.semi-transfer-left button > span:has-text("Unselect all")',
    'button:has-text("Unselect all")',
  ];

  for (let i = 0; i < 2; i++) {
    await backstageClickRace(page, unselectSelectors, `${label} — Unselect all (${i + 1}/2)`);
  }
}

export async function backstageClickConfirmModal(page: Page, label: string): Promise<void> {
  const confirmSelectors = [
    BACKSTAGE_SELECTORS.managementConfirmButton,
    BACKSTAGE_SELECTORS.performanceConfirmButton,
    'div.semi-modal-footer button.semi-button-primary:has-text("Confirm")',
    'button.semi-button-primary:has-text("Confirm")',
  ];
  await backstageClickRace(page, confirmSelectors, `${label} — Confirm`);
}

export async function backstageClickSelectAllBulk(page: Page, label: string): Promise<void> {
  const selectAllSelectors = [
    BACKSTAGE_SELECTORS.managementSelectAllBulk,
    BACKSTAGE_SELECTORS.performanceSelectAllBulk,
    'button.semi-button-primary:has-text("Select all")',
    'div.liveplatform-flex-item button:has-text("Select all")',
  ];
  await backstageClickRace(page, selectAllSelectors, `${label} — Select all`);
}

// Suggestions For Features and Additions Later:
// - Screenshot on each step when debug logging enabled
