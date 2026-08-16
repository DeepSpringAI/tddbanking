# Design

Why tddbanking is shaped the way it is. The README says what it does; this says why.

## The problem

Backend unit tests get written, because the people writing the code write them as they go.
What does not get written is proof that a real person can accomplish anything in a browser.
That gap is not a tooling gap — Playwright exists — it is a **knowledge gap**: nobody has an
inventory of what a user should be able to do, so nobody can say what is untested.

tddbanking makes that inventory the primary artifact and treats tests as its implementation.

## Why the inventory lives in Gherkin

A user story written Given/When/Then *is* a Gherkin scenario minus its step definitions. So
the aspirational inventory and the executable suite can share one format and one file, with a
`@draft` tag marking the frontier between them.

The alternatives were worse:

- **A separate coverage spreadsheet or ledger file** drifts from the tests within a week.
  Anything hand-maintained alongside a corpus that changes daily becomes fiction.
- **Drafts in a separate directory** works, and is the fallback if the tag approach proves
  annoying, but it splits a capability across two places and makes promotion a file move
  instead of a one-line diff.

Deriving coverage by parsing tags means the corpus cannot disagree with the report.

## Why `--tags "not @draft"` and not a config option

`bddgen` supports Cucumber tag expressions at generation time. Drafts have no step
definitions, so they must be excluded *before* generation or they surface as undefined-step
errors.

The cost is a real footgun: any bare `bddgen` invocation breaks the run. That is why
`/tddbanking:init` bakes the flag into `package.json` scripts and the skill states that
nothing should ever call `bddgen` directly. Closing the footgun by construction was the
reason to scaffold the whole harness rather than assume an existing one.

## Why a green first run is a success

Classic TDD requires red before green. Applied literally to an existing app, that rule is
nonsense: you would have to break working software to write a test for it.

So the loop distinguishes two modes by outcome rather than by declaration:

- **Backfill** — the behavior is supposed to work. Green means coverage gained; red means a
  defect was discovered.
- **Drive** — the behavior does not exist yet. Red is mandatory, and the `tdd` skill's rules
  govern the development that follows.

You do not declare the mode; running the test reveals it. What matters is routing the outcome
honestly, which is why the loop forbids editing an assertion to match observed behavior. That
single prohibition is what separates a bank from a screenshot of current behavior.

## Why triage is a first-class component

A red e2e test means one of three unrelated things — the app is broken, the test is
unreliable, or the world changed on purpose. Teams abandon browser suites not because the
tests are hard to write but because failures are expensive to interpret, and the cheapest
interpretation ("must be flaky, re-run it") destroys the suite's value silently.

Making triage a mandatory agent with a fixed procedure and a documented bias toward `defect`
converts the ambiguity into a decision with a citation attached.

## Why discovery is plural

Each modality is structurally blind to what the others find:

- crawling the app finds capabilities nobody documented, and cannot find promised features
  that were never built
- reading stories finds intent, and cannot find the error states nobody specified
- mining defects finds what actually broke, and cannot find anything that has not broken yet

Running them as parallel, mutually blind agents is what makes the union larger than any one
of them. The evidence rule is the counterweight: an LLM asked to imagine user scenarios will
happily produce plausible ones for features that do not exist, and a single invented scenario
costs more trust than ten real ones earn.

## Where OpenSpec sits

The bank is the source of truth for *what should work*. OpenSpec is the mechanism for
*addressing what does not*. That makes it a downstream consumer, needed only by
`/tddbanking:file`, not a dependency of the bank itself.

Findings transfer into OpenSpec cheaply. A failing scenario is already a statement of required
behavior, so the reasoning transfers whole; only the syntax is reshaped, and `/tddbanking:file`
carries the mapping (including OpenSpec's four-hashtag `#### Scenario:` rule, which fails
silently if you get it wrong). The bank and the change reference each other, so the spec
records how it will be proven and the bank records what is being fixed.

## Division of labour between the testing tools

| Tool | Job | Output |
|---|---|---|
| `webapp-testing` (Python, ad hoc) | Exploration: crawl, screenshot, find real locators | Throwaway |
| playwright-bdd (TypeScript) | Durable regression: the bank | Committed |
| `tdd` skill | Test quality in turn 2; red-before-green in drive mode | Process |
| OpenSpec | Formalizing findings into changes | Proposals |

The apparent language conflict between the first two is not one: they do different jobs.
Nothing from exploration is ever committed.

## Locked decisions

1. The bank lives **inside each app repo** and runs in its CI. A detached QA project drifts
   and becomes someone else's problem — the exact failure this exists to escape.
2. Discovery ships **app-crawl, defect-driven, story-driven**. The `@from-backend:` tag is
   reserved so a backend-test-driven modality can be added without a redesign.
3. **OpenSpec is required only by `/tddbanking:file`.**
4. **`/tddbanking:init` scaffolds fully**, because the tag footgun has to be closed by
   construction.
5. **No hooks in v1.** The loop is prompt-level guidance. Enforcement hooks — a `Stop` hook
   running the smoke suite, or a check that no scenario's assertion changed in a commit that
   also changed app code — would make the gates mechanical, but they run on other people's
   machines and belong behind an opt-in once the workflow has proven itself.

