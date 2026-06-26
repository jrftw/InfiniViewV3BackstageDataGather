/**
 * Filename: gathererAppSafeUrls.ts
 * Purpose: Normalize creator-facing URLs — public HTTPS only, no local cache paths, safe TikTok embeds.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-26
 * Dependencies: none
 * Platform Compatibility: Node.js 18+
 */

// MARK: - Path Detection

export function gathererAppSafeIsLocalFilesystemPath(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  if (/^file:\/\//i.test(trimmed)) {
    return true;
  }

  if (/^[a-zA-Z]:[\\/]/.test(trimmed)) {
    return true;
  }

  if (trimmed.startsWith("\\\\")) {
    return true;
  }

  if (trimmed.includes("\\") && !trimmed.startsWith("http")) {
    return true;
  }

  if (trimmed.includes("/cache/") || trimmed.includes("\\cache\\")) {
    return true;
  }

  return false;
}

// MARK: - HTTPS URL Validation

export function gathererAppSafeIsPublicHttpsUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed.startsWith("https://")) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function gathererAppSafeIsDriveProfileImageUrl(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.includes("drive.google.com/uc?") ||
    normalized.includes("drive.google.com/file/") ||
    normalized.includes("drive.google.com/thumbnail")
  );
}

export function gathererAppSafeIsTikTokCdnImageUrl(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized.includes("tiktokcdn") && gathererAppSafeIsPublicHttpsUrl(normalized);
}

// MARK: - Profile Image URL

export function gathererAppSafeResolveProfileImageUrl(
  profileImageUrl: string | null | undefined,
  profileImageOriginalUrl: string | null | undefined
): string | null {
  const primary = String(profileImageUrl ?? "").trim();
  if (
    primary &&
    gathererAppSafeIsPublicHttpsUrl(primary) &&
    !gathererAppSafeIsLocalFilesystemPath(primary)
  ) {
    return primary;
  }

  const original = String(profileImageOriginalUrl ?? "").trim();
  if (original && gathererAppSafeIsPublicHttpsUrl(original)) {
    return original;
  }

  return null;
}

// MARK: - TikTok Video Embed URL

const GATHERER_APP_SAFE_TIKTOK_EMBED_BASE = "https://www.tiktok.com/embed/v2";

export function gathererAppSafeIsLikelyTikTokVideoId(videoId: string): boolean {
  return /^\d{8,25}$/.test(videoId.trim());
}

export function gathererAppSafeBuildTikTokVideoEmbedUrl(videoId: string): string | null {
  const trimmedId = videoId.trim();
  if (!gathererAppSafeIsLikelyTikTokVideoId(trimmedId)) {
    return null;
  }

  return `${GATHERER_APP_SAFE_TIKTOK_EMBED_BASE}/${trimmedId}`;
}

export function gathererAppSafeIsEmbedJsUrl(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized.includes("embed.js") || normalized.endsWith("/embed.js");
}

export function gathererAppSafeResolveRecentVideoEmbedUrl(
  embedUrl: string | null | undefined,
  videoId: string | null | undefined
): string | null {
  const id = String(videoId ?? "").trim();
  const canonical = id ? gathererAppSafeBuildTikTokVideoEmbedUrl(id) : null;

  const rawEmbed = String(embedUrl ?? "").trim();
  if (rawEmbed && !gathererAppSafeIsEmbedJsUrl(rawEmbed) && gathererAppSafeIsPublicHttpsUrl(rawEmbed)) {
    if (rawEmbed.includes("/embed/v2/") || rawEmbed.includes("/embed/")) {
      return rawEmbed;
    }
  }

  return canonical;
}

// Suggestions For Features and Additions Later:
// - Optional CDN proxy URL builder when TikTok CDN hotlinking is blocked in-app
