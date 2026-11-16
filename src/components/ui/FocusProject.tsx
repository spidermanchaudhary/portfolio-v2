"use client";

import { useEffect } from "react";
import { useUniverse } from "@/store/universe";
import { landWarp } from "@/lib/warp";

/**
 * Mounted by /work/[slug]: parks the camera at this project's station
 * and releases it on unmount.
 */
export default function FocusProject({ slug }: { slug: string }) {
  useEffect(() => {
    const { set } = useUniverse.getState();
    set({ focusSlug: slug });
    landWarp();
    delete document.documentElement.dataset.transition;
    window.scrollTo(0, 0);
    return () => {
      if (useUniverse.getState().focusSlug === slug) set({ focusSlug: null });
    };
  }, [slug]);
  return null;
}
