/**
 * Filename: normalizeNumbers.ts
 * Purpose: Parse diamonds, days, percents, and booleans from Backstage export text.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-23
 * Platform Compatibility: Node.js 18+
 */

// MARK: - Diamond Parsing

export function normalizeBackstageDiamonds(raw: unknown): number | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  if (typeof raw === "number" && !Number.isNaN(raw)) {
    return raw;
  }
  const text = String(raw).trim();
  if (!text || text === "-") {
    return null;
  }
  const upper = text.toUpperCase().replace(/,/g, "");
  const match = upper.match(/^([\d.]+)([KMB])?$/);
  if (!match) {
    const plain = Number(upper);
    return Number.isNaN(plain) ? null : plain;
  }
  const base = parseFloat(match[1]);
  const suffix = match[2];
  if (suffix === "K") return Math.round(base * 1_000);
  if (suffix === "M") return Math.round(base * 1_000_000);
  if (suffix === "B") return Math.round(base * 1_000_000_000);
  return Math.round(base);
}

// MARK: - Days Parsing

export function normalizeBackstageDays(raw: unknown): number | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  if (typeof raw === "number" && !Number.isNaN(raw)) {
    return raw;
  }
  const text = String(raw).trim().replace(/,/g, "");
  if (!text || text === "-") {
    return null;
  }
  const match = text.match(/^([\d.]+)\s*d?$/i);
  if (!match) {
    const plain = Number(text);
    return Number.isNaN(plain) ? null : plain;
  }
  return Math.round(parseFloat(match[1]));
}

// MARK: - Percent Parsing

export function normalizeBackstagePercent(
  raw: unknown
): { value: number | null; warning?: string } {
  if (raw === null || raw === undefined) {
    return { value: null };
  }
  const text = String(raw).trim();
  if (!text || text === "-") {
    return { value: null };
  }
  if (text.includes("∞")) {
    return { value: null, warning: "Infinite percent value" };
  }
  const cleaned = text.replace("%", "").replace(/,/g, "").trim();
  const num = parseFloat(cleaned);
  return Number.isNaN(num) ? { value: null } : { value: num };
}

// MARK: - Boolean Parsing

export function normalizeBackstageBoolean(raw: unknown): boolean | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  const text = String(raw).trim().toLowerCase();
  if (!text || text === "-") {
    return null;
  }
  if (text === "yes" || text === "true" || text === "1") {
    return true;
  }
  if (text === "no" || text === "false" || text === "0") {
    return false;
  }
  return null;
}

// MARK: - Generic Number

export function normalizeBackstageNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  if (typeof raw === "number" && !Number.isNaN(raw)) {
    return raw;
  }
  const text = String(raw).trim().replace(/,/g, "");
  if (!text || text === "-") {
    return null;
  }
  const num = parseFloat(text);
  return Number.isNaN(num) ? null : num;
}

// Suggestions For Features and Additions Later:
// - Locale-aware number parsing
