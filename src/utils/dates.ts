/**
 * Filename: dates.ts
 * Purpose: Date/time helpers for run IDs and folder naming.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-23
 * Platform Compatibility: Node.js 18+
 */

// MARK: - Run Timestamp Helpers

export function gathererFormatRunTimestamp(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

export function gathererFormatDateKeyInTimezone(
  timezone: string,
  date: Date = new Date()
): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function gathererUnixMonthStartInTimezone(
  timezone: string,
  refDate: Date = new Date()
): number {
  const todayKey = gathererFormatDateKeyInTimezone(timezone, refDate);
  const monthStartKey = `${todayKey.slice(0, 7)}-01`;

  let lo = Math.floor(refDate.getTime() / 1000) - 40 * 86400;
  let hi = Math.floor(refDate.getTime() / 1000);

  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const key = gathererFormatDateKeyInTimezone(timezone, new Date(mid * 1000));
    if (key < monthStartKey) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }

  while (lo > 0) {
    const prev = lo - 3600;
    const prevKey = gathererFormatDateKeyInTimezone(timezone, new Date(prev * 1000));
    if (prevKey !== monthStartKey) {
      break;
    }
    lo = prev;
  }

  return lo;
}

export function gathererUnixPerformanceRange(
  timezone: string,
  mode: "month" | "rolling",
  rollingDays: number,
  refDate: Date = new Date()
): { startTime: number; endTime: number; label: string } {
  const endTime = Math.floor(refDate.getTime() / 1000);

  if (mode === "rolling") {
    const startTime = endTime - rollingDays * 24 * 60 * 60;
    return {
      startTime,
      endTime,
      label: `rolling_${rollingDays}d`,
    };
  }

  const startTime = gathererUnixMonthStartInTimezone(timezone, refDate);
  const monthKey = gathererFormatDateKeyInTimezone(timezone, refDate).slice(0, 7);
  return {
    startTime,
    endTime,
    label: `calendar_month_${monthKey}`,
  };
}

export function gathererFormatDateFolder(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function gathererGenerateRunId(): string {
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Suggestions For Features and Additions Later:
// - Use luxon/dayjs for explicit America/New_York formatting
