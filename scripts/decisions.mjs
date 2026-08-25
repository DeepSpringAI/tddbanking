#!/usr/bin/env node
/**
 * Reports the open-decisions ledger -- `decisions.md` -- and cross-checks it against the bank.
 *
 * Several agents in this loop are instructed to escalate a product decision rather than take
 * it: `promise-auditor` when a document and the code disagree, `failure-triager` when "stale"
 * would really mean "somebody has to choose", `change-developer` when a delta spec and a
 * passing scenario contradict each other. Until this file existed they were told to escalate
 * and given nowhere to escalate to, so each turn improvised a destination -- a paragraph in a
 * report, a TODO, a question asked and answered in a session nobody kept. The next turn could
 * not read any of those, so it asked again.
 *
 * One location, one format, and a parser that defines it. That is the whole point: a
 * convention each turn reinvents is not a channel.
 *
 * Usage:
 *   node scripts/decisions.mjs [--file decisions.md] [--bank features] [--json]
 */
import { readFileSync, existsSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseBank } from './bank-stats.mjs';

const HEADING = /^##\s+(D-\d+)\s*[:–—-]\s*(.*)$/;
const FIELD = /^-\s+([a-z][a-z-]*):\s*(.*)$/i;
const NESTED = /^\s{2,}[-*]\s+(.*)$/;

const LIST_FIELDS = new Set(['options', 'blocks']);

/** Fields that carry a list are split on newline-bullets first, then on ` | ` or `, `. */
function splitInline(value) {
  if (!value) return [];
  return value.split(/\s+\|\s+|\s*;\s*/).map((v) => v.trim()).filter(Boolean);
}

