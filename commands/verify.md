---
description: Turn 3 of 5 - run every live scenario and triage every failure
argument-hint: optional capability to limit to (default is everything)
---

**Turn 3 of the five-turn loop.** Read `${CLAUDE_PLUGIN_ROOT}/skills/tddbanking/triage.md`
before classifying anything.

**The contract of this turn is that every failure gets a verdict.** Not a re-run, not a
shrug — a verdict with evidence. Unresolved ambiguity is the most common reason teams abandon
a browser suite, and "probably flaky" is how a suite dies quietly.

Scope: $ARGUMENTS — if empty, the whole bank.

## 1. Run everything

Confirm the application is running, then run the full bank through **`browser-runner`** agents.

**Shard by capability and run the shards in parallel**, each in its own worktree with its own
port. Two shards sharing a port will fight over the server and produce failures that belong to
neither. Assign ports explicitly and pass each shard its own `BANK_BASE_URL`.

Use the `package.json` scripts so the `not @draft` filter always applies. Never call `bddgen`
bare — drafts have no step definitions and it will fail on all of them.

State-mutating scenarios need a freshly seeded server. Playwright tears down a `webServer` it
started, so do not leave one running by hand between runs.

## 2. Triage every failure, in parallel

Dispatch one **`failure-triager`** per failure, all at once. Each returns
`defect` / `flake` / `stale` with its reasoning and a citation.

Apply the verdicts:

| Verdict | Action |
|---|---|
| `defect` | Collect as a finding. **Do not fix the application here** |
| `flake` | Fix the test if it is quick; otherwise tag `@quarantine` plus `@quarantine-until:<date>` with a real deadline and an owner |
| `stale` | Correct the scenario, citing the intentional change that made it stale |

Never quarantine to make the run green, and never weaken an assertion to pass. Both convert a
signal into permanent blindness.

## 3. Record findings with stable ids

Write every `defect` verdict to `findings.md` with an id — `F-1`, `F-2`, … — carrying the
failing scenario, the triage reasoning, the evidence path and the citation.

Tag each failing scenario `@known-defect` and `@defect-change:F-n`. **The bare `@known-defect`
tag is what the gate filters on**; the `@defect-change:` companion carries the id. A
parameterised tag alone cannot be excluded, because Cucumber matches whole tags.

Turn 4 rewrites those `F-n` ids to real change names. Until it runs, `F-n` is the stable
handle, so do not invent change names here.

## 4. Report and stop

Report as a table — scenario, verdict, evidence path — then the counts, then
`node ${CLAUDE_PLUGIN_ROOT}/scripts/bank-stats.mjs`.

Confirm the gate: `test:smoke` should now pass, because every proven defect is tagged out of
it. If it does not, say which scenario is still failing the gate and why.

If everything passed, say so plainly and report the runtime — a green suite that has grown too
slow to gate a pull request is its own finding.

End by telling the user the next step is `/tddbanking:file`.
