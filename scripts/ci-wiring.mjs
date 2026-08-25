#!/usr/bin/env node
/**
 * Reports which test entry points CI actually runs, and which nothing runs.
 *
 * A test bank installed by this plugin is a floor, not a ceiling. On the first real adoption
 * the bank gated every pull request while `npm test` -- a whole unit suite -- was invoked by no
 * workflow at all. Nobody had switched it off; nobody had ever switched it on. Months later
 * somebody ran it, found failures, and read them as accumulated history. They were not: a
 * change made three days earlier had caused all four.
 *
 * That is the cost worth naming. A suite nothing runs does not merely go unread. It silently
 * reassigns blame, because a pile of failures discovered all at once reads as old rot, and the
 * person who finds it has no way to tell which of them they own. Reporting the wiring is
 * cheap; re-deriving who broke what is not.
 *
 * The parsing here is a deliberately narrow scan rather than a YAML parse -- this plugin ships
 * no dependencies. It reads `on:` blocks and `run:` steps, follows `npm run` chains through
 * `package.json`, and says plainly what it could not attribute instead of guessing.
 *
 * One limitation, stated rather than hidden: the granularity is the workflow, not the step. A
 * step gated by an `if:` expression is reported as running on every trigger its workflow
 * declares. "Run by nothing at all" is exact; "runs on pull_request" is the workflow's claim.
 *
 * Usage: node scripts/ci-wiring.mjs [--dir .] [--json]
 */
import { readdirSync, readFileSync, existsSync, statSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Package-manager subcommands that are NOT script invocations. `npm ci` never runs a `ci` script. */
const RESERVED = new Set([
  'install', 'i', 'ci', 'add', 'remove', 'rm', 'uninstall', 'update', 'up', 'upgrade',
  'exec', 'dlx', 'x', 'create', 'init', 'link', 'unlink', 'publish', 'pack', 'audit',
  'outdated', 'why', 'list', 'ls', 'info', 'view', 'config', 'cache', 'login', 'logout',
  'set', 'get', 'fund', 'dedupe', 'prune', 'rebuild', 'version', 'workspace', 'workspaces',
]);

/** npm gives exactly these script names a bare alias. Everything else needs `npm run`. */
const NPM_ALIASES = { test: ['test', 't', 'tst'], start: ['start'], stop: ['stop'], restart: ['restart'] };

// Substrings distinctive enough not to fire on ordinary prose. `ava` and `tap` were tried and
// dropped: they match "available" and "bootstrap".
const TEST_TOOLS = [
  'playwright test', 'vitest', 'jest', 'mocha', 'cypress run', 'cypress open',
  'pytest', 'go test', 'cargo test', 'rspec', 'phpunit', 'dotnet test',
  'gradle test', 'mvn test', 'bddgen', 'node --test', 'jasmine',
];

const CI_FILES = [
  '.gitlab-ci.yml', '.gitlab-ci.yaml', '.circleci/config.yml', 'azure-pipelines.yml',
  'Jenkinsfile', 'bitbucket-pipelines.yml', '.travis.yml', 'wercker.yml',
];

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** No `\b`: `npm run test` must not match the script `test:bank`. */
const boundary = '(?![\\w:.\\-])';

function invocationRe(name) {
  const n = esc(name);
  const alts = [`(?:npm|pnpm|yarn|bun)\\s+run(?:-script)?\\s+${n}${boundary}`];
  // yarn/pnpm run a script with no `run`. npm does not, except for its four aliases.
  if (!RESERVED.has(name)) alts.push(`(?:pnpm|yarn)\\s+${n}${boundary}`);
  for (const [script, aliases] of Object.entries(NPM_ALIASES)) {
    if (script === name) for (const a of aliases) alts.push(`(?:npm|pnpm|yarn|bun)\\s+${esc(a)}${boundary}`);
  }
  return new RegExp(alts.join('|'));
}

// ---------------------------------------------------------------- workflow scanning

function indentOf(line) { return line.length - line.trimStart().length; }

/** The `on:` triggers of a GitHub workflow, in any of the three shapes it is written in. */
export function parseTriggers(text) {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(?:on|"on"|'on'):\s*(.*)$/);
    if (!m) continue;
    const rest = m[1].trim().replace(/#.*$/, '').trim();
    if (rest.startsWith('[')) return rest.replace(/[[\]]/g, '').split(',').map((s) => s.trim()).filter(Boolean);
    if (rest) return [rest];
    const out = [];
    let base = null;
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j];
      if (!l.trim() || l.trim().startsWith('#')) continue;
      const ind = indentOf(l);
      if (ind === 0) break;
      if (base === null) base = ind;
      if (ind !== base) continue;
      const k = l.trim().match(/^([A-Za-z_][\w-]*):/);
      if (k) out.push(k[1]);
    }
    return out;
  }
  return [];
}

