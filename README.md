# InfiniView V3 Backstage Gatherer

Local server app that exports Backstage reports, merges them by Creator ID, uploads to Google Drive, and updates Google Sheets.

**How to run:** [Plan/HOW_TO_RUN.md](Plan/HOW_TO_RUN.md)

## Two-PC workflow

| PC | Role |
|---|---|
| **Dev PC** (this one) | Edit code, push to GitHub |
| **Server PC** | Runs 24/7, auto-pulls updates from GitHub |

```
Dev PC  →  git push  →  GitHub  →  auto-update  →  Server PC
```

The server PC checks GitHub every 15 minutes (built into the app + optional Windows scheduled task). When you push changes, the server pulls, rebuilds, and restarts automatically if `start-server.bat` is running.

---

## Server PC — first-time setup

### Prerequisites

- [Node.js 18+](https://nodejs.org)
- [Git](https://git-scm.com)
- Google Cloud service account (Drive + Sheets access)
- Backstage login (one-time, saved locally)

### 1. Clone the repo

```bat
git clone https://github.com/jrftw/InfiniViewV3BackstageDataGather.git
cd InfiniViewV3BackstageDataGather
```

### 2. Run install

Double-click **`install-server.bat`** or:

```bat
install-server.bat
```

### 3. Configure `.env`

Copy values into `.env` (created from `.env.example`):

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (use `\n` for newlines)
- `GOOGLE_DRIVE_FOLDER_ID`
- `GOOGLE_MASTER_SHEET_ID`

Share your Drive folder and Google Sheet with the service account email (Editor access).

### 4. Log into Backstage once

```bat
npm run login
```

A browser opens. Log in fully, then press Enter in the terminal. Session saves to `data/auth/backstage-auth.json` (never committed to git).

### 5. Start the server

Double-click **`start-server.bat`**.

- Dashboard: http://localhost:3099
- Manual run API: http://localhost:3099/run-now

### 6. (Optional) Extra auto-update task

```bat
setup-auto-update.bat
```

Registers a Windows scheduled task as backup to the built-in git watcher.

### 7. 24/7 reliability (server PC — run once)

```bat
setup-server-reliability.bat
```

This registers three Windows tasks:

| Task | What it does |
|------|----------------|
| **InfiniViewBackstageGathererServer** | Starts `start-server.bat` at **boot** and **logon** |
| **InfiniViewBackstageGathererWatchdog** | Every **5 min** — if port 3099 is down, restarts the server |
| **InfiniViewBackstageGathererAutoUpdate** | Git pull backup every 15 min (optional) |

Also set **Windows → Power → Sleep = Never** on the server PC.

Copy `data/auth/backstage-auth.json` from your dev PC to the server (or run `npm run login` once on the server). The session file is not in git.

After a restart, the app runs a **catch-up gather** (~3 min delay) if nothing succeeded yet today (`GATHERER_CATCHUP_ON_STARTUP=true`).

---

## Dev PC — push updates

```bat
git add .
git commit -m "Your change description"
git push origin main
```

Within ~15 minutes the server PC pulls, runs `npm ci`, `npm run build`, and restarts (if `start-server.bat` is in its restart loop).

You can also trigger an immediate check from the dashboard: **Check for Updates**.

---

## Manual run options

| Method | Command |
|---|---|
| Batch file | `run-now.bat` |
| npm | `npm run gather` |
| Browser | http://localhost:3099 → Run Gatherer Now |
| API | `POST http://localhost:3099/run-now` |

---

## Scheduled runs

Four times daily (Eastern Time, configurable in `.env`):

- 8:00 AM
- 12:00 PM
- 4:00 PM
- 8:00 PM

---

## What stays on each PC (not in GitHub)

These files are in `.gitignore` and must exist on the server PC only:

| File | Purpose |
|---|---|
| `.env` | Google credentials, ports, schedules |
| `data/auth/backstage-auth.json` | Saved Backstage browser session |

After cloning on a new server PC, recreate `.env` and run `npm run login` once.

---

## Backstage selectors

If Backstage changes its UI, edit one file:

`src/backstage/backstageSelectors.ts`

See `docs/BACKSTAGE_EXPORT_STEPS.md` for export navigation notes.

---

## Output per run

Local files in `data/raw/` and `data/processed/`:

- `backstage-performance-YYYY-MM-DD-HHmm.xlsx`
- `backstage-management-YYYY-MM-DD-HHmm.xlsx`
- `combined-creators-YYYY-MM-DD-HHmm.xlsx`
- `combined-creators-YYYY-MM-DD-HHmm.csv`
- `combined-creators-YYYY-MM-DD-HHmm.json`
- `import-summary-YYYY-MM-DD-HHmm.json`

Also uploaded to Google Drive and written to Google Sheet tabs.

---

## Troubleshooting

See `docs/TROUBLESHOOTING.md`.

Common fixes:

- **Logged out of Backstage** → `npm run login`
- **Google permission denied** → Share folder/sheet with service account email
- **Export button not found** → Update `backstageSelectors.ts`
- **Update not applying** → Ensure `start-server.bat` is running (restart loop)

---

## Architecture note

Google Sheets is a **staging/review layer**, not the production database. When `MONGODB_URI` is set, each gather run also **dual-writes** to MongoDB:

| Collection | Purpose |
|---|---|
| `creators` | Current merged creator row (upserted by `backstage_creator_id`) |
| `creator_performance_snapshots` | Append-only performance history per import run |
| `gatherer_import_runs` | Run metadata (counts, success, timestamps) |

InfiniView V3 should read from MongoDB (via your API), not from Google Sheets, for public-facing data.
