"use client";

import { Handle, Position } from "@xyflow/react";
import {
  AlertTriangle,
  Bot,
  Code2,
  GitBranch,
  Globe2,
  MessageSquare,
  Repeat,
  Sparkles,
  Workflow,
} from "lucide-react";

const icons: Record<string, any> = {
  ai: Sparkles,
  condition: GitBranch,
  prompt: MessageSquare,
  api: Globe2,
  response: Bot,
  workflow: Workflow,
  loop: Repeat,
  default: Code2,
};

const accentClass: Record<string, string> = {
  ai: "from-fuchsia-500/25 to-indigo-500/10 border-fuchsia-400/30",
  condition: "from-amber-500/25 to-orange-500/10 border-amber-400/30",
  prompt: "from-sky-500/25 to-cyan-500/10 border-sky-400/30",
  api: "from-emerald-500/25 to-teal-500/10 border-emerald-400/30",
  response: "from-violet-500/25 to-purple-500/10 border-violet-400/30",
  workflow: "from-blue-500/25 to-indigo-500/10 border-blue-400/30",
  loop: "from-pink-500/25 to-rose-500/10 border-pink-400/30",
  default: "from-slate-500/20 to-slate-800/20 border-slate-600",
};

const riskClass: Record<string, string> = {
  read: "bg-emerald-400/10 text-emerald-200 border-emerald-400/25",
  write: "bg-amber-400/10 text-amber-200 border-amber-400/25",
  danger: "bg-red-400/10 text-red-200 border-red-400/25",
  unknown: "bg-slate-400/10 text-slate-200 border-slate-400/20",
};

export function VibeNode({ data, type, selected }: any) {
  const Icon = icons[type] ?? icons.default;
  const accent = accentClass[type] ?? accentClass.default;

  return (
    <div
      className={`group w-80 rounded-3xl border bg-gradient-to-br ${accent} p-[1px] shadow-2xl transition ${
        selected ? "scale-[1.02] ring-2 ring-cyan-300/70" : "hover:-translate-y-0.5"
      }`}
    >
      <div className="rounded-3xl border border-white/5 bg-slate-950/95 p-4 text-white backdrop-blur-xl">
        <Handle
          type="target"
          position={Position.Top}
          className="!h-3 !w-3 !border-2 !border-slate-950 !bg-cyan-300"
        />

        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-2.5 shadow-lg">
              <Icon size={18} />
            </div>

            <div className="min-w-0">
              <div className="truncate text-sm font-bold tracking-tight">{data.label}</div>
              <div className="mt-0.5 truncate font-mono text-[11px] text-slate-400">
                {data.functionName}
              </div>
            </div>
          </div>

          <span className={`rounded-full border px-2.5 py-1 text-[10px] ${riskClass[data.risk]}`}>
            {data.risk}
          </span>
        </div>

        <div className="mt-4 min-h-10 rounded-2xl border border-slate-800 bg-slate-900/70 p-3 text-xs leading-5 text-slate-300">
          {data.summary}
        </div>

        {data.issues?.length > 0 ? (
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-red-400/25 bg-red-400/10 px-3 py-2 text-xs text-red-200">
            <AlertTriangle size={14} />
            {data.issues.length} issue{data.issues.length > 1 ? "s" : ""}
          </div>
        ) : (
          <div className="mt-3 rounded-2xl border border-emerald-400/15 bg-emerald-400/5 px-3 py-2 text-xs text-emerald-200">
            No local issues
          </div>
        )}

        <Handle
          type="source"
          position={Position.Bottom}
          className="!h-3 !w-3 !border-2 !border-slate-950 !bg-cyan-300"
        />
      </div>
    </div>
  );
}