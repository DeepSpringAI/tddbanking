/* ============================================================================
   tddbanking — marketing site behaviour
   No dependencies, no build step.

   The four-turn loop is a scrubber you can throw. Everything about how it moves
   follows the apple-design skill:

     §2  1:1 tracking with pointer capture, respecting the grab offset
     §3  every animation re-targets from its current on-screen value, carrying
         its current velocity — so it can be grabbed and reversed mid-flight
     §4  springs parameterised as damping ratio + response, not duration
     §5  the release velocity is handed to the spring, so drag → animate has
         no visible seam
     §6  the landing step is chosen by projecting momentum, not from where the
         finger happened to lift
     §9  rubber-banding at the first and last panel
     §14 reduced motion takes a different path entirely — cross-fade, no drag
   ========================================================================== */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var isReduced = function () { return reduceMotion.matches; };

  /* ───────────────────────────── spring ─────────────────────────────── */
  /* Apple's two designer-facing parameters, not mass/stiffness/damping:
       damping  — 1.0 critically damped (no overshoot); < 1.0 bounces
       response — how quickly it reaches the target, in seconds. Not a duration:
                  a spring has no fixed duration, the settle time emerges.       */
  function createSpring(opts) {
    var x = opts.value || 0;
    var v = opts.velocity || 0;
    var target = x;
    var damping = opts.damping == null ? 1 : opts.damping;
    var response = opts.response == null ? 0.4 : opts.response;
    var onUpdate = opts.onUpdate;
    var onRest = opts.onRest;
    var raf = 0;
    var last = 0;
    var restX = opts.restDelta == null ? 0.05 : opts.restDelta;
    var restV = opts.restSpeed == null ? 0.05 : opts.restSpeed;

    function step(now) {
      var dt = (now - last) / 1000;
      last = now;
      if (dt > 0.064) dt = 0.064;          // a backgrounded tab must not teleport

      var w0 = (2 * Math.PI) / response;
      var k = w0 * w0;
      var c = 2 * damping * w0;

      // Fixed 240Hz substeps: stable regardless of display refresh rate.
      var h = 1 / 240;
      var t = dt;
      while (t > 0) {
        var s = t < h ? t : h;
        var a = -k * (x - target) - c * v;
        v += a * s;
        x += v * s;
        t -= s;
      }

      onUpdate(x, v);

      if (Math.abs(x - target) < restX && Math.abs(v) < restV) {
        x = target; v = 0;
        onUpdate(x, v);
        raf = 0;
        if (onRest) onRest();
        return;
      }
      raf = requestAnimationFrame(step);
    }

    function start() {
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(step); }
    }

    return {
      get value() { return x; },
      get velocity() { return v; },
      get target() { return target; },
      get running() { return !!raf; },
      /* Jump — used for 1:1 tracking, where there is no animation to run. */
      set: function (val) {
        this.stop();
        x = val; v = 0; target = val;
        onUpdate(x, v);
      },
      /* Re-target. Starts from wherever the value is right now and keeps the
         velocity it already has, unless a new one is handed in. This is what
         makes an in-flight animation grabbable without a visible jump. */
      to: function (next, o) {
        o = o || {};
        target = next;
        if (o.velocity != null) v = o.velocity;
        if (o.damping != null) damping = o.damping;
        if (o.response != null) response = o.response;
        start();
      },
      stop: function () { if (raf) cancelAnimationFrame(raf); raf = 0; }
    };
  }

  /* Apple's momentum projection (from the Designing Fluid Interfaces sample) —
     exponential decay, not the v²/2a from a physics textbook. */
  function project(velocity, decelerationRate) {
    var d = decelerationRate == null ? 0.998 : decelerationRate;
    return (velocity / 1000) * d / (1 - d);
  }

  /* Progressive resistance past a boundary: real things slow before they stop. */
  function rubberband(overshoot, dimension, constant) {
    var c = constant == null ? 0.55 : constant;
    return (overshoot * dimension * c) / (dimension + c * Math.abs(overshoot));
  }

  var clamp = function (n, lo, hi) { return n < lo ? lo : n > hi ? hi : n; };

  /* ──────────────────────────── nav chrome ──────────────────────────── */
  (function nav() {
    var el = document.getElementById('nav');
    if (!el) return;
    var on = false;
    var tick = function () {
      var next = window.scrollY > 8;
      if (next !== on) { on = next; el.classList.toggle('scrolled', on); }
    };
    tick();
    window.addEventListener('scroll', tick, { passive: true });
  })();

  /* ────────────────────────── scroll reveals ────────────────────────── */
  (function reveals() {
    var items = document.querySelectorAll('.reveal');
    if (!items.length) return;

    if (!('IntersectionObserver' in window) || isReduced()) {
      for (var i = 0; i < items.length; i++) items[i].classList.add('in');
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

    items.forEach(function (el, i) {
      // A short stagger inside a group; not a queue the reader has to wait on.
      el.style.transitionDelay = (Math.min(i % 4, 3) * 55) + 'ms';
      io.observe(el);
    });
  })();

  /* ───────────────────────── copy to clipboard ──────────────────────── */
  (function copy() {
    var lines = document.querySelectorAll('.copyline');

    function write(text) {
      if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
      }
      // Fallback for non-secure contexts (e.g. opening the file locally).
      return new Promise(function (resolve, reject) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        document.body.removeChild(ta);
        ok ? resolve() : reject(new Error('copy failed'));
      });
    }

    lines.forEach(function (line) {
      var btn = line.querySelector('.copybtn');
      var label = btn && btn.querySelector('.copybtn-label');
      if (!btn || !label) return;
      var timer = 0;

      btn.addEventListener('click', function () {
        write(line.getAttribute('data-copy') || '').then(function () {
          // Completion feedback, stated plainly, then it returns to rest.
          label.textContent = 'Copied';
          btn.classList.add('copied');
          btn.setAttribute('aria-live', 'polite');
          clearTimeout(timer);
          timer = setTimeout(function () {
            label.textContent = 'Copy';
            btn.classList.remove('copied');
          }, 1600);
        }).catch(function () {
          label.textContent = 'Press ⌘C';
          clearTimeout(timer);
          timer = setTimeout(function () { label.textContent = 'Copy'; }, 2200);
        });
      });
    });
  })();

  /* ──────────────────────── the four-turn scrubber ──────────────────── */
  (function scrubber() {
    var root = document.getElementById('scrubber');
    var viewport = document.getElementById('viewport');
    var track = document.getElementById('track');
    var thumb = document.getElementById('tabThumb');
    var hint = document.getElementById('scrubHint');
    if (!root || !viewport || !track) return;

    var panels = Array.prototype.slice.call(track.querySelectorAll('.panel'));
    var tabs = Array.prototype.slice.call(root.querySelectorAll('.tab'));
    var count = panels.length;
    if (!count) return;

    var index = 0;
    var width = 0;                 // one panel's width — the scrub unit
    var userTook = false;          // once they steer, we stop steering

    /* ── position spring: the track's x, in px ── */
    var pos = createSpring({
      value: 0, damping: 1, response: 0.4,
      restDelta: 0.4, restSpeed: 0.4,
      onUpdate: function (x) {
        track.style.transform = 'translate3d(' + x + 'px,0,0)';
        if (!dragging) syncThumbTo(fracFromX(x));
      }
    });

    /* ── thumb springs: x and width are independent axes, so they get
          independent springs — one spring over a 2D distance desyncs (§3). ── */
    var thumbGeom = [];
    var thumbX = createSpring({
      value: 0, damping: 1, response: 0.35, restDelta: 0.3, restSpeed: 0.3,
      onUpdate: function () { paintThumb(); }
    });
    var thumbW = createSpring({
      value: 1, damping: 1, response: 0.35, restDelta: 0.3, restSpeed: 0.3,
      onUpdate: function () { paintThumb(); }
    });
    function paintThumb() {
      if (!thumb) return;
      thumb.style.transform =
        'translate3d(' + thumbX.value + 'px,0,0) scaleX(' + Math.max(thumbW.value, 0.001) + ')';
    }

    function measure() {
      width = viewport.clientWidth || 1;
      thumbGeom = tabs.map(function (t) {
        return { x: t.offsetLeft, w: t.offsetWidth };
      });
    }

    function fracFromX(x) { return clamp(-x / width, 0, count - 1); }

    /* The highlight tracks the drag continuously — feedback during the gesture,
       not only when it lands (§1), and it points at where you're heading (§8). */
    function syncThumbTo(frac) {
      if (!thumb || !thumbGeom.length) return;
      var i = clamp(Math.floor(frac), 0, count - 1);
      var j = clamp(i + 1, 0, count - 1);
      var t = frac - i;
      var a = thumbGeom[i], b = thumbGeom[j];
      if (!a || !b) return;
      thumbX.set(a.x + (b.x - a.x) * t);
      thumbW.set(a.w + (b.w - a.w) * t);
    }

    /* Slope of thumb-x with respect to track-x, at the current position.
       Used to hand the thumb an honest velocity at release. */
    function thumbSlopeAt(frac) {
      if (!thumbGeom.length) return 0;
      var i = clamp(Math.floor(frac), 0, count - 1);
      var j = clamp(i + 1, 0, count - 1);
      return (thumbGeom[j].x - thumbGeom[i].x);
    }

    function setActive(i) {
      index = i;
      tabs.forEach(function (t, n) {
        var on = n === i;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
      });
      panels.forEach(function (p, n) {
        var on = n === i;
        p.classList.toggle('active', on);
        // Offscreen panels stay out of the tab order and out of the a11y tree.
        if (on) { p.removeAttribute('inert'); p.removeAttribute('aria-hidden'); }
        else { p.setAttribute('inert', ''); p.setAttribute('aria-hidden', 'true'); }
      });
      if (i === 1) runMeter();
    }

    /* goTo: `thrown` records whether momentum preceded this move. Overshoot is
       earned by a flick; a tab click that had no momentum gets none (§4). */
    function goTo(i, o) {
      o = o || {};
      i = clamp(i, 0, count - 1);
      setActive(i);

      if (isReduced()) { pos.set(-i * width); syncThumbTo(i); return; }

      var thrown = !!o.thrown;
      pos.to(-i * width, {
        velocity: o.velocity || 0,
        damping: thrown ? 0.8 : 1.0,
        response: thrown ? 0.4 : 0.35
      });

      var slope = thumbSlopeAt(fracFromX(pos.value));
      var tv = o.velocity ? -(o.velocity / width) * slope : 0;
      if (thumbGeom[i]) {
        thumbX.to(thumbGeom[i].x, { velocity: tv, damping: thrown ? 0.8 : 1.0, response: 0.35 });
        thumbW.to(thumbGeom[i].w, { velocity: 0, damping: 1.0, response: 0.35 });
      }
    }

    /* ── the coverage meter, animated when turn 2 comes into view ── */
    var meterDone = false;
    function runMeter() {
      var fill = document.getElementById('meterFill');
      var val = document.getElementById('meterVal');
      if (!fill || !val || meterDone) return;
      meterDone = true;

      if (isReduced()) {
        fill.style.transform = 'scaleX(0.9)';
        val.textContent = '90%';
        return;
      }
      var m = createSpring({
        value: 0.12, damping: 1, response: 0.9,
        restDelta: 0.002, restSpeed: 0.002,
        onUpdate: function (x) {
          fill.style.transform = 'scaleX(' + x + ')';
          val.textContent = Math.round(x * 100) + '%';
        }
      });
      m.to(0.9);
    }

    /* ───────────────────── direct manipulation ────────────────────── */
    var dragging = false;        // committed to a horizontal drag
    var pointerDown = false;
    var decided = false;         // gesture intent resolved
    var startX = 0, startY = 0, startPos = 0, activeId = null;
    var history = [];            // recent {x,t} — velocity needs a window, not one sample
    var lastDragEnd = 0;
    var THRESHOLD = 10;          // px of hysteresis before committing (§10)

    function velocityFromHistory() {
      if (history.length < 2) return 0;
      var last = history[history.length - 1];
      var ref = history[0];
      for (var i = history.length - 1; i >= 0; i--) {
        if (last.t - history[i].t > 100) break;   // ~100ms window
        ref = history[i];
      }
      var dt = (last.t - ref.t) / 1000;
      if (dt <= 0) return 0;
      return (last.x - ref.x) / dt;               // px/s
    }

    function onDown(e) {
      if (isReduced()) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pointerDown = true;
      decided = false;
      dragging = false;
      activeId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      // Respect where they grabbed: continue from the live on-screen value,
      // never from the logical target of an animation still in flight.
      startPos = pos.value;
      pos.stop();
      history = [{ x: e.clientX, t: performance.now() }];
    }

    function onMove(e) {
      if (!pointerDown || e.pointerId !== activeId) return;
      var dx = e.clientX - startX;
      var dy = e.clientY - startY;

      if (!decided) {
        // Both gestures are live until intent is clear, then the loser is
        // cancelled outright — vertical wins ties so the page still scrolls.
        if (Math.abs(dx) < THRESHOLD && Math.abs(dy) < THRESHOLD) return;
        decided = true;
        if (Math.abs(dx) <= Math.abs(dy)) { pointerDown = false; return; }
        dragging = true;
        takeOver();
        viewport.classList.add('dragging');
        try { viewport.setPointerCapture(e.pointerId); } catch (err) {}
      }

      if (!dragging) return;
      e.preventDefault();

      history.push({ x: e.clientX, t: performance.now() });
      if (history.length > 8) history.shift();

      var raw = startPos + dx;
      var min = -(count - 1) * width;
      var next = raw;
      // Soft boundaries: resist progressively instead of stopping dead (§9).
      if (raw > 0) next = rubberband(raw, width);
      else if (raw < min) next = min + rubberband(raw - min, width);

      pos.set(next);
      syncThumbTo(fracFromX(next));
    }

    function onUp(e) {
      if (!pointerDown && !dragging) { pointerDown = false; return; }
      if (e.pointerId !== activeId) return;
      pointerDown = false;
      if (!dragging) return;

      dragging = false;
      lastDragEnd = performance.now();
      viewport.classList.remove('dragging');
      try { viewport.releasePointerCapture(e.pointerId); } catch (err) {}

      var v = velocityFromHistory();

      // Land where the throw was *going*, not where the finger stopped (§6),
      // then hand that same velocity to the spring so there's no seam (§5).
      var projected = pos.value + project(v);
      var target = clamp(Math.round(-projected / width), 0, count - 1);

      // A deliberate flick should always move at least one step, even a short one.
      if (Math.abs(v) > 320 && target === index) {
        target = clamp(index + (v < 0 ? 1 : -1), 0, count - 1);
      }
      goTo(target, { velocity: v, thrown: true });
    }

    viewport.addEventListener('pointerdown', onDown);
    viewport.addEventListener('pointermove', onMove, { passive: false });
    viewport.addEventListener('pointerup', onUp);
    viewport.addEventListener('pointercancel', onUp);

    // A drag that ends over a link must not also follow it.
    viewport.addEventListener('click', function (e) {
      if (performance.now() - lastDragEnd < 250) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);

    viewport.addEventListener('dragstart', function (e) { e.preventDefault(); });

    /* ─────────────────────────── tabs ─────────────────────────────── */
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { takeOver(); goTo(i); });
      t.addEventListener('keydown', function (e) {
        var next = null;
        if (e.key === 'ArrowRight') next = clamp(i + 1, 0, count - 1);
        else if (e.key === 'ArrowLeft') next = clamp(i - 1, 0, count - 1);
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = count - 1;
        if (next === null) return;
        e.preventDefault();
        takeOver();
        goTo(next);
        tabs[next].focus();
      });
    });

    // Focus moving into an offscreen panel must bring it on screen.
    panels.forEach(function (p, i) {
      p.addEventListener('focusin', function () { if (i !== index) { takeOver(); goTo(i); } });
    });

    /* ───────────────────── auto-advance, until asked not to ────────── */
    var timer = 0;
    var visible = false;

    function schedule() {
      clearTimeout(timer);
      if (userTook || isReduced() || !visible || document.hidden) return;
      timer = setTimeout(function () {
        goTo((index + 1) % count);
        schedule();
      }, 4600);
    }

    /* Once someone steers, we never steer again. Taking control back would be
       fighting them for it. */
    function takeOver() {
      if (userTook) return;
      userTook = true;
      clearTimeout(timer);
      if (hint) hint.classList.add('gone');
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        visible ? schedule() : clearTimeout(timer);
      }, { threshold: 0.4 }).observe(root);
    } else {
      visible = true; schedule();
    }
    document.addEventListener('visibilitychange', function () {
      document.hidden ? clearTimeout(timer) : schedule();
    });

    /* ────────────────────────── lifecycle ─────────────────────────── */
    function layout() {
      var was = index;
      measure();
      pos.set(-was * width);
      if (thumbGeom[was]) { thumbX.set(thumbGeom[was].x); thumbW.set(thumbGeom[was].w); }
    }

    var rt = 0;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(layout, 120);
    });

    // Late-loading fonts change tab widths; re-measure once they settle.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(layout).catch(function () {});
    }

    reduceMotion.addEventListener
      ? reduceMotion.addEventListener('change', layout)
      : reduceMotion.addListener && reduceMotion.addListener(layout);

    measure();
    setActive(0);
    layout();
  })();
})();