---

# v0.2.0 — what the first real run changed

v0.1.0 was designed and then trialled. v0.2.0 is what the trial and the first production run
actually taught, which was mostly that the design was over-reasoned relative to how much it
had been executed.

## Why four turns, and why no turn ranks its own work

v0.1.0 had six commands and an `audit` that ranked drafts by priority. Used in anger, that
produced 8 implemented scenarios out of 58 and a strong feeling of completion. The ranking was
the cause: a shortlist of "what to implement next" reads as sanction to stop after the top few,
and there is never a natural moment to come back.

So each turn's contract is now completeness — every reachable draft, every failure, every
finding — and no turn recommends a subset within its own scope. Ranking still exists as
scheduling inside turn 2, but it is not shown, because showing it is what caused the problem.

The turns end deliberately rather than chaining, so a human sees each result before the next
begins, and turn 4 is terminal. A loop that restarts itself would rediscover the same gaps
against unchanged code and produce the same bank.

## Why reachability is probed at discovery

25% of the scenarios attempted in the first run turned out to be unimplementable: no fixture
could produce their preconditions. Each was discovered separately, expensively, after a Page
Object and step definitions had already been written.

Nothing in the design asked "can this state be reached?", so the bank accumulated scenarios
that looked ranked and ready and were not. `reachability-probe` asks it once, in parallel, for
every candidate, before anything is banked. The `MISSING` field is phrased as a task because
its reader is either a human seeding a fixture or turn 4 filing the work — and because one
fixture addition often unblocks several scenarios at once.

The probe is biased toward `reachable` on uncertainty. A wrongly blocked scenario is silently
dropped from the work list and never revisited; a wrongly reachable one fails loudly in turn 2
and gets corrected. Prefer the visible failure.

## Why the evidence rule needed instrumentation, not tightening

The rule dropped zero candidates across three modalities, and that number was uninterpretable:
scouts were told "if you cannot cite evidence, do not return the scenario", so every drop
happened inside an agent and was never reported. Zero observed drops could not be
distinguished from a rule doing nothing at all.

Scouts now report `CONSIDERED / RETURNED / DROPPED` with a reason per drop, and "evidence" is
defined as a verifiable locator — `file:line`, a commit SHA, or a route plus an observed
control — rather than a gesture at an area. If the drop rate is still zero, that is now a
finding rather than a silence.

## Why story-driven split in two

It produced the fewest scenarios and found the deepest issue: a booking gate that four
documents describe and one line of code contradicts. That is a different kind of defect from
anything a crawl can find, because there is nothing to crawl — the behaviour was never built.

So the modality is now two stages. `promise-extractor` runs once per document class, so nobody
skims six kinds of document in one pass. `promise-auditor` then checks each promise against
the code and returns `implemented` / `contradicted` / `absent`, biased toward `contradicted`,
because a promise wrongly cleared is a gap nobody looks at again.

It deliberately does not resolve disagreements by deciding the documentation is stale. That is
often true and always a product decision.

## Why coverage is a tested script

The v0.1.0 commands instructed the model to compute coverage by parsing tags. Doing that by
hand miscounted a real bank — 57 scenarios instead of 58, 6 live instead of 7 — because a
comment line between a scenario's tag block and its `Scenario:` keyword is legal Gherkin and
easy to miss.

Coverage is the number the entire model rests on, and it failed silently in the direction of
looking worse than reality. `scripts/bank-stats.mjs` is now the only place it is computed, with
a test fixture containing exactly that case.

## Why Page Objects moved into step definitions

A shared `fixtures.ts` registry is a single file that every implementer must edit. With one
agent per capability running in parallel worktrees, that is a guaranteed conflict on the one
turn that most needs to fan out. Steps now construct their own Page Objects from `page`. The
cost is a line per step file; the benefit is fifteen capabilities implemented at once.


## v0.2.2 — wiring the `tdd` skill in for real

Through v0.2.1 the `tdd` skill was named in this document and nowhere else. No command and no
agent ever told anyone to read it. The ideas had been absorbed — backfill versus drive, never
edit an assertion to match the application — which is precisely why the omission was invisible:
the loop looked as though it had covered them.

Two things were genuinely missing.

**Turn 2 had no standard for test quality.** The skill's *implementation-coupled* anti-pattern
names verifying "through a side channel (querying the database instead of using the interface)".
That is not hypothetical here: several steps in the first production bank assert a browser
scenario by reading the API, which passes while the screen is broken. Turn 2 now defers to the
skill, and says plainly that the API is for establishing preconditions, not for observing
outcomes.

**Turn 4 handed off into silence.** The loop filed a change and stopped, saying nothing about
how the work should be done — which is exactly where red-green belongs, and the one place the
original premise wanted TDD. The handoff now names the skill and points out that the red half
is already written: the failing scenario is the acceptance test, and the job is to make it green
without touching the assertion.

The skill also calls horizontal slicing an anti-pattern, and this loop resembles one: all
scenarios banked, then all tests written. `SKILL.md` states where that objection lands and where
it does not, rather than pretending the tension is absent. In backfill mode there is no
implementation to slice and completeness is the point; the objection bites at *imagined*
behavior, which is what the evidence rule and reachability probing exist to prevent.
