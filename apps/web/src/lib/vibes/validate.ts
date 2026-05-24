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

const KNOWN_STEP_FUNCTIONS = new Set([
  "addKnowledgebaseLabel",
  "addKnowledgeSourceToBot",
  "aiExtractVariables",
  "aiProcessing",
  "apiRequest",
  "cancelScheduledFlow",
  "checkTranslateFileStatus",
  "cleanHtml",
  "concludeWorkflow",
  "convertXmlToJson",
  "createBot",
  "createDashboard",
  "createExecutorMagicLink",
  "createHtmlTable",
  "createPersonalBot",
  "createXlsxFile",
  "createZipFile",
  "databaseExtraction",
  "deleteBot",
  "deleteKnowledgeSource",
  "documentBuilderCreateDocument",
  "documentBuilderGetDocument",
  "documentBuilderSetFieldValue",
  "downloadTranslatedFile",
  "executeDatabaseOperation",
  "extractDataFromSheet",
  "fetchDocumentData",
  "flattenSitemap",
  "formatRerankedResults",
  "generateChart",
  "generatePptx",
  "generateTable",
  "getAvailableBusinessTemplates",
  "getBusinessUsers",
  "getBusinessVariables",
  "getDocBuilderTemplates",
  "handleConditional",
  "invokeWorkflow",
  "knowledgeSourceSearch",
  "loopFlow",
  "loopFormat",
  "mcpCallTool",
  "mcpListResources",
  "mcpListTools",
  "mcpReadResource",
  "parallelGroup",
  "preProcessHtmlMedia",
  "presentUiElement",
  "processDocument",
  "promptUser",
  "queryKnowledgebase",
  "queryKnowledgebaseVectors",
  "querySheet",
  "rerankKnowledgebaseVectors",
  "rerankText",
  "scheduleFlow",
  "sendEmail",
  "sendEvent",
  "sendResponse",
  "sendText",
  "setVariable",
  "setWidget",
  "sftpDownloadBatch",
  "sftpDownloadFile",
  "sftpListFiles",
  "sftpMoveFile",
  "sftpUploadFile",
  "sharefileUploadFile",
  "sharepointUploadFile",
  "sleep",
  "unzipFile",
  "updateGlobalVariable",
  "updateKnowledgeSourceLabels",
  "uploadFileForTranslation",
]);

const FUNCTION_INPUT_RULES: Record<
  string,
  {
    required?: string[];
    oneOf?: string[][];
    known?: string[];
  }
> = {
  aiExtractVariables: {
    required: ["text", "variables_to_extract"],
    known: ["text", "variables_to_extract", "max_tokens", "temperature"],
  },
  apiRequest: {
    required: ["method"],
    oneOf: [["endpoint", "url"]],
    known: ["method", "endpoint", "url", "headers", "body", "timeout", "responseType"],
  },
  promptUser: {
    required: ["prompt"],
    known: ["prompt", "prompt_type", "timeout", "default"],
  },
  sendResponse: {
    required: ["message"],
    known: ["type", "message"],
  },
  mcpCallTool: {
    required: ["server_url", "tool_name", "arguments"],
    known: [
      "transport",
      "server_url",
      "tool_name",
      "arguments",
      "auth",
      "headers",
      "timeout",
      "maxResponseSize",
    ],
  },
  handleConditional: {
    required: ["condition"],
    known: ["condition"],
  },
};

function isPlainObject(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function pushIssue(
  issues: VibeIssue[],
  severity: VibeIssue["severity"],
  message: string,
  stepId?: string
) {
  issues.push({
    severity,
    stepId,
    message,
  });
}

function closestKey(key: string, candidates: string[]) {
  const lower = key.toLowerCase();

  const direct = candidates.find((candidate) => candidate.toLowerCase() === lower);
  if (direct) return direct;

  const starts = candidates.find(
    (candidate) => candidate.startsWith(key) || key.startsWith(candidate)
  );
  if (starts) return starts;

  const commonTypos: Record<string, string> = {
    typ: "type",
    the: "then",
    net: "next",
    nxt: "next",
    els: "else",
    methd: "method",
    endpont: "endpoint",
    promt: "prompt",
    messsage: "message",
    mesage: "message",
    temprature: "temperature",
    variable_to_extract: "variables_to_extract",
  };

  return commonTypos[key];
}

function warnUnknownKeys(
  issues: VibeIssue[],
  obj: Record<string, any> | undefined,
  knownKeys: string[],
  location: string,
  stepId?: string
) {
  if (!obj) return;

  for (const key of Object.keys(obj)) {
    if (!knownKeys.includes(key)) {
      const suggestion = closestKey(key, knownKeys);
      pushIssue(
        issues,
        "warning",
        suggestion
          ? `Unknown key ${location}.${key}. Did you mean ${location}.${suggestion}?`
          : `Unknown key ${location}.${key}.`,
        stepId
      );
    }
  }
}

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

function validateVariableReferences(
  issues: VibeIssue[],
  value: unknown,
  stepId: string | undefined,
  path: string
) {
  if (typeof value === "string") {
    const refs = value.match(/\$\{[^}]+}/g) ?? [];

    for (const ref of refs) {
      if (!ref.startsWith("${steps.") && !ref.startsWith("${conversationContext")) {
        pushIssue(
          issues,
          "warning",
          `Variable reference ${ref} at ${path} is unusual. Expected ${"${steps.step_id.output.field}"} or ${"${conversationContext}"}.`,
          stepId
        );
      }
    }

    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => validateVariableReferences(issues, item, stepId, `${path}[${index}]`));
    return;
  }

  if (isPlainObject(value)) {
    for (const [key, nested] of Object.entries(value)) {
      validateVariableReferences(issues, nested, stepId, `${path}.${key}`);
    }
  }
}

