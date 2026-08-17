"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function RefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label="Refresh dashboard"
      disabled={isPending}
      onClick={() => startTransition(() => router.refresh())}
      className="h-7 rounded-full border border-white/10 bg-white/[0.03] px-2 text-[11px] text-muted-foreground hover:bg-white/[0.06] hover:text-foreground disabled:opacity-60"
    >
      <RefreshCwIcon
        className={cn("size-3.5", isPending && "animate-spin")}
        aria-hidden="true"
      />
      <span className="hidden sm:inline">refresh</span>
    </Button>
  );
}
