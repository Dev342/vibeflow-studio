import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { parseVibeYaml } from "@/lib/vibes/parse";
import { validateVibe } from "@/lib/vibes/validate";

async function readBody(req: NextRequest): Promise<{
  title?: string;
  yaml?: string;
}> {
  const contentType = req.headers.get("content-type") ?? "";
  const raw = await req.text();

  if (contentType.includes("application/json")) {
    const parsed = JSON.parse(raw);
    return {
      title: parsed.title,
      yaml: parsed.yaml,
    };
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(raw);
    return {
      title: params.get("title") ?? undefined,
      yaml: params.get("yaml") ?? undefined,
    };
  }

  return {
    yaml: raw,
  };
}

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("editor_sessions")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  let body: { title?: string; yaml?: string };

  try {
    body = await readBody(req);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Invalid request body.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 400 }
    );
  }

  if (!body.yaml || typeof body.yaml !== "string") {
    return NextResponse.json({ error: "Missing yaml string." }, { status: 400 });
  }

  const parsed = parseVibeYaml(body.yaml);
  const issues = parsed.doc ? validateVibe(parsed.doc) : [];
  const title = body.title ?? parsed.doc?.workflow.name ?? "Untitled Vibe";

  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("editor_sessions")
    .update({
      title,
      yaml: body.yaml,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Session not found." },
      { status: error ? 500 : 404 }
    );
  }

  return NextResponse.json({
    id,
    title,
    saved: true,
    valid: !parsed.error && issues.filter((i) => i.severity === "error").length === 0,
    parseError: parsed.error,
    issueCount: issues.length,
    issues,
  });
}