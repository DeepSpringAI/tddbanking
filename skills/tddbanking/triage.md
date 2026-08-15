# Triaging a failure

A red browser test means one of three things, and they need opposite responses. Deciding
which comes before anything else — never re-run until green, and never edit the scenario to
match what the app currently does.

## The three verdicts

**`defect`** — the app is wrong. The scenario is a correct statement of required behavior and
the app does not do it. This is the bank doing its job. It becomes a finding and goes to
`/tddbanking:file`.

**`flake`** — the test is unreliable. Same code, different outcome across runs. Causes:
fixed timeouts, racing on network, shared state between tests, a locator matching two
elements, animation. The scenario is right and the app is right; the harness is wrong.

**`stale`** — the app changed on purpose and the scenario now describes the old world. A
renamed label, a merged step, a deliberately removed feature. The scenario is wrong. Update
it — but only with an explicit statement of what changed and why the new behavior is
intended. "The test disagrees with the code so the test must be wrong" is how a suite is
quietly gutted.

## How to decide

1. **Read the trace before the source.** `trace: retain-on-failure` is configured; the trace
   shows what the user actually saw. Most triage ends here.
2. **Re-run the single scenario in isolation.** Passes alone but fails in the suite → shared
   state or ordering, which is `flake`.
3. **Re-run it twice more unchanged.** Inconsistent → `flake`. Consistent → not flake, keep
   going.
4. **Check git.** Did the relevant UI change recently, and deliberately? Deliberate change
   that the scenario contradicts → `stale`. Otherwise → `defect`.
5. **Reproduce by hand if still ambiguous.** Drive the app the way the scenario describes. If
   a person cannot do it either, it is a `defect`, whatever the trace says.

## What each verdict triggers

| Verdict | Action | Bank change |
|---|---|---|
| `defect` | File a finding; do not fix the app inside the loop | none — the scenario was right |
| `flake` | Fix the test. If it cannot be fixed now, tag `@quarantine` + `@quarantine-until:<date>` | scenario stays, stops gating |
| `stale` | Update the scenario, stating what changed and why | scenario rewritten |

## Never

- **Never quarantine to make CI green.** A quarantine with no deadline and no owner is a
  deleted test that still costs runtime.
- **Never weaken an assertion to pass.** Changing `toHaveText` to `toBeVisible` because the
  text is wrong converts a defect into permanent blindness.
- **Never mark `stale` without evidence of an intentional change.** A commit, a ticket, a
  decision. Absent that, it is a `defect`.
