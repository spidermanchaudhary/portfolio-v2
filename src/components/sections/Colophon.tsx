import { site } from "@/data/site";
import Telemetry from "./Telemetry";

/**
 * The footer doubles as the launch stage: scrolling through this tall
 * section counts down, ignites and flies the rocket (scroll back to
 * reverse it). The actual footer content sits at the bottom.
 */
export default function Colophon() {
  const year = new Date().getFullYear();
  return (
    <footer data-station="liftoff" className="relative z-10 flex min-h-[150vh] flex-col justify-between px-5 pb-10 pt-[18vh] sm:px-8 lg:px-12">
      <div className="lite-hide">
        <Telemetry />
      </div>

      <div className="flex flex-col gap-8 border-t border-line pt-10 md:flex-row md:items-end md:justify-between">
        <p className="max-w-md font-display text-d-3 font-bold text-balance">{site.closing}</p>
        <div className="flex flex-col gap-2 md:items-end">
          <a href={site.blog} target="_blank" rel="noopener" data-cursor="button" className="link-ink font-mono text-micro uppercase text-dust hover:text-paper">
            Blog ↗
          </a>
          <p className="font-mono text-micro uppercase text-faint">
            © {year} {site.name} · {site.location}
          </p>
          <p className="hidden font-mono text-micro uppercase text-faint md:block">
            Press <kbd className="text-dust">⌘K</kbd> to navigate · <kbd className="text-dust">`</kbd> for a terminal
          </p>
        </div>
      </div>
    </footer>
  );
}
