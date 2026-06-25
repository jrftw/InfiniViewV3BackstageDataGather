/**
 * Filename: crmEnrichmentFields.ts
 * Purpose: Shared CRM / profile snapshot field keys, defaults, merge, and header aliases.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-24
 * Platform Compatibility: Node.js 18+
 */

import { CombinedCreatorRecord } from "./mergeBackstageReports";

// MARK: - Profile Image Meta Fields

export const CRM_ENRICHMENT_PROFILE_IMAGE_META_FIELDS = [
  "profile_image_source",
  "profile_image_original_url",
  "profile_image_hash",
  "profile_image_last_checked_at",
  "profile_image_last_changed_at",
] as const;

// MARK: - TikTok Public Profile Snapshot Fields

export const CRM_ENRICHMENT_TIKTOK_PUBLIC_PROFILE_FIELDS = [
  "tiktok_profile_url",
  "creator_bio",
  "bio_link_url",
  "website_url",
  "public_following",
  "public_followers_snapshot",
  "public_likes_snapshot",
  "public_video_count_snapshot",
  "profile_snapshot_source",
  "profile_snapshot_last_checked_at",
  "profile_snapshot_last_changed_at",
  "profile_snapshot_status",
  "profile_snapshot_error",
  "profile_last_known_good_at",
  "profile_completion_score",
  "profile_needs_review",
] as const;

// MARK: - Top Video Fields

export const CRM_ENRICHMENT_TOP_VIDEO_FIELDS = [
  "top_video_1_url",
  "top_video_1_embed_url",
  "top_video_1_id",
  "top_video_1_source",
  "top_video_1_status",
  "top_video_1_last_checked_at",
  "top_video_2_url",
  "top_video_2_embed_url",
  "top_video_2_id",
  "top_video_2_source",
  "top_video_2_status",
  "top_video_2_last_checked_at",
  "top_video_3_url",
  "top_video_3_embed_url",
  "top_video_3_id",
  "top_video_3_source",
  "top_video_3_status",
  "top_video_3_last_checked_at",
] as const;

// MARK: - Recent Video Fields

export const CRM_ENRICHMENT_RECENT_VIDEO_FIELDS = [
  "recent_video_1_url",
  "recent_video_1_embed_url",
  "recent_video_1_id",
  "recent_video_1_source",
  "recent_video_1_status",
  "recent_video_1_last_checked_at",
  "recent_video_2_url",
  "recent_video_2_embed_url",
  "recent_video_2_id",
  "recent_video_2_source",
  "recent_video_2_status",
  "recent_video_2_last_checked_at",
  "recent_video_3_url",
  "recent_video_3_embed_url",
  "recent_video_3_id",
  "recent_video_3_source",
  "recent_video_3_status",
  "recent_video_3_last_checked_at",
  "recent_video_4_url",
  "recent_video_4_embed_url",
  "recent_video_4_id",
  "recent_video_4_source",
  "recent_video_4_status",
  "recent_video_4_last_checked_at",
  "recent_video_5_url",
  "recent_video_5_embed_url",
  "recent_video_5_id",
  "recent_video_5_source",
  "recent_video_5_status",
  "recent_video_5_last_checked_at",
  "recent_video_6_url",
  "recent_video_6_embed_url",
  "recent_video_6_id",
  "recent_video_6_source",
  "recent_video_6_status",
  "recent_video_6_last_checked_at",
] as const;

// MARK: - Core CRM Contact Fields

export const CRM_ENRICHMENT_CORE_CONTACT_FIELDS = [
  "email",
  "phone",
  "login_enabled",
  "crm_contact_id",
  "profile_image_url",
  "country",
  "region",
  "timezone",
  "manager_name",
  "director_name",
  "portal_user_id",
  "portal_login_enabled",
  "last_portal_login_at",
  "record_created_at",
  "record_updated_at",
  "last_reviewed_at",
  "last_contacted_at",
  "risk_status",
  "next_action_due_at",
  "dollars",
  "z_dip_status",
  "z_dip_payment_email",
  "agent_email",
] as const;

// MARK: - Combined Field Lists

export const CRM_SHEET_ENRICHMENT_DATA_FIELDS = [
  ...CRM_ENRICHMENT_CORE_CONTACT_FIELDS,
  ...CRM_ENRICHMENT_PROFILE_IMAGE_META_FIELDS,
  ...CRM_ENRICHMENT_TIKTOK_PUBLIC_PROFILE_FIELDS,
  ...CRM_ENRICHMENT_TOP_VIDEO_FIELDS,
  ...CRM_ENRICHMENT_RECENT_VIDEO_FIELDS,
] as const;

