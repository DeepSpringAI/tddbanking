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

---

# v0.4.0 — the loop ends in working code

## Why there is a fifth turn

Through v0.3 the loop ended at turn 4 with a pile of proposals. That was defensible — filing is a
clean boundary, and this plugin does not own the codebase it audits — but it left the most
valuable half of the premise unclaimed. Every filed change already ships its failing scenario,
and that scenario *is* the red half of red-green, written down and agreed. Stopping there throws
away the one artifact that makes test-first development cheap.

Turn 5 takes each change to green without touching the assertion. The `@known-defect` tag coming
off is the definition of done, so the test that proves the fix is the same test that proved the
bug. It is the only turn that writes application code, so it confirms scope before it starts and
works one worktree per change.

The loop still ends deliberately. Turn 5 is terminal and nothing restarts itself.

## Why every external skill is invoked by name

A diagnostic put the odds that a turn-2 agent actually loaded the `tdd` skill at about one in
three. The mechanism was never at fault — `Skill(tdd)` resolves first try, and subagents do get
the skill listing. The prompting defeated it, in three compounding ways, and the largest was
self-inflicted.

"If it is available" reads as permission to skip, especially beside a fully resolved path in the
same sentence. The agent body **paraphrased the skill's operative lesson**, so an agent handed
the conclusion had no reason to fetch the source. And the skill describes itself as being about
test-first development while the agent is told it is backfilling and that a green first run is
not a violation — so it reads as not applying.

Naming the mechanism, pre-empting that task-shape objection, and moving every paraphrase into an
explicit "if the skill is missing" fallback took compliance to roughly 0.8–0.9. **Paraphrase is
the dominant suppressor**, and that is the part worth carrying elsewhere: restating a rule
accurately is precisely what stops anyone reading it.

The same disease was everywhere. `file.md` said "invoke the `openspec-propose` skill" with no
mechanism named, and the acceptance test duly hand-wrote all six change artifacts instead of
calling it. Turn 4 now defers the artifact format to `openspec instructions` rather than to a
table here that ages.

## Why compliance has to be reported, not assumed

Only the absence case had to be reported, so an agent that quietly skipped a skill produced
output byte-identical to one that loaded it. A regression could not be detected without re-running
the diagnostic by hand.

Every skill-invoking agent now returns a required `SKILLS:` line saying which route it took. An
agent that must report the fact is also materially more likely to perform it — and without that
line, the turn-5 finding below could not have been seen at all.

## v0.4.1 — a source is an artifact, not a file type

"One extractor per document class" let two agents read different files of the same OpenSpec
change and then appear to corroborate each other. On a 12-agent run, 52 of 74 corroborations were
that artifact — 70% of the total, and roughly 148k tokens of duplicated reading.

A source is now defined as **one artifact that speaks with one voice**, not one file type, and
splitting an artifact across agents is named as manufacturing false confidence rather than saving
time. Corroboration is reported per pair, and any pair whose members share a modality is flagged
as probably-one-source.

That reporting change exposed a bug in the first attempt at it: keying pairs by tag prefix
collapses two `@from-story` sources into one, which would have made the very case above
invisible. Pairs are keyed by the full source tag. This is the same lesson as counting coverage —
the convenient key is the one that hides the failure you built the metric for.

**Novelty is counted separately from volume**, because they turned out to be inversely
correlated. By volume the app-crawl modality ranked last, while producing an entire authorization
cluster with 17 of its 18 findings predicted by no document. Only volume was being measured.

Coverage prints `52 live / 58 banked (90%)` rather than a bare percentage. After a discovery
turn, `COVERAGE: 0%` reads as failure when it means nothing has been implemented yet — the same
discouragement the ranked queue used to cause.

## v0.4.2 — pinning what we paraphrase

A missing or renamed skill already fails loudly, through the `SKILLS: MISSING` line and turn 5's
hard stop. The unguarded case is the quiet one: **a skill that loads perfectly while a rule
inside it has changed**, leaving our fallback paraphrase describing something nobody says any
more. Nothing is missing, so no missing-skill check can fire.

`upstream-skills.json` pins each skill by content hash, together with the rules this plugin
characterises and every file that restates them, so drift names its own remediation.

