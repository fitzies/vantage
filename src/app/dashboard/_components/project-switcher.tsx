"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
} from "@/components/ui/select";

import type { Platform, ProjectSummary } from "../_data/queries";
import { NewProjectDialog } from "./new-project-dialog";

const ALL_PROJECTS_VALUE = "__all_projects__";
const NEW_PROJECT_VALUE = "__new_project__";

export function ProjectSwitcher({
  currentSlug,
  projects,
}: {
  // null = "all projects" rollup view
  currentSlug: string | null;
  projects: ReadonlyArray<ProjectSummary>;
}) {
  const router = useRouter();
  const [newProjectOpen, setNewProjectOpen] = React.useState(false);

  const current = currentSlug
    ? projects.find((p) => p.slug === currentSlug) ?? null
    : null;
  const value = currentSlug ?? ALL_PROJECTS_VALUE;

  function handleValueChange(next: string | null) {
    if (!next || next === value) return;

    if (next === NEW_PROJECT_VALUE) {
      setNewProjectOpen(true);
      return;
    }

    router.push(next === ALL_PROJECTS_VALUE ? "/dashboard" : `/dashboard/${next}`);
  }

  return (
    <>
      <Select value={value} onValueChange={handleValueChange}>
        <SelectTrigger
          size="sm"
          className="w-[18ch]"
          aria-label="Select project"
        >
          <TriggerLabel current={current} />
        </SelectTrigger>
        <SelectContent align="start" sideOffset={8}>
          <SelectGroup>
            <ProjectItem value={ALL_PROJECTS_VALUE} name="All projects" />
            {projects.map((p) => (
              <ProjectItem
                key={p.slug}
                value={p.slug}
                name={p.name}
                platform={p.platform}
              />
            ))}
          </SelectGroup>

          <SelectSeparator />
          <SelectGroup>
            <ProjectItem
              value={NEW_PROJECT_VALUE}
              name={projects.length === 0 ? "Create your first project" : "New project"}
            />
          </SelectGroup>
        </SelectContent>
      </Select>

      <NewProjectDialog
        open={newProjectOpen}
        onOpenChange={setNewProjectOpen}
      />
    </>
  );
}

function TriggerLabel({ current }: { current: ProjectSummary | null }) {
  if (!current) return <span className="truncate">All projects</span>;
  return (
    <span className="flex min-w-0 items-center gap-2 truncate">
      <span className="truncate">{current.name}</span>
      <PlatformLabel platform={current.platform} />
    </span>
  );
}

function ProjectItem({
  value,
  name,
  platform,
}: {
  value: string;
  name: string;
  platform?: Platform;
}) {
  return (
    <SelectItem value={value}>
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span className="min-w-0 flex-1 truncate">{name}</span>
        {platform ? <PlatformLabel platform={platform} /> : null}
      </span>
    </SelectItem>
  );
}

function PlatformLabel({ platform }: { platform: Platform }) {
  const label = platform === "ios"
    ? "iOS"
    : platform === "android"
      ? "Android"
      : platform === "expo"
        ? "Expo"
        : platform === "mobile"
          ? "Mobile"
          : "Web";

  return (
    <span className="shrink-0 rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
      {label}
    </span>
  );
}
