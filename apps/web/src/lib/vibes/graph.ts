import { VibeDocument, VibeGraph, VibeIssue, VibeStep } from "./types";

function classify(step: VibeStep): string {
  if (step.function === "handleConditional") return "condition";
  if (step.function === "promptUser") return "prompt";
  if (step.function === "apiRequest") return "api";
  if (step.function === "mcpCallTool") return "api";
  if (step.function === "sendResponse") return "response";
  if (step.function === "invokeWorkflow") return "workflow";
  if (step.function === "loopFlow") return "loop";
  if (step.function.startsWith("ai")) return "ai";
  return "default";
}

function riskOf(step: VibeStep): "read" | "write" | "danger" | "unknown" {
  const raw = JSON.stringify(step).toLowerCase();

  if (
    raw.includes("delete") ||
    raw.includes("remove") ||
    raw.includes("merge_pull_request") ||
    raw.includes("run_workflow") ||
    raw.includes("restart") ||
    raw.includes("admin")
  ) {
    return "danger";
  }

  if (
    step.function === "apiRequest" ||
    step.function === "mcpCallTool" ||
    raw.includes("create_") ||
    raw.includes("add_") ||
    raw.includes("update_")
  ) {
    return "write";
  }

  if (
    raw.includes("list_") ||
    raw.includes("get_") ||
    raw.includes("check_") ||
    step.function.startsWith("ai")
  ) {
    return "read";
  }

  return "unknown";
}

function summarize(step: VibeStep): string {
  if (step.function === "handleConditional") {
    const c = step.input?.condition;
    const left = c?.condition?.left ?? "";
    const op = c?.condition?.operator ?? "";
    const right = c?.condition?.right ?? "";
    return `if ${left} ${op} ${right}`;
  }

  if (step.function === "apiRequest") {
    const tool = step.input?.body?.params?.name;
    if (tool) return `MCP tools/call → ${tool}`;
    return `${step.input?.method ?? "HTTP"} ${step.input?.endpoint ?? step.input?.url ?? ""}`;
  }

  if (step.function === "aiExtractVariables") {
    const vars = step.input?.variables_to_extract;
    if (Array.isArray(vars)) return `extracts ${vars.map((v) => v.name).join(", ")}`;
  }

  if (step.function === "promptUser") {
    return "waits for user response";
  }

  if (step.function === "sendResponse") {
    return "ends workflow with response";
  }

  return step.function;
}

function conditionTargets(step: VibeStep): Array<{ label: string; target: string }> {
  const c = step.input?.condition;
  const out: Array<{ label: string; target: string }> = [];

  if (step.function !== "handleConditional") return out;

  if (c?.then?.next) out.push({ label: "then", target: c.then.next });
  if (c?.else?.next) out.push({ label: "else", target: c.else.next });

  if (Array.isArray(c?.cases)) {
    for (const item of c.cases) {
      if (item?.next) out.push({ label: item.label ?? "case", target: item.next });
    }
  }

  return out;
}

export function buildVibeGraph(doc: VibeDocument, issues: VibeIssue[]): VibeGraph {
  const steps = doc.workflow.steps;

  const nodes = steps.map((step, index) => ({
    id: step.id,
    type: classify(step),
    position: {
      x: (index % 4) * 360,
      y: Math.floor(index / 4) * 220,
    },
    data: {
      stepId: step.id,
      functionName: step.function,
      label: step.id,
      summary: summarize(step),
      risk: riskOf(step),
      issues: issues.filter((i) => i.stepId === step.id),
      rawStep: step,
    },
  }));

  const edges: VibeGraph["edges"] = [];
  const explicitSources = new Set<string>();

  for (const step of steps) {
    const targets = conditionTargets(step);
    if (targets.length) {
      explicitSources.add(step.id);
      for (const target of targets) {
        edges.push({
          id: `${step.id}-${target.label}-${target.target}`,
          source: step.id,
          target: target.target,
          label: target.label,
          type: "smoothstep",
          animated: target.label === "then",
          markerEnd: { type: "arrowclosed" },
        });
      }
    }
  }

  for (let i = 0; i < steps.length - 1; i++) {
    const step = steps[i];
    const next = steps[i + 1];

    if (explicitSources.has(step.id)) continue;
    if (step.function === "sendResponse" || step.function === "concludeWorkflow") continue;

    edges.push({
      id: `${step.id}-${next.id}`,
      source: step.id,
      target: next.id,
      type: "smoothstep",
      markerEnd: { type: "arrowclosed" },
    });
  }

  return { nodes, edges };
}