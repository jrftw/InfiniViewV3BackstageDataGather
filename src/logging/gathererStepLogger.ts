/**
 * Filename: gathererStepLogger.ts
 * Purpose: Log every gatherer step to structured logs and friendly console output.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-07-07
 * Dependencies: logger, friendlyLog
 * Platform Compatibility: Node.js 18+ (Windows server PC)
 */

import { logInfo, logWarn, logError, logDebug } from "./logger";
import {
  isGathererFriendlyLoggingEnabled,
  gathererLogInfo,
  gathererLogWorking,
  gathererLogOk,
  gathererLogWarn,
  gathererLogFail,
} from "./friendlyLog";

// MARK: - Step Counter

let gathererGlobalStepNumber = 0;

export function gathererResetStepCounter(): void {
  gathererGlobalStepNumber = 0;
}

export function gathererGetStepCounter(): number {
  return gathererGlobalStepNumber;
}

export function isGathererVerboseStepsEnabled(): boolean {
  if (process.env.GATHERER_VERBOSE_STEPS === "false") {
    return false;
  }
  return true;
}

// MARK: - Format Helpers

function gathererFormatStepData(data?: Record<string, unknown>): string | undefined {
  if (!data || Object.keys(data).length === 0) {
    return undefined;
  }

  return Object.entries(data)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}=[${value.join(", ")}]`;
      }
      if (value === null || value === undefined) {
        return `${key}=null`;
      }
      return `${key}=${String(value)}`;
    })
    .join(" · ");
}

function gathererNextStepLabel(): string {
  gathererGlobalStepNumber += 1;
  return `Step ${gathererGlobalStepNumber}`;
}

function gathererShouldMirrorFriendly(): boolean {
  return isGathererFriendlyLoggingEnabled() && isGathererVerboseStepsEnabled();
}

// MARK: - Step Logging API

export function gathererLogStep(
  source: string,
  message: string,
  data?: Record<string, unknown>
): void {
  const stepLabel = gathererNextStepLabel();
  logInfo(`${stepLabel} — ${message}`, source, data);

  if (gathererShouldMirrorFriendly()) {
    const detail = gathererFormatStepData(data);
    gathererLogInfo(`${stepLabel} · ${source}`, detail ? `${message} (${detail})` : message);
  }
}

export function gathererLogStepWait(
  source: string,
  message: string,
  data?: Record<string, unknown>
): void {
  const stepLabel = gathererNextStepLabel();
  logInfo(`${stepLabel} — WAIT — ${message}`, source, data);

  if (gathererShouldMirrorFriendly()) {
    const detail = gathererFormatStepData(data);
    gathererLogWorking(`${stepLabel} · ${source} — ${message}${detail ? ` (${detail})` : ""}`);
  }
}

export function gathererLogStepClick(
  source: string,
  label: string,
  selectors?: string[]
): void {
  gathererLogStep(source, `Click — ${label}`, {
    selectors: selectors?.slice(0, 4).join(" | ") ?? "(resolved locator)",
  });
}

export function gathererLogStepSkip(
  source: string,
  message: string,
  reason?: string
): void {
  gathererLogStep(source, reason ? `Skip — ${message} (${reason})` : `Skip — ${message}`);
}

export function gathererLogStepOk(
  source: string,
  message: string,
  detail?: string,
  data?: Record<string, unknown>
): void {
  const stepLabel = gathererNextStepLabel();
  logInfo(`${stepLabel} — OK — ${message}`, source, { detail, ...data });

  if (gathererShouldMirrorFriendly()) {
    gathererLogOk(`${stepLabel} · ${source} — ${message}`, detail ?? gathererFormatStepData(data));
  }
}

export function gathererLogStepWarn(
  source: string,
  message: string,
  detail?: string,
  data?: Record<string, unknown>
): void {
  const stepLabel = gathererNextStepLabel();
  logWarn(`${stepLabel} — WARN — ${message}`, source, { detail, ...data });

  if (gathererShouldMirrorFriendly()) {
    gathererLogWarn(`${stepLabel} · ${source} — ${message}`, detail ?? gathererFormatStepData(data));
  }
}

export function gathererLogStepFail(
  source: string,
  message: string,
  detail?: string,
  data?: Record<string, unknown>
): void {
  const stepLabel = gathererNextStepLabel();
  logError(`${stepLabel} — FAIL — ${message}`, source, { detail, ...data });

  if (gathererShouldMirrorFriendly()) {
    gathererLogFail(`${stepLabel} · ${source} — ${message}`, detail ?? gathererFormatStepData(data));
  }
}

/** Structured log only — no step counter, no friendly console (for poll loops). */
export function gathererLogPollTrace(
  source: string,
  message: string,
  data?: Record<string, unknown>
): void {
  logDebug(`POLL — ${message}`, source, data);
}

// Suggestions For Features and Additions Later:
// - Write step log mirror to data/logs/gatherer-steps-{runId}.log
