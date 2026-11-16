import type { Project } from "@/data/types";
import { cn } from "@/lib/utils";
import WorldLink from "@/components/ui/WorldLink";

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Worlds — every shipped project is a planet. Each chapter is a station
 * the camera parks at; the panel sits opposite the planet.
 */
export default function Worlds({ projects }: { projects: Project[] }) {
  return (
    <section id="worlds" aria-labelledby="worlds-title" className="relative">
      <header className="flex min-h-[80vh] items-end px-5 pb-16 sm:px-8 lg:px-12">
        <div className="grid w-full grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8">
            <p className="label mb-4" data-reveal>
              Worlds · {projects.length} shipped
            </p>
            <h2 id="worlds-title" className="font-display text-d-2 font-bold wdth-cond" data-split>
              The universe of shipped things.
            </h2>
          </div>
          <p className="col-span-12 max-w-sm self-end text-dust text-pretty lg:col-span-4 lg:justify-self-end" data-reveal>
            Planet size follows reported users. Worlds without a reported
            number stay at base size — nothing here is estimated.
          </p>
        </div>
      </header>

      <ol>
        {projects.map((project, i) => (
          <li key={project.id} data-station={`world-${i}`} id={`world-${project.slug}`}>
            <WorldChapter project={project} index={i} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function WorldChapter({ project, index }: { project: Project; index: number }) {
  const right = index % 2 === 1;
  const host = hostOf(project.demoLink);

  return (
    <article
      aria-labelledby={`world-title-${project.slug}`}
      className="flex min-h-[140vh] items-center px-5 sm:px-8 lg:px-12"
    >
      <div className="grid w-full grid-cols-12 gap-6">
        <div
          className={cn(
            "col-span-12 md:col-span-7 lg:col-span-5",
            right && "md:col-start-6 lg:col-start-8"
          )}
        >
          <p className="label mb-5 flex items-center gap-3" data-reveal>
            <span aria-hidden className="inline-block h-2 w-2 rotate-45 border border-signal-hi" />
            {host || "world"}
          </p>
          <h3
            id={`world-title-${project.slug}`}
            className="font-display text-d-2 font-extrabold wdth-cond text-balance"
            data-split
          >
            {project.name}
          </h3>
          <p className="mt-5 max-w-md text-lg leading-snug text-paper/85 text-pretty" data-reveal>
            {project.tagline}
          </p>

          {project.metrics.length > 0 && (
            <dl className="mt-8 grid max-w-md grid-cols-2 gap-px border border-line bg-line" data-reveal>
              {project.metrics.map((m) => (
                <div key={m.label} className="flex flex-col-reverse bg-void/85 px-4 py-3">
                  <dt className="label">{m.label}</dt>
                  <dd className="font-display text-2xl font-bold tracking-tight text-signal-hi">
                    {m.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {project.stack.length > 0 && (
            <p className="mt-6 max-w-md font-mono text-micro uppercase leading-6 text-dust" data-reveal>
              <span className="sr-only">Built with: </span>
              {project.stack.join(" · ")}
            </p>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-3" data-reveal>
            <WorldLink
              slug={project.slug}
              className="group inline-flex h-11 items-center gap-3 bg-paper px-5 font-mono text-micro uppercase text-void transition-colors hover:bg-signal-hi"
            >
              Enter world
              <span aria-hidden className="transition-transform duration-500 ease-out-expo group-hover:translate-x-1">
                →
              </span>
            </WorldLink>
            {project.demoLink && (
              <a
                href={project.demoLink}
                target="_blank"
                rel="noopener"
                data-cursor="button"
                data-sfx="out"
                className="inline-flex h-11 items-center border border-line px-4 font-mono text-micro uppercase text-paper transition-colors hover:border-paper"
              >
                Visit live ↗<span className="sr-only"> (opens {project.name} in a new tab)</span>
              </a>
            )}
            {project.sourceCodeLink && (
              <a
                href={project.sourceCodeLink}
                target="_blank"
                rel="noopener"
                data-cursor="button"
                data-sfx="out"
                className="link-ink px-2 font-mono text-micro uppercase text-dust hover:text-paper"
              >
                Source ↗<span className="sr-only"> for {project.name} (new tab)</span>
              </a>
            )}
          </div>

          <p className="mt-10 max-w-md border-l border-signal/60 pl-4 font-mono text-[0.72rem] leading-5 text-dust">
            <span className="text-signal-hi">in view —</span> {project.world.caption}
          </p>
        </div>
      </div>
    </article>
  );
}
