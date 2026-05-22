"use client";

import { useMemo, useState } from "react";
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
};

export function VibesEditor({ initialYaml }: Props) {
  const [yaml, setYaml] = useState(initialYaml);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  const parsed = useMemo(() => parseVibeYaml(yaml), [yaml]);
  const issues = useMemo(() => (parsed.doc ? validateVibe(parsed.doc) : []), [parsed.doc]);
  const graph = useMemo(
    () => (parsed.doc ? buildVibeGraph(parsed.doc, issues) : { nodes: [], edges: [] }),
    [parsed.doc, issues]
  );

  const [, , onNodesChange] = useNodesState(graph.nodes);
  const [, , onEdgesChange] = useEdgesState(graph.edges);

  const selectedStep = parsed.doc?.workflow.steps.find((s) => s.id === selectedStepId);

  function updateSelectedPrompt(value: string) {
    if (!parsed.doc || !selectedStep) return;

    const nextDoc = structuredClone(parsed.doc);
    const step = nextDoc.workflow.steps.find((s) => s.id === selectedStep.id);
    if (!step) return;

    step.input = step.input ?? {};
    step.input.prompt = value;

    setYaml(stringifyVibeYaml(nextDoc));
  }

  return (
    <div className="grid h-screen grid-cols-[260px_1fr_440px] bg-slate-950 text-white">
      <aside className="border-r border-slate-800 p-4">
        <div className="text-lg font-bold">VibeFlow Studio</div>
        <div className="mt-1 text-xs text-slate-400">Visual editor for StudioX Vibes</div>

        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-3">
          <div className="text-sm font-semibold">Workflow</div>
          <div className="mt-2 text-xs text-slate-400">
            {parsed.doc?.workflow.name ?? "Invalid YAML"}
          </div>
          <div className="mt-3 text-xs text-slate-400">
            {parsed.doc?.workflow.steps.length ?? 0} steps
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900 p-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Validation</div>
            <div className="rounded-full bg-slate-800 px-2 py-1 text-xs">{issues.length}</div>
          </div>

          <div className="mt-3 space-y-2">
            {parsed.error && (
              <div className="rounded-xl bg-red-500/10 p-2 text-xs text-red-200">
                {parsed.error}
              </div>
            )}

            {issues.slice(0, 8).map((issue, i) => (
              <div key={i} className="rounded-xl bg-slate-800 p-2 text-xs">
                <div className={issue.severity === "error" ? "text-red-300" : "text-amber-300"}>
                  {issue.severity.toUpperCase()}
                </div>
                <div className="mt-1 text-slate-300">{issue.message}</div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <main className="relative">
        <ReactFlowProvider>
          <ReactFlow
            nodes={graph.nodes}
            edges={graph.edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            onNodeClick={(_, node) => setSelectedStepId(node.id)}
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </ReactFlowProvider>
      </main>

      <aside className="grid grid-rows-[280px_1fr] border-l border-slate-800">
        <div className="border-b border-slate-800 p-4">
          <div className="text-sm font-bold">Inspector</div>

          {!selectedStep && (
            <div className="mt-4 text-sm text-slate-400">Select a node to edit it.</div>
          )}

          {selectedStep && (
            <div className="mt-4 space-y-3">
              <div>
                <div className="text-xs text-slate-400">Step ID</div>
                <div className="font-mono text-sm">{selectedStep.id}</div>
              </div>

              <div>
                <div className="text-xs text-slate-400">Function</div>
                <div className="font-mono text-sm">{selectedStep.function}</div>
              </div>

              {selectedStep.function === "promptUser" && (
                <div>
                  <div className="text-xs text-slate-400">Prompt</div>
                  <textarea
                    className="mt-2 h-28 w-full rounded-xl border border-slate-700 bg-slate-900 p-2 text-xs outline-none"
                    value={selectedStep.input?.prompt ?? ""}
                    onChange={(e) => updateSelectedPrompt(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <Editor
            height="100%"
            language="yaml"
            theme="vs-dark"
            value={yaml}
            onChange={(value) => setYaml(value ?? "")}
            options={{
              minimap: { enabled: false },
              fontSize: 12,
              wordWrap: "on",
            }}
          />
        </div>
      </aside>
    </div>
  );
}