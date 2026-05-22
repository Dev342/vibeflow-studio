import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

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