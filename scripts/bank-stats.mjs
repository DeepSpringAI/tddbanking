#!/usr/bin/env node
/**
 * Computes bank coverage by parsing Gherkin tags. This is the only place coverage is
 * calculated -- every command reports through it.
 *
 * It exists because ad-hoc regex parsing silently miscounts. A comment line sitting between
 * a scenario's tag block and its `Scenario:` keyword is legal Gherkin and is easy to miss,
 * and an under-reported coverage number is worse than no number at all.
 *
 * Usage: node scripts/bank-stats.mjs [--dir features] [--json]
 */
import { readdirSync, readFileSync, statSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCENARIO = /^\s*(Scenario Outline|Scenario|Example):\s*(.*)$/;
const TAG_LINE = /^\s*@\S/;
const COMMENT = /^\s*#/;
const FEATURE = /^\s*Feature:/;

function featureFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (e.endsWith('.feature')) out.push(p);
    }
  };
  try { walk(dir); } catch { /* no bank yet */ }
  return out.sort();
}

function tagsOf(line) {
  return (line.match(/@[^\s@]+/g) ?? []);
}

/**
 * Collect the tag block preceding index `i`: the contiguous run of tag and comment lines
 * above it. Stops at a blank line, the Feature line, or anything else.
 */
function precedingBlock(lines, i) {
  const tags = [];
  const comments = [];
  for (let j = i - 1; j >= 0; j--) {
    const l = lines[j];
    if (TAG_LINE.test(l)) { tags.unshift(...tagsOf(l)); continue; }
    if (COMMENT.test(l)) { comments.unshift(l.trim()); continue; }
    break;
  }
  return { tags, comments };
}

