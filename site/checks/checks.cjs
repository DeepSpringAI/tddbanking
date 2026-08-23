/* Behavioural checks for the tddbanking site. See site/checks/README.md. */
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://127.0.0.1:8123/';
// Leave CHROME unset to use whatever `npx playwright install chromium` put down.
const EXE = process.env.CHROME || undefined;

let pass = 0;
const fails = [];
function check(name, ok, detail) {
  if (ok) { pass++; console.log('  ok   ' + name); }
  else { fails.push(name + (detail ? ' — ' + detail : '')); console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')); }
}

(async () => {
  const browser = await chromium.launch({
    executablePath: EXE,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  /* ── 1. layout integrity across widths ── */
  for (const w of [1440, 1024, 768, 390, 320]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.querySelectorAll('.reveal').forEach((e) => e.classList.add('in')));
    await page.waitForTimeout(300);

    console.log(`\n@ ${w}px`);
    check(`${w}: no page errors`, errs.length === 0, errs.join('; '));

    // body{overflow-x:hidden} would mask a plain scrollWidth check, so ask the
    // real question instead: does anything spill past the edge with no
    // clipping ancestor to catch it?
    const spill = await page.evaluate((vw) => {
      const clipped = (el) => {
        for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
          const ox = getComputedStyle(p).overflowX;
          if (ox === 'hidden' || ox === 'auto' || ox === 'scroll' || ox === 'clip') return true;
        }
        return false;
      };
      const out = [];
      document.querySelectorAll('body *').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || clipped(el)) return;
        if (r.right > vw + 1 || r.left < -1) {
          out.push(el.tagName.toLowerCase() + '.' + String(el.className || '').split(' ')[0]);
        }
      });
      return [...new Set(out)];
    }, w);
    check(`${w}: nothing spills past the edge`, spill.length === 0, spill.join(', '));

    // A card that is wider than its column gets silently clipped — the code
    // inside it is meant to scroll, the card itself is not.
    const burst = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('.card').forEach((c) => {
        const p = c.parentElement.getBoundingClientRect();
        const r = c.getBoundingClientRect();
        if (r.width - p.width > 1) out.push(`${c.className.split(' ')[1] || 'card'} ${Math.round(r.width)}>${Math.round(p.width)}`);
      });
      return out;
    });
    check(`${w}: no card wider than its column`, burst.length === 0, burst.join(', '));

    // The command text must never be clipped — it is the content.
    const clipped = await page.$$eval('.copyline code', (nodes) =>
      nodes.filter((n) => n.scrollWidth - n.clientWidth > 1).map((n) => n.textContent.trim()));
    check(`${w}: no copy command clipped`, clipped.length === 0, clipped.join(' | '));

    // data-copy must match what is shown, or people copy something they didn't read.
    const mismatch = await page.$$eval('.copyline', (nodes) =>
      nodes.filter((n) => n.getAttribute('data-copy').trim() !== n.querySelector('code').textContent.trim())
        .map((n) => n.getAttribute('data-copy')));
    check(`${w}: copied text matches shown text`, mismatch.length === 0, mismatch.join(' | '));

    await ctx.close();
  }

  /* ── 2. the scrubber ── */
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = 'auto';
      document.querySelectorAll('.reveal').forEach((e) => e.classList.add('in'));
    });
    await page.locator('#scrubber').scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);

    console.log('\nscrubber');

    const sel = () => page.$$eval('.tab', (t) => t.findIndex((x) => x.getAttribute('aria-selected') === 'true'));
    const inertCount = () => page.$$eval('.panel[inert]', (p) => p.length);
    // Derive the turn count from the page — the cycle gained a fifth turn
    // once already, and a hardcoded 4 turns that into a false failure.
    const N = await page.$$eval('.panel', (p) => p.length);
    const LAST = N - 1;
    console.log(`  (${N} turns in the cycle)`);

    check('starts on turn 1', (await sel()) === 0);
    check(`${LAST} of ${N} panels inert at rest`, (await inertCount()) === LAST,
      'got ' + (await inertCount()));

    // Click a tab.
    await page.click('#tab-2');
    await page.waitForTimeout(700);
    check('clicking a tab selects it', (await sel()) === 2);

    const tx = await page.$eval('#track', (t) => t.style.transform);
    check('track translated for turn 3', /translate3d\(-\d+/.test(tx), tx);

    // Drag right-to-left past halfway: that must commit on position alone,
    // with no help from momentum. (A short slow drag SHOULD snap back, so
    // asserting that one advances would be testing the wrong behaviour.)
    await page.click('#tab-0');
    await page.waitForTimeout(700);
    let box = await page.locator('#viewport').boundingBox();
    let cy = box.y + box.height / 2;
    const startX = box.x + box.width * 0.85;
    const far = Math.round(box.width * 0.62);
    await page.mouse.move(startX, cy);
    await page.mouse.down();
    for (let i = 1; i <= 12; i++) {
      await page.mouse.move(startX - (far * i) / 12, cy);
      await page.waitForTimeout(16);
    }
    await page.mouse.up();
    await page.waitForTimeout(900);
    check('dragging past halfway advances a turn', (await sel()) === 1, 'got ' + (await sel()));

    /* Momentum projection.
       A synthetic gesture cannot be given a reliable velocity: page.mouse.move
       plus waitForTimeout runs on wall-clock time, so on a loaded machine the
       same script produces a fast flick or a slow crawl. Asserting "this
       advances" therefore tests the CPU, not the site.

       So assert the actual contract instead, whatever velocity came out: a
       60px drag is far short of halfway, so it commits if and only if the
       release velocity beat the flick threshold. Deterministic either way. */
    const THRESH = 320;
    await page.evaluate(() => {
      window.__samples = [];
      document.getElementById('viewport').addEventListener('pointermove', (e) => {
        window.__samples.push({ x: e.clientX, t: performance.now() });
      }, true);
    });

    const verdicts = [];
    for (let n = 0; n < 3; n++) {
      await page.click('#tab-0');
      await page.waitForTimeout(800);
      await page.evaluate(() => { window.__samples = []; });
      // click() scrolls the target into view, so a box measured earlier may no
      // longer describe where the viewport is. Re-measure every time.
      const b = await page.locator('#viewport').boundingBox();
      const y = b.y + b.height / 2;
      await page.mouse.move(b.x + b.width * 0.7, y);
      await page.mouse.down();
      for (let i = 1; i <= 5; i++) {
        await page.mouse.move(b.x + b.width * 0.7 - i * 12, y);
        await page.waitForTimeout(8);
      }
      await page.mouse.up();
      await page.waitForTimeout(900);

      // Same 100ms window the page uses to derive release velocity.
      const v = await page.evaluate(() => {
        const h = window.__samples;
        if (h.length < 2) return 0;
        const last = h[h.length - 1];
        let ref = h[0];
        for (let i = h.length - 1; i >= 0; i--) {
          if (last.t - h[i].t > 100) break;
          ref = h[i];
        }
        const dt = (last.t - ref.t) / 1000;
        return dt > 0 ? (last.x - ref.x) / dt : 0;
      });
      const landed = await sel();
      verdicts.push({ v: Math.round(v), landed, ok: (Math.abs(v) > THRESH) === (landed === 1) });
    }
    check(
      'a flick commits exactly when it beat the threshold',
      verdicts.every((r) => r.ok),
      verdicts.map((r) => `v=${r.v} -> turn ${r.landed + 1}`).join(', ')
    );
    // And at least one of the three must have been a real flick, or the test
    // proved nothing about momentum at all.
    check(
      'at least one attempt was a genuine flick',
      verdicts.some((r) => Math.abs(r.v) > THRESH),
      verdicts.map((r) => r.v).join(', ')
    );

    // Rubber-band: dragging past the last panel must not run away.
    await page.click('#tab-' + LAST);
    await page.waitForTimeout(800);
    box = await page.locator('#viewport').boundingBox();
    cy = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width * 0.7, cy);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.7 - 400, cy);
    await page.waitForTimeout(30);
    const overX = await page.$eval('#track', (t) => {
      const m = /translate3d\((-?[\d.]+)px/.exec(t.style.transform);
      return m ? parseFloat(m[1]) : 0;
    });
    await page.mouse.up();
    await page.waitForTimeout(800);
    const lastX = await page.$eval('#viewport', (v) => v.clientWidth) * -LAST;
    check('rubber-bands past the end', overX > lastX - 200 && overX < lastX,
      `x=${overX.toFixed(0)} vs bound ${lastX}`);
    check('settles back on the last turn', (await sel()) === LAST, 'got ' + (await sel()));

    // Keyboard.
    await page.focus('#tab-' + LAST);
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(600);
    check('ArrowLeft moves back a turn', (await sel()) === LAST - 1, 'got ' + (await sel()));
    await page.keyboard.press('Home');
    await page.waitForTimeout(600);
    check('Home returns to turn 1', (await sel()) === 0);

    await ctx.close();
  }

  /* ── 3. copy to clipboard ── */
  {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.querySelectorAll('.reveal').forEach((e) => e.classList.add('in')));
    console.log('\nclipboard');
    const line = page.locator('.copyline').first();
    await line.locator('.copybtn').click();
    await page.waitForTimeout(250);
    const label = await line.locator('.copybtn-label').textContent();
    check('button confirms the copy', label.trim() === 'Copied', label);
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    check('clipboard holds the command', clip === '/plugin marketplace add DeepSpringAI/tddbanking', clip);
    await page.waitForTimeout(1700);
    check('button returns to rest', (await line.locator('.copybtn-label').textContent()).trim() === 'Copy');
    await ctx.close();
  }

  /* ── 4. reduced motion takes the other path ── */
  {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
    });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    console.log('\nreduced motion');
    const hidden = await page.$$eval('.reveal', (n) =>
      n.filter((e) => parseFloat(getComputedStyle(e).opacity) < 0.9).length);
    check('nothing stays hidden behind a reveal', hidden === 0, hidden + ' hidden');
    await page.locator('#scrubber').scrollIntoViewIfNeeded();
    await page.click('#tab-2');
    await page.waitForTimeout(400);
    const idx = await page.$$eval('.tab', (t) => t.findIndex((x) => x.getAttribute('aria-selected') === 'true'));
    check('tabs still switch turns', idx === 2);
    const vis = await page.$eval('#panel-2', (p) => getComputedStyle(p).visibility);
    check('the chosen panel is visible', vis === 'visible', vis);
    await ctx.close();
  }

  /* ── 5. no-JS must not lose content ── */
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: 'load' });
    console.log('\nno JavaScript');
    const visible = await page.$$eval('.panel', (n) =>
      n.filter((e) => e.getBoundingClientRect().height > 0 && getComputedStyle(e).display !== 'none').length);
    check('every turn is readable', visible >= 4, visible + ' visible');
    const revealed = await page.$$eval('.reveal', (n) =>
      n.filter((e) => parseFloat(getComputedStyle(e).opacity) > 0.9).length);
    const total = await page.$$eval('.reveal', (n) => n.length);
    check('no content hidden behind reveals', revealed === total, revealed + '/' + total);
    await ctx.close();
  }

  await browser.close();

  console.log(`\n${pass} passed, ${fails.length} failed`);
  if (fails.length) { fails.forEach((f) => console.log('  ✗ ' + f)); process.exitCode = 1; }
})();
