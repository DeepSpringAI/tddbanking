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

## The loop

```
init → discover → audit → implement → verify → file
              ↑                                  │
              └────────── the bank grows ────────┘
```

| Command | What it does |
|---|---|
| `/tddbanking:init` | One-time scaffold: playwright-bdd, config, scripts, Page Object base |
| `/tddbanking:discover` | Finds behaviors no scenario covers, adds them as drafts |
| `/tddbanking:audit` | Coverage by capability, what to implement next, health debt |
| `/tddbanking:implement` | Draft → Page Object + thin steps → running test |
| `/tddbanking:verify` | Runs the bank, triages every failure |
| `/tddbanking:file` | Turns defects into OpenSpec change proposals |

Only `/tddbanking:file` needs the [OpenSpec](https://github.com/Fission-AI/OpenSpec) CLI.
Everything else works on a repo that has never heard of it.

## Discovery finds what you didn't write down

`/tddbanking:discover` dispatches one **scenario-scout** agent per modality, in parallel. Each
is blind to the others by design — that is why they find different things.

- **app-crawl** — drives the running app. Every route, form, control and error state is a
  capability a user has. Finds what nobody documented.
- **defect-driven** — mines past bugs, hotfix commits and incidents into `@regression`
  scenarios. Highest value per row: a bug that happened once is likelier to recur than one
  that never has.
- **story-driven** — reads PRDs, tickets and README claims. Finds promised behavior that may
  never have been built.

**Every scenario cites evidence** — a route, a control, a commit, a ticket. No evidence, no
scenario. A bank containing invented scenarios stops being trusted, and that is unrecoverable.

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
| `flake` | The test is unreliable | Fix it, or `@quarantine:<date>` with a real deadline |
| `stale` | The app changed on purpose | Update the scenario, citing the change |

It is biased toward `defect`: calling a real bug "stale" edits away the finding permanently,
while the reverse costs one human minute.

## Designed against the three ways test banks die

1. **Bloat and flake decay.** Growth is the goal, but a naive version becomes a 40-minute
   flaky suite nobody trusts. Countered by dedup-on-add, `@quarantine` deadlines that
   `/tddbanking:audit` reports as debt, and a fast `@smoke` tier that gates PRs.
2. **Gherkin theater.** `Given I click the button` is Playwright with extra ceremony.
   Countered by declarative scenarios and zero locators outside Page Objects.
3. **The bank as someone else's problem.** It lives in the app repo and runs on every PR, not
   in a detached QA project that drifts.

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
templates/   playwright.config.ts, BasePage, fixtures, example feature
```

See [DESIGN.md](DESIGN.md) for the reasoning behind the model.

## Status

v0.1.0. The loop is prompt-level guidance — no hooks run on your machine.

## License

MIT. OpenSpec is MIT; `webapp-testing` is Apache-2.0. Neither is redistributed here.
