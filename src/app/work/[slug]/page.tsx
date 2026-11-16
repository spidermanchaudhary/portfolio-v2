import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getProjects } from "@/data/load";
import { site } from "@/data/site";
import { hostOf } from "@/components/sections/Worlds";
import WorldLink from "@/components/ui/WorldLink";
import BackToUniverse from "@/components/ui/BackToUniverse";
import FocusWorld from "@/components/ui/FocusWorld";

export const revalidate = 3600;

type Params = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const projects = await getProjects();
  return projects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const project = (await getProjects()).find((p) => p.slug === slug);
  if (!project) return {};
  const description = project.tagline;
  return {
    title: project.name,
    description,
    alternates: { canonical: `/work/${project.slug}` },
    openGraph: {
      title: `${project.name} — ${site.name}`,
      description,
      url: `${site.url}/work/${project.slug}`,
      type: "article",
      images: [{ url: project.thumbnail, alt: `${project.name} screenshot` }],
    },
    twitter: { card: "summary_large_image", title: `${project.name} — ${site.name}`, description, images: [project.thumbnail] },
  };
}

export default async function WorkPage({ params }: Params) {
  const { slug } = await params;
  const projects = await getProjects();
  const index = projects.findIndex((p) => p.slug === slug);
  if (index < 0) notFound();
  const project = projects[index];
  const next = projects[(index + 1) % projects.length];
  const host = hostOf(project.demoLink);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: project.name,
    description: project.description,
    url: project.demoLink || `${site.url}/work/${project.slug}`,
    image: project.thumbnail,
    applicationCategory: "WebApplication",
    operatingSystem: "Web",
    author: { "@type": "Person", name: site.name, url: site.url },
  };

  return (
    <article aria-labelledby="dossier-title" className="relative min-h-[100svh] px-5 pb-28 pt-24 sm:px-8 lg:px-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <FocusWorld slug={project.slug} />

      <BackToUniverse slug={project.slug} />

      <div className="mt-10 grid grid-cols-12 gap-x-6 gap-y-12">
        <header className="col-span-12 lg:col-span-6">
          <p className="label mb-5 flex items-center gap-3" data-reveal>
            <span aria-hidden className="inline-block h-2 w-2 rotate-45 border border-signal-hi" />
            World {index + 1} of {projects.length}
            {host && <span className="text-faint">· {host}</span>}
          </p>
          <h1 id="dossier-title" className="font-display text-d-1 font-extrabold uppercase wdth-cond" data-split>
            {project.name}
          </h1>
          <p className="mt-6 max-w-lg text-xl leading-snug text-paper/85 text-pretty" data-reveal>
            {project.tagline}
          </p>
        </header>

        <div className="col-span-12 space-y-10 lg:col-span-5 lg:col-start-8 lg:pt-24">
          {project.metrics.length > 0 && (
            <dl className="grid grid-cols-2 gap-px border border-line bg-line" data-reveal>
              {project.metrics.map((m) => (
                <div key={m.label} className="flex flex-col-reverse bg-void/85 px-4 py-3 backdrop-blur">
                  <dt className="label">{m.label}</dt>
                  <dd className="font-display text-3xl font-bold tracking-tight text-signal-hi">{m.value}</dd>
                </div>
              ))}
            </dl>
          )}

          <section aria-label="Description" className="space-y-4" data-reveal>
            {project.description
              .split(/\n+/)
              .filter(Boolean)
              .map((para, i) => (
                <p key={i} className="leading-relaxed text-dust text-pretty">
                  {para}
                </p>
              ))}
          </section>

          {project.stack.length > 0 && (
            <section aria-labelledby="stack-title" data-reveal>
              <h2 id="stack-title" className="label mb-3">
                Built with
              </h2>
              <ul className="flex flex-wrap gap-2">
                {project.stack.map((s) => (
                  <li key={s} className="border border-line px-2.5 py-1 font-mono text-micro uppercase text-paper/85">
                    {s}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="flex flex-wrap gap-3" data-reveal>
            {project.demoLink && (
              <a
                href={project.demoLink}
                target="_blank"
                rel="noopener"
                data-cursor="button"
                data-magnetic
                data-sfx="out"
                className="inline-flex h-12 items-center gap-3 bg-signal px-6 font-mono text-micro uppercase text-paper transition-colors hover:bg-signal-hi hover:text-void"
              >
                Visit {host || "live"} ↗
              </a>
            )}
            {project.sourceCodeLink && (
              <a
                href={project.sourceCodeLink}
                target="_blank"
                rel="noopener"
                data-cursor="button"
                data-sfx="out"
                className="inline-flex h-12 items-center border border-line px-5 font-mono text-micro uppercase text-paper transition-colors hover:border-paper"
              >
                Source code ↗
              </a>
            )}
          </div>

          <figure className="ticks border border-line bg-void/70 p-2 backdrop-blur" data-tilt data-cursor="scan" data-reveal>
            <Image
              src={project.thumbnail}
              alt={`${project.name} screenshot`}
              width={1280}
              height={720}
              sizes="(min-width: 1024px) 40vw, 92vw"
              className="aspect-video w-full object-cover object-top"
            />
            <figcaption className="flex justify-between px-1 pt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
              <span>transmission · {project.slug}</span>
              <span>{host}</span>
            </figcaption>
          </figure>

          <p className="border-l border-signal/60 pl-4 font-mono text-[0.72rem] leading-5 text-dust">
            <span className="text-signal-hi">in view —</span> {project.world.caption}
          </p>
        </div>
      </div>

      <nav aria-label="Next world" className="mt-24 border-t border-line pt-8">
        <p className="label mb-3">Next world</p>
        <WorldLink slug={next.slug} className="group inline-flex items-baseline gap-4 font-display text-d-3 font-bold">
          {next.name}
          <span aria-hidden className="text-signal-hi transition-transform duration-500 ease-out-expo group-hover:translate-x-2">
            →
          </span>
        </WorldLink>
      </nav>
    </article>
  );
}
