---
description: Turn bank findings into OpenSpec change proposals
argument-hint: optional finding to file, or blank for all open findings
---

Turn findings into work. This is the only command that requires the OpenSpec CLI.

Findings: $ARGUMENTS — if empty, use the findings from the most recent `/tddbanking:verify`
or `/tddbanking:implement` in this conversation. If there are none, say so and stop.

1. **Preflight.** Run `openspec --version`. If it is missing, do not invent a substitute:
   write the findings to `findings.md` as structured markdown, tell the user how to install
   OpenSpec (`npm i -g @fission-ai/openspec && openspec init`), and stop. The findings are
   still useful; the filing is what needs the tool.
2. **Group findings.** Several failing scenarios caused by one broken behavior are one
   change, not several. Group by cause, not by scenario.
3. **For each group, invoke the `openspec-propose` skill** with:
   - what a user cannot currently do, in user terms
   - the failing scenarios verbatim — they are already Given/When/Then, so they transfer into
     the delta spec directly with no translation
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
