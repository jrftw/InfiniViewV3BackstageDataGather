/**
 * Filename: normalizeDurations.ts
 * Purpose: Parse LIVE duration strings into decimal hours.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-23
 * Platform Compatibility: Node.js 18+
 */

// MARK: - Duration Parsing

export function normalizeBackstageDurationHours(raw: unknown): number | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  if (typeof raw === "number" && !Number.isNaN(raw)) {
    return Math.round(raw * 100) / 100;
  }
  const text = String(raw).trim();
  if (!text || text === "-") {
    return null;
  }

  const decimalHoursMatch = text.match(/^([\d.]+)\s*h$/i);
  if (decimalHoursMatch) {
    return Math.round(parseFloat(decimalHoursMatch[1]) * 100) / 100;
  }

  const hmsMatch = text.match(/(\d+)\s*h\s*(\d+)\s*m\s*(\d+)\s*s/i);
  if (hmsMatch) {
    const hours = parseInt(hmsMatch[1], 10);
    const minutes = parseInt(hmsMatch[2], 10);
    const seconds = parseInt(hmsMatch[3], 10);
    const total = hours + minutes / 60 + seconds / 3600;
    return Math.round(total * 100) / 100;
  }

  const hmMatch = text.match(/(\d+)\s*h\s*(\d+)\s*m/i);
  if (hmMatch) {
    const hours = parseInt(hmMatch[1], 10);
    const minutes = parseInt(hmMatch[2], 10);
    return Math.round((hours + minutes / 60) * 100) / 100;
  }

  const plain = parseFloat(text.replace(/,/g, ""));
  return Number.isNaN(plain) ? null : Math.round(plain * 100) / 100;
}

// Suggestions For Features and Additions Later:
// - Support minute-only formats
