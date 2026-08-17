import type { NextRequest } from "next/server";

import { env } from "@/lib/env";
import { sendSummary } from "@/lib/telegram/bot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function unauthorized(): Response {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}

function isAuthorized(request: NextRequest): boolean {
  if (!env.CRON_SECRET) return false;
  return request.headers.get("authorization") === `Bearer ${env.CRON_SECRET}`;
}

export async function GET(request: NextRequest): Promise<Response> {
  if (!isAuthorized(request)) return unauthorized();

  try {
    await sendSummary("24h");
  } catch (err) {
    console.error("[vantage] telegram cron failed", err);
    return Response.json({ error: "telegram_cron_failed" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
