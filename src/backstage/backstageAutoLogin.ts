/**
 * Filename: backstageAutoLogin.ts
 * Purpose: Full Playwright Backstage login — home → login button → credentials → popups.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-23
 * Platform Compatibility: Playwright (Chromium)
 *
 * Flow (matches InvitesTrialsQuitMetrics / BACKSTAGE_PLAYWRIGHT_LOGIN guide):
 * 1. https://live-backstage.tiktok.com/
 * 2. Click login button (or use /login/ fallback)
 * 3. Fill #email + #password from .env
 * 4. Submit
 * 5. Clear post-login popups
 */

import path from "path";
import { Page } from "playwright";
import { GathererConfig } from "../config";
import { BACKSTAGE_SELECTORS } from "./backstageSelectors";
import {
  waitForBackstagePageReady,
  dismissBackstagePopups,
  backstageRaceLocators,
} from "./backstagePageHelpers";
import { clearBackstagePostLoginPopups } from "./backstageLoginPopups";
import { ensureBackstageUsPlusRegion } from "./backstageUsPlusRegion";
import { backstagePageIsLoggedIn } from "./backstageSession";
import { gathererEnsureDir } from "../utils/files";
import { logInfo, logError } from "../logging/logger";

// MARK: - Credentials Check

export function backstageAutoLoginCredentialsConfigured(config: GathererConfig): boolean {
  return Boolean(config.backstageEmail && config.backstagePassword);
}

// MARK: - Authentication Probe

export async function backstageLoginIsAuthenticated(page: Page): Promise<boolean> {
  if (backstagePageIsLoggedIn(page)) {
    return true;
  }

  const onBackstage = page.url().includes("live-backstage.tiktok.com");
  if (!onBackstage) {
    return false;
  }

  const loginBtnVisible = await page
    .locator(BACKSTAGE_SELECTORS.homeLoginButton)
    .first()
    .isVisible()
    .catch(() => false);

  const emailVisible = await page
    .locator(BACKSTAGE_SELECTORS.loginEmailInput)
    .isVisible()
    .catch(() => false);

  return !loginBtnVisible && !emailVisible && !page.url().includes(BACKSTAGE_SELECTORS.loginUrlFragment);
}

// MARK: - Navigate Home

export async function navigateBackstageHome(page: Page, config: GathererConfig): Promise<void> {
  const homeUrl = `${config.backstageBaseUrl}/`;
  logInfo(`Navigating to TikTok Backstage home: ${homeUrl}`, "backstageAutoLogin");

  await page.goto(homeUrl, {
    waitUntil: "domcontentloaded",
    timeout: BACKSTAGE_SELECTORS.navigationTimeoutMs,
  });
  await waitForBackstagePageReady(page);
}

// MARK: - Open Login Form

async function backstageOpenLoginForm(page: Page, config: GathererConfig): Promise<void> {
  const emailAlreadyVisible = await page
    .locator(BACKSTAGE_SELECTORS.loginEmailInput)
    .isVisible()
    .catch(() => false);

  if (emailAlreadyVisible) {
    logInfo("Login form already visible", "backstageAutoLogin");
    return;
  }

  if (page.url().includes(BACKSTAGE_SELECTORS.loginUrlFragment)) {
    logInfo("Already on login URL", "backstageAutoLogin");
    return;
  }

  const homeButtonVisible = await page
    .locator(BACKSTAGE_SELECTORS.homeLoginButton)
    .first()
    .isVisible()
    .catch(() => false);

  if (homeButtonVisible) {
    logInfo("Clicking home login button", "backstageAutoLogin");
    await page.locator(BACKSTAGE_SELECTORS.homeLoginButton).first().click();
    await page.waitForTimeout(800);
    return;
  }

  const roleLogin = page.getByRole("button", { name: /log in/i }).first();
  if (await roleLogin.isVisible().catch(() => false)) {
    logInfo('Clicking "Log in" button by role', "backstageAutoLogin");
    await roleLogin.click();
    await page.waitForTimeout(800);
    return;
  }

  const loginUrl = `${config.backstageBaseUrl}${BACKSTAGE_SELECTORS.loginPath}`;
  logInfo(`Login button not found — opening ${loginUrl}`, "backstageAutoLogin");
  await page.goto(loginUrl, {
    waitUntil: "domcontentloaded",
    timeout: BACKSTAGE_SELECTORS.navigationTimeoutMs,
  });
  await waitForBackstagePageReady(page);
}

// MARK: - Verify Login Success

