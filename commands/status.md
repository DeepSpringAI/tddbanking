---
description: Read-only bank coverage report, open decisions, and what CI actually runs - safe to run between turns
---

Report the state of the bank. Read-only: change nothing.

## 1. Coverage

```
node ${CLAUDE_PLUGIN_ROOT}/scripts/bank-stats.mjs
```

Coverage is computed by parsing tags, never from a stored table, and never by improvising a
regex — the script exists because ad-hoc parsing silently miscounts, and an under-reported
coverage number is worse than none.

Add whatever context the numbers need: which turn the bank is between, whether the gate is
green, whether any `@quarantine-until:` date has passed.

## 2. Open decisions

```
node ${CLAUDE_PLUGIN_ROOT}/scripts/decisions.mjs
```

This is the loop's escalation channel, and it is the only one. Every turn writes product
decisions here and reads them before asking anybody anything.

Three of its lines are work rather than reporting, so surface them rather than pasting the
output and moving on:

- **Answered but still blocking** — someone decided, and scenarios are still parked on it. That
  is a standstill with the excuse removed, and it is the cheapest work in the repository.
- **A decision raised twice while still open** — the channel is not being read. Say so.
- **A dangling `@decision:` tag** — a scenario waiting on a question that exists nowhere. It
  will wait forever.

Say how many scenarios each open decision is parking, and say plainly that everything else is
proceeding. An open decision is a property of some items, not a state of the round.

## 3. What CI actually runs

```
node ${CLAUDE_PLUGIN_ROOT}/scripts/ci-wiring.mjs
```

**Name every entry point nothing runs.** Not as a footnote — this is the part of the report most
likely to be news. A bank that gates every pull request tells you nothing about the suite next
to it, and the first repository this plugin was installed into had a complete unit suite that no
workflow invoked, for months.

Say what that costs, because "unwatched tests" understates it: a suite nothing runs **reassigns
blame**. Failures accumulate unobserved, the next person to run it inherits all of them at once,
and a pile discovered together reads as months of rot. On that project it read exactly that way,
and the failures turned out to have been caused three days earlier.

Also report the weaker version of the same problem: a suite that runs only on a schedule or only
on `workflow_dispatch` runs, but gates nothing. The script marks those.

## Then

Reconcile the three. A bank at 100% coverage sitting beside an un-run unit suite and four open
decisions is not a green project, and a status report that shows only the first number is how it
comes to look like one.

**Do not recommend which scenarios to implement next.** Turn 2 implements everything reachable;
a ranked subset reads as permission to stop early. If drafts remain, the answer is always
`/tddbanking:implement`, not a shortlist.
