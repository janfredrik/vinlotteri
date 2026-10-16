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

/** `scale` grows the bubbles for a screen seen from across the room (the big screen uses ~2). */
export interface CheerOptions {
  scale?: number;
}

export function celebrateFrom(el: HTMLElement, { scale = 1 }: CheerOptions = {}) {
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
  const total = window.innerWidth < 640 ? 80 : Math.round(130 * Math.sqrt(scale));
  let spawned = 0;
  let last = start;
  let raf = 0;

  const spawn = (now: number, burst: boolean) => {
    const rect = el.getBoundingClientRect();
    const r = (1.6 + Math.random() ** 1.6 * 7.5) * scale;
    bubbles.push({
      x: rect.left + rect.width * (0.05 + Math.random() * 0.9),
      y: rect.top + rect.height * (burst ? 0.4 : 0.15),
      r,
      // The first handful burst outwards like a popped cork; the rest stream upwards.
      vx: (burst ? (Math.random() - 0.5) * 320 : (Math.random() - 0.5) * 40) * scale,
      vy: (burst ? -240 - Math.random() * 240 : -50 - Math.random() * 110) * scale,
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

/* ------------------------------------------------------------------------------------------
 * 1. premie: the crown lands. A gold crown drops onto the winning square, bounces to rest,
 * and the impact ripples through the grid and throws gold foil. Then the bubbles rise as for
 * any win, and the crown shrinks into the little one the square already wears.
 * ---------------------------------------------------------------------------------------- */

const WINE = "123, 30, 59"; // --color-wine
const CROWN_SVG = `
<svg viewBox="0 0 64 48" width="100%" height="100%" style="overflow:visible;display:block">
  <defs>
    <linearGradient id="vl-crown-gold" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="#f6e4b0"/>
      <stop offset="0.45" stop-color="#d9ae55"/>
      <stop offset="1" stop-color="#9a6d24"/>
    </linearGradient>
    <linearGradient id="vl-crown-glint" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/>
      <stop offset="0.5" stop-color="#fff" stop-opacity="0.9"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="vl-crown-clip">
      <path d="M6 35 3 12l15 11L32 5l14 18 15-11-3 23z"/>
      <rect x="5" y="35" width="54" height="10" rx="2.5"/>
    </clipPath>
  </defs>
  <g stroke="#6e4c17" stroke-width="1.3" stroke-linejoin="round">
    <path d="M6 35 3 12l15 11L32 5l14 18 15-11-3 23z" fill="url(#vl-crown-gold)"/>
    <rect x="5" y="35" width="54" height="10" rx="2.5" fill="url(#vl-crown-gold)"/>
    <circle cx="3" cy="11" r="3.4" fill="#f6e4b0"/>
    <circle cx="32" cy="4.5" r="3.6" fill="#f6e4b0"/>
    <circle cx="61" cy="11" r="3.4" fill="#f6e4b0"/>
  </g>
  <circle cx="18" cy="40" r="2.6" fill="#7b1e3b"/>
  <circle cx="32" cy="40" r="3" fill="#7b1e3b"/>
  <circle cx="46" cy="40" r="2.6" fill="#7b1e3b"/>
  <circle cx="31" cy="39" r="0.9" fill="#fff" opacity="0.8"/>
  <g clip-path="url(#vl-crown-clip)">
    <rect data-glint x="-30" y="-6" width="22" height="60" fill="url(#vl-crown-glint)" transform="skewX(-18)"/>
  </g>
</svg>`;

interface Foil {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rot: number;
  spin: number;
  flip: number;
  flipSpeed: number;
  born: number;
  life: number;
  color: string;
}

/** Gold leaf thrown up from the impact: little foil strips that flutter and catch the light as they turn. */
function throwFoil(originX: number, originY: number, scale = 1) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100vw", height: "100dvh", pointerEvents: "none", zIndex: "41" });
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const resize = () => {
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  document.body.appendChild(canvas);

  const start = performance.now();
  const count = window.innerWidth < 640 ? 46 : Math.round(72 * Math.sqrt(scale));
  const colors = [GOLD, GOLD, GOLD_SOFT, GOLD_SOFT, WINE];
  const foil: Foil[] = Array.from({ length: count }, () => {
    // A fan upwards from the impact, wider than tall, the odd one flung high.
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.95;
    const speed = (380 + Math.random() ** 0.7 * 560) * scale;
    return {
      x: originX + (Math.random() - 0.5) * 16,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      w: (4 + Math.random() * 5) * scale,
      h: (8 + Math.random() * 9) * scale,
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 9,
      flip: Math.random() * Math.PI * 2,
      flipSpeed: 7 + Math.random() * 9,
      born: start,
      life: 2400 + Math.random() * 1400,
      color: colors[Math.floor(Math.random() * colors.length)],
    };
  });

  let last = start;
  let raf = 0;
  const frame = (now: number) => {
    const dt = Math.min(now - last, 48) / 1000;
    last = now;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (let i = foil.length - 1; i >= 0; i--) {
      const f = foil[i];
      const age = now - f.born;
      if (age > f.life || f.y > window.innerHeight + 30) {
        foil.splice(i, 1);
        continue;
      }
      // Paper-light: strong drag, gentle gravity, and a sideways sway once it starts to fall.
      f.vx *= 1 - 2.6 * dt;
      f.vy = f.vy * (1 - 2.4 * dt) + 520 * scale * dt;
      f.x += (f.vx + Math.sin(age / 210 + f.flip) * 38 * scale) * dt;
      f.y += f.vy * dt;
      f.rot += f.spin * dt;
      f.flip += f.flipSpeed * dt;
      const turn = Math.cos(f.flip);
      const t = age / f.life;
      const alpha = t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot);
      ctx.scale(1, Math.max(0.08, Math.abs(turn)));
      // Facing you, the leaf catches the light; edge-on, it goes dark.
      const shine = Math.abs(turn) > 0.92 && f.color !== WINE;
      ctx.fillStyle = shine ? `rgba(255, 248, 225, ${alpha})` : `rgba(${f.color}, ${alpha * (0.65 + 0.35 * Math.abs(turn))})`;
      ctx.fillRect(-f.w / 2, -f.h / 2, f.w, f.h);
      ctx.restore();
    }
    if (foil.length) raf = requestAnimationFrame(frame);
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

/** The landing's shockwave: every square in the grid hops, later and lower the further away it is. */
function rippleGrid(el: HTMLElement) {
  const [col, row] = (el.dataset.cell ?? "").split("-").map(Number);
  const grid = el.parentElement?.parentElement;
  if (!grid || !col || !row) return;
  for (const cell of grid.querySelectorAll<HTMLElement>("[data-cell]")) {
    if (cell === el) continue;
    const [c, r] = (cell.dataset.cell ?? "").split("-").map(Number);
    const dist = Math.hypot(c - col, r - row);
    const k = 1 / (1 + dist * 0.45);
    cell.animate(
      [
        { transform: "translateY(0) scale(1)" },
        { transform: `translateY(${-9 * k}px) scale(${1 + 0.06 * k})`, offset: 0.3 },
        { transform: `translateY(${2.5 * k}px) scale(1)`, offset: 0.62 },
        { transform: "translateY(0) scale(1)" },
      ],
      { duration: 560, delay: dist * 62, easing: "cubic-bezier(0.33, 1, 0.68, 1)", fill: "backwards" },
    );
  }
}

let crowning = false;

export function crownFrom(el: HTMLElement, { scale = 1 }: CheerOptions = {}) {
  if (prefersCalm() || crowning) return;
  crowning = true;
  el.scrollIntoView({ block: "center", behavior: "smooth" });

  // The square's own small crown steps aside while the big one is in the air, and takes over at the end.
  const small = el.querySelector<SVGElement>("svg");
  if (small) small.style.opacity = "0";

  const cellW = el.getBoundingClientRect().width;
  const w = Math.max(64, Math.min(120 * scale, cellW * 1.45));
  const h = w * 0.75;

  const crown = document.createElement("div");
  crown.setAttribute("aria-hidden", "true");
  crown.innerHTML = CROWN_SVG;
  Object.assign(crown.style, {
    position: "fixed",
    left: "0",
    top: "0",
    width: `${w}px`,
    height: `${h}px`,
    pointerEvents: "none",
    zIndex: "42",
    transformOrigin: "50% 100%",
    filter: "drop-shadow(0 6px 10px rgba(44, 10, 20, 0.28))",
    willChange: "transform",
    // Hidden until the first frame places it; otherwise it sits in the top-left corner while the scroll starts.
    visibility: "hidden",
  });
  // A soft shadow on the square that sharpens as the crown comes down.
  const shadow = document.createElement("div");
  shadow.setAttribute("aria-hidden", "true");
  Object.assign(shadow.style, {
    position: "fixed",
    left: "0",
    top: "0",
    width: `${w * 0.9}px`,
    height: `${w * 0.16}px`,
    borderRadius: "50%",
    background: "radial-gradient(closest-side, rgba(44, 10, 20, 0.35), rgba(44, 10, 20, 0))",
    pointerEvents: "none",
    zIndex: "41",
    opacity: "0",
  });
  document.body.append(shadow, crown);

  // Falling body: y is where the crown's base is, measured against the square every frame, so a
  // scroll mid-flight still lands it on target.
  let y = -40;
  let vy = 0;
  let drift = (Math.random() < 0.5 ? -1 : 1) * (26 + Math.random() * 20);
  let rot = drift > 0 ? 16 : -16;
  let vrot = 0;
  let squash = 0;
  let vsquash = 0;
  let bounces = 0;
  let landedAt = 0;
  let last = performance.now();
  let raf = 0;
  const startY = y;

  const frame = (now: number) => {
    const dt = Math.min(now - last, 32) / 1000;
    last = now;
    const rect = el.getBoundingClientRect();
    const floor = rect.top + Math.min(6, rect.height * 0.12);
    const cx = rect.left + rect.width / 2;

    if (bounces < 3) {
      vy += 3400 * dt;
      y += vy * dt;
      if (y >= floor) {
        // Each hit squashes the crown and kicks its tilt; the bounce keeps under a third of the speed.
        y = floor;
        if (!landedAt) {
          landedAt = now;
          impact(rect);
        }
        vsquash += vy * 0.0042;
        vrot += (Math.random() - 0.5) * vy * 0.03;
        vy = -vy * 0.3;
        bounces = Math.abs(vy) < 90 ? 3 : bounces + 1;
      }
    } else {
      y = floor;
    }

    // The sideways drift closes as it falls; rotation and squash settle on damped springs.
    const progress = Math.min(1, Math.max(0, (y - startY) / Math.max(1, floor - startY)));
    drift *= landedAt ? 1 - Math.min(1, 14 * dt) : 1;
    const x = cx + drift * (landedAt ? 1 : (1 - progress) ** 2 + 0.0001);
    if (!landedAt) rot = (drift > 0 ? 16 : -16) * (1 - progress) ** 1.5;
    vrot += (-rot * 260 - vrot * 16) * dt;
    rot += vrot * dt;
    vsquash += (-squash * 900 - vsquash * 22) * dt;
    squash += vsquash * dt;
    const s = Math.max(-0.35, Math.min(0.35, squash));

    crown.style.visibility = "";
    crown.style.transform = `translate(${x - w / 2}px, ${y - h}px) rotate(${rot}deg) scale(${1 + s * 0.6}, ${1 - s * 0.6})`;
    shadow.style.transform = `translate(${cx - (w * 0.9) / 2}px, ${floor - w * 0.08}px) scale(${0.45 + 0.55 * progress})`;
    shadow.style.opacity = String(0.85 * progress ** 2);

    if (landedAt && now - landedAt > 650) return settle();
    raf = requestAnimationFrame(frame);
  };

  function impact(rect: DOMRect) {
    navigator.vibrate?.(28);
    rippleGrid(el);
    throwFoil(rect.left + rect.width / 2, rect.top + 4, scale);
    celebrateFrom(el, { scale });
  }

  // Resting on the square: a glint runs across the gold, then the crown shrinks into the small one.
  function settle() {
    const glint = crown.querySelector<SVGRectElement>("[data-glint]");
    glint?.animate([{ transform: "skewX(-18deg) translateX(0)" }, { transform: "skewX(-18deg) translateX(110px)" }], {
      duration: 720,
      easing: "cubic-bezier(0.45, 0, 0.2, 1)",
      fill: "forwards",
    });
    const from = crown.style.transform;
    setTimeout(() => {
      const target = (small ?? el).getBoundingClientRect();
      const now = crown.getBoundingClientRect();
      const scale = Math.max(0.08, target.width / now.width);
      const dx = target.left + target.width / 2 - (now.left + now.width / 2);
      const dy = target.bottom - now.bottom;
      shadow.animate([{ opacity: shadow.style.opacity }, { opacity: 0 }], { duration: 300, fill: "forwards" });
      const shrink = crown.animate(
        [
          { transform: from, opacity: 1 },
          { transform: `${from} translate(0, -10px) scale(1.06)`, opacity: 1, offset: 0.25 },
          { transform: `translate(${dx}px, ${dy}px) ${from} scale(${scale})`, opacity: 0.2 },
        ],
        { duration: 620, easing: "cubic-bezier(0.65, 0, 0.35, 1)", fill: "forwards" },
      );
      if (small) {
        small.style.opacity = "";
        // Only `transform` here: the centring is Tailwind's separate `translate` property.
        small.animate([{ opacity: 0, transform: "scale(1.8)" }, { opacity: 1, transform: "scale(1)" }], {
          duration: 340,
          delay: 470,
          easing: "cubic-bezier(0.16, 1, 0.3, 1)",
          fill: "backwards",
        });
      }
      shrink.onfinish = cleanup;
    }, 1150);
  }

  const cleanup = () => {
    cancelAnimationFrame(raf);
    document.removeEventListener("visibilitychange", onHide);
    crown.remove();
    shadow.remove();
    if (small) small.style.opacity = "";
    crowning = false;
  };
  const onHide = () => document.hidden && cleanup();
  document.addEventListener("visibilitychange", onHide);
  // Let the smooth scroll start before the drop.
  setTimeout(() => {
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }, 260);
}
