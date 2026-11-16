import Image from "next/image";
import type { Project } from "@/data/types";
import { cn } from "@/lib/utils";
import ProjectLink from "@/components/ui/ProjectLink";

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Work — shipped projects. Each chapter is a station on the flight path, so
 * the starfield keeps moving behind it; the project itself is shown as its
 * real screenshot.
 */
export default function Work({ projects }: { projects: Project[] }) {
  return (
    <section id="work" aria-labelledby="work-title" className="relative">
      <header data-station="work-intro" className="flex min-h-[100vh] items-end px-5 pb-16 sm:px-8 lg:px-12">
        <div className="max-w-4xl">
          <p className="label mb-4" data-reveal>
            Work · {projects.length} shipped
          </p>
          <h2 id="work-title" className="font-display text-d-2 font-bold wdth-cond" data-split>
            Shipped &amp; in the wild.
          </h2>
        </div>
      </header>

      <ol>
        {projects.map((project, i) => (
          <li key={project.id} data-station={`project-${i}`} id={`project-${project.slug}`}>
            <ProjectChapter project={project} index={i} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function ProjectChapter({ project, index }: { project: Project; index: number }) {
  const flip = index % 2 === 1;
  const host = hostOf(project.demoLink);

  return (
    <article
      aria-labelledby={`project-title-${project.slug}`}
      className="flex min-h-[115vh] items-center px-5 py-16 sm:px-8 lg:px-12"
    >
      <div className="grid w-full grid-cols-12 items-center gap-x-6 gap-y-10 lg:gap-x-12">
        {/* Screenshot */}
        <div className={cn("col-span-12 lg:col-span-7", flip && "lg:order-2")} data-reveal>
          <ProjectLink
            slug={project.slug}
            className="group block border border-line bg-void/80 backdrop-blur transition-[border-color,transform] duration-500 ease-out-expo hover:-translate-y-1 hover:border-paper/40"
          >
            <span className="flex items-center gap-3 border-b border-line px-4 py-2.5">
              <span aria-hidden className="flex gap-1.5">
                <span className="h-2 w-2 rounded-full bg-line" />
                <span className="h-2 w-2 rounded-full bg-line" />
                <span className="h-2 w-2 rounded-full bg-signal-hi" />
              </span>
              <span className="truncate font-mono text-[11px] text-dust">{host || project.slug}</span>
              <span aria-hidden className="ml-auto font-mono text-micro uppercase text-faint transition-colors group-hover:text-signal-hi">
                open →
              </span>
            </span>
            <span className="block overflow-hidden">
              <Image
                src={project.thumbnail}
                alt={`${project.name} screenshot`}
                width={1280}
                height={720}
                sizes="(min-width: 1024px) 56vw, 92vw"
                className="aspect-video w-full object-cover object-top transition-transform duration-700 ease-out-expo group-hover:scale-[1.025]"
              />
            </span>
          </ProjectLink>
        </div>

        {/* Text */}
        <div className={cn("col-span-12 lg:col-span-5", flip && "lg:order-1")}>
          <p className="label mb-5 flex items-center gap-3" data-reveal>
            <span aria-hidden className="h-px w-8 bg-signal-hi" />
            {host || "project"}
          </p>
          <h3
            id={`project-title-${project.slug}`}
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
              {project.metrics.map((m, mi) => (
                <div
                  key={m.label}
                  className={cn(
                    "flex flex-col-reverse bg-void/85 px-4 py-3",
                    project.metrics.length % 2 === 1 && mi === project.metrics.length - 1 && "col-span-2"
                  )}
                >
                  <dt className="label">{m.label}</dt>
                  <dd className="font-display text-2xl font-bold tracking-tight text-signal-hi">{m.value}</dd>
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
            <ProjectLink
              slug={project.slug}
              className="group inline-flex h-11 items-center gap-3 bg-paper px-5 font-mono text-micro uppercase text-void transition-colors hover:bg-signal-hi"
            >
              View project
              <span aria-hidden className="transition-transform duration-500 ease-out-expo group-hover:translate-x-1">
                →
              </span>
            </ProjectLink>
            {project.demoLink && (
              <a
                href={project.demoLink}
                target="_blank"
                rel="noopener"
                data-cursor="button"
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
                className="link-ink px-2 font-mono text-micro uppercase text-dust hover:text-paper"
              >
                Source ↗<span className="sr-only"> for {project.name} (new tab)</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
