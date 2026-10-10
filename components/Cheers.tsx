/**
 * Skål! A one-off celebration for your own win: the winning square pops like a cork and
 * sparkling-wine bubbles rise from it across the page for a few seconds.
 *
 * Imperative on purpose: a throwaway canvas on <body> that removes itself, so it never
 * re-renders the round view and can't get stuck. Skipped entirely with reduced motion.
 */

const GOLD = "194, 147, 58"; // --color-gold
const GOLD_SOFT = "231, 207, 156"; // --color-gold-soft
const DURATION = 4200;
const BURST = 20;

interface Bubble {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  born: number;
  life: number;
  wobble: number;
  phase: number;
  hue: string;
}

export function prefersCalm(): boolean {
  return typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Cork pop on the square itself: a quick swell and a gold flash, then back to rest. */
function popSquare(el: HTMLElement) {
  el.animate(
    [
      { transform: "scale(1)", boxShadow: `0 0 0 0 rgba(${GOLD}, 0)` },
      { transform: "scale(0.9)", offset: 0.18 },
      { transform: "scale(1.22)", boxShadow: `0 0 0 6px rgba(${GOLD}, 0.55)`, offset: 0.45 },
      { transform: "scale(1)", boxShadow: `0 0 0 14px rgba(${GOLD}, 0)` },
    ],
    { duration: 700, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
  );
}

export function celebrateFrom(el: HTMLElement) {
  if (prefersCalm()) return;
  el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  popSquare(el);

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100vw",
    height: "100dvh",
    pointerEvents: "none",
    zIndex: "40",
  });
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  // Resizing a canvas resets its transform, so the DPR scale is set again each time.
  const resize = () => {
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  document.body.appendChild(canvas);

  const bubbles: Bubble[] = [];
  const start = performance.now();
  // Fewer bubbles on small screens: same feel, less work for a mid-range phone.
  const total = window.innerWidth < 640 ? 80 : 130;
  let spawned = 0;
  let last = start;
  let raf = 0;

  const spawn = (now: number, burst: boolean) => {
    const rect = el.getBoundingClientRect();
    const r = 1.6 + Math.random() ** 1.6 * 7.5;
    bubbles.push({
      x: rect.left + rect.width * (0.05 + Math.random() * 0.9),
      y: rect.top + rect.height * (burst ? 0.4 : 0.15),
      r,
      // The first handful burst outwards like a popped cork; the rest stream upwards.
      vx: burst ? (Math.random() - 0.5) * 320 : (Math.random() - 0.5) * 40,
      vy: burst ? -240 - Math.random() * 240 : -50 - Math.random() * 110,
      born: now,
      life: 1900 + Math.random() * 1500,
      wobble: 6 + Math.random() * 14,
      phase: Math.random() * Math.PI * 2,
      hue: Math.random() < 0.7 ? GOLD : GOLD_SOFT,
    });
    spawned += 1;
  };

  for (let i = 0; i < BURST; i++) spawn(start, true);

  const ring = (now: number) => {
    const t = (now - start) / 520;
    if (t >= 1) return;
    const rect = el.getBoundingClientRect();
    const ease = 1 - (1 - t) ** 3;
    ctx.beginPath();
    ctx.arc(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
      rect.width * (0.55 + ease * 0.85),
      0,
      Math.PI * 2,
    );
    ctx.strokeStyle = `rgba(${GOLD}, ${0.75 * (1 - t)})`;
    ctx.lineWidth = 3.5 * (1 - t) + 0.5;
    ctx.stroke();
  };

  const frame = (now: number) => {
    const dt = Math.min(now - last, 48) / 1000;
    last = now;
    const elapsed = now - start;
    // Stream new bubbles for the first ~2.2 s.
    const due = Math.min(total, BURST + Math.floor(((total - BURST) * elapsed) / 2200));
    while (spawned < due) spawn(now, false);

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    ring(now);

    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      const age = now - b.born;
      if (age > b.life || b.y < -20) {
        bubbles.splice(i, 1);
        continue;
      }
      // Buoyancy: bubbles speed up as they rise; drag calms the burst.
      b.vy -= (40 + 30 / b.r) * dt;
      b.vx *= 1 - 2.2 * dt;
      b.y += b.vy * dt;
      b.x += b.vx * dt;
      const x = b.x + Math.sin(age / 260 + b.phase) * b.wobble * Math.min(1, age / 500);
      const t = age / b.life;
      const alpha = t < 0.12 ? t / 0.12 : 1 - Math.max(0, (t - 0.55) / 0.45);

      ctx.beginPath();
      ctx.arc(x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${b.hue}, ${0.22 * alpha})`;
      ctx.fill();
      ctx.lineWidth = Math.max(0.8, b.r * 0.28);
      ctx.strokeStyle = `rgba(${b.hue}, ${0.85 * alpha})`;
      ctx.stroke();
      // The little highlight that makes a circle read as a bubble.
      if (b.r > 2.5) {
        ctx.beginPath();
        ctx.arc(x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.22, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * alpha})`;
        ctx.fill();
      }
    }

    if (elapsed < DURATION && (bubbles.length || spawned < total)) raf = requestAnimationFrame(frame);
    else cleanup();
  };

  const onHide = () => document.hidden && cleanup();
  const cleanup = () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
    document.removeEventListener("visibilitychange", onHide);
    canvas.remove();
  };
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", onHide);
  raf = requestAnimationFrame(frame);
}
