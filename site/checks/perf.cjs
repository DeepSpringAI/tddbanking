/* Is the background actually costing frames? Measure frame intervals with it
   on and with it removed, in the same browser, back to back. */
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://127.0.0.1:8123/';

const probe = `(async () => {
  const t = [];
  let last = performance.now();
  await new Promise((done) => {
    const start = last;
    function step(now) {
      t.push(now - last); last = now;
      if (now - start > 2500) return done();
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  });
  t.sort((a, b) => a - b);
  const p = (q) => t[Math.min(t.length - 1, Math.floor(t.length * q))];
  return { frames: t.length, median: +p(0.5).toFixed(1), p95: +p(0.95).toFixed(1), max: +t[t.length-1].toFixed(1) };
})()`;

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.locator('#scrubber').scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);

  const withBg = await page.evaluate(probe);
  console.log('background ON :', JSON.stringify(withBg));

  await page.evaluate(() => { document.getElementById('bg').style.display = 'none'; });
  await page.waitForTimeout(400);
  const noBg = await page.evaluate(probe);
  console.log('background OFF:', JSON.stringify(noBg));

  // Peel it back one layer at a time to see what actually costs the frames.
  await page.evaluate(() => {
    document.getElementById('bg').style.display = '';
    document.getElementById('bgLive').style.display = 'none';
  });
  await page.waitForTimeout(400);
  console.log('live cells OFF:', JSON.stringify(await page.evaluate(probe)));

  await page.evaluate(() => {
    document.querySelectorAll('.blob').forEach((b) => (b.style.animationPlayState = 'paused'));
  });
  await page.waitForTimeout(400);
  console.log('  + drift PAUSED:', JSON.stringify(await page.evaluate(probe)));

  await page.evaluate(() => {
    document.querySelectorAll('.blob').forEach((b) => (b.style.willChange = 'auto'));
  });
  await page.waitForTimeout(400);
  console.log('  + no will-change:', JSON.stringify(await page.evaluate(probe)));

  await page.evaluate(() => { document.getElementById('bgAurora').style.display = 'none'; });
  await page.waitForTimeout(400);
  console.log('  + aurora GONE (grid+veil only):', JSON.stringify(await page.evaluate(probe)));

  await browser.close();
})();
