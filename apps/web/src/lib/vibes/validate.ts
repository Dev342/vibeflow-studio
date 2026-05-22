import { VibeDocument, VibeIssue, VibeStep } from "./types";

const VALID_OPERATORS = new Set([
  "eq",
  "ne",
  "gt",
  "gte",
  "lt",
  "lte",
  "contains",
  "exists",
  "in",
  "startsWith",
  "endsWith",
  "regex",
  "isEmpty",
  "isNotEmpty",
  "and",
  "or",
]);

function collectNextTargets(step: VibeStep): string[] {
  if (step.function !== "handleConditional") return [];

  const condition = step.input?.condition;
  const targets: string[] = [];

  if (condition?.then?.next) targets.push(condition.then.next);
  if (condition?.else?.next) targets.push(condition.else.next);

  if (condition?.cases && Array.isArray(condition.cases)) {
    for (const item of condition.cases) {
      if (item?.next) targets.push(item.next);
    }
  }

  return targets;
}

export function validateVibe(doc: VibeDocument): VibeIssue[] {
  const issues: VibeIssue[] = [];
  const steps = doc.workflow.steps;
  const ids = new Set<string>();

  for (const step of steps) {
    if (!step.id) {
      issues.push({
        severity: "error",
        message: "Step is missing `id`.",
      });
    }

    if (!step.function) {
      issues.push({
        severity: "error",
        stepId: step.id,
        message: "Step is missing `function`.",
      });
    }

    if (ids.has(step.id)) {
      issues.push({
        severity: "error",
        stepId: step.id,
        message: `Duplicate step id: ${step.id}`,
      });
    }

    ids.add(step.id);

    if (step.function === "aiExtractVariables") {
      const temp = step.input?.temperature;
      if (typeof temp === "number" && temp > 2) {
        issues.push({
          severity: "error",
          stepId: step.id,
          message: "temperature must be <= 2.",
        });
      }
    }

    if (step.function === "apiRequest") {
      if (!step.input?.method) {
        issues.push({
          severity: "error",
          stepId: step.id,
          message: "apiRequest is missing `method`.",
        });
      }

      if (!step.input?.endpoint && !step.input?.url) {
        issues.push({
          severity: "error",
          stepId: step.id,
          message: "apiRequest is missing `endpoint`.",
        });
      }
    }

    if (step.function === "promptUser" && !step.input?.prompt) {
      issues.push({
        severity: "error",
        stepId: step.id,
        message: "promptUser is missing `prompt`.",
      });
    }

    if (step.function === "sendResponse" && !step.input?.message) {
      issues.push({
        severity: "error",
        stepId: step.id,
        message: "sendResponse is missing `message`.",
      });
    }

    if (step.function === "handleConditional") {
      const condition = step.input?.condition;

      if (!condition?.type) {
        issues.push({
          severity: "error",
          stepId: step.id,
          message: "handleConditional is missing condition.type.",
        });
      }

      const operator = condition?.condition?.operator;
      if (operator && !VALID_OPERATORS.has(operator)) {
        issues.push({
          severity: "error",
          stepId: step.id,
          message: `Invalid operator: ${operator}`,
        });
      }
    }
  }

  for (const step of steps) {
    for (const target of collectNextTargets(step)) {
      if (!ids.has(target)) {
        issues.push({
          severity: "error",
          stepId: step.id,
          message: `Condition points to missing step: ${target}`,
        });
      }
    }
  }

  const reachable = new Set<string>();
  const byId = new Map(steps.map((s) => [s.id, s]));

  function visit(stepId: string) {
    if (reachable.has(stepId)) return;
    const step = byId.get(stepId);
    if (!step) return;

    reachable.add(stepId);

    const explicitTargets = collectNextTargets(step);
    if (explicitTargets.length) {
      explicitTargets.forEach(visit);
      return;
    }

    const index = steps.findIndex((s) => s.id === stepId);
    const next = steps[index + 1];

    if (next && step.function !== "sendResponse" && step.function !== "concludeWorkflow") {
      visit(next.id);
    }
  }

  if (steps[0]) visit(steps[0].id);

  for (const step of steps) {
    if (!reachable.has(step.id)) {
      issues.push({
        severity: "warning",
        stepId: step.id,
        message: "This step may be unreachable.",
      });
    }
  }

  return issues;
}