import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { parseVibeYaml } from "@/lib/vibes/parse";
import { validateVibe } from "@/lib/vibes/validate";

async function readSessionBody(req: NextRequest): Promise<{
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
    title: "StudioX Vibe",
    yaml: raw,
  };
}

export async function POST(req: NextRequest) {
  let body: { title?: string; yaml?: string };

  try {
    body = await readSessionBody(req);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Invalid request body.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 400 }
    );
  }

  const yaml = body.yaml;
  const title = body.title ?? "Untitled Vibe";

  if (!yaml || typeof yaml !== "string") {
    return NextResponse.json({ error: "Missing yaml string." }, { status: 400 });
  }

  const parsed = parseVibeYaml(yaml);
  const issues = [...(parsed.rawIssues ?? []), ...(parsed.doc ? validateVibe(parsed.doc) : [])];

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