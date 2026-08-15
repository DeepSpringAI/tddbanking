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
| `@quarantine` + `@quarantine-until:<YYYY-MM-DD>` | Known flaky. The bare tag is what the gate filters on; the companion carries the deadline. Must be fixed or deleted by that date. |
| `@priority:high\|medium\|low` | Drives what `/tddbanking:implement` picks next. |
| `@from-crawl` `@from-bug:<id>` `@from-story:<id>` | Which discovery modality found it. |
| `@known-defect` + `@defect-change:<name>` | The bank proved a real bug and it is being fixed under that change. Excluded from the `@smoke` gate so it does not block unrelated work, but kept in the full run — the day it goes green is the day the fix landed. Never use it to silence a failure nobody is fixing. |
| `@blocked` + a `# blocked:` comment | The scenario's preconditions cannot be produced from any fixture. Excluded from turn 2's work list; turn 4 files the missing fixture as work. The comment names the fixture as a task, not "needs more data". |
| `@gap-suspected` | The behavior was promised somewhere but appears unbuilt. Route it to `/tddbanking:file`. **But if it is also reachable, implement it anyway** — a failing test proves the gap far better than a document comparison, and turns a suspicion into a finding. Only an unreachable one is excluded from turn 2. |
| `@from-backend:<path>` | Reserved: a backend test asserting the same behavior. |

**A tag you filter on must be bare.** Cucumber tag expressions match whole tags, so
`not @quarantine` does **not** match `@quarantine:2026-09-01` — the filter silently does
nothing and the scenario runs anyway. Anything the gate excludes therefore comes in pairs: a
bare tag to filter on, and a companion tag carrying the parameter. That is why the table above
reads `@quarantine` + `@quarantine-until:<date>` rather than one combined tag.

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
- **Quarantine has a deadline.** `@quarantine-until:<date>` past its date is reported by
  `/tddbanking:status` as debt. Fix it or delete it — a permanently quarantined test is a lie.
- **Tier the suite.** `@smoke` stays fast enough to gate every PR. The full bank can be
  slower and run on a schedule.

## The four-turn loop

The loop is four turns, each ending deliberately. It does not restart itself.

```
init  (once, outside the loop)
  │
  ├─ turn 1  discover   find everything, probe reachability, report      ─┐ ends
  ├─ turn 2  implement  take EVERY reachable draft live                  ─┤ ends
  ├─ turn 3  verify     run everything, triage every failure             ─┤ ends
  └─ turn 4  file       every finding becomes an OpenSpec proposal       ─┘ LOOP ENDS
                                                                            │
                        ordinary development against those proposals  ◄─────┘
```

Turn 4 is terminal. After it, the user implements the changes; a new turn 1 happens **only**
when they explicitly ask for one. Rediscovering the same gaps against unchanged code just
reproduces the same bank.

**Each turn's contract is completeness, not selection.** Turn 2 implements every reachable
draft; turn 3 triages every failure; turn 4 files every finding. This is why no turn ever
recommends "what to do next" within its own scope: a ranked shortlist reads as permission to
stop early, and a bank abandoned part-way is worth roughly nothing. Ranking still happens, but
inside a turn, as scheduling.

**Turns fan out.** Cost is not the constraint; completeness is. Discovery runs a scout per
modality plus an extractor per document class plus a reachability probe per candidate, all in
parallel. Implementation runs one agent per capability, each in **its own worktree**, because
they all write code. Verification shards by capability with **a distinct port per shard**.

Only `/tddbanking:file` needs the OpenSpec CLI. Everything else runs on a repository that has
never heard of it.

## Coverage is computed, never estimated

```
node ${CLAUDE_PLUGIN_ROOT}/scripts/bank-stats.mjs
```

Every command reports through that script. Do not improvise a regex over the feature files:
a comment line between a scenario's tag block and its `Scenario:` keyword is legal Gherkin and
is easy to miss, and an under-reported coverage number is worse than no number. The script is
tested against exactly that case.

## Page Objects are constructed in steps, not registered

`steps/fixtures.ts` holds `createBdd(test)` and nothing else. Step definitions build their own
Page Objects from `page`.

A shared fixture registry is a single file that every parallel implementer must edit, so it
turns every merge into a conflict and serialises the one turn that most needs to fan out. The
cost is one line per step file; the benefit is that fifteen capabilities can be implemented at
once.
