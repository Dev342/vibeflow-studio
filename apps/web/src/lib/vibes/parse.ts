import YAML from "yaml";
import { VibeDocument, VibeIssue } from "./types";

function lintRawYaml(source: string): VibeIssue[] {
  const issues: VibeIssue[] = [];
  const lines = source.split(/\r?\n/);

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) return;
    if (trimmed === "|" || trimmed === ">") return;
    if (trimmed.startsWith("- ")) return;

    const looksLikeYamlKey = /^[A-Za-z0-9_$.-]+\s*:/.test(trimmed);
    const looksLikeListItem = /^-\s+/.test(trimmed);
    const looksLikeBlockScalarContent = line.startsWith(" ") && !trimmed.includes(":");

    if (!looksLikeYamlKey && !looksLikeListItem && !looksLikeBlockScalarContent) {
      issues.push({
        severity: "warning",
        message: `Suspicious YAML line ${lineNumber}: "${trimmed}". Expected a key like "name:" or a list item like "- id:".`,
      });
    }
  });

  return issues;
}

export function parseVibeYaml(source: string): {
  doc: VibeDocument | null;
  error: string | null;
  rawIssues: VibeIssue[];
} {
  const rawIssues = lintRawYaml(source);

  try {
    const parsed = YAML.parse(source);

    if (!parsed?.workflow) {
      return { doc: null, error: "Missing root `workflow` object.", rawIssues };
    }

    if (!Array.isArray(parsed.workflow.steps)) {
      return { doc: null, error: "Missing `workflow.steps` array.", rawIssues };
    }

    return { doc: parsed as VibeDocument, error: null, rawIssues };
  } catch (error) {
    return {
      doc: null,
      error: error instanceof Error ? error.message : String(error),
      rawIssues,
    };
  }
}

export function stringifyVibeYaml(doc: VibeDocument): string {
  return YAML.stringify(doc, {
    lineWidth: 120,
  });
}