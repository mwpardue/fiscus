import { type NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "edge";

const BACKUP_SCHEMA = "fiscus.user-backup.v1";

const backupTables = [
  "counterparties",
  "categories",
  "financial_items",
  "recurrence_rules",
  "occurrences",
  "payments",
  "audit_events"
] as const;

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const user = {
    email: request.headers.get("x-user-email"),
    id: request.headers.get("x-user-id")
  };

  if (!user.id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json(
      { error: "Unable to export profile." },
      { status: 500 }
    );
  }

  const data: Record<string, unknown> = { profile };

  for (const table of backupTables) {
    const { data: rows, error } = await supabase
      .from(table)
      .select("*")
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json(
        { error: `Unable to export ${table}.` },
        { status: 500 }
      );
    }

    data[table] = rows ?? [];
  }

  const exportedAt = new Date().toISOString();
  const backup = {
    schema: BACKUP_SCHEMA,
    exported_at: exportedAt,
    user: {
      email: user.email ?? null,
      id: user.id
    },
    data
  };
  const filename = `fiscus-backup-${exportedAt.slice(0, 10)}.json`;

  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      "content-disposition": `attachment; filename="${filename}"`,
      "content-type": "application/json; charset=utf-8"
    }
  });
}
