---
description: Read-only bank coverage report - safe to run between turns
---

Report the state of the bank. Read-only: change nothing.

```
node ${CLAUDE_PLUGIN_ROOT}/scripts/bank-stats.mjs
```

Coverage is computed by parsing tags, never from a stored table, and never by improvising a
regex — the script exists because ad-hoc parsing silently miscounts, and an under-reported
coverage number is worse than none.

Add whatever context the numbers need: which turn the bank is between, whether the gate is
green, whether any `@quarantine-until:` date has passed.

**Do not recommend which scenarios to implement next.** Turn 2 implements everything
reachable; a ranked subset reads as permission to stop early. If drafts remain, the answer is
always `/tddbanking:implement`, not a shortlist.
