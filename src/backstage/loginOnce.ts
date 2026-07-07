/**
 * Filename: loginOnce.ts
 * Purpose: Save Backstage session — auto-login from .env or skip if already logged in.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-07-07
 * Platform Compatibility: Windows (interactive browser)
 */

import { Page } from "playwright";
import { loadGathererConfig, GathererConfig } from "../config";
import { launchBackstageBrowser, closeBackstageBrowser, saveBackstageAuthState } from "./browser";
import { applyBackstageViewport, waitForBackstageLoginPageReady } from "./backstagePageHelpers";
import {
  probeBackstageSession,
  waitForBackstageManualLogin,
  backstagePageIsLoggedIn,
  backstageAuthFileHasCookies,
} from "./backstageSession";
import { BACKSTAGE_SELECTORS } from "./backstageSelectors";
import {
  backstageAutoLoginCredentialsConfigured,
  performBackstageAutoLogin,
} from "./backstageAutoLogin";
import { logInfo, logError } from "../logging/logger";

// MARK: - Open Login Page (manual fallback)

async function loginOnceOpenLoginPage(page: Page, config: GathererConfig): Promise<void> {
  const loginUrl = `${config.backstageBaseUrl}${BACKSTAGE_SELECTORS.loginPath}`;
  logInfo(`Opening Backstage login page: ${loginUrl}`, "loginOnce");
  await page.goto(loginUrl, { waitUntil: "domcontentloaded" });
  await waitForBackstageLoginPageReady(page);
}

// MARK: - Login Once Entry

async function backstageLoginOnceMain() {
  const config = loadGathererConfig();
  const session = await launchBackstageBrowser(config, false);

  try {
    await applyBackstageViewport(session.page);

    const hasSavedSession = backstageAuthFileHasCookies(config);

    if (hasSavedSession) {
      const probe = await probeBackstageSession(session.page, config);
      if (probe.status === "logged_in") {
        await saveBackstageAuthState(session, config.backstageAuthStatePath);
        logInfo("Already logged in — nothing to do.", "loginOnce");
        return;
      }
    } else {
      logInfo("No saved session — opening login page directly", "loginOnce");
    }

    if (backstageAutoLoginCredentialsConfigured(config)) {
      await performBackstageAutoLogin(session.page, config);
    } else {
      logInfo("Set BACKSTAGE_EMAIL and BACKSTAGE_PASSWORD in .env for auto login.", "loginOnce");
      await loginOnceOpenLoginPage(session.page, config);
      await waitForBackstageManualLogin(session.page);
    }

    if (!backstagePageIsLoggedIn(session.page)) {
      logError("Login did not complete", "loginOnce");
      process.exitCode = 1;
      return;
    }

    await saveBackstageAuthState(session, config.backstageAuthStatePath);
    logInfo("Login session saved.", "loginOnce");
  } catch (error) {
    logError("Login failed", "loginOnce", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  } finally {
    await closeBackstageBrowser(session);
  }
}

backstageLoginOnceMain();

// Suggestions For Features and Additions Later:
// - Auto-detect login completion when URL contains /portal/
