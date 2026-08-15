---
description: Turn 2 of 4 - take every reachable draft in the bank live
argument-hint: optional capability to limit to (default is everything)
---

**Turn 2 of the four-turn loop.** Read the `tddbanking` skill and
`${CLAUDE_PLUGIN_ROOT}/skills/tddbanking/writing-scenarios.md` before writing any test code.

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
and the existing Page Object and step conventions.

**Page Objects are constructed inside step definitions, not registered in a shared fixtures
file.** A shared fixture registry is a single file every parallel worker must edit, and it
turns every merge into a conflict. `steps/fixtures.ts` holds only `createBdd(test)`.

## 3. Merge

Bring each worktree's work back in turn. Conflicts should be rare by construction; where two
capabilities genuinely need the same Page Object, keep one and have both step files construct
it. Run `npx bddgen --tags "not @draft"` after each merge so a broken step signature surfaces
against the capability that caused it rather than at the end.

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
