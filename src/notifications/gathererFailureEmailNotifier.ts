/**
 * Filename: gathererFailureEmailNotifier.ts
 * Purpose: Email kdoyle@infinitumimagery.com (configurable) when a gatherer run fails.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-07-07
 * Dependencies: googleapis, GathererConfig, logger, fs
 * Platform Compatibility: Node.js 18+ (Google Workspace domain-wide delegation + gmail.send)
 *
 * Requires GOOGLE_DELEGATED_USER and gmail.send scope on the service account delegation.
 */

import fs from "fs";
import path from "path";
import { google } from "googleapis";
import { GathererConfig } from "../config";
import { createGoogleGmailAuthClient, gathererGmailSendConfigured } from "../google/googleAuth";
import { gathererEnsureDir, gathererReadJsonFile } from "../utils/files";
import { logInfo, logWarn, logError } from "../logging/logger";

// MARK: - Types

export interface GathererFailureEmailContext {
  runId?: string;
  startedAt?: string;
  finishedAt?: string;
  trigger?: string;
  dailySheetTabName?: string;
  errors: string[];
  phase?: string;
}

// MARK: - Configuration

export function gathererFailureEmailIsEnabled(config: GathererConfig): boolean {
  return (
    config.gathererFailureEmailEnabled &&
    config.gathererFailureEmailTo.trim().length > 0 &&
    gathererGmailSendConfigured(config)
  );
}

// MARK: - Log Artifact Helpers

function gathererFailureEmailListRecentLogArtifacts(logDir: string): string[] {
  if (!fs.existsSync(logDir)) {
    return [];
  }

  const artifactNames = fs
    .readdirSync(logDir)
    .filter((name) =>
      /^(fail-|last-run-summary\.json|gatherer-failure-)/i.test(name)
    )
    .map((name) => {
      const fullPath = path.join(logDir, name);
      return { name, mtimeMs: fs.statSync(fullPath).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, 8)
    .map((entry) => entry.name);

  return artifactNames;
}

function gathererFailureEmailBuildBody(
  config: GathererConfig,
  context: GathererFailureEmailContext
): string {
  const lines: string[] = [
    "InfiniView V3 Backstage Gatherer — run failed",
    "",
    `Time: ${context.finishedAt ?? new Date().toISOString()}`,
    `Host: ${process.env.COMPUTERNAME ?? process.env.HOSTNAME ?? "unknown"}`,
    `Run ID: ${context.runId ?? "(unknown)"}`,
    `Trigger: ${context.trigger ?? "(unknown)"}`,
    `Phase: ${context.phase ?? "gatherer"}`,
  ];

  if (context.dailySheetTabName) {
    lines.push(`Day sheet: ${context.dailySheetTabName}`);
  }

  lines.push("", "Errors:", ...context.errors.map((error) => `- ${error}`));

  const summaryPath = path.join(config.localLogDir, "last-run-summary.json");
  const summary = gathererReadJsonFile<Record<string, unknown>>(summaryPath);
  if (summary) {
    lines.push("", "Last run summary (data/logs/last-run-summary.json):");
    lines.push(JSON.stringify(summary, null, 2));
  }

  const artifacts = gathererFailureEmailListRecentLogArtifacts(config.localLogDir);
  if (artifacts.length > 0) {
    lines.push("", "Recent log artifacts in data/logs/:");
    for (const artifact of artifacts) {
      lines.push(`- ${artifact}`);
    }
  }

  lines.push(
    "",
    "Next steps:",
    "- Check data/logs/ for fail-*.png screenshots",
    "- Run: npm run preflight",
    "- Re-login if needed: npm run login",
    "",
    "— InfiniView V3 Backstage Gatherer"
  );

  return lines.join("\n");
}

function gathererFailureEmailWriteLocalCopy(
  config: GathererConfig,
  context: GathererFailureEmailContext,
  body: string
): string {
  gathererEnsureDir(config.localLogDir);
  const stamp = (context.finishedAt ?? new Date().toISOString()).replace(/[:.]/g, "-");
  const filePath = path.join(config.localLogDir, `gatherer-failure-${stamp}.log`);
  fs.writeFileSync(filePath, body, "utf8");
  return filePath;
}

function gathererFailureEmailEncodeRawMessage(
  to: string,
  from: string,
  subject: string,
  body: string
): string {
  const rawMessage = [
    `To: ${to}`,
    `From: ${from}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  ].join("\r\n");

  return Buffer.from(rawMessage)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// MARK: - Send Notification

export async function gathererSendFailureEmailNotification(
  config: GathererConfig,
  context: GathererFailureEmailContext
): Promise<void> {
  if (!gathererFailureEmailIsEnabled(config)) {
    logWarn(
      "Gatherer failure email skipped — enable GATHERER_FAILURE_EMAIL_ENABLED and configure Gmail delegation (gmail.send scope + GOOGLE_DELEGATED_USER)",
      "gathererFailureEmailNotifier"
    );
    return;
  }

  if (context.errors.length === 0) {
    return;
  }

  const finishedAt = context.finishedAt ?? new Date().toISOString();
  const body = gathererFailureEmailBuildBody(config, { ...context, finishedAt });
  const localCopyPath = gathererFailureEmailWriteLocalCopy(config, context, body);

  const to = config.gathererFailureEmailTo.trim();
  const from = config.gathererFailureEmailFrom.trim() || config.googleDelegatedUser.trim();
  const subject = `[InfiniView Gatherer FAILED] ${context.errors[0].slice(0, 120)}`;

  try {
    const auth = createGoogleGmailAuthClient(config);
    const gmail = google.gmail({ version: "v1", auth });

    await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: gathererFailureEmailEncodeRawMessage(to, from, subject, body),
      },
    });

    logInfo(`Failure alert email sent to ${to}`, "gathererFailureEmailNotifier", {
      localCopyPath,
      subject,
    });
  } catch (error) {
    logError("Failed to send gatherer failure email", "gathererFailureEmailNotifier", {
      error: error instanceof Error ? error.message : String(error),
      localCopyPath,
      to,
    });
  }
}

// Suggestions For Features and Additions Later:
// - Attach fail-*.png screenshots via Gmail multipart MIME
// - Dedupe alerts within a cooldown window per error signature
