"use client";

import { useEffect } from "react";
import { useUniverse } from "@/store/universe";

/**
 * Mounted by /work/[slug]: parks the camera at this world for direct visits
 * and releases it on unmount.
 */
export default function FocusWorld({ slug }: { slug: string }) {
  useEffect(() => {
    const { set } = useUniverse.getState();
    set({ focusSlug: slug });
    delete document.documentElement.dataset.transition;
    window.scrollTo(0, 0);
    return () => {
      if (useUniverse.getState().focusSlug === slug) set({ focusSlug: null });
    };
  }, [slug]);
  return null;
}
