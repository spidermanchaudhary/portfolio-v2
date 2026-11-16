"use client";

import { useEffect, useState } from "react";
import * as THREE from "three";

const loader = new THREE.TextureLoader();
loader.setCrossOrigin("anonymous");
const cache = new Map<string, Promise<THREE.Texture>>();

/**
 * Non-suspending texture loader: returns null until loaded, and never
 * throws — one failed remote image can't take down the whole scene.
 */
export function useLazyTexture(url: string | null, srgb = true) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!url) return;
    let alive = true;
    let p = cache.get(url);
    if (!p) {
      p = loader.loadAsync(url).then((t) => {
        if (srgb) t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
        return t;
      });
      cache.set(url, p);
    }
    p.then((t) => alive && setTex(t)).catch(() => cache.delete(url));
    return () => {
      alive = false;
    };
  }, [url, srgb]);
  return tex;
}
