/**
 * Filename: dates.ts
 * Purpose: Date/time helpers for run IDs and folder naming.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-25
 * Platform Compatibility: Node.js 18+
 */

// MARK: - Timezone Parts

export interface GathererZonedDateParts {
  year: string;
  month: string;
  day: string;
  hour: number;
  minute: number;
}

export function gathererGetZonedDateParts(
  timezone: string,
  date: Date = new Date()
): GathererZonedDateParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "00";

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: Number.parseInt(read("hour"), 10),
    minute: Number.parseInt(read("minute"), 10),
  };
}

function gathererCalendarKeyFromParts(parts: Pick<GathererZonedDateParts, "year" | "month" | "day">): string {
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function gathererShiftCalendarKeyByDays(calendarKey: string, dayDelta: number): string {
  const [yearText, monthText, dayText] = calendarKey.split("-");
  const shifted = new Date(
    Date.UTC(Number.parseInt(yearText, 10), Number.parseInt(monthText, 10) - 1, Number.parseInt(dayText, 10))
  );
  shifted.setUTCDate(shifted.getUTCDate() + dayDelta);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function gathererParseCutoffTimeToMinutes(cutoffTime: string): number {
  const [hourText, minuteText] = cutoffTime.split(":");
  const hour = Number.parseInt(hourText, 10);
  const minute = Number.parseInt(minuteText ?? "0", 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    throw new Error(`Invalid daily cutoff time: ${cutoffTime}`);
  }
  return hour * 60 + minute;
}

// MARK: - Business Day (8PM America/New_York cutoff)

/**
 * Operating business day label. Each day runs 8:00 PM ET → next 7:59 PM ET.
 * Uses America/New_York so EST/EDT (and UTC offset) change automatically.
 * During EDT, 8:00 PM Eastern = midnight UTC.
 */
export function gathererFormatBusinessDateKey(
  timezone: string,
  dailyCutoffTime: string,
  date: Date = new Date()
): string {
  const parts = gathererGetZonedDateParts(timezone, date);
  const calendarKey = gathererCalendarKeyFromParts(parts);
  const nowMinutes = parts.hour * 60 + parts.minute;
  const cutoffMinutes = gathererParseCutoffTimeToMinutes(dailyCutoffTime);

  if (nowMinutes >= cutoffMinutes) {
    return gathererShiftCalendarKeyByDays(calendarKey, 1);
  }

  return calendarKey;
}

/**
 * Label for the business day that closes at the current cutoff moment.
 * Used for the 8 PM daily archive (last pull of the day).
 */
export function gathererFormatClosingBusinessDateKey(
  timezone: string,
  dailyCutoffTime: string,
  date: Date = new Date()
): string {
  const parts = gathererGetZonedDateParts(timezone, date);
  const calendarKey = gathererCalendarKeyFromParts(parts);
  const nowMinutes = parts.hour * 60 + parts.minute;
  const cutoffMinutes = gathererParseCutoffTimeToMinutes(dailyCutoffTime);

  if (nowMinutes >= cutoffMinutes) {
    return calendarKey;
  }

  return gathererShiftCalendarKeyByDays(calendarKey, -1);
}

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

/** Backstage bulk export fallback — disabled by default (exports previous month on day 1). */
const GATHERER_MIN_MONTH_SPAN_SECONDS = 24 * 60 * 60;

function gathererIsEarlyMonthPerformanceFallbackEnabled(): boolean {
  return process.env.GATHERER_EARLY_MONTH_FALLBACK === "true";
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

  const currentMonthStart = gathererUnixMonthStartInTimezone(timezone, refDate);
  const startTime = currentMonthStart;
  const rangeEndTime = endTime;
  const monthKey = gathererFormatDateKeyInTimezone(timezone, refDate).slice(0, 7);

  if (
    gathererIsEarlyMonthPerformanceFallbackEnabled() &&
    rangeEndTime - startTime < GATHERER_MIN_MONTH_SPAN_SECONDS
  ) {
    const previousMonthRef = new Date((currentMonthStart - 3600) * 1000);
    const previousMonthStart = gathererUnixMonthStartInTimezone(timezone, previousMonthRef);
    const previousMonthKey = gathererFormatDateKeyInTimezone(timezone, previousMonthRef).slice(0, 7);
    return {
      startTime: previousMonthStart,
      endTime: currentMonthStart - 1,
      label: `calendar_month_${previousMonthKey}_early_month_fallback`,
    };
  }

  return {
    startTime,
    endTime: rangeEndTime,
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
