/**
 * Filename: profileAcquirerWritableFields.ts
 * Purpose: Field keys the TikTok Public Profile Acquirer may read/write — never Backstage performance fields.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-26
 * Dependencies: crmEnrichmentFields
 * Platform Compatibility: Node.js 18+
 */

import {
  CRM_ENRICHMENT_PROFILE_IMAGE_META_FIELDS,
  CRM_ENRICHMENT_RECENT_VIDEO_FIELDS,
  CRM_ENRICHMENT_TIKTOK_PUBLIC_PROFILE_FIELDS,
  CRM_ENRICHMENT_TOP_VIDEO_FIELDS,
} from "../processing/crmEnrichmentFields";

// MARK: - Writable Profile Acquirer Fields

export const PROFILE_ACQUIRER_WRITABLE_FIELDS = [
  "profile_image_url",
  ...CRM_ENRICHMENT_PROFILE_IMAGE_META_FIELDS,
  ...CRM_ENRICHMENT_TIKTOK_PUBLIC_PROFILE_FIELDS,
  ...CRM_ENRICHMENT_TOP_VIDEO_FIELDS,
  ...CRM_ENRICHMENT_RECENT_VIDEO_FIELDS,
] as const;

export type ProfileAcquirerWritableField = (typeof PROFILE_ACQUIRER_WRITABLE_FIELDS)[number];

export const PROFILE_ACQUIRER_WRITABLE_FIELD_SET = new Set<string>(PROFILE_ACQUIRER_WRITABLE_FIELDS);

// MARK: - Profile URL Builder

export function profileAcquirerBuildTikTokProfileUrl(normalizedUsername: string): string {
  return `https://www.tiktok.com/@${normalizedUsername}`;
}

// Suggestions For Features and Additions Later:
// - Dedicated internal profile_image_cache_path field if local diagnostics are needed
