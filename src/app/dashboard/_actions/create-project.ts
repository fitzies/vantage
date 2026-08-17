"use server";

import {
  createProject,
  ProjectCreateError,
  type CreatedProject,
} from "@/lib/projects/create";
import { requireCurrentUser } from "@/lib/user-auth/session";

export type CreateProjectResult =
  | { ok: true; project: CreatedProject }
  | { ok: false; code: ProjectCreateError["code"] | "unauthorized"; error: string };

/**
 * Create a project from the dashboard UI.
 *
 * Server Actions are reachable directly, so this re-checks the current
 * Better Auth session instead of relying on the route proxy.
 */
export async function createProjectAction(input: {
  slug: string;
  name?: string;
}): Promise<CreateProjectResult> {
  const user = await requireCurrentUser();

  try {
    const project = await createProject({
      slug: input.slug,
      name: input.name,
      ownerUserId: user.id,
    });
    return { ok: true, project };
  } catch (err) {
    if (err instanceof ProjectCreateError) {
      return { ok: false, code: err.code, error: err.message };
    }
    console.error("[vantage] createProjectAction failed", err);
    return {
      ok: false,
      code: "db_error",
      error: "Something went wrong. Try again.",
    };
  }
}
