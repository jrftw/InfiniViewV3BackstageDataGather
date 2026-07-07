/**
 * Filename: backstageAutoLogin.ts
 * Purpose: Full Playwright Backstage login — /login/ → credentials → US+ region → save session.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-07-07
 * Platform Compatibility: Playwright (Chromium)
 *
 * Flow:
 * 1. https://live-backstage.tiktok.com/login/ (US locale from browser profile)
 * 2. Ensure login modal + Email tab visible (do NOT dismiss login modal as a popup)
 * 3. Fill #email + #password from .env
 * 4. Submit and wait for /portal/
 * 5. Clear post-login popups and switch to US+ agency region
 */

import path from "path";
import { Page } from "playwright";
import { GathererConfig } from "../config";
import { BACKSTAGE_SELECTORS } from "./backstageSelectors";
import {
  waitForBackstagePageReady,
  waitForBackstageLoginPageReady,
  dismissBackstagePopups,
  backstageRaceLocators,
} from "./backstagePageHelpers";
import { clearBackstagePostLoginPopups } from "./backstageLoginPopups";
import { ensureBackstageUsPlusRegion } from "./backstageUsPlusRegion";
import { backstagePageIsLoggedIn, backstageAuthFileHasCookies } from "./backstageSession";
import { gathererEnsureDir } from "../utils/files";
import { logInfo, logError, logDebug } from "../logging/logger";

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

// MARK: - Login Page Navigation

async function backstageNavigateToLoginPage(page: Page, config: GathererConfig): Promise<void> {
  const loginUrl = `${config.backstageBaseUrl}${BACKSTAGE_SELECTORS.loginPath}`;
  logInfo(`Opening Backstage login page: ${loginUrl}`, "backstageAutoLogin");

  await page.goto(loginUrl, {
    waitUntil: "domcontentloaded",
    timeout: BACKSTAGE_SELECTORS.navigationTimeoutMs,
  });
  await waitForBackstageLoginPageReady(page);
}

// MARK: - Ensure Login Form Visible

async function backstageLoginEmailFieldVisible(page: Page): Promise<boolean> {
  return page
    .locator(BACKSTAGE_SELECTORS.loginEmailInput)
    .isVisible()
    .catch(() => false);
}

async function backstageEnsureLoginFormVisible(page: Page): Promise<void> {
  const emailLocator = page.locator(BACKSTAGE_SELECTORS.loginEmailInput);

  const emailAppeared = await emailLocator
    .waitFor({ state: "visible", timeout: 10_000 })
    .then(() => true)
    .catch(() => false);

  if (emailAppeared) {
    logDebug("Login email field visible", "backstageAutoLogin");
    return;
  }

  const emailTab = page.getByText(/^Email$/i).first();
  if (await emailTab.isVisible().catch(() => false)) {
    logInfo('Selecting "Email" login tab', "backstageAutoLogin");
    await emailTab.click();
    await page.waitForTimeout(800);
    if (await backstageLoginEmailFieldVisible(page)) {
      return;
    }
  }

  const headerLoginButtons = page.getByRole("button", { name: /^Log in$/i });
  const headerLoginCount = await headerLoginButtons.count().catch(() => 0);

  for (let i = 0; i < headerLoginCount; i++) {
    const button = headerLoginButtons.nth(i);
    if (!(await button.isVisible().catch(() => false))) {
      continue;
    }
    logInfo('Clicking "Log in" to open credential form', "backstageAutoLogin");
    await button.click();
    await page.waitForTimeout(1000);
    if (await emailLocator.waitFor({ state: "visible", timeout: 5000 }).then(() => true).catch(() => false)) {
      return;
    }
  }

  const homeLoginButton = page.locator(BACKSTAGE_SELECTORS.homeLoginButton).first();
  if (await homeLoginButton.isVisible().catch(() => false)) {
    logInfo("Clicking home login button", "backstageAutoLogin");
    await homeLoginButton.click();
    await page.waitForTimeout(1000);
    if (await backstageLoginEmailFieldVisible(page)) {
      return;
    }
  }

  if (await backstageLoginEmailFieldVisible(page)) {
    return;
  }

  throw new Error(
    "Backstage login form not visible — open https://live-backstage.tiktok.com/login/ manually or check for CAPTCHA"
  );
}

// MARK: - US English On Login Page

async function backstageEnsureLoginPageUsEnglish(page: Page): Promise<void> {
  const languageButton = page.getByRole("button", { name: /language/i }).first();
  if (!(await languageButton.isVisible().catch(() => false))) {
    logDebug("Language button not found on login page — relying on browser locale", "backstageAutoLogin");
    return;
  }

  const buttonText = ((await languageButton.textContent()) || "").trim();
  if (/english|^en\b/i.test(buttonText)) {
    logDebug(`Login page language already English (${buttonText})`, "backstageAutoLogin");
    return;
  }

  logInfo(`Setting login page language to English (was: ${buttonText || "unknown"})`, "backstageAutoLogin");
  await languageButton.click();
  await page.waitForTimeout(400);

  const englishOption = page
    .locator('.semi-select-option:has-text("English"), [role="option"]:has-text("English")')
    .first();
  if (await englishOption.isVisible().catch(() => false)) {
    await englishOption.click();
    await waitForBackstageLoginPageReady(page);
  }
}

// MARK: - Verify Login Success

