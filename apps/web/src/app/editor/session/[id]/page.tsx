import { VibesEditor } from "@/components/vibes-editor/VibesEditor";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { sampleYaml } from "@/lib/vibes/sample";

export default async function SessionEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = getSupabaseServerClient();

  const { data } = await supabase
    .from("editor_sessions")
    .select("*")
    .eq("id", id)
    .single();

  return <VibesEditor initialYaml={data?.yaml ?? sampleYaml} />;
}