import { NextResponse } from "next/server";
import { ensureOngoingOccurrencesThrough } from "@/lib/recurrence/ensure-generated";
import { createServerTimer } from "@/lib/server-timing";
import {
  createServerSupabaseClient,
  getRequestUser
} from "@/lib/supabase/server";

export const runtime = "edge";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: Request) {
  const timer = createServerTimer("dashboard.prefetch");
  const user = await getRequestUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const visibleEnd =
    body && typeof body.visibleEnd === "string" ? body.visibleEnd : "";

  if (!DATE_PATTERN.test(visibleEnd)) {
    return NextResponse.json({ error: "Invalid visible end" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const generatedCount = await ensureOngoingOccurrencesThrough(
    supabase,
    visibleEnd,
    user.id
  );
  timer.done({ generatedCount, visibleEnd });

  return NextResponse.json({ generatedCount, ok: true });
}
