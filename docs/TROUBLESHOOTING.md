# Troubleshooting

## Backstage session expired

```bat
npm run login
```

## Export button not found

- See failure screenshots in `data/logs/`
- Update `src/backstage/backstageSelectors.ts`

## Google API errors

- Verify service account has Editor on Drive folder and Sheet
- Check private key formatting in `.env` (use `\n` not real newlines in one line)

## Auto-update not working

- Server must be cloned via `git clone` (not a zip download)
- `start-server.bat` must be running (restart loop)
- Check `data/logs/auto-update.log`
- Manual check: dashboard → **Check for Updates**

## Run already in progress

Only one gatherer run at a time. Wait for the current run to finish.

## Port in use

Change `APP_PORT` in `.env` (default `3099`).
