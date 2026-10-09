import Link from "next/link";

/** A die face showing four pips, styled like a sold grid square. */
function FourDie({ className = "" }: { className?: string }) {
  return (
    <div
      className={`grid size-16 grid-cols-2 place-items-center gap-0 rounded-[0.9rem] border border-wine-dark bg-wine p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_6px_14px_-6px_rgba(44,10,20,0.45)] sm:size-20 sm:p-4 ${className}`}
    >
      {Array.from({ length: 4 }, (_, i) => (
        <span key={i} className="size-2.5 rounded-full bg-cream sm:size-3" />
      ))}
    </div>
  );
}

/** The "0": no pips at all, an empty square in the draw. */
function BlankDie() {
  return (
    <div className="nf-blank cell-blocked size-16 rounded-[0.9rem] border border-dashed border-plum/25 sm:size-20" />
  );
}

export default function NotFoundView({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <section className="mx-auto flex max-w-md flex-col items-center pt-10 pb-6 text-center sm:pt-16">
      <div
        role="img"
        aria-label="404, slått med terninger: fire, tom rute, fire"
        className="flex items-end gap-3 sm:gap-4"
      >
        <FourDie className="nf-die nf-die-1" />
        <div className="nf-die nf-die-2">
          <BlankDie />
        </div>
        <FourDie className="nf-die nf-die-3" />
      </div>

      <p className="mt-4 font-display text-sm italic text-plum/65">Tom rute betyr nytt kast.</p>

      <h1 className="mt-10 text-balance font-display text-3xl font-semibold text-wine sm:text-4xl">
        {title}
      </h1>
      <p className="mt-3 max-w-[38ch] text-pretty text-plum/70">{body}</p>

      <div className="mt-8 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row sm:gap-5">
        <Link
          href="/"
          className="w-full rounded-lg bg-wine px-6 py-2.5 font-semibold text-cream transition-colors hover:bg-wine-dark sm:w-auto"
        >
          Til lotteriet
        </Link>
        <Link
          href="/historikk"
          className="py-2 text-sm text-plum/70 underline decoration-plum/25 underline-offset-4 transition-colors hover:text-wine hover:decoration-wine"
        >
          Se historikken
        </Link>
      </div>
    </section>
  );
}
