"use client";

import { prefersCalm } from "./Cheers";
import { Cobweb, Spider } from "./HalloweenNight";

// Halloween on the big screen. The room needs to read it from the back, so the ground stays light;
// the season lives in the palette (globals.css), the cobwebbed corners, a few bats crossing the top,
// and a swarm of bats bursting out of each winning square.

// Bats crossing the top band: start height and timing, in the 16:9 frame's own units.
const FLIGHTS = [
  { top: 4, dur: 26, delay: 0, size: 3.4 },
  { top: 9, dur: 34, delay: 11, size: 2.6 },
  { top: 2, dur: 30, delay: 21, size: 2.2 },
];

export function SkjermHalloweenDecor() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden text-plum/20">
      <Cobweb className="left-0 top-0 w-[32cqh]" />
      <Cobweb className="right-0 top-0 w-[26cqh] -scale-x-100" />
      <Cobweb className="bottom-0 left-0 w-[20cqh] -scale-y-100" />
      <Spider className="left-[1.3%] top-0 h-[34cqh] text-plum/45" />
      {FLIGHTS.map((f, i) => (
        <span
          key={i}
          className="skjerm-bat-flight"
          style={{ top: `${f.top}cqh`, animationDuration: `${f.dur}s`, animationDelay: `${-f.delay}s` }}
        >
          <Bat className="skjerm-bat text-plum/55" style={{ width: `${f.size}cqh` }} />
        </span>
      ))}
    </div>
  );
}

const BAT_PATH =
  "M20 5c1.2 0 2-1.6 2.4-3 .5 1.4.5 2.6.2 3.6 3.6-2.4 9.4-4.4 17.4-3.4-3.4 1.2-5 3.4-5.4 6.2-2.2-1.4-4.6-1-6.2.8-1.4-1.6-3.4-1.6-4.6.2-.9 2.6-2.6 4.6-3.8 7.6-1.2-3-2.9-5-3.8-7.6-1.2-1.8-3.2-1.8-4.6-.2-1.6-1.8-4-2.2-6.2-.8C5 5.6 3.4 3.4 0 2.2c8-1 13.8 1 17.4 3.4-.3-1-.3-2.2.2-3.6.4 1.4 1.2 3 2.4 3Z";

function Bat({ className, style }: { className: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 40 18" className={className} style={style} fill="currentColor">
      <path d={BAT_PATH} />
    </svg>
  );
}

/** A swarm of bats bursting out of a winning square and scattering off the screen. */
export function batsFrom(el: HTMLElement, { scale = 1 }: { scale?: number } = {}) {
  if (prefersCalm()) return;
  const box = el.getBoundingClientRect();
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  const reach = Math.hypot(innerWidth, innerHeight);
  const count = 16;
  for (let i = 0; i < count; i++) {
    // Spread mostly upwards, the way a startled swarm leaves.
    const angle = -Math.PI / 2 + (i / (count - 1) - 0.5) * Math.PI * 1.5 + (Math.random() - 0.5) * 0.4;
    const dist = reach * (0.55 + Math.random() * 0.35);
    const w = (26 + Math.random() * 22) * scale;
    const bat = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    bat.setAttribute("viewBox", "0 0 40 18");
    bat.setAttribute("aria-hidden", "true");
    bat.innerHTML = `<path d="${BAT_PATH}" fill="currentColor"/>`;
    Object.assign(bat.style, {
      position: "fixed",
      left: `${cx - w / 2}px`,
      top: `${cy - w / 4}px`,
      width: `${w}px`,
      color: i % 4 === 0 ? "#6a2c8a" : "#2c0a14",
      pointerEvents: "none",
      zIndex: "45",
    });
    document.body.appendChild(bat);
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    // Wings beat while the bat flies: a quick squash on the vertical axis, out of step per bat.
    const flap = bat.animate([{ scale: "1 1" }, { scale: "1 0.35" }, { scale: "1 1" }], {
      duration: 180 + Math.random() * 90,
      iterations: Infinity,
      delay: Math.random() * 120,
    });
    const wobble = (Math.random() - 0.5) * 120;
    const flight = bat.animate(
      [
        { transform: "translate(0, 0) scale(0.2)", opacity: 0 },
        { transform: `translate(${dx * 0.12}px, ${dy * 0.12}px) scale(1)`, opacity: 1, offset: 0.12 },
        { transform: `translate(${dx * 0.55 + wobble}px, ${dy * 0.55}px) scale(1.1)`, opacity: 1, offset: 0.6 },
        { transform: `translate(${dx}px, ${dy}px) scale(1.25)`, opacity: 0 },
      ],
      { duration: 1900 + Math.random() * 900, delay: i * 35, easing: "cubic-bezier(0.2, 0.7, 0.3, 1)", fill: "both" },
    );
    flight.onfinish = () => {
      flap.cancel();
      bat.remove();
    };
  }
}
