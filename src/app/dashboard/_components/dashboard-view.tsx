import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  Globe2Icon,
  SmartphoneIcon,
  TrendingUpIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

import {
  surfaceForPlatform,
  type DashboardData,
  type DashboardSurface,
  type EventBucket,
  type EventTone,
  type EventsMeta,
  type FeedRow,
  type PageAggregate,
  type ProjectMemberSummary,
  type ProjectSummary,
  type Rollup,
  type Stat,
  type TopEvent,
} from "../_data/queries";
import { EventsChart } from "./events-chart";
import { ProjectSettingsDialog } from "./project-settings-dialog";
import { ProjectSwitcher } from "./project-switcher";
import { RefreshButton } from "./refresh-button";
import { ShareProjectDialog } from "./share-project-dialog";
import { SignOutButton } from "./sign-out-button";

const TONE_CLASS: Record<EventTone, string> = {
  default: "text-foreground",
  violet: "text-sky-300",
  green: "text-emerald-300",
  red: "text-red-300",
  orange: "text-amber-300",
};

function surfaceShellClass(surface: DashboardSurface) {
  const base =
    "flex min-h-dvh w-full flex-col overflow-y-auto bg-[#070809] text-foreground [font-family:var(--font-geist-sans)] lg:h-screen lg:overflow-hidden";
  if (surface === "mobile") {
    return `${base} [background:radial-gradient(circle_at_top_right,rgba(56,189,248,0.14),transparent_31rem),radial-gradient(circle_at_bottom_left,rgba(52,211,153,0.08),transparent_28rem),#05080a]`;
  }
  if (surface === "mixed") {
    return `${base} [background:radial-gradient(circle_at_top_right,rgba(168,85,247,0.09),transparent_32rem),radial-gradient(circle_at_bottom_left,rgba(74,222,128,0.06),transparent_28rem),#070809]`;
  }
  return `${base} [background:radial-gradient(circle_at_top_right,rgba(74,222,128,0.07),transparent_34rem),#070809]`;
}

// ─── view ───────────────────────────────────────────────────────────────────

export type DashboardViewProps = {
  currentSlug: string | null;
  project: ProjectSummary | null;
  projects: ReadonlyArray<ProjectSummary>;
  rollup: Rollup;
  data: DashboardData;
  members: ReadonlyArray<ProjectMemberSummary>;
};

export function DashboardView({
  currentSlug,
  project,
  projects,
  rollup,
  data,
  members,
}: DashboardViewProps) {
  const totalEvents = project ? project.events24h : rollup.events24h;
  const rate = project ? project.rate : rollup.rate;
  const surface = project ? surfaceForPlatform(project.platform) : data.surface;
  const eventsStat = data.stats.find((s) => s.label === "events");
  const sessionsStat = data.stats.find((s) => s.label === "sessions");

  return (
    <div className={surfaceShellClass(surface)}>
      <TitleBar
        currentSlug={currentSlug}
        project={project}
        projects={projects}
        rollup={rollup}
        members={members}
        surface={surface}
      />
      <div className="grid flex-1 grid-cols-1 lg:min-h-0 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="border-b border-white/10 bg-black/10 lg:overflow-y-auto lg:border-r lg:border-b-0">
          <StatsPane stats={data.stats} topEvents={data.topEvents} />
        </aside>
        <main className="flex min-w-0 flex-col lg:min-h-0 lg:overflow-hidden">
          <ChartPane
            totalEvents={totalEvents}
            totalSessions={sessionsStat?.value ?? "0"}
            hourly={data.hourly}
            hourlyMeta={data.hourlyMeta}
            eventsDelta={eventsStat?.delta}
            eventsUp={eventsStat?.up}
            surface={surface}
          />
          <div className="grid flex-1 grid-cols-1 lg:min-h-0 lg:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.15fr)]">
            <PagesPane pages={data.pages} surface={surface} />
            <FeedPane rate={rate} feed={data.feed} />
          </div>
        </main>
      </div>
    </div>
  );
}

// ─── title bar ──────────────────────────────────────────────────────────────

