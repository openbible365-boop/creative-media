"use client";

import { useSession, signIn } from "next-auth/react";
import { useState, useEffect } from "react";
import {
  Mic, Volume2, Plus, FolderOpen,
  ChevronRight, Gauge, HardDrive, FileImage,
} from "lucide-react";
import Image from "next/image";
import { Navbar } from "@/components/layout/navbar";

interface Project {
  id: string;
  name: string;
  description: string | null;
  locale: string;
  updatedAt: string;
  _count: { assets: number };
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newLocale, setNewLocale] = useState("en");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (session) fetchProjects();
  }, [session]);

  async function fetchProjects() {
    const res = await fetch("/api/projects");
    if (res.ok) setProjects(await res.json());
  }

  async function createProject() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          description: newDesc || undefined,
          locale: newLocale,
        }),
      });
      if (res.ok) {
        setNewName("");
        setNewDesc("");
        setShowNewProject(false);
        fetchProjects();
      }
    } finally {
      setCreating(false);
    }
  }

  // ── 未登录 ──
  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen relative flex items-center justify-center overflow-hidden">
        {/* Background video + gradient overlay */}
        <div className="absolute inset-0">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          >
            <source src="/bg.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-br from-white/70 via-white/50 to-[#0A2647]/10" />
        </div>

        {/* Card */}
        <div className="relative z-10 text-center max-w-lg mx-auto px-8 py-14 rounded-2xl bg-white/70 backdrop-blur-xl shadow-xl border border-white/40">
          <Image
            src="/logo.png"
            alt="Creative Media"
            width={80}
            height={80}
            className="mx-auto mb-6 drop-shadow-md"
          />
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3" style={{ color: "#0A2647" }}>
            Creative Media
          </h1>
          <p className="text-base text-gray-500 mb-10 leading-relaxed">
            From inspiration to publication,<br className="hidden sm:inline" /> all in one platform.
          </p>
          <button
            onClick={() => signIn("google")}
            className="inline-flex items-center justify-center gap-3 rounded-xl text-white font-semibold text-base px-8 py-3.5 transition-all duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-orange-300 focus:ring-offset-2"
            style={{
              background: "linear-gradient(135deg, #F5A623 0%, #E8920E 100%)",
            }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Sign in with Google
          </button>
          <p className="mt-6 text-xs text-gray-400 tracking-wide">
            Supports: English · 中文 · 한국어
          </p>
        </div>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  const user = session!.user;

  // ── 已登录：Dashboard ──
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Quota Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <QuotaCard
            icon={<Gauge className="w-4 h-4" />}
            label="Audio minutes"
            used={user.audioMinutesUsed}
            limit={user.audioMinutesLimit}
            unit="min"
          />
          <QuotaCard
            icon={<HardDrive className="w-4 h-4" />}
            label="Storage"
            used={0}
            limit={2}
            unit="GB"
          />
          <QuotaCard
            icon={<FileImage className="w-4 h-4" />}
            label="PDF pages"
            used={0}
            limit={30}
            unit="pages"
          />
        </div>

        {/* Engine Quick Access */}
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Engines</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <EngineCard
            icon={<Mic className="w-5 h-5 text-brand-500" />}
            title="Audio → Text"
            desc="Transcribe, subtitle, translate"
            tag="Engine B"
            onClick={() => {
              window.location.href = "/stt";
            }}
          />
          <EngineCard
            icon={<Volume2 className="w-5 h-5 text-accent-400" />}
            title="Text → Audio"
            desc="AI voiceover in EN / ZH / KO"
            tag="Engine C"
            onClick={() => {
              if (projects.length > 0) {
                window.location.href = `/projects/${projects[0].id}`;
              } else {
                setShowNewProject(true);
              }
            }}
          />
        </div>

        {/* Projects */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Projects</h2>
          <button onClick={() => setShowNewProject(true)} className="btn-primary text-xs py-1.5 px-3">
            <Plus className="w-3.5 h-3.5" /> New project
          </button>
        </div>

        {/* New Project Form */}
        {showNewProject && (
          <div className="card mb-4 space-y-3">
            <div className="flex items-center gap-3">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Project name..."
                className="input flex-1"
                onKeyDown={(e) => e.key === "Enter" && createProject()}
                autoFocus
              />
              <select value={newLocale} onChange={(e) => setNewLocale(e.target.value)} className="input w-24">
                <option value="en">EN</option>
                <option value="zh">中文</option>
                <option value="ko">한국어</option>
              </select>
            </div>
            <input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Description (optional)..."
              className="input"
            />
            <div className="flex items-center gap-2">
              <button onClick={createProject} disabled={creating} className="btn-primary text-xs">
                {creating ? "Creating..." : "Create"}
              </button>
              <button onClick={() => { setShowNewProject(false); setNewName(""); setNewDesc(""); }} className="btn-secondary text-xs">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Project List */}
        {projects.length === 0 ? (
          <div className="card text-center py-12 text-gray-400">
            <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>No projects yet. Create your first one!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {projects.map((p) => (
              <a
                key={p.id}
                href={`/projects/${p.id}`}
                className="card flex items-center justify-between hover:border-brand-200 hover:shadow-sm transition-all group"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-gray-900">{p.name}</h3>
                  {p.description && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate max-w-md">{p.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">
                    {p._count.assets} assets · {p.locale.toUpperCase()} · Updated {new Date(p.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-brand-500 transition-colors flex-shrink-0 ml-4" />
              </a>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function QuotaCard({ icon, label, used, limit, unit }: {
  icon: React.ReactNode; label: string; used: number; limit: number; unit: string;
}) {
  const pct = Math.min((used / limit) * 100, 100);
  return (
    <div className="rounded-lg bg-white border border-gray-200 p-4">
      <div className="flex items-center gap-2 text-gray-500 text-xs mb-2">
        {icon} {label}
      </div>
      <p className="text-lg font-semibold text-gray-900">
        {used} <span className="text-sm font-normal text-gray-400">/ {limit} {unit}</span>
      </p>
      <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-brand-400 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function EngineCard({ icon, title, desc, tag, onClick }: {
  icon: React.ReactNode; title: string; desc: string; tag: string; onClick?: () => void;
}) {
  return (
    <div
      className="card flex items-center gap-4 cursor-pointer hover:border-brand-200 hover:shadow-sm transition-all"
      onClick={onClick}
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-gray-900 text-sm">{title}</h3>
        <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
      </div>
      <span className="text-[10px] font-medium text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">{tag}</span>
    </div>
  );
}

