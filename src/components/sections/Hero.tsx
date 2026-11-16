import Link from "next/link";
import { site } from "@/data/site";

/**
 * Launchpad. The particle name lives in the canvas behind; this is the
 * real, crawlable headline. `.hero-fallback-name` shows a typographic
 * version of the particle name when WebGL is off or motion is reduced.
 */
export default function Hero() {
  return (
    <section
      id="top"
      data-station="top"
      aria-labelledby="hero-title"
      className="relative flex h-[100svh] min-h-[560px] flex-col justify-end px-5 pb-8 pt-24 sm:px-8 sm:pb-10 lg:px-12"
    >
      <p
        aria-hidden
        className="hero-fallback-name pointer-events-none absolute inset-x-0 top-[22%] select-none text-center font-display text-d-1 font-extrabold uppercase text-transparent wdth-cond [-webkit-text-stroke:1px_rgb(var(--paper)/0.35)]"
      >
        {site.firstName}
      </p>

      <div className="grid grid-cols-12 items-end gap-x-6 gap-y-8">
        <div className="col-span-12 lg:col-span-8">
          <p className="label mb-5 flex items-center gap-3" data-reveal>
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-signal-hi" aria-hidden />
            {site.role} · {site.affiliation}
          </p>
          <h1
            id="hero-title"
            className="font-display font-bold leading-[0.92] tracking-[-0.035em] text-balance [font-size:clamp(2.4rem,6.2vw,6.25rem)]"
          >
            <span className="sr-only">{site.headline}</span>
            <span aria-hidden className="block" data-split>
              {site.name} builds
            </span>
            <span aria-hidden className="block" data-split>
              <em className="not-italic text-signal-hi">useful things</em> for the web.
            </span>
          </h1>
        </div>

        <div className="col-span-12 flex flex-col gap-6 lg:col-span-4 lg:items-end lg:text-right">
          <p className="max-w-xs text-base leading-relaxed text-dust text-pretty" data-reveal>
            {site.lede}
          </p>
          <div className="flex flex-wrap items-center gap-3 lg:justify-end" data-reveal>
            <Link
              href="#work"
              data-cursor="button"
              data-magnetic
              className="group inline-flex h-12 items-center gap-3 bg-signal px-6 font-mono text-micro uppercase text-paper transition-colors hover:bg-signal-hi hover:text-void"
            >
              Enter the universe
              <span aria-hidden className="transition-transform duration-500 ease-out-expo group-hover:translate-y-0.5">
                ↓
              </span>
            </Link>
            <Link
              href="#launch"
              data-cursor="button"
              data-magnetic
              className="inline-flex h-12 items-center border border-line px-5 font-mono text-micro uppercase text-paper transition-colors hover:border-paper"
            >
              Get in touch
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-10 flex items-center justify-between border-t border-line pt-4">
        <span className="label">{site.status}</span>
        <span className="label hidden sm:inline">Scroll to fly</span>
        <span className="label">{site.location}</span>
      </div>
    </section>
  );
}
