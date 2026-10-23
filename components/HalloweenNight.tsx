"use client";

import { useEffect, useRef } from "react";

// Halloween: the buyer page goes dark and your finger or pointer is a torch. The beam lights the
// cellar wall behind the content (bricks, cobwebs), and the eyes watching from the dark shut when
// it finds them. Everything moves by transform only; nothing here sits on top of the content.

const NIGHT = "#120c16";

// The content column (max-w-5xl) and the margin the eyes need beside it; narrower screens get none.
const COLUMN = 1024;
const MARGIN = 72;

// Where the eyes watch from: side (0 left, 1 right), how far out in the margin, and height in %.
const EYES = [
  { side: 0, out: 0.45, y: 22, s: 1, d: 0 },
  { side: 1, out: 0.6, y: 14, s: 0.8, d: 2.1 },
  { side: 0, out: 0.7, y: 63, s: 0.7, d: 4.3 },
  { side: 1, out: 0.4, y: 48, s: 1.1, d: 1.2 },
  { side: 1, out: 0.55, y: 84, s: 0.9, d: 3.4 },
  { side: 0, out: 0.35, y: 90, s: 0.8, d: 5.2 },
];

function eyeX(side: number, out: number, w: number) {
  const margin = (w - COLUMN) / 2;
  return side ? w - margin * out : margin * out;
}

export function HalloweenNight() {
  const root = useRef<HTMLDivElement>(null);
  const beam = useRef<HTMLDivElement>(null);
  const glow = useRef<HTMLDivElement>(null);
  const wall = useRef<HTMLDivElement>(null);
  const eyes = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]',
    );
    const prevTheme = meta?.content;
    if (meta) meta.content = NIGHT;

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = innerWidth;
    let h = innerHeight;
    let radius = Math.min(260, Math.max(150, Math.min(w, h) * 0.24));
    const pos = { x: w * 0.5, y: h * 0.22 };
    const target = { ...pos };
    let lastInput = -Infinity;
    let frame = 0;

    const place = () => {
      const bx = pos.x - radius;
      const by = pos.y - radius;
      if (beam.current) {
        beam.current.style.width =
          beam.current.style.height = `${radius * 2}px`;
        beam.current.style.transform = `translate3d(${bx}px, ${by}px, 0)`;
      }
      // The wall stays put on screen; only the window onto it moves.
      if (wall.current)
        wall.current.style.transform = `translate3d(${-bx}px, ${-by}px, 0)`;
      if (glow.current)
        glow.current.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
      const watching = (w - COLUMN) / 2 >= MARGIN;
      root.current?.classList.toggle("has-eyes", watching);
      if (!watching) return;
      eyes.current.forEach((el, i) => {
        if (!el) return;
        const e = EYES[i];
        const x = eyeX(e.side, e.out, w);
        el.style.left = `${x}px`;
        el.classList.toggle(
          "is-lit",
          Math.hypot(x - pos.x, (e.y / 100) * h - pos.y) < radius * 0.75,
        );
      });
    };

    const tick = (t: number) => {
      // Left alone, the torch wanders the room on its own.
      if (!reduced && t - lastInput > 3500) {
        const s = t / 1000;
        target.x = w * (0.5 + 0.36 * Math.sin(s * 0.23));
        target.y = h * (0.45 + 0.34 * Math.sin(s * 0.31 + 1.3));
      }
      const k = reduced ? 1 : t - lastInput > 3500 ? 0.03 : 0.2;
      pos.x += (target.x - pos.x) * k;
      pos.y += (target.y - pos.y) * k;
      place();
      frame = document.hidden ? 0 : requestAnimationFrame(tick);
    };

    const aim = (e: PointerEvent) => {
      target.x = e.clientX;
      target.y = e.clientY;
      lastInput = performance.now();
      if (reduced) place();
    };
    const resize = () => {
      w = innerWidth;
      h = innerHeight;
      radius = Math.min(260, Math.max(150, Math.min(w, h) * 0.24));
      place();
    };
    const wake = () => {
      if (!document.hidden && !frame && !reduced)
        frame = requestAnimationFrame(tick);
    };

    addEventListener("pointermove", aim, { passive: true });
    addEventListener("pointerdown", aim, { passive: true });
    addEventListener("resize", resize);
    document.addEventListener("visibilitychange", wake);
    place();
    wake();

    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("pointermove", aim);
      removeEventListener("pointerdown", aim);
      removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", wake);
      if (meta && prevTheme) meta.content = prevTheme;
    };
  }, []);

  return (
    <>
      <div
        ref={root}
        aria-hidden="true"
        className="night pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div className="night-fog" />
        <div ref={beam} className="night-beam">
          <div ref={wall} className="night-wall">
            <Cobweb className="left-0 top-0 w-[min(46vw,320px)]" />
            <Cobweb className="right-0 top-0 w-[min(38vw,260px)] -scale-x-100" />
            <Cobweb className="bottom-0 right-0 w-[min(30vw,220px)] rotate-180" />
            <Spider className="left-[18%] top-0 h-[38vh]" />
            <Spider className="right-[24%] top-0 h-[22vh]" />
          </div>
        </div>
        {EYES.map((e, i) => (
          <span
            key={i}
            ref={(el) => {
              eyes.current[i] = el;
            }}
            className="night-eyes"
            style={{ top: `${e.y}%`, scale: e.s, animationDelay: `${e.d}s` }}
          >
            <svg viewBox="0 0 40 12">
              <path d="M2 7c3-5 9-5 13 0-4 3-10 3-13 0Z" />
              <path d="M25 7c4-5 10-5 13 0-3 3-9 3-13 0Z" />
            </svg>
          </span>
        ))}
      </div>
      {/* A faint warm cast over the content itself, so the torch is felt even where the page covers the wall. */}
      <div ref={glow} aria-hidden="true" className="night-glow" />
    </>
  );
}

