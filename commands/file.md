---
description: Turn 4 of 4 - turn every finding into an OpenSpec change proposal. The loop ends here
argument-hint: optional finding id to limit to (default is all open findings)
---

**Turn 4 of five.** This turn requires the OpenSpec CLI.

It turns every finding into a change proposal and stops there. It does **not** implement
anything — turn 5 does that, governed by the `tdd` skill.

Scope: $ARGUMENTS — if empty, every open finding in `findings.md`.

## 1. Preflight — check the root, not just the binary

Run `openspec list --json`.

- **Command not found** → the CLI is missing. Leave `findings.md` as the record, tell the user
  to install it (`npm i -g @fission-ai/openspec && openspec init`), and stop.
- **`root.source` is `"implicit"`** → the CLI is installed but **this repository was never
  initialised**. OpenSpec falls back to an implicit root at the working directory, so every
  later command appears to succeed while filing into a root nobody created. Ask whether to run
  `openspec init` here or to stop with `findings.md` as the record. Wait for the answer.
- **`root.source` is `"nearest"`** → initialised. Continue.

## 2. Gather everything that needs filing

Three sources, and all three are in scope:

1. **Defects** — `findings.md` entries from turn 3.
2. **Suspected gaps** — `@gap-suspected` scenarios. Documented behaviour that was never built.
   These cannot be tested into existence; they need development, which is what a change is for.
3. **Blocked scenarios** — `@blocked` drafts. Each names a missing fixture in its
   `# blocked:` comment. Group them into one fixture change per cluster; "seed an
   individual-style congress with release-ready bookings" can unblock several at once and is
   usually a much smaller task than it looks.

## 3. Group by cause, then propose

Several failing scenarios caused by one broken behaviour are **one** change, not several.
Group by cause, not by scenario.

For each group, load `openspec-propose` — try the Skill tool, and if it reports "Unknown
skill", read `.claude/skills/openspec-propose/SKILL.md` from the project and follow it verbatim.
Project-scoped skills are frequently not registered for subagents, so expect the second route.
Pass it what a user cannot currently do in user terms, the scenarios, and the evidence path from
triage.

Invoke it — do not hand-write the artifacts yourself. Producing a proposal, delta spec, design
and task list by hand is re-implementing a tool that already does it, and it will drift from
whatever schema the installed OpenSpec version expects. If the Skill tool has no
`openspec-propose`, say so and stop rather than improvising the format.

Respect that skill's planning boundary: it produces artifacts and stops. Do not implement.

Dispatch the groups in parallel — they are independent.

## 4. Transfer the scenarios into delta specs

**Get the format from OpenSpec, not from here.** Run
`openspec instructions specs --change <name>`; it prints the authoritative artifact rules for
the schema this project actually uses, which is more reliable than any summary that ages in a
plugin.

The meaning of a scenario transfers whole; only its syntax is reshaped. One trap is worth
repeating because it fails silently: OpenSpec scenarios need **exactly four hashtags**
(`#### Scenario:`). Three, or a bullet list, and the scenario is simply not seen.

Run `openspec validate <change> --strict` on every change before reporting success. A change
with zero recognised scenarios is rejected, which is your check that the reformat landed.

## 5. Link both ways, then close the loop

Rewrite each `@defect-change:F-n` tag to the real change name, so the bank records what is
being addressed and the proposal records how it will be proven.

Report the changes created and which findings each covers.

Then tell the user the next step is `/tddbanking:develop`, which takes each change to green
test-first — and note what makes that step unusually well set up: every proposal carries a
failing browser scenario, so the red half of red-green is already written, evidenced and agreed.

Say plainly that turn 5 is the first step that writes application code, so it will ask for
scope confirmation and work in isolated worktrees.
