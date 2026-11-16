/**
 * Shared content types. Every scene in the canvas and every semantic HTML
 * section reads from the same typed objects, so the 3D world and the
 * accessible document can never drift apart.
 */

export type SectionId =
  | "top"
  | "origin"
  | "toolbox"
  | "worlds"
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
  body: string;
}

export interface Skill {
  id: string;
  name: string;
  image: string;
}

/**
 * Each project world gets a bespoke mini-scene. `planet` is the generic
 * fallback used for projects that appear in the API but have no bespoke
 * scene yet.
 */
export type WorldKind =
  | "ocr-scan" // Hajiri — attendance sheet read by a scanning beam
  | "ranking-wall" // JEE College Predictor — cards that rank themselves
  | "cipher-pairs" // BlindBook — two crowds matched by encrypted beams
  | "feedback-swarm" // WTF — anonymous notes streaming into one profile
  | "vault" // Sdrive — files sorting into public/private stacks
  | "roll-search" // NSUT Rollno Search — a field of roll numbers, one lights up
  | "rolodex" // NSUT Students Directory — a spinning card index
  | "planet";

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
  /** Reported user count; drives planet size and glow. null = not reported */
  users: number | null;
  world: {
    kind: WorldKind;
    /** What the mini-scene is showing, for screen readers and captions */
    caption: string;
  };
}

export interface Review {
  name: string;
  username: string;
  body: string;
  img: string;
}
