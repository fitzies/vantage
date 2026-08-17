/**
 * React/Next entry point for the Vantage tracker.
 *
 * Pulls in `react` and `next/navigation` as peer deps. The core entrypoint
 * (`@ojflabs/vantage`) has zero React deps for use in vanilla / Node /
 * mobile contexts.
 */
export { VantagePageview } from "./pageview";
export { VantageProvider } from "./provider";
