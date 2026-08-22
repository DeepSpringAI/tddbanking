# Security Policy

## Reporting a vulnerability

Please report security issues privately, not as a public issue.

Use GitHub's private reporting form:
[**Report a vulnerability**](https://github.com/DeepSpringAI/tddbanking/security/advisories/new).
It is visible only to the maintainers, and it lets us prepare a fix before anything is disclosed.

Please include what you were running, what happened, and the smallest reproduction you have. We
aim to acknowledge within a few working days.

## Supported versions

This is a small plugin with a linear history: fixes go onto `main` and ship in the next tagged
release. Only the latest release is supported. If you are pinned to an older tag, please try
`main` before reporting.

## What is in scope

The plugin ships no runtime dependencies and no service — it is markdown prompts plus two Node
scripts that read files in your repo. The realistic concerns are therefore:

- **`scripts/`** doing something unexpected with paths or file contents.
- **Prompt content that induces a destructive action** in a repo the plugin is run against —
  for example an instruction that could lead an agent to delete or overwrite work outside the
  test bank. We treat this as a security issue, not a bug.
- **Anything that would cause credentials or customer data to leave the machine**, including
  content being written into a committed test fixture or an uploaded CI artifact.

## What is not a vulnerability, but you should know about it

Two behaviours are intentional and documented, and are worth understanding before you run the
loop:

- **The app-crawl discovery modality writes to the application it explores.** Finding out what a
  user can do means doing it, so during a real trial it cancelled records and sent invitation
  waves. Run it against a disposable instance with sandboxed outbound communication. Turn 1 asks
  for consent before crawling.
- **Turn 5 modifies application code**, in isolated git worktrees, to take filed changes to
  green. It confirms scope before it starts.

If either of those does something outside the boundary described here, that *is* a report we want.
