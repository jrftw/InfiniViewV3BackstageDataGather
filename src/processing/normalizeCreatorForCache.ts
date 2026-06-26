/**
 * Filename: normalizeCreatorForCache.ts
 * Purpose: Normalize creator records for JSON cache and master sheet — app-safe public fields only.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-26
 * Dependencies: mergeBackstageReports, crmEnrichmentMarketRegion, gathererAppSafeUrls
 * Platform Compatibility: Node.js 18+
 */

import { CombinedCreatorRecord } from "./mergeBackstageReports";
import { crmEnrichmentNormalizeMarketRegionFields } from "./crmEnrichmentMarketRegion";
import {
  gathererAppSafeResolveProfileImageUrl,
  gathererAppSafeResolveRecentVideoEmbedUrl,
} from "../utils/gathererAppSafeUrls";

// MARK: - Phone Normalization

/** Strip Google Sheets plain-text prefix; cache/app use digits only. */
export function normalizeCreatorPhoneForStorage(phone: string | null | undefined): string | null {
  if (phone === null || phone === undefined) {
    return null;
  }

  let text = String(phone).trim();
  if (!text) {
    return null;
  }

  while (text.startsWith("'")) {
    text = text.slice(1);
  }

  return text;
}

// MARK: - Profile Image Normalization

function normalizeCreatorRecordSanitizeProfileImage(
  creator: CombinedCreatorRecord
): CombinedCreatorRecord {
  const profileImageUrl = gathererAppSafeResolveProfileImageUrl(
    creator.profile_image_url,
    creator.profile_image_original_url
  );

  let profileImageSource = creator.profile_image_source;
  if (profileImageUrl && profileImageUrl === creator.profile_image_original_url) {
    profileImageSource = "tiktok_cdn";
  }

  return {
    ...creator,
    profile_image_url: profileImageUrl,
    profile_image_source: profileImageSource,
  };
}

// MARK: - Recent Video Embed Normalization

function normalizeCreatorRecordSanitizeRecentVideoEmbeds(
  creator: CombinedCreatorRecord
): CombinedCreatorRecord {
  const updated: CombinedCreatorRecord = { ...creator };

  for (let index = 1; index <= 6; index += 1) {
    const embedKey = `recent_video_${index}_embed_url`;
    const idKey = `recent_video_${index}_id`;
    const embedValue = updated[embedKey as keyof CombinedCreatorRecord] as string | null;
    const idValue = updated[idKey as keyof CombinedCreatorRecord] as string | null;
    const resolvedEmbed = gathererAppSafeResolveRecentVideoEmbedUrl(embedValue, idValue);

    (updated as Record<string, string | null>)[embedKey] = resolvedEmbed;
  }

  return updated;
}

// MARK: - App Record Normalization

export function normalizeCreatorRecordForApp(
  creator: CombinedCreatorRecord
): CombinedCreatorRecord {
  let normalized: CombinedCreatorRecord = {
    ...creator,
    phone: normalizeCreatorPhoneForStorage(creator.phone),
  };

  normalized = crmEnrichmentNormalizeMarketRegionFields(normalized);
  normalized = normalizeCreatorRecordSanitizeProfileImage(normalized);
  normalized = normalizeCreatorRecordSanitizeRecentVideoEmbeds(normalized);

  return normalized;
}

export function normalizeCreatorRecordForCache(
  creator: CombinedCreatorRecord
): CombinedCreatorRecord {
  return normalizeCreatorRecordForApp(creator);
}

// Suggestions For Features and Additions Later:
// - Normalize other plain-text sheet fields if added later
