"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback, use } from "react";
import {
  ArrowLeft, Trash2, Mic, FileText, Film, Image as ImageIcon,
  File, Volume2, Loader2, CheckCircle, Clock,
  AlertCircle, Download, Pencil, Check, X, Languages,
  GitBranch,
} from "lucide-react";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { FileUpload } from "@/components/ui/file-upload";
import { Button } from "@/components/ui/button";
import { AssetPreview } from "@/components/ui/asset-preview";
import { TranscribePanel } from "@/components/ui/transcribe-panel";
import { formatFileSize, formatDuration } from "@/lib/utils";

interface Asset {
  id: string;
  name: string;
  type: string;
  mimeType: string | null;
  size: number;
  blobUrl: string;
  sourceEngine: string | null;
  parentId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  locale: string;
  createdAt: string;
  updatedAt: string;
  assets: Asset[];
  _count: { assets: number };
}

interface TaskInfo {
  id: string;
  assetId: string;
  status: string;
  progress: number;
  type: string;
}

const ASSET_ICONS: Record<string, typeof Mic> = {
  AUDIO: Mic,
  VIDEO: Film,
  TRANSCRIPT: FileText,
  SUBTITLE: FileText,
  IMAGE: ImageIcon,
  DOCUMENT: File,
  TTS_AUDIO: Volume2,
};

const ASSET_COLORS: Record<string, string> = {
  AUDIO: "text-blue-500 bg-blue-50",
  VIDEO: "text-purple-500 bg-purple-50",
  TRANSCRIPT: "text-emerald-500 bg-emerald-50",
  SUBTITLE: "text-teal-500 bg-teal-50",
  IMAGE: "text-amber-500 bg-amber-50",
  DOCUMENT: "text-gray-500 bg-gray-50",
  TTS_AUDIO: "text-pink-500 bg-pink-50",
};

const ALL_TYPES = ["ALL", "AUDIO", "VIDEO", "IMAGE", "TRANSCRIPT", "SUBTITLE", "DOCUMENT", "TTS_AUDIO"];
const TYPE_LABELS: Record<string, string> = {
  ALL: "All",
  AUDIO: "Audio",
  VIDEO: "Video",
  IMAGE: "Images",
  TRANSCRIPT: "Transcripts",
  SUBTITLE: "Subtitles",
  DOCUMENT: "Docs",
  TTS_AUDIO: "TTS",
};

const TASK_TYPE_LABELS: Record<string, string> = {
  TRANSCRIBE: "Transcribing",
  TRANSLATE: "Translating",
  TTS: "Generating speech",
  PDF_PARSE: "Parsing PDF",
  VIDEO_RENDER: "Rendering video",
};