/** A corner web: spokes from the corner, sagging threads between them. */
function Cobweb({ className }: { className: string }) {
  const spokes = [4, 20, 37, 54, 71, 86];
  const rings = [0.22, 0.42, 0.62, 0.84];
  const pt = (deg: number, r: number) => {
    const a = (deg * Math.PI) / 180;
    return [Math.cos(a) * r * 200, Math.sin(a) * r * 200] as const;
  };
  return (
    <svg
      viewBox="0 0 200 200"
      className={`absolute ${className}`}
      fill="none"
      stroke="currentColor"
    >
      {spokes.map((d) => {
        const [x, y] = pt(d, 1);
        return <line key={d} x1="0" y1="0" x2={x} y2={y} strokeWidth="0.8" />;
      })}
      {rings.map((r) => (
        <path
          key={r}
          strokeWidth="0.6"
          d={spokes
            .slice(1)
            .map((d, i) => {
              const [x0, y0] = pt(spokes[i], r);
              const [x1, y1] = pt(d, r);
              const [cx, cy] = pt((d + spokes[i]) / 2, r * 0.82);
              return `${i ? "" : `M${x0} ${y0}`}Q${cx} ${cy} ${x1} ${y1}`;
            })
            .join("")}
        />
      ))}
    </svg>
  );
}

function Spider({ className }: { className: string }) {
  return (
    <span
      className={`night-spider absolute flex flex-col items-center ${className}`}
    >
      <span className="w-px flex-1 bg-current opacity-60" />
      <svg viewBox="0 0 24 18" className="w-6 fill-current">
        <ellipse cx="12" cy="9" rx="4" ry="5" />
        <circle cx="12" cy="3.5" r="2.4" />
        <path
          d="M8.5 7 3 3 1 6M8.5 9 2 9 0 12M8.5 11 3 14 2 17M15.5 7 21 3 23 6M15.5 9 22 9 24 12M15.5 11 21 14 22 17"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
