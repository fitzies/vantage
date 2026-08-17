import "server-only";

import { sql, type SQL } from "drizzle-orm";

import { db } from "@/lib/db/client";
import type { ProjectRole } from "@/lib/db/schema";

/**
 * Dashboard read-side queries.
 *
 * Schema-on-read: every visual you see in `_components/dashboard-view`
 * is computed from the wide `events` table here. No materialized rollups,
 * no per-app columns — just SQL against `events` + `projects`.
 *
 * Time windows are server-clock based (`now()`), not client-supplied.
 * "24h" means the trailing 24 hours; "prev" is the 24h before that.
 */

// ─── types ──────────────────────────────────────────────────────────────────

export type Platform = "web" | "ios" | "android" | "expo" | "mobile";
export type DashboardSurface = "web" | "mobile" | "mixed";

export type ProjectSummary = {
  id: string;
  slug: string;
  name: string;
  role: ProjectRole;
  writeKey: string | null;
  platform: Platform;
  events24h: number;
  /** Used to compute the "live rate" badge — events seen in the last 5 min. */
  events5m: number;
  rate: string;
};

export type Rollup = {
  events24h: number;
  count: number;
  rate: string;
};

export type EventBucket = { time: string; events: number; sessions: number };

export type EventsMeta = {
  total: number;
  peak: EventBucket;
  last: EventBucket;
};

export type Stat = {
  label: string;
  value: string;
  delta?: string;
  up?: boolean;
  bad?: boolean;
};

export type TopEvent = {
  name: string;
  count: string;
  pct: number;
  bad?: boolean;
};

export type EventTone = "default" | "violet" | "green" | "red" | "orange";

export type FeedRow = {
  t: string;
  event: string;
  page: string;
  session: string;
  tone: EventTone;
};

export type PageAggregate = {
  page: string;
  events: string;
  sessions: string;
  pct: number;
  lastSeen: string;
};

export type DashboardData = {
  surface: DashboardSurface;
  stats: Stat[];
  hourly: EventBucket[];
  hourlyMeta: EventsMeta;
  topEvents: TopEvent[];
  pages: PageAggregate[];
  feed: FeedRow[];
};

export type ProjectMemberSummary = {
  userId: string;
  email: string;
  name: string;
  role: ProjectRole;
};

// ─── helpers ────────────────────────────────────────────────────────────────

const ERROR_REGEX = "(error|fail|crash|exception)";
const SINGAPORE_TZ = "Asia/Singapore";

