"use client";

import { useState } from "react";
import { track } from "@ojflabs/vantage";

/**
 * Smoke-test button — fires a `clicked_smoke` event into Vantage on click.
 * Folder is `_components` so the App Router ignores it (private convention).
 */
export function SmokeTrackButton() {
  const [count, setCount] = useState(0);

  return (
    <button
      type="button"
      onClick={() => {
        track("clicked_smoke", { count: count + 1 });
        setCount((c) => c + 1);
      }}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] md:w-[200px]"
    >
      Track smoke event {count > 0 ? `(${count})` : ""}
    </button>
  );
}
