# @ojflabs/vantage

Browser tracker for [Vantage](https://github.com/ojflabs/vantage) — a self-hosted, multi-project analytics service.

Zero deps in the core. ~3 KB minified + gzipped. Drop-in tracker for any
project pushing events to a Vantage instance.

## Install

```bash
pnpm add @ojflabs/vantage
```

The React/Next entrypoint is optional — it pulls `react` and `next` from
peer deps only if you import `@ojflabs/vantage/react`.

## Quick start

### Vanilla / any framework

```ts
import { init, track, identify } from "@ojflabs/vantage";

init({
  project: "marketing-site",
  writeKey: "vntg_pk_…",
  endpoint: "https://vantage.example.com/api/events",
});

track("cta_clicked", { variant: "hero" });

// after login
identify("user_42");
```

### Next.js (App Router)

```tsx
// app/layout.tsx
import { VantageProvider } from "@ojflabs/vantage/react";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <VantageProvider
          project={process.env.NEXT_PUBLIC_VANTAGE_PROJECT!}
          writeKey={process.env.NEXT_PUBLIC_VANTAGE_WRITE_KEY!}
          endpoint="https://vantage.example.com/api/events"
        />
        {children}
      </body>
    </html>
  );
}
```

```tsx
// any client component
"use client";
import { track } from "@ojflabs/vantage";

<button onClick={() => track("signup_clicked")}>Sign up</button>
```

The provider auto-fires `$pageview` on every App Router navigation.

## API

| Function                       | Use                                                                |
| ------------------------------ | ------------------------------------------------------------------ |
| `init(opts)`                   | Configure once, at boot.                                           |
| `track(event, props?)`         | Fire a custom event.                                               |
| `identify(userId, traits?)`    | Tie subsequent events to a user. Stamps `previous_anon_id` once.   |
| `page(url?, props?)`           | Manually fire `$pageview`. The React provider does this for you.   |
| `reset()`                      | Clear identity + rotate the anonymous id (e.g. on logout).         |

## How it works

- Adds a client-generated `event_id` to each event for retry dedupe.
- Buffers events: 1s window or 20 events, whichever first.
- Force-flushes on `visibilitychange === "hidden"` and `pagehide`.
- Falls back to `navigator.sendBeacon` during unload so pageviews don't drop.
- Anonymous ID lives in `localStorage` (`vntg_anon`); session ID in
  `sessionStorage` (`vntg_sid`).

## Identity stitching

Vantage doesn't run a separate identities service. The tracker handles it
via `previous_anon_id`:

1. Anonymous user fires events with `anon_id`.
2. On `identify(userId)`, the next event carries
   `props.previous_anon_id` set to the device's old `anon_id`.
3. Queries stitch the pre- and post-login session at read time.

## Development

```bash
pnpm install                              # symlinks the workspace
pnpm -F @ojflabs/vantage build            # one-time build
pnpm -F @ojflabs/vantage dev              # watch mode
```

Source lives in `src/`, build output in `dist/`. `dist/` is gitignored.

## Source availability and rights

This source is visible for portfolio presentation and code review only. No open-source or reuse license is granted; all rights are reserved.
