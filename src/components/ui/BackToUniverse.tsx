"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUniverse } from "@/store/universe";
import { startWarp, WARP_CHARGE } from "@/lib/warp";

/**
 * Leave a project: release camera focus (it eases back onto the track),
 * then return to the home page at this project's chapter.
 */
export default function BackToUniverse({ slug }: { slug: string }) {
  const router = useRouter();
  const href = `/#project-${slug}`;
  return (
    <Link
      href={href}
      data-cursor="button"
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey) return;
        e.preventDefault();
        startWarp();
        document.documentElement.dataset.transition = "in";
        window.setTimeout(() => {
          useUniverse.getState().set({ focusSlug: null });
          router.push(href, { scroll: false });
        }, WARP_CHARGE * 1000);
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
