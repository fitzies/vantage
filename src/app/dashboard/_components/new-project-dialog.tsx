"use client";

import {
  CheckIcon,
  CopyIcon,
  Globe2Icon,
  KeyIcon,
  SmartphoneIcon,
} from "lucide-react";
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

import { createProjectAction } from "../_actions/create-project";

type SetupTarget = "web" | "ios" | "expo";

type Phase =
  | { kind: "form"; error?: string }
  | {
      kind: "done";
      slug: string;
      name: string;
      writeKey: string;
    };

export function NewProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [phase, setPhase] = React.useState<Phase>({ kind: "form" });
  const [pending, startTransition] = React.useTransition();
  const [slug, setSlug] = React.useState("");
  const [name, setName] = React.useState("");
  const [setupTarget, setSetupTarget] = React.useState<SetupTarget>("ios");
  const [eventsEndpoint, setEventsEndpoint] = React.useState("/api/events");
  const [copied, setCopied] = React.useState<"writeKey" | "snippet" | null>(null);

  React.useEffect(() => {
    setEventsEndpoint(`${window.location.origin}/api/events`);
  }, []);

  React.useEffect(() => {
    if (open) {
      setPhase({ kind: "form" });
      setSlug("");
      setName("");
      setSetupTarget("ios");
      setCopied(null);
    }
  }, [open]);

  function handleClose(next: boolean) {
    onOpenChange(next);
    if (!next && phase.kind === "done") router.refresh();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;

    const trimmedSlug = slug.trim().toLowerCase();
    const trimmedName = name.trim();
    setPhase({ kind: "form" });

    startTransition(async () => {
      const result = await createProjectAction({
        slug: trimmedSlug,
        name: trimmedName.length > 0 ? trimmedName : undefined,
      });

      if (result.ok) {
        setPhase({
          kind: "done",
          slug: result.project.slug,
          name: result.project.name,
          writeKey: result.project.writeKey,
        });
      } else {
        setPhase({ kind: "form", error: result.error });
      }
    });
  }

  async function handleCopy(value: string, target: "writeKey" | "snippet") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(target);
      window.setTimeout(() => {
        setCopied((current) => (current === target ? null : current));
      }, 1500);
    } catch {
      setCopied((current) => (current === target ? null : current));
    }
  }

  const snippet =
    phase.kind === "done"
      ? setupSnippet(setupTarget, phase.slug, phase.writeKey, eventsEndpoint)
      : "";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        {phase.kind === "form" ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Create project</DialogTitle>
              <DialogDescription>
                One write key per app. Pick the setup guide now; Vantage will infer web or mobile from incoming events.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <Field label="Slug" hint="Lowercase route id, e.g. screenmates-ios">
                <Input
                  name="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase())}
                  placeholder="screenmates-ios"
                  autoFocus
                  required
                  disabled={pending}
                  autoCapitalize="off"
                  autoComplete="off"
                  spellCheck={false}
                  pattern="[a-z0-9](?:[a-z0-9-]*[a-z0-9])?"
                />
              </Field>

              <Field label="Display name" hint="Optional, defaults to slug">
                <Input
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Screenmates iOS"
                  disabled={pending}
                  autoComplete="off"
                  maxLength={256}
                />
              </Field>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Setup guide</div>
              <div className="grid gap-2">
                <SetupOption
                  value="ios"
                  current={setupTarget}
                  onSelect={setSetupTarget}
                  icon={<SmartphoneIcon className="size-4" />}
                  title="Native iOS"
                />
                <SetupOption
                  value="expo"
                  current={setupTarget}
                  onSelect={setSetupTarget}
                  icon={<SmartphoneIcon className="size-4" />}
                  title="Expo / React Native"
                />
                <SetupOption
                  value="web"
                  current={setupTarget}
                  onSelect={setSetupTarget}
                  icon={<Globe2Icon className="size-4" />}
                  title="Next.js / Web"
                />
              </div>
            </div>

            {phase.error ? (
              <p className="text-sm text-destructive">{phase.error}</p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleClose(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending || slug.trim() === ""}>
                {pending ? "Creating…" : "Create project"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyIcon className="size-4" />
                Project created
              </DialogTitle>
              <DialogDescription>
                Copy the write key now, then drop the snippet into your app.
              </DialogDescription>
            </DialogHeader>

            <dl className="grid gap-2 sm:grid-cols-2">
              <Row label="Slug" value={phase.slug} />
              <Row label="Name" value={phase.name} />
            </dl>

            <div className="space-y-1.5">
              <div className="text-sm font-medium">Write key</div>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <Input
                  value={phase.writeKey}
                  readOnly
                  className="min-w-0 select-all text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleCopy(phase.writeKey, "writeKey")}
                >
                  {copied === "writeKey" ? (
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

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium">{setupLabel(setupTarget)} setup</div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopy(snippet, "snippet")}
                >
                  {copied === "snippet" ? (
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
              <div className="max-w-full overflow-x-auto whitespace-pre-wrap rounded-lg border p-3 text-xs leading-relaxed text-muted-foreground">
                {snippet}
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => handleClose(false)}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SetupOption({
  value,
  current,
  onSelect,
  icon,
  title,
}: {
  value: SetupTarget;
  current: SetupTarget;
  onSelect: (value: SetupTarget) => void;
  icon: React.ReactNode;
  title: string;
}) {
  const selected = value === current;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
        selected ? "bg-accent text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground"
      }`}
      aria-pressed={selected}
    >
      {icon}
      {title}
    </button>
  );
}

function setupLabel(target: SetupTarget) {
  if (target === "ios") return "Swift iOS";
  if (target === "expo") return "Expo";
  return "Next.js";
}

function setupSnippet(
  target: SetupTarget,
  slug: string,
  writeKey: string,
  eventsEndpoint: string,
) {
  if (target === "ios") {
    return `import Vantage\n\nVantage.configure(\n  endpoint: URL(string: "${eventsEndpoint}")!,\n  writeKey: "${writeKey}",\n  project: "${slug}"\n)\n\nVantage.screen("Home")`;
  }

  if (target === "expo") {
    return `import { init, screen } from "@ojflabs/vantage-expo";\n\nawait init({\n  endpoint: "${eventsEndpoint}",\n  writeKey: "${writeKey}",\n  project: "${slug}",\n  context: { platform: "ios" }\n});\n\nawait screen("Home");`;
  }

  return `# .env.local\nNEXT_PUBLIC_VANTAGE_PROJECT=${slug}\nNEXT_PUBLIC_VANTAGE_WRITE_KEY=${writeKey}\n\n# install\npnpm add @ojflabs/vantage\n\n# layout.tsx\nimport { VantageProvider } from "@ojflabs/vantage/react";`;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5 text-sm font-medium">
      <span>{label}</span>
      {children}
      {hint ? (
        <span className="block text-xs font-normal text-muted-foreground">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate text-foreground">{value}</dd>
    </div>
  );
}
