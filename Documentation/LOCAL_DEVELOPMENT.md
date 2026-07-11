# Local Development — InfiniView V3 Backstage Gatherer

**Audit date:** 2026-07-11  
**Also see:** [Plan/HOW_TO_RUN.md](../Plan/HOW_TO_RUN.md), [docs/BACKSTAGE_PLAYWRIGHT_LOGIN_README.md](../docs/BACKSTAGE_PLAYWRIGHT_LOGIN_README.md)

---

## Prerequisites

| Tool | Version (audit machine) | Notes |
|------|-------------------------|-------|
| Node.js | 22.22.1 (18+ required) | CI uses Node 20 |
| npm | 11.9.0 | |
| Git | Any recent | For auto-update testing |
| Windows | 10/11 | Primary platform |

---

## Clone and install

```bat
git clone https://github.com/jrftw/InfiniViewV3BackstageDataGather.git
cd InfiniViewV3BackstageDataGather
npm ci
npm run build
copy .env.example .env
```

`npm ci` triggers `postinstall` → `playwright install chromium`.

---

## Minimum `.env` for local visible export

```env
BACKSTAGE_EMAIL=your-agency-email@example.com
BACKSTAGE_PASSWORD=your-password
BACKSTAGE_HEADLESS=false
BACKSTAGE_AGENCY_REGION=US+
BACKSTAGE_FORCE_US_PLUS=true
```

Google and MongoDB can remain empty for **export-only** testing (files land in `data/raw` and `data/processed`).

---

## First Backstage login

```bat
npm run login
```

Browser opens. Complete login (including 2FA if prompted), press Enter in terminal. Session saved to `data/auth/backstage-auth.json`.

Smoke test:

```bat
npm run login:test
```

Headed test:

```bat
npm run login:test:headed
```

---

## Run a visible gather (dev PC)

**PowerShell:**

```powershell
.\run-now-visible.bat
# or
npm run gather:visible
```

**cmd:**

```bat
run-now-visible.bat
npm run gather:visible
```

Watch Chromium export management + performance reports. Outputs appear under `data/raw/` and `data/processed/`.

---

## Run Express server locally

```bat
npm run dev
```

Dashboard: http://localhost:3099

Production-like:

```bat
npm run build
npm run start
```

---

## Preflight before first full publish

```bat
npm run preflight
```

Checks Google credentials, Mongo connectivity (if configured), paths, and Backstage auth file presence.

---

## Additional CLI jobs

```bat
npm run enrich
npm run profile-acquire
npm run profile-acquire:user -- --username=somecreator
npm run snapshot-history:import
npm run snapshot-history:verify
npm run snapshot-history:backfill
```

---

## Dev PC vs server PC

| Task | Dev PC | Server PC |
|------|--------|-----------|
| Edit TypeScript | Yes | Pull only |
| Visible debugging | Yes | Rarely |
| 24/7 scheduled runs | No | Yes |
| `setup-server-reliability.bat` | No | Yes |
| Push to GitHub | Yes | No |

Copy `backstage-auth.json` to server or run `npm run login` once on server.

---

## Common local failures

| Symptom | Fix |
|---------|-----|
| Playwright browser missing | `npx playwright install chromium` |
| `npm run login` closes instantly | Run from project root; check Node version |
| Export button not found | Backstage UI changed — update selectors |
| Google 403 | Share resources with service account email |
| Mongo timeout on Windows | Try `GATHERER_MONGODB_DNS_SERVERS` |
| PowerShell won't run `.bat` | Prefix with `.\` |

---

## Files never committed

| Path | Purpose |
|------|---------|
| `.env` | Secrets |
| `data/auth/backstage-auth.json` | Backstage session |
| `data/raw/`, `data/processed/`, `data/logs/` | Run artifacts |
| `node_modules/`, `dist/` | Dependencies / build output |

---

## Safe sample configuration

Use placeholder emails and empty keys in shared examples. Never paste production `.env` into chat or issues.
