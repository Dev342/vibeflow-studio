import { VibeDocument, VibeGraph, VibeIssue, VibeStep } from "./types";

const NODE_X_GAP = 460;
const NODE_Y_GAP = 260;
const START_X = 80;
const START_Y = 320;

const dangerFunctions = new Set([
  "deleteBot",
  "deleteKnowledgeSource",
  "cancelScheduledFlow",
  "sftpMoveFile",
]);

const writeFunctions = new Set([
  "apiRequest",
  "mcpCallTool",
  "sendEmail",
  "sendEvent",
  "sendText",
  "setVariable",
  "setWidget",
  "updateGlobalVariable",
  "addKnowledgebaseLabel",
  "addKnowledgeSourceToBot",
  "createBot",
  "createDashboard",
  "createExecutorMagicLink",
  "createHtmlTable",
  "createPersonalBot",
  "createXlsxFile",
  "createZipFile",
  "databaseExtraction",
  "documentBuilderCreateDocument",
  "documentBuilderSetFieldValue",
  "executeDatabaseOperation",
  "generateChart",
  "generatePptx",
  "generateTable",
  "invokeWorkflow",
  "scheduleFlow",
  "sendResponse",
  "sftpUploadFile",
  "sharefileUploadFile",
  "sharepointUploadFile",
  "updateKnowledgeSourceLabels",
  "uploadFileForTranslation",
]);

const readFunctions = new Set([
  "aiExtractVariables",
  "aiProcessing",
  "checkTranslateFileStatus",
  "cleanHtml",
  "convertXmlToJson",
  "documentBuilderGetDocument",
  "downloadTranslatedFile",
  "extractDataFromSheet",
  "fetchDocumentData",
  "flattenSitemap",
  "formatRerankedResults",
  "getAvailableBusinessTemplates",
  "getBusinessUsers",
  "getBusinessVariables",
  "getDocBuilderTemplates",
  "knowledgeSourceSearch",
  "mcpListResources",
  "mcpListTools",
  "mcpReadResource",
  "preProcessHtmlMedia",
  "processDocument",
  "queryKnowledgebase",
  "queryKnowledgebaseVectors",
  "querySheet",
  "rerankKnowledgebaseVectors",
  "rerankText",
  "sftpDownloadBatch",
  "sftpDownloadFile",
  "sftpListFiles",
  "unzipFile",
]);

function getNodeType(step: VibeStep) {
  if (step.function === "handleConditional") return "condition";
  if (step.function === "promptUser") return "prompt";
  if (step.function === "apiRequest") return "api";
  if (step.function === "sendResponse") return "response";
  if (step.function === "loopFlow" || step.function === "loopFormat") return "loop";
  if (step.function.startsWith("ai")) return "ai";
  return "default";
}

function getRisk(step: VibeStep): "read" | "write" | "danger" | "unknown" {
  if (dangerFunctions.has(step.function)) return "danger";

  if (step.function === "apiRequest") {
    const method = String(step.input?.method ?? "").toUpperCase();

    if (method === "DELETE") return "danger";
    if (["POST", "PUT", "PATCH"].includes(method)) return "write";
    if (method === "GET") return "read";

    return "write";
  }

  if (writeFunctions.has(step.function)) return "write";
  if (readFunctions.has(step.function)) return "read";

  return "unknown";
}

function summarizeStep(step: VibeStep) {
  if (step.function === "handleConditional") {
    const condition = step.input?.condition?.condition;
    const operator = condition?.operator;
    const right = condition?.right;

    if (operator && right !== undefined && right !== null) {
      return `Routes based on whether response ${operator} ${JSON.stringify(right)}.`;
    }

    return "Routes the workflow based on a condition.";
  }

  if (step.function === "promptUser") {
    return "Pauses and asks the user for input.";
  }

  if (step.function === "apiRequest") {
    const method = step.input?.method ?? "REQUEST";
    const endpoint = step.input?.endpoint ?? step.input?.url ?? "external endpoint";
    return `${method} request to ${endpoint}`;
  }

  if (step.function === "mcpCallTool") {
    const tool = step.input?.tool_name ?? "MCP tool";
    return `Calls MCP tool: ${tool}`;
  }

  if (step.function === "sendResponse") {
    return "Sends the final response and ends this path.";
  }

  if (step.function === "aiExtractVariables") {
    return "Extracts structured variables from conversation context.";
  }

  if (step.function === "queryKnowledgebase") {
    return "Searches StudioX knowledgebase context.";
  }

  return `Runs ${step.function}.`;
}

function formatConditionValue(value: unknown) {
  if (value === undefined) return "";
  if (value === null) return "null";
  if (typeof value === "string") return `"${value}"`;
  return JSON.stringify(value);
}

