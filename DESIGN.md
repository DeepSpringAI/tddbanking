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
| `tdd` skill | Red-before-green discipline in drive mode | Process |
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
