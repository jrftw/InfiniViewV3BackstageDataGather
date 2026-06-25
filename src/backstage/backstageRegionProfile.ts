/**
 * Filename: backstageRegionProfile.ts
 * Purpose: US (and configurable) locale/region profile for Backstage browser sessions.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-23
 * Platform Compatibility: Playwright (Chromium)
 */

import { BrowserContextOptions } from "playwright";
import { GathererConfig } from "../config";

// MARK: - Region Profile Type

export interface BackstageRegionProfile {
  locale: string;
  timezoneId: string;
  regionCode: string;
  acceptLanguage: string;
  geolocation: { latitude: number; longitude: number };
}

// MARK: - US Defaults (Infinitum / Eastern US agency)

export const BACKSTAGE_US_REGION_PROFILE: BackstageRegionProfile = {
  locale: "en-US",
  timezoneId: "America/New_York",
  regionCode: "US",
  acceptLanguage: "en-US,en;q=0.9",
  geolocation: { latitude: 40.7128, longitude: -74.006 },
};

// MARK: - Build Profile From Config

export function buildBackstageRegionProfile(config: GathererConfig): BackstageRegionProfile {
  return {
    locale: config.backstageLocale,
    timezoneId: config.backstageTimezone,
    regionCode: config.backstageRegionCode,
    acceptLanguage: config.backstageAcceptLanguage,
    geolocation: {
      latitude: config.backstageGeoLatitude,
      longitude: config.backstageGeoLongitude,
    },
  };
}

// MARK: - Chromium Launch Args

export function buildBackstageChromiumArgs(profile: BackstageRegionProfile): string[] {
  return [
    `--lang=${profile.locale}`,
    `--accept-lang=${profile.acceptLanguage}`,
    `--timezone=${profile.timezoneId}`,
  ];
}

// MARK: - Playwright Context Options

export function buildBackstageRegionContextOptions(
  profile: BackstageRegionProfile
): Pick<
  BrowserContextOptions,
  "locale" | "timezoneId" | "geolocation" | "permissions" | "extraHTTPHeaders"
> {
  return {
    locale: profile.locale,
    timezoneId: profile.timezoneId,
    geolocation: profile.geolocation,
    permissions: ["geolocation"],
    extraHTTPHeaders: {
      "Accept-Language": profile.acceptLanguage,
      "Sec-CH-UA-Platform": '"Windows"',
    },
  };
}

// MARK: - Navigator Override Script (runs before page scripts)

export function buildBackstageNavigatorLocaleScript(profile: BackstageRegionProfile): string {
  const languagesJson = JSON.stringify([profile.locale, "en"]);
  return `
    Object.defineProperty(navigator, "language", { get: () => "${profile.locale}" });
    Object.defineProperty(navigator, "languages", { get: () => ${languagesJson} });
  `;
}

// Suggestions For Features and Additions Later:
// - Preset profiles for UK, EU if multi-region agencies are supported
