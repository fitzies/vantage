"use client";

import { LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/user-auth/client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function handleSignOut() {
    startTransition(async () => {
      await authClient.signOut();
      router.push("/");
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={handleSignOut}
      disabled={pending}
      className="text-muted-foreground/70 hover:text-foreground"
      aria-label="Sign out"
    >
      <LogOutIcon className="size-3.5" />
    </Button>
  );
}
