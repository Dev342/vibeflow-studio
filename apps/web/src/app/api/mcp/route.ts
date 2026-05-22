import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { parseVibeYaml } from "@/lib/vibes/parse";
import { validateVibe } from "@/lib/vibes/validate";
import { buildVibeGraph } from "@/lib/vibes/graph";

function jsonrpc(id: unknown, result: unknown) {
  return NextResponse.json({
    jsonrpc: "2.0",
    id,
    result,
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

export async function POST(req: NextRequest) {
  const body = await req.json();
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
      const yaml = args.yaml;
      const title = args.title ?? "StudioX Vibe";

      if (!yaml || typeof yaml !== "string") {
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

      return jsonrpc(id, {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                url: `${appUrl}/editor/session/${sessionId}`,
                valid:
                  !parsed.error &&
                  issues.filter((i) => i.severity === "error").length === 0,
                issueCount: issues.length,
                parseError: parsed.error,
              },
              null,
              2
            ),
          },
        ],
        isError: false,
      });
    }

    if (name === "validate_vibe_yaml") {
      const yaml = args.yaml;

      if (!yaml || typeof yaml !== "string") {
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
                valid:
                  !parsed.error &&
                  issues.filter((i) => i.severity === "error").length === 0,
                parseError: parsed.error,
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

    if (name === "analyze_vibe_yaml") {
      const yaml = args.yaml;

      if (!yaml || typeof yaml !== "string") {
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

      const functions = parsed.doc.workflow.steps.reduce<Record<string, number>>(
        (acc, step) => {
          acc[step.function] = (acc[step.function] ?? 0) + 1;
          return acc;
        },
        {}
      );

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

    return jsonrpcError(id, -32601, `Unknown tool: ${name}`);
  }

  return jsonrpcError(id, -32601, `Method not found: ${method}`);
}