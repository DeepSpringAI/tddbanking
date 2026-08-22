/**
 * Structural checks on the things that break an install silently.
 *
 * `claude plugin validate` covers the marketplace manifest, but it is not available in CI and
 * it does not parse frontmatter -- only `claude plugin tag` does that. So an agent or command
 * that loses its `description:` still validates, and then shows up nameless in the plugin list.
 * The version is worse: it lives in three files now, and a marketplace pointing at a version
 * the plugin does not claim fails at install time, for the user, not here.
 */
import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';

let failures = 0;
const check = (label, actual, expected) => {
  try { assert.deepEqual(actual, expected); console.log(`  ok   ${label}`); }
  catch { failures++; console.log(`  FAIL ${label}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`); }
};

const json = (p) => JSON.parse(readFileSync(p, 'utf8'));

console.log('manifests');

const plugin = json('.claude-plugin/plugin.json');
const marketplace = json('.claude-plugin/marketplace.json');
const pkg = json('package.json');

check('plugin and marketplace agree on version', marketplace.version, plugin.version);
check('package.json carries the same version', pkg.version, plugin.version);
check('the marketplace lists this plugin by name', marketplace.plugins.map((p) => p.name), [plugin.name]);
check('the listed plugin points at this repo root', marketplace.plugins[0].source, './');
check('plugin declares a licence matching LICENSE', plugin.license, 'MIT');
check('LICENSE is the MIT text', readFileSync('LICENSE', 'utf8').startsWith('MIT License'), true);

// Frontmatter. A missing description is invisible until someone opens the plugin list.
const frontmatter = (path) => {
  const text = readFileSync(path, 'utf8');
  if (!text.startsWith('---\n')) return null;
  const end = text.indexOf('\n---', 4);
  if (end === -1) return null;
  return Object.fromEntries(
    text.slice(4, end).split('\n')
      .map((line) => line.match(/^([a-z-]+):\s*(.+)$/i))
      .filter(Boolean)
      .map((m) => [m[1], m[2].trim()]),
  );
};

const missing = { noFrontmatter: [], noDescription: [], noName: [] };
const collect = (dir, requireName, only) => {
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.md') && (!only || only.includes(f)))) {
    const path = `${dir}/${file}`;
    const fm = frontmatter(path);
    if (!fm) { missing.noFrontmatter.push(path); continue; }
    if (!fm.description) missing.noDescription.push(path);
    if (requireName && !fm.name) missing.noName.push(path);
  }
};
// Commands take their name from the filename; agents and skills declare one. Only SKILL.md is
// a skill -- the other files in that directory are reference material it links to, and they
// carry no frontmatter by design.
collect('commands', false);
collect('agents', true);
collect('skills/tddbanking', true, ['SKILL.md']);

check('every command and agent has frontmatter', missing.noFrontmatter, []);
check('every command and agent has a description', missing.noDescription, []);
check('every agent and skill declares a name', missing.noName, []);

// The agents are the plugin's whole parallelism story; losing one to a rename is silent.
check('the eight agents are all present', readdirSync('agents').filter((f) => f.endsWith('.md')).length, 8);
check('the seven commands are all present', readdirSync('commands').filter((f) => f.endsWith('.md')).length, 7);

console.log(failures ? `\n${failures} FAILED` : '\nall passed');
process.exit(failures ? 1 : 0);
