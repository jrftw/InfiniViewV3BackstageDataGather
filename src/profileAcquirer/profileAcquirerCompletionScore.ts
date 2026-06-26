/**
 * Filename: profileAcquirerCompletionScore.ts
 * Purpose: Calculate profile_completion_score and profile_needs_review from snapshot fields.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-26
 * Platform Compatibility: Node.js 18+
 */

import { CombinedCreatorRecord } from "../processing/mergeBackstageReports";

// MARK: - Scoring

export interface ProfileAcquirerCompletionResult {
  profile_completion_score: number;
  profile_needs_review: boolean;
}

function profileAcquirerHasText(value: string | null | undefined): boolean {
  return Boolean(value && String(value).trim().length > 0);
}

function profileAcquirerHasRecentVideos(creator: CombinedCreatorRecord, minimum: number): boolean {
  let count = 0;
  for (let index = 1; index <= 6; index += 1) {
    const urlKey = `recent_video_${index}_url` as keyof CombinedCreatorRecord;
    const statusKey = `recent_video_${index}_status` as keyof CombinedCreatorRecord;
    const url = creator[urlKey];
    const status = creator[statusKey];
    if (profileAcquirerHasText(url as string | null) && status === "ok") {
      count += 1;
    }
  }
  return count >= minimum;
}

export function profileAcquirerCalculateCompletion(
  creator: CombinedCreatorRecord,
  snapshotStatus: string | null
): ProfileAcquirerCompletionResult {
  let score = 0;

  if (profileAcquirerHasText(creator.profile_image_url)) {
    score += 20;
  }
  if (profileAcquirerHasText(creator.creator_bio)) {
    score += 20;
  }
  if (profileAcquirerHasText(creator.bio_link_url) || profileAcquirerHasText(creator.website_url)) {
    score += 15;
  }
  if (profileAcquirerHasText(creator.public_followers_snapshot)) {
    score += 15;
  }
  if (profileAcquirerHasText(creator.public_video_count_snapshot)) {
    score += 15;
  }
  if (profileAcquirerHasRecentVideos(creator, 3)) {
    score += 15;
  }

  const needsReview =
    snapshotStatus === "not_found" ||
    snapshotStatus === "blocked" ||
    snapshotStatus === "manual_review" ||
    snapshotStatus === "error" ||
    score < 60;

  return {
    profile_completion_score: score,
    profile_needs_review: needsReview,
  };
}

// Suggestions For Features and Additions Later:
// - Weight top videos separately when top_video detection is implemented
