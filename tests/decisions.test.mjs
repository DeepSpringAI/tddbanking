/**
 * The open-decisions ledger.
 *
 * The point of a parser here rather than a convention is that the format cannot drift: a
 * decision each turn writes in its own shape is not a channel, it is six turns each keeping
 * their own notes. So the shape is asserted, and so are the three states that make the ledger
 * useless if they go unreported -- a decision nobody can find, an answer nobody recorded, and
 * an answered decision that is still blocking work.
 */
import { parseDecisions, summarise, decisionTags } from '../scripts/decisions.mjs';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

let failures = 0;
const check = (label, actual, expected) => {
  try { assert.deepEqual(actual, expected); console.log(`  ok   ${label}`); }
  catch { failures++; console.log(`  FAIL ${label}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`); }
};

console.log('decisions');

const decisions = parseDecisions(readFileSync('tests/fixtures/decisions.md', 'utf8'));
const tags = decisionTags('tests/fixtures/decisions-bank');
const s = summarise(decisions, tags);

// The template ships a worked example in its preamble. Parsing that as a real decision would
// put a fake entry at the top of every adopter's ledger on the day they installed the plugin.
check('a fenced example in the preamble is not a decision', decisions.map((d) => d.id).includes('D-99'), false);

check('every decision is parsed', decisions.length, 6);
check('open and answered are separated', [s.open.length, s.answered.length], [4, 2]);
check('the answer is carried, not just the status', s.answered[0].answer, 'per doctor; RULES.md:142 is corrected in the same change');
check('who answered is carried', s.answered[0].answeredBy, 'the product owner');
check('nested bullets become the options list', s.open[0].options.length, 2);
check('nested bullets become the blocks list', s.open[0].blocks.length, 3);
check('a comma-separated raised field counts occasions', s.open[0].raised.length, 2);

// A decision raised twice while still open is the signal that the channel is not being read --
// which is the exact failure this file exists to end.
check('re-raising while still open is flagged', s.reRaised.map((d) => d.id), ['D-2']);

// The tag and the ledger have to agree or the "single location" promise is already broken.
check('a scenario tagged with an id that is not in the ledger is dangling', s.dangling.map((t) => t.id), ['D-9']);
check('an answered decision with scenarios still parked on it is work',
      s.unblockable.map((u) => [u.decision.id, u.waiting.length]), [['D-1', 1]]);
check('open decisions blocking nothing in the bank are listed', s.untagged.map((d) => d.id), ['D-3', 'D-4']);

const problem = (fragment) => s.problems.some((p) => p.includes(fragment));
check('a duplicate id is a problem', problem('D-2 is defined twice'), true);
check('an answered decision with no answer is a problem', problem('D-5 is marked answered with no answer'), true);
check('an answered decision with no owner is a problem', problem('D-5 is answered but names nobody'), true);
check('a decision that blocks nothing is a problem', problem('D-4 names nothing it blocks'), true);
// An open decision with one option asks the reader to do the work the loop should have done.
check('an open decision with fewer than two options is a problem', problem('D-3 offers 1 option'), true);
check('a well-formed decision produces no problem', s.problems.filter((p) => p.startsWith('D-1')), []);

// A missing ledger is a normal state on day one, not a crash: /tddbanking:status runs this.
import { execFileSync } from 'node:child_process';
{
  const out = execFileSync('node', ['scripts/decisions.mjs', '--file', 'tests/fixtures/nothing-here.md'], { encoding: 'utf8' });
  check('a missing ledger reports rather than throws', out.includes('no ledger at'), true);
}
{
  const out = execFileSync('node', ['scripts/decisions.mjs', '--file', 'tests/fixtures/decisions.md', '--bank', 'tests/fixtures/decisions-bank'], { encoding: 'utf8' });
  check('the report names the dangling tag', out.includes('@decision:D-9'), true);
  check('the report names the answered-but-blocking work', out.includes('ANSWERED BUT STILL BLOCKING'), true);
}
{
  const out = execFileSync('node', ['scripts/decisions.mjs', '--file', 'tests/fixtures/decisions.md', '--bank', 'tests/fixtures/decisions-bank', '--json'], { encoding: 'utf8' });
  check('--json is machine readable for the turns that read it', JSON.parse(out).open.length, 4);
}

console.log(failures ? `\n${failures} FAILED` : '\nall passed');
process.exit(failures ? 1 : 0);
