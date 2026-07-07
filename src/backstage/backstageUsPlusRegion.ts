/**
 * Filename: backstageUsPlusRegion.ts
 * Purpose: Ensure Backstage agency region is always US+ (auto-switch if wrong region).
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-07-07
 * Platform Compatibility: Playwright (Chromium)
 *
 * Recorded flow: header region combobox (UK+ → US+) → Confirm modal
 */

import path from "path";
import { Page, Locator } from "playwright";
import { GathererConfig } from "../config";
import { BACKSTAGE_SELECTORS } from "./backstageSelectors";
import {
  waitForBackstagePageReady,
  backstageClickRace,
  dismissBackstagePopups,
} from "./backstagePageHelpers";
import { gathererEnsureDir } from "../utils/files";
import { logInfo, logDebug, logError } from "../logging/logger";

// MARK: - Region Label Locators

function backstageRegionLabelLocators(page: Page): Locator[] {
  return [
    page.locator(BACKSTAGE_SELECTORS.headerRegionSelectionSpan).first(),
    page.locator("#header span.semi-select-selection-text").first(),
    page.locator('[role="combobox"] span.semi-select-selection-text').first(),
    page.locator(BACKSTAGE_SELECTORS.headerRegionTitle).first(),
    page.locator("#header div.semi-select-selection span").first(),
  ];
}

function backstageRegionComboboxLocators(page: Page): Locator[] {
  return [
    page.getByRole("combobox", { name: /selected/i }).first(),
    page.locator(BACKSTAGE_SELECTORS.headerRegionCombobox).first(),
    page.locator(BACKSTAGE_SELECTORS.headerRegionSelect).first(),
    page.locator('[role="combobox"]').first(),
    page.locator("div.semi-select-selection").first(),
    page.locator(BACKSTAGE_SELECTORS.headerRegionSelectionSpan).first(),
  ];
}

async function backstageReadFirstVisibleText(locators: Locator[]): Promise<string> {
  for (const locator of locators) {
    if (await locator.isVisible().catch(() => false)) {
      const text = ((await locator.textContent()) || "").trim();
      if (text) {
        return text;
      }
    }
  }
  return "";
}

async function backstageClickFirstVisible(locators: Locator[], label: string): Promise<boolean> {
  for (const locator of locators) {
    if (await locator.isVisible().catch(() => false)) {
      logInfo(`Clicking region control: ${label}`, "backstageUsPlusRegion");
      await locator.scrollIntoViewIfNeeded().catch(() => undefined);
      await locator.click({ timeout: BACKSTAGE_SELECTORS.actionTimeoutMs });
      await pageWaitSettle(locator.page());
      return true;
    }
  }
  return false;
}

function pageWaitSettle(page: Page): Promise<void> {
  return page.waitForTimeout(800);
}

// MARK: - Region Detection

export async function readBackstageHeaderRegionLabel(page: Page): Promise<string> {
  const label = await backstageReadFirstVisibleText(backstageRegionLabelLocators(page));
  if (label) {
    logDebug(`Read header region label: "${label}"`, "backstageUsPlusRegion");
  }
  return label;
}

export function backstageRegionLabelIsUsPlus(label: string, targetRegion: string): boolean {
  const normalized = label.trim().toUpperCase();
  const target = targetRegion.trim().toUpperCase();

  if (target === "US+" || target.includes("US+")) {
    return normalized.includes("US+");
  }

  return normalized.includes(target);
}

export async function isBackstageUsPlusRegion(page: Page, config: GathererConfig): Promise<boolean> {
  const label = await readBackstageHeaderRegionLabel(page);
  if (!label) {
    logDebug("Could not read header region label — assuming switch needed", "backstageUsPlusRegion");
    return false;
  }
  const isUsPlus = backstageRegionLabelIsUsPlus(label, config.backstageAgencyRegion);
  logDebug(`Header region label: "${label}" (US+=${isUsPlus})`, "backstageUsPlusRegion");
  return isUsPlus;
}

// MARK: - Open Region Dropdown

async function backstageOpenRegionDropdown(page: Page): Promise<void> {
  const combobox = page.getByRole("combobox", { name: /selected/i }).first();
  const comboboxVisible = await combobox
    .waitFor({ state: "visible", timeout: 20_000 })
    .then(() => true)
    .catch(() => false);

  if (comboboxVisible) {
    logInfo("Opening region combobox", "backstageUsPlusRegion");
    await combobox.click({ timeout: BACKSTAGE_SELECTORS.actionTimeoutMs });
    await pageWaitSettle(page);

    const listboxVisible = await page
      .locator('[role="listbox"] .semi-select-option, .semi-select-option')
      .first()
      .isVisible()
      .catch(() => false);

    if (listboxVisible) {
      return;
    }
  }

  const opened = await backstageClickFirstVisible(
    backstageRegionComboboxLocators(page),
    "region combobox fallback"
  );

  if (opened) {
    return;
  }

  throw new Error("Backstage region dropdown trigger not found in header");
}

// MARK: - Select US+ Option

