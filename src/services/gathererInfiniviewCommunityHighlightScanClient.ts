/**
 * Filename: gathererInfiniviewCommunityHighlightScanClient.ts
 * Purpose: Call InfiniView API /internal/community/highlights/scan after snapshot imports (Priority 9).
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-07-10
 * Dependencies: config, logger
 * Platform Compatibility: Node.js 18+
 *
 * Used by: gatherer scheduler (hourly 8 AM–8 PM ET) and snapshot history import post-hook.
 * Failures are logged as warnings only — gatherer jobs remain successful.
 */

import { GathererConfig, gathererIsInfiniviewHighlightScanEnabled } from "../config";
import { gathererAutoHighlightsScanScheduleIsWithinActiveWindow } from "./gathererAutoHighlightsScanSchedule";
import { logDebug, logInfo, logWarn } from "../logging/logger";

const GATHERER_INFINIVIEW_COMMUNITY_HIGHLIGHT_SCAN_CLIENT_SOURCE =
  "gathererInfiniviewCommunityHighlightScanClient";

// MARK: Types

export interface GathererInfiniviewCommunityHighlightScanResponse {
  scannedCreators: number;
  highlightsCreated: number;
  skippedOptOut: number;
  skippedRateLimit: number;
  skippedDuplicate: number;
  skippedNetworkDailyCap: number;
  skippedNetworkMinuteCooldown: number;
  createdPostIds: string[];
}

export interface GathererInfiniviewCommunityHighlightScanResult {
  attempted: boolean;
  success: boolean;
  statusCode?: number;
  response?: GathererInfiniviewCommunityHighlightScanResponse;
  error?: string;
}

export interface GathererInfiniviewCommunityHighlightScanOptions {
  trigger: "scheduled" | "snapshot-import" | "manual";
  monthKey?: string;
}

// MARK: Helpers

function gathererInfiniviewCommunityHighlightScanClientNormalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function gathererInfiniviewCommunityHighlightScanClientResolveTimeoutMs(
  config: GathererConfig
): number {
  const configured = config.infiniviewHighlightScanTimeoutMs;
  if (!Number.isFinite(configured) || configured <= 0) {
    return 15000;
  }
  return configured;
}

function gathererInfiniviewCommunityHighlightScanClientBuildHeaders(
  config: GathererConfig
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  const token = config.infiniviewInternalServiceSecret.trim();
  if (token.length > 0) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

// MARK: Scan Client

export async function gathererInfiniviewCommunityHighlightScanClientRun(
  config: GathererConfig,
  options: GathererInfiniviewCommunityHighlightScanOptions
): Promise<GathererInfiniviewCommunityHighlightScanResult> {
  if (!gathererIsInfiniviewHighlightScanEnabled(config)) {
    return {
      attempted: false,
      success: true,
    };
  }

  if (
    options.trigger !== "manual" &&
    !gathererAutoHighlightsScanScheduleIsWithinActiveWindow(config)
  ) {
    logDebug(
      "InfiniView community highlight scan skipped — outside active posting window",
      GATHERER_INFINIVIEW_COMMUNITY_HIGHLIGHT_SCAN_CLIENT_SOURCE,
      {
        trigger: options.trigger,
        activeHourStart: config.gathererAutoHighlightsScanActiveHourStart,
        activeHourEnd: config.gathererAutoHighlightsScanActiveHourEnd,
        timezone: config.timezone,
      }
    );
    return {
      attempted: false,
      success: true,
    };
  }

  const baseUrl = gathererInfiniviewCommunityHighlightScanClientNormalizeBaseUrl(
    config.infiniviewApiBaseUrl
  );
  const url = `${baseUrl}/internal/community/highlights/scan`;
  const body =
    options.monthKey && options.monthKey.trim().length > 0
      ? { monthKey: options.monthKey.trim() }
      : {};

  logDebug(
    "InfiniView community highlight scan request starting",
    GATHERER_INFINIVIEW_COMMUNITY_HIGHLIGHT_SCAN_CLIENT_SOURCE,
    { trigger: options.trigger, url }
  );

  const controller = new AbortController();
  const timeoutMs = gathererInfiniviewCommunityHighlightScanClientResolveTimeoutMs(config);
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: gathererInfiniviewCommunityHighlightScanClientBuildHeaders(config),
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const responseText = await response.text();
    let parsed: GathererInfiniviewCommunityHighlightScanResponse | undefined;
    if (responseText.trim().length > 0) {
      try {
        parsed = JSON.parse(responseText) as GathererInfiniviewCommunityHighlightScanResponse;
      } catch {
        parsed = undefined;
      }
    }

    if (!response.ok) {
      const errorMessage =
        parsed && typeof parsed === "object"
          ? JSON.stringify(parsed)
          : responseText || `HTTP ${response.status}`;

      logWarn(
        "InfiniView community highlight scan failed",
        GATHERER_INFINIVIEW_COMMUNITY_HIGHLIGHT_SCAN_CLIENT_SOURCE,
        { trigger: options.trigger, statusCode: response.status, error: errorMessage }
      );

      return {
        attempted: true,
        success: false,
        statusCode: response.status,
        error: errorMessage,
      };
    }

    logInfo(
      "InfiniView community highlight scan finished",
      GATHERER_INFINIVIEW_COMMUNITY_HIGHLIGHT_SCAN_CLIENT_SOURCE,
      {
        trigger: options.trigger,
        highlightsCreated: parsed?.highlightsCreated ?? 0,
        skippedNetworkDailyCap: parsed?.skippedNetworkDailyCap ?? 0,
        skippedNetworkMinuteCooldown: parsed?.skippedNetworkMinuteCooldown ?? 0,
      }
    );

    return {
      attempted: true,
      success: true,
      statusCode: response.status,
      response: parsed,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logWarn(
      "InfiniView community highlight scan request error",
      GATHERER_INFINIVIEW_COMMUNITY_HIGHLIGHT_SCAN_CLIENT_SOURCE,
      { trigger: options.trigger, error: message }
    );
    return {
      attempted: true,
      success: false,
      error: message,
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

// Suggestions For Features and Additions Later:
// - Expose last scan summary on gatherer dashboard /api/status
