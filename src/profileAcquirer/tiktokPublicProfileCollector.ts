/**
 * Filename: tiktokPublicProfileCollector.ts
 * Purpose: Collect public TikTok profile snapshot data from a normalized username.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-26
 * Dependencies: tiktokOembedClient, profileAcquirerWritableFields
 * Platform Compatibility: Node.js 18+
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { GathererConfig } from "../config";
import { gathererEnsureDir } from "../utils/files";
import { logDebug, logWarn } from "../logging/logger";
import { profileAcquirerBuildTikTokProfileUrl } from "./profileAcquirerWritableFields";
import { tiktokOembedClientFetchEmbedUrl } from "./tiktokOembedClient";
import { tiktokPublicProfileBrowserCollectVideoIds } from "./tiktokPublicProfileBrowserVideos";
import { uploadProfileImageToDrive } from "../google/uploadProfileImageToDrive";
import { gathererAppSafeResolveProfileImageUrl } from "../utils/gathererAppSafeUrls";

// MARK: - Types

export interface TikTokPublicProfileRecentVideoSnapshot {
  url: string;
  embedUrl: string | null;
  id: string;
  source: string;
  status: string;
  lastCheckedAt: string;
}

export interface TikTokPublicProfileCollectorResult {
  profileSnapshotStatus: string;
  profileSnapshotError: string;
  tiktokProfileUrl: string;
  creatorBio: string | null;
  bioLinkUrl: string | null;
  websiteUrl: string | null;
  publicFollowing: string | null;
  publicFollowersSnapshot: string | null;
  publicLikesSnapshot: string | null;
  publicVideoCountSnapshot: string | null;
  profileImageOriginalUrl: string | null;
  profileImageUrl: string | null;
  profileImageHash: string | null;
  profileImageSource: string;
  recentVideos: TikTokPublicProfileRecentVideoSnapshot[];
}

export interface TikTokPublicProfileCollectorGatherOptions {
  existingProfileImageHash?: string | null;
  existingProfileImageUrl?: string | null;
  existingProfileImageSource?: string | null;
}

interface TikTokPublicProfileCollectorUserNode {
  uniqueId?: string;
  nickname?: string;
  signature?: string;
  avatarLarger?: string;
  avatarMedium?: string;
  bioLink?: { link?: string };
  followerCount?: number;
  followingCount?: number;
  heartCount?: number;
  videoCount?: number;
}

interface TikTokPublicProfileCollectorParsedProfile {
  user: TikTokPublicProfileCollectorUserNode;
  itemList: TikTokPublicProfileCollectorItemNode[];
}

interface TikTokPublicProfileCollectorItemNode {
  id?: string;
  video?: { id?: string };
}

// MARK: - HTTP + Parse Helpers

const TIKTOK_PUBLIC_PROFILE_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function tiktokPublicProfileCollectorExtractEmbeddedJson(html: string, scriptId: string): unknown | null {
  const pattern = new RegExp(
    `<script[^>]+id="${scriptId}"[^>]*type="application/json"[^>]*>([\\s\\S]*?)<\\/script>`,
    "i"
  );
  const match = html.match(pattern);
  if (!match?.[1]) {
    return null;
  }
  try {
    return JSON.parse(match[1]) as unknown;
  } catch {
    return null;
  }
}

function tiktokPublicProfileCollectorParseEmbeddedProfile(
  root: unknown
): TikTokPublicProfileCollectorParsedProfile | null {
  const scoped = root as {
    __DEFAULT_SCOPE__?: {
      "webapp.user-detail"?: {
        userInfo?: {
          user?: TikTokPublicProfileCollectorUserNode;
          stats?: {
            followerCount?: number;
            followingCount?: number;
            heartCount?: number;
            heart?: number;
            videoCount?: number;
          };
          itemList?: TikTokPublicProfileCollectorItemNode[];
        };
      };
    };
  };

  const userInfo = scoped.__DEFAULT_SCOPE__?.["webapp.user-detail"]?.userInfo;
  const user = userInfo?.user;
  if (user?.uniqueId && userInfo) {
    const stats = userInfo.stats;
    return {
      user: {
        ...user,
        followerCount: stats?.followerCount,
        followingCount: stats?.followingCount,
        heartCount: stats?.heartCount ?? stats?.heart,
        videoCount: stats?.videoCount,
      },
      itemList: userInfo.itemList ?? [],
    };
  }

  const queue: unknown[] = [root];
  const seen = new Set<unknown>();
  let fallbackUser: TikTokPublicProfileCollectorUserNode | null = null;

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object" || seen.has(current)) {
      continue;
    }
    seen.add(current);

    const record = current as Record<string, unknown>;
    if (typeof record.uniqueId === "string") {
      const nestedUser = record.user as TikTokPublicProfileCollectorUserNode | undefined;
      const nestedStats = record.stats as
        | {
            followerCount?: number;
            followingCount?: number;
            heartCount?: number;
            heart?: number;
            videoCount?: number;
          }
        | undefined;

      const candidate = nestedUser?.uniqueId
        ? {
            ...nestedUser,
            followerCount: nestedStats?.followerCount,
            followingCount: nestedStats?.followingCount,
            heartCount: nestedStats?.heartCount ?? nestedStats?.heart,
            videoCount: nestedStats?.videoCount,
          }
        : (record as TikTokPublicProfileCollectorUserNode);

      if (
        candidate.followerCount !== undefined ||
        candidate.videoCount !== undefined ||
        candidate.signature ||
        candidate.avatarLarger ||
        candidate.avatarMedium
      ) {
        return {
          user: candidate,
          itemList: Array.isArray(record.itemList)
            ? (record.itemList as TikTokPublicProfileCollectorItemNode[])
            : [],
        };
      }

      fallbackUser = candidate;
    }

    for (const value of Object.values(record)) {
      if (value && typeof value === "object") {
        queue.push(value);
      }
    }
  }

  return fallbackUser ? { user: fallbackUser, itemList: [] } : null;
}

function tiktokPublicProfileCollectorIsLikelyVideoId(raw: string): boolean {
  return /^\d{8,30}$/.test(raw.trim());
}

function tiktokPublicProfileCollectorFindRecentItems(root: unknown): TikTokPublicProfileCollectorItemNode[] {
  const queue: unknown[] = [root];
  const seen = new Set<unknown>();
  let bestList: TikTokPublicProfileCollectorItemNode[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object" || seen.has(current)) {
      continue;
    }
    seen.add(current);

    if (Array.isArray(current)) {
      const candidate = current.filter((entry) => {
        if (!entry || typeof entry !== "object") {
          return false;
        }
        const record = entry as TikTokPublicProfileCollectorItemNode;
        const videoId = String(record.id ?? record.video?.id ?? "").trim();
        return tiktokPublicProfileCollectorIsLikelyVideoId(videoId);
      }) as TikTokPublicProfileCollectorItemNode[];
      if (candidate.length > bestList.length) {
        bestList = candidate;
      }
    }

    for (const value of Object.values(current as Record<string, unknown>)) {
      if (value && typeof value === "object") {
        queue.push(value);
      }
    }
  }

  return bestList.slice(0, 6);
}

function tiktokPublicProfileCollectorBuildVideoUrl(uniqueId: string, videoId: string): string {
  return `https://www.tiktok.com/@${uniqueId}/video/${videoId}`;
}

async function tiktokPublicProfileCollectorCacheProfileImage(
  config: GathererConfig,
  normalizedUsername: string,
  imageUrl: string
): Promise<{ localPath: string; hash: string } | null> {
  try {
    const response = await fetch(imageUrl, {
      headers: { "User-Agent": TIKTOK_PUBLIC_PROFILE_USER_AGENT },
    });
    if (!response.ok) {
      return null;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");
    const cacheDir = path.join(config.localCacheDir, "profile-images");
    gathererEnsureDir(cacheDir);
    const localPath = path.join(cacheDir, `${normalizedUsername}.jpg`);
    fs.writeFileSync(localPath, buffer);
    return { localPath, hash };
  } catch (error) {
    logWarn(
      `Profile image cache failed for ${normalizedUsername}: ${error instanceof Error ? error.message : String(error)}`,
      "tiktokPublicProfileCollector"
    );
    return null;
  }
}

function tiktokPublicProfileCollectorIsDriveHostedImageUrl(imageUrl: string): boolean {
  const normalized = imageUrl.trim().toLowerCase();
  return (
    normalized.includes("drive.google.com/uc?") ||
    normalized.includes("drive.google.com/file/") ||
    normalized.includes("drive.google.com/thumbnail")
  );
}

function tiktokPublicProfileCollectorResolveReusableHostedImage(
  computedHash: string,
  options: TikTokPublicProfileCollectorGatherOptions
): { url: string; source: string } | null {
  const priorHash = String(options.existingProfileImageHash ?? "").trim().toLowerCase();
  const priorUrl = String(options.existingProfileImageUrl ?? "").trim();
  if (!priorHash || !priorUrl) {
    return null;
  }
  if (computedHash.toLowerCase() !== priorHash) {
    return null;
  }

  const priorSource = String(options.existingProfileImageSource ?? "").trim().toLowerCase();
  const isDriveHosted =
    tiktokPublicProfileCollectorIsDriveHostedImageUrl(priorUrl) || priorSource === "google_drive";

  if (!isDriveHosted) {
    return null;
  }

  return {
    url: priorUrl,
    source: "google_drive",
  };
}

function tiktokPublicProfileCollectorFailureResult(
  normalizedUsername: string,
  status: string,
  errorMessage: string
): TikTokPublicProfileCollectorResult {
  return {
    profileSnapshotStatus: status,
    profileSnapshotError: errorMessage,
    tiktokProfileUrl: profileAcquirerBuildTikTokProfileUrl(normalizedUsername),
    creatorBio: null,
    bioLinkUrl: null,
    websiteUrl: null,
    publicFollowing: null,
    publicFollowersSnapshot: null,
    publicLikesSnapshot: null,
    publicVideoCountSnapshot: null,
    profileImageOriginalUrl: null,
    profileImageUrl: null,
    profileImageHash: null,
    profileImageSource: "unavailable",
    recentVideos: [],
  };
}

// MARK: - Collector

export async function tiktokPublicProfileCollectorGather(
  config: GathererConfig,
  normalizedUsername: string,
  gatherOptions: TikTokPublicProfileCollectorGatherOptions = {}
): Promise<TikTokPublicProfileCollectorResult> {
  const profileUrl = profileAcquirerBuildTikTokProfileUrl(normalizedUsername);
  const checkedAt = new Date().toISOString();

  logDebug(`Collecting TikTok public profile for @${normalizedUsername}`, "tiktokPublicProfileCollector");

  let html = "";
  try {
    const response = await fetch(profileUrl, {
      headers: {
        "User-Agent": TIKTOK_PUBLIC_PROFILE_USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });

    if (response.status === 404) {
      return tiktokPublicProfileCollectorFailureResult(
        normalizedUsername,
        "not_found",
        "TikTok profile not found"
      );
    }

    if (!response.ok) {
      return tiktokPublicProfileCollectorFailureResult(
        normalizedUsername,
        "blocked",
        `TikTok public profile snapshot blocked or unavailable (HTTP ${response.status})`
      );
    }

    html = await response.text();
  } catch (error) {
    return tiktokPublicProfileCollectorFailureResult(
      normalizedUsername,
      "error",
      error instanceof Error ? error.message : String(error)
    );
  }

  const embedded =
    tiktokPublicProfileCollectorExtractEmbeddedJson(html, "__UNIVERSAL_DATA_FOR_REHYDRATION__") ??
    tiktokPublicProfileCollectorExtractEmbeddedJson(html, "SIGI_STATE");

  if (!embedded) {
    return tiktokPublicProfileCollectorFailureResult(
      normalizedUsername,
      "blocked",
      "TikTok public profile snapshot blocked or unavailable"
    );
  }

  const parsedProfile = tiktokPublicProfileCollectorParseEmbeddedProfile(embedded);
  const user = parsedProfile?.user;
  if (!user?.uniqueId) {
    return tiktokPublicProfileCollectorFailureResult(
      normalizedUsername,
      "not_found",
      "TikTok profile not found"
    );
  }

  const avatarUrl = user.avatarMedium ?? user.avatarLarger ?? null;
  const profileImageOriginalUrl = user.avatarLarger ?? user.avatarMedium ?? avatarUrl;
  let profileImageUrl: string | null = profileImageOriginalUrl;
  let profileImageHash: string | null = null;
  let profileImageSource = profileImageOriginalUrl ? "tiktok_cdn" : "unavailable";

  if (avatarUrl) {
    const cached = await tiktokPublicProfileCollectorCacheProfileImage(
      config,
      normalizedUsername,
      avatarUrl
    );
    if (cached) {
      profileImageHash = cached.hash;
      const reusableHostedImage = tiktokPublicProfileCollectorResolveReusableHostedImage(
        cached.hash,
        gatherOptions
      );

      if (reusableHostedImage) {
        profileImageUrl = reusableHostedImage.url;
        profileImageSource = reusableHostedImage.source;
        logDebug(
          `Profile image unchanged for @${normalizedUsername} — reusing Drive URL, skipping upload`,
          "tiktokPublicProfileCollector"
        );
      } else {
        const driveUpload = await uploadProfileImageToDrive(
          config,
          cached.localPath,
          normalizedUsername
        );
        if (driveUpload) {
          profileImageUrl = driveUpload.publicViewUrl;
          profileImageSource = "google_drive";
          logDebug(
            `Profile image published to Drive for @${normalizedUsername}`,
            "tiktokPublicProfileCollector"
          );
        } else {
          profileImageUrl = profileImageOriginalUrl;
          profileImageSource = profileImageOriginalUrl ? "tiktok_cdn" : "unavailable";
          logDebug(
            `Drive upload skipped for @${normalizedUsername} — using TikTok CDN original URL`,
            "tiktokPublicProfileCollector"
          );
        }
      }
    }
  }

  profileImageUrl = gathererAppSafeResolveProfileImageUrl(
    profileImageUrl,
    profileImageOriginalUrl
  );

  const bioLink = user.bioLink?.link?.trim() ?? null;
  const profileItemList = parsedProfile?.itemList ?? [];
  let recentItems =
    profileItemList.length > 0
      ? profileItemList
      : tiktokPublicProfileCollectorFindRecentItems(embedded);

  if (recentItems.length === 0 && config.profileAcquirerBrowserVideosEnabled) {
    const browserVideoIds = await tiktokPublicProfileBrowserCollectVideoIds(
      config,
      profileUrl,
      6
    );
    recentItems = browserVideoIds.map((id) => ({ id }));
  }

  const recentVideos: TikTokPublicProfileRecentVideoSnapshot[] = [];

  for (const item of recentItems) {
    const videoId = String(item.id ?? item.video?.id ?? "").trim();
    if (!videoId || !tiktokPublicProfileCollectorIsLikelyVideoId(videoId)) {
      continue;
    }
    const videoUrl = tiktokPublicProfileCollectorBuildVideoUrl(user.uniqueId, videoId);
    const oembed = await tiktokOembedClientFetchEmbedUrl(videoUrl);
    recentVideos.push({
      url: videoUrl,
      embedUrl: oembed.embedUrl,
      id: videoId,
      source: oembed.status === "ok" ? "tiktok_oembed" : "public_profile",
      status: oembed.status,
      lastCheckedAt: checkedAt,
    });
    if (recentVideos.length >= 6) {
      break;
    }
  }

  const snapshotStatus =
    avatarUrl || user.signature || user.followerCount !== undefined ? "ok" : "manual_review";
  const snapshotError = snapshotStatus === "manual_review" ? "Important profile fields missing" : "";

  return {
    profileSnapshotStatus: snapshotStatus,
    profileSnapshotError: snapshotError,
    tiktokProfileUrl: profileUrl,
    creatorBio: user.signature?.trim() || null,
    bioLinkUrl: bioLink,
    websiteUrl: bioLink,
    publicFollowing:
      user.followingCount !== undefined ? String(user.followingCount) : null,
    publicFollowersSnapshot:
      user.followerCount !== undefined ? String(user.followerCount) : null,
    publicLikesSnapshot: user.heartCount !== undefined ? String(user.heartCount) : null,
    publicVideoCountSnapshot:
      user.videoCount !== undefined ? String(user.videoCount) : null,
    profileImageOriginalUrl: profileImageOriginalUrl,
    profileImageUrl,
    profileImageHash,
    profileImageSource,
    recentVideos,
  };
}

// Suggestions For Features and Additions Later:
// - Official TikTok Display API path when creator OAuth is available
// - Top video detection when performance metrics are exposed publicly
// - Skip TikTok image download when avatar URL matches stored profile_image_original_url