async function backstageClickUsPlusRegionOption(page: Page, targetRegion: string): Promise<void> {
  const roleOption = page.getByRole("option", { name: new RegExp(`^${targetRegion.replace("+", "\\+")}$`, "i") }).first();
  if (await roleOption.isVisible().catch(() => false)) {
    logInfo(`Selecting region option via role: ${targetRegion}`, "backstageUsPlusRegion");
    await roleOption.click({ timeout: BACKSTAGE_SELECTORS.actionTimeoutMs });
    await pageWaitSettle(page);
    return;
  }

  const optionSelectors = [
    `.semi-select-option:has(.semi-select-option-text:has-text("${targetRegion}"))`,
    `.semi-select-option-text:has-text("${targetRegion}")`,
    `.semi-select-option:has-text("${targetRegion}")`,
    `div[role="option"]:has-text("${targetRegion}")`,
    '.semi-select-option:has-text("US+")',
    '.semi-select-option-text:has-text("US+")',
  ];

  await backstageClickRace(page, optionSelectors, `Select region ${targetRegion}`);
}

// MARK: - Confirm Region Change Modal

async function backstageConfirmRegionChangeModal(page: Page): Promise<void> {
  const confirmSelectors = [
    BACKSTAGE_SELECTORS.regionChangeConfirmButton,
    'div.semi-modal-footer button:has-text("Confirm")',
    'div.semi-modal-footer button.semi-button-primary',
    'button:has-text("Confirm")',
  ];

  const confirmVisible = await page
    .locator('div.semi-modal-footer button')
    .first()
    .isVisible()
    .catch(() => false);

  if (!confirmVisible) {
    logDebug("No region confirm modal — may have applied without prompt", "backstageUsPlusRegion");
    return;
  }

  await Promise.all([
    page
      .waitForURL("**/*", { waitUntil: "domcontentloaded", timeout: 30_000 })
      .catch(() => null),
    backstageClickRace(page, confirmSelectors, "Confirm US+ region change"),
  ]);

  await page.waitForTimeout(BACKSTAGE_SELECTORS.postLoginSettleMs);
}

// MARK: - Navigate To Region-Friendly Page

async function backstageNavigateToRegionHeaderPage(page: Page, config: GathererConfig): Promise<void> {
  const headerPageUrl = `${config.backstageBaseUrl}${BACKSTAGE_SELECTORS.managementListPath}`;
  logDebug(`Opening page for region header: ${headerPageUrl}`, "backstageUsPlusRegion");

  await page.goto(headerPageUrl, {
    waitUntil: "domcontentloaded",
    timeout: BACKSTAGE_SELECTORS.navigationTimeoutMs,
  });
  await waitForBackstagePageReady(page);
  await dismissBackstagePopups(page);
}

async function backstageNavigateForRegionSwitch(page: Page, config: GathererConfig): Promise<void> {
  const settlementUrl = `${config.backstageBaseUrl}${BACKSTAGE_SELECTORS.regionSwitchProbePath}`;
  logDebug(`Opening page for region switch: ${settlementUrl}`, "backstageUsPlusRegion");

  await page.goto(settlementUrl, {
    waitUntil: "domcontentloaded",
    timeout: BACKSTAGE_SELECTORS.navigationTimeoutMs,
  });
  await waitForBackstagePageReady(page);
  await dismissBackstagePopups(page);
}

// MARK: - Ensure US+ Region

export async function ensureBackstageUsPlusRegion(
  page: Page,
  config: GathererConfig
): Promise<void> {
  if (!config.backstageForceUsPlus) {
    logDebug("BACKSTAGE_FORCE_US_PLUS disabled — skipping region check", "backstageUsPlusRegion");
    return;
  }

  const targetRegion = config.backstageAgencyRegion;

  await backstageNavigateToRegionHeaderPage(page, config);

  if (await isBackstageUsPlusRegion(page, config)) {
    logInfo(`Backstage already on ${targetRegion} — no switch needed`, "backstageUsPlusRegion");
    return;
  }

  logInfo(`Switching Backstage agency region to ${targetRegion}`, "backstageUsPlusRegion");

  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (attempt > 1) {
        await backstageNavigateForRegionSwitch(page, config);
      }

      await backstageOpenRegionDropdown(page);
      await backstageClickUsPlusRegionOption(page, targetRegion);
      await backstageConfirmRegionChangeModal(page);
      await waitForBackstagePageReady(page);
      await dismissBackstagePopups(page);

      if (await isBackstageUsPlusRegion(page, config)) {
        logInfo(`Backstage region switched to ${targetRegion}`, "backstageUsPlusRegion");
        return;
      }

      throw new Error(`Region label after switch does not show ${targetRegion}`);
    } catch (error) {
      lastError = error;
      logError(`US+ region switch attempt ${attempt}/3 failed`, "backstageUsPlusRegion", {
        error: error instanceof Error ? error.message : String(error),
      });
      await saveBackstageRegionSwitchFailureScreenshot(page, config, attempt);
      await page.waitForTimeout(1500);
    }
  }

  throw new Error(
    `Failed to switch Backstage to ${targetRegion} after 3 attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}

async function saveBackstageRegionSwitchFailureScreenshot(
  page: Page,
  config: GathererConfig,
  attempt: number
): Promise<void> {
  const screenshotPath = path.join(
    config.localLogDir,
    `fail-region-switch-attempt${attempt}-${Date.now()}.png`
  );
  gathererEnsureDir(config.localLogDir);
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);
}

// Suggestions For Features and Additions Later:
// - Persist last-known region in session metadata file
