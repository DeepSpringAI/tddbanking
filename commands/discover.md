---
description: Find user scenarios the bank does not cover yet and add them as drafts
argument-hint: optional capability or area to focus on
---

Grow the bank. Read the `tddbanking` skill for the tag vocabulary and the evidence rule, and
`${CLAUDE_PLUGIN_ROOT}/skills/tddbanking/writing-scenarios.md` before writing any Gherkin.

Focus: $ARGUMENTS — if empty, cover the whole app.

1. **Read the existing bank** so you can dedup: every `.feature` file, live and draft. You are
   looking for behaviors that are absent, not wording that is absent.
2. **Choose modalities** and dispatch one `scenario-scout` agent per modality, in parallel.
   Each is blind to the others by design — that is why they find different things.
   - **app-crawl** — drive the running app. Every route, form, control and error state is a
     capability a user has. Finds what nobody wrote down. Needs the app running.
     **Confirm with the user, before dispatching, that the target is disposable and its
     outbound communication is sandboxed.** Crawling writes: it submits forms, cancels
     records and triggers whatever the app triggers. Name the URL you are about to crawl and
     get an explicit yes, or instruct the scout to crawl read-only. This is the one step in
     the loop that can do real damage, and it is not recoverable by editing a file.
   - **defect-driven** — past bugs, incidents, hotfix commits. Each becomes a `@regression`
     draft. Highest value per row in the bank. Sources: issue tracker, `git log` for "fix",
     support threads. Ask the user where the bugs live if it is not obvious.
   - **story-driven** — PRDs, tickets, user stories, README claims. Finds intended behavior
     that may never have been built.
   Skip a modality when its source does not exist, and say that you skipped it.
3. **Merge and dedup.** Two scouts finding the same behavior is expected and is a signal, not
   waste: independent corroboration means the behavior matters. Keep **one** scenario, and
   **merge the evidence rather than discarding it** — carry every modality's `@from-*` tag
   onto the survivor, so one row records that the docs promise it, a commit once fixed it,
   and the crawl observed it. A scenario corroborated three ways is the one to implement
   first. Drop anything already in the bank.
4. **Enforce the evidence rule.** Every candidate cites a route, a control, a ticket, a
   commit, or a document line. Anything without evidence is a guess: drop it and say how many
   you dropped.
5. **Present the candidates** grouped by capability, each with its evidence and proposed
   priority. Ask which to accept. Do not write files before the user answers.
6. **Write accepted scenarios** as `@draft` into the right `features/<capability>.feature`,
   creating the file with a `@capability:<slug>` tag if new. Each draft gets its evidence
   comment and a `@from-*` modality tag.

Write no step definitions here. Drafts are deliberately not executable yet.

Report: candidates found per modality, accepted, dropped for no evidence, deduped, and the
new coverage number.