Verifying the pin immediately found drift, and reading it was the point: upstream changed "use
the `/codebase-design` skill" to "call the Skill tool with `codebase-design`" — the same fix this
plugin made, for the same reason, touching no rule we describe. It is recorded as a
known-equivalent hash *with the diff explained*. That list is a record that someone read the
diff, not a way to mute the check.

**Deliberately not vendored.** A copy stops receiving its author's improvements and becomes a
fork nobody maintains, which defeats the reason for building on it.

## v0.4.3 — what parallel development actually costs

Turn 5's first real run took six filed changes to green in parallel worktrees, 52 pass / 6 fail
to 58 pass / 0 fail. Most of what it taught is about parallelism, not about testing.

**A worktree isolates files, not the running app.** Each developer needs its own instance and
port, and agents did not know to check they owned theirs. A leftover process — from a sibling, or
from an earlier attempt of their own that died — holds the port; the new server falls back
silently and exits on `EADDRINUSE` while the old one keeps serving. One run was nearly
invalidated that way.

**Orphan cleanup by directory match is not safe**, and proving it took down two live agents
mid-run. A directory does not tell you whether an agent is still working. Kill only processes
belonging to agents known to have finished, and ask a running agent to restart its own server
rather than doing it for them.

**Transient failures cluster.** Four of six agents died on 529s in a single dispatch. A killed
agent leaves a worktree and branch to reuse rather than recreate, and leaves servers holding its
ports — so retry in smaller batches.

And the finding only the `SKILLS:` line could have surfaced: **project-scoped skills are not
registered for subagents.** The `openspec-*` skills are generated per project into
`.claude/skills/`, so every developer got "Unknown skill" and recovered by reading the file
verbatim. That route is now documented as expected rather than as a workaround.

## v0.4.4 — what a public repo needs

Everything above was written while the repository was private, which turns out to be a
distinguishable state. The scaffolding a stranger needs — CI on its own tests, a discoverable
test command, contribution and security policy — was absent, and the absence was invisible to
everyone who already knew how the thing worked.

Two of those are worth recording as design decisions rather than chores.

**Structural checks live in a test, not in `claude plugin validate`.** Validation covers the
marketplace manifest, is unavailable in CI, and does not parse frontmatter — only `claude plugin
tag` does. So an agent that loses its `description:` validates clean and shows up nameless in the
plugin list. `tests/manifests.test.mjs` covers what validation cannot, and now holds the single
source of truth for the version across four files.

**The turn count is asserted, because proofreading demonstrably failed at it.** v0.4.0 added a
fifth turn and four command files went on announcing "Turn N of 4" for three releases. The
costly instance was `init.md` telling every new adopter that the loop "ends at
`/tddbanking:file`" — so turn 5, the turn that fixes what the other four found, was invisible to
exactly the people who had just installed the plugin. That is the third time in this document
that a hand-maintained count drifted; the rule by now is that if a number appears in two places,
a test owns it.

## Field note — the loop is not a development mode

The first person to use this plugin alongside ordinary feature work reported that developing
*through* the loop took considerably longer than working with Claude Code directly, and concluded
the two should not be mixed. That is the right conclusion, and leaving people to discover it for
themselves is a documentation failure rather than a surprise.

Nothing in the five turns optimises for feature velocity, and this is not an oversight to be
tuned away. Parallel scouts exist because one search angle misses things. The evidence rule
exists because a scenario nobody can reproduce is worse than no scenario. Reachability probing
exists because banking the unbuildable wastes a turn. One worktree per change exists because
agents editing the same tree corrupt each other. Every one of those costs time and buys coverage
or confidence — which is the correct trade when you are trying to find what you cannot see, and
the wrong one when you already know what you are building.

Turn 5's scoping follows from the same reasoning, and now has field support. It develops filed
changes only, and each of those arrives with its failing scenario already written. That is the
condition under which test-first is cheap: the red half is done and agreed before anyone starts.
Point the same machinery at a feature with no scenario yet and you have paid for the apparatus
without receiving the thing it was buying.

The practical consequence, now in the README: build features normally, and reserve the loop for
discovery, banking, triage, and developing what it finds. The second consequence is that the bank
should grow on a schedule — coverage decays by default, because every feature that ships without
a scenario lowers it, so a bank expanded only when someone remembers falls behind the app by
construction.

---

# v0.5.0 — five things the design implied and did not implement

