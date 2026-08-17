/* Does the new background cost any text its AA margin?
   For each viewport down the page: hide the text, screenshot what is behind
   it, and for every text element find the DARKEST pixel inside its box. Then
   compute the real contrast of that element's colour against that pixel.
   A gradient background means the answer cannot be reasoned about, only
   measured. */
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://127.0.0.1:8123/';
// Leave CHROME unset to use whatever `npx playwright install chromium` put down.
const EXE = process.env.CHROME || undefined;
const W = parseInt(process.env.W || '1440', 10);
const H = 900;

const lum = (r, g, b) => {
  const c = [r, g, b].map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (l1, l2) => {
  const [a, b] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (a + 0.05) / (b + 0.05);
};
const parseRGB = (s) => {
  const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/.exec(s);
  return m ? [+m[1], +m[2], +m[3]] : null;
};

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const decoder = await ctx.newPage();
  await decoder.setContent('<canvas id=c></canvas>');

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    document.querySelectorAll('.reveal').forEach((e) => e.classList.add('in'));
  });
  // Freeze the page: clicking a tab stops the carousel auto-advancing for
  // good, and the live cells are transient decoration in the margins. A
  // moving page means the boxes no longer describe what got photographed.
  await page.locator('#scrubber').scrollIntoViewIfNeeded();
  await page.click('#tab-0');
  await page.evaluate(() => {
    var l = document.getElementById('bgLive');
    if (l) l.style.display = 'none';
  });
  await page.waitForTimeout(1400);

  // The device grader may have downgraded to the cheap backdrop. Users with a
  // GPU see the full layered wash, which is darker — so measure that one too.
  if (process.env.FULL) {
    await page.waitForTimeout(1200);              // let the grader finish
    await page.evaluate(() => document.documentElement.classList.remove('bg-lite'));
    await page.waitForTimeout(600);
  }
  console.log('mode:', await page.evaluate(() =>
    document.documentElement.classList.contains('bg-lite') ? 'bg-lite (cheap backdrop)' : 'full layered wash'));

  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  const worst = new Map();   // colour -> {ratio, bg, sample}
  let checked = 0;

  for (let y = 0; y + 1 < total; y += 780) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(220);

    // Text elements currently on screen, with their colour and box.
    const items = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('p, h1, h2, h3, li, td, th, code, span, a, caption, div').forEach((el) => {
        // leaf-ish: has direct text of its own
        let t = '';
        for (const n of el.childNodes) if (n.nodeType === 3) t += n.nodeValue;
        if (!t.trim()) return;
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) return;
        // Only fully-visible boxes. A clipped box would be clamped to the
        // viewport and end up sampling a region it does not occupy — and the
        // sweep revisits every element anyway.
        if (r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight) return;
        // The nav is fixed and floats over the page: anything underneath it is
        // measured against the nav, not against its own backdrop.
        var nav = document.getElementById('nav');
        if (nav) {
          var nr = nav.getBoundingClientRect();
          if (r.top < nr.bottom && r.bottom > nr.top) return;
        }
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.5) return;
        if (cs.color === 'rgba(0, 0, 0, 0)' || cs.color === 'transparent') return;
        // A descendant that paints its own background (a warning badge, a
        // list bullet, a tag chip) sits INSIDE this box but never behind this
        // element's own glyphs. Punch those regions out, or they get mistaken
        // for the backdrop and the number is meaningless.
        const holes = [];
        el.querySelectorAll('*').forEach((d) => {
          const dcs = getComputedStyle(d);
          const painted =
            (dcs.backgroundColor && dcs.backgroundColor !== 'rgba(0, 0, 0, 0)') ||
            (dcs.backgroundImage && dcs.backgroundImage !== 'none');
          if (!painted) return;
          const dr = d.getBoundingClientRect();
          if (dr.width < 1 || dr.height < 1) return;
          holes.push({
            x: Math.round(dr.left - r.left), y: Math.round(dr.top - r.top),
            w: Math.round(dr.width), h: Math.round(dr.height),
          });
        });
        // The element's own background counts as its backdrop, so it is not a
        // hole — but a self-painted inline highlight is measured as-is.
        // Sample the CONTENT box, not the border box: glyphs cannot land on
        // the element's own border or padding, so a decorative left rule is
        // not the backdrop of the text beside it.
        var px = (p) => parseFloat(cs[p]) || 0;
        var insetL = px('borderLeftWidth') + px('paddingLeft');
        var insetR = px('borderRightWidth') + px('paddingRight');
        var insetT = px('borderTopWidth') + px('paddingTop');
        var insetB = px('borderBottomWidth') + px('paddingBottom');
        var cw = Math.round(r.width - insetL - insetR);
        var ch = Math.round(r.height - insetT - insetB);
        if (cw < 4 || ch < 4) return;
        out.push({
          color: cs.color,
          x: Math.round(r.left + insetL), y: Math.round(r.top + insetT),
          w: cw, h: ch,
          holes: holes.map((q) => ({ x: q.x - insetL, y: q.y - insetT, w: q.w, h: q.h })),
          tag: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''),
        });
      });
      return out;
    });
    if (!items.length) continue;

    // Now hide the text and photograph what was behind it.
    // Hide the glyphs, and also the decorative pseudo-elements (list bullets,
    // rules) that would otherwise be mistaken for the backdrop behind text.
    const hide = await page.addStyleTag({
      // :not(#x) buys specificity without matching anything, so this beats the
      // stylesheet's own `!important` colour rules (e.g. .mode-tag).
      // transition:none matters — .btn and .nav-links a transition `color`, so
      // without it the text merely starts fading and the screenshot catches it
      // still half-painted, reading its own colour back as the "backdrop".
      content:
        'html:not(#x) body:not(#x) *:not(#x) { color: transparent !important; transition: none !important; }' +
        'html:not(#x) body:not(#x) *:not(#x)::before,' +
        'html:not(#x) body:not(#x) *:not(#x)::after {' +
        '  color: transparent !important; background: transparent !important;' +
        '  border-color: transparent !important; }',
    });
    await page.waitForTimeout(120);
    const shot = await page.screenshot({ type: 'png' });
    // addStyleTag has no id option — hold the handle, or the text stays hidden
    // and every later pass sees nothing to measure.
    await hide.evaluate((el) => el.remove());

    const b64 = shot.toString('base64');
    const mins = await decoder.evaluate(async ({ b64, items, W, H }) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const c = document.getElementById('c');
      c.width = W; c.height = H;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0);
      return items.map((it) => {
        const w = Math.max(1, Math.min(it.w, W - it.x));
        const h = Math.max(1, Math.min(it.h, H - it.y));
        if (it.x >= W || it.y >= H) return null;
        const d = g.getImageData(it.x, it.y, w, h).data;
        const holes = it.holes || [];
        const inHole = (px, py) => {
          for (let k = 0; k < holes.length; k++) {
            const q = holes[k];
            if (px >= q.x - 1 && px <= q.x + q.w + 1 && py >= q.y - 1 && py <= q.y + q.h + 1) return true;
          }
          return false;
        };
        let min = 1e9, mr = 255, mg = 255, mb = 255, seen = 0;
        for (let py = 0; py < h; py++) {
          for (let px = 0; px < w; px++) {
            if (inHole(px, py)) continue;
            const i = (py * w + px) * 4;
            const s = d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722;
            seen++;
            if (s < min) { min = s; mr = d[i]; mg = d[i + 1]; mb = d[i + 2]; }
          }
        }
        return seen ? [mr, mg, mb] : null;
      });
    }, { b64, items, W, H });

    items.forEach((it, i) => {
      const bg = mins[i];
      const fg = parseRGB(it.color);
      if (!bg || !fg) return;
      const r = ratio(lum(fg[0], fg[1], fg[2]), lum(bg[0], bg[1], bg[2]));
      checked++;
      const key = it.color;
      if (!worst.has(key) || r < worst.get(key).r) {
        worst.set(key, { r, bg, tag: it.tag });
      }
    });
  }

  console.log(`checked ${checked} text boxes down the page\n`);
  const rows = [...worst.entries()].sort((a, b) => a[1].r - b[1].r);
  let fails = 0;
  for (const [color, v] of rows) {
    const hex = '#' + v.bg.map((n) => n.toString(16).padStart(2, '0')).join('');
    const ok = v.r >= 4.5;
    if (!ok) fails++;
    console.log(
      `${ok ? '  ok  ' : '  FAIL'} ${color.padEnd(22)} worst bg ${hex}  ratio ${v.r.toFixed(2)}  (${v.tag})`
    );
  }
  console.log(`\n${rows.length} distinct text colours, ${fails} below AA 4.5:1`);
  if (fails) process.exitCode = 1;
  await browser.close();
})();
