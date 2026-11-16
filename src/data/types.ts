/**
 * Shared content types. Every scene in the canvas and every semantic HTML
 * section reads from the same typed objects, so the 3D scene and the
 * accessible document can never drift apart.
 */

export type SectionId =
  | "top"
  | "origin"
  | "toolbox"
  | "work"
  | "signals"
  | "launch";

export interface Section {
  id: SectionId;
  /** Short label used by the HUD, nav and command palette */
  label: string;
  /** One-line description shown in the command palette */
  hint: string;
}

export interface Social {
  label: string;
  href: string;
  handle?: string;
}

export interface ContactDetail {
  label: string;
  value: string;
  href: string | null;
  /** Value written to the clipboard by the copy button */
  copy: string | null;
}

export interface OriginChapter {
  id: string;
  heading: string;
  title: string;
  subtitle?: string;
  image: string;
  /** Small (512px) copy used as a WebGL texture */
  texture: string;
  body: string;
}

export interface Skill {
  id: string;
  name: string;
  image: string;
}

export interface Metric {
  value: string;
  label: string;
}

export interface Project {
  id: string;
  slug: string;
  name: string;
  /** One-line summary derived from the description (no new claims) */
  tagline: string;
  /** Full description, verbatim from the source */
  description: string;
  thumbnail: string;
  demoLink: string;
  sourceCodeLink: string;
  /** Stack exactly as named in the description */
  stack: string[];
  /** Metrics exactly as stated in the description */
  metrics: Metric[];
  /** Reported user count, quoted from the description. null = not reported */
  users: number | null;
}

export interface Review {
  name: string;
  username: string;
  body: string;
  img: string;
}
