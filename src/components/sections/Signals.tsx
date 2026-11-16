import type { Review } from "@/data/types";

/**
 * Signals — notes received, rendered as an incoming transmission log.
 * Two rows drift in opposite directions; hover pauses.
 */
export default function Signals({ reviews }: { reviews: Review[] }) {
  const rows = [reviews.slice(0, Math.ceil(reviews.length / 2)), reviews.slice(Math.ceil(reviews.length / 2))];

  return (
    <section
      id="signals"
      data-station="signals"
      aria-labelledby="signals-title"
      className="relative flex min-h-[130vh] flex-col justify-center gap-10 overflow-hidden py-24"
    >
      <div className="px-5 sm:px-8 lg:px-12">
        <p className="label mb-4" data-reveal>
          Signals · {reviews.length} transmissions received
        </p>
        <h2 id="signals-title" className="font-display text-d-2 font-bold wdth-cond" data-split>
          Notes from the outside.
        </h2>
      </div>

      {/* Screen readers get a plain list; the marquee rows are decorative duplicates */}
      <ul className="sr-only">
        {reviews.map((r) => (
          <li key={r.username}>
            <blockquote>{r.body}</blockquote> — {r.name}
          </li>
        ))}
      </ul>

      <div aria-hidden className="space-y-4 [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
        {rows.map((row, r) => (
          <div key={r} className="group flex overflow-hidden [--gap:1rem]">
            <div
              className="flex shrink-0 animate-marquee gap-4 pr-4 group-hover:[animation-play-state:paused]"
              style={{ animationDirection: r % 2 ? "reverse" : "normal", ["--duration" as string]: "60s" }}
            >
              {[...row, ...row].map((review, i) => (
                <figure
                  key={review.username + i}
                  className="w-[min(78vw,380px)] shrink-0 border border-line bg-void/70 p-5 backdrop-blur-sm"
                >
                  <p className="mb-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
                    <span>rx · {review.username}</span>
                    <span className="text-signal-hi">●</span>
                  </p>
                  <blockquote className="text-[0.95rem] leading-relaxed text-paper/85">
                    {review.body}
                  </blockquote>
                  <figcaption className="mt-4 font-mono text-micro uppercase text-dust">— {review.name}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