An assessment of a five-turn run against a client project found five capabilities this document
already assumes exist. Each of them had a concrete failure attached, which is why they are worth
recording together: they are not five features, they are one recurring shape. **The design named
a responsibility and then provided no mechanism, so each turn improvised one, and an improvised
mechanism is invisible to the next turn.**

## Why open decisions needed a file rather than better instructions

`promise-auditor` has said since v0.2.0 that a documentation-versus-code disagreement "is a
product decision and not yours — report the disagreement and let a human choose". That
instruction is right and it was unactionable: there was nowhere to report it *to*. The escalation
landed in a paragraph of an agent's report, which its caller summarised, which the user read
once. Two turns later the same disagreement was rediscovered and escalated again, because nothing
persisted.

`decisions.md` is that destination, and the reason it has a parser is the reason coverage has
one. A format each turn writes in its own shape is not a channel; it is six turns keeping
separate notes that happen to share a filename. `scripts/decisions.mjs` defines the format by
reading it, and reports three things that are work rather than commentary: a decision raised
twice while still open (nobody is reading the channel), an answered decision with scenarios still
parked on it (a standstill with the excuse removed), and a `@decision:` tag with no matching entry
(a scenario parked on a question that exists nowhere, which is parked forever).

It cross-checks against the bank for the same reason the corroboration counter keys pairs by full
source tag: the convenient version hides the failure you built the metric for. A ledger nobody
can connect to a scenario is a ledger that will quietly diverge from the work.

## Why blocking is scoped to the item, and why that had to be said out loud

On the run, one undecided pricing rule stopped a full round. Nothing in the design asked for
that; nothing in the design forbade it either, and in the absence of a rule "there is an open
question" reads as a property of the round rather than of three scenarios.

The bank already had the right shape and it was only being used for one case. `@blocked` parks a
single scenario for a missing fixture, is reported per scenario, and lets the round proceed —
precisely so that a work list never loses an item silently. `@needs-decision` + `@decision:D-n`
is the same mechanism for a different cause, and the causes are kept apart deliberately: blocked
needs a fixture built, undecided needs a person to choose, and conflating them loses the only
part anyone can act on.

The rule now appears at every scale — a scenario does not stop a capability, a change does not
stop its siblings, a finding does not stop turn 4 — because the failure was not about scenarios.
It was about a turn interpreting one item's obstacle as its own.

`implementable` excludes undecided scenarios, and that exclusion has a sharper justification than
the blocked one. A scenario whose *assertion* is the undecided part cannot be implemented without
inventing an expected value, which is the tautological test the `tdd` skill names: it will agree
with the code forever and can never disagree with it. Guessing is worse than parking.

## Why copy review is a discovery modality rather than a review checklist

A screen labelled a hand-entered value "Extracted". Nothing in the loop was looking at copy: the
crawl asks what a user can do, the auditor asks whether a documented rule is implemented, and
neither reads the label beside the answer.

Two things about that failure decided the shape of the fix.

**The labelling was inverted, not missing.** A present, wrong label survives every reader,
because there is nothing absent to notice, and it is a claim the user has no reason to doubt at
the exact moment they are deciding whether to trust the number under it. So the agent's procedure
is to trace what a claim is *about* to its source and compare — not to check that labels exist,
which is what already happened and found nothing.

**A copy defect is testable**, which is why this is a modality and not a review pass. The output
is banked, evidenced Gherkin like everything else, so the finding becomes a scenario that guards
the claim forever rather than a note in a report. `writing-scenarios.md` carries the rule that
makes that worth doing: assert the claim, not its presence. `toBeVisible()` on a lying label is
green in both worlds.

The scope is narrow on purpose — five kinds of checkable claim, and an explicit refusal of tone,
grammar and house voice. A copy reviewer that returns wording preferences is a reviewer whose
output stops being read, and then the true findings go unread with them.

## Why `status` reports CI wiring

The bank gated every pull request on that project while its entire unit suite was invoked by no
workflow. Months later somebody ran it, found four failures, and read them as accumulated
history. They were three days old, and they had been caused from inside this loop.

That is the part worth generalising. **A suite nothing runs does not merely go unread — it
silently reassigns blame.** Failures accumulate unobserved; whoever eventually runs it inherits
all of them at once; and a pile discovered together reads as rot rather than as regression. The
person who finds it has no way to tell which failures are theirs, so the cost lands on the one
person who was doing the right thing.