export function parseBank(dir = 'features') {
  const scenarios = [];
  for (const file of featureFiles(dir)) {
    const lines = readFileSync(file, 'utf8').split('\n');
    let featureTags = [];
    for (let i = 0; i < lines.length; i++) {
      if (FEATURE.test(lines[i])) { featureTags = precedingBlock(lines, i).tags; continue; }
      const m = lines[i].match(SCENARIO);
      if (!m) continue;
      const { tags, comments } = precedingBlock(lines, i);
      const all = [...featureTags, ...tags];
      const capTag = all.find((t) => t.startsWith('@capability:'));
      scenarios.push({
        file,
        line: i + 1,
        name: m[2].trim(),
        outline: m[1] === 'Scenario Outline',
        capability: capTag ? capTag.slice('@capability:'.length) : '(uncapped)',
        tags: all,
        comments,
        hasEvidence: comments.some((c) => /^#\s*evidence:/i.test(c)),
        blockedNote: comments.find((c) => /^#\s*blocked:/i.test(c)) ?? null,
      });
    }
  }
  return scenarios;
}

const has = (s, t) => s.tags.includes(t);
const pref = (s, p) => s.tags.find((t) => t.startsWith(p)) ?? null;

export function summarise(scenarios) {
  const isDraft = (s) => has(s, '@draft');
  const isBlocked = (s) => has(s, '@blocked') || s.blockedNote !== null;
  // Waiting on a product decision is a different state from blocked, and conflating them loses
  // the only thing anyone can act on: blocked needs a fixture built, this needs a person to
  // choose. Both are per-scenario, so neither ever stops a round.
  const isWaiting = (s) => has(s, '@needs-decision');
  const byCapability = {};
  for (const s of scenarios) {
    const c = (byCapability[s.capability] ??= { total: 0, live: 0, draft: 0, blocked: 0, waiting: 0, smoke: 0 });
    c.total++;
    if (isDraft(s)) c.draft++; else c.live++;
    if (isBlocked(s)) c.blocked++;
    if (isWaiting(s)) c.waiting++;
    if (has(s, '@smoke')) c.smoke++;
  }
  const live = scenarios.filter((s) => !isDraft(s));
  const blocked = scenarios.filter(isBlocked);
  const waiting = scenarios.filter(isWaiting);
  // Reachable drafts are what turn 2 is contractually required to implement. A
  // @gap-suspected scenario still counts when it is reachable: implementing it produces a
  // failing test that proves the gap, which beats a document comparison. Only an unreachable
  // one is out of scope.
  //
  // A scenario waiting on a decision is out of scope too, and for a sharper reason: its
  // assertion is the undecided part. Implementing it means inventing the expected value, which
  // is the tautology this bank forbids everywhere else.
  const implementable = scenarios.filter((s) => isDraft(s) && !isBlocked(s) && !isWaiting(s));
  return {
    total: scenarios.length,
    live: live.length,
    draft: scenarios.length - live.length,
    blocked: blocked.length,
    waitingOnDecision: waiting.map((s) => ({
      name: s.name,
      file: s.file,
      line: s.line,
      decision: (pref(s, '@decision:') ?? '').slice('@decision:'.length) || null,
    })),
    implementable: implementable.length,
    coverage: scenarios.length ? live.length / scenarios.length : 0,
    byCapability,
    smoke: scenarios.filter((s) => has(s, '@smoke')).length,
    knownDefects: scenarios.filter((s) => has(s, '@known-defect'))
      .map((s) => ({ name: s.name, change: (pref(s, '@defect-change:') ?? '').slice('@defect-change:'.length) || null })),
    quarantined: scenarios.filter((s) => has(s, '@quarantine'))
      .map((s) => ({ name: s.name, until: (pref(s, '@quarantine-until:') ?? '').slice('@quarantine-until:'.length) || null })),
    gapSuspected: scenarios.filter((s) => has(s, '@gap-suspected')).map((s) => s.name),
    missingEvidence: scenarios.filter((s) => has(s, '@draft') && !s.hasEvidence).map((s) => `${s.file}:${s.line} ${s.name}`),
    bySource: ['@from-crawl', '@from-bug', '@from-story', '@from-copy', '@from-backend'].reduce((a, p) => {
      a[p] = scenarios.filter((s) => s.tags.some((t) => t === p || t.startsWith(p + ':'))).length;
      return a;
    }, {}),
    corroborated: scenarios.filter((s) => s.tags.filter((t) => t.startsWith('@from-')).length > 1).length,
    corroborationPairs: pairCounts(scenarios),
    // Scenarios no document predicted. These are the ones worth reading first: a behaviour
    // found only by crawling or only by mining defects is one nobody wrote down, which is
    // exactly the coverage a documentation-led process cannot reach.
    novel: scenarios.filter((s) => !s.tags.some((t) => t.startsWith('@from-story'))).length,
  };
}

/**
 * Count how often each pair of sources corroborate the same scenario.
 *
 * Pairs are keyed by the **full** source tag, not the modality prefix. That distinction is the
 * whole point: two extractors reading different files of the same underlying artifact both tag
 * `@from-story:`, and keying by prefix would collapse them into one source and hide the
 * duplication entirely. In a real run 70% of all "corroboration" was exactly that -- two agents
 * reading one source and agreeing with themselves.
 *
 * A pair whose members share a prefix is flagged as same-family: probably one source, not two.
 */
function pairCounts(scenarios) {
  const counts = {};
  for (const sc of scenarios) {
    const sources = [...new Set(sc.tags.filter((t) => t.startsWith('@from-')))].sort();
    for (let i = 0; i < sources.length; i++) {
      for (let j = i + 1; j < sources.length; j++) {
        const key = `${sources[i]} + ${sources[j]}`;
        counts[key] = (counts[key] ?? 0) + 1;
      }
    }
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]));
}

const sameFamily = (pair) => {
  const [a, b] = pair.split(' + ');
  return a.split(':')[0] === b.split(':')[0];
};

function bar(pct) { const n = Math.round(pct * 10); return '#'.repeat(n) + '.'.repeat(10 - n); }