function validateInputRules(issues: VibeIssue[], step: VibeStep) {
  const rule = FUNCTION_INPUT_RULES[step.function];
  if (!rule) return;

  const input = step.input ?? {};

  if (rule.known) {
    warnUnknownKeys(issues, input, rule.known, "input", step.id);
  }

  for (const key of rule.required ?? []) {
    if (input[key] === undefined || input[key] === null || input[key] === "") {
      pushIssue(issues, "error", `${step.function} is missing input.${key}.`, step.id);
    }
  }

  for (const group of rule.oneOf ?? []) {
    const hasAny = group.some((key) => input[key] !== undefined && input[key] !== null && input[key] !== "");

    if (!hasAny) {
      pushIssue(
        issues,
        "error",
        `${step.function} requires one of: ${group.map((key) => `input.${key}`).join(", ")}.`,
        step.id
      );
    }
  }
}

function validateAiExtractVariables(issues: VibeIssue[], step: VibeStep) {
  const temp = step.input?.temperature;

  if (typeof temp === "number" && temp > 2) {
    pushIssue(issues, "error", "temperature must be <= 2.", step.id);
  }

  if (typeof temp === "number" && temp < 0) {
    pushIssue(issues, "error", "temperature must be >= 0.", step.id);
  }

  const variables = step.input?.variables_to_extract;

  if (variables !== undefined && !Array.isArray(variables)) {
    pushIssue(issues, "error", "variables_to_extract must be an array.", step.id);
  }

  if (Array.isArray(variables)) {
    for (const [index, variable] of variables.entries()) {
      if (!isPlainObject(variable)) {
        pushIssue(issues, "error", `variables_to_extract[${index}] must be an object.`, step.id);
        continue;
      }

      if (!variable.name) {
        pushIssue(issues, "error", `variables_to_extract[${index}] is missing name.`, step.id);
      }

      if (!variable.type) {
        pushIssue(issues, "warning", `variables_to_extract[${index}] is missing type.`, step.id);
      }
    }
  }
}