/** Every `run:` command in a workflow, including block scalars. */
export function parseRunCommands(text) {
  const lines = text.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*-?\s*run:\s*(.*)$/);
    if (!m) continue;
    const rest = m[1].trim();
    if (/^[|>][-+]?\d*$/.test(rest) || rest === '') {
      const base = indentOf(lines[i]);
      for (let j = i + 1; j < lines.length; j++) {
        if (!lines[j].trim()) { out.push(''); continue; }
        if (indentOf(lines[j]) <= base) break;
        out.push(lines[j].trim());
        i = j;
      }
    } else {
      out.push(rest.replace(/^['"]|['"]$/g, ''));
    }
  }
  return out.filter(Boolean);
}

function ciFiles(dir) {
  const found = [];
  const wf = join(dir, '.github', 'workflows');
  if (existsSync(wf)) {
    for (const f of readdirSync(wf).sort()) {
      if (/\.ya?ml$/.test(f)) found.push({ path: join('.github', 'workflows', f), kind: 'github' });
    }
  }
  for (const f of CI_FILES) {
    const p = join(dir, f);
    if (existsSync(p) && statSync(p).isFile()) found.push({ path: f, kind: 'other' });
  }
  return found;
}

// ---------------------------------------------------------------- playwright projects

export function playwrightProjects(text) {
  const at = text.indexOf('projects:');
  if (at === -1) return [];
  return [...text.slice(at).matchAll(/\bname:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
}

/** Split a shell line into the pieces a `--project` flag could belong to. */
const chunks = (text) => text.split('\n').flatMap((l) => l.split(/&&|\|\||;/)).map((c) => c.trim()).filter(Boolean);

// ---------------------------------------------------------------- the analysis

export function analyse(dir = '.') {
  const pkgPath = join(dir, 'package.json');
  const pkg = existsSync(pkgPath) ? JSON.parse(readFileSync(pkgPath, 'utf8')) : {};
  const scripts = pkg.scripts ?? {};
  const files = ciFiles(dir);

  const workflows = files.map((f) => {
    const text = readFileSync(join(dir, f.path), 'utf8');
    return {
      path: f.path,
      triggers: f.kind === 'github' ? parseTriggers(text) : ['unknown'],
      commands: f.kind === 'github' ? parseRunCommands(text) : text.split('\n').map((l) => l.trim()).filter(Boolean),
    };
  });

  // Which scripts does a workflow invoke, directly or through another script it invokes?
  const runBy = {};              // script -> [{workflow, triggers}]
  const reasonFor = {};          // script -> how it was reached
  const addRun = (name, wf, via) => {
    (runBy[name] ??= []).push({ workflow: wf.path, triggers: wf.triggers });
    reasonFor[name] ??= via;
  };

  for (const wf of workflows) {
    const direct = new Set();
    const text = wf.commands.join('\n');
    for (const name of Object.keys(scripts)) if (invocationRe(name).test(text)) direct.add(name);
    // Follow the chain: a script run by a CI-run script is itself run by CI.
    const queue = [...direct];
    const seen = new Set(direct);
    for (const n of direct) addRun(n, wf, 'invoked by the workflow');
    while (queue.length) {
      const cur = queue.shift();
      const body = scripts[cur] ?? '';
      for (const name of Object.keys(scripts)) {
        const lifecycle = name === `pre${cur}` || name === `post${cur}`;
        if (!seen.has(name) && (lifecycle || invocationRe(name).test(body))) {
          seen.add(name);
          queue.push(name);
          addRun(name, wf, lifecycle ? `npm lifecycle hook of \`${cur}\`` : `called by \`${cur}\``);
        }
      }
    }
  }

  // The text that actually executes in CI: workflow steps plus the bodies of every script reached.
  const effective = [
    ...workflows.flatMap((w) => w.commands),
    ...Object.keys(runBy).map((n) => scripts[n]),
  ].join('\n');

  const pwFile = ['playwright.config.ts', 'playwright.config.js', 'playwright.config.mjs', 'playwright.config.cjs', 'playwright.config.mts']
    .map((f) => join(dir, f)).find((p) => existsSync(p));
  const projects = pwFile ? playwrightProjects(readFileSync(pwFile, 'utf8')) : [];
  let allProjects = false;
  const namedProjects = new Set();
  for (const c of chunks(effective)) {
    if (!/playwright\s+test\b/.test(c)) continue;
    const named = [...c.matchAll(/--project[=\s]+["']?([\w:.\-]+)["']?/g)].map((m) => m[1]);
    if (named.length === 0) allProjects = true;
    for (const n of named) namedProjects.add(n);
  }

  // Test commands CI runs that are not package scripts. Without this the report can only say
  // "nothing runs it", which is wrong whenever CI invokes the tool directly.
  const unattributed = [];
  for (const wf of workflows) {
    for (const c of chunks(wf.commands.join('\n'))) {
      if (!TEST_TOOLS.some((t) => c.includes(t))) continue;
      if (Object.keys(scripts).some((n) => invocationRe(n).test(c))) continue;
      unattributed.push({ workflow: wf.path, command: c });
    }
  }

  const gating = (name) => (runBy[name] ?? []).some((r) => r.triggers.some((t) => t === 'pull_request' || t === 'push' || t === 'merge_group'));

  // Only an un-run *suite* is the failure this report is about. An un-run `bank:stats` is a
  // reporting utility somebody invokes by hand; saying "wire it or delete it" about that is
  // the noise that gets a report ignored, and then the real one is not read either.
  //
  // The same applies to anything that cannot run unattended. Run against a real adoption this
  // check flagged `playwright show-report` -- a report viewer that executes no tests -- and the
  // headed and --ui variants of a suite already listed once. Three of its five loud lines were
  // duplicates or non-suites, which is precisely how a report earns being skimmed. A watcher, a
  // headed browser, an interactive runner and a report viewer are developer commands; CI not
  // running them is correct rather than a finding.
  const unattendable = /--ui\b|--headed\b|--watch\b|--debug\b|show-report|cypress open/;
  const isSuite = (name, command) =>
    !unattendable.test(command ?? '') &&
    (TEST_TOOLS.some((t) => (command ?? '').includes(t)) ||
      /(^|[:\-])(test|tests|e2e|spec|smoke|lint|typecheck|tsc)([:\-]|$)/.test(name));

  return {
    hasPackageJson: existsSync(pkgPath),
    workflows: workflows.map((w) => ({ path: w.path, triggers: w.triggers })),
    scripts: Object.keys(scripts).map((name) => ({
      name,
      command: scripts[name],
      runBy: runBy[name] ?? [],
      reason: reasonFor[name] ?? null,
      gating: gating(name),
      suite: isSuite(name, scripts[name]),
    })),
    projects: projects.map((name) => ({ name, run: allProjects || namedProjects.has(name), allProjects })),
    unknownProjectsNamed: [...namedProjects].filter((n) => !projects.includes(n)),
    unattributed,
  };
}

function main() {
  const argv = process.argv.slice(2);
  const dir = argv.includes('--dir') ? argv[argv.indexOf('--dir') + 1] : '.';
  const a = analyse(dir);
  if (argv.includes('--json')) { console.log(JSON.stringify(a, null, 2)); return; }

  if (!a.hasPackageJson) { console.log('CI WIRING: no package.json here; nothing to report.'); return; }

  const run = a.scripts.filter((s) => s.runBy.length);
  const orphan = a.scripts.filter((s) => !s.runBy.length);
  console.log(`CI WIRING: ${a.workflows.length} CI file(s) | ${run.length} of ${a.scripts.length} scripts run | ${a.projects.filter((p) => p.run).length} of ${a.projects.length} playwright projects run`);

  if (!a.workflows.length) {
    console.log('\n  No CI configuration found. Every entry point below is run by nothing except a person');
    console.log('  who remembers. That is the state this report exists to make visible.');
  } else {
    console.log('\nCI FILES');
    for (const w of a.workflows) console.log(`  ${w.path.padEnd(40)} on: ${w.triggers.join(', ') || '(unread)'}`);
  }

  if (run.length) {
    console.log('\nRUN BY CI');
    for (const s of run) {
      const where = [...new Set(s.runBy.map((r) => `${r.workflow} (${r.triggers.join(', ')})`))].join('; ');
      console.log(`  ${s.name.padEnd(24)} ${where}`);
      if (s.reason && s.reason !== 'invoked by the workflow') console.log(`  ${''.padEnd(24)} ${s.reason}`);
      if (!s.gating) console.log(`  ${''.padEnd(24)} not on pull_request -- it runs, but it does not gate anything`);
    }
  }
  for (const p of a.projects.filter((p) => p.run)) {
    console.log(`  ${(p.name + ' (project)').padEnd(24)} ${p.allProjects ? 'playwright test runs every project' : 'selected by --project'}`);
  }

  const orphanSuites = orphan.filter((s) => s.suite);
  const orphanProjects = a.projects.filter((p) => !p.run);
  if (orphanSuites.length || orphanProjects.length) {
    console.log('\nRUN BY NOTHING');
    for (const s of orphanSuites) console.log(`  ${s.name.padEnd(24)} ${s.command}`);
    for (const p of orphanProjects) console.log(`  ${(p.name + ' (project)').padEnd(24)} no CI command selects it`);
    console.log('');
    console.log('  A suite nothing runs does not merely go unread. Its failures accumulate silently,');
    console.log('  and the person who eventually runs it inherits all of them at once -- which reads');
    console.log('  as months of rot and is often three days of it. Wire it, or delete it; leaving it');
    console.log('  in the repository un-run is the option that costs someone else the diagnosis.');
  }
  const otherOrphans = orphan.filter((s) => !s.suite);
  if (otherOrphans.length) {
    console.log(`\nNot wired to CI, and not something CI should run: ${otherOrphans.map((s) => s.name).join(', ')}.`);
  }

  if (a.unattributed.length) {
    console.log('\nTEST COMMANDS CI RUNS DIRECTLY (not package scripts, so they are invisible to `npm run`)');
    for (const u of a.unattributed) console.log(`  ${u.workflow}: ${u.command}`);
  }
  if (a.unknownProjectsNamed.length) {
    console.log(`\n  CI selects --project=${a.unknownProjectsNamed.join(', ')}, which the Playwright config does not define.`);
    console.log('  Playwright exits non-zero on an unknown project, so this job is failing or was renamed.');
  }
}

function invokedDirectly() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (invokedDirectly()) main();