export type CrmSheetEnrichmentDataField = (typeof CRM_SHEET_ENRICHMENT_DATA_FIELDS)[number];

export type CrmSheetEnrichmentRow = {
  backstage_creator_id: string | null;
  tiktok_username: string | null;
} & Record<CrmSheetEnrichmentDataField, string | null>;

// MARK: - Master Sheet Column Block (profile → videos)

export const CRM_ENRICHMENT_MASTER_SHEET_PROFILE_BLOCK: CrmSheetEnrichmentDataField[] = [
  "profile_image_url",
  ...CRM_ENRICHMENT_PROFILE_IMAGE_META_FIELDS,
  "country",
  "region",
  "timezone",
  ...CRM_ENRICHMENT_TIKTOK_PUBLIC_PROFILE_FIELDS,
  ...CRM_ENRICHMENT_TOP_VIDEO_FIELDS,
  ...CRM_ENRICHMENT_RECENT_VIDEO_FIELDS,
];

// MARK: - Defaults + Merge

export function crmEnrichmentBuildNullDefaults(): Record<CrmSheetEnrichmentDataField, null> {
  const defaults = {} as Record<CrmSheetEnrichmentDataField, null>;
  for (const field of CRM_SHEET_ENRICHMENT_DATA_FIELDS) {
    defaults[field] = null;
  }
  return defaults;
}

export function crmEnrichmentBuildEmptyRow(): CrmSheetEnrichmentRow {
  return {
    backstage_creator_id: null,
    tiktok_username: null,
    ...crmEnrichmentBuildNullDefaults(),
  };
}

export function crmEnrichmentMergeRowIntoCreator(
  creator: CombinedCreatorRecord,
  row: CrmSheetEnrichmentRow
): CombinedCreatorRecord {
  const merged: CombinedCreatorRecord = { ...creator };

  for (const field of CRM_SHEET_ENRICHMENT_DATA_FIELDS) {
    merged[field] = row[field] ?? creator[field];
  }

  return merged;
}

// MARK: - Header Aliases

const CRM_ENRICHMENT_HEADER_ALIAS_OVERRIDES: Record<string, CrmSheetEnrichmentDataField | "backstage_creator_id" | "tiktok_username"> = {
  cid: "backstage_creator_id",
  creator_id: "backstage_creator_id",
  backstage_creator_id: "backstage_creator_id",
  userid: "tiktok_username",
  user_id: "tiktok_username",
  tiktok_username: "tiktok_username",
  username: "tiktok_username",
  emailaddress: "email",
  email_address: "email",
  loginenable: "login_enabled",
  login_enable: "login_enabled",
  crmcontactid: "crm_contact_id",
  profileimageurl: "profile_image_url",
  /** Backstage/TikTok region code (e.g. us_ca), not a US state display name */
  zregion: "region",
  managername: "manager_name",
  directorname: "director_name",
  portaluserid: "portal_user_id",
  portalloginenabled: "portal_login_enabled",
  lastportalloginat: "last_portal_login_at",
  recordcreatedat: "record_created_at",
  recordupdatedat: "record_updated_at",
  lastreviewedat: "last_reviewed_at",
  lastcontactedat: "last_contacted_at",
  riskstatus: "risk_status",
  nextactiondueat: "next_action_due_at",
  zdipstatus: "z_dip_status",
  z_dip_paymentemail: "z_dip_payment_email",
  zdippaymentemail: "z_dip_payment_email",
  agentemail: "agent_email",
};

export function crmEnrichmentBuildHeaderAliases(): Record<
  string,
  keyof CrmSheetEnrichmentRow
> {
  const aliases: Record<string, keyof CrmSheetEnrichmentRow> = {
    ...CRM_ENRICHMENT_HEADER_ALIAS_OVERRIDES,
  };

  for (const field of CRM_SHEET_ENRICHMENT_DATA_FIELDS) {
    aliases[field] = field;
    aliases[field.replace(/_/g, "")] = field;
  }

  return aliases;
}

// Suggestions For Features and Additions Later:
// - Resolve manager_name from agent_email / manager_email; director_name from director_email
// - Optional country_code + backstage_region_code columns alongside region