function TitleBar({
  currentSlug,
  project,
  projects,
  rollup,
  members,
  surface,
}: {
  currentSlug: string | null;
  project: ProjectSummary | null;
  projects: ReadonlyArray<ProjectSummary>;
  rollup: Rollup;
  members: ReadonlyArray<ProjectMemberSummary>;
  surface: DashboardSurface;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-[#090a0b]/90 px-3 py-3 text-xs backdrop-blur sm:gap-3 sm:px-5 sm:text-[13px]">
      <span className="font-mono font-medium tracking-wide text-foreground">
        vantage
      </span>
      <span className="text-muted-foreground/35">/</span>
      <ProjectSwitcher currentSlug={currentSlug} projects={projects} />
      <Separator orientation="vertical" className="hidden !h-4 sm:block" />
      <span className="hidden text-muted-foreground/70 sm:inline">last 24h</span>
      <SurfaceBadge surface={surface} platform={project?.platform ?? null} />
      <div className="ml-auto flex items-center gap-2">
        <span className="hidden items-center gap-2 text-muted-foreground/65 sm:flex">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-55" />
            <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
          </span>
          SGT · live
        </span>
        {project?.role === "owner" ? (
          <>
            <ProjectSettingsDialog project={project} />
            <ShareProjectDialog project={project} members={members} />
          </>
        ) : null}
        <RefreshButton />
        <SignOutButton />
      </div>
    </div>
  );
}

function SurfaceBadge({
  surface,
  platform,
}: {
  surface: DashboardSurface;
  platform: ProjectSummary["platform"] | null;
}) {
  const Icon = surface === "mobile" ? SmartphoneIcon : Globe2Icon;
  const label = surface === "mobile"
    ? platform === "ios"
      ? "iOS app"
      : platform === "android"
        ? "Android app"
        : "mobile app"
    : surface === "mixed"
      ? "mixed apps"
      : "web app";

  return (
    <span className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] text-muted-foreground/75 md:flex">
      <Icon className={surface === "mobile" ? "size-3 text-sky-300" : "size-3 text-emerald-300"} />
      {label}
    </span>
  );
}

// ─── stats pane (left column) ──────────────────────────────────────────────

