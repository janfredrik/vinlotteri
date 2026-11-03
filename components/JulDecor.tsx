"use client";

import { prefersCalm } from "./Cheers";

// Jul: a string of fairy lights hung under the header (and across the top of the big screen), the
// sold squares wrapped as presents (globals.css), and on the big screen a burst of stars out of
// each winning square. The house palette only shifts a little, so it stays the same lottery.

const WIDTH = 2400;
const SWAG = 160;
const DIP = 18;
const BULBS = ["#e0473f", "#f2c14e", "#3f9b52", "#4f8fd6", "#f6ead2"];

// A point on swag `i` at t (0..1): a quadratic curve from nail to nail, sagging DIP in the middle.
function onSwag(i: number, t: number) {
  const x0 = i * SWAG;
  const x = x0 + t * SWAG;
  const y = 4 + 2 * (1 - t) * t * DIP * 2;
  // The slope, so each bulb hangs square to the wire.
  const dy = (1 - 2 * t) * DIP * 4;
  return { x, y, angle: (Math.atan2(dy, SWAG) * 180) / Math.PI };
}

const SWAGS = Array.from({ length: WIDTH / SWAG }, (_, i) => i);
const STOPS = [0.2, 0.5, 0.8];

/** The fairy lights. Purely decorative; the twinkle stops with reduced motion. */
export function Lyslenke({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${WIDTH} 48`}
      preserveAspectRatio="xMidYMin slice"
      className={`pointer-events-none block ${className}`}
    >
      <path
        d={SWAGS.map((i) => `${i ? "" : "M0 4"}Q${i * SWAG + SWAG / 2} ${4 + DIP * 2} ${(i + 1) * SWAG} 4`).join("")}
        fill="none"
        stroke="#2f3b2a"
        strokeOpacity="0.55"
        strokeWidth="1.4"
      />
      {SWAGS.flatMap((i) =>
        STOPS.map((t, j) => {
          const n = i * STOPS.length + j;
          const { x, y, angle } = onSwag(i, t);
          const color = BULBS[(n * 3 + i) % BULBS.length];
          return (
            <g key={n} transform={`translate(${x} ${y}) rotate(${angle})`}>
              <rect x="-2.2" y="0" width="4.4" height="4" rx="1" fill="#2f3b2a" fillOpacity="0.7" />
              <g className="jul-bulb" style={{ animationDelay: `${-((n * 0.37) % 2.6)}s`, color }}>
                <circle cx="0" cy="10" r="9" fill="currentColor" opacity="0.22" />
                <ellipse cx="0" cy="9.5" rx="3.6" ry="5.6" fill="currentColor" />
                <ellipse cx="-1.1" cy="7.8" rx="0.9" ry="1.8" fill="#fff" opacity="0.55" />
              </g>
            </g>
          );
        }),
      )}
    </svg>
  );
}

/** On the buyer page the lights hang from the header across the whole window, whatever the column. */
export function JulLights() {
  return (
    <div className="-mt-6 h-8 sm:h-9">
      <div className="absolute inset-x-0">
        <Lyslenke className="h-10 w-full sm:h-12" />
      </div>
    </div>
  );
}

// Snow on the big screen: fixed spread so server and client render the same.
const FLAKES = [
  { left: 3, delay: 0, dur: 19, size: 1.6 },
  { left: 11, delay: 8, dur: 23, size: 1.1 },
  { left: 19, delay: 3, dur: 21, size: 1.4 },
  { left: 28, delay: 13, dur: 25, size: 1 },
  { left: 37, delay: 6, dur: 20, size: 1.3 },
  { left: 63, delay: 10, dur: 24, size: 1.1 },
  { left: 72, delay: 1, dur: 22, size: 1.5 },
  { left: 81, delay: 15, dur: 26, size: 1 },
  { left: 89, delay: 4, dur: 20, size: 1.3 },
  { left: 96, delay: 11, dur: 23, size: 1.2 },
];

export function SkjermJulDecor() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <Lyslenke className="absolute inset-x-0 top-0 h-[4cqh] w-full" />
      <div className="season-drift absolute inset-0">
      {FLAKES.map((f, i) => (
        <span
          key={i}
          className="season-flake text-sage"
          style={{
            left: `${f.left}%`,
            animationDelay: `${-f.delay}s`,
            animationDuration: `${f.dur}s`,
            fontSize: `${f.size * 2}cqh`,
          }}
        >
          ❄
        </span>
      ))}
      </div>
    </div>
  );
}

const STARS = ["★", "✦", "❄", "★", "✧"];
const STAR_COLORS = ["#c2933a", "#8e1a2b", "#2f5d3a", "#e0b04a"];

/** Stars and snowflakes bursting out of a winning square and falling away. */
export function starsFrom(el: HTMLElement, { scale = 1 }: { scale?: number } = {}) {
  if (prefersCalm()) return;
  const box = el.getBoundingClientRect();
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  const reach = Math.min(innerWidth, innerHeight);
  const count = 22;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const dist = reach * (0.18 + Math.random() * 0.22);
    const size = (16 + Math.random() * 18) * scale;
    const star = document.createElement("span");
    star.setAttribute("aria-hidden", "true");
    star.textContent = STARS[i % STARS.length];
    Object.assign(star.style, {
      position: "fixed",
      left: `${cx - size / 2}px`,
      top: `${cy - size / 2}px`,
      width: `${size}px`,
      lineHeight: "1",
      textAlign: "center",
      fontSize: `${size}px`,
      color: STAR_COLORS[i % STAR_COLORS.length],
      pointerEvents: "none",
      zIndex: "45",
    });
    document.body.appendChild(star);
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    // Out like a burst, then a slow fall with a little drift, the way snow settles.
    const fall = reach * (0.25 + Math.random() * 0.2);
    const spin = (Math.random() - 0.5) * 540;
    const flight = star.animate(
      [
        { transform: "translate(0, 0) scale(0.2) rotate(0deg)", opacity: 0 },
        { transform: `translate(${dx}px, ${dy}px) scale(1) rotate(${spin * 0.4}deg)`, opacity: 1, offset: 0.3 },
        { transform: `translate(${dx * 1.15}px, ${dy + fall}px) scale(0.8) rotate(${spin}deg)`, opacity: 0 },
      ],
      { duration: 2200 + Math.random() * 900, delay: i * 20, easing: "cubic-bezier(0.2, 0.7, 0.4, 1)", fill: "both" },
    );
    flight.onfinish = () => star.remove();
  }
}
