/**
 * Filename: normalizeUsername.ts
 * Purpose: Normalize TikTok usernames for fallback matching.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-23
 * Platform Compatibility: Node.js 18+
 */

// MARK: - Username Normalization

export function normalizeTikTokUsername(raw: unknown): string | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  let text = String(raw).trim().toLowerCase();
  if (!text || text === "-") {
    return null;
  }
  if (text.startsWith("@")) {
    text = text.slice(1);
  }
  text = text.replace(/\s+/g, "");
  return text.length > 0 ? text : null;
}

// Suggestions For Features and Additions Later:
// - Strip unicode variants and homoglyphs
