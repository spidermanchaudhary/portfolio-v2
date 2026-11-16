"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUniverse } from "@/store/universe";

/**
 * Link into a project world. With WebGL on, it first flies the camera into
 * the planet, then swaps the route underneath — the canvas persists in the
 * layout, so there is never a hard cut. Without WebGL (or with reduced
 * motion) it's a plain link.
 */
export default function WorldLink({
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
    set({ focusSlug: slug });
    document.documentElement.dataset.transition = "in";
    window.setTimeout(() => {
      router.push(href, { scroll: false });
    }, 750);
  };

  return (
    <Link href={href} onClick={onClick} data-cursor="scan" data-sfx="enter" className={className}>
      {children}
    </Link>
  );
}
