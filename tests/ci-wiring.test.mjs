/**
 * Which test entry points CI actually runs.
 *
 * The fixture project is the shape this check was written for: a bank gating every pull request
 * while `npm test` -- a whole unit suite -- is invoked by no workflow at all. That is not a
 * hypothetical; it is the arrangement a real adopter had for months, and when someone finally
 * ran the suite its failures read as accumulated history. They were three days old.
 *
 * The parsing is a narrow scan rather than a YAML parse, because this plugin ships no
 * dependencies -- so the scan is what needs the tests.
 */
import { analyse, parseTriggers, parseRunCommands, playwrightProjects } from '../scripts/ci-wiring.mjs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

let failures = 0;
const check = (label, actual, expected) => {
  try { assert.deepEqual(actual, expected); console.log(`  ok   ${label}`); }
  catch { failures++; console.log(`  FAIL ${label}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`); }
};

console.log('ci-wiring');

const a = analyse('tests/fixtures/ci-project');
const script = (n) => a.scripts.find((s) => s.name === n);
const runs = (n) => script(n).runBy.length > 0;

// The headline. Everything else in this file exists to make this one right.
check('a suite nothing invokes is reported as run by nothing', runs('test'), false);
check('the gating bank script is reported as run', runs('test:smoke'), true);
check('a script reached only through another script is run too', runs('bdd:gen'), true);
check('the indirection is named, not just the verdict', script('bdd:gen').reason, 'called by `test:bank`');

// `npm ci` is an install. A project with a `ci` script does not have it run by `npm ci`, and
// reporting otherwise would clear the exact suite this check is looking for.
check('`npm ci` does not count as running a script called ci', runs('ci'), false);
// `npm run test:smoke` must not satisfy `test`: a word boundary sits between "test" and ":".
check('a prefix of another script name is not a match', script('test').runBy, []);
check('npm lifecycle hooks follow their script', runs('pretest'), false);

check('triggers are read from the on: block',
      a.workflows.find((w) => w.path.endsWith('bank.yml')).triggers,
      ['pull_request', 'schedule', 'workflow_dispatch']);
check('a workflow that never runs on a pull request does not gate', script('test:smoke').gating, true);

// Playwright projects are entry points too, and a project no command selects never runs.
check('projects selected by --project are reported as run',
      a.projects.filter((p) => p.run).map((p) => p.name), ['bank', 'legacy']);
check('a project nothing selects is reported as run by nothing',
      a.projects.filter((p) => !p.run).map((p) => p.name), ['visual']);

// Without this the report could only ever say "nothing runs it", which is wrong the moment CI
// invokes the tool directly instead of through a script.
check('a test tool CI runs directly is surfaced rather than ignored',
      a.unattributed.map((u) => u.command), ['npx playwright test --project=legacy']);

// The heuristic that decides which orphans get the loud paragraph. A reporting utility nobody
// runs is not the failure; a suite nobody runs is.
check('an un-run suite is classified as a suite', script('test').suite, true);
check('an un-run reporting script is not', script('release').suite, false);

check('block scalars are read', parseRunCommands('    - run: |\n        npm ci\n        npm run x\n').length, 2);
check('an inline trigger list is read', parseTriggers('on: [push, pull_request]\n'), ['push', 'pull_request']);
check('a single inline trigger is read', parseTriggers('on: push\n'), ['push']);
check('project names are read from the config', playwrightProjects("projects: [{ name: 'a' }, { name: 'b' }]"), ['a', 'b']);
// `use: { ...devices[...] }` above the projects array must not be mistaken for a project name.
check('names before the projects array are ignored', playwrightProjects("const testDir = 1;\nname: 'notaproject'\nprojects: [{ name: 'a' }]"), ['a']);

{
  const out = execFileSync('node', ['scripts/ci-wiring.mjs', '--dir', 'tests/fixtures/ci-project'], { encoding: 'utf8' });
  check('the report separates run from not-run', out.includes('RUN BY NOTHING'), true);
  check('the report explains what an un-run suite costs', out.includes('reassign') || out.includes('inherits all of them at once'), true);
}
{
  const out = execFileSync('node', ['scripts/ci-wiring.mjs', '--dir', 'tests/fixtures'], { encoding: 'utf8' });
  check('a directory with no package.json says so instead of guessing', out.includes('no package.json'), true);
}

console.log(failures ? `\n${failures} FAILED` : '\nall passed');
process.exit(failures ? 1 : 0);
