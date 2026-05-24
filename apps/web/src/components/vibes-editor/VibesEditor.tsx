"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import Editor from "@monaco-editor/react";
import YAML from "yaml";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clipboard,
  Download,
  ExternalLink,
  FileCode2,
  Loader2,
  Maximize2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  RefreshCcw,
  Save,
  Send,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { parseVibeYaml } from "@/lib/vibes/parse";
import { validateVibe } from "@/lib/vibes/validate";
import { buildVibeGraph } from "@/lib/vibes/graph";
import { VibeNode } from "./VibeNode";
import type { VibeIssue } from "@/lib/vibes/types";

const nodeTypes = {
  ai: VibeNode,
  condition: VibeNode,
  prompt: VibeNode,
  api: VibeNode,
  response: VibeNode,
  workflow: VibeNode,
  loop: VibeNode,
  default: VibeNode,
};

type Props = {
  initialYaml: string;
  sessionId?: string;
  sessionTitle?: string;
};

type SaveState = "idle" | "saving" | "saved" | "error";

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  proposedYaml?: string | null;
  validation?: {
    valid: boolean;
    issueCount: number;
    parseError: string | null;
  } | null;
};

const riskColors: Record<string, string> = {
  read: "#34d399",
  write: "#f59e0b",
  danger: "#f87171",
  unknown: "#94a3b8",
};

export function VibesEditor({ initialYaml, sessionId, sessionTitle }: Props) {
  return (
    <ReactFlowProvider>
      <VibesEditorInner
        initialYaml={initialYaml}
        sessionId={sessionId}
        sessionTitle={sessionTitle}
      />
    </ReactFlowProvider>
  );
}