const sgHourMinute = new Intl.DateTimeFormat("en-SG", {
  timeZone: SINGAPORE_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const sgHourMinuteSecond = new Intl.DateTimeFormat("en-SG", {
  timeZone: SINGAPORE_TZ,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function num(v: unknown): number {
  // Neon's HTTP driver hands bigint back as strings. Normalize defensively.
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatRate(events5m: number): string {
  const perMin = events5m / 5;
  if (perMin < 1) return events5m === 0 ? "0/min" : "<1/min";
  return `${Math.round(perMin)}/min`;
}

export function surfaceForPlatform(platform: Platform): DashboardSurface {
  return platform === "ios" || platform === "android" || platform === "expo" || platform === "mobile"
    ? "mobile"
    : "web";
}

export function surfaceForProjects(projects: ReadonlyArray<ProjectSummary>): DashboardSurface {
  if (projects.length === 0) return "web";
  const surfaces = new Set(projects.map((project) => surfaceForPlatform(project.platform)));
  return surfaces.size === 1 ? [...surfaces][0]! : "mixed";
}

function formatDuration(secs: number): string {
  if (!Number.isFinite(secs) || secs <= 0) return "—";
  const mins = Math.floor(secs / 60);
  const rem = Math.round(secs - mins * 60);
  if (mins === 0) return `${rem}s`;
  return `${mins}m ${rem.toString().padStart(2, "0")}s`;
}

function formatDelta(curr: number, prev: number): { delta: string; up: boolean } | null {
  if (curr === 0 && prev === 0) return null;
  if (prev === 0) return { delta: "+100%", up: true };
  const pct = ((curr - prev) / prev) * 100;
  const sign = pct >= 0 ? "+" : "−";
  return {
    delta: `${sign}${Math.abs(pct).toFixed(1)}%`,
    up: pct >= 0,
  };
}

function toneFor(eventName: string): EventTone {
  const n = eventName.toLowerCase();
  if (n === "$pageview") return "default";
  if (/(error|fail|crash|exception)/.test(n)) return "red";
  if (/(signup|sign_up|sign-up|register|subscribe)/.test(n)) return "green";
  if (/(checkout|purchase|payment|paid|order)/.test(n)) return "orange";
  if (/(click|submit|send|tap)/.test(n)) return "violet";
  return "default";
}

function isErrorName(eventName: string): boolean {
  return /(error|fail|crash|exception)/i.test(eventName);
}

function formatHHMM(date: Date): string {
  return sgHourMinute.format(date);
}

function formatHHMMSS(date: Date): string {
  return sgHourMinuteSecond.format(date);
}

function truncate(value: string, max = 22): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function pageDimension(surface: DashboardSurface): SQL {
  if (surface === "mobile") {
    return sql`nullif(props->>'screen', '')`;
  }

  if (surface === "mixed") {
    return sql`coalesce(
      nullif(props->>'screen', ''),
      nullif(props->>'route_name', ''),
      nullif(props->>'view', ''),
      nullif(split_part(regexp_replace(url, '^https?://[^/]+', ''), '?', 1), ''),
      nullif(props->>'path', ''),
      nullif(props->>'pathname', '')
    )`;
  }

  return sql`coalesce(
    nullif(split_part(regexp_replace(url, '^https?://[^/]+', ''), '?', 1), ''),
    nullif(props->>'path', ''),
    nullif(props->>'pathname', ''),
    nullif(props->>'screen', ''),
    nullif(props->>'route_name', ''),
    nullif(props->>'view', '')
  )`;
}

function accessibleProjectPredicate(
  userId: string,
  projectId: string | null,
  eventProjectColumn: SQL,
) {
  const specificProject = projectId
    ? sql`and ${eventProjectColumn} = ${projectId}::uuid`
    : sql``;

  return sql`
    and ${eventProjectColumn} in (
      select pm.project_id
      from project_members pm
      where pm.user_id = ${userId}
    )
    ${specificProject}
  `;
}

// ─── projects + rollup ──────────────────────────────────────────────────────

/**
 * One row per project, with per-project 24h volume and a 5-minute live rate.
 *
 * Single roundtrip — joined aggregate. Uses the
 * `events_project_ts_idx` index for the time-window filter.
 */
export async function listProjects(userId: string): Promise<ProjectSummary[]> {
  const result = await db.execute<{
    id: string;
    slug: string;
    name: string;
    role: ProjectRole;
    write_key: string | null;
    platform: Platform | null;
    events_24h: string | number | null;
    events_5m: string | number | null;
  }>(sql`
    with project_events as (
      select
        p.id,
        p.slug,
        p.name,
        p.write_key,
        p.created_at,
        pm.role,
        e.id as event_row_id,
        e.timestamp,
        e.url,
        lower(coalesce(e.props->>'platform', '')) as platform_prop,
        lower(coalesce(e.props->>'sdk_name', '')) as sdk_name,
        lower(coalesce(e.props->>'sdk_type', '')) as sdk_type
      from projects p
      join project_members pm
        on pm.project_id = p.id
       and pm.user_id = ${userId}
      left join events e on e.project_id = p.id
    ),
    scored as (
      select
        *,
        (
          sdk_type in ('native_mobile', 'mobile')
          or sdk_name = 'vantage-expo'
          or (sdk_name = 'vantage-swift' and platform_prop in ('ios', 'iphone', 'ipad', ''))
        ) as is_mobile_sdk,
        (
          sdk_type in ('web', 'desktop')
          or sdk_name in ('vantage-tracker', 'vantage-web')
          or platform_prop in ('web', 'macos')
          or (url is not null and coalesce(sdk_name, '') = '' and coalesce(sdk_type, '') = '')
        ) as is_web_sdk
      from project_events
    )
    select
      id::text as id,
      slug,
      name,
      role,
      case when role = 'owner' then write_key else null end as write_key,
      case
        when count(event_row_id) filter (where is_mobile_sdk) > count(event_row_id) filter (where is_web_sdk)
          then case
            when count(event_row_id) filter (where is_mobile_sdk and platform_prop = 'android') > count(event_row_id) filter (where is_mobile_sdk and platform_prop in ('ios', 'iphone', 'ipad'))
              then 'android'
            when count(event_row_id) filter (where is_mobile_sdk and sdk_name = 'vantage-expo') > count(event_row_id) filter (where is_mobile_sdk and platform_prop in ('ios', 'iphone', 'ipad', 'android'))
              then 'expo'
            else 'ios'
          end
        else 'web'
      end as platform,
      coalesce(
        count(event_row_id) filter (where timestamp > now() - interval '24 hours'),
        0
      )::bigint as events_24h,
      coalesce(
        count(event_row_id) filter (where timestamp > now() - interval '5 minutes'),
        0
      )::bigint as events_5m
    from scored
    group by id, slug, name, write_key, created_at, role
    order by events_24h desc, created_at asc
  `);

  return result.rows.map((r) => {
    const events5m = num(r.events_5m);
    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      role: r.role,
      writeKey: r.write_key,
      platform: r.platform ?? "web",
      events24h: num(r.events_24h),
      events5m,
      rate: formatRate(events5m),
    };
  });
}

export function computeRollup(list: ProjectSummary[]): Rollup {
  const events24h = list.reduce((s, p) => s + p.events24h, 0);
  const events5m = list.reduce((s, p) => s + p.events5m, 0);
  return {
    events24h,
    count: list.length,
    rate: formatRate(events5m),
  };
}

export async function listProjectMembers(
  userId: string,
  projectId: string,
): Promise<ProjectMemberSummary[]> {
  const result = await db.execute<ProjectMemberSummary>(sql`
    select
      u.id as "userId",
      u.email,
      u.name,
      pm.role
    from project_members current_pm
    join project_members pm on pm.project_id = current_pm.project_id
    join "user" u on u.id = pm.user_id
    where current_pm.user_id = ${userId}
      and current_pm.project_id = ${projectId}::uuid
    order by case when pm.role = 'owner' then 0 else 1 end, u.email asc
  `);

  return result.rows;
}

// ─── dashboard data (per-project or all-projects) ───────────────────────────

/**
 * Fetch everything the dashboard view needs, in parallel.
 *
 * `projectId === null` means "all projects" (the rollup view). Otherwise
 * each query is scoped to that project.
 */
export async function getDashboardData(
  userId: string,
  projectId: string | null,
  surface: DashboardSurface = "web",
): Promise<DashboardData> {
  const [stats, hourly, topEvents, pages, feed] = await Promise.all([
    fetchStats(userId, projectId, surface),
    fetchHourly(userId, projectId),
    fetchTopEvents(userId, projectId),
    fetchPageAggregates(userId, projectId, surface),
    fetchFeed(userId, projectId, surface),
  ]);

  return {
    surface,
    stats,
    hourly,
    hourlyMeta: deriveMeta(hourly),
    topEvents,
    pages,
    feed,
  };
}

// ─── stats (the 6 numbers in the left pane) ─────────────────────────────────

async function fetchStats(
  userId: string,
  projectId: string | null,
  surface: DashboardSurface,
): Promise<Stat[]> {
  const projectFilter = accessibleProjectPredicate(
    userId,
    projectId,
    sql`events.project_id`,
  );

  const dimension = pageDimension(surface);
  const screenMetricFilter = surface === "mobile" ? sql`and event = 'screen_view'` : sql``;

  // Single round trip. Each metric is a FILTER aggregate over the 48h window
  // (24h current + 24h previous, for delta math). Mobile also gets an all-time
  // install count from `app_first_open`, which is the closest honest proxy for
  // App Store downloads from Vantage-owned data.
  const result = await db.execute<{
    events_24h: string | number | null;
    events_prev: string | number | null;
    sessions_24h: string | number | null;
    sessions_prev: string | number | null;
    pages_24h: string | number | null;
    pages_prev: string | number | null;
    active_devices_24h: string | number | null;
    active_devices_prev: string | number | null;
    installs_total: string | number | null;
    errors_24h: string | number | null;
    errors_prev: string | number | null;
    avg_session_secs: string | number | null;
  }>(sql`
    with windowed as (
      select
        project_id,
        event,
        user_id,
        anon_id,
        session_id,
        timestamp,
        ${dimension} as page,
        case
          when timestamp > now() - interval '24 hours' then 'curr'
          else 'prev'
        end as bucket
      from events
      where timestamp > now() - interval '48 hours'
        and timestamp <= now()
        ${projectFilter}
    ),
    sess as (
      select project_id, session_id, max(timestamp) - min(timestamp) as duration
      from windowed
      where bucket = 'curr' and session_id is not null
      group by project_id, session_id
    ),
    installs as (
      select count(distinct coalesce(anon_id, user_id, event_id, id::text))::bigint as installs_total
      from events
      where event = 'app_first_open'
        ${projectFilter}
    )
    select
      count(*) filter (where bucket = 'curr')::bigint as events_24h,
      count(*) filter (where bucket = 'prev')::bigint as events_prev,
      count(distinct (project_id, session_id)) filter (where bucket = 'curr' and session_id is not null)::bigint as sessions_24h,
      count(distinct (project_id, session_id)) filter (where bucket = 'prev' and session_id is not null)::bigint as sessions_prev,
      count(distinct page) filter (where bucket = 'curr' and page is not null ${screenMetricFilter})::bigint as pages_24h,
      count(distinct page) filter (where bucket = 'prev' and page is not null ${screenMetricFilter})::bigint as pages_prev,
      count(distinct coalesce(user_id, anon_id)) filter (where bucket = 'curr' and coalesce(user_id, anon_id) is not null)::bigint as active_devices_24h,
      count(distinct coalesce(user_id, anon_id)) filter (where bucket = 'prev' and coalesce(user_id, anon_id) is not null)::bigint as active_devices_prev,
      (select installs_total from installs) as installs_total,
      count(*) filter (where bucket = 'curr' and event ~* ${ERROR_REGEX})::bigint as errors_24h,
      count(*) filter (where bucket = 'prev' and event ~* ${ERROR_REGEX})::bigint as errors_prev,
      (
        select extract(epoch from avg(duration))::float8 from sess
      ) as avg_session_secs
    from windowed
  `);

  const r = result.rows[0];
  if (!r) return zeroStats(surface);

  const events24h = num(r.events_24h);
  const eventsPrev = num(r.events_prev);
  const sessions24h = num(r.sessions_24h);
  const sessionsPrev = num(r.sessions_prev);
  const pages24h = num(r.pages_24h);
  const pagesPrev = num(r.pages_prev);
  const activeDevices24h = num(r.active_devices_24h);
  const activeDevicesPrev = num(r.active_devices_prev);
  const installsTotal = num(r.installs_total);
  const errors24h = num(r.errors_24h);
  const errorsPrev = num(r.errors_prev);
  const avgSessionSecs =
    r.avg_session_secs === null || r.avg_session_secs === undefined
      ? null
      : num(r.avg_session_secs);

  const eventsPerSession = sessions24h > 0 ? events24h / sessions24h : null;

  if (surface === "mobile") {
    return [
      { label: "installs total", value: installsTotal.toLocaleString() },
      statRow("active devices", activeDevices24h.toLocaleString(), activeDevices24h, activeDevicesPrev),
      statRow("sessions", sessions24h.toLocaleString(), sessions24h, sessionsPrev),
      statRow("screens", pages24h.toLocaleString(), pages24h, pagesPrev),
      {
        label: "avg session",
        value: avgSessionSecs === null ? "—" : formatDuration(avgSessionSecs),
      },
      {
        ...statRow("errors", errors24h.toLocaleString(), errors24h, errorsPrev),
        bad: true,
      },
    ];
  }

  return [
    statRow("events", events24h.toLocaleString(), events24h, eventsPrev),
    statRow("sessions", sessions24h.toLocaleString(), sessions24h, sessionsPrev),
    statRow("pages", pages24h.toLocaleString(), pages24h, pagesPrev),
    {
      label: "avg session",
      value: avgSessionSecs === null ? "—" : formatDuration(avgSessionSecs),
    },
    {
      label: "events / sess",
      value: eventsPerSession === null ? "—" : eventsPerSession.toFixed(1),
    },
    {
      ...statRow("errors", errors24h.toLocaleString(), errors24h, errorsPrev),
      bad: true,
    },
  ];
}

function statRow(
  label: string,
  value: string,
  curr: number,
  prev: number,
): Stat {
  const d = formatDelta(curr, prev);
  if (!d) return { label, value };
  return { label, value, delta: d.delta, up: d.up };
}

function zeroStats(surface: DashboardSurface): Stat[] {
  if (surface === "mobile") {
    return [
      { label: "installs total", value: "0" },
      { label: "active devices", value: "0" },
      { label: "sessions", value: "0" },
      { label: "screens", value: "0" },
      { label: "avg session", value: "—" },
      { label: "errors", value: "0", bad: true },
    ];
  }

  return [
    { label: "events", value: "0" },
    { label: "sessions", value: "0" },
    { label: "pages", value: "0" },
    { label: "avg session", value: "—" },
    { label: "events / sess", value: "—" },
    { label: "errors", value: "0", bad: true },
  ];
}

// ─── hourly buckets (for the chart) ─────────────────────────────────────────

async function fetchHourly(
  userId: string,
  projectId: string | null,
): Promise<EventBucket[]> {
  const projectFilter = accessibleProjectPredicate(
    userId,
    projectId,
    sql`e.project_id`,
  );

  // generate_series fills in empty hours so the chart never has gaps. Buckets
  // are displayed and grouped in Singapore local time.
  const result = await db.execute<{
    time: string;
    events: string | number | null;
    sessions: string | number | null;
  }>(sql`
    with buckets as (
      select generate_series(
        date_trunc('hour', timezone(${SINGAPORE_TZ}, now())) - interval '23 hours',
        date_trunc('hour', timezone(${SINGAPORE_TZ}, now())),
        interval '1 hour'
      ) as bucket
    )
    select
      to_char(b.bucket, 'HH24:MI') as time,
      coalesce(count(e.id), 0)::bigint as events,
      coalesce(
        count(distinct (e.project_id, e.session_id)) filter (where e.session_id is not null),
        0
      )::bigint as sessions
    from buckets b
    left join events e
      on date_trunc('hour', timezone(${SINGAPORE_TZ}, e.timestamp)) = b.bucket
      and e.timestamp > now() - interval '24 hours'
      and e.timestamp <= now()
      ${projectFilter}
    group by b.bucket
    order by b.bucket asc
  `);

  return result.rows.map((r) => ({
    time: r.time,
    events: num(r.events),
    sessions: num(r.sessions),
  }));
}

function deriveMeta(buckets: EventBucket[]): EventsMeta {
  if (buckets.length === 0) {
    const empty: EventBucket = { time: "00:00", events: 0, sessions: 0 };
    return { total: 0, peak: empty, last: empty };
  }
  const peak = buckets.reduce(
    (max, d) => (d.events > max.events ? d : max),
    buckets[0]!,
  );
  const last = buckets[buckets.length - 1]!;
  const total = buckets.reduce((s, d) => s + d.events, 0);
  return { total, peak, last };
}

// ─── top events (left pane "top events" section) ────────────────────────────

async function fetchTopEvents(
  userId: string,
  projectId: string | null,
): Promise<TopEvent[]> {
  const projectFilter = accessibleProjectPredicate(
    userId,
    projectId,
    sql`events.project_id`,
  );

  const result = await db.execute<{
    event: string;
    count: string | number | null;
  }>(sql`
    select event, count(*)::bigint as count
    from events
    where timestamp > now() - interval '24 hours'
      ${projectFilter}
    group by event
    order by count desc
    limit 6
  `);

  if (result.rows.length === 0) return [];

  const max = num(result.rows[0]!.count) || 1;
  return result.rows.map((r) => {
    const count = num(r.count);
    return {
      name: r.event,
      count: count.toLocaleString(),
      pct: Math.max(1, Math.round((count / max) * 100)),
      bad: isErrorName(r.event),
    };
  });
}

// ─── pages (main pane aggregate) ────────────────────────────────────────────

async function fetchPageAggregates(
  userId: string,
  projectId: string | null,
  surface: DashboardSurface,
): Promise<PageAggregate[]> {
  const projectFilter = accessibleProjectPredicate(
    userId,
    projectId,
    sql`events.project_id`,
  );
  const dimension = pageDimension(surface);
  const mobileScreenOnly = surface === "mobile" ? sql`and event = 'screen_view'` : sql``;

  const result = await db.execute<{
    page: string;
    events: string | number | null;
    sessions: string | number | null;
    last_seen: string | Date | null;
  }>(sql`
    with windowed as (
      select
        project_id,
        session_id,
        timestamp,
        ${dimension} as page
      from events
      where timestamp > now() - interval '24 hours'
        and timestamp <= now()
        ${projectFilter}
        ${mobileScreenOnly}
    )
    select
      page,
      count(*)::bigint as events,
      count(distinct (project_id, session_id)) filter (where session_id is not null)::bigint as sessions,
      max(timestamp) as last_seen
    from windowed
    where page is not null
    group by page
    order by events desc, last_seen desc
  `);

  if (result.rows.length === 0) return [];

  const max = num(result.rows[0]!.events) || 1;
  return result.rows.map((r) => {
    const events = num(r.events);
    const lastSeen = r.last_seen
      ? formatHHMM(r.last_seen instanceof Date ? r.last_seen : new Date(r.last_seen))
      : "—";

    return {
      page: r.page,
      events: events.toLocaleString(),
      sessions: num(r.sessions).toLocaleString(),
      pct: Math.max(1, Math.round((events / max) * 100)),
      lastSeen,
    };
  });
}

// ─── live feed (right pane bottom) ──────────────────────────────────────────

async function fetchFeed(
  userId: string,
  projectId: string | null,
  surface: DashboardSurface,
): Promise<FeedRow[]> {
  const projectFilter = accessibleProjectPredicate(
    userId,
    projectId,
    sql`events.project_id`,
  );
  const dimension = pageDimension(surface);

  const result = await db.execute<{
    timestamp: string | Date;
    event: string;
    page: string | null;
    session_id: string | null;
  }>(sql`
    select
      timestamp,
      event,
      ${dimension} as page,
      session_id
    from events
    where timestamp > now() - interval '24 hours'
      ${projectFilter}
    order by timestamp desc
    limit 50
  `);

  return result.rows.map((r) => {
    const ts = r.timestamp instanceof Date ? r.timestamp : new Date(r.timestamp);
    return {
      t: formatHHMMSS(ts),
      event: r.event,
      page: r.page ?? "—",
      session: r.session_id ? `session ${truncate(r.session_id, 12)}` : "no session",
      tone: toneFor(r.event),
    };
  });
}