function validateHandleConditional(issues: VibeIssue[], step: VibeStep) {
  const input = step.input ?? {};
  const condition = input.condition;

  if (!isPlainObject(condition)) {
    pushIssue(issues, "error", "handleConditional input.condition must be an object.", step.id);
    return;
  }

  warnUnknownKeys(
    issues,
    condition,
    ["type", "condition", "then", "else", "cases"],
    "condition",
    step.id
  );

  if (!condition.type) {
    const suggestion = condition.typ ? " Did you mean condition.type?" : "";
    pushIssue(issues, "error", `handleConditional is missing condition.type.${suggestion}`, step.id);
  }

  if (condition.type && !["if", "switch"].includes(condition.type)) {
    pushIssue(issues, "error", `Unsupported handleConditional condition.type: ${condition.type}`, step.id);
  }

  const inner = condition.condition;

  if (!isPlainObject(inner)) {
    pushIssue(issues, "error", "handleConditional is missing condition.condition object.", step.id);
  } else {
    warnUnknownKeys(issues, inner, ["left", "operator", "right"], "condition.condition", step.id);

    if (inner.left === undefined || inner.left === null || inner.left === "") {
      pushIssue(issues, "error", "handleConditional condition.condition.left is missing.", step.id);
    }

    if (!inner.operator) {
      pushIssue(issues, "error", "handleConditional condition.condition.operator is missing.", step.id);
    } else if (!VALID_OPERATORS.has(inner.operator)) {
      pushIssue(issues, "error", `Invalid operator: ${inner.operator}`, step.id);
    }

    if (
      ["eq", "ne", "gt", "gte", "lt", "lte", "contains", "in", "startsWith", "endsWith", "regex"].includes(
        inner.operator
      ) &&
      (inner.right === undefined || inner.right === null || inner.right === "")
    ) {
      pushIssue(
        issues,
        "warning",
        `Operator ${inner.operator} usually needs a non-empty condition.condition.right value.`,
        step.id
      );
    }

    if (typeof inner.left === "string" && inner.left.includes("${") === false) {
      pushIssue(
        issues,
        "info",
        "condition.condition.left is a literal value. Usually this references a previous step output.",
        step.id
      );
    }
  }

  if (condition.then !== undefined && !isPlainObject(condition.then)) {
    pushIssue(issues, "error", "condition.then must be an object.", step.id);
  }

  if (condition.else !== undefined && !isPlainObject(condition.else)) {
    pushIssue(issues, "error", "condition.else must be an object.", step.id);
  }

  if (isPlainObject(condition.then)) {
    warnUnknownKeys(issues, condition.then, ["next"], "condition.then", step.id);

    if (!condition.then.next) {
      pushIssue(issues, "error", "condition.then is missing next target.", step.id);
    }
  }

  if (isPlainObject(condition.else)) {
    warnUnknownKeys(issues, condition.else, ["next"], "condition.else", step.id);

    if (!condition.else.next) {
      pushIssue(issues, "error", "condition.else is missing next target.", step.id);
    }
  }

  if (condition.type === "if" && !condition.then && !condition.else) {
    pushIssue(
      issues,
      "error",
      "handleConditional if condition should define at least condition.then.next or condition.else.next.",
      step.id
    );
  }

  if (condition.cases !== undefined && !Array.isArray(condition.cases)) {
    pushIssue(issues, "error", "condition.cases must be an array.", step.id);
  }

  if (Array.isArray(condition.cases)) {
    for (const [index, item] of condition.cases.entries()) {
      if (!isPlainObject(item)) {
        pushIssue(issues, "error", `condition.cases[${index}] must be an object.`, step.id);
        continue;
      }

      warnUnknownKeys(issues, item, ["label", "value", "next"], `condition.cases[${index}]`, step.id);

      if (!item.next) {
        pushIssue(issues, "error", `condition.cases[${index}] is missing next target.`, step.id);
      }
    }
  }
}

function validateDuplicateAndMissingIds(issues: VibeIssue[], steps: VibeStep[]) {
  const ids = new Set<string>();

  for (const [index, step] of steps.entries()) {
    if (!step.id) {
      pushIssue(issues, "error", `Step at index ${index} is missing id.`);
      continue;
    }

    if (ids.has(step.id)) {
      pushIssue(issues, "error", `Duplicate step id: ${step.id}`, step.id);
    }

    ids.add(step.id);
  }
}

function validateBranchTargets(issues: VibeIssue[], steps: VibeStep[]) {
  const ids = new Set(steps.map((step) => step.id).filter(Boolean));

  for (const step of steps) {
    for (const target of collectNextTargets(step)) {
      if (!ids.has(target)) {
        pushIssue(issues, "error", `Condition points to missing step: ${target}`, step.id);
      }
    }
  }
}

function validateReachability(issues: VibeIssue[], steps: VibeStep[]) {
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

  if (steps[0]?.id) visit(steps[0].id);

  for (const step of steps) {
    if (step.id && !reachable.has(step.id)) {
      pushIssue(issues, "warning", "This step may be unreachable.", step.id);
    }
  }
}

export function validateVibe(doc: VibeDocument): VibeIssue[] {
  const issues: VibeIssue[] = [];
  const steps = doc.workflow.steps;

  if (!doc.workflow.id) {
    pushIssue(issues, "error", "workflow.id is missing.");
  }

  if (!doc.workflow.name) {
    pushIssue(issues, "warning", "workflow.name is missing.");
  }

  if (!Array.isArray(steps)) {
    pushIssue(issues, "error", "workflow.steps must be an array.");
    return issues;
  }

  validateDuplicateAndMissingIds(issues, steps);

  for (const step of steps) {
    if (!step.function) {
      pushIssue(issues, "error", "Step is missing function.", step.id);
      continue;
    }

    if (!KNOWN_STEP_FUNCTIONS.has(step.function)) {
      pushIssue(issues, "warning", `Unknown StudioX function: ${step.function}`, step.id);
    }

    if (step.input !== undefined && !isPlainObject(step.input)) {
      pushIssue(issues, "error", "step.input must be an object.", step.id);
      continue;
    }

    validateInputRules(issues, step);
    validateVariableReferences(issues, step.input, step.id, "input");

    if (step.function === "aiExtractVariables") {
      validateAiExtractVariables(issues, step);
    }

    if (step.function === "handleConditional") {
      validateHandleConditional(issues, step);
    }
  }

  validateBranchTargets(issues, steps);
  validateReachability(issues, steps);

  return issues;
}