# Contributing

Thanks for looking. This is a small repo with an unusual shape, so it is worth two minutes of
orientation before you open an editor.

## What this repo actually is

Almost all of it is prompts. The commands in `commands/` and the subagents in `agents/` are
markdown files that Claude reads at runtime; `skills/tddbanking/` is the skill they share. There
is no build, no bundle, and no runtime dependency — the only executable code is two Node scripts
in `scripts/`, and they use nothing outside the standard library.

That means a change here is usually a change to English, and the way to review it is to run it.
A prompt that reads beautifully and produces the wrong behaviour is the normal failure mode.

```
commands/     one file per turn — the user-facing entry points
agents/       the subagents each turn spawns, mostly in parallel
skills/       the shared skill: tag vocabulary, triage, how to write a scenario
scripts/      bank-stats.mjs (coverage) and check-upstream.mjs (drift in borrowed skills)
templates/    what /tddbanking:init copies into an adopting repo
tests/        node:test over the scripts and the manifests
DESIGN.md     why it is shaped this way, including where it disagrees with the tdd skill
```

## Running the tests

```bash
npm test              # node --test tests/*.test.mjs
```

No install step — there are no dependencies. Node 20 or newer.

Two things about that command are deliberate. The tests resolve fixtures relative to the repo
root, so **run them from the repo root**. And the file list is expanded by the shell rather than
passed as `tests/` or as a quoted glob: Node 20 does not understand glob patterns after `--test`,
Node 22 does not accept a bare directory, and an explicit list of paths is the only form both
agree on. CI runs it on Node 20 and 22 for exactly that reason.

Two other checks worth running by hand:

```bash
npm run check:upstream        # have the skills we paraphrase changed underneath us?
claude plugin validate .      # the marketplace manifest (needs the Claude Code CLI)
```

## Trying a change locally

Point a marketplace at your working copy and install from it:

```bash
/plugin marketplace add /path/to/your/tddbanking
/plugin install tddbanking@tddbanking
```

Then run the loop against a real web app. A scratch app is fine for turns 1–3; turns 4 and 5 need
OpenSpec and the `tdd` skill, as described in the README.

**Prompt changes need a real run, not a read.** Every non-trivial change in this repo's history
came from running the loop against an actual codebase and watching what the agents did with the
instruction — several of them reversed a change that looked obviously correct on the page. If you
are changing agent or command prose, say in the PR what you ran it against and what changed.

## Four things that have bitten us

- **A tag you filter on must be bare.** Cucumber tag expressions match whole tags, so
  `not @known-defect` does not match `@known-defect:F-9`. Hence every filterable tag is a bare
  tag plus a companion carrying the parameter. The full vocabulary is in `skills/tddbanking/SKILL.md`.
- **Never compute coverage with an ad-hoc regex.** A comment line between a tag block and
  `Scenario:` is legal Gherkin, and hand-parsing it wrong under-reported a real 58-scenario bank
  as 57. `scripts/bank-stats.mjs` is the only place coverage is calculated, and it is tested.
- **`claude plugin validate` and `claude plugin tag` are not interchangeable.** Only `tag` parses
  frontmatter, so `validate` will happily pass an agent that has lost its `description:`.
  `tests/manifests.test.mjs` covers that gap because CI has no Claude CLI.
- **`import.meta.url` resolves through symlinks; `process.argv[1]` does not.** `~/.claude` is
  often a symlink, so a naive `argv[1]` main-guard made `bank-stats.mjs` exit silently when
  installed rather than run from source. Compare realpaths.

## Referencing a skill is not using it

This plugin composes three upstream projects rather than reimplementing them, and keeping that
honest takes care. An agent told "read the X skill if available" loaded it about one time in
three. Naming the mechanism explicitly — "invoke the Skill tool with `tdd`" — and moving the
paraphrase out of the instruction took that to roughly nine in ten.

**Paraphrasing a skill in the prompt is the strongest suppressor of actually loading it**: an
agent handed the conclusion never fetches the source. So if you add a paraphrase, keep it inside
a "if the skill is missing" fallback, and register it in `upstream-skills.json` so
`check:upstream` can tell you when the thing you described has changed underneath you.

Every skill-invoking agent returns a `SKILLS:` line, because a silent skip is otherwise
byte-identical to compliance. Don't remove it.

## Pull requests

Open an issue first for anything that changes the shape of the loop — the turn boundaries and the
"no turn ranks its own work" rule are load-bearing, and `DESIGN.md` records why. Small fixes and
documentation can go straight to a PR.

- Branch off `main`, keep the PR to one concern.
- Run `npm test` before pushing.
- Explain the *why* in the commit message. This repo's history is used as documentation; the
  existing messages are the house style.
- If you changed the README's claims, check `DESIGN.md` and `skills/tddbanking/SKILL.md` still
  agree with it.

## Releases

Versions live in three files and the manifest test enforces that they agree: `package.json`,
`.claude-plugin/plugin.json`, and `.claude-plugin/marketplace.json`. Tags are of the form
`tddbanking--v0.4.3`.

## Licence

By contributing you agree that your contributions are licensed under the MIT Licence, as in
[LICENSE](LICENSE).
