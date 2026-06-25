/**
 * Filename: logger.ts
 * Purpose: Centralized toggleable logging for the Backstage Gatherer.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-23
 * Dependencies: pino, pino-pretty
 * Platform Compatibility: Node.js 18+ (Windows server PC)
 */

import pino from "pino";

// MARK: - Debug Toggle

export const GATHERER_ENABLE_DEBUG_LOGGING =
  process.env.GATHERER_ENABLE_DEBUG_LOGGING === "true" ||
  process.env.NODE_ENV !== "production";

const GATHERER_USE_PRETTY_LOGS =
  process.env.GATHERER_FRIENDLY_LOGS !== "false" ||
  process.env.NODE_ENV !== "production";

// MARK: - Logger Instance

const gathererPinoLogger = pino({
  level: GATHERER_ENABLE_DEBUG_LOGGING ? "debug" : "info",
  transport: GATHERER_USE_PRETTY_LOGS
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      }
    : undefined,
});

// MARK: - Logging API

function gathererFormatSource(source?: string): string {
  return source ? `[${source}]` : "";
}

export function logInfo(message: string, source?: string, data?: Record<string, unknown>): void {
  gathererPinoLogger.info({ source, ...data }, `${gathererFormatSource(source)} ${message}`);
}

export function logError(message: string, source?: string, data?: Record<string, unknown>): void {
  gathererPinoLogger.error({ source, ...data }, `${gathererFormatSource(source)} ${message}`);
}

export function logWarn(message: string, source?: string, data?: Record<string, unknown>): void {
  gathererPinoLogger.warn({ source, ...data }, `${gathererFormatSource(source)} ${message}`);
}

export function logDebug(message: string, source?: string, data?: Record<string, unknown>): void {
  if (!GATHERER_ENABLE_DEBUG_LOGGING) {
    return;
  }
  gathererPinoLogger.debug({ source, ...data }, `${gathererFormatSource(source)} ${message}`);
}

export function getGathererLogger() {
  return gathererPinoLogger;
}

// Suggestions For Features and Additions Later:
// - Rotate log files to data/logs by date
// - Ship logs to external monitoring (Datadog, etc.)
