---
description: Turn bank findings into OpenSpec change proposals
argument-hint: optional finding to file, or blank for all open findings
---

Turn findings into work. This is the only command that requires the OpenSpec CLI.

Findings: $ARGUMENTS — if empty, use the findings from the most recent `/tddbanking:verify`
or `/tddbanking:implement` in this conversation. If there are none, say so and stop.

1. **Preflight — check the root, not just the binary.** Run `openspec list --json`.

   - **Command not found** → the CLI is missing. Write the findings to `findings.md` as
     structured markdown, tell the user to install it
     (`npm i -g @fission-ai/openspec && openspec init`), and stop.
   - **`root.source` is `"implicit"`** → the CLI is installed but **this repo was never
     initialized**. OpenSpec falls back to an implicit root at the working directory, so
     every later command appears to succeed while filing into a root the user never created.
     Do not proceed silently. Ask whether to run `openspec init` here or to write
     `findings.md` instead, and wait for the answer.
   - **`root.source` is `"nearest"` (or a store is selected)** → initialized. Continue.

   Checking `openspec --version` alone is not enough: it passes in any repo that has never
   heard of OpenSpec. The findings are still useful without the tool; only the filing needs it.
2. **Group findings.** Several failing scenarios caused by one broken behavior are one
   change, not several. Group by cause, not by scenario.
3. **For each group, invoke the `openspec-propose` skill** with:
   - what a user cannot currently do, in user terms
   - the failing scenarios. Their meaning transfers directly, but the syntax does not —
     reformat as OpenSpec requires:

     | Gherkin | OpenSpec delta spec |
     |---|---|
     | (none) | `### Requirement: <name>`, using SHALL/MUST — scenarios cannot stand alone |
     | `Scenario: <name>` | `#### Scenario: <name>` — **exactly four hashtags** |
     | `Given ...` | fold into the `WHEN` context, or state as a precondition |
     | `When ...` / `Then ...` / `And ...` | `- **WHEN** ...` / `- **THEN** ...` / `- **AND** ...` |

     Three hashtags or a bullet list instead of `#### Scenario:` **fails silently** — the
     scenario is simply not seen. Run `openspec validate <change> --strict` before reporting
     success; a change with zero recognised scenarios is rejected, which is your check that
     the reformat landed.
   - the evidence path from triage
   Respect that skill's planning boundary: it produces artifacts and stops. Do not implement.
4. **Link both ways.** Tag the bank scenarios with the change name so the bank records what
   is being addressed, and reference the scenarios in the proposal so the change records how
   it will be proven.

For a **coverage gap** rather than a defect — a capability with drafts nobody has implemented
— a change proposal is usually the wrong tool. Those are handled by `/tddbanking:implement`,
not by a spec change. Only file gaps when implementing them requires the app itself to change.

Report: the changes created, which findings each covers, and that the next step is the
`openspec-apply-change` skill.
