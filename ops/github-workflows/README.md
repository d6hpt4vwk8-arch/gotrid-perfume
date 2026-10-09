# GitHub Actions workflows (to be copied into `.github/workflows/`)

These two workflows live here because the Personal Access Token used for pushing
from the dev machine has no `workflow` scope, so GitHub rejects any push that
touches `.github/workflows/`. Add them once on GitHub (Add file -> Create new
file -> `.github/workflows/<name>.yml`, paste the content), or give the token the
`workflow` scope and move the files.

- `spventure-stock-hourly.yml` — hourly SP Venture refresh via the protected cron
  endpoint (`?mode=hourly`). Secret: `CRON_SECRET`.
- `tamda-stock.yml` — Tamda stock/price check (full ~03:30 Prague, top 600 ~13:30).
  Secrets: `DATABASE_URL`, `TAMDA_EMAIL`, `TAMDA_PASSWORD`.
