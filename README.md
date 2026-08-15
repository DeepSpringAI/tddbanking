# tddbanking

A Claude Code plugin that grows a **bank** of browser-verified user scenarios.

Backend unit tests are usually covered — coders write them as they go. What rots is the other
question: **does the thing actually work for a person in a browser?** tddbanking builds and
maintains the answer as an asset that only grows.

Tests are [playwright-bdd](https://github.com/vitalets/playwright-bdd) — Gherkin feature files
compiled by `bddgen` into Playwright specs, thin step definitions, locators in Page Objects.

## The idea

Two populations of scenarios, one corpus:

- **Draft** — a behavior a user should have. Tagged `@draft`. No steps yet.
- **Live** — implemented, running in a browser on every CI run.

```
coverage(capability) = live / (live + draft)
```

Growing the bank means moving scenarios from draft to live. Both live in the same
`.feature` file, so one file reads as the complete intent of a capability with the untested
parts visibly marked:

```gherkin
@capability:transfers
Feature: Money transfers

  Background:
    Given I am signed in as "alice@example.com"

  @smoke
  Scenario: Transferring within balance moves the money
    When I transfer 50 EUR to "bob@example.com"
    Then my balance decreases by 50 EUR

  # evidence: /transfers form, submit stays enabled during POST /api/transfers
  @draft @from-crawl @priority:high
  Scenario: Submitting a transfer twice does not send the money twice
    When I submit a 50 EUR transfer to "bob@example.com" twice in quick succession
    Then only one transfer is recorded
```

`bddgen --tags "not @draft"` compiles only the live ones, so drafts never break the run.
**Promoting a scenario is deleting one tag** — a one-line diff any reviewer can read.

There is no coverage spreadsheet. The feature corpus *is* the ledger; coverage is computed by
parsing tags, because a hand-maintained table drifts within a week.

## Install

```
/plugin marketplace add DeepSpringAI/tddbanking
/plugin install tddbanking@tddbanking
```

Then, in the repo of the app you want covered:

```
/tddbanking:init
```

That installs playwright-bdd, writes the config and scripts, and proves the scaffold green
before handing back.

## The loop is four turns, and it ends

```
init  (once)
  │
  ├─ 1  discover   find everything, probe reachability, report      ─┐ ends
  ├─ 2  implement  take EVERY reachable draft live                  ─┤ ends
  ├─ 3  verify     run everything, triage every failure             ─┤ ends
  └─ 4  file       every finding becomes an OpenSpec proposal       ─┘ LOOP ENDS
```

| Command | Contract |
|---|---|
| `/tddbanking:init` | One-time scaffold: playwright-bdd, config, scripts, CI workflow |
| `/tddbanking:discover` | Discover **and** probe reachability. Reports coverage |
| `/tddbanking:implement` | Take **every** reachable draft live — not a selection |
| `/tddbanking:verify` | Run and triage **everything** |
| `/tddbanking:file` | Every finding becomes a change proposal. **Terminal** |
| `/tddbanking:status` | Read-only coverage, safe between turns |

Turn 4 is the end. You then implement the proposals; a new turn 1 happens only when you ask,
because rediscovering the same gaps against unchanged code reproduces the same bank.

**No turn recommends what to do next within its own scope.** That is deliberate. A ranked
shortlist reads as permission to stop after the top few — which is exactly what happened the
first time this was used in anger, where 8 of 58 scenarios felt like completion. Each turn's
contract is now completeness: every reachable draft, every failure, every finding. Ranking
still happens, but inside a turn, as scheduling you never see.

**Turns fan out.** Discovery runs a scout per modality, an extractor per document class, and a
reachability probe per candidate — all at once. Implementation runs one agent per capability,
each in its own git worktree, because they all write code. Verification shards by capability
with a distinct port per shard.

Only `/tddbanking:file` needs the OpenSpec CLI.

## Discovery finds what you didn't write down

Turn 1 runs four kinds of agent in parallel. Each is blind to the others, which is why the
union is larger than any of them: in the first real run, **88% of scenarios came from exactly
one modality**.

- **app-crawl** — drives the running app: routes, forms, error states, permission boundaries.
  Highest yield for live misbehaviour; it watches the app do the wrong thing.
- **defect-driven** — mines fixed bugs into `@regression` scenarios. Expect the most
  scenarios and the fewest findings: those bugs are already fixed, so this is insurance
  against recurrence rather than detection.
- **promise-extractor** — one agent per document class (README, release notes, business
  rules, handoff plans, ADRs, tickets), read closely rather than skimmed together.
- **promise-auditor** — checks each extracted promise against the code and returns
  `implemented` / `contradicted` / `absent`.

That last pair is the sharpest tool here. It finds documented behaviour that was never built —
things no browser crawl can reach, because there is nothing to crawl. In the first real run it
found a gate that four documents describe and one line of code contradicts.

**Every scenario cites a verifiable locator** — `file:line`, a commit SHA, or a route plus an
observed control or response. Not a gesture at an area. Scouts report
`CONSIDERED / RETURNED / DROPPED` so the drop rate is visible; a rule whose drops are invisible
cannot be told apart from a rule that does nothing.

## Reachability is checked before anything is banked

A scenario nobody can set up looks like progress and is not.

Turn 1 probes every candidate against the actual fixtures — seed data, factories, the running
API, and conditional rendering that only appears for a subtype. Unreachable candidates are
banked as `@blocked` with a comment naming the missing fixture **as a task**, excluded from
turn 2's work list, and filed by turn 4 as fixture work.

This exists because the first real run discovered blocked scenarios one at a time during
implementation, at 25% of everything attempted. One seed addition often unblocks several
scenarios at once.

## A green first run is a success

The app usually already exists, so implementing a draft has two honest outcomes:

- **Green immediately** → backfill succeeded. The behavior works and is now guarded. This is
  a win, not a TDD violation — you are documenting reality, not driving it.
- **Red** → the bank found a defect. It becomes a finding, and `/tddbanking:file` turns it
  into an OpenSpec change. Development makes it green.

That second path is how the bank gives TDD its direction: **the bank says what is missing,
OpenSpec says how it will be addressed, then the work happens.**

The one thing the loop never does is edit a scenario's assertion to match what the app
currently does. That converts a discovered defect into permanent blindness.

## Every failure gets classified

A red browser test is ambiguous, and unresolved ambiguity is the most common reason teams
abandon an e2e suite. The **failure-triager** agent returns one of three verdicts:

| Verdict | Meaning | Response |
|---|---|---|
| `defect` | The app is wrong | File a finding |
| `flake` | The test is unreliable | Fix it, or `@quarantine` + `@quarantine-until:<date>` |
| `stale` | The app changed on purpose | Update the scenario, citing the change |

It is biased toward `defect`: calling a real bug "stale" edits away the finding permanently,
while the reverse costs one human minute.

## Designed against the three ways test banks die

1. **Bloat and flake decay.** Growth is the goal, but a naive version becomes a 40-minute
   flaky suite nobody trusts. Countered by dedup-on-add, `@quarantine` deadlines that
   `/tddbanking:status` reports as debt, and a fast `@smoke` tier that gates PRs.
2. **Gherkin theater.** `Given I click the button` is Playwright with extra ceremony.
   Countered by declarative scenarios and zero locators outside Page Objects.
3. **The bank as someone else's problem.** It lives in the app repo and runs on every PR —
   `/tddbanking:init` writes the workflow — not in a detached QA project that drifts.

## What it does not ship

The `openspec-*` skills are generated per project by the OpenSpec CLI and rewritten by
`openspec update`; `webapp-testing` is Anthropic's, Apache-2.0. Both are referenced by name,
never vendored. `webapp-testing` powers exploration and never produces a committed test —
throwaway Python reconnaissance in, durable TypeScript Gherkin out.

## Layout

```
commands/    init, discover, audit, implement, verify, file
skills/tddbanking/
  SKILL.md              the coverage model, tags, the two modes
  writing-scenarios.md  declarative Gherkin, thin steps, POM
  triage.md             defect vs flake vs stale
agents/      scenario-scout, browser-runner, failure-triager
templates/   playwright.config.ts, BasePage, fixtures, example feature,
             workflows/bank.yml (smoke on PRs, full bank nightly)
```

See [DESIGN.md](DESIGN.md) for the reasoning behind the model.

## Status

v0.1.0. The loop is prompt-level guidance — no hooks run on your machine.

### What has been verified

The whole loop was run against a real application — a pharma congress platform with an
existing Playwright suite (59 tests), two dev servers and role-based navigation:

- `init` merged into that existing config in 17 lines, and both suites still resolve
- three scouts returned **66 evidenced candidates** across 11 capabilities
- a scenario taken live went **red**, `failure-triager` classified it `defect` at high
  confidence after four isolated runs plus hand reproduction, and refused to call it stale
  because no commit or ticket justified the behavior
- the finding became an OpenSpec change that passes `openspec validate --strict`

That run is also where most of this plugin's guardrails come from — the crawl consent rules,
`--pass-with-no-tests`, per-project `testDir`, and the pinned tag vocabulary all exist
because the trial broke without them.

Untested: installation from GitHub end to end, and `verify` against a bank large enough for
suite runtime to matter.

## License

MIT. OpenSpec is MIT; `webapp-testing` is Apache-2.0. Neither is redistributed here.
