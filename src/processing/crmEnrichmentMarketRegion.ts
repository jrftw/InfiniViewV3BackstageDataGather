/**
 * Filename: crmEnrichmentMarketRegion.ts
 * Purpose: Normalize TikTok/Backstage market codes (e.g. us_ca) into market_region — not country or state.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-26
 * Dependencies: mergeBackstageReports
 * Platform Compatibility: Node.js 18+
 */

import { CombinedCreatorRecord } from "./mergeBackstageReports";

// MARK: - Market Code Detection

const CRM_ENRICHMENT_MARKET_REGION_KNOWN_BARE_CODES = new Set([
  "us",
  "uk",
  "ca",
  "au",
  "br",
  "mx",
  "jp",
  "kr",
  "de",
  "fr",
  "es",
  "it",
  "latam",
]);

export function crmEnrichmentLooksLikeMarketRegionCode(value: string | null | undefined): boolean {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (normalized.includes("_") || normalized.includes("+")) {
    return /^[a-z0-9_+]+$/.test(normalized);
  }

  return CRM_ENRICHMENT_MARKET_REGION_KNOWN_BARE_CODES.has(normalized);
}

// MARK: - Normalization

/**
 * TikTok/Backstage market tokens (us_ca, us+, uk+) belong in market_region.
 * country = geographic country; region = sub-national display (state/province) when available.
 */
export function crmEnrichmentNormalizeMarketRegionFields(
  creator: CombinedCreatorRecord
): CombinedCreatorRecord {
  const existingMarket = String(creator.market_region ?? "").trim();
  const existingRegion = String(creator.region ?? "").trim();
  const existingCountry = String(creator.country ?? "").trim();

  if (existingMarket) {
    return creator;
  }

  if (existingRegion && crmEnrichmentLooksLikeMarketRegionCode(existingRegion)) {
    return {
      ...creator,
      market_region: existingRegion.toLowerCase(),
      region: null,
    };
  }

  if (
    existingCountry &&
    crmEnrichmentLooksLikeMarketRegionCode(existingCountry) &&
    !existingRegion
  ) {
    return {
      ...creator,
      market_region: existingCountry.toLowerCase(),
      country: null,
    };
  }

  return creator;
}

// Suggestions For Features and Additions Later:
// - Map market_region codes to display labels for InfiniView UI