export function parseDecisions(text) {
  const lines = text.split('\n');
  const decisions = [];
  let cur = null;
  let lastKey = null;
  let fenced = false;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    // A worked example lives in the template's preamble inside a code fence. It documents the
    // format; it is not a decision, and parsing it as one would put a fake entry at the top of
    // every adopter's ledger on day one.
    if (/^\s*(```|~~~)/.test(raw)) { fenced = !fenced; continue; }
    if (fenced) continue;
    const h = raw.match(HEADING);
    if (h) {
      cur = { id: h[1], question: h[2].trim(), line: i + 1, fields: {}, lists: {} };
      decisions.push(cur);
      lastKey = null;
      continue;
    }
    if (/^##?\s/.test(raw)) { cur = null; lastKey = null; continue; }
    if (!cur) continue;
    const f = raw.match(FIELD);
    if (f) {
      const key = f[1].toLowerCase();
      const value = f[2].trim();
      lastKey = key;
      if (LIST_FIELDS.has(key)) cur.lists[key] = splitInline(value);
      else cur.fields[key] = value;
      continue;
    }
    const n = raw.match(NESTED);
    if (n && lastKey) {
      (cur.lists[lastKey] ??= []).push(n[1].trim());
      if (cur.fields[lastKey] === '') delete cur.fields[lastKey];
      continue;
    }
    if (raw.trim() === '') lastKey = null;
  }
  return decisions.map((d) => ({
    id: d.id,
    question: d.question,
    line: d.line,
    status: (d.fields.status ?? 'open').toLowerCase(),
    raised: commaList(d.fields.raised),
    blocks: d.lists.blocks ?? [],
    options: d.lists.options ?? [],
    evidence: d.fields.evidence ?? '',
    answer: d.fields.answer ?? '',
    answeredBy: d.fields['answered-by'] ?? '',
    answeredOn: d.fields['answered-on'] ?? '',
  }));
}

function commaList(value) {
  if (!value) return [];
  return value.split(',').map((v) => v.trim()).filter(Boolean);
}

/** Every `@decision:D-n` tag in the bank, with the scenario waiting on it. */
export function decisionTags(bankDir) {
  const out = [];
  for (const s of parseBank(bankDir)) {
    for (const t of s.tags) {
      if (t.startsWith('@decision:')) {
        out.push({ id: t.slice('@decision:'.length), scenario: s.name, file: s.file, line: s.line, live: !s.tags.includes('@draft') });
      }
    }
  }
  return out;
}

export function summarise(decisions, tags = []) {
  const open = decisions.filter((d) => d.status !== 'answered');
  const answered = decisions.filter((d) => d.status === 'answered');
  const byId = new Map(decisions.map((d) => [d.id, d]));
  const problems = [];
  const seen = new Set();

  for (const d of decisions) {
    if (seen.has(d.id)) problems.push(`${d.id} is defined twice (line ${d.line}). Ids are the handle every turn uses; a duplicate makes the ledger ambiguous.`);
    seen.add(d.id);
    if (!['open', 'answered'].includes(d.status)) problems.push(`${d.id} has status "${d.status}". Only "open" and "answered" exist.`);
    if (d.status === 'answered' && !d.answer) problems.push(`${d.id} is marked answered with no answer recorded. An answer nobody wrote down is an answer the next turn will ask for again.`);
    if (d.status === 'answered' && !d.answeredBy) problems.push(`${d.id} is answered but names nobody. Record who decided -- a decision without an owner gets re-litigated.`);
    if (d.blocks.length === 0) problems.push(`${d.id} names nothing it blocks. A decision that blocks nothing is a conversation, not a decision: either say which scenario, finding or change is waiting on it, or delete it.`);
    if (d.status !== 'answered' && d.options.length < 2) problems.push(`${d.id} offers ${d.options.length} option(s). An open decision with fewer than two options is a request for permission; state the alternatives so answering it is a choice rather than a drafting exercise.`);
  }

  // The tag and the ledger have to agree, or the "single location" promise is already broken.
  const dangling = [];
  for (const t of tags) {
    if (!byId.has(t.id)) dangling.push(t);
  }
  const unblockable = answered
    .map((d) => ({ decision: d, waiting: tags.filter((t) => t.id === d.id) }))
    .filter((x) => x.waiting.length > 0);
  const reRaised = open.filter((d) => d.raised.length > 1);
  const untagged = open.filter((d) => !tags.some((t) => t.id === d.id));

  return { decisions, open, answered, problems, dangling, unblockable, reRaised, untagged, tags };
}

function wrapPrint(prefix, items) {
  for (const item of items) console.log(`${prefix}${item}`);
}

function main() {
  const argv = process.argv.slice(2);
  const arg = (flag, fallback) => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : fallback);
  const file = arg('--file', 'decisions.md');
  const bankDir = arg('--bank', 'features');

  if (!existsSync(file)) {
    if (argv.includes('--json')) { console.log(JSON.stringify({ missing: file, decisions: [], open: [], answered: [] }, null, 2)); return; }
    console.log(`DECISIONS: no ledger at ${file}.`);
    console.log('  Every turn escalates product decisions to one file. Create it from');
    console.log('  ${CLAUDE_PLUGIN_ROOT}/templates/decisions.md, or re-run /tddbanking:init.');
    return;
  }

  const decisions = parseDecisions(readFileSync(file, 'utf8'));
  let tags = [];
  try { tags = decisionTags(bankDir); } catch { /* no bank yet */ }
  const s = summarise(decisions, tags);

  if (argv.includes('--json')) { console.log(JSON.stringify(s, null, 2)); return; }

  console.log(`DECISIONS: ${s.open.length} open | ${s.answered.length} answered   (${file})`);

  if (s.open.length) {
    console.log('\nOPEN -- read these before asking the user anything. Add to this file rather than asking twice.');
    for (const d of s.open) {
      console.log(`  ${d.id}  ${d.question}`);
      if (d.raised.length) {
        const flag = d.raised.length > 1 ? '   <- raised again while still open: the answer is not reaching the turn that keeps asking' : '';
        console.log(`        raised: ${d.raised.join(', ')}${flag}`);
      }
      if (d.evidence) console.log(`        evidence: ${d.evidence}`);
      if (d.options.length) wrapPrint('        option: ', d.options);
      wrapPrint('        blocks: ', d.blocks);
      const waiting = s.tags.filter((t) => t.id === d.id);
      if (waiting.length) console.log(`        tagged on ${waiting.length} scenario(s) in the bank`);
    }
  }

  if (s.answered.length) {
    console.log('\nANSWERED -- settled. Do not re-open one of these without saying what changed.');
    for (const d of s.answered) {
      console.log(`  ${d.id}  ${d.question}`);
      console.log(`        -> ${d.answer || '(no answer recorded)'}${d.answeredBy ? `  (${d.answeredBy}${d.answeredOn ? ', ' + d.answeredOn : ''})` : ''}`);
    }
  }

  if (s.unblockable.length) {
    console.log('\nANSWERED BUT STILL BLOCKING -- this is work, not a report:');
    for (const { decision, waiting } of s.unblockable) {
      console.log(`  ${decision.id}  ${waiting.length} scenario(s) still carry @needs-decision:`);
      for (const w of waiting) console.log(`        ${w.file}:${w.line}  ${w.scenario}`);
    }
    console.log('  The decision is made. Remove @needs-decision and @decision: from those scenarios');
    console.log('  and implement them -- an answered decision that nobody acted on is the same');
    console.log('  standstill as an unanswered one, with the excuse removed.');
  }

  if (s.dangling.length) {
    console.log('\nDANGLING TAGS -- a scenario waits on a decision that is not in the ledger:');
    for (const t of s.dangling) console.log(`  @decision:${t.id}  ${t.file}:${t.line}  ${t.scenario}`);
    console.log('  Either the id is a typo or the decision was never written down. The second');
    console.log('  is the failure this file exists to prevent: a scenario parked on a question');
    console.log('  nobody can find is parked forever.');
  }

  if (s.untagged.length) {
    console.log('\nOPEN, BLOCKING NOTHING IN THE BANK:');
    for (const d of s.untagged) console.log(`  ${d.id}  ${d.question}`);
    console.log('  Fine if it blocks a finding or a change instead. If it blocks a scenario,');
    console.log('  tag that scenario @needs-decision @decision:<id> so the block is visible where the work is.');
  }

  if (s.problems.length) {
    console.log('\nLEDGER PROBLEMS');
    for (const p of s.problems) console.log(`  ${p}`);
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
