---
description: Scaffold a Playwright BDD test bank in this repo (one-time setup)
argument-hint: optional base URL of the running app
---

Set up a test bank in this repository. Read the `tddbanking` skill first for the tag
vocabulary you are about to bake into the config.

Base URL: $ARGUMENTS — if empty, detect the dev server command and port from `package.json`,
and ask rather than guessing a port.

1. **Check for an existing bank.** If `features/` with `.feature` files already exists, do
   not overwrite anything. Report what is there and stop.
2. **Detect the package manager** from the lockfile (`pnpm-lock.yaml`, `yarn.lock`,
   `package-lock.json`, `bun.lockb`). Use it consistently; do not introduce a second one.
3. **Install** `playwright-bdd` and `@playwright/test` as dev dependencies, then
   `npx playwright install chromium`.
4. **Write the scaffold** from this plugin's `templates/`:
   - `playwright.config.ts` (skip if one exists — merge by hand and say so)
   - `pages/BasePage.ts`, `steps/fixtures.ts`, `features/example.feature`
5. **Add scripts** to `package.json`, exactly these — the tag filter is not optional:
   ```json
   "bdd:gen":    "bddgen --tags \"not @draft\"",
   "test:bank":  "npm run bdd:gen && playwright test",
   "test:smoke": "bddgen --tags \"@smoke and not @draft\" && playwright test"
   ```
   Translate `npm run` to the detected package manager. Explain to the user, in one line,
   that calling `bddgen` bare will fail on drafts by design.
6. **Gitignore** `.features-gen/`, `test-results/`, `playwright-report/`.
7. **Prove it runs.** Start the app, run `test:bank`, confirm the example scenario passes.
   A scaffold that has never gone green is not a scaffold.

Report: what was installed, the scripts added, and that the next step is
`/tddbanking:discover`.
