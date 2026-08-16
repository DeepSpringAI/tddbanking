#!/usr/bin/env node
/**
 * Detect drift between the skills this plugin paraphrases and the versions its prose was
 * written against.
 *
 * The loud failure -- a skill missing or renamed -- is already handled: agents report
 * `SKILLS: MISSING` and turn 5 hard-stops. This covers the quiet one, where the skill loads
 * fine and a rule inside it has changed while our paraphrase still describes the old rule.
 *
 *   node scripts/check-upstream.mjs              compare the locally installed skill to the pin
 *   node scripts/check-upstream.mjs --upstream   fetch the source and compare (needs network)
 */
import { readFileSync, existsSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pinPath = join(here, '..', 'upstream-skills.json');

const sha = (s) => createHash('sha256').update(s).digest('hex');

/** Where a personal Claude Code skill lives. Not shipped by this plugin. */
function localSkillPath(name) {
  const p = join(homedir(), '.claude', 'skills', name, 'SKILL.md');
  return existsSync(p) ? p : null;
}

async function main() {
  const wantUpstream = process.argv.includes('--upstream');
  const { skills } = JSON.parse(readFileSync(pinPath, 'utf8'));
  let drifted = 0;

  for (const s of skills) {
    console.log(`\n${s.name}  (${s.author}, ${s.source})`);
    console.log(`  pinned ${s.pinnedSha256.slice(0, 16)}  verified ${s.verifiedOn}`);

    let actual = null, origin = null;
    if (wantUpstream) {
      try {
        const res = await fetch(s.raw);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        actual = sha(await res.text()); origin = 'upstream';
      } catch (e) {
        console.log(`  could not fetch upstream: ${e.message}`);
      }
    }
    if (!actual) {
      const p = localSkillPath(s.name);
      if (!p) { console.log('  not installed locally — nothing to compare'); continue; }
      actual = sha(readFileSync(p, 'utf8')); origin = `local (${p})`;
    }

    if (actual === s.pinnedSha256) {
      console.log(`  MATCH   ${origin} is the version this plugin's prose describes`);
      continue;
    }
    // A version someone has already diffed and confirmed changes no characterised rule.
    // This is a record that the check happened, not a way to mute the warning.
    const known = (s.knownEquivalent ?? []).find((k) => k.sha256 === actual);
    if (known) {
      console.log(`  MATCH   ${origin} differs from the pin but was checked on ${known.checkedOn}:`);
      console.log(`          ${known.note}`);
      continue;
    }
    drifted++;
    console.log(`  DRIFT   ${origin} is ${actual.slice(0, 16)}, not the pinned version`);
    console.log('\n  Re-read these rules and confirm our paraphrases still describe them:');
    for (const r of s.charactersedRules) console.log(`    - ${r}`);
    console.log('\n  Our paraphrases live in:');
    for (const f of s.paraphrasedIn) console.log(`    ${f}`);
    console.log('\n  Drift is not automatically a problem. Most edits are cosmetic. Check whether a');
    console.log('  RULE changed; if not, update pinnedSha256 and verifiedOn and move on.');
  }

  if (drifted) {
    console.log(`\n${drifted} skill(s) drifted from their pin. Nothing is broken — this is a prompt to re-verify.`);
  } else {
    console.log('\nAll pinned skills match. The paraphrases in this repo describe the versions in use.');
  }
}

function invokedDirectly() {
  if (!process.argv[1]) return false;
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
}
if (invokedDirectly()) main();
