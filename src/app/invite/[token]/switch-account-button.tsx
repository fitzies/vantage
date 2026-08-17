"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/user-auth/client";

export function SwitchAccountButton({ token }: { token: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function handleClick() {
    startTransition(async () => {
      await authClient.signOut();
      router.push(`/?invite=${encodeURIComponent(token)}`);
      router.refresh();
    });
  }

  return (
    <Button type="button" variant="outline" onClick={handleClick} disabled={pending}>
      {pending ? "Signing out…" : "Switch account"}
    </Button>
  );
}
