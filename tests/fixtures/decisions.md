# Open decisions

A fixture ledger. It deliberately contains the malformed entries the report must catch.

The parser must not read this fenced example as a decision:

```markdown
## D-99: A worked example in the preamble is not a decision
- status: open
```

## D-1: Is registration priced per doctor, or once per congress?
- status: answered
- raised: turn 1 (promise-auditor)
- evidence: docs/RULES.md:142 vs the owner's worked example of 2026-08-19
- blocks:
  - scenario: A scenario still parked on a decision that was answered
- options:
  - A — per doctor
  - B — per congress
- answer: per doctor; RULES.md:142 is corrected in the same change
- answered-by: the product owner
- answered-on: 2026-08-20

## D-2: Does a declined-consent doctor appear as an unnamed aggregate row, or not at all?
- status: open
- raised: turn 1 (promise-auditor), turn 3 (failure-triager)
- evidence: docs/DISCLOSURE.md:88 promises an aggregate row; src/report.ts:142 filters them out
- blocks:
  - scenario: An undecided rule keeps one scenario parked
  - scenario: A second scenario waits on the same question
  - finding: F-4
- options:
  - A — an unnamed aggregate row, matching the disclosure rule
  - B — omitted entirely, matching the code and the privacy note
- answer:

## D-3: Is the export control hidden or disabled for a read-only user?
- status: open
- raised: turn 1 (copy-reviewer)
- blocks:
  - scenario: not in this bank
- options:
  - A — hidden
- answer:

## D-4: A decision that names nothing it blocks
- status: open
- raised: turn 4 (file)
- options:
  - A — one
  - B — two
- answer:

## D-2: A duplicate id
- status: open
- raised: turn 4 (file)
- blocks:
  - finding: F-9
- options:
  - A — one
  - B — two
- answer:

## D-5: An answer nobody recorded
- status: answered
- raised: turn 5 (change-developer)
- blocks:
  - change: something
- options:
  - A — one
  - B — two
- answer:
