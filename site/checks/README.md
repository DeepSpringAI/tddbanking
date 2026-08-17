# Checking the site

Three scripts. They need Playwright but nothing else, and they run against a URL
— local or the live site — so nothing here is part of the shipped page.

```bash
npm i playwright && npx playwright install chromium
python3 -m http.server 8123 --directory site &

node site/checks/checks.cjs                                    # 44 behavioural checks
node site/checks/contrast-live.cjs                             # every text colour vs its real backdrop
node site/checks/perf.cjs                                      # what the background costs per frame

URL=https://tddbanking.deepspring.co/ node site/checks/checks.cjs   # or against production
CHROME=/path/to/chrome node site/checks/checks.cjs                  # if you have a browser already
```

## What each one is for

**`checks.cjs`** — layout integrity at 1440/1024/768/390/320 (nothing spills past
the edge, no card outgrows its column, no install command is clipped, and the
copied text matches the text on screen), then the scrubber (drag, flick,
rubber-band, keyboard), the clipboard, reduced motion, and the no-JavaScript
fallback. The turn count comes from the DOM, so adding a sixth turn will not
break it.

**`contrast-live.cjs`** — the one worth understanding. A gradient background
cannot be reasoned about, only measured: for each viewport down the page it hides
the text, photographs what was behind it, and finds the darkest pixel inside
every text element's *content* box. Getting a trustworthy number meant excluding
four things that all masquerade as "the backdrop":

- descendants that paint their own background (a badge, a bullet, a tag chip)
- the element's own border and padding — glyphs cannot land there
- anything under the fixed nav, which floats over the page
- the element's own half-faded text, because `.btn` and `.nav-links a` transition
  `color`, so injecting `color: transparent` *animates*

Run it with `FULL=1` to force the layered wash instead of the cheap backdrop a
slow device gets. Both modes must pass.

**`perf.cjs`** — samples real frame intervals with the background on, off, and
with each layer peeled back, which is how the drift animation was identified as
the expensive part rather than guessed at. Absolute numbers depend on the
machine; the comparison between states, taken back to back in one browser, is
the useful part.
