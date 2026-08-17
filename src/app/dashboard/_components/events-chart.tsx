"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

import type { EventBucket, EventsMeta } from "../_data/queries";

const chartConfig = {
  events: {
    label: "events",
    color: "#86efac",
  },
  sessions: {
    label: "sessions",
    color: "#93c5fd",
  },
} satisfies ChartConfig;

export function EventsChart({
  hourly,
  hourlyMeta,
}: {
  hourly: ReadonlyArray<EventBucket>;
  hourlyMeta: EventsMeta;
}) {
  return (
    <ChartContainer
      config={chartConfig}
      className="h-[210px] w-full sm:h-[240px] lg:h-[280px]"
    >
      <ComposedChart
        accessibilityLayer
        data={[...hourly]}
        margin={{ top: 10, right: 12, left: -10, bottom: 0 }}
      >
        <defs>
          <linearGradient id="fillEvents" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-events)" stopOpacity={0.28} />
            <stop offset="95%" stopColor="var(--color-events)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="2 5"
          stroke="var(--border)"
          strokeOpacity={0.55}
          vertical={false}
        />
        <XAxis
          dataKey="time"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          minTickGap={32}
          tick={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fill: "var(--muted-foreground)",
          }}
        />
        <YAxis
          yAxisId="events"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={34}
          tickCount={4}
          tick={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fill: "var(--muted-foreground)",
          }}
        />
        <YAxis
          yAxisId="sessions"
          orientation="right"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={34}
          tickCount={4}
          tick={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fill: "var(--muted-foreground)",
          }}
        />
        <ChartTooltip
          cursor={{
            stroke: "rgba(255,255,255,0.38)",
            strokeDasharray: "2 3",
          }}
          content={
            <ChartTooltipContent
              indicator="dot"
              labelClassName="font-mono text-xs"
              className="border-white/10 bg-[#0b0c0d] font-mono shadow-2xl"
            />
          }
        />
        <Area
          yAxisId="events"
          dataKey="events"
          type="monotone"
          stroke="var(--color-events)"
          strokeWidth={1.8}
          fill="url(#fillEvents)"
          activeDot={{ r: 3 }}
          isAnimationActive={false}
        />
        <Line
          yAxisId="sessions"
          dataKey="sessions"
          type="monotone"
          stroke="var(--color-sessions)"
          strokeWidth={1.6}
          dot={false}
          activeDot={{ r: 3 }}
          isAnimationActive={false}
        />
        <ReferenceDot
          yAxisId="events"
          x={hourlyMeta.peak.time}
          y={hourlyMeta.peak.events}
          r={3}
          fill="#070809"
          stroke="var(--color-events)"
          strokeWidth={1.5}
          ifOverflow="extendDomain"
        />
        <ReferenceDot
          yAxisId="events"
          x={hourlyMeta.last.time}
          y={hourlyMeta.last.events}
          r={3.5}
          fill="var(--color-events)"
          stroke="var(--color-events)"
          ifOverflow="extendDomain"
        />
      </ComposedChart>
    </ChartContainer>
  );
}