const LANG_LABELS: Record<string, string> = {
  en: "English",
  zh: "中文",
  ko: "한국어",
};

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session } = useSession();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTasks, setActiveTasks] = useState<TaskInfo[]>([]);
  const [deletingAsset, setDeletingAsset] = useState<string | null>(null);

  // ── Editing state ──
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);

  // ── Filter state ──
  const [filterType, setFilterType] = useState("ALL");

  // ── TranscribePanel state ──
  const [transcribeTarget, setTranscribeTarget] = useState<{ assetId: string; assetName: string } | null>(null);

  // ── Translate dropdown state ──
  const [translateDropdown, setTranslateDropdown] = useState<string | null>(null);

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) {
        setError(res.status === 404 ? "Project not found" : "Failed to load project");
        return;
      }
      setProject(await res.json());
    } catch {
      setError("Failed to load project");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (session) fetchProject();
  }, [session, fetchProject]);

  // 轮询活跃任务状态
  useEffect(() => {
    if (activeTasks.length === 0) return;
    const interval = setInterval(async () => {
      const updated = await Promise.all(
        activeTasks.map(async (t) => {
          const res = await fetch(`/api/tasks/${t.id}`);
          if (!res.ok) return { ...t, status: "FAILED" };
          const data = await res.json();
          return { ...t, status: data.status, progress: data.progress };
        })
      );
      setActiveTasks(updated.filter((t) => t.status !== "COMPLETED" && t.status !== "FAILED"));
      if (updated.some((t) => t.status === "COMPLETED")) {
        fetchProject();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [activeTasks, fetchProject]);

  // ── Project edit handlers ──
  async function saveProjectField(field: string, value: string | null) {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProject((prev) => prev ? { ...prev, ...updated } : prev);
      }
    } catch {
      // silently fail
    } finally {
      setSaving(false);
      setEditingName(false);
      setEditingDesc(false);
    }
  }

  function openTranscribePanel(assetId: string, assetName: string) {
    setTranscribeTarget({ assetId, assetName });
  }

  function handleTranscribeSubmit(taskId: string) {
    if (transcribeTarget) {
      setActiveTasks((prev) => [
        ...prev,
        { id: taskId, assetId: transcribeTarget.assetId, status: "PENDING", progress: 0, type: "TRANSCRIBE" },
      ]);
    }
    setTranscribeTarget(null);
  }

  async function handleTranslate(assetId: string, targetLanguage: string) {
    setTranslateDropdown(null);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId, targetLanguage }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to start translation");
        return;
      }
      const data = await res.json();
      setActiveTasks((prev) => [
        ...prev,
        { id: data.taskId, assetId, status: "PENDING", progress: 0, type: "TRANSLATE" },
      ]);
    } catch {
      alert("Failed to start translation");
    }
  }

  async function handleDeleteAsset(assetId: string) {
    if (!confirm("Delete this asset? This cannot be undone.")) return;
    setDeletingAsset(assetId);
    try {
      const res = await fetch(`/api/assets/${assetId}`, { method: "DELETE" });
      if (res.ok) {
        setProject((prev) =>
          prev
            ? { ...prev, assets: prev.assets.filter((a) => a.id !== assetId) }
            : prev
        );
      }
    } catch {
      alert("Failed to delete asset");
    } finally {
      setDeletingAsset(null);
    }
  }

  async function handleDeleteProject() {
    if (!confirm("Delete this project and all its assets? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (res.ok) {
        window.location.href = "/dashboard";
      }
    } catch {
      alert("Failed to delete project");
    }
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error || !project) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex flex-col items-center justify-center py-32 text-gray-400">
          <AlertCircle className="w-10 h-10 mb-3" />
          <p>{error || "Project not found"}</p>
          <Link href="/dashboard" className="mt-4 text-brand-500 hover:underline text-sm">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // ── Filter assets ──
  const filteredAssets = filterType === "ALL"
    ? project.assets
    : project.assets.filter((a) => a.type === filterType);

  // Count per type for filter badges
  const typeCounts: Record<string, number> = {};
  project.assets.forEach((a) => {
    typeCounts[a.type] = (typeCounts[a.type] || 0) + 1;
  });

  // Build parent name map for lineage display
  const assetMap = new Map(project.assets.map((a) => [a.id, a]));

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar breadcrumbs={[{ label: project.name }]} />

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Project Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <Link
                href="/dashboard"
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>

              {/* Editable Name */}
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="input text-xl font-bold py-1 px-2"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveProjectField("name", editName);
                      if (e.key === "Escape") setEditingName(false);
                    }}
                  />
                  <button
                    onClick={() => saveProjectField("name", editName)}
                    disabled={saving}
                    className="p-1 text-green-500 hover:text-green-700"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setEditingName(false)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setEditName(project.name); setEditingName(true); }}
                  className="group flex items-center gap-2"
                >
                  <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
                  <Pencil className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              )}

              {/* Locale Badge (clickable to edit) */}
              <select
                value={project.locale}
                onChange={(e) => saveProjectField("locale", e.target.value)}
                className="text-xs font-medium text-gray-400 bg-gray-100 rounded px-2 py-0.5 border-0 cursor-pointer hover:bg-gray-200 transition-colors"
              >
                <option value="en">EN</option>
                <option value="zh">中文</option>
                <option value="ko">한국어</option>
              </select>
            </div>

            {/* Editable Description */}
            {editingDesc ? (
              <div className="ml-8 flex items-center gap-2 mt-1">
                <input
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Add a description..."
                  className="input text-sm py-1 px-2 flex-1 max-w-md"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveProjectField("description", editDesc || null);
                    if (e.key === "Escape") setEditingDesc(false);
                  }}
                />
                <button
                  onClick={() => saveProjectField("description", editDesc || null)}
                  disabled={saving}
                  className="p-1 text-green-500 hover:text-green-700"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setEditingDesc(false)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setEditDesc(project.description || ""); setEditingDesc(true); }}
                className="ml-8 mt-1 group flex items-center gap-1.5"
              >
                <p className="text-sm text-gray-500">
                  {project.description || "Click to add description..."}
                </p>
                <Pencil className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
          </div>

          <Button variant="danger" size="sm" onClick={handleDeleteProject}>
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </Button>
        </div>

        {/* Active Tasks */}
        {activeTasks.length > 0 && (
          <div className="mb-6 space-y-2">
            {activeTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50/50 px-4 py-3"
              >
                <Loader2 className="w-4 h-4 text-brand-500 animate-spin flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-brand-700">
                    {TASK_TYPE_LABELS[task.type] || "Processing"}...
                  </p>
                  <div className="mt-1 h-1.5 rounded-full bg-brand-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand-500 transition-all duration-500"
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs text-brand-500">{task.progress}%</span>
              </div>
            ))}
          </div>
        )}

        {/* Upload Area */}
        <FileUpload
          projectId={id}
          onUploadComplete={() => fetchProject()}
          className="mb-8"
        />

        {/* Filter Tabs + Assets Count */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {ALL_TYPES.map((t) => {
              const count = t === "ALL" ? project.assets.length : (typeCounts[t] || 0);
              if (t !== "ALL" && count === 0) return null;
              return (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1.5 transition-colors whitespace-nowrap ${
                    filterType === t
                      ? "bg-brand-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {TYPE_LABELS[t]}
                  <span className={`text-[10px] ${filterType === t ? "text-white/70" : "text-gray-400"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Assets List */}
        {filteredAssets.length === 0 ? (
          <div className="card text-center py-12 text-gray-400">
            <File className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>{project.assets.length === 0 ? "No assets yet. Upload a file to get started!" : "No assets match this filter."}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredAssets.map((asset) => {
              const Icon = ASSET_ICONS[asset.type] || File;
              const colorClass = ASSET_COLORS[asset.type] || "text-gray-500 bg-gray-50";
              const isAudioOrVideo = asset.type === "AUDIO" || asset.type === "VIDEO";
              const isTranscript = asset.type === "TRANSCRIPT" || asset.type === "SUBTITLE";
              const taskForAsset = activeTasks.find((t) => t.assetId === asset.id);
              const parentAsset = asset.parentId ? assetMap.get(asset.parentId) : null;

              return (
                <div
                  key={asset.id}
                  className="card flex items-center gap-4 group hover:border-gray-300 transition-colors"
                >
                  {/* Icon */}
                  <div
                    className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${colorClass}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-900 truncate">
                      {asset.name}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5 flex-wrap">
                      <span>{asset.type}</span>
                      <span>·</span>
                      <span>{formatFileSize(asset.size)}</span>
                      {asset.metadata && typeof (asset.metadata as Record<string, number>).duration === "number" && (
                        <>
                          <span>·</span>
                          <span>{formatDuration((asset.metadata as Record<string, number>).duration)}</span>
                        </>
                      )}
                      <span>·</span>
                      <span>{new Date(asset.createdAt).toLocaleDateString()}</span>
                      {Boolean(asset.metadata?.language) && (
                        <>
                          <span>·</span>
                          <span className="text-brand-500 flex items-center gap-0.5">
                            <Languages className="w-3 h-3" />
                            {LANG_LABELS[String(asset.metadata!.language)] || String(asset.metadata!.language)}
                          </span>
                        </>
                      )}
                      {Boolean(asset.metadata?.translatedFrom) && (
                        <span className="text-emerald-500 text-[10px]">
                          ← {LANG_LABELS[String(asset.metadata!.translatedFrom)] || String(asset.metadata!.translatedFrom)}
                        </span>
                      )}
                      {parentAsset && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-0.5 text-gray-400">
                            <GitBranch className="w-3 h-3" />
                            <span className="truncate max-w-[120px]">{parentAsset.name}</span>
                          </span>
                        </>
                      )}
                      {asset.sourceEngine && !parentAsset && (
                        <>
                          <span>·</span>
                          <span className="text-brand-500">{asset.sourceEngine}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Preview + Actions */}
                  <div className="flex items-center gap-2">
                    {/* Asset Preview (audio player / view buttons) */}
                    <AssetPreview
                      type={asset.type}
                      mimeType={asset.mimeType}
                      blobUrl={asset.blobUrl}
                      name={asset.name}
                      metadata={asset.metadata}
                    />

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Transcribe button for audio/video */}
                      {isAudioOrVideo && !taskForAsset && (
                        <button
                          onClick={() => openTranscribePanel(asset.id, asset.name)}
                          className="flex items-center gap-1.5 text-xs font-medium text-brand-500 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-lg px-3 py-1.5 transition-colors"
                          title="Transcribe this file"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Transcribe
                        </button>
                      )}

                      {/* Translate button for transcript/subtitle */}
                      {isTranscript && !taskForAsset && (
                        <div className="relative">
                          <button
                            onClick={() =>
                              setTranslateDropdown(
                                translateDropdown === asset.id ? null : asset.id
                              )
                            }
                            className="flex items-center gap-1.5 text-xs font-medium text-emerald-500 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg px-3 py-1.5 transition-colors"
                            title="Translate"
                          >
                            <Languages className="w-3.5 h-3.5" />
                            Translate
                          </button>
                          {translateDropdown === asset.id && (
                            <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-30 min-w-[140px]">
                              {Object.entries(LANG_LABELS).map(([code, label]) => {
                                const currentLang = asset.metadata?.language as string;
                                if (code === currentLang) return null;
                                return (
                                  <button
                                    key={code}
                                    onClick={() => handleTranslate(asset.id, code)}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                  >
                                    → {label}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Task in progress */}
                      {taskForAsset && (
                        <span className="flex items-center gap-1.5 text-xs text-brand-500">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          {taskForAsset.progress}%
                        </span>
                      )}

                      <a
                        href={asset.blobUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => handleDeleteAsset(asset.id)}
                        disabled={deletingAsset === asset.id}
                        className="p-1.5 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        {deletingAsset === asset.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* TranscribePanel Modal */}
      {transcribeTarget && (
        <TranscribePanel
          assetId={transcribeTarget.assetId}
          assetName={transcribeTarget.assetName}
          projectLocale={project.locale}
          open={true}
          onClose={() => setTranscribeTarget(null)}
          onSubmit={handleTranscribeSubmit}
        />
      )}
    </div>
  );
}