function VibesEditorInner({ initialYaml, sessionId, sessionTitle }: Props) {
  const [yaml, setYaml] = useState(initialYaml);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  const [flowInstance, setFlowInstance] = useState<any>(null);

  const [leftWidth, setLeftWidth] = useState(330);
  const [rightWidth, setRightWidth] = useState(500);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  const [copilotOpen, setCopilotOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text:
        "I can explain this StudioX Vibe, fix validation issues, add steps, rewrite branches, or improve the workflow. I remember the recent messages in this panel during this session.",
    },
  ]);

  const dragState = useRef<null | "left" | "right">(null);
  const yamlEditorRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const parsed = useMemo(() => parseVibeYaml(yaml), [yaml]);

  const issues = useMemo(
    () => [...(parsed.rawIssues ?? []), ...(parsed.doc ? validateVibe(parsed.doc) : [])],
    [parsed.doc, parsed.rawIssues]
  );

  const displayedIssues = useMemo(() => {
    if (issues.length > 0) return issues;

    if (parsed.error) {
      const fallbackIssue: VibeIssue = {
        severity: "error",
        message: parsed.error,
      };

      return [fallbackIssue];
    }

    return [];
  }, [issues, parsed.error]);

  const graph = useMemo(
    () => (parsed.doc ? buildVibeGraph(parsed.doc, issues) : { nodes: [], edges: [] }),
    [parsed.doc, issues]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState([] as any[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as any[]);

  useEffect(() => {
    setNodes(graph.nodes as any[]);
    setEdges(graph.edges as any[]);
  }, [graph, setEdges, setNodes]);

  useEffect(() => {
    if (!copilotOpen) return;
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatMessages, aiLoading, copilotOpen]);

  useEffect(() => {
    function onMouseMove(event: MouseEvent) {
      if (!dragState.current) return;

      if (dragState.current === "left") {
        const next = Math.min(Math.max(event.clientX, 260), 480);
        setLeftWidth(next);
      }

      if (dragState.current === "right") {
        const next = Math.min(Math.max(window.innerWidth - event.clientX, 410), 720);
        setRightWidth(next);
      }
    }

    function onMouseUp() {
      dragState.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const selectedStep = parsed.doc?.workflow.steps.find((s) => s.id === selectedStepId);

  const selectedStepYaml = useMemo(() => {
    if (!selectedStep) return "";
    return YAML.stringify(selectedStep, { lineWidth: 110 });
  }, [selectedStep]);

  const selectedInput = selectedStep?.input ?? {};
  const mcpServerUrl =
    typeof selectedInput.server_url === "string" && selectedInput.server_url.startsWith("http")
      ? selectedInput.server_url
      : null;
  const mcpToolName =
    typeof selectedInput.tool_name === "string" ? selectedInput.tool_name : null;

  const errorCount = displayedIssues.filter((issue) => issue.severity === "error").length;
  const warningCount = displayedIssues.filter((issue) => issue.severity === "warning").length;
  const workflowName = parsed.doc?.workflow.name ?? sessionTitle ?? "Invalid YAML";
  const stepCount = parsed.doc?.workflow.steps.length ?? 0;

  const gridTemplateColumns = `${leftOpen ? `${leftWidth}px` : "0px"} 1fr ${
    rightOpen ? `${rightWidth}px` : "0px"
  }`;

  function beginDrag(which: "left" | "right") {
    dragState.current = which;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  function setYamlDirty(nextYaml: string) {
    setYaml(nextYaml);
    setDirty(true);
    if (saveState === "saved") setSaveState("idle");
  }

  function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function findStepLineNumber(stepId?: string) {
    if (!stepId) return null;

    const lines = yaml.split(/\r?\n/);
    const pattern = new RegExp(`^\\s*-?\\s*id:\\s*["']?${escapeRegExp(stepId)}["']?\\s*$`);
    const index = lines.findIndex((line) => pattern.test(line));

    return index >= 0 ? index + 1 : null;
  }

  function jumpToYamlLine(lineNumber?: number | null, column = 1) {
    if (!lineNumber || !yamlEditorRef.current) return;

    if (!rightOpen) setRightOpen(true);

    window.setTimeout(() => {
      yamlEditorRef.current?.revealLineInCenter(lineNumber);
      yamlEditorRef.current?.setPosition({
        lineNumber,
        column,
      });
      yamlEditorRef.current?.focus();
    }, 120);
  }

  function focusStep(stepId?: string) {
    if (!stepId) return;
    setSelectedStepId(stepId);

    const node = graph.nodes.find((item) => item.id === stepId);

    if (node && flowInstance) {
      flowInstance.setCenter(node.position.x + 160, node.position.y + 80, {
        zoom: 1.05,
        duration: 450,
      });
    }
  }

  function jumpToStep(stepId?: string) {
    if (!stepId) return;
    focusStep(stepId);
    jumpToYamlLine(findStepLineNumber(stepId), 1);
  }

  function jumpToIssue(issue: {
    lineNumber?: number;
    column?: number;
    stepId?: string;
  }) {
    if (issue.lineNumber) {
      jumpToYamlLine(issue.lineNumber, issue.column ?? 1);
      return;
    }

    if (issue.stepId) {
      jumpToStep(issue.stepId);
    }
  }

  async function saveSession() {
    setSaveState("saving");
    setStatusMessage(sessionId ? "Saving session..." : "Creating saved session...");

    try {
      const title = parsed.doc?.workflow.name ?? sessionTitle ?? "StudioX Vibe";

      const res = await fetch(sessionId ? `/api/sessions/${sessionId}` : "/api/sessions", {
        method: sessionId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          yaml,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Save failed.");
      }

      setDirty(false);
      setSaveState("saved");
      setStatusMessage(
        data.valid
          ? "Saved. Workflow is valid."
          : `Saved with ${data.issueCount ?? 0} validation issue(s).`
      );

      if (!sessionId && data.url) {
        window.setTimeout(() => {
          window.location.href = data.url;
        }, 700);
        return;
      }

      window.setTimeout(() => {
        setSaveState("idle");
      }, 1800);
    } catch (error) {
      setSaveState("error");
      setStatusMessage(error instanceof Error ? error.message : "Save failed.");
    }
  }

  async function copyYaml() {
    await navigator.clipboard.writeText(yaml);
    setStatusMessage("YAML copied to clipboard.");
    setSaveState("saved");

    window.setTimeout(() => {
      setSaveState("idle");
    }, 1200);
  }

  function downloadYaml() {
    const filename = `${parsed.doc?.workflow.id ?? "vibe"}.yaml`;
    const blob = new Blob([yaml], { type: "text/yaml;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = href;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(href);
    setStatusMessage(`Downloaded ${filename}.`);
  }

  async function askCopilot(promptOverride?: string) {
    const prompt = (promptOverride ?? aiPrompt).trim();

    if (!prompt || aiLoading) return;

    setCopilotOpen(true);
    setChatMessages((prev) => [...prev, { role: "user", text: prompt }]);
    setAiPrompt("");
    setAiLoading(true);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          yaml,
          messages: chatMessages.slice(-8),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "AI request failed.");
      }

      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.reply ?? "Done.",
          proposedYaml: data.changed ? data.yaml : null,
          validation: data.validation
            ? {
                valid: data.validation.valid,
                issueCount: data.validation.issueCount,
                parseError: data.validation.parseError,
              }
            : null,
        },
      ]);
    } catch (error) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: error instanceof Error ? error.message : "AI request failed.",
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  }

  function fixIssueWithAi(issue: VibeIssue) {
    jumpToIssue(issue);

    const location = issue.lineNumber
      ? `line ${issue.lineNumber}`
      : issue.stepId
        ? `step "${issue.stepId}"`
        : "the workflow";

    askCopilot(
      `Fix this StudioX Vibe validation issue at ${location}: ${issue.message}

Return the full updated YAML. Keep the workflow behavior as close as possible to the original.`
    );
  }

  function fixAllIssuesWithAi() {
    const issueSummary = displayedIssues
      .map((issue, index) => {
        const location = issue.lineNumber
          ? `line ${issue.lineNumber}`
          : issue.stepId
            ? `step "${issue.stepId}"`
            : "workflow";

        return `${index + 1}. ${issue.severity.toUpperCase()} at ${location}: ${issue.message}`;
      })
      .join("\n");

    askCopilot(
      `Fix all StudioX Vibe validation issues below.

Issues:
${issueSummary || "No validation issues were detected."}

Return the full updated YAML. Keep the workflow behavior as close as possible to the original.`
    );
  }

  function getAiRecommendations() {
    askCopilot(
      `Review this StudioX Vibe YAML and give concise recommendations for improving it.

Focus on:
- StudioX correctness
- safer branching
- better prompts
- missing confirmations before write or danger actions
- useful MCP usage if relevant
- better validation or error handling

Do not change the YAML unless I explicitly ask.`
    );
  }

  function applyAiYaml(nextYaml: string) {
    setYamlDirty(nextYaml);
    setStatusMessage("AI changes applied. Review the graph and click Save.");
    setCopilotOpen(false);
  }

  return (
    <div
      className="grid h-screen overflow-hidden bg-slate-950 text-white"
      style={{ gridTemplateColumns }}
    >
      <style>{`
        .react-flow__controls {
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35) !important;
          overflow: hidden !important;
        }

        .react-flow__controls-button {
          background: rgba(15, 23, 42, 0.92) !important;
          border-bottom: 1px solid rgba(148, 163, 184, 0.22) !important;
          color: #e2e8f0 !important;
          fill: #e2e8f0 !important;
        }

        .react-flow__controls-button:hover {
          background: rgba(30, 41, 59, 0.98) !important;
        }

        .react-flow__controls-button svg {
          fill: #e2e8f0 !important;
          color: #e2e8f0 !important;
        }
      `}</style>

      <aside
        className={`relative overflow-hidden border-r border-white/10 bg-slate-950 transition-opacity ${
          leftOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12),transparent_35%)]" />

        <div className="relative flex h-full flex-col gap-4 overflow-y-auto p-4">
          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4 shadow-2xl backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-2">
                <Sparkles size={20} className="text-cyan-200" />
              </div>

              <div>
                <div className="text-lg font-black tracking-tight">VibeFlow Studio</div>
                <div className="text-xs text-slate-400">StudioX visual workflow editor</div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
              <div className="text-xs uppercase tracking-wider text-slate-500">Workflow</div>
              <div className="mt-1 truncate text-sm font-semibold">{workflowName}</div>
              <div className="mt-3 flex gap-2">
                <Metric label="steps" value={stepCount} />
                <Metric label="errors" value={errorCount} tone={errorCount ? "danger" : "ok"} />
                <Metric label="warn" value={warningCount} tone={warningCount ? "warn" : "ok"} />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-4 shadow-xl backdrop-blur">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold">Validation</div>
              <div
                className={`rounded-full px-2.5 py-1 text-xs ${
                  errorCount
                    ? "bg-red-400/10 text-red-200"
                    : warningCount
                      ? "bg-amber-400/10 text-amber-200"
                      : "bg-emerald-400/10 text-emerald-200"
                }`}
              >
                {errorCount ? "needs fix" : warningCount ? "review" : "clean"}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={fixAllIssuesWithAi}
                disabled={displayedIssues.length === 0 || aiLoading}
                className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-bold text-cyan-100 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Fix all with AI
              </button>

              <button
                onClick={getAiRecommendations}
                disabled={aiLoading}
                className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-bold text-slate-100 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                AI recommendations
              </button>
            </div>

            <div className="mt-3 max-h-[39vh] space-y-2 overflow-auto pr-1">
              {displayedIssues.length === 0 && (
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-100">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} />
                    No validation issues.
                  </div>
                </div>
              )}

              {displayedIssues.map((issue, i) => (
                <IssueCard
                  key={`${issue.stepId ?? "global"}-${issue.lineNumber ?? "no-line"}-${i}`}
                  severity={issue.severity}
                  message={issue.message}
                  stepId={issue.stepId}
                  lineNumber={issue.lineNumber}
                  onClick={() => jumpToIssue(issue)}
                  onAiFix={() => fixIssueWithAi(issue)}
                />
              ))}
            </div>
          </div>

          <div className="mt-auto rounded-3xl border border-white/10 bg-white/[0.05] p-4 text-xs text-slate-400">
            <div className="font-semibold text-slate-200">StudioX-specific checks</div>
            <div className="mt-2 leading-5">
              Validates StudioX functions, branches, variable refs, promptUser, apiRequest, and MCP
              tool calls — not just YAML syntax.
            </div>
          </div>
        </div>
      </aside>

      <main className="relative min-w-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(14,165,233,0.16),transparent_25%),radial-gradient(circle_at_70%_80%,rgba(168,85,247,0.13),transparent_30%)]" />

        <button
          onMouseDown={() => beginDrag("left")}
          className="absolute bottom-0 left-0 top-0 z-30 w-2 cursor-col-resize bg-transparent transition hover:bg-cyan-300/30"
          aria-label="Resize left panel"
        />

        <button
          onMouseDown={() => beginDrag("right")}
          className="absolute bottom-0 right-0 top-0 z-30 w-2 cursor-col-resize bg-transparent transition hover:bg-cyan-300/30"
          aria-label="Resize right panel"
        />

        <div className="absolute left-4 right-4 top-4 z-20 rounded-3xl border border-white/10 bg-slate-950/80 p-3 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <FileCode2 size={16} />
                <span className="truncate">
                  {sessionId ? `Session ${sessionId}` : "Local demo session"}
                </span>
              </div>
              <div className="mt-0.5 text-xs text-slate-400">
                {dirty ? "Unsaved changes" : "All changes saved"} · {stepCount} visual node
                {stepCount === 1 ? "" : "s"}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                onClick={() => setCopilotOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-3 py-2 text-sm font-bold text-slate-950 shadow-lg transition hover:scale-[1.02]"
              >
                <Bot size={15} />
                AI
              </button>

              <ToolbarButton onClick={() => setLeftOpen((value) => !value)}>
                {leftOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
              </ToolbarButton>

              <ToolbarButton onClick={() => setRightOpen((value) => !value)}>
                {rightOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
              </ToolbarButton>

              <ToolbarButton onClick={() => flowInstance?.fitView({ duration: 450 })}>
                <Maximize2 size={15} />
              </ToolbarButton>

              <ToolbarButton onClick={() => setYamlDirty(initialYaml)}>
                <RefreshCcw size={15} />
              </ToolbarButton>

              <ToolbarButton onClick={copyYaml}>
                <Clipboard size={15} />
              </ToolbarButton>

              <ToolbarButton onClick={downloadYaml}>
                <Download size={15} />
              </ToolbarButton>

              <button
                onClick={saveSession}
                disabled={saveState === "saving" || !dirty}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-bold text-slate-950 shadow-xl transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saveState === "saving" ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Save size={15} />
                )}
                {sessionId ? "Save" : "Save session"}
              </button>
            </div>
          </div>
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          onInit={setFlowInstance}
          onNodeClick={(_, node: any) => jumpToStep(node.id)}
          proOptions={{ hideAttribution: true }}
          className="relative z-0"
        >
          <Background color="#334155" gap={24} size={1} />
          <Controls className="!bottom-5 !left-5 !rounded-2xl !border !border-white/10 !bg-slate-950/80 !p-1 !shadow-xl !backdrop-blur" />
          <MiniMap
            className="!bottom-5 !right-5 !rounded-3xl !border !border-white/10 !bg-slate-950/80 !shadow-2xl"
            maskColor="rgba(2, 6, 23, 0.68)"
            nodeColor={(node: any) => riskColors[node.data?.risk ?? "unknown"]}
            nodeStrokeWidth={3}
            pannable
            zoomable
          />
        </ReactFlow>

        {copilotOpen && (
          <div className="absolute bottom-5 right-5 top-24 z-40 flex w-[420px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-950/95 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/10 p-4">
              <div className="flex items-center gap-2">
                <div className="rounded-2xl bg-cyan-300/10 p-2 text-cyan-200">
                  <Wand2 size={17} />
                </div>
                <div>
                  <div className="text-sm font-black">VibeFlow Copilot</div>
                  <div className="text-xs text-slate-500">StudioX YAML assistant</div>
                </div>
              </div>

              <button
                onClick={() => setCopilotOpen(false)}
                className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 hover:bg-white/10"
              >
                <X size={15} />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-auto p-4">
              {chatMessages.map((message, index) => (
                <div
                  key={index}
                  className={`rounded-2xl border p-3 text-sm leading-6 ${
                    message.role === "user"
                      ? "ml-8 border-cyan-300/20 bg-cyan-300/10 text-cyan-50"
                      : "mr-8 border-white/10 bg-white/[0.06] text-slate-200"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{message.text}</div>

                  {message.validation && (
                    <div
                      className={`mt-3 rounded-xl border px-3 py-2 text-xs ${
                        message.validation.valid
                          ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                          : "border-amber-400/20 bg-amber-400/10 text-amber-100"
                      }`}
                    >
                      Proposed YAML:{" "}
                      {message.validation.valid
                        ? "valid"
                        : `${message.validation.issueCount} issue(s)`}
                    </div>
                  )}

                  {message.proposedYaml && (
                    <button
                      onClick={() => applyAiYaml(message.proposedYaml!)}
                      className="mt-3 inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-3 py-2 text-xs font-bold text-slate-950"
                    >
                      <Wand2 size={13} />
                      Apply changes
                    </button>
                  )}
                </div>
              ))}

              {aiLoading && (
                <div className="mr-8 rounded-2xl border border-white/10 bg-white/[0.06] p-3 text-sm text-slate-300">
                  <div className="flex items-center gap-2">
                    <Loader2 size={15} className="animate-spin" />
                    Thinking...
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            <div className="border-t border-white/10 p-4">
              <textarea
                value={aiPrompt}
                onChange={(event) => setAiPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                    event.preventDefault();
                    askCopilot();
                  }
                }}
                placeholder="Ask: explain this, fix validation errors, add manager approval..."
                className="h-24 w-full resize-none rounded-2xl border border-white/10 bg-slate-900 p-3 text-sm text-white outline-none placeholder:text-slate-500"
              />

              <button
                onClick={() => askCopilot()}
                disabled={aiLoading || !aiPrompt.trim()}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {aiLoading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                Send
              </button>
            </div>
          </div>
        )}
      </main>

      <aside
        className={`grid grid-rows-[300px_1fr] overflow-hidden border-l border-white/10 bg-slate-950 transition-opacity ${
          rightOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <section className="overflow-hidden border-b border-white/10 bg-slate-950 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-black">Inspector</div>
              <div className="mt-1 text-xs text-slate-500">Selected node details.</div>
            </div>

            <div
              className={`rounded-full px-3 py-1 text-xs ${
                selectedStep ? "bg-cyan-300/10 text-cyan-200" : "bg-slate-800 text-slate-300"
              }`}
            >
              {selectedStep ? selectedStep.function : "No node"}
            </div>
          </div>

          {!selectedStep ? (
            <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-900/70 p-5 text-sm leading-6 text-slate-400">
              Click a node to inspect it and jump to its YAML.
            </div>
          ) : (
            <div className="mt-4 h-[215px] overflow-auto rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="mb-3 flex flex-wrap gap-2">
                <button
                  onClick={() => jumpToStep(selectedStep.id)}
                  className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100"
                >
                  Jump to YAML
                </button>

                {mcpServerUrl && (
                  <a
                    href={mcpServerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-white/15"
                  >
                    MCP server
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>

              <div className="font-mono text-sm font-semibold text-slate-100">{selectedStep.id}</div>
              <div className="mt-1 font-mono text-xs text-slate-500">
                function: {selectedStep.function}
              </div>

              {mcpToolName && (
                <div className="mt-3 rounded-2xl border border-cyan-300/15 bg-cyan-300/10 px-3 py-2 text-xs text-cyan-100">
                  MCP tool: <span className="font-mono">{mcpToolName}</span>
                </div>
              )}

              <pre className="mt-4 whitespace-pre-wrap rounded-2xl border border-slate-800 bg-slate-950 p-3 text-xs leading-5 text-slate-300">
                {selectedStepYaml}
              </pre>
            </div>
          )}
        </section>

        <section className="grid grid-rows-[auto_1fr] overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <div className="text-sm font-black">YAML Source</div>
              <div className="mt-1 text-xs text-slate-500">Source of truth.</div>
            </div>

            <div
              className={`rounded-full px-3 py-1 text-xs ${
                saveState === "error"
                  ? "bg-red-400/10 text-red-200"
                  : saveState === "saved"
                    ? "bg-emerald-400/10 text-emerald-200"
                    : saveState === "saving"
                      ? "bg-cyan-400/10 text-cyan-200"
                      : "bg-slate-800 text-slate-300"
              }`}
            >
              {saveState === "saving"
                ? "saving"
                : saveState === "saved"
                  ? "saved"
                  : dirty
                    ? "dirty"
                    : "ready"}
            </div>
          </div>

          <div className="relative">
            <Editor
              height="100%"
              language="yaml"
              theme="vs-dark"
              value={yaml}
              onMount={(editor) => {
                yamlEditorRef.current = editor;
              }}
              onChange={(value) => setYamlDirty(value ?? "")}
              options={{
                minimap: { enabled: false },
                fontSize: 12,
                wordWrap: "on",
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />

            {statusMessage && (
              <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-xs text-slate-300 shadow-2xl backdrop-blur">
                {statusMessage}
              </div>
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "ok" | "warn" | "danger";
}) {
  const toneClass =
    tone === "danger"
      ? "bg-red-400/10 text-red-200"
      : tone === "warn"
        ? "bg-amber-400/10 text-amber-200"
        : tone === "ok"
          ? "bg-emerald-400/10 text-emerald-200"
          : "bg-slate-800 text-slate-200";

  return (
    <div className={`rounded-2xl px-3 py-2 ${toneClass}`}>
      <div className="text-sm font-black">{value}</div>
      <div className="text-[10px] uppercase tracking-wider opacity-75">{label}</div>
    </div>
  );
}

function ToolbarButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-slate-100 shadow-lg backdrop-blur transition hover:bg-white/15"
    >
      {children}
    </button>
  );
}

function IssueCard({
  severity,
  message,
  stepId,
  lineNumber,
  onClick,
  onAiFix,
}: {
  severity: string;
  message: string;
  stepId?: string;
  lineNumber?: number;
  onClick: () => void;
  onAiFix?: () => void;
}) {
  const isError = severity === "error";

  return (
    <button
      onClick={onClick}
      className={`w-full rounded-2xl border p-3 text-left text-xs transition hover:scale-[1.01] ${
        isError
          ? "border-red-400/20 bg-red-400/10 text-red-100"
          : "border-amber-400/20 bg-amber-400/10 text-amber-100"
      }`}
    >
      <div className="mb-1 flex items-center gap-2 font-semibold uppercase tracking-wider">
        <AlertTriangle size={13} />
        {severity}
        <span className="ml-auto max-w-32 truncate font-mono normal-case">
          {lineNumber ? `line ${lineNumber}` : stepId}
        </span>
      </div>

      <div className="leading-5 opacity-90">{message}</div>

      {onAiFix && (
        <span
          onClick={(event) => {
            event.stopPropagation();
            onAiFix();
          }}
          className="mt-3 inline-flex items-center gap-1 rounded-xl bg-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-white/15"
        >
          <Wand2 size={12} />
          AI fix
        </span>
      )}
    </button>
  );
}