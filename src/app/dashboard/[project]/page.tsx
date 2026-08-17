import { notFound } from "next/navigation";

import { requireCurrentUser } from "@/lib/user-auth/session";

import { DashboardView } from "../_components/dashboard-view";
import {
  computeRollup,
  getDashboardData,
  listProjectMembers,
  listProjects,
  surfaceForPlatform,
} from "../_data/queries";

export const dynamic = "force-dynamic";

export default async function ProjectDashboardPage({
  params,
}: {
  params: Promise<{ project: string }>;
}) {
  const { project: slug } = await params;

  const user = await requireCurrentUser();

  // listProjects is already user-scoped, so an unknown slug and a forbidden
  // slug both fall through to notFound without leaking project existence.
  const projects = await listProjects(user.id);
  const project = projects.find((p) => p.slug === slug);
  if (!project) notFound();

  const [data, members] = await Promise.all([
    getDashboardData(user.id, project.id, surfaceForPlatform(project.platform)),
    project.role === "owner" ? listProjectMembers(user.id, project.id) : [],
  ]);

  return (
    <DashboardView
      currentSlug={slug}
      project={project}
      projects={projects}
      rollup={computeRollup(projects)}
      data={data}
      members={members}
    />
  );
}
