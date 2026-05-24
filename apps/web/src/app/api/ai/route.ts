import { NextRequest, NextResponse } from "next/server";
import { parseVibeYaml } from "@/lib/vibes/parse";
import { validateVibe } from "@/lib/vibes/validate";

type AiPayload = {
  reply: string;
  changed: boolean;
  yaml: string | null;
  summary?: string | null;
};

const systemPrompt = `
You are VibeFlow Copilot, an expert StudioX Vibe YAML assistant.

You help users understand, debug, and modify StudioX workflow YAML.

Rules:
- Return ONLY valid JSON. No markdown fences.
- JSON shape:
  {
    "reply": "Human-readable explanation",
    "changed": true or false,
    "yaml": "Full updated YAML if changed, otherwise null",
    "summary": "Short summary of the change or null"
  }
- If the user asks for an explanation, do not change YAML.
- If the user asks to add, remove, rewrite, fix, or improve workflow behavior, return the full updated YAML.
- Preserve the existing workflow structure when possible.
- Prefer valid StudioX functions: aiExtractVariables, promptUser, handleConditional, apiRequest, mcpCallTool, queryKnowledgebase, sendResponse, setVariable, loopFlow.
- Variable references should stay on one line and use format \${steps.step_id.output.field}.
- Keep YAML clean and valid.
- Do not invent API secrets.
- Do not claim the workflow was deployed or executed.
`;

function extractJson(text: string): AiPayload {
  try {
    return JSON.parse(text);
  } catch {
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");

    if (first >= 0 && last > first) {
      return JSON.parse(text.slice(first, last + 1));
    }

    throw new Error("AI response was not valid JSON.");
  }
}

async function callAnthropic(prompt: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY.");
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 5000,
      temperature: 0.2,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error?.message ?? "Anthropic request failed.");
  }

  const text = data?.content?.[0]?.text;

  if (!text) {
    throw new Error("Anthropic returned no text.");
  }

  return extractJson(text);
}

async function callOpenAI(prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

  if (!model) {
    throw new Error("Missing OPENAI_MODEL. Add your preferred OpenAI model name in Vercel env vars.");
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error?.message ?? "OpenAI request failed.");
  }

  const text = data?.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error("OpenAI returned no text.");
  }

  return extractJson(text);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userPrompt = body.prompt;
    const yaml = body.yaml;

    if (!userPrompt || typeof userPrompt !== "string") {
      return NextResponse.json({ error: "Missing prompt string." }, { status: 400 });
    }

    if (!yaml || typeof yaml !== "string") {
      return NextResponse.json({ error: "Missing yaml string." }, { status: 400 });
    }

    const prompt = `
Current StudioX Vibe YAML:

${yaml}

User request:

${userPrompt}

Respond using the required JSON shape only.
`;

    const provider = process.env.VIBE_AI_PROVIDER ?? "anthropic";
    const result = provider === "openai" ? await callOpenAI(prompt) : await callAnthropic(prompt);

    let validation = null;

    if (result.changed && result.yaml) {
      const parsed = parseVibeYaml(result.yaml);
      const issues = [
        ...(parsed.rawIssues ?? []),
        ...(parsed.doc ? validateVibe(parsed.doc) : []),
      ];

      validation = {
        valid: !parsed.error && issues.filter((issue) => issue.severity === "error").length === 0,
        parseError: parsed.error,
        issueCount: issues.length,
        issues,
      };
    }

    return NextResponse.json({
      ...result,
      validation,
      provider,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "AI request failed.",
      },
      { status: 500 }
    );
  }
}