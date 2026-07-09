/**
 * Filename: infinitumServerAgentClient.ts
 * Purpose: Optional HTTP client for InfinitumServerAgent — health, snapshot import, mongo summary sync, and backup.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-07-09
 * Dependencies: config, logger
 * Platform Compatibility: Node.js 18+
 *
 * Used by: gathererInfinitumAgentPostPublish (post-gather hooks).
 * Additive only — gatherer runs succeed even when the agent is disabled or unreachable.
 */

import { GathererConfig, gathererIsInfinitumAgentEnabled } from "../config";
import { logDebug, logError, logInfo } from "../logging/logger";

const GATHERER_INFINITUM_SERVER_AGENT_CLIENT_SOURCE = "infinitumServerAgentClient";

// MARK: Types

export interface GathererInfinitumServerAgentClientResult<T = unknown> {
  success: boolean;
  enabled: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

export interface GathererInfinitumServerAgentSnapshotImportRequest {
  snapshotDate?: string;
  runId?: string;
  trigger?: string;
}

// MARK: Helpers

function gathererInfinitumServerAgentClientNormalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function gathererInfinitumServerAgentClientResolveTimeoutMs(config: GathererConfig): number {
  const configured = config.infinitumAgentTimeoutMs;
  if (!Number.isFinite(configured) || configured <= 0) {
    return 5000;
  }
  return configured;
}

function gathererInfinitumServerAgentClientBuildHeaders(config: GathererConfig): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  const token = config.infinitumAgentApiToken;
  if (token.length > 0) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

function gathererInfinitumServerAgentClientDisabledResult<T>(): GathererInfinitumServerAgentClientResult<T> {
  return {
    success: false,
    enabled: false,
    error: "InfinitumServerAgent integration is disabled",
  };
}

function gathererInfinitumServerAgentClientUnconfiguredResult<T>(): GathererInfinitumServerAgentClientResult<T> {
  return {
    success: false,
    enabled: true,
    error: "InfinitumServerAgent base URL is not configured",
  };
}

async function gathererInfinitumServerAgentClientRequest<T>(
  config: GathererConfig,
  method: "GET" | "POST",
  path: string,
  body?: unknown
): Promise<GathererInfinitumServerAgentClientResult<T>> {
  if (!gathererIsInfinitumAgentEnabled(config)) {
    return gathererInfinitumServerAgentClientDisabledResult<T>();
  }

  const baseUrl = config.infinitumAgentBaseUrl.trim();
  if (!baseUrl) {
    return gathererInfinitumServerAgentClientUnconfiguredResult<T>();
  }

  const normalizedBaseUrl = gathererInfinitumServerAgentClientNormalizeBaseUrl(baseUrl);
  const requestUrl = `${normalizedBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const timeoutMs = gathererInfinitumServerAgentClientResolveTimeoutMs(config);
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    logDebug(
      `InfinitumServerAgent ${method} ${path} (timeout=${timeoutMs}ms)`,
      GATHERER_INFINITUM_SERVER_AGENT_CLIENT_SOURCE
    );

    const response = await fetch(requestUrl, {
      method,
      headers: gathererInfinitumServerAgentClientBuildHeaders(config),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    const responseText = await response.text();
    let parsedBody: T | undefined;

    if (responseText.trim().length > 0) {
      try {
        parsedBody = JSON.parse(responseText) as T;
      } catch {
        parsedBody = { raw: responseText } as T;
      }
    }

    if (!response.ok) {
      logError(
        `InfinitumServerAgent ${method} ${path} failed with HTTP ${response.status}`,
        GATHERER_INFINITUM_SERVER_AGENT_CLIENT_SOURCE
      );
      return {
        success: false,
        enabled: true,
        statusCode: response.status,
        data: parsedBody,
        error: `InfinitumServerAgent responded with HTTP ${response.status}`,
      };
    }

    logDebug(
      `InfinitumServerAgent ${method} ${path} succeeded with HTTP ${response.status}`,
      GATHERER_INFINITUM_SERVER_AGENT_CLIENT_SOURCE
    );

    return {
      success: true,
      enabled: true,
      statusCode: response.status,
      data: parsedBody,
    };
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? `InfinitumServerAgent request timed out after ${timeoutMs}ms`
        : error instanceof Error
          ? error.message
          : "InfinitumServerAgent request failed";

    logError(
      `InfinitumServerAgent ${method} ${path} error: ${message}`,
      GATHERER_INFINITUM_SERVER_AGENT_CLIENT_SOURCE
    );

    return {
      success: false,
      enabled: true,
      error: message,
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

// MARK: Public Client API

export async function gathererInfinitumServerAgentClientGetHealth(
  config: GathererConfig
): Promise<GathererInfinitumServerAgentClientResult<unknown>> {
  return gathererInfinitumServerAgentClientRequest(config, "GET", "/health");
}

export async function gathererInfinitumServerAgentClientRunSnapshotImport(
  config: GathererConfig,
  request: GathererInfinitumServerAgentSnapshotImportRequest = {}
): Promise<GathererInfinitumServerAgentClientResult<unknown>> {
  logInfo(
    "InfinitumServerAgent snapshot import job requested",
    GATHERER_INFINITUM_SERVER_AGENT_CLIENT_SOURCE,
    { ...request }
  );
  return gathererInfinitumServerAgentClientRequest(
    config,
    "POST",
    "/jobs/snapshot-import",
    request
  );
}

export async function gathererInfinitumServerAgentClientRunMongoSummarySync(
  config: GathererConfig
): Promise<GathererInfinitumServerAgentClientResult<unknown>> {
  logInfo(
    "InfinitumServerAgent mongo summary sync job requested",
    GATHERER_INFINITUM_SERVER_AGENT_CLIENT_SOURCE
  );
  return gathererInfinitumServerAgentClientRequest(config, "POST", "/jobs/mongo-summary-sync");
}

export async function gathererInfinitumServerAgentClientRunBackup(
  config: GathererConfig
): Promise<GathererInfinitumServerAgentClientResult<unknown>> {
  logInfo("InfinitumServerAgent backup job requested", GATHERER_INFINITUM_SERVER_AGENT_CLIENT_SOURCE);
  return gathererInfinitumServerAgentClientRequest(config, "POST", "/jobs/backup");
}

// Suggestions For Features and Additions Later:
// - Health summary helper for gatherer /api/status endpoint
// - Circuit breaker to reduce agent polling when repeatedly unreachable
// - Large export/archive coordination endpoints when Server Agent supports them
