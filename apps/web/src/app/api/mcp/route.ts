import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { parseVibeYaml } from "@/lib/vibes/parse";
import { validateVibe } from "@/lib/vibes/validate";
import { buildVibeGraph } from "@/lib/vibes/graph";

type McpBody = {
  id?: unknown;
  method?: string;
  params?: {
    name?: string;
    arguments?: Record<string, unknown>;
  };
};

function jsonrpc(id: unknown, result: unknown) {
  return NextResponse.json({
    jsonrpc: "2.0",
    id,
    result,
  });
}
export async function GET() {
  return NextResponse.json({
    name: "vibeflow-studio-mcp",
    version: "form-encoded-enabled-1",
    supportsFormEncoded: true,
  });
}
function jsonrpcError(id: unknown, code: number, message: string) {
  return NextResponse.json({
    jsonrpc: "2.0",
    id,
    error: { code, message },
  });
}

const tools = [
  {
    name: "create_editor_session",
    description:
      "Create a VibeFlow Studio editor session from StudioX Vibe YAML and return a public editor URL.",
    inputSchema: {
      type: "object",
      required: ["yaml"],
      properties: {
        yaml: { type: "string" },
        title: { type: "string" },
      },
    },
  },
  {
    name: "validate_vibe_yaml",
    description: "Validate StudioX Vibe YAML and return structural/control-flow issues.",
    inputSchema: {
      type: "object",
      required: ["yaml"],
      properties: {
        yaml: { type: "string" },
      },
    },
  },
  {
    name: "analyze_vibe_yaml",
    description:
      "Analyze StudioX Vibe YAML and return step count, function usage, graph nodes, graph edges, and issues.",
    inputSchema: {
      type: "object",
      required: ["yaml"],
      properties: {
        yaml: { type: "string" },
      },
    },
  },
];

async function readMcpBody(req: NextRequest): Promise<McpBody> {
  const contentType = req.headers.get("content-type") ?? "";
  const raw = await req.text();

  if (contentType.includes("application/json")) {
    return JSON.parse(raw);
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = new URLSearchParams(raw);

    const id = form.get("id") ?? "studiox-form-1";
    const method = form.get("method") ?? "tools/call";
    const name = form.get("name") ?? form.get("tool_name") ?? undefined;
    const yaml = form.get("yaml") ?? undefined;
    const title = form.get("title") ?? undefined;

    return {
      id,
      method,
      params: {
        name,
        arguments: {
          yaml,
          title,
        },
      },
    };
  }

  throw new Error(`Unsupported content type: ${contentType}`);
}

function getYamlArg(args: Record<string, unknown>) {
  const yaml = args.yaml;
  return typeof yaml === "string" ? yaml : "";
}

function getTitleArg(args: Record<string, unknown>) {
  const title = args.title;
  return typeof title === "string" && title.trim() ? title : "StudioX Vibe";
}

async function createEditorSession(id: unknown, args: Record<string, unknown>) {
  const yaml = getYamlArg(args);
  const title = getTitleArg(args);

  if (!yaml) {
    return jsonrpcError(id, -32602, "Missing yaml string.");
  }

  const parsed = parseVibeYaml(yaml);
  const issues = parsed.doc ? validateVibe(parsed.doc) : [];

  const sessionId = nanoid(10);
  const supabase = getSupabaseServerClient();

  const { error } = await supabase.from("editor_sessions").insert({
    id: sessionId,
    title,
    yaml,
  });

  if (error) {
    return jsonrpcError(id, -32000, error.message);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const url = `${appUrl}/editor/session/${sessionId}`;
  const valid = !parsed.error && issues.filter((i) => i.severity === "error").length === 0;

  return jsonrpc(id, {
    id: sessionId,
    url,
    valid,
    issueCount: issues.length,
    parseError: parsed.error,
    content: [
      {
        type: "text",
        text: url,
      },
    ],
    isError: false,
  });
}

function validateYaml(id: unknown, args: Record<string, unknown>) {
  const yaml = getYamlArg(args);

  if (!yaml) {
    return jsonrpcError(id, -32602, "Missing yaml string.");
  }

  const parsed = parseVibeYaml(yaml);
  const issues = parsed.doc ? validateVibe(parsed.doc) : [];

  return jsonrpc(id, {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            valid: !parsed.error && issues.filter((i) => i.severity === "error").length === 0,
            parseError: parsed.error,
            issueCount: issues.length,
            issues,
          },
          null,
          2
        ),
      },
    ],
    isError: false,
  });
}

function analyzeYaml(id: unknown, args: Record<string, unknown>) {
  const yaml = getYamlArg(args);

  if (!yaml) {
    return jsonrpcError(id, -32602, "Missing yaml string.");
  }

  const parsed = parseVibeYaml(yaml);

  if (!parsed.doc) {
    return jsonrpc(id, {
      content: [
        {
          type: "text",
          text: JSON.stringify({ parseError: parsed.error }, null, 2),
        },
      ],
      isError: true,
    });
  }

  const issues = validateVibe(parsed.doc);
  const graph = buildVibeGraph(parsed.doc, issues);

  const functions = parsed.doc.workflow.steps.reduce<Record<string, number>>((acc, step) => {
    acc[step.function] = (acc[step.function] ?? 0) + 1;
    return acc;
  }, {});

  return jsonrpc(id, {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            workflowId: parsed.doc.workflow.id,
            workflowName: parsed.doc.workflow.name,
            stepCount: parsed.doc.workflow.steps.length,
            functions,
            nodeCount: graph.nodes.length,
            edgeCount: graph.edges.length,
            valid: issues.filter((i) => i.severity === "error").length === 0,
            issueCount: issues.length,
            issues,
          },
          null,
          2
        ),
      },
    ],
    isError: false,
  });
}

export async function POST(req: NextRequest) {
  let body: McpBody;

  try {
    body = await readMcpBody(req);
  } catch (error) {
    return jsonrpcError(
      null,
      -32700,
      error instanceof Error ? error.message : "Invalid request body."
    );
  }

  const { id, method, params } = body;

  if (method === "initialize") {
    return jsonrpc(id, {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {},
      },
      serverInfo: {
        name: "vibeflow-studio-mcp",
        version: "0.1.0",
      },
    });
  }

  if (method === "tools/list") {
    return jsonrpc(id, { tools });
  }

  if (method === "tools/call") {
    const name = params?.name;
    const args = params?.arguments ?? {};

    if (name === "create_editor_session") {
      return createEditorSession(id, args);
    }

    if (name === "validate_vibe_yaml") {
      return validateYaml(id, args);
    }

    if (name === "analyze_vibe_yaml") {
      return analyzeYaml(id, args);
    }

    return jsonrpcError(id, -32601, `Unknown tool: ${name}`);
  }

  return jsonrpcError(id, -32601, `Method not found: ${method}`);
  
}