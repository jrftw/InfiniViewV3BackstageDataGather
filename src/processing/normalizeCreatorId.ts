/**
 * Filename: normalizeCreatorId.ts
 * Purpose: Normalize Backstage Creator ID values for matching.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-23
 * Platform Compatibility: Node.js 18+
 */

// MARK: - Creator ID Normalization

export function normalizeBackstageCreatorId(raw: unknown): string | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  const text = String(raw).trim();
  if (!text || text === "-" || text.toLowerCase() === "null") {
    return null;
  }
  const digitsOnly = text.replace(/\D/g, "");
  return digitsOnly.length > 0 ? digitsOnly : null;
}

// Suggestions For Features and Additions Later:
// - Validate TikTok creator ID length ranges
