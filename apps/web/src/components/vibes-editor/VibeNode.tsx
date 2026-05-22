"use client";

import { Handle, Position } from "@xyflow/react";
import { AlertTriangle, Bot, Code2, GitBranch, Globe2, MessageSquare, Sparkles } from "lucide-react";

const icons: Record<string, any> = {
  ai: Sparkles,
  condition: GitBranch,
  prompt: MessageSquare,
  api: Globe2,
  response: Bot,
  default: Code2,
};

const riskClass: Record<string, string> = {
  read: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  write: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  danger: "bg-red-500/15 text-red-300 border-red-500/30",
  unknown: "bg-slate-500/15 text-slate-300 border-slate-500/30",
};

export function VibeNode({ data, type }: any) {
  const Icon = icons[type] ?? icons.default;

  return (
    <div className="w-72 rounded-2xl border border-slate-700 bg-slate-950/95 p-4 text-white shadow-xl">
      <Handle type="target" position={Position.Top} />

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-slate-800 p-2">
            <Icon size={18} />
          </div>
          <div>
            <div className="max-w-44 truncate text-sm font-semibold">{data.label}</div>
            <div className="text-xs text-slate-400">{data.functionName}</div>
          </div>
        </div>

        <span className={`rounded-full border px-2 py-1 text-[10px] ${riskClass[data.risk]}`}>
          {data.risk}
        </span>
      </div>

      <div className="mt-3 line-clamp-2 text-xs text-slate-300">{data.summary}</div>

      {data.issues?.length > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-200">
          <AlertTriangle size={14} />
          {data.issues.length} issue{data.issues.length > 1 ? "s" : ""}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}