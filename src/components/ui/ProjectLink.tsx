"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUniverse } from "@/store/universe";
import { startWarp, WARP_CHARGE } from "@/lib/warp";

/**
 * Link to a project page. With WebGL on, the HTML dissolves and the camera
 * eases forward first, then the route swaps underneath — the canvas persists in the
 * layout, so there is never a hard cut. Without WebGL (or with reduced
 * motion) it's a plain link.
 */
export default function ProjectLink({
  slug,
  className,
  children,
}: {
  slug: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const href = `/work/${slug}`;

  const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const { webgl, reducedMotion, set } = useUniverse.getState();
    if (!webgl || reducedMotion || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    // Hyperspace jump: charge up, swap the route at the peak, land
    startWarp();
    set({ focusSlug: slug });
    document.documentElement.dataset.transition = "in";
    window.setTimeout(() => router.push(href, { scroll: false }), WARP_CHARGE * 1000);
  };

  return (
    <Link href={href} onClick={onClick} data-cursor="scan" className={className}>
      {children}
    </Link>
  );
}