function main() {
  const argv = process.argv.slice(2);
  const dir = argv.includes('--dir') ? argv[argv.indexOf('--dir') + 1] : 'features';
  const s = summarise(parseBank(dir));
  if (argv.includes('--json')) { console.log(JSON.stringify(s, null, 2)); return; }
  const waitingNote = s.waitingOnDecision.length ? ` | ${s.waitingOnDecision.length} awaiting a decision` : '';
  console.log(`BANK: ${s.total} scenarios | ${s.live} live | ${s.draft} draft | ${s.blocked} blocked${waitingNote}`);
  // Counts first. "COVERAGE: 0%" after a discovery turn reads as failure when it means
  // "banked 176, implemented none yet" -- the same discouragement the ranked queue used to cause.
  console.log(`COVERAGE: ${s.live} live / ${s.total} banked (${(s.coverage * 100).toFixed(0)}%)   implementable drafts: ${s.implementable}\n`);
  const caps = Object.entries(s.byCapability).sort((a, b) => a[1].live / a[1].total - b[1].live / b[1].total);
  for (const [cap, c] of caps) {
    const flags = [c.blocked ? `${c.blocked} blocked` : null, c.waiting ? `${c.waiting} awaiting a decision` : null, c.smoke ? null : 'no smoke gate'].filter(Boolean).join(', ');
    console.log(`  ${cap.padEnd(22)} ${bar(c.live / c.total)} ${c.live}/${c.total}${flags ? '  (' + flags + ')' : ''}`);
  }
  const pairs = Object.entries(s.corroborationPairs);
  if (pairs.length) {
    const total = pairs.reduce((n, [, c]) => n + c, 0);
    const suspect = pairs.filter(([p]) => sameFamily(p)).reduce((n, [, c]) => n + c, 0);
    console.log('\nCORROBORATION BY PAIR');
    for (const [pair, c] of pairs.slice(0, 12)) {
      console.log(`  ${pair.padEnd(46)} ${String(c).padStart(4)}${sameFamily(pair) ? '  <- same modality: one source or two?' : ''}`);
    }
    if (pairs.length > 12) console.log(`  ... and ${pairs.length - 12} more pairs`);
    if (suspect) {
      console.log(`\n  ${suspect} of ${total} corroborations are between sources of the same modality.`);
      console.log('  Two agents reading different files of one artifact is not corroboration.');
    }
  }
  if (s.total) {
    console.log(`\nNOVEL: ${s.novel} of ${s.total} scenarios were predicted by no document.`);
    console.log('  These are what a documentation-led process cannot reach. Read them first.');
  }
  if (s.knownDefects.length) {
    console.log('\nKNOWN DEFECTS');
    for (const d of s.knownDefects) console.log(`  ${d.change ?? 'UNLINKED'}  ${d.name}`);
  }
  if (s.waitingOnDecision.length) {
    console.log('\nAWAITING A DECISION (out of turn 2\'s scope -- and out of nobody else\'s)');
    for (const w of s.waitingOnDecision) {
      console.log(`  ${w.decision ? w.decision.padEnd(6) : 'UNLINKED'} ${w.name}`);
    }
    console.log('  Each of these is parked on one question, not on the round. Everything not');
    console.log('  listed here proceeds. Read the questions with:');
    console.log('    node ${CLAUDE_PLUGIN_ROOT}/scripts/decisions.mjs');
    const unlinked = s.waitingOnDecision.filter((w) => !w.decision);
    if (unlinked.length) {
      console.log(`  ${unlinked.length} carry @needs-decision with no @decision: id, so the question they wait on`);
      console.log('  is written down nowhere. That is a scenario parked forever.');
    }
  }
  if (s.gapSuspected.length) {
    console.log('\nSUSPECTED GAPS (unbuilt -- these are for turn 4, not turn 2)');
    for (const g of s.gapSuspected) console.log(`  ${g}`);
  }
  if (s.missingEvidence.length) {
    console.log('\nDRAFTS WITH NO EVIDENCE (should not exist)');
    for (const m of s.missingEvidence) console.log(`  ${m}`);
  }
  const stale = s.quarantined.filter((q) => q.until && q.until < new Date().toISOString().slice(0, 10));
  if (stale.length) {
    console.log('\nQUARANTINE PAST DEADLINE (debt)');
    for (const q of stale) console.log(`  ${q.until}  ${q.name}`);
  }
}

/**
 * Run main() only when invoked directly, not when imported by the tests.
 *
 * Compare *real* paths. Node resolves import.meta.url through symlinks while process.argv[1]
 * keeps the path as typed, and plugins are installed under a symlinked directory on some
 * setups -- so the naive `import.meta.url === 'file://' + process.argv[1]` check silently
 * fails there and the script prints nothing at all.
 */
function invokedDirectly() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (invokedDirectly()) main();
