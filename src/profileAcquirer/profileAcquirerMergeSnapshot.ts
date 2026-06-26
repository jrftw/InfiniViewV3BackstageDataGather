/**
 * Filename: profileAcquirerMergeSnapshot.ts
 * Purpose: Merge TikTok public profile snapshot into a creator row without touching Backstage fields.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-26
 * Dependencies: mergeBackstageReports, profileAcquirerCompletionScore, tiktokPublicProfileCollector
 * Platform Compatibility: Node.js 18+
 */

import { CombinedCreatorRecord } from "../processing/mergeBackstageReports";
import { normalizeTikTokUsername } from "../processing/normalizeUsername";
import { CrmSheetEnrichmentDataField } from "../processing/crmEnrichmentFields";
import { profileAcquirerCalculateCompletion } from "./profileAcquirerCompletionScore";
import { TikTokPublicProfileCollectorResult } from "./tiktokPublicProfileCollector";
import { gathererAppSafeResolveProfileImageUrl } from "../utils/gathererAppSafeUrls";

// MARK: - Merge Helpers

function profileAcquirerMergeSnapshotHasProfileDataChanged(
  before: CombinedCreatorRecord,
  after: CombinedCreatorRecord
): boolean {
  const compareFields: (keyof CombinedCreatorRecord)[] = [
    "creator_bio",
    "bio_link_url",
    "website_url",
    "public_following",
    "public_followers_snapshot",
    "public_likes_snapshot",
    "public_video_count_snapshot",
    "profile_image_hash",
    "profile_snapshot_status",
  ];

  return compareFields.some((field) => (before[field] ?? "") !== (after[field] ?? ""));
}

function profileAcquirerMergeSnapshotApplyRecentVideos(
  creator: CombinedCreatorRecord,
  snapshot: TikTokPublicProfileCollectorResult,
  checkedAt: string
): CombinedCreatorRecord {
  const videoFields: Partial<Record<CrmSheetEnrichmentDataField, string | null>> = {};

  for (let index = 1; index <= 6; index += 1) {
    const video = snapshot.recentVideos[index - 1];
    videoFields[`recent_video_${index}_url` as CrmSheetEnrichmentDataField] = video?.url ?? null;
    videoFields[`recent_video_${index}_embed_url` as CrmSheetEnrichmentDataField] =
      video?.embedUrl ?? null;
    videoFields[`recent_video_${index}_id` as CrmSheetEnrichmentDataField] = video?.id ?? null;
    videoFields[`recent_video_${index}_source` as CrmSheetEnrichmentDataField] =
      video?.source ?? "unavailable";
    videoFields[`recent_video_${index}_status` as CrmSheetEnrichmentDataField] =
      video?.status ?? "unavailable";
    videoFields[`recent_video_${index}_last_checked_at` as CrmSheetEnrichmentDataField] =
      video?.lastCheckedAt ?? checkedAt;
  }

  for (let index = 1; index <= 3; index += 1) {
    videoFields[`top_video_${index}_url` as CrmSheetEnrichmentDataField] = null;
    videoFields[`top_video_${index}_embed_url` as CrmSheetEnrichmentDataField] = null;
    videoFields[`top_video_${index}_id` as CrmSheetEnrichmentDataField] = null;
    videoFields[`top_video_${index}_status` as CrmSheetEnrichmentDataField] = "unavailable";
    videoFields[`top_video_${index}_source` as CrmSheetEnrichmentDataField] = "unavailable";
    videoFields[`top_video_${index}_last_checked_at` as CrmSheetEnrichmentDataField] = null;
  }

  return { ...creator, ...videoFields };
}

// MARK: - Merge Engine

export function profileAcquirerMergeSnapshotIntoCreator(
  creator: CombinedCreatorRecord,
  snapshot: TikTokPublicProfileCollectorResult
): CombinedCreatorRecord {
  const checkedAt = new Date().toISOString();
  const before = { ...creator };
  const appSafeProfileImageUrl = gathererAppSafeResolveProfileImageUrl(
    snapshot.profileImageUrl,
    snapshot.profileImageOriginalUrl
  );

  let merged: CombinedCreatorRecord = {
    ...creator,
    tiktok_profile_url: snapshot.tiktokProfileUrl,
    creator_bio: snapshot.creatorBio,
    bio_link_url: snapshot.bioLinkUrl,
    website_url: snapshot.websiteUrl,
    public_following: snapshot.publicFollowing,
    public_followers_snapshot: snapshot.publicFollowersSnapshot,
    public_likes_snapshot: snapshot.publicLikesSnapshot,
    public_video_count_snapshot: snapshot.publicVideoCountSnapshot,
    profile_snapshot_source: "tiktok_public_snapshot",
    profile_snapshot_status: snapshot.profileSnapshotStatus,
    profile_snapshot_error: snapshot.profileSnapshotError || null,
    profile_snapshot_last_checked_at: checkedAt,
    profile_image_source: snapshot.profileImageSource,
    profile_image_original_url: snapshot.profileImageOriginalUrl,
    profile_image_url: appSafeProfileImageUrl,
    profile_image_hash: snapshot.profileImageHash,
    profile_image_last_checked_at: checkedAt,
  };

  if (snapshot.profileImageHash && snapshot.profileImageHash !== creator.profile_image_hash) {
    merged.profile_image_last_changed_at = checkedAt;
  }

  if (profileAcquirerMergeSnapshotHasProfileDataChanged(before, merged)) {
    merged.profile_snapshot_last_changed_at = checkedAt;
  }

  if (snapshot.profileSnapshotStatus === "ok") {
    merged.profile_last_known_good_at = checkedAt;
  }

  merged = profileAcquirerMergeSnapshotApplyRecentVideos(merged, snapshot, checkedAt);

  const completion = profileAcquirerCalculateCompletion(merged, snapshot.profileSnapshotStatus);
  merged.profile_completion_score = String(completion.profile_completion_score);
  merged.profile_needs_review = completion.profile_needs_review ? "TRUE" : "FALSE";

  if (!merged.normalized_username) {
    merged.normalized_username = normalizeTikTokUsername(creator.tiktok_username);
  }

  if (!merged.normalized_username) {
    merged.profile_needs_review = "TRUE";
    if (!merged.profile_snapshot_error) {
      merged.profile_snapshot_error = "normalized_username missing";
    }
  }

  return merged;
}

// Suggestions For Features and Additions Later:
// - Diff-based change log entries for profile_snapshot_last_changed_at audit trail
