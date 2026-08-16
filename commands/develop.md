---
description: Turn 5 of 5 - take every filed change to green, test-first. The loop ends here
argument-hint: optional change name (default is every open change)
---

**Turn 5 of the four-plus-one loop, and the last one.** This is the only turn that writes
application code.

**The contract is that every filed change ends green.** Each one arrived from turn 4 with a
failing browser scenario attached, so the red half of red-green is already written, evidenced
and agreed. Your job is to make it pass without touching it.

Scope: $ARGUMENTS — if empty, every open change in `openspec/changes/`.

## 1. Preflight

- **`openspec list --json`** — there must be changes to develop. If `root.source` is
  `"implicit"`, turn 4 never ran here; stop.
- **Invoke the Skill tool with `openspec-apply-change`.** If it is missing, the fix is
  `openspec init --tools claude` in this project — those skills are generated per project into
  `.claude/skills/`, so a global CLI install does not provide them. Say that rather than
  suggesting another `npm i`, and stop.
- **Invoke the Skill tool with `tdd`.** This turn is governed by it. If it is absent, say so
  plainly and stop — this is development against a specification, and running it without the
  discipline it assumes is how you get code that passes one scenario and breaks two others.
  It is a separate skill this plugin does not ship:
  [mattpocock/skills](https://github.com/mattpocock/skills).
- **Confirm the bank is red where you expect.** Run the full bank and note exactly which
  scenarios fail. Those failures are your acceptance criteria; a change whose scenario already
  passes needs no work.

## 2. Gate — get consent, then isolate

Every earlier turn touched only test files. **This one changes the product.** Before starting:

- Name the changes you are about to implement and what each will modify, and get an explicit
  yes. Do not infer it from the fact that turn 4 filed them.
- **Never work on the branch you were handed.** One `git worktree` per change, on its own
  branch. Changes are developed in isolation and merged deliberately, so a half-finished fix
  never mixes with a finished one.
- If the repository is dirty, stop and say so.

## 3. Develop each change, in parallel

Dispatch one **`change-developer`** agent per change, each with `isolation: "worktree"` and its
own app instance on its own port — the same contention rules as turn 2, because these agents
also run the suite.

Give each agent: its change name, the scenarios that must go green, and an explicit instruction
to invoke the Skill tool for both `openspec-apply-change` and `tdd`.

## 4. Merge and prove it

Merge each worktree back in turn. After each merge, regenerate and run the bank: a change that
fixes its own scenario while breaking another is not done.

For each change that is now green:

- Remove `@known-defect` and `@defect-change:` from its scenarios. **That tag coming off is the
  definition of done** — the bank said what was broken, and it now says it is fixed.
- Check off the change's tasks and hand it to the `openspec-archive-change` skill, or leave it
  for the user if they would rather review first.

## 5. Report, and stop

Report per change: the scenarios that went from red to green, what was modified, and anything
you could not fix and why.

Then run `node ${CLAUDE_PLUGIN_ROOT}/scripts/bank-stats.mjs` and confirm no `@known-defect`
scenarios remain unaccounted for.

**The loop ends here.** Do not start another round of discovery. A new turn 1 happens only when
the user asks — running it now would rediscover the same gaps against code that just changed
under it.
