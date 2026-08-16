---
description: Turn 4 of 4 - turn every finding into an OpenSpec change proposal. The loop ends here
argument-hint: optional finding id to limit to (default is all open findings)
---

**Turn 4 of the four-turn loop, and the last one.** This turn requires the OpenSpec CLI.

**The loop ends here.** It does not restart, and you do not begin another round of discovery.
What follows is ordinary development against the proposals this turn creates. A new round of
turn 1 happens only when the user explicitly asks for one.

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

For each group, invoke the `openspec-propose` skill with what a user cannot currently do in
user terms, the scenarios, and the evidence path from triage. Respect that skill's planning
boundary: it produces artifacts and stops. Do not implement.

Dispatch the groups in parallel — they are independent.

## 4. Transfer the scenarios into delta specs

The meaning transfers whole; the syntax does not:

| Gherkin | OpenSpec delta spec |
|---|---|
| (none) | `### Requirement: <name>`, using SHALL/MUST — scenarios cannot stand alone |
| `Scenario: <name>` | `#### Scenario: <name>` — **exactly four hashtags** |
| `Given ...` | fold into the `WHEN` context, or state as a precondition |
| `When` / `Then` / `And` | `- **WHEN** ...` / `- **THEN** ...` / `- **AND** ...` |

Three hashtags or a bullet list **fails silently** — the scenario is simply not seen. Run
`openspec validate <change> --strict` on every change before reporting success; a change with
zero recognised scenarios is rejected, which is your check that the reformat landed.

## 5. Link both ways, then close the loop

Rewrite each `@defect-change:F-n` tag to the real change name, so the bank records what is
being addressed and the proposal records how it will be proven.

Report the changes created, which findings each covers, and that the loop is complete.

Tell the user the next step is theirs: implement the changes with the `openspec-apply-change`
skill, **using the `tdd` skill for the development itself**. That handoff is the point of the
whole loop, and it is unusually well set up here — each change already ships with a failing
browser scenario, so the red half of red-green is written, evidenced, and agreed. The work is
to make it green without touching the assertion.

This is drive mode, where the `tdd` skill's rules apply in full: red before green, one slice at
a time, and no speculative work beyond what the scenario demands. Say explicitly that a further round of `/tddbanking:discover` should wait until those
changes have landed, because rediscovering the same gaps against unchanged code produces the
same bank.
