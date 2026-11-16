import type { Project, WorldKind, Metric } from "./types";
import { projectsSnapshot, type ApiProject } from "./projects.snapshot";

/**
 * Per-project world configuration, keyed by the API `_id`.
 *
 * Everything here is derived from the project's own description — metrics,
 * stack and user counts are quoted, never estimated. Projects without a
 * reported user count render at base size with no impact glow.
 *
 * `order` sets the flight path through the universe.
 */
interface WorldConfig {
  order: number;
  tagline: string;
  stack: string[];
  metrics: Metric[];
  users: number | null;
  kind: WorldKind;
  caption: string;
}

const WORLDS: Record<string, WorldConfig> = {
  "68f871ea910907fc9fd765ee": {
    order: 0,
    tagline: "Attendance automation for NSUT — from 3–5 minutes down to 1–2 seconds.",
    stack: ["Next.js", "Node.js", "MongoDB", "Cheerio", "JWT", "Azure Blob Storage", "Tesseract OCR"],
    metrics: [
      { value: "4,000+", label: "users" },
      { value: "1,500+", label: "daily active" },
      { value: "5–6k", label: "daily fetches" },
      { value: "40%", label: "of NSUT students" },
    ],
    users: 4000,
    kind: "ocr-scan",
    caption:
      "An attendance sheet floats in space. A scanning beam sweeps across it, decodes the CAPTCHA strip, and ticks light up row by row.",
  },
  "6856addebcdbacf66e86be73": {
    order: 1,
    tagline: "A college predictor built with TEAMGTC, used by over 400,000 students.",
    stack: [],
    metrics: [{ value: "400,000+", label: "students" }],
    users: 400000,
    kind: "ranking-wall",
    caption:
      "A drifting wall of college cards. As you approach, they sort and rank themselves into ordered columns, with the best match lifting out.",
  },
  "6856addebcdbacf66e86be7a": {
    order: 2,
    tagline: "An anonymous, end-to-end encrypted social platform for college students.",
    stack: ["MongoDB", "Express.js", "React", "Node.js", "Socket.IO", "FCM", "Mailgun", "AWS S3"],
    metrics: [],
    users: null,
    kind: "cipher-pairs",
    caption:
      "Two crowds of anonymous students drift apart. Encrypted beams link pairs across the gap, scrambling their messages in transit.",
  },
  "6856addebcdbacf66e86be79": {
    order: 3,
    tagline: "Anonymous feedback through one shareable profile link.",
    stack: ["MongoDB", "Express.js", "React", "Node.js", "Socket.IO", "JWT"],
    metrics: [],
    users: null,
    kind: "feedback-swarm",
    caption:
      "A single profile core with a link ring. Anonymous notes stream in from every direction in real time and dock against it.",
  },
  "6856addebcdbacf66e86be74": {
    order: 4,
    tagline: "Cloud storage with public and private accounts, folders, sharing and search.",
    stack: [],
    metrics: [],
    users: null,
    kind: "vault",
    caption:
      "Loose files orbit a vault. As you approach, they sort by type into stacks — one open public shelf, one sealed private shelf.",
  },
  "6856addebcdbacf66e86be72": {
    order: 5,
    tagline: "Roll-number lookup that helped over 1,000 NSUT students.",
    stack: ["HTML", "CSS", "JavaScript", "PHP"],
    metrics: [{ value: "1,000+", label: "students helped" }],
    users: 1000,
    kind: "roll-search",
    caption:
      "A field of roll-number tiles. A search beam sweeps the grid and a single matching tile rises out of it.",
  },
  "6856addebcdbacf66e86be78": {
    order: 6,
    tagline: "A directory of student information and contact details at NSUT.",
    stack: ["HTML", "CSS", "JavaScript", "PHP"],
    metrics: [],
    users: null,
    kind: "rolodex",
    caption: "A card index spins like a rolodex and settles on one student record.",
  },
};

export function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Merge raw API rows with world configuration and sort into flight order. */
export function toProjects(rows: ApiProject[]): Project[] {
  return rows
    .map((row, i) => {
      const cfg = WORLDS[row._id];
      const project: Project = {
        id: row._id,
        slug: slugify(row.name),
        name: row.name,
        tagline: cfg?.tagline ?? row.description.split(/(?<=[.!?])\s/)[0],
        description: row.description,
        thumbnail: row.thumbnail,
        demoLink: row.demoLink ?? "",
        sourceCodeLink: row.sourceCodeLink ?? "",
        stack: cfg?.stack ?? [],
        metrics: cfg?.metrics ?? [],
        users: cfg?.users ?? null,
        world: {
          kind: cfg?.kind ?? "planet",
          caption: cfg?.caption ?? `A world for ${row.name}.`,
        },
      };
      return { project, order: cfg?.order ?? 100 + i };
    })
    .sort((a, b) => a.order - b.order)
    .map(({ project }) => project);
}

export const projectsFallback = toProjects(projectsSnapshot);

/**
 * Planet radius multiplier from reported users. Logarithmic, so 400k users
 * reads as clearly larger than 4k without swallowing the scene.
 * null (not reported) → 1.
 */
export function impactScale(users: number | null) {
  if (!users) return 1;
  return 1 + 0.36 * Math.log10(users / 1000 + 1);
}
