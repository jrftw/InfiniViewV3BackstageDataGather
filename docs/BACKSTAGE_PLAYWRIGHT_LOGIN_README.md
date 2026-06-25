# TikTok Backstage Login — Playwright (This Project)

This gatherer implements the full login flow from the InvitesTrialsQuitMetrics Playwright guide, integrated into TypeScript under `src/backstage/`.

## US+ agency region (required)

Backstage must run in the **US+** agency region. On every run the gatherer:

1. Reads the region label in the header (`#header div.semi-select-selection span`)
2. If not **US+**, opens the dropdown → selects **US+** → clicks **Confirm**
3. Retries up to 3 times (uses settlement page as fallback probe)

```env
BACKSTAGE_AGENCY_REGION=US+
BACKSTAGE_FORCE_US_PLUS=true
```

Failure screenshots: `data/logs/fail-region-switch-*.png`

## Login flow

| Step | Action |
|------|--------|
| 1 | Go to [live-backstage.tiktok.com](https://live-backstage.tiktok.com/) |
| 2 | Click login button (`.semi-button:nth-child(4) strong`) or **Log in** by role |
| 3 | Fallback: direct [login URL](https://live-backstage.tiktok.com/login/) |
| 4 | Fill `#email` and `#password` from `.env` |
| 5 | Click submit (`.semi-button-block > .semi-button-content`) |
| 6 | Clear popups — **Maybe later**, **Got it**, modals |
| 7 | Save session → `data/auth/backstage-auth.json` |

If already logged in → **skips steps 2–5**.

## Environment variables

```env
BACKSTAGE_EMAIL=your-email@example.com
BACKSTAGE_PASSWORD=your-password
BACKSTAGE_HEADLESS=false
```

Aliases (same as other Infinitum tools):

```env
TIKTOK_EMAIL=
TIKTOK_PASSWORD=
HEADLESS=false
```

## Commands

```bat
npm run login:test          REM visible login test + saves session
npm run login               REM login once (auto or manual fallback)
run-now-visible.bat         REM full gatherer with visible browser
```

## Source files

| File | Purpose |
|------|---------|
| `src/backstage/backstageAutoLogin.ts` | Full login orchestration |
| `src/backstage/backstageLoginPopups.ts` | Post-login popup clearing |
| `src/backstage/backstageSelectors.ts` | All selectors (edit when UI changes) |
| `src/backstage/backstageSession.ts` | Session probe + ensure authenticated |
| `src/backstage/backstageLoginTest.ts` | Standalone login test |

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Login button not found | Update `homeLoginButton` in `backstageSelectors.ts` |
| Email still visible after submit | Check credentials; see `data/logs/fail-login-*.png` |
| Stale session | Delete `data/auth/backstage-auth.json`, run `npm run login:test` |
| CAPTCHA / 2FA | Log in manually once with visible browser |

## Debug selectors

```bat
npx playwright codegen https://live-backstage.tiktok.com/
```

## Puppeteer → Playwright map

See the full migration guide in your InvitesTrialsQuitMetrics repo. This project uses Playwright only — no Puppeteer dependency.
