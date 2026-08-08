/**
 * Filename: gathererPerformanceDataPeriodCoverage.ts
 * Purpose: Determine whether a Backstage performance_data_period string covers a calendar month.
 *          Used to avoid writing prior-month MTD totals into the current month on roster publish.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-08-08
 * Dependencies: none
 * Platform Compatibility: Node.js 18+
 */

// MARK: Coverage

/**
 * Returns true when `performanceDataPeriod` begins with `monthKey` (YYYY-MM).
 *
 * Example: period `2026-08-01 ~ 2026-08-07` covers month `2026-08`.
 */
export function gathererPerformanceDataPeriodCoversMonth(
  performanceDataPeriod: string | null | undefined,
  monthKey: string
): boolean {
  const period = String(performanceDataPeriod ?? "").trim();
  const month = String(monthKey ?? "").trim();
  if (!period || !/^\d{4}-\d{2}$/.test(month)) {
    return false;
  }
  return period.startsWith(month);
}

// Suggestions For Features and Additions Later:
// - Parse explicit start/end dates from period cell for stricter mid-month joiner handling
