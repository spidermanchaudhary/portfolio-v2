import { site } from "@/data/site";

export default function Colophon() {
  const year = new Date().getFullYear();
  return (
    <footer className="relative z-10 border-t border-line px-5 pb-24 pt-10 sm:px-8 lg:px-12">
      <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
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
