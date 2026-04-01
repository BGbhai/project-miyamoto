# Gym Cloud Automation

This repo now includes an off-device scheduler for the hosted Gym web app.

## What runs in the cloud

- `.github/workflows/gym-nightly-cloud.yml`
  - runs Monday-Saturday at `10:00 PM IST`
  - updates only the remaining current week
- `.github/workflows/gym-weekly-cloud.yml`
  - runs Sunday at `9:00 PM IST`
  - builds the next Monday-Sunday week

Both workflows call:

- `scripts/gym_cloud_scheduler.py`

That script:

- reads the shared Google Sheet `Session Log`
- treats blank `Completed` cells as missed sessions
- updates `gym-web/data/current-week.json`
- updates future or next-week plan rows in the sheet
- relies on deterministic planning rules so the output is stable and repeatable

## One-time setup still required

GitHub Actions cannot read your private Google Sheet anonymously. The remaining setup is:

1. Create or choose a Google service account that has access to the sheet.
2. Share the `Project Miyamoto Session Log` sheet with that service account email as an editor.
3. Add the full service account JSON to this repo as a GitHub secret:

```bash
gh secret set GYM_GOOGLE_SERVICE_ACCOUNT_JSON -R BGbhai/project-miyamoto < service-account.json
```

The repo variables used by the workflows are:

- `GYM_SHEET_ID`
- `GYM_SHEET_TAB`

## Manual runs

You can trigger either workflow from GitHub Actions with `Run workflow` once the secret is set.

## Why this replaces local-only scheduling

The current Codex desktop automations depend on this Mac being available. GitHub Actions does not.
