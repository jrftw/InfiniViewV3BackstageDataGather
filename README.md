# InfiniView V3 Backstage Gatherer

Automated TikTok LIVE Backstage data pipeline. Exports management and performance reports via Playwright, merges rows by Creator ID, publishes to Google Drive and Sheets, and dual-writes to MongoDB when configured.

**Owner:** Kevin Doyle Jr. / Infinitum Imagery LLC  
**Repository:** [jrftw/InfiniViewV3BackstageDataGather](https://github.com/jrftw/InfiniViewV3BackstageDataGather)  
**Default branch:** `main`  
**Dashboard:** `http://localhost:3099` (when running)

**Detailed run guide:** [Plan/HOW_TO_RUN.md](Plan/HOW_TO_RUN.md)

---

## What it does

```text
TikTok LIVE Backstage (browser automation)
        │  Playwright export (management + performance Excel)
        ▼
Processing pipeline (merge, normalize, enrich)
        ├── Google Drive  (daily archives)
        ├── Google Sheets (staging / human review / master tab)
        ├── MongoDB InfiniViewV3  (creators, snapshots, daily history)
        └── Profile Acquirer  (TikTok public profile enrichment)
```

Google Sheets is a **staging and review layer**, not the production database. InfiniView V3 reads creator performance from **MongoDB** (via the InfiniView API), not directly from Sheets.

---

## Technology

| Component | Choice |
|-----------|--------|
| Runtime | Node.js 18+ |
| Browser automation | Playwright (Chromium) |
| Server | Express (dashboard + manual trigger API) |
| Scheduling | node-cron |
| Storage output | Google Drive API, Google Sheets API |
| Database | MongoDB Atlas (`InfiniViewV3`) when `MONGODB_URI` is set |
| Excel parsing | xlsx |

---

## Two-PC workflow

| PC | Role |
|----|------|
| **Dev PC** | Edit code, push to GitHub |
| **Server PC** | Runs 24/7, auto-pulls updates from GitHub |

```text
Dev PC  →  git push  →  GitHub  →  auto-update  →  Server PC
```

The server PC checks GitHub every 15 minutes (built into the app + optional Windows scheduled task). When you push changes, the server pulls, rebuilds, and restarts if `start-server.bat` is running.

---

## Server PC — first-time setup

### Prerequisites

- [Node.js 18+](https://nodejs.org)
- [Git](https://git-scm.com)
- Google Cloud service account (Drive + Sheets access)
- Backstage login (one-time, saved locally)

### 1. Clone

```bat
git clone https://github.com/jrftw/InfiniViewV3BackstageDataGather.git
cd InfiniViewV3BackstageDataGather
```

### 2. Install

```bat
install-server.bat
```

Runs `npm ci`, Playwright Chromium install, and build.

### 3. Configure `.env`

Copy values into `.env` (created from `.env.example`):

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (use `\n` for newlines)
- `GOOGLE_DRIVE_FOLDER_ID`
- `GOOGLE_MASTER_SHEET_ID`
- `MONGODB_URI` (optional but recommended for production)

Share your Drive folder and Google Sheet with the service account email (Editor access).

### 4. Log into Backstage once

```bat
npm run login
```

Browser opens. Log in fully, then press Enter. Session saves to `data/auth/backstage-auth.json` (never committed).

### 5. Start the server

```bat
start-server.bat
```

- Dashboard: http://localhost:3099
- Manual run: http://localhost:3099/run-now or `POST /run-now`

### 6. 24/7 reliability (run once on server PC)

```bat
setup-server-reliability.bat
```

| Task | What it does |
|------|----------------|
| **InfiniViewBackstageGathererServer** | Starts at boot and logon |
| **InfiniViewBackstageGathererWatchdog** | Every 5 min — restarts if port 3099 is down |
| **InfiniViewBackstageGathererAutoUpdate** | Git pull backup every 15 min |

Also set Windows Power → Sleep = **Never**.

Optional extra auto-update: `setup-auto-update.bat`

After restart, a **catch-up gather** runs (~3 min delay) if nothing succeeded yet today (`GATHERER_CATCHUP_ON_STARTUP=true`).

---

## Dev PC — push updates

```bat
git add .
git commit -m "Your change description"
git push origin main
```

Within ~15 minutes the server PC pulls, runs `npm ci`, `npm run build`, and restarts.

Trigger an immediate check from the dashboard: **Check for Updates**.

---

## Manual run options

| Method | Command |
|--------|---------|
| Batch file | `run-now.bat` |
| npm | `npm run gather` |
| Browser | Dashboard → Run Gatherer Now |
| API | `POST http://localhost:3099/run-now` |
| Full pipeline | `npm run pipeline` (gather + profile acquire) |
| Visible debug | `npm run gather:visible` |

### Additional jobs

| Script | Purpose |
|--------|---------|
| `npm run enrich` | Sheet/CRM enrichment pass |
| `npm run profile-acquire` | TikTok public profile scraper |
| `npm run snapshot-history:import` | Daily snapshot history import |
| `npm run snapshot-history:backfill` | Historical backfill |
| `npm run preflight` | Pre-run health check |

---

## Scheduled runs

Four times daily (Eastern Time, configurable in `.env`):

- 8:00 AM
- 12:00 PM
- 4:00 PM
- 8:00 PM

Nightly snapshot history import and optional Auto Highlights scan hooks are also available (see `.env` flags).

---

## MongoDB collections (when `MONGODB_URI` is set)

| Collection | Purpose |
|------------|---------|
| `creators` | Current merged creator row (upserted by `backstage_creator_id`) |
| `creator_performance_snapshots` | One performance snapshot per creator per calendar day |
| `creator_daily_snapshots` | Daily snapshot history for Command Center math |
| `gatherer_import_runs` | Run metadata (counts, success, timestamps) |

---

## Output per run

Local files in `data/raw/` and `data/processed/`:

- `backstage-performance-YYYY-MM-DD-HHmm.xlsx`
- `backstage-management-YYYY-MM-DD-HHmm.xlsx`
- `combined-creators-YYYY-MM-DD.xlsx`
- `combined-creators-YYYY-MM-DD.csv`
- `combined-creators-YYYY-MM-DD.json`
- `import-summary-YYYY-MM-DD-HHmm.json`

Also uploaded to Google Drive and written to Google Sheet tabs.

---

## Files not in GitHub (server PC only)

| File | Purpose |
|------|---------|
| `.env` | Google credentials, ports, schedules |
| `data/auth/backstage-auth.json` | Saved Backstage browser session |

Copy `backstage-auth.json` from dev PC or run `npm run login` once on the server.

---

## Backstage UI changes

If TikTok changes Backstage UI, edit:

`src/backstage/backstageSelectors.ts`

See `docs/BACKSTAGE_EXPORT_STEPS.md` for export navigation notes.

---

## Troubleshooting

See `docs/TROUBLESHOOTING.md`.

| Symptom | Fix |
|---------|-----|
| Logged out of Backstage | `npm run login` |
| Google permission denied | Share folder/sheet with service account email |
| Export button not found | Update `backstageSelectors.ts` |
| Update not applying | Ensure `start-server.bat` is running |

---

## Related repositories

| Repo | Role |
|------|------|
| [iViewV3](https://github.com/jrftw/iViewV3) | Consumes MongoDB data via InfiniView API |
| [InfiniCoreAPI](https://github.com/jrftw/InfiniCoreAPI) | Shared creator features |
| [InfinitumServerAgent](https://github.com/jrftw/InfinitumServerAgent) | Optional warehouse handoff |
| [InfiniViewV3-InfiniCoreApi-BSGather](https://github.com/jrftw/InfiniViewV3-InfiniCoreApi-BSGather) | Mass workspace |

---

## License

Proprietary — Infinitum Imagery LLC. All rights reserved.
