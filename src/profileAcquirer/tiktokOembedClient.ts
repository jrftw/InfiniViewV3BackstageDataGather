/**
 * Filename: tiktokOembedClient.ts
 * Purpose: Fetch TikTok oEmbed data for known public video URLs and build app-safe embed URLs.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-26
 * Platform Compatibility: Node.js 18+
 */

import { logDebug } from "../logging/logger";
import {
  gathererAppSafeBuildTikTokVideoEmbedUrl,
  gathererAppSafeIsEmbedJsUrl,
  gathererAppSafeIsLikelyTikTokVideoId,
} from "../utils/gathererAppSafeUrls";

// MARK: - Types

export interface TikTokOembedClientResult {
  embedUrl: string | null;
  status: "ok" | "unavailable" | "error";
}

interface TikTokOembedApiResponse {
  html?: string;
  thumbnail_url?: string;
  author_name?: string;
  title?: string;
}

// MARK: - Client

const TIKTOK_OEMBED_ENDPOINT = "https://www.tiktok.com/oembed";
const TIKTOK_OEMBED_REQUEST_DELAY_MS = 350;

function tiktokOembedClientSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function tiktokOembedClientRequestOnce(videoUrl: string): Promise<Response> {
  const requestUrl = `${TIKTOK_OEMBED_ENDPOINT}?url=${encodeURIComponent(videoUrl)}`;
  return fetch(requestUrl, {
    headers: {
      Accept: "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
  });
}

export function tiktokOembedClientBuildAppEmbedUrl(videoId: string): string | null {
  return gathererAppSafeBuildTikTokVideoEmbedUrl(videoId);
}

export function tiktokOembedClientResolveAppEmbedResult(
  videoId: string,
  oembedStatus: TikTokOembedClientResult["status"]
): TikTokOembedClientResult {
  const embedUrl = tiktokOembedClientBuildAppEmbedUrl(videoId);
  if (!embedUrl) {
    return { embedUrl: null, status: "unavailable" };
  }

  return {
    embedUrl,
    status: oembedStatus,
  };
}

export async function tiktokOembedClientFetchEmbedUrl(videoUrl: string): Promise<TikTokOembedClientResult> {
  const trimmedUrl = videoUrl.trim();
  if (!trimmedUrl.startsWith("https://www.tiktok.com/")) {
    return { embedUrl: null, status: "unavailable" };
  }

  const videoIdMatch = trimmedUrl.match(/\/video\/(\d{8,25})/);
  const videoId = videoIdMatch?.[1] ?? "";

  try {
    let response = await tiktokOembedClientRequestOnce(trimmedUrl);

    if (response.status === 429 || response.status === 400) {
      await tiktokOembedClientSleep(TIKTOK_OEMBED_REQUEST_DELAY_MS);
      response = await tiktokOembedClientRequestOnce(trimmedUrl);
    }

    if (!response.ok) {
      logDebug(`TikTok oEmbed HTTP ${response.status} for ${trimmedUrl}`, "tiktokOembedClient");
      const status =
        response.status === 404 || response.status === 400 ? "unavailable" : "error";
      if (gathererAppSafeIsLikelyTikTokVideoId(videoId)) {
        return tiktokOembedClientResolveAppEmbedResult(videoId, status);
      }
      return { embedUrl: null, status };
    }

    const payload = (await response.json()) as TikTokOembedApiResponse;
    const html = payload.html ?? "";
    const srcMatch = html.match(/src="([^"]+)"/i);
    const rawEmbedSrc = srcMatch?.[1] ?? null;

    if (!rawEmbedSrc || gathererAppSafeIsEmbedJsUrl(rawEmbedSrc)) {
      if (gathererAppSafeIsLikelyTikTokVideoId(videoId)) {
        return tiktokOembedClientResolveAppEmbedResult(videoId, "unavailable");
      }
      return { embedUrl: null, status: "unavailable" };
    }

    if (gathererAppSafeIsLikelyTikTokVideoId(videoId)) {
      logDebug(`TikTok oEmbed resolved for ${trimmedUrl}`, "tiktokOembedClient");
      return tiktokOembedClientResolveAppEmbedResult(videoId, "ok");
    }

    return { embedUrl: null, status: "unavailable" };
  } catch (error) {
    logDebug(
      `TikTok oEmbed failed for ${trimmedUrl}: ${error instanceof Error ? error.message : String(error)}`,
      "tiktokOembedClient"
    );
    if (gathererAppSafeIsLikelyTikTokVideoId(videoId)) {
      return tiktokOembedClientResolveAppEmbedResult(videoId, "error");
    }
    return { embedUrl: null, status: "error" };
  } finally {
    await tiktokOembedClientSleep(TIKTOK_OEMBED_REQUEST_DELAY_MS);
  }
}

// Suggestions For Features and Additions Later:
// - Cache oEmbed responses locally with TTL to reduce rate limits
