import { requireCurrentUser } from "@/lib/user-auth/session";

import { DashboardView } from "./_components/dashboard-view";
import {
  computeRollup,
  getDashboardData,
  listProjects,
  surfaceForProjects,
} from "./_data/queries";

// The dashboard reflects the live event log — never cache the page itself.
// (Per-query caching can come later via `use cache` once we have a sense of
// which slices people actually re-load.)
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireCurrentUser();
  const projects = await listProjects(user.id);
  const data = await getDashboardData(user.id, null, surfaceForProjects(projects));

  return (
    <DashboardView
      currentSlug={null}
      project={null}
      projects={projects}
      rollup={computeRollup(projects)}
      data={data}
      members={[]}
    />
  );
}
