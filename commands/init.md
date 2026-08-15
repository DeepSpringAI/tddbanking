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
4. **Write the scaffold** from `${CLAUDE_PLUGIN_ROOT}/templates/`:
   - `playwright.config.ts` — **skip if one exists.** A repo that already uses Playwright has
     a config worth keeping: add the `defineBddConfig` block and the `testDir` it returns to
     the existing file by hand, and say exactly what you changed.
   - `pages/BasePage.ts`, `steps/fixtures.ts`, `steps/example.ts`,
     `features/example.feature`
   - In the config's `webServer` block, replace `command` and `url` with this repo's real dev
     command and port. Without that, CI has nothing to test against. If the bank should run
     against an already-deployed app instead, leave it and set `BANK_BASE_URL`.
5. **Add scripts** to `package.json`, exactly these — the tag filter is not optional:
   ```json
   "bdd:gen":    "bddgen --tags \"not @draft\"",
   "test:bank":  "npm run bdd:gen && playwright test",
   "test:smoke": "bddgen --tags \"@smoke and not @draft\" && playwright test"
   ```
   Translate `npm run` to the detected package manager. Explain to the user, in one line,
   that calling `bddgen` bare will fail on drafts by design.
6. **Gitignore** `.features-gen/`, `test-results/`, `playwright-report/`.
7. **Add CI** from `${CLAUDE_PLUGIN_ROOT}/templates/workflows/bank.yml` to
   `.github/workflows/bank.yml` — skip if a workflow already runs Playwright, and instead
   tell the user which job to add `test:smoke` to. Adapt `npm ci` and the run commands to the
   detected package manager. A bank that does not run on every PR rots; this step is what
   makes the difference, so do not quietly omit it.
8. **Prove it runs.** Run `test:bank` and confirm the example scenario passes. A scaffold that
   has never gone green is not a scaffold.

Report: what was installed, the scripts added, and that the next step is
`/tddbanking:discover`.
