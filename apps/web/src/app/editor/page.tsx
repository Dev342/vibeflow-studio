import { VibesEditor } from "@/components/vibes-editor/VibesEditor";
import { sampleYaml } from "@/lib/vibes/sample";

export default function EditorPage() {
  return <VibesEditor initialYaml={sampleYaml} />;
}