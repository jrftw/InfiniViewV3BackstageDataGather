/**
 * Filename: safeJson.ts
 * Purpose: Safe JSON serialization helpers.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-23
 * Platform Compatibility: Node.js 18+
 */

// MARK: - Safe JSON

export function gathererSafeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

// Suggestions For Features and Additions Later:
// - Circular reference replacer
