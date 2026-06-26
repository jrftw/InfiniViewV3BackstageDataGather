/**
 * Filename: tiktokPublicProfileBrowserVideos.ts
 * Purpose: Collect recent public TikTok video IDs via Playwright when SSR HTML has no itemList.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-26
 * Dependencies: playwright, config
 * Platform Compatibility: Node.js 18+ (Windows server PC)
 */

import { chromium } from "playwright";
import { GathererConfig } from "../config";
import { logDebug, logInfo, logWarn } from "../logging/logger";

// MARK: - Video ID Extraction

function tiktokPublicProfileBrowserVideosParseIdsFromPayload(payload: unknown): string[] {
  const ids: string[] = [];
  const queue: unknown[] = [payload];
  const seen = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object" || seen.has(current)) {
      continue;
    }
    seen.add(current);

    const record = current as Record<string, unknown>;
    if (typeof record.id === "string" && /^\d{8,30}$/.test(record.id)) {
      ids.push(record.id);
    }
    if (record.video && typeof record.video === "object") {
      const videoId = (record.video as { id?: string }).id;
      if (videoId && /^\d{8,30}$/.test(videoId)) {
        ids.push(videoId);
      }
    }

    for (const value of Object.values(record)) {
      if (value && typeof value === "object") {
        queue.push(value);
      }
    }
  }

  return ids;
}

function tiktokPublicProfileBrowserVideosUniqueOrdered(ids: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id);
      ordered.push(id);
    }
  }
  return ordered;
}

function tiktokPublicProfileBrowserVideosParseIdsFromHref(href: string): string | null {
  const match = href.match(/\/video\/(\d{8,30})/);
  return match?.[1] ?? null;
}

// MARK: - Browser Collector

export async function tiktokPublicProfileBrowserCollectVideoIds(
  config: GathererConfig,
  profileUrl: string,
  maxVideos: number
): Promise<string[]> {
  if (!config.profileAcquirerBrowserVideosEnabled) {
    return [];
  }

  const collectedIds: string[] = [];
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

  try {
    browser = await chromium.launch({
      headless: config.profileAcquirerTiktokHeadless,
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      locale: "en-US",
    });

    const page = await context.newPage();

    page.on("response", async (response) => {
      const responseUrl = response.url();
      if (
        !responseUrl.includes("item_list") &&
        !responseUrl.includes("/api/post/") &&
        !responseUrl.includes("/api/creator/item_list")
      ) {
        return;
      }

      try {
        const contentType = response.headers()["content-type"] ?? "";
        if (!contentType.includes("json")) {
          return;
        }
        const payload = (await response.json()) as unknown;
        collectedIds.push(...tiktokPublicProfileBrowserVideosParseIdsFromPayload(payload));
      } catch {
        // Ignore non-JSON or blocked responses
      }
    });

    logDebug(`Browser loading TikTok profile for videos: ${profileUrl}`, "tiktokPublicProfileBrowserVideos");
    await page.goto(profileUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(2500);

    for (let scrollPass = 0; scrollPass < 3; scrollPass += 1) {
      const hrefIds = await page.$$eval('a[href*="/video/"]', (anchors) =>
        anchors
          .map((anchor) => anchor.getAttribute("href") ?? "")
          .filter((href) => href.includes("/video/"))
      );

      for (const href of hrefIds) {
        const videoId = tiktokPublicProfileBrowserVideosParseIdsFromHref(href);
        if (videoId) {
          collectedIds.push(videoId);
        }
      }

      if (tiktokPublicProfileBrowserVideosUniqueOrdered(collectedIds).length >= maxVideos) {
        break;
      }

      await page.mouse.wheel(0, 1200);
      await page.waitForTimeout(1800);
    }

    await context.close();
    const uniqueIds = tiktokPublicProfileBrowserVideosUniqueOrdered(collectedIds).slice(0, maxVideos);

    logInfo(
      `Browser collected ${uniqueIds.length} recent video IDs from ${profileUrl}`,
      "tiktokPublicProfileBrowserVideos"
    );

    return uniqueIds;
  } catch (error) {
    logWarn(
      `Browser video collection failed for ${profileUrl}: ${error instanceof Error ? error.message : String(error)}`,
      "tiktokPublicProfileBrowserVideos"
    );
    return tiktokPublicProfileBrowserVideosUniqueOrdered(collectedIds).slice(0, maxVideos);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Suggestions For Features and Additions Later:
// - Reuse one browser session across an entire profile acquirer batch run
