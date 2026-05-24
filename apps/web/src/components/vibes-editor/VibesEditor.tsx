"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  CheckCircle2,
  Clipboard,
  Download,
  FileCode2,
  Loader2,
  Maximize2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  RefreshCcw,
  Save,
  Sparkles,
} from "lucide-react";
import { parseVibeYaml, stringifyVibeYaml } from "@/lib/vibes/parse";
import { validateVibe } from "@/lib/vibes/validate";
import { buildVibeGraph } from "@/lib/vibes/graph";
import { VibeNode } from "./VibeNode";

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

  const [leftWidth, setLeftWidth] = useState(360);
  const [rightWidth, setRightWidth] = useState(520);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  const dragState = useRef<null | "left" | "right">(null);

  const parsed = useMemo(() => parseVibeYaml(yaml), [yaml]);
  const issues = useMemo(
  () => [...(parsed.rawIssues ?? []), ...(parsed.doc ? validateVibe(parsed.doc) : [])],
  [parsed.doc, parsed.rawIssues]
);
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
    function onMouseMove(event: MouseEvent) {
      if (!dragState.current) return;

      if (dragState.current === "left") {
        const next = Math.min(Math.max(event.clientX, 280), 520);
        setLeftWidth(next);
      }

      if (dragState.current === "right") {
        const next = Math.min(Math.max(window.innerWidth - event.clientX, 420), 760);
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

  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
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

  async function saveSession() {
    if (!sessionId) {
      setStatusMessage("This demo page is not a saved session. Open a /editor/session link to save.");
      setSaveState("error");
      return;
    }

    setSaveState("saving");
    setStatusMessage("Saving session...");

    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: parsed.doc?.workflow.name ?? sessionTitle ?? "StudioX Vibe",
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

  function updateSelectedStepYaml(value: string | undefined) {
    if (!parsed.doc || !selectedStep || !value) return;

    try {
      const nextStep = YAML.parse(value);

      if (!nextStep || typeof nextStep.id !== "string" || typeof nextStep.function !== "string") {
        setStatusMessage("Selected step must include string id and function fields.");
        setSaveState("error");
        return;
      }

      const nextDoc = structuredClone(parsed.doc);
      const index = nextDoc.workflow.steps.findIndex((step) => step.id === selectedStep.id);

      if (index === -1) return;

      nextDoc.workflow.steps[index] = nextStep;
      setYamlDirty(stringifyVibeYaml(nextDoc));
      setSelectedStepId(nextStep.id);
      setSaveState("idle");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Invalid step YAML.");
      setSaveState("error");
    }
  }

  return (
    <div
      className="grid h-screen overflow-hidden bg-slate-950 text-white"
      style={{ gridTemplateColumns }}
    >
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

            <div className="mt-3 max-h-[40vh] space-y-2 overflow-auto pr-1">
              {parsed.error && (
                <IssueCard severity="error" message={parsed.error} onClick={() => undefined} />
              )}

              {!parsed.error && issues.length === 0 && (
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-100">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} />
                    No validation issues.
                  </div>
                </div>
              )}

              {issues.map((issue, i) => (
                <IssueCard
                  key={`${issue.stepId ?? "global"}-${i}`}
                  severity={issue.severity}
                  message={issue.message}
                  stepId={issue.stepId}
                  onClick={() => focusStep(issue.stepId)}
                />
              ))}
            </div>
          </div>

          <div className="mt-auto rounded-3xl border border-white/10 bg-white/[0.05] p-4 text-xs text-slate-400">
            <div className="font-semibold text-slate-200">Demo hint</div>
            <div className="mt-2 leading-5">
              Break a branch target or set{" "}
              <span className="font-mono text-slate-200">temperature: 20</span> to show live
              validation.
            </div>
          </div>
        </div>
      </aside>

      <main className="relative min-w-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(14,165,233,0.16),transparent_25%),radial-gradient(circle_at_70%_80%,rgba(168,85,247,0.13),transparent_30%)]" />

        <button
          onMouseDown={() => beginDrag("left")}
          className={`absolute bottom-0 top-0 z-30 w-2 cursor-col-resize bg-transparent transition hover:bg-cyan-300/30 ${
            leftOpen ? "left-0" : "left-0"
          }`}
          aria-label="Resize left panel"
        />

        <button
          onMouseDown={() => beginDrag("right")}
          className={`absolute bottom-0 top-0 z-30 w-2 cursor-col-resize bg-transparent transition hover:bg-cyan-300/30 ${
            rightOpen ? "right-0" : "right-0"
          }`}
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
              <ToolbarButton onClick={() => setLeftOpen((value) => !value)}>
                {leftOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
                Left
              </ToolbarButton>

              <ToolbarButton onClick={() => setRightOpen((value) => !value)}>
                {rightOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
                Right
              </ToolbarButton>

              <ToolbarButton onClick={() => flowInstance?.fitView({ duration: 450 })}>
                <Maximize2 size={15} />
                Fit
              </ToolbarButton>

              <ToolbarButton onClick={() => setYamlDirty(initialYaml)}>
                <RefreshCcw size={15} />
                Reset
              </ToolbarButton>

              <ToolbarButton onClick={copyYaml}>
                <Clipboard size={15} />
                Copy
              </ToolbarButton>

              <ToolbarButton onClick={downloadYaml}>
                <Download size={15} />
                Download
              </ToolbarButton>

              <button
                onClick={saveSession}
                disabled={saveState === "saving" || !sessionId || !dirty}
                className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 shadow-xl transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saveState === "saving" ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Save size={15} />
                )}
                Save
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
          onNodeClick={(_, node: any) => setSelectedStepId(node.id)}
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
      </main>

      <aside
        className={`grid grid-rows-[340px_1fr] overflow-hidden border-l border-white/10 bg-slate-950 transition-opacity ${
          rightOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <section className="border-b border-white/10 bg-slate-950 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-black">Inspector</div>
              <div className="mt-1 text-xs text-slate-500">
                Edit the selected step or inspect workflow metadata.
              </div>
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
              Select a node to edit that step directly. For full workflow edits, use the YAML source
              panel below.
            </div>
          ) : (
            <div className="mt-4 grid h-[250px] grid-rows-[auto_1fr] overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/70">
              <div className="border-b border-slate-800 px-4 py-3">
                <div className="truncate font-mono text-sm font-semibold text-slate-100">
                  {selectedStep.id}
                </div>
                <div className="mt-1 truncate font-mono text-xs text-slate-500">
                  function: {selectedStep.function}
                </div>
              </div>

              <Editor
                height="100%"
                language="yaml"
                theme="vs-dark"
                value={selectedStepYaml}
                onChange={updateSelectedStepYaml}
                options={{
                  minimap: { enabled: false },
                  fontSize: 12,
                  wordWrap: "on",
                  lineNumbers: "off",
                  folding: false,
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                }}
              />
            </div>
          )}
        </section>

        <section className="grid grid-rows-[auto_1fr] overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <div className="text-sm font-black">YAML Source</div>
              <div className="mt-1 text-xs text-slate-500">
                Source of truth. Edits update the graph live.
              </div>
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

function ToolbarButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
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
  onClick,
}: {
  severity: string;
  message: string;
  stepId?: string;
  onClick: () => void;
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
        {stepId && <span className="ml-auto max-w-24 truncate font-mono normal-case">{stepId}</span>}
      </div>
      <div className="leading-5 opacity-90">{message}</div>
    </button>
  );
}