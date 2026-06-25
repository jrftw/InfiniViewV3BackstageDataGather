# Backstage Export Steps

Automated via Playwright using your recorded flows.

## URLs

| Report | URL |
|---|---|
| Login | [live-backstage.tiktok.com/login/](https://live-backstage.tiktok.com/login/) |
| Management export | [live-backstage.tiktok.com/portal/anchor/list](https://live-backstage.tiktok.com/portal/anchor/list) |
| Performance export | [live-backstage.tiktok.com/portal/data/data?anchorID](https://live-backstage.tiktok.com/portal/data/data?anchorID) |

## Login (one time per PC)

```bat
npm run login
```

Opens the login page. **Enter credentials manually** — they are never stored in code. Session saves to `data/auth/backstage-auth.json`.

**Use US settings:** ensure `.env` has `BACKSTAGE_LOCALE=en-US` and `BACKSTAGE_TIMEZONE=America/New_York`, then run login so the saved session is created under the USA browser profile.

## Export flow (automated)

Both exports use Backstage's **notification download** pattern:

1. Navigate to the page
2. Dismiss popups
3. Customize columns (Unselect all × 2 → Confirm)
4. Export → Select all → Confirm export
5. Click **View** toast or **bell** icon
6. Download file from notification panel

### Management (`anchor/list`)

1. Second tab in tab bar
2. Column customize modal
3. Bulk export all creators
4. Download from notifications → `backstage-management-*.xlsx`

### Performance (`data/data`)

1. Customize data columns
2. Export all creators for last N days (`BACKSTAGE_PERFORMANCE_DAYS` in `.env`)
3. Download from notifications → `backstage-performance-*.xlsx`

## Selectors

All selectors live in `src/backstage/backstageSelectors.ts`.

If Backstage UI changes, update that file only.

## Debug

Failure screenshots save to `data/logs/fail-management-*.png` and `fail-performance-*.png`.

Run headed (visible browser) by temporarily setting `headless: false` in `backstageExportRunner.ts` or add `GATHERER_BACKSTAGE_HEADED=true` later.
