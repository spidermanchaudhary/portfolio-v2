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

/** Ask Cloudinary for a small PNG (also rasterises SVG logos). */
export function cloudinaryPng(url: string, size = 128) {
  return url.includes("/image/upload/") ? url.replace("/image/upload/", `/image/upload/f_png,w_${size},h_${size},c_fit/`) : url;
}
