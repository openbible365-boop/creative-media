"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback, use } from "react";
import {
  ArrowLeft, Trash2, Mic, FileText, Film, Image as ImageIcon,
  File, Volume2, Loader2, CheckCircle, Clock,
  AlertCircle, Download, MoreVertical,
} from "lucide-react";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { FileUpload } from "@/components/ui/file-upload";
import { Button } from "@/components/ui/button";
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

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session } = useSession();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTasks, setActiveTasks] = useState<TaskInfo[]>([]);
  const [deletingAsset, setDeletingAsset] = useState<string | null>(null);

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
      // 有任务完成时刷新资产列表
      if (updated.some((t) => t.status === "COMPLETED")) {
        fetchProject();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [activeTasks, fetchProject]);

  async function handleTranscribe(assetId: string) {
    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId,
          language: project?.locale || "auto",
          outputFormat: "transcript",
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to start transcription");
        return;
      }
      const data = await res.json();
      setActiveTasks((prev) => [
        ...prev,
        { id: data.taskId, assetId, status: "PENDING", progress: 0 },
      ]);
    } catch {
      alert("Failed to start transcription");
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar breadcrumbs={[{ label: project.name }]} />

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Project Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link
                href="/dashboard"
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
              <span className="text-xs font-medium text-gray-400 bg-gray-100 rounded px-2 py-0.5">
                {project.locale.toUpperCase()}
              </span>
            </div>
            {project.description && (
              <p className="text-sm text-gray-500 ml-8">{project.description}</p>
            )}
          </div>
          <Button variant="danger" size="sm" onClick={handleDeleteProject}>
            <Trash2 className="w-3.5 h-3.5" /> Delete project
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
                    Transcribing audio...
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

        {/* Assets List */}
        <div className="mb-4">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
            Assets ({project.assets.length})
          </h2>
        </div>

        {project.assets.length === 0 ? (
          <div className="card text-center py-12 text-gray-400">
            <File className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>No assets yet. Upload a file to get started!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {project.assets.map((asset) => {
              const Icon = ASSET_ICONS[asset.type] || File;
              const colorClass = ASSET_COLORS[asset.type] || "text-gray-500 bg-gray-50";
              const isAudio = asset.type === "AUDIO";
              const taskForAsset = activeTasks.find((t) => t.assetId === asset.id);

              return (
                <div
                  key={asset.id}
                  className="card flex items-center gap-4 group"
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
                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
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
                      {asset.sourceEngine && (
                        <>
                          <span>·</span>
                          <span className="text-brand-500">{asset.sourceEngine}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isAudio && !taskForAsset && (
                      <button
                        onClick={() => handleTranscribe(asset.id)}
                        className="flex items-center gap-1.5 text-xs font-medium text-brand-500 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-lg px-3 py-1.5 transition-colors"
                        title="Transcribe this audio"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Transcribe
                      </button>
                    )}
                    {taskForAsset && (
                      <span className="flex items-center gap-1.5 text-xs text-brand-500">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Processing...
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
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