async function backstageVerifyLoginSuccess(page: Page, config: GathererConfig): Promise<void> {
  await page
    .waitForURL(
      (url) =>
        url.href.includes(BACKSTAGE_SELECTORS.loggedInUrlFragment) &&
        !url.href.includes(BACKSTAGE_SELECTORS.loginUrlFragment),
      { timeout: 30_000, waitUntil: "domcontentloaded" }
    )
    .catch(() => null);

  await page.waitForTimeout(BACKSTAGE_SELECTORS.postLoginSettleMs);

  const url = page.url();
  if (!url.includes("live-backstage.tiktok.com")) {
    await saveBackstageAutoLoginFailureScreenshot(page, config);
    throw new Error(`Login verification failed — unexpected URL: ${url}`);
  }

  if (url.includes(BACKSTAGE_SELECTORS.loginUrlFragment)) {
    const emailStillVisible = await backstageLoginEmailFieldVisible(page);
    if (emailStillVisible) {
      await saveBackstageAutoLoginFailureScreenshot(page, config);
      throw new Error(
        "Login verification failed — still on login page (bad credentials, CAPTCHA, or 2FA)"
      );
    }
  }

  logInfo("Login verified — Backstage portal reachable", "backstageAutoLogin", { url });
}

async function saveBackstageAutoLoginFailureScreenshot(page: Page, config: GathererConfig): Promise<void> {
  const screenshotPath = path.join(config.localLogDir, `fail-login-${Date.now()}.png`);
  gathererEnsureDir(config.localLogDir);
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);
  logError("Login failure screenshot saved", "backstageAutoLogin", { screenshotPath });
}

// MARK: - Fill Credential Form

function backstageResolveLoginSubmitButton(page: Page) {
  const formScopedSubmit = page
    .locator("form")
    .filter({ has: page.locator(BACKSTAGE_SELECTORS.loginEmailInput) })
    .locator('button[type="submit"]')
    .first();

  return backstageRaceLocators(page, [
    'button[type="submit"].semi-button-block',
    'button[type="submit"]:has-text("Log in")',
    BACKSTAGE_SELECTORS.loginSubmitBlock,
    BACKSTAGE_SELECTORS.loginSubmitButton,
  ]);
}

async function backstageClickLoginSubmit(page: Page, passwordInput: ReturnType<typeof backstageRaceLocators>): Promise<void> {
  const submitButton = backstageResolveLoginSubmitButton(page);

  await submitButton.waitFor({ state: "visible", timeout: BACKSTAGE_SELECTORS.actionTimeoutMs });
  await submitButton.scrollIntoViewIfNeeded().catch(() => undefined);
  await page.waitForTimeout(300);

  logInfo('Clicking form "Log in" submit button', "backstageAutoLogin");

  const navigationPromise = page
    .waitForURL(
      (url) =>
        url.href.includes(BACKSTAGE_SELECTORS.loggedInUrlFragment) ||
        !url.href.includes(BACKSTAGE_SELECTORS.loginUrlFragment),
      { timeout: 30_000, waitUntil: "domcontentloaded" }
    )
    .catch(() => null);

  await submitButton.click({ timeout: BACKSTAGE_SELECTORS.actionTimeoutMs }).catch(async () => {
    logInfo("Submit click missed — pressing Enter on password field", "backstageAutoLogin");
    await passwordInput.press("Enter");
  });

  await navigationPromise;

  if (page.url().includes(BACKSTAGE_SELECTORS.loginUrlFragment)) {
    logInfo("Still on login page — retrying submit via Enter key", "backstageAutoLogin");
    await passwordInput.press("Enter");
    await page.waitForTimeout(BACKSTAGE_SELECTORS.postLoginSettleMs);
  }
}

async function backstageFillLoginCredentials(page: Page, config: GathererConfig): Promise<void> {
  const emailInput = backstageRaceLocators(page, [
    BACKSTAGE_SELECTORS.loginEmailInput,
    'input[type="email"]',
    'input[placeholder*="email" i]',
    '[aria-label="Enter email address"]',
  ]);

  const passwordInput = backstageRaceLocators(page, [
    BACKSTAGE_SELECTORS.loginPasswordInput,
    'input[type="password"]',
    'input[placeholder*="password" i]',
    '[aria-label="Enter password"]',
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

  await backstageClickLoginSubmit(page, passwordInput);
}

// MARK: - Session Already Valid Check

async function backstageTryExistingSession(page: Page, config: GathererConfig): Promise<boolean> {
  const probeUrl = `${config.backstageBaseUrl}${BACKSTAGE_SELECTORS.managementListPath}`;
  logInfo(`Checking existing Backstage session: ${probeUrl}`, "backstageAutoLogin");

  await page.goto(probeUrl, {
    waitUntil: "domcontentloaded",
    timeout: BACKSTAGE_SELECTORS.navigationTimeoutMs,
  });
  await waitForBackstagePageReady(page);
  await dismissBackstagePopups(page);

  if (backstagePageIsLoggedIn(page)) {
    logInfo("Existing Backstage session still valid — skipping credential login", "backstageAutoLogin");
    await ensureBackstageUsPlusRegion(page, config);
    return true;
  }

  return false;
}

// MARK: - Full Auto Login

export async function performBackstageAutoLogin(page: Page, config: GathererConfig): Promise<void> {
  if (!backstageAutoLoginCredentialsConfigured(config)) {
    throw new Error(
      "Set BACKSTAGE_EMAIL and BACKSTAGE_PASSWORD (or TIKTOK_EMAIL / TIKTOK_PASSWORD) in .env"
    );
  }

  if (backstageAuthFileHasCookies(config) && (await backstageTryExistingSession(page, config))) {
    await clearBackstagePostLoginPopups(page);
    await dismissBackstagePopups(page);
    return;
  }

  logInfo("Starting Playwright credential login at /login/", "backstageAutoLogin");

  await backstageNavigateToLoginPage(page, config);
  await backstageEnsureLoginPageUsEnglish(page);
  await backstageEnsureLoginFormVisible(page);
  await backstageFillLoginCredentials(page, config);

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
