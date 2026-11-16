import "server-only";
import { projectsFallback, toProjects } from "./projects";
import { skillsSnapshot } from "./skills";
import type { ApiProject } from "./projects.snapshot";
import type { Project, Skill } from "./types";

/**
 * Server-side loaders. Projects and skills are still managed through the
 * existing API (api.sujal.info), but are now fetched on the server with ISR
 * so they ship in the HTML — crawlable, no client-side loading spinners.
 * If the API is unreachable at build/revalidate time, the snapshot is used.
 */
const API = process.env.NEXT_PUBLIC_API_URL || "https://api.sujal.info";
const REVALIDATE = 60 * 60; // 1 hour

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(API + path, {
      next: { revalidate: REVALIDATE },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: T };
    return body.data ?? null;
  } catch {
    return null;
  }
}

export async function getProjects(): Promise<Project[]> {
  const rows = await getJson<ApiProject[]>("/api/portfolio/projects");
  return rows && rows.length ? toProjects(rows) : projectsFallback;
}

export async function getSkills(): Promise<Skill[]> {
  const rows = await getJson<{ _id: string; name: string; image: string }[]>(
    "/api/portfolio/skills"
  );
  if (!rows || !rows.length) return skillsSnapshot;
  return rows.map((r) => ({ id: r._id, name: r.name, image: r.image }));
}