function formatConditionLabel(step: VibeStep, branch: "then" | "else" | "case", caseLabel?: string) {
  const condition = step.input?.condition;
  const inner = condition?.condition;
  const operator = inner?.operator;
  const right = inner?.right;

  if (branch === "else") return "otherwise / else";
  if (branch === "case") return caseLabel ? `case: ${caseLabel}` : "case";

  if (operator && right !== undefined && right !== null) {
    return `if ${operator} ${formatConditionValue(right)}`;
  }

  return "if true";
}

function addEdge(
  edges: VibeGraph["edges"],
  source: string,
  target: string,
  label: string,
  animated = false
) {
  edges.push({
    id: `${source}-${target}-${edges.length}`,
    source,
    target,
    label,
    type: "smoothstep",
    animated,
    markerEnd: {
      type: "arrowclosed",
    },
    data: {
      label,
    },
  });
}

function buildEdges(doc: VibeDocument) {
  const steps = doc.workflow.steps;
  const ids = new Set(steps.map((step) => step.id));
  const edges: VibeGraph["edges"] = [];

  steps.forEach((step, index) => {
    if (step.function === "handleConditional") {
      const condition = step.input?.condition;

      if (condition?.then?.next && ids.has(condition.then.next)) {
        addEdge(edges, step.id, condition.then.next, formatConditionLabel(step, "then"), true);
      }

      if (condition?.else?.next && ids.has(condition.else.next)) {
        addEdge(edges, step.id, condition.else.next, formatConditionLabel(step, "else"), true);
      }

      if (Array.isArray(condition?.cases)) {
        condition.cases.forEach((item: any) => {
          if (item?.next && ids.has(item.next)) {
            addEdge(
              edges,
              step.id,
              item.next,
              formatConditionLabel(step, "case", item.label ?? item.value),
              true
            );
          }
        });
      }

      return;
    }

    if (step.function === "sendResponse" || step.function === "concludeWorkflow") {
      return;
    }

    const next = steps[index + 1];

    if (next?.id) {
      addEdge(edges, step.id, next.id, "next");
    }
  });

  return edges;
}

function buildDepths(steps: VibeStep[], edges: VibeGraph["edges"]) {
  const depths = new Map<string, number>();
  const outgoing = new Map<string, string[]>();

  edges.forEach((edge) => {
    const list = outgoing.get(edge.source) ?? [];
    list.push(edge.target);
    outgoing.set(edge.source, list);
  });

  const first = steps[0];

  if (!first) return depths;

  const queue: Array<{ id: string; depth: number }> = [{ id: first.id, depth: 0 }];
  depths.set(first.id, 0);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const targets = outgoing.get(current.id) ?? [];

    for (const target of targets) {
      if (!depths.has(target)) {
        depths.set(target, current.depth + 1);
        queue.push({ id: target, depth: current.depth + 1 });
      }
    }
  }

  steps.forEach((step, index) => {
    if (!depths.has(step.id)) {
      depths.set(step.id, Math.floor(index / 2));
    }
  });

  return depths;
}

function buildPositions(steps: VibeStep[], edges: VibeGraph["edges"]) {
  const depths = buildDepths(steps, edges);
  const groups = new Map<number, VibeStep[]>();

  steps.forEach((step) => {
    const depth = depths.get(step.id) ?? 0;
    const group = groups.get(depth) ?? [];

    group.push(step);
    groups.set(depth, group);
  });

  const positions = new Map<string, { x: number; y: number }>();

  groups.forEach((group, depth) => {
    const groupHeight = (group.length - 1) * NODE_Y_GAP;

    group.forEach((step, index) => {
      positions.set(step.id, {
        x: START_X + depth * NODE_X_GAP,
        y: START_Y + index * NODE_Y_GAP - groupHeight / 2,
      });
    });
  });

  return positions;
}

export function buildVibeGraph(doc: VibeDocument, issues: VibeIssue[]): VibeGraph {
  const steps = doc.workflow.steps;
  const edges = buildEdges(doc);
  const positions = buildPositions(steps, edges);

  const nodes = steps.map((step) => {
    const stepIssues = issues.filter((issue) => issue.stepId === step.id);
    const position = positions.get(step.id) ?? { x: START_X, y: START_Y };

    return {
      id: step.id,
      type: getNodeType(step),
      position,
      data: {
        stepId: step.id,
        functionName: step.function,
        label: step.id,
        summary: summarizeStep(step),
        risk: getRisk(step),
        issues: stepIssues,
        rawStep: step,
      },
    };
  });

  return {
    nodes,
    edges,
  };
}