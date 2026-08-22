# tddbanking

[![test](https://github.com/DeepSpringAI/tddbanking/actions/workflows/test.yml/badge.svg)](https://github.com/DeepSpringAI/tddbanking/actions/workflows/test.yml)
[![licence: MIT](https://img.shields.io/badge/licence-MIT-blue.svg)](LICENSE)

**Your team writes backend tests. Nobody tests what a user actually does in a browser.**

tddbanking is a Claude Code plugin that closes that gap and keeps it closed. Point it at a web
app and it finds the user-facing behaviour nothing covers, writes browser tests for all of it,
runs them, and hands whatever is broken to a spec tool as ready-to-implement change proposals.

Then you run it again next month and it finds what your new features left untested.

---

## It doesn't invent any of this — it wires together three things that already work

That is the whole idea. Each of these is good on its own, and each solves one part of the
problem. The plugin's contribution is the handoffs between them, and the discipline to run every step
instead of stopping after the interesting one. Each credit below says where in
[the cycle](#the-cycle) it does its work.

**[The `tdd` skill](https://github.com/mattpocock/skills) — by Matt Pocock** · *invoked at steps 2 and 5*
The red/green discipline, and the reason the tests are worth keeping. It defines what a good
test is, where tests belong (*seams* — the public boundary you observe behaviour at), and the
anti-patterns that quietly ruin a suite: tests coupled to implementation, tests that recompute
their own expected value, tests written in bulk against imagined behaviour. tddbanking defers to
it rather than restating it. Using it visibly improves what Claude produces; that is why it is
here.

**[OpenSpec](https://github.com/Fission-AI/OpenSpec)** · *invoked at steps 4 and 5*
Turns a rough requirement into a real specification — proposal, delta specs, design, and a
task-by-task implementation plan. In practice it plans a change better than the built-in
planning modes do. tddbanking uses it at the end: every proven bug leaves the loop as an
OpenSpec change, not as a bug report someone has to re-specify.

**[playwright-bdd](https://github.com/vitalets/playwright-bdd) — by Vitaliy Potapov** · *the format, at steps 2, 3 and 5*
Gherkin feature files compiled into Playwright specs. Thin step definitions, locators in Page
Objects. It is what makes a browser test readable as a requirement instead of a script, which
matters because these tests double as the acceptance criteria handed to OpenSpec.
The conventions follow [TestDino's playwright-bdd guide](https://testdino.com/blog/playwright-bdd).

If you already use any of these, this plugin is the sequencing you were going to write yourself.

---

## The cycle

Five turns. Each ends deliberately so you can look at the result before the next begins.

```
1  discover   what should a user be able to do, and what covers it today?
2  implement  write browser tests for everything that has none      ── tdd: what a good test is
3  verify     run them all; triage every failure
4  file       turn each proven bug into an OpenSpec change proposal
5  develop    take every change to green, test-first                ── tdd: red → green
                                                                       ← loop ends
```

**1. Discover.** Reads your *existing* test suites first, so it looks for what is untested
rather than what is merely unbanked. Then it hunts for uncovered behaviour three ways at once
(below), checks each candidate is actually *reachable* — that a test could really set it up —
and banks what it finds.

**2. Implement.** Writes Page Objects and step definitions for **everything** reachable, one
capability per agent, in parallel. Not a prioritised subset: the whole list. This is the step
teams skip, and skipping it is how a test suite ends up 12% done and abandoned.

This is where the **`tdd` skill** does its first job. It is the standard for whether these tests
are worth keeping — tests observed at a real boundary, expected values taken from the scenario
rather than from whatever the app currently returns, and no asserting through a side channel.
That last one is not theoretical: checking a browser scenario by reading the API passes happily
while the screen is broken.

**3. Verify.** Runs the bank and gives every failure a verdict — **defect**, **flake**, or
**stale scenario** — with a citation. A red browser test means three unrelated things, and
"probably flaky, re-run it" is how suites die.

**4. File.** Every proven defect becomes an OpenSpec change proposal, grouped by cause. It
invokes OpenSpec to produce them rather than writing the artifacts by hand.

**5. Develop — and this is the point of all of it.** Each proposal carries a failing browser
scenario, so **the red half of red-green is already written, evidenced and agreed.** Turn 5
invokes the `tdd` skill and works each change to green without touching the assertion. When a
scenario passes, its `@known-defect` tag comes off — the bank said what was broken and now says
it is fixed.

This is the only turn that writes application code, so it asks you to confirm scope first and
works in an isolated worktree per change.

Run it again after your next feature and it picks up from the bank it already built.

---

## Three ways it finds what you're missing

Run in parallel, each blind to the others — which is why the union is bigger than any of them.
In the first real run, **88% of scenarios came from exactly one mode**.

**App crawl** — drives your running app: every route, form, control, error state and permission
boundary. Finds what nobody wrote down. This is the one that catches the app misbehaving in
front of you.

**Story-driven** — reads your README, PRDs, release notes, business rules and handoff docs,
extracts what they *promise*, then checks each promise against the code. Finds features that
were documented, agreed, and never actually built.

**Defect-driven** — mines your git history and issue tracker for bugs you already fixed and
turns each into a regression test. Expect the most scenarios and the fewest new findings — this
is insurance, not detection.

---

## What it found the first time we ran it

On a real pharma congress platform with an existing Playwright suite (59 tests) and full backend
coverage:

| | |
|---|---|
| Coverage | **12% → 90%** in one cycle (52 of 58 scenarios live) |
| Full run | 52 pass, 6 fail, 6.4 minutes |
| Outcome | **6 real defects**, filed as 6 OpenSpec changes |

The defects were not edge cases:

- **A doctor who declined disclosure consent was published by name.** The system classified her
  correctly as an aggregate disclosure — and the report printed her name next to her transfer of
  value anyway. Every non-consented HCP in every report, in a product whose entire purpose is
  regulatory disclosure.
- **A Compliance Officer could cancel approved nominations and create new ones.** Role checks
  gated *pages*; nothing gated *actions*, so the endpoints accepted anyone.
- **A documented approval gate did not exist.** Four documents promised bookings were only
  invitation-ready once registration, hotel and flight were confirmed. The code checked one
  unrelated flag — and the component statuses had no update path at all, so they could never be
  confirmed. Story-driven mode found this by reading the docs; no crawl could have.

It also found six scenarios that *cannot be tested* because the fixtures don't exist, and filed
those as work too — including that every seeded congress had a nomination deadline in the past,
so a demo of the product's core action would have failed.

---

## What it costs

The honest answer, measured from the run above rather than estimated. It is not cheap, and it
is front-loaded.

### Sitting idle: negligible

**~861 tokens** added to every session, whether you use it or not. That is the plugin's whole
descriptive surface — 6 commands and 7 agents. Installing it does not tax your normal work.

### One full cycle on a 58-scenario bank: ~2M tokens

Measured agent totals from that run:

| Turn | Agents | Tokens | Longest agent |
|---|---|---|---|
| 1 · discover | 3 scouts | 308k | 26 min (app crawl) |
| 1 · reachability | 5 probes | 585k | 12 min |
| 2 · implement | 6 implementers | 1.05M | 36 min |
| **subtotal** | **14 agents** | **1.95M** | |
| 3 · verify | 1 triage per failure | ~44k each | 5 min for the run itself |
| 4 · file | writing the proposals | ~50k | |

So **1.95M for the bank itself**, and about 2.2M if you delegate triage for all six failures.
That is roughly **34k tokens per scenario** banked, implemented and verified — and it bought 52
working browser tests and 6 real defects on an app that already had a passing test suite.

**Wall clock is far less than the sum, but not by as much as the agent count suggests.** A
second instrumented run measured **2.1×**, not the 12× its twelve agents imply — because a turn
is a chain of *dependent* stages (extract → audit → probe), and speedup is bounded by stage
depth, not by fan-out. Budget for that: adding agents within a stage buys throughput, not
latency.

### Where the money goes

**Turn 2 is over half of it.** Writing Page Objects and step definitions means reading real
components and driving a real browser, repeatedly. The two most expensive implementers (250k and
219k) were the ones with the most scenarios and the most app interaction.

**The app crawl is the priciest single scout** — 133k tokens and 26 minutes, because it actually
operates the application. It is also the mode that found two of the six defects by watching the
app misbehave, so it tends to earn its keep.

### The second cycle is much cheaper

The expensive part is building the bank, and you only do that once. On later runs:

- discovery dedups against the bank **and** your existing suites, so scouts return only what is
  genuinely new
- turn 2 implements only the new drafts — usually a handful after a feature, not 45
- turn 3 runs the whole bank for ~6 minutes of wall clock and almost no tokens, because running
  Playwright is not a model operation

Budget the first cycle as a one-off investment in coverage, and subsequent cycles as roughly
proportional to how much you shipped since the last one.

### Spending less

- **Scope it**: `/tddbanking:discover payments` runs the whole cycle against one capability.
- **Skip the crawl** if your app is hard to drive or your docs are good — story-driven and
  defect-driven cost about a third of it between them and need no running app.
- **Let turn 2 run long rather than wide** on a small bank; the parallel fan-out is what makes
  it fast, not what makes it cheap.

### Turn 5, run for real

The first full turn-5 run took a bank from 52 pass / 6 fail to **58 pass / 0 fail** — every
defect the loop had found, fixed, each proven by the scenario that found it.

| | |
|---|---|
| Changes developed | 6, in parallel worktrees |
| Bank before / after | 52 pass, 6 fail → **58 pass, 0 fail** |
| New defects found while fixing | 2, filed rather than absorbed |

What made it trustworthy was not the pass count but what the developers *refused* to do. One
changed a fixture outside its proposal's scope and said so with reasoning. One reported that its
permission allow-lists were an inference the spec never pinned. One refused to open a congress a
blocked scenario wanted opened, because a passing scenario asserted it was closed, and reported
the contradiction rather than picking a side. None edited a scenario to make its own work pass.

### A second run, on a codebase ~3× larger

| | |
|---|---|
| Turn 1 only | 12 agents, **1.51M tokens**, 784 tool calls |
| Wall clock | ~70 min (2.1× speedup from parallelism) |
| Produced | 176 scenarios, **15 defects** — 3 of them severe |

That is roughly **100k tokens per defect found**, which is the number most worth carrying into a
budgeting conversation. It scaled: 3× the codebase produced 3× the scenarios and 2.5× the
defects.

It also measured two things worth knowing before you spend. The evidence rule **dropped 51% of
candidates**, every drop justified — it is not a rubber stamp. And deduplication against the
existing suite dropped 35 more as already covered, which is the difference between finding what
is *untested* and finding what is merely *unbanked*.

### The caveat

These are numbers from **one run against one mid-sized app** — 15 capabilities, ~11 routes, 4
roles, an existing Playwright suite. A larger surface costs more, and an app that is awkward to
drive costs more again. Treat the shape as reliable and the absolute figures as an order of
magnitude.

---

## Install

```bash
/plugin marketplace add DeepSpringAI/tddbanking
/plugin install tddbanking@tddbanking
```

Then, in the repo of the app you want covered:

```bash
/tddbanking:init        # one-time: playwright-bdd, config, scripts, CI workflow
/tddbanking:discover    # turn 1 — it tells you what to run next
```

### What it needs

Node, and a web app you can run locally. Beyond that it depends on the three projects it is
built from — it **invokes** them, so they have to be installed. Turns 1–3 work without any of
them; the last two do not.

```bash
npm i -g @fission-ai/openspec        # the CLI
openspec init --tools claude         # once, in YOUR project
```

Note what the second command does, because it is easy to miss: **`openspec init` is what creates
the `openspec-*` skills**, generating them into that project's `.claude/skills/`. They are
project-scoped, not global — installing the CLI alone gives you no skills, and turns 4 and 5
will report them missing.

The **`tdd` skill** is needed by turn 5 and improves turn 2. It is a personal Claude Code skill
this plugin does not ship — get it from
[mattpocock/skills](https://github.com/mattpocock/skills) and put it in `~/.claude/skills/tdd/`.
Without it the loop still finds and files your bugs; it just stops before fixing them.

`webapp-testing` is used for app-crawl and for reproducing failures by hand. If it is missing,
the crawl drives Playwright directly.

**Turn 1 checks all four and tells you what is missing before you start**, rather than letting
you discover it four turns later.

### Keeping up with the skills it borrows from

This plugin paraphrases rules from skills it does not own — mostly inside "if the skill is
missing" fallbacks, but the characterisations in `SKILL.md` and `DESIGN.md` count too. Those can
go stale silently: a skill that loads perfectly while one of its rules has changed underneath is
a failure no missing-skill check can catch, because nothing is missing.

So the versions we describe are pinned by content hash in
[`upstream-skills.json`](upstream-skills.json), along with the specific rules we characterise
and every file that restates them:

```bash
node scripts/check-upstream.mjs              # is your installed skill the version we describe?
node scripts/check-upstream.mjs --upstream   # has the source itself moved on?
```

Drift is a prompt to re-read, not a fault. Most edits are cosmetic — the pin records one such
case already, where the `tdd` skill changed how it tells you to load a *different* skill without
touching any rule we describe. If a rule genuinely changed, the check names the files to update.

We deliberately do **not** vendor these skills. A copy stops receiving its author's improvements
and starts being a fork nobody maintains, and the point of building on them is that they are
better maintained than a snapshot would be.

**Before the crawl writes anything**, it asks you to confirm the target is disposable and its
outbound email is sandboxed. Crawling means *doing* things — submitting forms, cancelling
records. Point it at a seeded local instance, never staging.

---

## How the bank works

Scenarios live in Gherkin. Drafts (`@draft`, not yet implemented) and live tests share one
`.feature` file, so a file reads as the complete intent of a capability with the untested parts
visibly marked:

```gherkin
@capability:transfers
Feature: Money transfers

  @smoke
  Scenario: Transferring within balance moves the money
    When I transfer 50 EUR to "bob@example.com"
    Then my balance decreases by 50 EUR

  # evidence: /transfers form, submit stays enabled during POST /api/transfers
  @draft @from-crawl @priority:high
  Scenario: Submitting a transfer twice does not send the money twice
    When I submit a 50 EUR transfer twice in quick succession
    Then only one transfer is recorded
```

Coverage is `live / (live + draft)`, computed from the tags. **Promoting a scenario is deleting
one tag** — a one-line diff any reviewer can read.

**Every scenario cites evidence** — a route, a commit SHA, a `file:line`. No evidence, no
scenario. A bank containing invented tests stops being trusted, and that is unrecoverable.

Proven bugs are tagged `@known-defect` with the change that will fix them: they stay out of the
PR gate so they don't block unrelated work, while the full run keeps them visible. The day one
passes, the fix landed.

---

## Two things worth knowing

**A green test on the first run is a success, not a failure of TDD.** Your app already exists,
so most scenarios document behaviour that already works — that is coverage gained. A red one is
a bug you just found. What the loop never does is edit an assertion to match what the app
currently does; that converts a discovered defect into permanent blindness.

**No turn tells you what to do next within its own scope.** Earlier versions ranked drafts by
priority, and the first real run implemented 8 of 58 and felt finished. A shortlist reads as
permission to stop. Each turn's contract is now completeness.

---

## More

- [DESIGN.md](DESIGN.md) — why it is shaped this way, including where it deliberately disagrees
  with the `tdd` skill.
- [CONTRIBUTING.md](CONTRIBUTING.md) — how to run the tests, how to try a change against a real
  app, and four things that have bitten us.
- [SECURITY.md](SECURITY.md) — how to report privately, and the two turns that write to your app
  on purpose.
- Commands: `init`, then the five turns — `discover`, `implement`, `verify`, `file`, `develop` —
  plus read-only `status`.
- Nothing is vendored. All three upstream projects are referenced by name so they stay current.

## Licence

MIT. OpenSpec is MIT; playwright-bdd is MIT; `webapp-testing` is Apache-2.0; the `tdd` skill is
Matt Pocock's and states no licence — none of them are redistributed here.