A plugin that installs a *gate* is exactly the tool that should ask this question, because
installing one is precisely when a repository's green tick starts meaning less than it appears
to. `scripts/ci-wiring.mjs` follows `npm run` chains through `package.json`, reads `on:` blocks
and `run:` steps, and names what nothing invokes — including Playwright projects, which are entry
points too and are easier to orphan than scripts.

It is a narrow scan rather than a YAML parse because this plugin ships no dependencies, and it
states its one limitation instead of hiding it: granularity is the workflow, not the step. "Run
by nothing at all" is exact; "runs on pull_request" is the workflow's claim.

Run against that same codebase on its current `main`, it found three things on a project already
audited twice: `test:e2e` invoked by no workflow, which reproduced an open finding from the wiring
alone rather than by reading the specs; two configured Playwright projects no CI command selects;
and `tsc --noEmit` running nowhere, which nobody had recorded — a TypeScript project with no type
check on any pull request.

The same output made the check better, which is the part worth recording. Three of its five loud
lines were noise: a report viewer that executes no tests, and the headed and interactive variants
of a suite it had already named once. **A command CI cannot run unattended is not a finding when
CI does not run it**, so watchers, headed runs, interactive runners and report viewers are no
longer counted as suites. This is the same discipline the copy reviewer's scope has, arrived at
from the other direction: a report that shouts about developer conveniences is a report that gets
skimmed, and the two real findings underneath are what go unread when it does.

## Why the scaffolded reset asserts, and why asserting the status was not enough

A `Before` hook fired `POST /api/test/reset` and never read the response. A new table with
foreign keys was added; the reset's hard-coded delete list was not updated; the endpoint returned
500; five scenarios passed against a half-deleted database. Nothing failed. A human reading the
seed file found it.

The plugin was silent on reset — `fixtures.ts` is documented as holding `createBdd(test)` and
nothing else, and nothing said how scenarios get clean state — so every adopter wrote their own,
and the natural one is fire-and-forget. Silence on the most load-bearing part of a bank's
isolation is a design decision by default.

`templates/steps/reset.ts` is built out of three things that failure taught.

**The failure mode is silent success, so anything that leaves the suite green is a non-fix.**
Every check fails the run. None warns.

**The diagnostic matters as much as the assertion.** "reset failed: 500" sends someone hunting;
the same 500 with "if a table was added recently it probably needs adding to the delete list in
<seed module> and to <reset handler>" is a two-minute fix. So the template carries that sentence
with the project's own paths in it, and `/tddbanking:init` is told that leaving the placeholders
is an unfinished step rather than a cosmetic one.

**Two lists maintained by memory is the actual defect.** A delete list that every migration must
remember to update will eventually not be updated — that is what a list maintained by memory
does. So the endpoint is required to *enumerate* the live schema and report the tables it found
alongside the ones it cleared, and the hook fails when they disagree. That check runs before
every scenario, which means it runs on the pull request that adds the migration rather than on
whoever trips over it three weeks later — provided the bank is wired into CI, which is what the
previous section is for. The two findings turn out to be the same finding.

The default is fail-closed: a reset that cannot prove it was complete refuses rather than
proceeding, because a partially-reset database must never present as ready. The downgrades exist
(`BANK_RESET_EXPECT=body`, `=status`) and are environment variables rather than edits, so
choosing one appears in a diff someone reviewed and `grep` finds every project that chose it.

## What was deliberately not built

**A fourth triage verdict.** "Undecided" is a real outcome and it is not a verdict. Three verdicts
with a documented bias is a decision procedure someone can follow; four is a menu, and the fourth
would have absorbed most of the `defect` cases, which is the direction the bias exists to prevent.
It is a `DECISION` line alongside the verdict instead.

**A migration-time hook checking the schema against the reset.** It would catch the defect
earlier, and it is somebody else's repository. This plugin does not own the adopting project's
migration tooling, and a hook that runs on other people's machines is the thing v1 deliberately
declined to ship. The runtime check gets most of the value at the pull request, which is early
enough to name the change that caused it.

**Anything that lets a turn answer its own open decision.** Every mechanism here is built so the
loop keeps moving *without* an answer. Nothing prompts the user mid-turn, because a loop that
blocks on a human is a loop that runs at human latency, and because the decision that gets made
to unblock an agent is the decision nobody thought about.
