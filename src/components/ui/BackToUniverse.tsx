"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUniverse } from "@/store/universe";

/**
 * Leave a world: release camera focus (it eases back out along the track),
 * then return to the home page at this world's chapter.
 */
export default function BackToUniverse({ slug }: { slug: string }) {
  const router = useRouter();
  const href = `/#world-${slug}`;
  return (
    <Link
      href={href}
      data-cursor="button"
      data-sfx="back"
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey) return;
        e.preventDefault();
        useUniverse.getState().set({ focusSlug: null });
        router.push(href, { scroll: false });
      }}
      className="group inline-flex items-center gap-3 font-mono text-micro uppercase text-dust hover:text-paper"
    >
      <span aria-hidden className="transition-transform duration-500 ease-out-expo group-hover:-translate-x-1">
        ←
      </span>
      Back to the universe
    </Link>
  );
}
