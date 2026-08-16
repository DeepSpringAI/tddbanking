# tddbanking.deepspring.co

The marketing site. Four static files, no build step, no dependencies.

```
site/
  index.html      the page
  styles.css      one stylesheet
  app.js          spring physics + the scrubber
  favicon.svg     the mark (a coverage meter: two live, one draft)
  deploy/         Kubernetes manifests + deploy.sh
```

Open `index.html` in a browser, or serve it:

```bash
python3 -m http.server 8123 --directory site
```

## Deploying

```bash
./site/deploy/deploy.sh
```

Applies to namespace `cloud-dev` on the DeepSpring cluster, using whatever kubectl
context is configured. The site ships as a **ConfigMap mounted into
`nginx-unprivileged`** — no image build, no registry. `deploy.sh` regenerates that
ConfigMap from the files on disk every time, then restarts the deployment (a
ConfigMap change alone does not restart pods, and the kubelet's own refresh can
take minutes).

Two things the script guards, both learned the hard way:

- **The host must not already be claimed.** Nginx resolves two ingresses claiming
  the same host oldest-first, so applying a second one is *silently ignored* — the
  rollout succeeds and the old site keeps serving. The script fails loudly instead.
- **The 1 MiB ConfigMap limit.** Currently ~87 KB; the script aborts above 900 KB,
  at which point this needs to become an image build.

## Content

Everything on the page comes from the repo's own `README.md`. When the README
changes, the page should follow. The version string appears twice in
`index.html` (hero eyebrow and footer).

The client whose platform produced the results is deliberately unnamed — "a real
pharma congress platform", exactly as the README puts it.

## Design

Built against the `apple-design` skill. The four-turn loop is a **scrubber you can
throw**: 1:1 pointer tracking with capture, Apple's exponential momentum
projection to choose the landing turn, release velocity handed to a spring, and
rubber-banding at both ends. Springs are parameterised as damping ratio +
response and re-target from their current on-screen value, so an animation can be
grabbed and reversed mid-flight.

Some deliberate constraints, so nobody has to re-derive them:

- **No dependencies and no build.** The spring integrator in `app.js` is ~40 lines
  and exists so the page does not pull in a motion library to animate one carousel.
- **Bounce is earned.** A flick lands with `damping 0.8`; a tab click, which had no
  momentum behind it, lands with `damping 1.0` and no overshoot.
- **Every text colour clears WCAG AA on all three canvases** (`#fff`, `#f5f5f7`,
  `#fbfbfd`). `#0071e3` and `#6e6e73` were rejected for falling to 4.31 and 4.42 on
  the grey band. Check before changing one.
- **Reduced motion takes a different path**, not a disabled one: panels cross-fade,
  dragging is off, auto-advance never starts.
- **Nothing is hidden behind JavaScript.** Without it the carousel degrades to a
  vertical stack and every reveal is already visible — a reader must never lose
  content they cannot get back.
