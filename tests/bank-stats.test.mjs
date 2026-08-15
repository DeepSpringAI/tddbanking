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
check('counts every scenario including the commented one', s.total, 6);
check('a Scenario Outline counts once, not per example', s.byCapability.tricky.total, 6);
check('live excludes drafts', s.live, 2);
check('draft count', s.draft, 4);
check('blocked detected from the # blocked: note', s.blocked, 1);
check('implementable excludes blocked and gap-suspected', s.implementable, 2);
check('smoke count', s.smoke, 2);
check('known defect carries its change id', s.knownDefects, [{ name: 'A known defect', change: 'F-9' }]);
check('gap-suspected listed', s.gapSuspected, ['An outline counts once']);
check('drafts missing evidence are flagged', s.missingEvidence.length, 1);
check('feature-level capability applies to scenarios', Object.keys(s.byCapability), ['tricky']);
check('source counts handle bare and parameterised tags', s.bySource['@from-story'], 2);

console.log(failures ? `\n${failures} FAILED` : '\nall passed');
process.exit(failures ? 1 : 0);
