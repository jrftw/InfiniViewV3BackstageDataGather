# How To Run — InfiniView V3 Backstage Gatherer

**Filename:** HOW_TO_RUN.md  
**Purpose:** Step-by-step guide to install, configure, and run the gatherer on dev PC and server PC  
**Author:** Kevin Doyle Jr. / Infinitum Imagery LLC  
**Last Modified:** 2026-06-23  
**Platform Compatibility:** Windows 10/11, Node.js 18+

---

## Quick start (this PC — watch it work)

1. Open **PowerShell** or **Command Prompt** in the project folder
2. Copy `.env.example` → `.env` and fill in Backstage email/password
3. Run:

**PowerShell** (note the `.\` prefix — required):

```powershell
.\install-server.bat
npm run login:test
.\run-now-visible.bat
```

Or use PowerShell scripts / npm:

```powershell
.\install-server.ps1
npm run login:test
.\run-now-visible.ps1
# or
npm run gather:visible
```

**Command Prompt (cmd.exe)** — no `.\` needed:

```bat
install-server.bat
npm run login:test
run-now-visible.bat
```

You should see Chrome open, log in (or auto-login), switch to **US+**, export both reports, and save files to `data/raw/` and `data/processed/`.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| [Node.js 18+](https://nodejs.org) | `node -v` to verify |
| [Git](https://git-scm.com) | Required for server auto-update |
| Backstage account | Agency login for [LIVE Backstage](https://live-backstage.tiktok.com/) |
| Google service account | Optional for Phase 1 local testing; required for Drive + Sheets |

> **PowerShell tip:** Local scripts must be prefixed with `.\` (e.g. `.\run-now-visible.bat`).  
> `npm run ...` commands work without `.\`.

---

## First-time install

From the project root:

```bat
install-server.bat
```

Or manually:

```bat
npm ci
npm run build
copy .env.example .env
```

Edit `.env` with your credentials (see below).

---

## Configure `.env`

Minimum to run exports locally:

```env
BACKSTAGE_EMAIL=your-email@example.com
BACKSTAGE_PASSWORD=your-password
BACKSTAGE_HEADLESS=false
BACKSTAGE_AGENCY_REGION=US+
BACKSTAGE_FORCE_US_PLUS=true
```

Google output (when ready):

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=
GOOGLE_DRIVE_FOLDER_ID=
GOOGLE_MASTER_SHEET_ID=
```

**Never commit `.env` to GitHub.**

Aliases also work: `TIKTOK_EMAIL`, `TIKTOK_PASSWORD`, `HEADLESS=false`.

---

## Login & session

### Auto-login (recommended)

With `BACKSTAGE_EMAIL` and `BACKSTAGE_PASSWORD` in `.env`, the gatherer logs in automatically when the session expires.

### Test login only (visible browser)

```bat
npm run login:test
```

Saves session to `data/auth/backstage-auth.json`.

### Manual login fallback

```bat
npm run login
```

Browser opens → log in yourself → press Enter in terminal.

### Already logged in?

If `data/auth/backstage-auth.json` is valid, login is **skipped**. US+ region is still checked every run.

---

## Run the gatherer

### Check connections first (no browser export)

```powershell
npm run preflight
```

Runs a quick preflight with emoji status lines — verifies folders, Backstage session, Google Sheet, Drive, and Chromium **without** opening Backstage.

### Watch in browser (best for debugging)

**PowerShell:**

```powershell
.\run-now-visible.bat
# or
.\run-now-visible.ps1
# or
npm run gather:visible
```

**Command Prompt:**

```bat
run-now-visible.bat
```

Or double-click `run-now-visible.bat` in File Explorer.

### Headless / scheduled (server PC)

```bat
npm run gather
```

Or double-click `run-now.bat` (uses `.env` headless setting).

### 24/7 server with dashboard + schedule

```bat
start-server.bat
```

Then open:

- **Dashboard:** http://localhost:3099  
- **Manual run:** http://localhost:3099/run-now  
- **Status:** http://localhost:3099/api/status  

Scheduled runs (Eastern Time, default): **8am, 12pm, 4pm, 8pm**.

### 4 runs per day + one daily archive

When `start-server.bat` is running, the gatherer runs **4 times per day** (configurable via `RUN_SCHEDULE_1` … `RUN_SCHEDULE_4` in `.env`).

| Run | What happens |
|-----|----------------|
| **Scheduled 1–3** (e.g. 8am, 12pm, 4pm) | Refreshes **`Daily_YYYY-MM-DD`** sheet tab + **`01_Latest_Master_Creators`**. Overwrites local `combined-creators-YYYY-MM-DD.*`. No Drive daily archive yet. |
| **Scheduled 4** (e.g. 8pm) | Same sheet/local updates, plus **creates a daily Google Sheet** in your [Drive archive folder](https://drive.google.com/drive/folders/1YyL3Djct37J1ZVug5f0PclAz9PGHD473) (`GOOGLE_DRIVE_DAILY_ARCHIVE_FOLDER_ID`) with tabs + XLSX files under `YYYY-MM-DD/`. |
| **Manual** (`run-now.bat`, dashboard, `npm run gather`) | Same intraday behavior as runs 1–3 — refresh day sheet anytime. Unlimited manual runs. |

Local combined output is always **one file per day**: `data/processed/combined-creators-2026-06-23.xlsx` (date only, overwritten each run).

Raw Backstage exports in `data/raw/` keep a timestamp per run for debugging.

---

## What each run does

1. Check Backstage session → auto-login if needed  
2. Ensure **US+** agency region in header  
3. Export **management** report from `/portal/anchor/list`  
4. Export **performance** report from `/portal/data/data`  
5. Merge both by Creator ID  
6. Save local files (XLSX, CSV, JSON)  
7. Upload to Google Drive + update Google Sheets (if configured)

---

## Output files

| Location | Files |
|---|---|
| `data/raw/` | `backstage-management-*.xlsx`, `backstage-performance-*.xlsx` |
| `data/processed/` | `combined-creators-YYYY-MM-DD.xlsx` (one per day), `.csv`, `.json`, `import-summary-YYYY-MM-DD.json` |
| `data/logs/` | Failure screenshots, auto-update log |

---

## Two-PC workflow (dev + server)

### Dev PC (this computer)

Edit code → push to GitHub:

```bat
git add .
git commit -m "Describe your change"
git push origin main
```

### Server PC (runs 24/7)

One-time:

```bat
git clone https://github.com/jrftw/InfiniViewV3BackstageDataGather.git
cd InfiniViewV3BackstageDataGather
install-server.bat
```

Copy `.env` to server PC (do not commit). Then:

```bat
npm run login:test
start-server.bat
setup-auto-update.bat
```

Server pulls updates from GitHub every ~15 minutes when `start-server.bat` is running.

---

## npm scripts reference

| Command | What it does |
|---|---|
| `npm run build` | Compile TypeScript → `dist/` |
| `npm run login` | Interactive login, save session |
| `npm run login:test` | Visible auto-login test |
| `npm run preflight` | Verify connections only (no Backstage export) |
| `npm run gather` | One full gatherer run |
| `npm run gather:visible` | Gatherer with visible browser |
| `npm start` | Start 24/7 server + scheduler |

---

## Batch files reference

| File | What it does |
|---|---|
| `install-server.bat` | First-time `npm ci` + build + create `.env` |
| `run-now-visible.bat` | One run, visible browser |
| `run-now.bat` | One run, uses `.env` headless setting |
| `start-server.bat` | 24/7 server (auto-restarts after git update) |
| `setup-auto-update.bat` | Windows scheduled task backup updater |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Login screen appears | Check `BACKSTAGE_EMAIL` / `BACKSTAGE_PASSWORD` in `.env` |
| Wrong region / export errors | Ensure `BACKSTAGE_FORCE_US_PLUS=true`; delete `data/auth/backstage-auth.json` and re-login |
| Export button not found | See `docs/BACKSTAGE_EXPORT_STEPS.md`; update `src/backstage/backstageSelectors.ts` |
| Google errors | Share Drive folder + Sheet with service account email |
| Failure screenshots | Check `data/logs/fail-*.png` |

More: `docs/TROUBLESHOOTING.md`

---

## Related docs

| Doc | Topic |
|---|---|
| `Plan/Plan.md` | Full build plan & architecture |
| `README.md` | Project overview |
| `docs/BACKSTAGE_PLAYWRIGHT_LOGIN_README.md` | Login automation details |
| `docs/BACKSTAGE_EXPORT_STEPS.md` | Export flow & selectors |
| `docs/GOOGLE_SHEETS_SETUP.md` | Google credentials setup |

---

## Suggestions For Features and Additions Later

- Add `HOW_TO_RUN.pdf` one-pager for server PC operators  
- Video walkthrough link once first stable run is confirmed
