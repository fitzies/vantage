"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { page } from "../index";

/**
 * Mount once in your root layout (after `init()`) to fire a `$pageview`
 * event on every App Router navigation.
 *
 * Keyed on `pathname + search` so updates to the query string also fire.
 * The first render fires the initial pageview.
 */
export function VantagePageview(): null {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const search = searchParams?.toString();
    const path = pathname + (search ? `?${search}` : "");
    // Pass an explicit URL so the event reflects the route, not the
    // browser's window.location (which is in sync, but being explicit
    // here means tests don't have to fake window.location).
    page(path);
  }, [pathname, searchParams]);

  return null;
}
