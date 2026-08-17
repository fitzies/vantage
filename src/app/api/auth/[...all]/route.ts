import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/user-auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const { GET, POST } = toNextJsHandler(auth.handler);
