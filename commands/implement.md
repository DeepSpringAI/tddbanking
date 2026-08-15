---
description: Turn a draft scenario into a running browser test
argument-hint: scenario name, capability, or blank for the highest-priority draft
---

Take a `@draft` scenario live. Read the `tddbanking` skill (especially the two modes) and
`${CLAUDE_PLUGIN_ROOT}/skills/tddbanking/writing-scenarios.md` before writing anything.

Target: $ARGUMENTS — if empty, pick the highest-priority draft the way `/tddbanking:audit`
ranks them, and announce which you picked and why.

One scenario per cycle. Never batch-implement drafts: each result changes what you learn
about the app, and a batch hides which scenario found what.

1. **Read the scenario and its evidence comment.** The evidence tells you where in the app to
   look.
2. **Explore the surface** it touches. Use the `webapp-testing` skill for throwaway
   reconnaissance — screenshots, DOM inspection, finding real locators. Nothing from that
   exploration gets committed; it exists to tell you what the Page Object should contain.
3. **Write or extend the Page Object** in `pages/`. Every locator lives here, and prefer
   `getByRole` / `getByLabel` / `getByText` over CSS.
4. **Write the step definitions** in `steps/`. Reuse existing steps before adding new ones —
   search first. Steps contain no locators.
5. **Remove the `@draft` tag** and run the scenario through the `browser-runner` agent so
   traces and screenshots stay out of this context.
6. **Route the outcome honestly** — this is the whole point of the command:
   - **Green** → backfill succeeded. The behavior works and is now guarded. Coverage gained.
     This is a success; do not manufacture a red first.
   - **Red** → hand the failure to the `failure-triager` agent. Then:
     - `defect` → **the bank found a bug.** Leave the scenario live and failing, or tag it
       `@known-defect` if the suite must stay green while it is fixed. Record the finding for
       `/tddbanking:file`. Do not fix the app here.
     - `flake` → fix the test and re-run. The scenario is not live until it is stable.
     - `stale` → the draft described the wrong behavior. Correct it, say why, re-run.

**Never edit a scenario's assertion to match what the app does.** That converts a discovered
defect into permanent blindness, and it is the one failure this whole system exists to
prevent. If the scenario is genuinely wrong, say so explicitly and cite the intentional
change that made it wrong.

Report: which scenario went live, the outcome, any finding produced, and the capability's new
coverage.
