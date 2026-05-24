import YAML from "yaml";
import { VibeDocument, VibeIssue } from "./types";

function indentationOf(line: string): number {
  const match = line.match(/^ */);
  return match ? match[0].length : 0;
}

function lintRawYaml(source: string): VibeIssue[] {
  const issues: VibeIssue[] = [];
  const lines = source.split(/\r?\n/);

  let blockScalarIndent: number | null = null;

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();
    const indent = indentationOf(line);

    if (!trimmed || trimmed.startsWith("#")) return;

    const malformedKeyNoSpace = /^[A-Za-z0-9_$.-]+:[^\s|>]/.test(trimmed);

    if (malformedKeyNoSpace) {
      issues.push({
        severity: "error",
        lineNumber,
        column: indent + 1,
        message: `Malformed YAML key on line ${lineNumber}: "${trimmed}". Add a space after the colon, for example "input: ...".`,
      });
    }

    if (blockScalarIndent !== null) {
      if (indent >= blockScalarIndent) {
        const openRefs = (trimmed.match(/\$\{/g) ?? []).length;
        const closeRefs = (trimmed.match(/}/g) ?? []).length;

        if (openRefs !== closeRefs && trimmed.includes("${")) {
          issues.push({
            severity: "warning",
            lineNumber,
            column: indent + 1,
            message: `Possible broken variable reference on line ${lineNumber}. Variable references should stay on one line like "\${steps.step_id.output.field}".`,
          });
        }

        return;
      }

      blockScalarIndent = null;
    }

    const startsBlockScalar = /:\s*[|>][-+]?\s*$/.test(trimmed);

    if (startsBlockScalar) {
      blockScalarIndent = indent + 1;
      return;
    }

    if (trimmed.startsWith("- ")) return;

    const isKeyValue = /^[A-Za-z0-9_$.-]+\s*:/.test(trimmed);
    const isQuotedString =
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"));
    const isStandaloneAllowed =
      trimmed.startsWith("${") ||
      trimmed.startsWith("[") ||
      trimmed.startsWith("{") ||
      trimmed === "true" ||
      trimmed === "false" ||
      trimmed === "null";

    if (!isKeyValue && !isQuotedString && !isStandaloneAllowed && !malformedKeyNoSpace) {
      issues.push({
        severity: "warning",
        lineNumber,
        column: indent + 1,
        message: `Suspicious YAML line ${lineNumber}: "${trimmed}". This looks like stray text. Add a ":" key, turn it into a list item with "-", or move it inside a "|"-style text block.`,
      });
    }
  });

  return issues;
}

function getYamlErrorLocation(error: any): { lineNumber?: number; column?: number } {
  const linePos = error?.linePos?.[0];

  if (linePos?.line) {
    return {
      lineNumber: linePos.line,
      column: linePos.col,
    };
  }

  return {};
}

export function parseVibeYaml(source: string): {
  doc: VibeDocument | null;
  error: string | null;
  rawIssues: VibeIssue[];
} {
  const rawIssues = lintRawYaml(source);

  try {
    const parsed = YAML.parseDocument(source, {
      prettyErrors: true,
      strict: true,
    });

    if (parsed.errors.length > 0) {
      const parseIssues: VibeIssue[] = parsed.errors.map((error: any) => {
        const location = getYamlErrorLocation(error);

        return {
          severity: "error",
          lineNumber: location.lineNumber,
          column: location.column,
          message: error.message,
        };
      });

      return {
        doc: null,
        error: parsed.errors.map((err) => err.message).join("\n"),
        rawIssues: [...rawIssues, ...parseIssues],
      };
    }

    const data = parsed.toJSON();

    if (!data?.workflow) {
      return {
        doc: null,
        error: "Missing root `workflow` object.",
        rawIssues,
      };
    }

    if (!Array.isArray(data.workflow.steps)) {
      return {
        doc: null,
        error: "Missing `workflow.steps` array.",
        rawIssues,
      };
    }

    return {
      doc: data as VibeDocument,
      error: null,
      rawIssues,
    };
  } catch (error: any) {
    const location = getYamlErrorLocation(error);

    return {
      doc: null,
      error: error instanceof Error ? error.message : String(error),
      rawIssues: [
        ...rawIssues,
        {
          severity: "error",
          lineNumber: location.lineNumber,
          column: location.column,
          message: error instanceof Error ? error.message : String(error),
        },
      ],
    };
  }
}

export function stringifyVibeYaml(doc: VibeDocument): string {
  return YAML.stringify(doc, {
    lineWidth: 120,
  });
}