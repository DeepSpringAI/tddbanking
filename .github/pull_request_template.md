<!--
Most changes here are changes to prompts, so the diff rarely shows whether the change works.
What it ran against usually matters more than what it says.
-->

## What this changes, and why

<!-- The why especially. This repo's commit history is used as documentation. -->

## What you ran it against

<!--
For anything touching a command, an agent, or the skill: which app, which turn, and what the
agents did differently. "Reasoned about" is not the same as "ran" — several changes that read
as obviously correct were reversed by the next real run.

For docs or scripts only, say so and delete the rest of this section.
-->

## Checklist

- [ ] `npm test` passes
- [ ] If a paraphrase of an upstream skill changed, `upstream-skills.json` is still accurate
      (`npm run check:upstream`)
- [ ] If the README's claims changed, `DESIGN.md` and `skills/tddbanking/SKILL.md` still agree
- [ ] If a version changed, it changed in all three manifests (the manifest test enforces this)
