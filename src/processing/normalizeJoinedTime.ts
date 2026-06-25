/**
 * Filename: normalizeJoinedTime.ts
 * Purpose: Parse Backstage joined_time and derive new_live_creator_this_month (yes/no).
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-24
 * Dependencies: dates.ts
 * Platform Compatibility: Node.js 18+
 */

import { gathererFormatDateKeyInTimezone } from "../utils/dates";

// MARK: - Joined Time Parsing

/** Extract YYYY-MM from Backstage joined_time (e.g. "2023-08-05 00:11:00 (UTC+0)"). */
export function normalizeBackstageJoinedTimeMonthKey(
  joinedTime: string | null | undefined
): string | null {
  if (joinedTime === null || joinedTime === undefined) {
    return null;
  }

  const text = String(joinedTime).trim();
  if (!text) {
    return null;
  }

  const dateMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!dateMatch) {
    return null;
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  return `${dateMatch[1]}-${dateMatch[2]}`;
}

// MARK: - New Live Creator Derivation

/**
 * Returns "yes" when joined_time falls in the current calendar month (agency timezone), else "no".
 */
export function deriveNewLiveCreatorThisMonthFromJoinedTime(
  joinedTime: string | null | undefined,
  timezone: string,
  referenceDate: Date = new Date()
): "yes" | "no" | null {
  const joinedMonthKey = normalizeBackstageJoinedTimeMonthKey(joinedTime);
  if (!joinedMonthKey) {
    return null;
  }

  const currentMonthKey = gathererFormatDateKeyInTimezone(timezone, referenceDate).slice(0, 7);
  return joinedMonthKey === currentMonthKey ? "yes" : "no";
}

// Suggestions For Features and Additions Later:
// - Support Excel serial date values from raw exports
