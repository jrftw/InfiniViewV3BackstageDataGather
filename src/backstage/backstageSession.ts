/**
 * Filename: backstageSession.ts
 * Purpose: Detect saved Backstage auth and ensure login (auto or manual).
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-07-07
 * Platform Compatibility: Playwright (Chromium)
 */

import fs from "fs";
import path from "path";
import { Page } from "playwright";
import { GathererConfig } from "../config";
import { BACKSTAGE_SELECTORS } from "./backstageSelectors";
import { waitForBackstagePageReady, waitForBackstageLoginPageReady, dismissBackstagePopups } from "./backstagePageHelpers";
import {
  backstageAutoLoginCredentialsConfigured,
  performBackstageAutoLogin,
} from "./backstageAutoLogin";
import { saveBackstageAuthState, BackstageBrowserSession } from "./browser";
import { ensureBackstageUsPlusRegion } from "./backstageUsPlusRegion";
import { gathererEnsureDir } from "../utils/files";
import { logInfo, logDebug } from "../logging/logger";

// MARK: - Session Status

export type BackstageSessionStatus = "logged_in" | "logged_out";

export interface BackstageSessionProbeResult {
  status: BackstageSessionStatus;
  currentUrl: string;
}

// MARK: - Auth File

export function backstageAuthFileExists(config: GathererConfig): boolean {
  return fs.existsSync(config.backstageAuthStatePath);
}

export function backstageAuthFileHasCookies(config: GathererConfig): boolean {
  if (!backstageAuthFileExists(config)) {
    return false;
  }
  try {
    const raw = fs.readFileSync(config.backstageAuthStatePath, "utf-8");
    const parsed = JSON.parse(raw) as { cookies?: unknown[] };
    return Array.isArray(parsed.cookies) && parsed.cookies.length > 0;
  } catch {
    return false;
  }
}

export function backstagePageIsLoggedIn(page: Page): boolean {
  const url = page.url();
  return (
    url.includes(BACKSTAGE_SELECTORS.loggedInUrlFragment) &&
    !url.includes(BACKSTAGE_SELECTORS.loginUrlFragment)
  );
}

export function backstagePageNeedsLogin(page: Page): boolean {
  const url = page.url();
  if (url.includes(BACKSTAGE_SELECTORS.loginUrlFragment)) {
    return true;
  }
  if (url === `${BACKSTAGE_SELECTORS.loggedInUrlFragment}` || url.endsWith("tiktok.com/")) {
    return !backstagePageIsLoggedIn(page);
  }
  return !backstagePageIsLoggedIn(page);
}

// MARK: - Probe Session

export async function probeBackstageSession(
  page: Page,
  config: GathererConfig
): Promise<BackstageSessionProbeResult> {
  const probeUrl = `${config.backstageBaseUrl}${BACKSTAGE_SELECTORS.managementListPath}`;
  logInfo(`Checking Backstage session: ${probeUrl}`, "backstageSession");

  await page.goto(probeUrl, {
    waitUntil: "domcontentloaded",
    timeout: BACKSTAGE_SELECTORS.navigationTimeoutMs,
  });
  await waitForBackstagePageReady(page);
  await dismissBackstagePopups(page);

  const currentUrl = page.url();

  if (backstagePageIsLoggedIn(page)) {
    logInfo("Backstage session active — skipping login", "backstageSession");
    return { status: "logged_in", currentUrl };
  }

  logInfo("Backstage login required", "backstageSession", { currentUrl });
  return { status: "logged_out", currentUrl };
}

// MARK: - Wait For Manual Login (fallback)

