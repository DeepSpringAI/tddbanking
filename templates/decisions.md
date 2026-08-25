# Open decisions

Product questions the loop hit and refused to answer for you.

Several agents are told to escalate rather than decide. `promise-auditor` finds a document and
the code disagreeing and must not settle it by declaring the document stale. `failure-triager`
reaches a failure where "stale scenario" would really mean "somebody has to choose".
`change-developer` finds a delta spec contradicting a scenario that passes. Each of those is a
product decision, and this file is where they go.

**Every turn writes here. Every turn reads here before asking anyone anything.** A question
answered in a session nobody kept is a question the next turn asks again — and the turn after
that. One file, one format, checked by
`node ${CLAUDE_PLUGIN_ROOT}/scripts/decisions.mjs`, which `/tddbanking:status` prints.

An open decision does **not** stop a round. It stops the items that depend on it, and nothing
else. Tag those items `@needs-decision` plus `@decision:D-n` so the block is visible where the
work is, and let the rest of the round proceed.

## Format

One `## D-<n>: <question>` per decision, then these fields as top-level bullets. The parser is
strict about that shape, which is the point: a format each turn improvises is not a channel.

```markdown
## D-1: Is registration priced per doctor, or once per congress?
- status: open
- raised: turn 1 (promise-auditor)
- evidence: docs/RULES.md:142 says congress-level; the owner's worked example on 2026-08-19
  prices it per doctor and the two figures differ by 44,000
- blocks:
  - scenario: Registration is priced per attending doctor
  - finding: F-12
- options:
  - A — per doctor. Matches the worked example; RULES.md:142 has to be corrected.
  - B — per congress. Matches the written rule; the worked example is wrong and the owner
    has to be told which of his numbers moves.
- answer:
- answered-by:
- answered-on:
```

When it is answered, set `status: answered`, fill `answer`, `answered-by` and `answered-on`,
and leave the entry in place. The record of *why* is the thing that stops it being re-litigated
in three weeks.

**Phrase the question so answering it is a choice, not a drafting exercise.** Two options
minimum, each with what it costs. "What should happen here?" makes the reader do the work the
loop was supposed to have done; the report flags an open decision with fewer than two options
for exactly that reason.

**Name what it blocks.** A decision that blocks nothing is a conversation. If it blocks a
scenario, tag the scenario too — `decisions.mjs` cross-checks the two and tells you when an
answered decision still has scenarios parked on it, which is work rather than a report.

---

<!-- Decisions go below this line. Delete nothing above it. -->
