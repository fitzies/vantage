import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/lib/db/client";

export type SummaryWindow = "24h" | "all";

type SummaryRow = {
  total_events: string | number | null;
  total_sessions: string | number | null;
};

type ActiveAppRow = {
  slug: string;
  name: string;
  active_users: string | number | null;
};

export type TelegramSummary = {
  window: SummaryWindow;
  totalEvents: number;
  totalSessions: number;
  activeApps: {
    slug: string;
    name: string;
    activeUsers: number;
  }[];
};

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function windowFilter(window: SummaryWindow) {
  if (window === "all") return sql``;
  return sql`and e.timestamp > now() - interval '24 hours' and e.timestamp <= now()`;
}

function titleFor(window: SummaryWindow): string {
  if (window === "all") return "Vantage report - all time";
  return "Vantage report - last 24h";
}

export async function getTelegramSummary(
  window: SummaryWindow = "24h",
): Promise<TelegramSummary> {
  const filter = windowFilter(window);

  const [totals, activeApps] = await Promise.all([
    db.execute<SummaryRow>(sql`
      select
        count(e.id)::bigint as total_events,
        count(distinct (e.project_id, e.session_id)) filter (
          where e.session_id is not null
        )::bigint as total_sessions
      from events e
      where true
        ${filter}
    `),
    db.execute<ActiveAppRow>(sql`
      select
        p.slug,
        p.name,
        count(distinct coalesce(e.user_id, e.anon_id))::bigint as active_users
      from projects p
      join events e on e.project_id = p.id
      where coalesce(e.user_id, e.anon_id) is not null
        ${filter}
      group by p.id, p.slug, p.name
      having count(distinct coalesce(e.user_id, e.anon_id)) > 0
      order by active_users desc, p.slug asc
    `),
  ]);

  const totalRow = totals.rows[0];

  return {
    window,
    totalEvents: num(totalRow?.total_events),
    totalSessions: num(totalRow?.total_sessions),
    activeApps: activeApps.rows.map((row) => ({
      slug: row.slug,
      name: row.name,
      activeUsers: num(row.active_users),
    })),
  };
}

export function formatTelegramSummary(summary: TelegramSummary): string {
  const lines = [
    titleFor(summary.window),
    "",
    `Total events: ${summary.totalEvents.toLocaleString()}`,
    `Total sessions: ${summary.totalSessions.toLocaleString()}`,
    "",
    "Active users by app:",
  ];

  if (summary.activeApps.length === 0) {
    lines.push("None");
  } else {
    for (const app of summary.activeApps) {
      lines.push(`- ${app.name} (${app.slug}): ${app.activeUsers.toLocaleString()}`);
    }
  }

  return lines.join("\n");
}
