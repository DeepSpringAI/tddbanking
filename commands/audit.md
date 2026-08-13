---
description: Report bank coverage by capability and what to implement next
argument-hint: optional capability to drill into
---

Report the state of the bank. Read the `tddbanking` skill for the coverage model.

Scope: $ARGUMENTS — if empty, the whole bank.

Parse every `.feature` file and compute from tags alone — never from a stored table.

1. **Coverage by capability** — `live / (live + draft)`, worst first. The worst-covered
   capability is the headline.
2. **What to implement next** — the highest-priority drafts, `@priority:high` first, with
   `@regression` drafts outranking equal-priority others (a bug that already happened is
   likelier to happen again than one that never has).
3. **Health problems**, each with the specific scenario named:
   - `@quarantine:<date>` past its deadline — this is debt, report it as such
   - duplicate scenarios asserting the same behavior in different words
   - drafts with no evidence comment (they should not exist; they got in somehow)
   - capabilities with zero `@smoke` coverage — nothing gates them on a PR
4. **Suite shape** — total live scenarios, how many are `@smoke`, and the smoke suite's last
   known runtime if available. Say plainly if smoke has grown too slow to gate a PR.

Read-only. Change nothing.

End with the single most useful next command for this repo's actual state — usually
`/tddbanking:implement`, but `/tddbanking:discover` if a capability has no scenarios at all.
