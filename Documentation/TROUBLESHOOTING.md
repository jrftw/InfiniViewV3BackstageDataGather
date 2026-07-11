# Troubleshooting — InfiniView V3 Backstage Gatherer

**Audit date:** 2026-07-11  
**Legacy reference:** [docs/TROUBLESHOOTING.md](../docs/TROUBLESHOOTING.md)

---

## Dependency installation

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `npm ci` fails | Lockfile mismatch | `npm install` once, commit lockfile from dev PC |
| Playwright browser missing | postinstall skipped | `npx playwright install chromium` |
| `tsc` not found | devDependencies missing | `npm ci` |

---

## Build failures

| Symptom | Fix |
|---------|-----|
| TypeScript errors after pull | `npm ci && npm run build` |
| CI fails on GitHub | Reproduce locally with Node 20 |

If `npm run build` passes locally, do not assume missing source files — verify with a fresh compile.

---

## Backstage / Playwright

| Symptom | Fix |
|---------|-----|
| Logged out / session expired | `npm run login` |
| Wrong agency region | Set `BACKSTAGE_FORCE_US_PLUS=true`, re-login |
| Export button not found | Update `src/backstage/backstageSelectors.ts` — see [docs/BACKSTAGE_EXPORT_STEPS.md](../docs/BACKSTAGE_EXPORT_STEPS.md) |
| Download never appears | Check notification poll logs; increase wait env vars |
| Headless fails but visible works | Run `npm run gather:visible` to debug; check popups in `backstageLoginPopups.ts` |
| Auto-login fails | Verify `BACKSTAGE_EMAIL`/`PASSWORD` in `.env` |

---

## Google APIs

| Symptom | Fix |
|---------|-----|
| Permission denied / 403 | Share Drive folder and Sheet with service account email (Editor) |
| Invalid grant / key error | Check `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` newline escaping (`\n`) |
| Upload quota exceeded | Configure `GOOGLE_DELEGATED_USER` domain-wide delegation |
| Failure emails not sent | Add `gmail.send` scope + delegation in Admin Console |
| Wrong CRM/DIP data | Verify sheet IDs, tab names, GID in `.env` |

See [docs/GOOGLE_SHEETS_SETUP.md](../docs/GOOGLE_SHEETS_SETUP.md).

---

## MongoDB

| Symptom | Fix |
|---------|-----|
| Connection timeout (Windows) | Set `GATHERER_MONGODB_DNS_SERVERS=8.8.8.8,8.8.4.4,1.1.1.1` |
| Duplicate key on snapshots | Ensure `GATHERER_MONGO_SNAPSHOT_ONE_PER_DAY=true`; index bootstrap runs on publish |
| Writes skipped | Check `MONGODB_URI` set and `GATHERER_MONGODB_ENABLED=true` |
| Wrong database | Verify `MONGODB_DB_NAME=InfiniViewV3` |

---

## Express server

| Symptom | Fix |
|---------|-----|
| Port 3099 in use | Change `APP_PORT` or stop duplicate process |
| Dashboard unreachable | Confirm `start-server.bat` running; check watchdog task |
| `/run-now` hangs | Expected — job runs synchronously; check Playwright logs |
| Update not applying | Ensure git repo on server; click **Check for Updates** |

---

## Scheduling

| Symptom | Fix |
|---------|-----|
| Missed scheduled run | Check `GATHERER_MIN_MINUTES_BETWEEN_RUNS` cooldown |
| No catch-up after reboot | Verify `GATHERER_CATCHUP_ON_STARTUP=true` and remaining window today |
| Wrong times | Confirm `TZ=America/New_York` and `RUN_SCHEDULE_*` values |
| Snapshot import skipped | `GATHERER_SNAPSHOT_HISTORY_IMPORT_ENABLED=false`? |

---

## Git auto-update

| Symptom | Fix |
|---------|-----|
| "Not a git repository" | Clone from GitHub instead of copying folder |
| Update stuck | Delete `.update-lock` if stale |
| Build fails after pull | SSH to server, run `npm ci && npm run build` manually, fix errors on dev PC |

---

## Profile Acquirer

| Symptom | Fix |
|---------|-----|
| All creators skipped | Within `GATHERER_PROFILE_ACQUIRER_STALE_HOURS` — use `--force` |
| Rate limited | Lower `GATHERER_PROFILE_ACQUIRER_BATCH_LIMIT` |
| No videos | Enable `GATHERER_PROFILE_ACQUIRER_BROWSER_VIDEOS=true` |

---

## Auto Highlights scan

| Symptom | Fix |
|---------|-----|
| Never runs | Expected — disabled by default; set `GATHERER_AUTO_HIGHLIGHTS_SCAN_ENABLED=true` |
| Skipped outside window | Only 8 AM–8 PM ET unless hours changed |
| 401/403 from API | Set `INFINIVIEW_INTERNAL_SERVICE_SECRET` |

---

## CI failures

| Symptom | Fix |
|---------|-----|
| `npm ci` fails on Actions | Commit updated `package-lock.json` |
| `tsc` errors | Fix TypeScript on dev PC, push |

---

## Collecting diagnostics

1. Last run summary: `data/logs/last-run-summary.json`
2. Console output from `npm run gather:visible`
3. `/api/status` JSON
4. Confirm versions: `node -v`, `git rev-parse HEAD`
5. Do **not** attach `.env` or `backstage-auth.json` to tickets

See [OBSERVABILITY_AND_LOGGING.md](OBSERVABILITY_AND_LOGGING.md).
