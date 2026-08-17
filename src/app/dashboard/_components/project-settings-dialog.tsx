"use client";

import { CheckIcon, CopyIcon, KeyIcon, SettingsIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import {
  deleteProjectAction,
  updateProjectAction,
} from "../_actions/project-settings";
import type { ProjectSummary } from "../_data/queries";

export function ProjectSettingsDialog({ project }: { project: ProjectSummary }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState(project.name);
  const [slug, setSlug] = React.useState(project.slug);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [confirmSlug, setConfirmSlug] = React.useState("");
  const [message, setMessage] = React.useState<string | null>(null);
  const [deleteMessage, setDeleteMessage] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const formId = React.useId();

  React.useEffect(() => {
    if (!open) {
      setDeleteOpen(false);
      return;
    }
    setName(project.name);
    setSlug(project.slug);
    setConfirmSlug("");
    setMessage(null);
    setDeleteMessage(null);
    setCopied(false);
  }, [open, project.name, project.slug]);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setMessage(null);

    startTransition(async () => {
      const result = await updateProjectAction({
        projectId: project.id,
        name,
        slug,
      });

      if (!result.ok) {
        setMessage(result.message);
        return;
      }

      setMessage("Project updated.");
      router.push(`/dashboard/${result.project.slug}`);
      router.refresh();
    });
  }

  async function handleCopyKey() {
    if (!project.writeKey) return;
    try {
      await navigator.clipboard.writeText(project.writeKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  function handleOpenDelete() {
    setConfirmSlug("");
    setDeleteMessage(null);
    setDeleteOpen(true);
  }

  function handleDelete() {
    if (pending) return;
    setDeleteMessage(null);

    startTransition(async () => {
      const result = await deleteProjectAction({
        projectId: project.id,
        confirmSlug,
      });

      if (!result.ok) {
        setDeleteMessage(result.message);
        return;
      }

      setDeleteOpen(false);
      setOpen(false);
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="text-xs"
      >
        <SettingsIcon className="size-3.5" />
        Settings
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Project settings</DialogTitle>
            <DialogDescription>
              Rename the dashboard label or change the route slug for this project.
            </DialogDescription>
          </DialogHeader>

          <form id={formId} onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Display name">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="off"
                  maxLength={256}
                  disabled={pending}
                />
              </Field>
              <Field label="Slug">
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase())}
                  autoCapitalize="off"
                  autoComplete="off"
                  spellCheck={false}
                  pattern="[a-z0-9](?:[a-z0-9-]*[a-z0-9])?"
                  disabled={pending}
                />
              </Field>
            </div>

            {message ? (
              <p className="text-sm text-muted-foreground">{message}</p>
            ) : null}
          </form>

          {project.writeKey ? (
            <div className="rounded-lg border border-border/60 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <KeyIcon className="size-4 text-muted-foreground" />
                Write key
              </div>
              <p className="mb-3 text-sm text-muted-foreground">
                Public client key used by apps to send events to this project.
              </p>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <Input
                  value={project.writeKey}
                  readOnly
                  className="min-w-0 select-all text-xs"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleCopyKey}
                >
                  {copied ? (
                    <>
                      <CheckIcon className="size-3.5" /> Copied
                    </>
                  ) : (
                    <>
                      <CopyIcon className="size-3.5" /> Copy
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : null}

          <DialogFooter className="sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="destructive"
              onClick={handleOpenDelete}
              disabled={pending}
            >
              <Trash2Icon className="size-3.5" />
              Delete project
            </Button>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form={formId}
                disabled={
                  pending ||
                  name.trim() === "" ||
                  slug.trim() === "" ||
                  (name === project.name && slug === project.slug)
                }
              >
                {pending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent
          role="alertdialog"
          showCloseButton={false}
          className="sm:max-w-md"
        >
          <DialogHeader>
            <DialogTitle>Delete project</DialogTitle>
            <DialogDescription>
              Permanently removes the project, its members, and all captured events.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Input
              value={confirmSlug}
              onChange={(e) => setConfirmSlug(e.target.value)}
              placeholder={`Type ${project.slug} to confirm`}
              disabled={pending}
              autoComplete="off"
            />
            {deleteMessage ? (
              <p className="text-sm text-destructive">{deleteMessage}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={pending || confirmSlug !== project.slug}
            >
              {pending ? "Deleting…" : "Delete project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5 text-sm font-medium">
      <span>{label}</span>
      {children}
    </label>
  );
}
