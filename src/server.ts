/**
 * Filename: server.ts
 * Purpose: Express server — manual run API, dashboard, status.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-26
 * Dependencies: express
 * Platform Compatibility: Node.js 18+
 */

import express, { Request } from "express";
import { GathererConfig } from "./config";
import { runGathererJob } from "./jobs/runGathererJob";
import {
  ProfileAcquirerJobOptions,
  ProfileAcquirerJobTrigger,
  runProfileAcquirerJob,
} from "./jobs/runProfileAcquirerJob";
import { getGathererRunState } from "./jobs/runState";
import { checkAndApplyGitUpdate } from "./gitAutoUpdate";
import { logInfo } from "./logging/logger";

// MARK: - Profile Acquirer Request Parsing

interface ServerProfileAcquirerRequestBody {
  normalized_username?: string;
  trigger?: string;
  force?: boolean;
  username_changed?: boolean;
}

function serverParseProfileAcquirerUsername(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim().toLowerCase();
  return trimmed || undefined;
}

function serverResolveProfileAcquirerTrigger(
  explicitTrigger: string | undefined,
  hasUsername: boolean,
  defaultSingleUserTrigger: ProfileAcquirerJobTrigger
): ProfileAcquirerJobTrigger {
  const normalizedTrigger = explicitTrigger?.trim().toLowerCase();

  if (normalizedTrigger === "login") {
    return "login";
  }
  if (normalizedTrigger === "signup") {
    return "signup";
  }
  if (normalizedTrigger === "manual" || normalizedTrigger === "scheduled") {
    return normalizedTrigger;
  }
  if (normalizedTrigger === "post_backstage") {
    return "post_backstage";
  }

  if (hasUsername) {
    return defaultSingleUserTrigger;
  }

  return "manual";
}

function serverBuildProfileAcquirerJobOptions(
  req: Request,
  defaultSingleUserTrigger: ProfileAcquirerJobTrigger
): ProfileAcquirerJobOptions {
  const body = (req.body ?? {}) as ServerProfileAcquirerRequestBody;
  const queryUsername = serverParseProfileAcquirerUsername(req.query.username);
  const bodyUsername = serverParseProfileAcquirerUsername(body.normalized_username);
  const username = bodyUsername ?? queryUsername;
  const explicitTrigger =
    typeof body.trigger === "string"
      ? body.trigger
      : typeof req.query.trigger === "string"
        ? req.query.trigger
        : undefined;

  const trigger = serverResolveProfileAcquirerTrigger(explicitTrigger, Boolean(username), defaultSingleUserTrigger);

  return {
    trigger,
    normalizedUsernames: username ? [username] : undefined,
    forceRefresh: body.force === true || req.query.force === "true",
    usernameChanged: body.username_changed === true || req.query.username_changed === "true",
  };
}

async function serverHandleProfileAcquirerRequest(
  req: Request,
  res: express.Response,
  defaultSingleUserTrigger: ProfileAcquirerJobTrigger,
  logLabel: string
): Promise<void> {
  const options = serverBuildProfileAcquirerJobOptions(req, defaultSingleUserTrigger);

  if (
    (options.trigger === "login" || options.trigger === "signup") &&
    !options.normalizedUsernames?.length
  ) {
    res.status(400).json({
      success: false,
      error: `${options.trigger} requires normalized_username`,
    });
    return;
  }

  logInfo(logLabel, "server", {
    trigger: options.trigger,
    username: options.normalizedUsernames?.[0] ?? null,
    forceRefresh: options.forceRefresh ?? false,
    usernameChanged: options.usernameChanged ?? false,
  });

  const result = await runProfileAcquirerJob(options);
  res.json(result);
}

// MARK: - Dashboard HTML

