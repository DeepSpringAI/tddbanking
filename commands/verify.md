---
description: Run the live bank against the app and triage every failure
argument-hint: "smoke" (default), "full", or a capability
---

Run the bank and turn its output into decisions. Read `${CLAUDE_PLUGIN_ROOT}/skills/tddbanking/triage.md` before
classifying anything.

Scope: $ARGUMENTS — default `smoke`. `full` runs everything; a capability name runs that
capability's scenarios.

1. **Confirm the app is running** at the configured base URL. If it is not, start it via the
   repo's dev command — do not report failures against a dead server.
2. **Run through the `browser-runner` agent**, using the `package.json` scripts so the
   `not @draft` filter is always applied. The agent returns a verdict summary and an evidence
   path, never a wall of Playwright output.
3. **Triage every failure** via the `failure-triager` agent, one per failure, in parallel.
   Each returns `defect` / `flake` / `stale` with its reasoning.
4. **Apply the triage**:
   - `flake` → fix now if it is quick; otherwise tag `@quarantine` plus
     `@quarantine-until:<date>` with a real deadline, and name an owner. Never quarantine silently to make CI green.
   - `stale` → correct the scenario, stating the intentional change that made it stale.
   - `defect` → collect as a finding. Do not fix the app here.
5. **Report** as a table: scenario, verdict, evidence path. Then the counts.

If everything passes, say so plainly and report the runtime — a green suite that has grown
too slow to gate a PR is its own finding.

End by naming the defects found and, if there are any, that `/tddbanking:file` turns them
into OpenSpec changes.
