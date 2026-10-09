import { seasonInfo, type Season } from "@/lib/season";

// Fixed spread so server and client render the same layer (no Math.random in render).
const DRIFT = [
  { left: 4, delay: 0, dur: 14, size: 1 },
  { left: 13, delay: 6, dur: 17, size: 0.8 },
  { left: 22, delay: 2.5, dur: 15, size: 1.15 },
  { left: 31, delay: 9, dur: 18, size: 0.9 },
  { left: 42, delay: 4, dur: 16, size: 1 },
  { left: 53, delay: 11, dur: 19, size: 0.75 },
  { left: 61, delay: 1, dur: 15, size: 1.1 },
  { left: 70, delay: 7.5, dur: 17, size: 0.85 },
  { left: 79, delay: 3, dur: 14, size: 1 },
  { left: 88, delay: 10, dur: 18, size: 0.9 },
  { left: 95, delay: 5, dur: 16, size: 1.05 },
];

/** Slowly drifting seasonal emoji behind the page. Purely decorative; gone with reduced motion. */
export function SeasonDrift({ season }: { season: Season }) {
  const { particles } = seasonInfo(season);
  return (
    <div aria-hidden="true" className="season-drift pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {DRIFT.map((d, i) => (
        <span
          key={i}
          className="season-flake"
          style={{
            left: `${d.left}%`,
            animationDelay: `${-d.delay}s`,
            animationDuration: `${d.dur}s`,
            fontSize: `${d.size * 1.25}rem`,
          }}
        >
          {particles[i % particles.length]}
        </span>
      ))}
    </div>
  );
}

export function SeasonGreeting({ season }: { season: Season }) {
  const { emoji, greeting } = seasonInfo(season);
  return (
    <span className="season-greeting ml-2 inline-flex translate-y-[-0.2em] items-center gap-1 rounded-full bg-gold-soft/70 px-2.5 py-0.5 align-middle font-sans text-xs font-semibold text-plum">
      <span aria-hidden="true">{emoji}</span> {greeting}
    </span>
  );
}
