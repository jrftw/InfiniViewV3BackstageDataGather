/**
 * Filename: backstageLoginTest.ts
 * Purpose: Standalone visible login test — run full Playwright login flow once.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-23
 *
 * Usage:
 *   npm run login:test
 *   npm run login:test:headed
 */

import { loadGathererConfig } from "../config";
import { launchBackstageBrowser, saveBackstageAuthState, closeBackstageBrowser } from "./browser";
import { applyBackstageViewport } from "./backstagePageHelpers";
import { performBackstageAutoLogin, backstageLoginIsAuthenticated } from "./backstageAutoLogin";
import { logInfo, logError } from "../logging/logger";

// MARK: - Login Test Main

async function backstageLoginTestMain() {
  logInfo("=== Playwright Backstage Login Test ===", "backstageLoginTest");

  const config = loadGathererConfig();
  const session = await launchBackstageBrowser(config, false);

  try {
    await applyBackstageViewport(session.page);
    await performBackstageAutoLogin(session.page, config);

    await saveBackstageAuthState(session, config.backstageAuthStatePath);

    const authenticated = await backstageLoginIsAuthenticated(session.page);
    logInfo(`Logged in. URL: ${session.page.url()}`, "backstageLoginTest", { authenticated });

    logInfo("Waiting 5 seconds so you can see the dashboard...", "backstageLoginTest");
    await session.page.waitForTimeout(5000);

    logInfo("Playwright login test passed", "backstageLoginTest");
  } catch (error) {
    logError("Playwright login test failed", "backstageLoginTest", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  } finally {
    await closeBackstageBrowser(session);
  }
}

backstageLoginTestMain();

// Suggestions For Features and Additions Later:
// - --force flag to ignore saved session
