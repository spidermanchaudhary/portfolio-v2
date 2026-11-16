import type { Project, Metric } from "./types";
import { projectsSnapshot, type ApiProject } from "./projects.snapshot";

/**
 * Per-project configuration, keyed by the API `_id`.
 *
 * Everything here is derived from the project's own description — metrics,
 * stack and user counts are quoted, never estimated. Projects without a
 * reported number simply show no metrics.
 *
 * `order` sets the display order.
 */
interface ProjectConfig {
  order: number;
  tagline: string;
  stack: string[];
  metrics: Metric[];
  users: number | null;
}

const CONFIG: Record<string, ProjectConfig> = {
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
  },
  "6856addebcdbacf66e86be73": {
    order: 1,
    tagline: "A college predictor built with TEAMGTC, used by over 400,000 students.",
    stack: [],
    metrics: [{ value: "400,000+", label: "students" }],
    users: 400000,
  },
  "6856addebcdbacf66e86be7a": {
    order: 2,
    tagline: "An anonymous, end-to-end encrypted social platform for college students.",
    stack: ["MongoDB", "Express.js", "React", "Node.js", "Socket.IO", "FCM", "Mailgun", "AWS S3"],
    metrics: [],
    users: null,
  },
  "6856addebcdbacf66e86be79": {
    order: 3,
    tagline: "Anonymous feedback through one shareable profile link.",
    stack: ["MongoDB", "Express.js", "React", "Node.js", "Socket.IO", "JWT"],
    metrics: [],
    users: null,
  },
  "6856addebcdbacf66e86be74": {
    order: 4,
    tagline: "Cloud storage with public and private accounts, folders, sharing and search.",
    stack: [],
    metrics: [],
    users: null,
  },
  "6856addebcdbacf66e86be72": {
    order: 5,
    tagline: "Roll-number lookup that helped over 1,000 NSUT students.",
    stack: ["HTML", "CSS", "JavaScript", "PHP"],
    metrics: [{ value: "1,000+", label: "students helped" }],
    users: 1000,
  },
  "6856addebcdbacf66e86be78": {
    order: 6,
    tagline: "A directory of student information and contact details at NSUT.",
    stack: ["HTML", "CSS", "JavaScript", "PHP"],
    metrics: [],
    users: null,
  },
};

export function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Merge raw API rows with per-project configuration and sort. */
export function toProjects(rows: ApiProject[]): Project[] {
  return rows
    .map((row, i) => {
      const cfg = CONFIG[row._id];
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
      };
      return { project, order: cfg?.order ?? 100 + i };
    })
    .sort((a, b) => a.order - b.order)
    .map(({ project }) => project);
}

export const projectsFallback = toProjects(projectsSnapshot);
