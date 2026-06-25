/**
 * Filename: normalizeCreatorForCache.ts
 * Purpose: Normalize creator records for JSON cache (plain phone text, no sheet prefixes).
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-24
 * Platform Compatibility: Node.js 18+
 */

import { CombinedCreatorRecord } from "./mergeBackstageReports";

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

// MARK: - Cache Record Normalization

export function normalizeCreatorRecordForCache(
  creator: CombinedCreatorRecord
): CombinedCreatorRecord {
  return {
    ...creator,
    phone: normalizeCreatorPhoneForStorage(creator.phone),
  };
}

// Suggestions For Features and Additions Later:
// - Normalize other plain-text sheet fields if added later
