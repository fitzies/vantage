"use client";

import { Suspense, useEffect } from "react";
import { init } from "../index";
import type { InitOptions } from "../types";
import { VantagePageview } from "./pageview";

/**
 * Drop this once into your root layout (or per-route, your call) with
 * the project's write key. Calls `init()` exactly once on the client and
 * mounts `<VantagePageview/>` so App Router navigations fire pageviews.
 *
 * The pageview component uses `useSearchParams`, which Next requires
 * inside a Suspense boundary for static rendering — we wrap it here so
 * consumers don't have to think about it.
 */
export function VantageProvider(props: InitOptions): React.ReactElement {
  const { project, writeKey, endpoint, autoPageview, debug } = props;

  useEffect(() => {
    init({ project, writeKey, endpoint, autoPageview, debug });
    // init is guarded against double-call. Empty deps is intentional —
    // we want this to fire once per mount, not chase prop identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Suspense fallback={null}>
      <VantagePageview />
    </Suspense>
  );
}
