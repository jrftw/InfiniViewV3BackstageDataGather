/**
 * Filename: browser.ts
 * Purpose: Playwright browser lifecycle with saved Backstage auth state.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-23
 * Dependencies: playwright
 * Platform Compatibility: Windows server PC with Chromium
 */

import fs from "fs";
import path from "path";
import { chromium, Browser, BrowserContext, Page, BrowserContextOptions } from "playwright";
import { GathererConfig } from "../config";
import { gathererEnsureDir } from "../utils/files";
import { logDebug, logInfo } from "../logging/logger";
import {
  buildBackstageRegionProfile,
  buildBackstageChromiumArgs,
  buildBackstageRegionContextOptions,
  buildBackstageNavigatorLocaleScript,
} from "./backstageRegionProfile";

// MARK: - Browser Session

export interface BackstageBrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

// MARK: - Launch Browser

export async function launchBackstageBrowser(
  config: GathererConfig,
  headlessOverride?: boolean
): Promise<BackstageBrowserSession> {
  gathererEnsureDir(path.dirname(config.backstageAuthStatePath));

  const headless = headlessOverride ?? config.backstageHeadless;
  const regionProfile = buildBackstageRegionProfile(config);

  const browser = await chromium.launch({
    headless,
    slowMo: config.backstageSlowMoMs > 0 ? config.backstageSlowMoMs : undefined,
    downloadsPath: config.localDownloadDir,
    args: buildBackstageChromiumArgs(regionProfile),
  });

  logInfo(
    headless ? "Browser launched (headless)" : "Browser launched (visible window)",
    "browser",
    {
      locale: regionProfile.locale,
      timezone: regionProfile.timezoneId,
      region: regionProfile.regionCode,
    }
  );

  const contextOptions: BrowserContextOptions = {
    acceptDownloads: true,
    viewport: { width: 2560, height: 1271 },
    ...buildBackstageRegionContextOptions(regionProfile),
  };

  if (fs.existsSync(config.backstageAuthStatePath)) {
    contextOptions.storageState = config.backstageAuthStatePath;
    logInfo("Loaded saved Backstage auth state", "browser");
  } else {
    logInfo("No saved auth state — run npm run login first", "browser");
  }

  const context = await browser.newContext(contextOptions);
  await context.addInitScript(buildBackstageNavigatorLocaleScript(regionProfile));
  const page = await context.newPage();

  return { browser, context, page };
}

export async function saveBackstageAuthState(
  session: BackstageBrowserSession,
  authPath: string
) {
  gathererEnsureDir(path.dirname(authPath));
  await session.context.storageState({ path: authPath });
  logInfo(`Saved auth state to ${authPath}`, "browser");
}

export async function closeBackstageBrowser(session: BackstageBrowserSession) {
  await session.context.close();
  await session.browser.close();
  logDebug("Browser closed", "browser");
}

// Suggestions For Features and Additions Later:
// - Persistent context profile for fewer logouts
