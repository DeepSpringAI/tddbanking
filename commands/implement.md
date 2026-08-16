---
description: Turn 2 of 4 - take every reachable draft in the bank live
argument-hint: optional capability to limit to (default is everything)
---

**Turn 2 of the four-turn loop.** Read the `tddbanking` skill and
`${CLAUDE_PLUGIN_ROOT}/skills/tddbanking/writing-scenarios.md` before writing any test code.

**Load the `tdd` skill before writing any test code: invoke the Skill tool with `tdd`.** Do not
skip this on the grounds that turn 2 is backfill rather than test-first development. Its
red-before-green rules do not apply here — you are documenting behaviour that already exists —
but everything it says about *what makes a test worth keeping* applies in full, and that is the
part that decides whether this bank is an asset or 58 files of noise.

If the Skill tool has no `tdd`, say so explicitly in your report rather than continuing quietly.
It is a separate skill this plugin does not ship
([mattpocock/skills](https://github.com/mattpocock/skills)); without it you are working without
the standard this turn assumes, and the caller should know. Only in that case, apply these two
rules as a reduced substitute:

- **Never assert through a side channel.** Checking a browser scenario by reading the API is the
  implementation-coupled anti-pattern: it passes while the screen is broken. The API establishes
  preconditions; the interface is where outcomes are observed.
- **Never take an expected value from the running application.** It comes from the scenario and
  the document the scenario cites, or the test is tautological and can never disagree with the
  code.

**The contract of this turn is completeness.** Every implementable draft goes live, or the
turn has failed and you say so. There is no "the most important ones". Partial implementation
is the failure mode this structure exists to prevent.

Scope: $ARGUMENTS — if empty, the whole bank.

## 1. Establish the work list

```
node ${CLAUDE_PLUGIN_ROOT}/scripts/bank-stats.mjs --json
```

The work list is every scenario that is `@draft`, **not** `@blocked`, and **not**
`@gap-suspected` — the `implementable` count. Print that number. It is what you are
accountable for at the end of the turn.

If it is zero, say so and hand to turn 3.

## 2. Fan out by capability, one worktree each

Dispatch one **`capability-implementer`** agent per capability with implementable drafts, all
at once, each with `isolation: "worktree"`. They write code, so they need isolation or they
will clobber one another.

Give each agent: its capability, the scenarios it owns, the app's base URL and start command,
the existing Page Object and step conventions, and **an explicit instruction to load the `tdd`
skill via the Skill tool**. Do not assume the agent will find it on its own — a subagent that is
merely told a skill exists usually proceeds without it.

**A worktree isolates files, not the running application.** Implementers have to run their
scenarios, and a shared app instance means they reset and mutate each other's state — which
surfaces as failures that belong to no one. Give each agent **its own app instance on its own
port**, and say so explicitly: many apps hardcode a port or a proxy target, so the agent may
need to patch its worktree's config (that patch is local scaffolding and must not be
committed). If per-instance ports are genuinely impossible, run the implementers serially
rather than pretending otherwise.

Tell each agent to **stop only its own processes, by PID**. A broad `pkill -f <server>` in one
worktree kills every sibling's app, and the resulting burst of connection failures looks like
real test failures. This happened repeatedly in the first production run.

**Page Objects are constructed inside step definitions, not registered in a shared fixtures
file.** A shared fixture registry is a single file every parallel worker must edit, and it
turns every merge into a conflict. `steps/fixtures.ts` holds only `createBdd(test)`.

## 3. Merge

Bring each worktree's work back in turn. File conflicts should be rare by construction; where
two capabilities genuinely need the same Page Object, keep one and have both step files
construct it.

**Run `npx bddgen --tags "not @draft"` after every merge, not just at the end.** It is the only
check for the two failures that worktrees do not prevent:

- **Colliding step text.** Two implementers cannot see each other's steps, so both may define
  `Then the upload is refused` for different artefacts. Generation refuses the ambiguity;
  rename each to name its artefact, in both the step and the scenario.
- **Broken merges of additive conflicts.** When two agents add different methods to one class,
  "keep both sides" is usually right — but if a hunk boundary falls inside a method, the
  resolution silently loses a brace. Generation catches it; a file-level conflict check does
  not.

If the merged bank does not generate, nothing runs at all: a single unknown fixture or
ambiguous step aborts collection for every scenario, not just the one at fault.

## 4. Record outcomes honestly

Each scenario ends in exactly one state, and the routing matters more than the count:

- **green** — backfill succeeded. The behaviour works and is now guarded. This is a success,
  not a TDD violation; you are documenting reality, not driving it.
- **red** — leave it live and failing. **Do not triage here and do not fix the application.**
  Turn 3 owns triage; guessing at it now produces unverified findings.
- **blocked** — the scenario turned out to need a fixture that does not exist. Revert it to
  `@draft`, add `@blocked` and a `# blocked:` comment naming exactly what is missing, and
  count it. Do not manufacture the state by driving the interface through a long setup path:
  that tests the setup more than the behaviour, and it is slow and brittle forever after.

**Never edit a scenario's assertion to match what the application does.** That converts a
discovered defect into permanent blindness, and it is the single thing this whole system
exists to prevent.

## 5. Report and stop

Print `node ${CLAUDE_PLUGIN_ROOT}/scripts/bank-stats.mjs` and state plainly: implementable at
the start, live at the end, and newly blocked. If those do not reconcile, say which scenarios
are unaccounted for.

End by telling the user the next step is `/tddbanking:verify`.