function StatsPane({
  stats,
  topEvents,
}: {
  stats: ReadonlyArray<Stat>;
  topEvents: ReadonlyArray<TopEvent>;
}) {
  return (
    <div className="space-y-6 p-4 sm:p-5 lg:space-y-8">
      <Section title="overview">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
          {stats.map((s) => (
            <StatCard key={s.label} stat={s} />
          ))}
        </div>
      </Section>

      <Section title="top events">
        <div className="space-y-3">
          {topEvents.length === 0 ? (
            <EmptyText>no events yet</EmptyText>
          ) : (
            topEvents.map((e) => (
              <div key={e.name} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-2 text-[13px] tabular-nums">
                  <span
                    className={
                      e.bad ? "truncate text-red-300" : "truncate text-foreground"
                    }
                  >
                    {e.name}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground/70">
                    {e.count}
                  </span>
                </div>
                <div className="h-px overflow-hidden rounded-full bg-white/10">
                  <div
                    className={
                      e.bad ? "h-full bg-red-300/80" : "h-full bg-emerald-300/80"
                    }
                    style={{ width: `${e.pct}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </Section>
    </div>
  );
}

function StatCard({ stat }: { stat: Stat }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.025] p-3.5 transition-colors hover:bg-white/[0.04]">
      <div className="truncate text-[11px] tracking-[0.12em] text-muted-foreground/65 uppercase">
        {stat.label}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span
          className={
            stat.bad
              ? "font-mono text-xl font-medium text-red-300 tabular-nums"
              : "font-mono text-xl font-medium text-foreground tabular-nums"
          }
        >
          {stat.value}
        </span>
        {stat.delta ? (
          <DeltaBadge value={stat.delta} up={stat.up} bad={stat.bad} />
        ) : null}
      </div>
    </div>
  );
}

// ─── chart pane (top right) ─────────────────────────────────────────────────

function ChartPane({
  totalEvents,
  totalSessions,
  hourly,
  hourlyMeta,
  eventsDelta,
  eventsUp,
  surface,
}: {
  totalEvents: number;
  totalSessions: string;
  hourly: ReadonlyArray<EventBucket>;
  hourlyMeta: EventsMeta;
  eventsDelta?: string;
  eventsUp?: boolean;
  surface: DashboardSurface;
}) {
  return (
    <div className="shrink-0 border-b border-white/10 bg-black/5">
      <div className="space-y-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
          <div className="min-w-0 space-y-3">
            <div className="flex items-center gap-2 text-[11px] tracking-[0.12em] text-muted-foreground/65 uppercase">
              <span>{surface === "mobile" ? "mobile activity" : "events + sessions"}</span>
              <span className="text-muted-foreground/35">·</span>
              <span>Singapore time</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <ChartMetric label="events" value={totalEvents.toLocaleString()} surface={surface} />
              <ChartMetric label="sessions" value={totalSessions} muted surface={surface} />
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground/60">
              <span>
                peak {hourlyMeta.peak.events.toLocaleString()}/hr at {hourlyMeta.peak.time} SGT
              </span>
              {eventsDelta ? (
                <span
                  className={`flex items-center gap-1 ${
                    eventsUp ? "text-emerald-300" : "text-red-300"
                  }`}
                >
                  <TrendingUpIcon className="size-3" />
                  {eventsDelta}
                </span>
              ) : null}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <MetricPill label="range" value="24h" />
            <MetricPill label="bucket" value="1h" />
            <MetricPill label="tz" value="SGT" />
          </div>
        </div>

        <EventsChart hourly={hourly} hourlyMeta={hourlyMeta} />
      </div>
    </div>
  );
}

// ─── page aggregate pane ────────────────────────────────────────────────────

function PagesPane({
  pages,
  surface,
}: {
  pages: ReadonlyArray<PageAggregate>;
  surface: DashboardSurface;
}) {
  return (
    <section className="border-b border-white/10 p-4 sm:p-5 lg:min-h-0 lg:overflow-y-auto lg:border-r lg:border-b-0">
      <Section title={surface === "mobile" ? "screens" : "pages"}>
        <div className="space-y-2.5">
          {pages.length === 0 ? (
            <EmptyText>{surface === "mobile" ? "no screen data yet" : "no page data yet"}</EmptyText>
          ) : (
            pages.map((page) => (
              <div key={page.page} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-mono text-[13px] text-foreground">
                      {page.page}
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground/60">
                      last seen {page.lastSeen} SGT
                    </div>
                  </div>
                  <div className="shrink-0 text-right font-mono text-xs tabular-nums">
                    <div className="text-foreground">{page.events}</div>
                    <div className="text-muted-foreground/60">{page.sessions} sess</div>
                  </div>
                </div>
                <div className="mt-3 h-px overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-white/70"
                    style={{ width: `${page.pct}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </Section>
    </section>
  );
}

// ─── feed pane (bottom right) ───────────────────────────────────────────────

function FeedPane({
  rate,
  feed,
}: {
  rate: string;
  feed: ReadonlyArray<FeedRow>;
}) {
  return (
    <section className="flex flex-col p-4 sm:p-5 lg:min-h-0">
      <div className="mb-4 flex shrink-0 items-center">
        <Section.Title>stream</Section.Title>
        <span className="ml-auto flex items-center gap-2 text-xs text-emerald-300">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
          </span>
          {rate}
        </span>
      </div>
      <ScrollArea className="lg:min-h-0 lg:flex-1">
        <div className="space-y-1.5 pr-0 lg:pr-3">
          {feed.length === 0 ? (
            <EmptyText>
              no events yet — fire one at <code>/api/events</code>
            </EmptyText>
          ) : (
            feed.map((row, i) => <StreamRow key={`${row.t}-${i}`} row={row} />)
          )}
        </div>
      </ScrollArea>
    </section>
  );
}

function StreamRow({ row }: { row: FeedRow }) {
  return (
    <div className="grid min-w-0 grid-cols-[64px_minmax(0,1fr)] gap-x-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5 text-[12px] transition-colors hover:bg-white/[0.04] sm:grid-cols-[76px_minmax(120px,0.9fr)_minmax(0,1fr)_auto] sm:items-center sm:text-[13px]">
      <span className="font-mono text-muted-foreground/55 tabular-nums">
        {row.t}
      </span>
      <span className={`min-w-0 truncate font-mono ${TONE_CLASS[row.tone]}`}>
        {row.event}
      </span>
      <span className="col-start-2 mt-1 min-w-0 truncate text-muted-foreground/75 sm:col-start-auto sm:mt-0">
        {row.page}
      </span>
      <Badge
        variant="outline"
        className="col-start-2 mt-2 w-fit rounded-md border-white/10 bg-black/10 px-1.5 font-mono text-[10px] font-normal text-muted-foreground/70 sm:col-start-auto sm:mt-0"
      >
        {row.session}
      </Badge>
    </div>
  );
}

// ─── primitives ─────────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <Section.Title>{title}</Section.Title>
      {children}
    </div>
  );
}

Section.Title = function SectionTitle({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-[11px] tracking-[0.14em] text-muted-foreground/60 uppercase">
      <span>{children}</span>
      <span className="h-px flex-1 bg-white/10" />
    </div>
  );
};

function EmptyText({ children }: { children: React.ReactNode }) {
  return <div className="text-[13px] text-muted-foreground/60">{children}</div>;
}

function DeltaBadge({
  value,
  up,
  bad,
}: {
  value: string;
  up?: boolean;
  bad?: boolean;
}) {
  const Icon = up ? ArrowUpRightIcon : ArrowDownRightIcon;
  const cls = bad
    ? "text-red-300"
    : up
      ? "text-emerald-300"
      : "text-red-300";
  return (
    <span className={`flex items-center gap-0.5 text-[11px] ${cls}`}>
      <Icon className="size-3" />
      {value.replace(/^[+−-]/, "")}
    </span>
  );
}

function ChartMetric({
  label,
  value,
  muted,
  surface,
}: {
  label: string;
  value: string;
  muted?: boolean;
  surface: DashboardSurface;
}) {
  const color = muted
    ? surface === "mobile"
      ? "text-cyan-200"
      : "text-blue-200"
    : surface === "mobile"
      ? "text-sky-200"
      : "text-emerald-200";
  return (
    <div className="min-w-28 rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2">
      <div className="text-[10px] tracking-[0.12em] text-muted-foreground/60 uppercase">
        {label}
      </div>
      <div
        className={`mt-1 font-mono text-2xl font-medium tabular-nums ${color}`}
      >
        {value}
      </div>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-muted-foreground/70">
      <span>{label}</span>
      <span className="font-mono text-foreground">{value}</span>
    </div>
  );
}
