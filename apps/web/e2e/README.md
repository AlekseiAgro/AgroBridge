# Meta Pixel browser regression

`meta-pixel-consent.e2e.mjs` drives a local production build of the web app in Chrome. It loads Meta's real `fbevents.js`, serves the Pixel configuration from the test itself, and aborts every other request to Meta, including `/tr` beacons. No event is sent to Meta.

The suite refuses the production Pixel ID `4510117069202254`. Build the web app with the fake ID below. It is not part of `pnpm test` and is not run in CI: it needs Chrome, Postgres, and both servers already running.

## Prepare

From `apps/web`:

```bash
NEXT_PUBLIC_META_PIXEL_ID=1234567890123456 pnpm build
pnpm start
```

Start the API against the local database with `MAIL_DRIVER=console`, so the password-reset scenario can read the reset link from the API's console output. `psql` must be on `PATH`. The suite deletes rows from `rate_limit_counters` (using `DATABASE_URL`, or `apps/api/.env` when that variable is unset) so registration can be repeated.

Chrome or Chromium must be installed. Playwright's browsers are not downloaded. Set `CHROME_PATH` if the binary is not in a standard location.

## Run

```bash
pnpm --filter @agrobridge/web test:meta-pixel
```

The password-reset scenario reads the reset link from one of:

- `META_PIXEL_E2E_API_LOG` — a file the API console is written to
- `META_PIXEL_E2E_API_TMUX` — a tmux session whose pane shows that console. Set `META_PIXEL_E2E_TMUX_CONFIG` when tmux needs `-f`.

Other optional variables:

- `META_PIXEL_E2E_WEB_URL` (default `http://localhost:3000`)
- `META_PIXEL_E2E_API_URL` (default `http://localhost:3001`)
- `META_PIXEL_E2E_PIXEL_ID` (default `1234567890123456`; the production ID is rejected)
- `META_PIXEL_E2E_FBEVENTS` — a local `fbevents.js` if `connect.facebook.net` cannot be reached. The script is only served to the browser under test.
- `META_PIXEL_E2E_LOG` — where to write the pass/fail log. When unset, the log is written to `/opt/cursor/artifacts/meta-pixel-consent-e2e.log` if that directory exists.

Do not point the suite at a production site.
