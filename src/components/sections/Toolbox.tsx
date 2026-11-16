import type { Skill } from "@/data/types";

/** Logos drawn in white — they get a dark chip instead of the paper one */
const LIGHT_LOGOS = new Set(["github"]);

/**
 * Toolbox — skills as a typographic run with full-colour logos, not a
 * card grid.
 */
export default function Toolbox({ skills }: { skills: Skill[] }) {
  return (
    <section
      id="toolbox"
      data-station="toolbox"
      aria-labelledby="toolbox-title"
      className="relative flex min-h-[110vh] items-center px-5 sm:px-8 lg:px-12"
    >
      <div className="w-full">
        <p className="label mb-4" data-reveal>
          Toolbox · {skills.length} instruments on board
        </p>
        <h2 id="toolbox-title" className="sr-only">
          Toolbox
        </h2>
        <ul className="flex max-w-[1500px] flex-wrap items-baseline gap-x-[0.35em] gap-y-1 font-display text-d-3 font-bold leading-[1.05]">
          {skills.map((skill, i) => (
            <li
              key={skill.id}
              data-reveal
              className="group inline-flex items-baseline gap-[0.35em] text-paper/90 transition-colors duration-300 hover:text-paper"
            >
              {/* Chip behind each logo so every one reads in full colour on the dark page */}
              <span
                aria-hidden
                className={`inline-flex h-[0.78em] w-[0.78em] translate-y-[0.08em] items-center justify-center rounded-[0.18em] p-[0.1em] transition-transform duration-300 ease-out-expo group-hover:-rotate-6 group-hover:scale-110 ${
                  LIGHT_LOGOS.has(skill.name.toLowerCase()) ? "bg-[#24292f]" : "bg-paper"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={skill.image} alt="" width={40} height={40} loading="lazy" className="h-full w-full object-contain" />
              </span>
              <span>{skill.name}</span>
              {i < skills.length - 1 && (
                <span aria-hidden className="font-light text-faint">
                  /
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
