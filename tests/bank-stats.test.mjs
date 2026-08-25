import { parseBank, summarise } from '../scripts/bank-stats.mjs';
import assert from 'node:assert/strict';

const s = summarise(parseBank('tests/fixtures/features'));
let failures = 0;
const check = (label, actual, expected) => {
  try { assert.deepEqual(actual, expected); console.log(`  ok   ${label}`); }
  catch { failures++; console.log(`  FAIL ${label}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`); }
};

console.log('bank-stats');
// The regression this script exists for: a comment between tags and keyword must not hide a scenario.
check('counts every scenario including the commented one', s.total, 9);
check('a Scenario Outline counts once, not per example', s.byCapability.tricky.total, 9);
check('live excludes drafts', s.live, 2);
check('draft count', s.draft, 7);
check('blocked detected from the # blocked: note', s.blocked, 1);
// A reachable @gap-suspected scenario IS implementable: the failing test is the proof of the
// gap. Only an unreachable one is out of turn 2's scope.
check('implementable excludes blocked but keeps reachable gap-suspected', s.implementable, 6);
check('smoke count', s.smoke, 2);
check('known defect carries its change id', s.knownDefects, [{ name: 'A known defect', change: 'F-9' }]);
check('gap-suspected listed', s.gapSuspected, ['An outline counts once']);
check('drafts missing evidence are flagged', s.missingEvidence.length, 1);
check('feature-level capability applies to scenarios', Object.keys(s.byCapability), ['tricky']);
check('source counts handle bare and parameterised tags', s.bySource['@from-story'], 4);

// Corroboration is reported per pair, because one total hides two agents reading the same
// source and agreeing with themselves -- which was 70% of "corroboration" in a real run.
// The regression this exists for: two sources of the SAME modality must still register as a
// pair, or the duplication they represent is invisible. Keying by prefix would hide it.
check('same-modality sources still form a visible pair',
      s.corroborationPairs['@from-story:chg-auth-proposal + @from-story:chg-auth-specs'], 1);
check('cross-modality pairs are keyed by full source tag',
      s.corroborationPairs['@from-bug:abc1234 + @from-crawl'], 1);
check('a scenario with one source contributes no pair', Object.values(s.corroborationPairs).reduce((a,b)=>a+b,0), 3);

// Novel = no document predicted it. These are what a docs-led process cannot reach.
check('novel counts scenarios with no story source', s.novel, 5);

// Blocking is per item, not per round. A decision parks the scenarios that depend on it and
// nothing else, so the implementable count must still contain the unrelated draft -- otherwise
// one open question stops a whole turn, which is what it used to do.
const w = summarise(parseBank('tests/fixtures/decisions-bank'));
check('scenarios awaiting a decision are counted', w.waitingOnDecision.length, 5);
check('waiting is a different state from blocked', w.blocked, 0);
check('one decision parks its own scenarios and no others', w.implementable, 1);
check('the decision id travels with the scenario', w.waitingOnDecision[0].decision, 'D-2');
// @needs-decision with no @decision: is a scenario parked on a question written down nowhere.
check('a parked scenario with no id is visible as unlinked', w.waitingOnDecision.filter((x) => !x.decision).length, 1);
check('waiting is reported per capability', w.byCapability.parked.waiting, 5);
check('copy findings are counted as their own discovery source', w.bySource['@from-copy'], 4);

// Regression: the CLI must actually print when invoked through a symlinked path.
// Plugins install under a symlinked dir on some setups; comparing import.meta.url to
// 'file://' + argv[1] silently fails there and the script produces no output at all.
import { execFileSync, } from 'node:child_process';
import { mkdtempSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join as pjoin, resolve } from 'node:path';
{
  const dir = mkdtempSync(pjoin(tmpdir(), 'bankstats-'));
  const link = pjoin(dir, 'linked-scripts');
  symlinkSync(resolve('scripts'), link);
  const out = execFileSync('node', [pjoin(link, 'bank-stats.mjs'), '--dir', 'tests/fixtures/features'], { encoding: 'utf8' });
  check('CLI prints when run through a symlinked path', out.includes('BANK:'), true);
  rmSync(dir, { recursive: true, force: true });
}

console.log(failures ? `\n${failures} FAILED` : '\nall passed');
process.exit(failures ? 1 : 0);
