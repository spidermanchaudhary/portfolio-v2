import type { Skill } from "@/data/types";

/**
 * Toolbox — skills as an asteroid belt the camera flies through. In HTML
 * they're a typographic run, not a card grid.
 */
export default function Toolbox({ skills }: { skills: Skill[] }) {
  return (
    <section
      id="toolbox"
      data-station="toolbox"
      aria-labelledby="toolbox-title"
      className="relative flex min-h-[150vh] items-center px-5 sm:px-8 lg:px-12"
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
              data-sfx="tick"
              className="group inline-flex items-baseline gap-[0.35em] text-paper/90 transition-colors duration-300 hover:text-signal-hi"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={skill.image}
                alt=""
                width={28}
                height={28}
                loading="lazy"
                className="h-[0.6em] w-[0.6em] translate-y-[0.05em] object-contain opacity-70 grayscale transition duration-300 group-hover:opacity-100 group-hover:grayscale-0"
              />
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
