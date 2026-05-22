import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { parseVibeYaml } from "@/lib/vibes/parse";
import { validateVibe } from "@/lib/vibes/validate";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const yaml = body.yaml;
  const title = body.title ?? "Untitled Vibe";

  if (!yaml || typeof yaml !== "string") {
    return NextResponse.json({ error: "Missing yaml string." }, { status: 400 });
  }

  const parsed = parseVibeYaml(yaml);
  const issues = parsed.doc ? validateVibe(parsed.doc) : [];

  const id = nanoid(10);
  const supabase = getSupabaseServerClient();

  const { error } = await supabase.from("editor_sessions").insert({
    id,
    title,
    yaml,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return NextResponse.json({
    id,
    url: `${appUrl}/editor/session/${id}`,
    valid: !parsed.error && issues.filter((i) => i.severity === "error").length === 0,
    parseError: parsed.error,
    issueCount: issues.length,
  });
}