import YAML from "yaml";
import { VibeDocument } from "./types";

export function parseVibeYaml(source: string): {
  doc: VibeDocument | null;
  error: string | null;
} {
  try {
    const parsed = YAML.parse(source);

    if (!parsed?.workflow) {
      return { doc: null, error: "Missing root `workflow` object." };
    }

    if (!Array.isArray(parsed.workflow.steps)) {
      return { doc: null, error: "Missing `workflow.steps` array." };
    }

    return { doc: parsed as VibeDocument, error: null };
  } catch (error) {
    return {
      doc: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function stringifyVibeYaml(doc: VibeDocument): string {
  return YAML.stringify(doc, {
    lineWidth: 120,
  });
}