async function backstageVerifyLoginSuccess(page: Page, config: GathererConfig): Promise<void> {
  await page.waitForTimeout(BACKSTAGE_SELECTORS.postLoginSettleMs);

  const url = page.url();
  if (!url.includes("live-backstage.tiktok.com")) {
    await saveBackstageAutoLoginFailureScreenshot(page, config);
    throw new Error(`Login verification failed — unexpected URL: ${url}`);
  }

  const emailStillVisible = await page
    .locator(BACKSTAGE_SELECTORS.loginEmailInput)
    .isVisible()
    .catch(() => false);

  if (emailStillVisible) {
    await saveBackstageAutoLoginFailureScreenshot(page, config);
    throw new Error(
      "Login verification failed — email field still visible (bad credentials, CAPTCHA, or 2FA)"
    );
  }

  logInfo("Login verified on live-backstage.tiktok.com", "backstageAutoLogin");
}

async function saveBackstageAutoLoginFailureScreenshot(page: Page, config: GathererConfig): Promise<void> {
  const screenshotPath = path.join(config.localLogDir, `fail-login-${Date.now()}.png`);
  gathererEnsureDir(config.localLogDir);
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);
  logError("Login failure screenshot saved", "backstageAutoLogin", { screenshotPath });
}

// MARK: - Full Auto Login

export async function performBackstageAutoLogin(page: Page, config: GathererConfig): Promise<void> {
  if (!backstageAutoLoginCredentialsConfigured(config)) {
    throw new Error(
      "Set BACKSTAGE_EMAIL and BACKSTAGE_PASSWORD (or TIKTOK_EMAIL / TIKTOK_PASSWORD) in .env"
    );
  }

  await navigateBackstageHome(page, config);

  if (await backstageLoginIsAuthenticated(page)) {
    logInfo("Session already valid — skipping credential form", "backstageAutoLogin");
    await clearBackstagePostLoginPopups(page);
    await dismissBackstagePopups(page);
    await ensureBackstageUsPlusRegion(page, config);
    return;
  }

  logInfo("Starting Playwright credential login", "backstageAutoLogin");

  const loginUrl = `${config.backstageBaseUrl}${BACKSTAGE_SELECTORS.loginPath}`;
  logInfo(`Opening login page directly: ${loginUrl}`, "backstageAutoLogin");
  await page.goto(loginUrl, {
    waitUntil: "domcontentloaded",
    timeout: BACKSTAGE_SELECTORS.navigationTimeoutMs,
  });
  await waitForBackstagePageReady(page);
  await dismissBackstagePopups(page);
  await page.waitForTimeout(500);

  const emailInput = backstageRaceLocators(page, [
    BACKSTAGE_SELECTORS.loginEmailInput,
    'input[type="email"]',
    '[aria-label="Enter email address"]',
  ]);

  const passwordInput = backstageRaceLocators(page, [
    BACKSTAGE_SELECTORS.loginPasswordInput,
    'input[type="password"]',
    '[aria-label="Enter password"]',
  ]);

  const submitButton = backstageRaceLocators(page, [
    BACKSTAGE_SELECTORS.loginSubmitBlock,
    BACKSTAGE_SELECTORS.loginSubmitButton,
    'button:has-text("Log in")',
    'div.semi-portal button:has-text("Log in")',
  ]);

  await emailInput.waitFor({ state: "visible", timeout: BACKSTAGE_SELECTORS.actionTimeoutMs });
  await emailInput.click();
  await emailInput.fill("");
  await emailInput.pressSequentially(config.backstageEmail, {
    delay: BACKSTAGE_SELECTORS.loginTypingDelayMs,
  });

  await passwordInput.waitFor({ state: "visible", timeout: BACKSTAGE_SELECTORS.actionTimeoutMs });
  await passwordInput.click();
  await passwordInput.fill("");
  await passwordInput.pressSequentially(config.backstagePassword, {
    delay: BACKSTAGE_SELECTORS.loginTypingDelayMs,
  });

  await submitButton.waitFor({ state: "visible", timeout: BACKSTAGE_SELECTORS.actionTimeoutMs });
  await dismissBackstagePopups(page);
  await page.waitForTimeout(300);

  await Promise.all([
    page
      .waitForURL("**/*", { waitUntil: "domcontentloaded", timeout: 15_000 })
      .catch(() => null),
    submitButton.click({ force: true }),
  ]);

  await backstageVerifyLoginSuccess(page, config);
  await clearBackstagePostLoginPopups(page);
  await dismissBackstagePopups(page);

  await ensureBackstageUsPlusRegion(page, config);

  if (!(await backstageLoginIsAuthenticated(page)) && !backstagePageIsLoggedIn(page)) {
    await saveBackstageAutoLoginFailureScreenshot(page, config);
    throw new Error(`Backstage auto login failed — URL: ${page.url()}`);
  }

  logInfo("Playwright auto login completed", "backstageAutoLogin");
}

// MARK: - One-Shot Full Flow (for test script)

export async function runBackstageLoginFullFlow(
  page: Page,
  config: GathererConfig
): Promise<void> {
  await performBackstageAutoLogin(page, config);
}

// Suggestions For Features and Additions Later:
// - CAPTCHA / 2FA detection with explicit error type
// - Playwright trace on failure
