---
name: tddbanking
description: Grow and run a bank of browser-verified user scenarios. Use when the user wants to find untested user journeys, check what a real user can actually do in the browser, add or implement Gherkin scenarios, audit test coverage by capability, or triage e2e failures.
license: MIT
---

# The test bank

A **bank** is the accumulated set of scenarios describing what a real user must be able to do
in this app, plus the browser tests that prove it. It is an asset of the repo, not of a
change. It outlives features, and it only ever grows.

Backend unit tests are assumed to exist and to be someone else's job. This bank asks a
different question: **does the thing actually work for a person in a browser?**

## The coverage model

Two populations of scenarios, one corpus:

- **Draft** — a behavior a user should have. Tagged `@draft`. No step definitions yet.
- **Live** — implemented, running in a browser on every CI run.

```
coverage(capability) = live / (live + draft)
```

Growing the bank means moving scenarios from draft to live. Both live in the same
`.feature` file, so one file reads as the complete intent of a capability with the untested
parts visibly marked. `bddgen --tags "not @draft"` compiles only the live ones.

**Never call `bddgen` without the tag filter.** Drafts have no step definitions; a bare
`bddgen` turns every draft into an undefined-step failure. The filter lives in the
`package.json` scripts written by `/tddbanking:init` — call those, not `bddgen`.

**There is no separate ledger file.** The feature corpus is the ledger; coverage is computed
by parsing tags. A hand-maintained coverage table drifts within a week.

## Tag vocabulary

On the `Feature`:

- `@capability:<slug>` — the unit coverage is reported by. Required.

On a `Scenario`:

| Tag | Meaning |
|---|---|
| `@draft` | Aspirational. Excluded from generation. Removing it is how a scenario goes live. |
| `@smoke` | Must always be green. The tier that gates a merge. |
| `@regression` | Guards a bug that already happened once. |
| `@quarantine:<YYYY-MM-DD>` | Known flaky, excluded from gating, must be fixed or deleted by that date. |
| `@priority:high\|medium\|low` | Drives what `/tddbanking:implement` picks next. |
| `@from-crawl` `@from-bug:<id>` `@from-story:<id>` | Which discovery modality found it. |
| `@from-backend:<path>` | Reserved: a backend test asserting the same behavior. |

Every `@draft` also carries an evidence comment directly above it:

```gherkin
  # evidence: POST /api/transfers form at /transfers, submit button disabled while pending
  @draft @from-crawl @priority:high
  Scenario: Submitting a transfer twice does not send the money twice
```

**No evidence, no scenario.** A scenario invented without a route, a control, a ticket, or a
report is a guess, and a bank with guesses in it stops being trusted. Drop it instead.

## Two modes, and why a green-on-first-run is a success

The bank serves an app that usually already exists. So implementing a draft has two possible
honest outcomes, and which one you get tells you what to do next:

**Backfill mode** — the behavior is supposed to work already.
- Test goes **green** on the first run → coverage gained. This is a win, not a TDD violation.
  Classic red-before-green does not apply; you are documenting reality, not driving it.
- Test goes **red** → you have found a defect. It is a finding. Route it to
  `/tddbanking:file`. Do not fix the app inside the implement loop.

**Drive mode** — the scenario describes behavior nobody has built yet.
- Red is mandatory and expected. The scenario becomes an OpenSpec change, development makes
  it green, and the `tdd` skill's rules govern that work. This is where the bank gives TDD
  its direction: the bank says what is missing, OpenSpec says how it will be addressed.

You do not have to declare the mode up front. Run the test; the result tells you which you
were in. What matters is routing the outcome correctly instead of quietly editing the
scenario until it passes.

## Writing scenarios

See [writing-scenarios.md](writing-scenarios.md). The two rules that matter most: scenarios
are declarative (they say what the user achieves, never which button was clicked), and step
definitions are thin (every locator lives in a Page Object).

## Triage

See [triage.md](triage.md). A red e2e test is ambiguous — defect, flake, or stale scenario —
and unresolved ambiguity is the single most common reason teams abandon a browser suite.
Every failure gets classified before anything else happens.

## Keeping the bank healthy

Growth is the goal, but an unmaintained bank becomes a slow, flaky suite nobody trusts, and
then it gets deleted. Three rules hold the line:

- **Dedup on add.** A new scenario that asserts what an existing one asserts is not coverage,
  it is duplicated runtime. Compare by behavior, not by wording.
- **Quarantine has a deadline.** `@quarantine:<date>` past its date is reported by
  `/tddbanking:audit` as debt. Fix it or delete it — a permanently quarantined test is a lie.
- **Tier the suite.** `@smoke` stays fast enough to gate every PR. The full bank can be
  slower and run on a schedule.

## The loop

```
init → discover → audit → implement → verify → file
              ↑                                  │
              └────────── the bank grows ────────┘
```

`/tddbanking:file` is the only step that needs the OpenSpec CLI. Everything else runs on a
repo that has never heard of OpenSpec.