function gathererDashboardHtml(config: GathererConfig): string {
  const sheetUrl = config.googleMasterSheetId
    ? `https://docs.google.com/spreadsheets/d/${config.googleMasterSheetId}`
    : "#";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>InfiniView V3 Backstage Gatherer</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 20px; background: #0f1117; color: #e8eaed; }
    h1 { font-size: 1.5rem; }
    .btn { display: inline-block; margin: 8px 8px 8px 0; padding: 12px 20px; background: #4f8cff; color: #fff; border: none; border-radius: 8px; cursor: pointer; text-decoration: none; font-size: 1rem; }
    .btn:hover { background: #3a7ae8; }
    .btn.secondary { background: #3c4048; }
    #status { margin-top: 24px; padding: 16px; background: #1a1d27; border-radius: 8px; white-space: pre-wrap; font-family: monospace; font-size: 0.85rem; }
  </style>
</head>
<body>
  <h1>InfiniView V3 Backstage Gatherer</h1>
  <p>Run exports, view status, open logs.</p>
  <button class="btn" onclick="runNow()">Run Backstage Gatherer</button>
  <button class="btn secondary" onclick="runProfileAcquirer()">Run Profile Acquirer</button>
  <button class="btn secondary" onclick="refreshStatus()">View Last Run</button>
  <a class="btn secondary" href="/open-logs" target="_blank">Open Logs Folder</a>
  <a class="btn secondary" href="${sheetUrl}" target="_blank">Open Google Sheet</a>
  <button class="btn secondary" onclick="checkUpdate()">Check for Updates</button>
  <div id="status">Loading status...</div>
  <script>
    async function refreshStatus() {
      const res = await fetch('/api/status');
      const data = await res.json();
      document.getElementById('status').textContent = JSON.stringify(data, null, 2);
    }
    async function runNow() {
      document.getElementById('status').textContent = 'Running Backstage gatherer...';
      const res = await fetch('/run-now', { method: 'POST' });
      const data = await res.json();
      document.getElementById('status').textContent = JSON.stringify(data, null, 2);
    }
    async function runProfileAcquirer() {
      document.getElementById('status').textContent = 'Running TikTok profile acquirer...';
      const res = await fetch('/run-profile-acquirer', { method: 'POST' });
      const data = await res.json();
      document.getElementById('status').textContent = JSON.stringify(data, null, 2);
    }
    async function checkUpdate() {
      const res = await fetch('/api/update', { method: 'POST' });
      const data = await res.json();
      document.getElementById('status').textContent = JSON.stringify(data, null, 2);
    }
    refreshStatus();
  </script>
</body>
</html>`;
}

// MARK: - Create Server

export function createGathererServer(config: GathererConfig): express.Application {
  const app = express();
  app.use(express.json());

  app.get("/", (_req, res) => {
    res.type("html").send(gathererDashboardHtml(config));
  });

  app.get("/api/status", (_req, res) => {
    res.json(getGathererRunState());
  });

  app.post("/run-now", async (_req, res) => {
    logInfo("Manual Backstage gather triggered via API", "server");
    const result = await runGathererJob({ trigger: "manual" });
    res.json(result);
  });

  app.get("/run-now", async (_req, res) => {
    logInfo("Manual Backstage gather triggered via GET", "server");
    const result = await runGathererJob({ trigger: "manual" });
    res.json(result);
  });

  app.post("/run-profile-acquirer", async (req, res) => {
    await serverHandleProfileAcquirerRequest(
      req,
      res,
      "signup",
      "Profile acquirer triggered via POST /run-profile-acquirer"
    );
  });

  app.get("/run-profile-acquirer", async (req, res) => {
    await serverHandleProfileAcquirerRequest(
      req,
      res,
      "signup",
      `Profile acquirer triggered via GET /run-profile-acquirer${typeof req.query.username === "string" ? ` for @${req.query.username}` : ""}`
    );
  });

  app.post("/run-profile-acquirer/signup", async (req, res) => {
    const body = (req.body ?? {}) as ServerProfileAcquirerRequestBody;
    req.body = { ...body, trigger: "signup" };
    await serverHandleProfileAcquirerRequest(
      req,
      res,
      "signup",
      "Profile acquirer signup trigger"
    );
  });

  app.post("/run-profile-acquirer/login", async (req, res) => {
    const body = (req.body ?? {}) as ServerProfileAcquirerRequestBody;
    req.body = { ...body, trigger: "login" };
    await serverHandleProfileAcquirerRequest(
      req,
      res,
      "login",
      "Profile acquirer login trigger"
    );
  });

  app.get("/run-profile-acquirer/login", async (req, res) => {
    await serverHandleProfileAcquirerRequest(
      req,
      res,
      "login",
      `Profile acquirer login trigger via GET${typeof req.query.username === "string" ? ` for @${req.query.username}` : ""}`
    );
  });

  app.post("/api/update", (_req, res) => {
    const result = checkAndApplyGitUpdate(config);
    res.json(result);
    if (result.updated) {
      setTimeout(() => process.exit(0), 1000);
    }
  });

  app.get("/open-logs", (_req, res) => {
    res.json({ logsPath: config.localLogDir });
  });

  return app;
}

export function startGathererServer(config: GathererConfig): void {
  const app = createGathererServer(config);
  app.listen(config.appPort, () => {
    logInfo(`Gatherer server running at http://localhost:${config.appPort}`, "server");
  });
}

// Suggestions For Features and Additions Later:
// - Basic auth for /run-now and /run-profile-acquirer endpoints
// - Shared secret header for InfiniView → gatherer calls