/**
 * Filename: backstageLoginPopups.ts
 * Purpose: Post-login popup clearing — port of InvitesTrialsQuitMetrics clearPopups flow.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-23
 * Platform Compatibility: Playwright (Chromium)
 */

import { Page } from "playwright";
import { BACKSTAGE_SELECTORS } from "./backstageSelectors";
import { logDebug, logInfo } from "../logging/logger";

// MARK: - Guide / Invitation Skip

function backstagePopupTextIsGuideOrInvitation(text: string): boolean {
  return /guide|invitation code/i.test(text);
}

// MARK: - Post-Login Popup Clearing

export async function clearBackstagePostLoginPopups(page: Page): Promise<void> {
  logInfo("Clearing post-login popups", "backstageLoginPopups");

  const maybeLater = page.getByRole("button", { name: /maybe later/i });
  if (await maybeLater.isVisible().catch(() => false)) {
    await maybeLater.click();
    logDebug('Clicked "Maybe later"', "backstageLoginPopups");
    await page.waitForTimeout(500);
  }

  try {
    const gotItLocator = page.locator(BACKSTAGE_SELECTORS.loginGotItButton).first();
    await gotItLocator.waitFor({ state: "visible", timeout: 2000 });
    const buttonText = ((await gotItLocator.textContent()) || "").trim();

    if (backstagePopupTextIsGuideOrInvitation(buttonText)) {
      logDebug(`Skipping guide button: "${buttonText}"`, "backstageLoginPopups");
    } else {
      await gotItLocator.click();
      logDebug('Clicked "Got it"', "backstageLoginPopups");
    }
  } catch {
    logDebug('No "Got it" button found', "backstageLoginPopups");
  }

  const popupSelectors = [
    ".popup-close",
    ".modal-close",
    ".overlay-close",
    '[aria-label="Close"]',
    ".close-button",
    BACKSTAGE_SELECTORS.semiModalClose,
  ];

  for (const selector of popupSelectors) {
    const popup = page.locator(selector).first();
    if (!(await popup.isVisible().catch(() => false))) {
      continue;
    }

    const popupText = ((await popup.textContent()) || "").trim();
    if (backstagePopupTextIsGuideOrInvitation(popupText)) {
      logDebug(`Skipping guide popup: "${popupText}"`, "backstageLoginPopups");
      continue;
    }

    await popup.click().catch(() => undefined);
    logDebug(`Closed popup: ${selector}`, "backstageLoginPopups");
    await page.waitForTimeout(300);
  }

  await page.keyboard.press("Escape").catch(() => undefined);
  logInfo("Post-login popup clearing completed", "backstageLoginPopups");
}

// Suggestions For Features and Additions Later:
// - Screenshot each dismissed popup when debug logging enabled
