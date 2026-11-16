import Image from "next/image";
import { origin } from "@/data/origin";
import { cn } from "@/lib/utils";

/**
 * Origin — the About chapters as stops along an orbit. In the canvas each
 * chapter is a beacon on a dotted trail; here, each is an article.
 */
export default function Origin() {
  return (
    <section id="origin" aria-labelledby="origin-title" className="relative">
      <header className="flex min-h-[70vh] items-end px-5 pb-16 sm:px-8 lg:px-12">
        <div className="max-w-3xl">
          <p className="label mb-4" data-reveal>
            Origin · {origin.length} stops on the orbit
          </p>
          <h2 id="origin-title" className="font-display text-d-2 font-bold wdth-cond" data-split>
            Where it starts.
          </h2>
        </div>
      </header>

      <ol className="space-y-0">
        {origin.map((chapter, i) => {
          const right = i % 2 === 1;
          return (
            <li
              key={chapter.id}
              data-station={`origin-${i}`}
              className="flex min-h-[115vh] items-center px-5 sm:px-8 lg:px-12"
            >
              <article
                aria-labelledby={`origin-${chapter.id}`}
                className={cn(
                  "grid w-full max-w-[1400px] grid-cols-12 gap-6",
                  right ? "lg:text-left" : ""
                )}
              >
                <div
                  className={cn(
                    "col-span-12 md:col-span-7 lg:col-span-5",
                    right ? "md:col-start-6 lg:col-start-8" : "lg:col-start-1"
                  )}
                >
                  <p className="label mb-4 flex items-center gap-3" data-reveal>
                    <span aria-hidden className="h-px w-8 bg-signal-hi" />
                    {chapter.heading}
                  </p>
                  <h3
                    id={`origin-${chapter.id}`}
                    className="font-display text-d-3 font-bold text-balance"
                    data-split
                  >
                    {chapter.title}
                  </h3>
                  {chapter.subtitle && (
                    <p className="mt-3 font-mono text-micro uppercase text-signal-hi" data-reveal>
                      {chapter.subtitle}
                    </p>
                  )}
                  <p className="mt-6 text-[1.0625rem] leading-relaxed text-dust text-pretty" data-reveal>
                    {chapter.body}
                  </p>
                  <figure className="ticks mt-8 w-40 border border-line p-1.5" data-reveal>
                    <Image
                      src={chapter.image}
                      alt=""
                      width={320}
                      height={400}
                      sizes="160px"
                      className="aspect-[4/5] w-full object-cover grayscale contrast-125"
                    />
                  </figure>
                </div>
              </article>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