export async function waitForBackstageManualLogin(page: Page, timeoutMs: number = 300_000) {
  logInfo("Waiting for manual login in browser...", "backstageSession");
  process.stdout.write("\nLog in in the browser, then press Enter (or wait for auto-detect)...\n");

  const enterPromise = new Promise<void>((resolve) => {
    process.stdin.once("data", () => resolve());
  });

  const autoDetectPromise = (async () => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (backstagePageIsLoggedIn(page)) {
        return;
      }
      await page.waitForTimeout(1000);
    }
    throw new Error("Login timed out after 5 minutes");
  })();

  await Promise.race([enterPromise, autoDetectPromise]);

  if (!backstagePageIsLoggedIn(page)) {
    throw new Error("Still on login page — complete Backstage login first");
  }

  logInfo("Manual login detected", "backstageSession");
}

// MARK: - Ensure Authenticated (auto → manual fallback)

export async function ensureBackstageAuthenticated(
  session: BackstageBrowserSession,
  config: GathererConfig
) {
  const probe = await probeBackstageSession(session.page, config);

  if (probe.status === "logged_in") {
    await ensureBackstageUsPlusRegion(session.page, config);
    await saveBackstageAuthState(session, config.backstageAuthStatePath);
    return;
  }

  if (backstageAuthFileHasCookies(config)) {
    logInfo(
      "Saved auth file present but anchor list probe failed — retrying via portal overview",
      "backstageSession",
      { probeUrl: probe.currentUrl }
    );
    await session.page.goto(`${config.backstageBaseUrl}/portal/overview`, {
      waitUntil: "domcontentloaded",
      timeout: BACKSTAGE_SELECTORS.navigationTimeoutMs,
    });
    await waitForBackstagePageReady(session.page);
    await dismissBackstagePopups(session.page);

    if (backstagePageIsLoggedIn(session.page)) {
      logInfo("Backstage session restored from saved auth file", "backstageSession");
      await ensureBackstageUsPlusRegion(session.page, config);
      await saveBackstageAuthState(session, config.backstageAuthStatePath);
      return;
    }
  }

  if (backstageAutoLoginCredentialsConfigured(config)) {
    logInfo("Session expired — running auto login from .env credentials", "backstageSession");
    try {
      await performBackstageAutoLogin(session.page, config);
    } catch (error) {
      if (!config.backstageHeadless) {
        logInfo("Auto login failed — waiting for manual login", "backstageSession");
        await saveBackstageLoginFailureScreenshot(session.page, config);
        await waitForBackstageManualLogin(session.page);
      } else {
        throw error;
      }
    }
  } else if (!config.backstageHeadless) {
    logInfo("No BACKSTAGE_EMAIL/PASSWORD in .env — waiting for manual login", "backstageSession");
    const loginUrl = `${config.backstageBaseUrl}${BACKSTAGE_SELECTORS.loginPath}`;
    await session.page.goto(loginUrl, { waitUntil: "domcontentloaded" });
    await waitForBackstageLoginPageReady(session.page);
    await waitForBackstageManualLogin(session.page);
  } else {
    throw new Error(
      "Backstage login required. Add BACKSTAGE_EMAIL and BACKSTAGE_PASSWORD to .env on the server PC."
    );
  }

  await saveBackstageAuthState(session, config.backstageAuthStatePath);

  await session.page.goto(`${config.backstageBaseUrl}${BACKSTAGE_SELECTORS.managementListPath}`, {
    waitUntil: "domcontentloaded",
  });
  await waitForBackstagePageReady(session.page);

  if (!backstagePageIsLoggedIn(session.page)) {
    throw new Error("Login completed but portal is still not reachable");
  }

  await ensureBackstageUsPlusRegion(session.page, config);
  await saveBackstageAuthState(session, config.backstageAuthStatePath);

  logInfo("Backstage authenticated — continuing to exports", "backstageSession");
}

async function saveBackstageLoginFailureScreenshot(page: Page, config: GathererConfig) {
  const screenshotPath = path.join(config.localLogDir, `fail-login-${Date.now()}.png`);
  gathererEnsureDir(config.localLogDir);
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);
  logDebug(`Login failure screenshot: ${screenshotPath}`, "backstageSession");
}

// Suggestions For Features and Additions Later:
// - JWT/cookie expiry timestamp in auth file metadata
