"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/user-auth/client";

type Mode = "signin" | "signup";

export function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const allowSignup = Boolean(inviteToken);
  const [mode, setMode] = React.useState<Mode>("signin");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;

    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "").trim() || email;
    setError(null);

    startTransition(async () => {
      const result = mode === "signin" || !allowSignup
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({
            name,
            email,
            password,
            callbackURL: `/invite/${inviteToken}`,
          });

      if (result.error) {
        setError(result.error.message ?? "Authentication failed.");
        return;
      }

      router.push(inviteToken ? `/invite/${inviteToken}` : "/dashboard");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {allowSignup ? (
        <div className="grid grid-cols-2 rounded-lg border p-1 text-sm">
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={mode === "signin" ? tabActive : tabInactive}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={mode === "signup" ? tabActive : tabInactive}
          >
            Create account
          </button>
        </div>
      ) : null}

      {allowSignup ? (
        <p className="rounded-md border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200">
          You are accepting a project invite. Sign in if you already have an
          account, or create one with the invited email.
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
        {mode === "signup" && allowSignup ? (
          <Field label="Name">
            <Input
              name="name"
              type="text"
              autoComplete="name"
              placeholder="Olive Fitzgerald"
              disabled={pending}
            />
          </Field>
        ) : null}

        <Field label="Email">
          <Input
            name="email"
            type="email"
            autoComplete="email"
            required
            autoFocus
            disabled={pending}
          />
        </Field>

        <Field label="Password">
          <Input
            name="password"
            type="password"
            autoComplete={mode === "signin" || !allowSignup ? "current-password" : "new-password"}
            required
            minLength={8}
            disabled={pending}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "auth-error" : undefined}
          />
        </Field>

        {error ? (
          <p id="auth-error" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Working…" : mode === "signin" || !allowSignup ? "Continue" : "Create account"}
        </Button>
      </form>
    </div>
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
    <label className="flex flex-col gap-2 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}

const tabActive =
  "rounded-md bg-foreground px-3 py-1.5 font-medium text-background transition-colors";
const tabInactive =
  "rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground";
