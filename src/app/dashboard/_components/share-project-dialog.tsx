"use client";

import { Trash2Icon, UserPlusIcon } from "lucide-react";
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
  removeProjectMemberAction,
  shareProjectAction,
} from "../_actions/share-project";
import type {
  ProjectMemberSummary,
  ProjectSummary,
} from "../_data/queries";

export function ShareProjectDialog({
  project,
  members,
}: {
  project: ProjectSummary;
  members: ReadonlyArray<ProjectMemberSummary>;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [message, setMessage] = React.useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function handleShare(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setMessage(null);
    setInviteUrl(null);

    startTransition(async () => {
      const result = await shareProjectAction({
        projectId: project.id,
        email,
      });
      setMessage(result.message);
      if (result.ok) {
        setInviteUrl(result.inviteUrl ?? null);
        setEmail("");
        router.refresh();
      }
    });
  }

  function handleRemove(userId: string) {
    if (pending) return;
    setMessage(null);

    startTransition(async () => {
      const result = await removeProjectMemberAction({
        projectId: project.id,
        userId,
      });
      setMessage(result.message);
      if (result.ok) router.refresh();
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
        <UserPlusIcon className="size-3.5" />
        Share
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share {project.name}</DialogTitle>
            <DialogDescription>
              Invite someone to create or sign in to a Vantage account for this project.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleShare} className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="client@example.com"
                autoComplete="email"
                required
                disabled={pending}
              />
              <Button type="submit" disabled={pending || email.trim() === ""}>
                {pending ? "Creating…" : "Create invite"}
              </Button>
            </div>
            {message ? (
              <p className="text-sm text-muted-foreground">{message}</p>
            ) : null}
            {inviteUrl ? (
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <Input value={inviteUrl} readOnly className="min-w-0" />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigator.clipboard.writeText(inviteUrl)}
                >
                  Copy link
                </Button>
              </div>
            ) : null}
          </form>

          <div className="space-y-2">
            <div className="text-sm font-medium">Members</div>
            <div className="overflow-hidden rounded-lg border">
              {members.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{member.email}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {member.name} · {member.role}
                    </div>
                  </div>
                  {member.role === "viewer" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemove(member.userId)}
                      disabled={pending}
                      className="shrink-0 text-muted-foreground"
                    >
                      <Trash2Icon className="size-3.5" />
                      Remove
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
