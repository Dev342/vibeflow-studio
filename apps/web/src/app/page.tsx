import Link from "next/link";
import { ArrowRight, Bot, Braces, GitBranch, ShieldCheck, Sparkles } from "lucide-react";

const features = [
  {
    icon: GitBranch,
    title: "Visual control flow",
    body: "Turn StudioX Vibe YAML into a readable graph with branches, prompts, API calls, and responses.",
  },
  {
    icon: ShieldCheck,
    title: "Validation built in",
    body: "Catch broken branches, invalid operators, risky actions, and malformed workflow structure before demo time.",
  },
  {
    icon: Braces,
    title: "YAML-first editing",
    body: "Keep source YAML visible while the graph and inspector update live.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.28),transparent_32%),radial-gradient(circle_at_70%_20%,rgba(168,85,247,0.18),transparent_28%),radial-gradient(circle_at_50%_90%,rgba(16,185,129,0.12),transparent_30%)]" />

      <section className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-2 shadow-xl backdrop-blur">
              <Bot size={22} />
            </div>
            <div>
              <div className="font-semibold">VibeFlow Studio</div>
              <div className="text-xs text-slate-400">Visual editor for StudioX Vibes</div>
            </div>
          </div>

          <Link
            href="/editor"
            className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-white shadow-lg backdrop-blur transition hover:bg-white/15"
          >
            Open editor
          </Link>
        </nav>

        <div className="grid flex-1 items-center gap-10 py-16 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">
              <Sparkles size={14} />
              StudioX → MCP → Vercel → Supabase → Visual Editor
            </div>

            <h1 className="max-w-3xl text-5xl font-black tracking-tight text-white md:text-7xl">
              Build, inspect, and demo Vibes visually.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              VibeFlow Studio transforms StudioX workflow YAML into a polished graph editor with
              live validation, persistent sessions, risk labels, and MCP-powered imports.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/editor"
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 shadow-2xl transition hover:scale-[1.02]"
              >
                Launch demo editor
                <ArrowRight size={16} />
              </Link>

              <a
                href="https://vibeflow-studio-two.vercel.app/api/mcp"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
              >
                MCP endpoint
              </a>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-4 shadow-2xl backdrop-blur">
            <div className="rounded-[1.5rem] border border-slate-700/70 bg-slate-950 p-5">
              <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <div className="text-sm font-semibold">Live workflow session</div>
                  <div className="text-xs text-slate-500">open_vibe_in_editor_mcp</div>
                </div>
                <div className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">
                  valid
                </div>
              </div>

              <div className="space-y-3">
                {["extract_yaml", "create_session", "validate", "response"].map((item, index) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-3"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800 text-xs text-slate-300">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-mono text-sm text-slate-200">{item}</div>
                      <div className="text-xs text-slate-500">
                        {index === 1 ? "MCP tools/call → create_editor_session" : "StudioX step"}
                      </div>
                    </div>
                    <div className="h-2 w-2 rounded-full bg-cyan-300" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 pb-8 md:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <div
                key={feature.title}
                className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-xl backdrop-blur"
              >
                <div className="mb-4 inline-flex rounded-2xl bg-white/10 p-3">
                  <Icon size={20} />
                </div>
                <h2 className="font-semibold">{feature.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">{feature.body}</p>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}