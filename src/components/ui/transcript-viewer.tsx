"use client";

import { useState, useEffect } from "react";
import {
  X, Copy, Download, Check, Loader2,
  Languages, Clock, ChevronDown, ChevronUp,
} from "lucide-react";

interface TranscriptViewerProps {
  blobUrl: string;
  name: string;
  type: string; // TRANSCRIPT or SUBTITLE
  metadata?: Record<string, unknown> | null;
  onClose: () => void;
}

const LANG_LABELS: Record<string, string> = {
  en: "English",
  zh: "中文",
  ko: "한국어",
  ja: "日本語",
  auto: "Auto",
};

// SRT/VTT segment parsed
interface SubtitleSegment {
  index: number;
  startTime: string;
  endTime: string;
  text: string;
}

// Whisper JSON segment
interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

export function TranscriptViewer({
  blobUrl,
  name,
  type,
  metadata,
  onClose,
}: TranscriptViewerProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(blobUrl);
        if (!res.ok) throw new Error("Failed to load");
        const text = await res.text();
        setContent(text);
      } catch {
        setError("Failed to load transcript");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [blobUrl]);

  async function handleCopy() {
    if (!content) return;
    const plainText = extractPlainText(content, type);
    await navigator.clipboard.writeText(plainText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const language = metadata?.language as string | undefined;
  const translatedFrom = metadata?.translatedFrom as string | undefined;
  const duration = metadata?.duration as number | undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[85vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-gray-900 truncate">{name}</h2>
            <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
              {language && (
                <span className="flex items-center gap-1">
                  <Languages className="w-3 h-3" />
                  {LANG_LABELS[language] || language}
                </span>
              )}
              {translatedFrom && (
                <span className="text-emerald-500">
                  Translated from {LANG_LABELS[translatedFrom] || translatedFrom}
                </span>
              )}
              {duration && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatTimeDuration(duration)}
                </span>
              )}
              <span className="text-gray-300">
                {type === "SUBTITLE" ? "Subtitle" : "Transcript"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 ml-4">
            <button
              onClick={handleCopy}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
              title="Copy text"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
            <a
              href={blobUrl}
              download={name}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </a>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
            </div>
          )}

          {error && (
            <div className="text-center text-red-500 py-12">{error}</div>
          )}

          {content && !loading && (
            <>
              {type === "TRANSCRIPT" ? (
                <TranscriptContent content={content} expanded={expanded} onToggle={() => setExpanded(!expanded)} />
              ) : (
                <SubtitleContent content={content} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Transcript (JSON) viewer ──
function TranscriptContent({
  content,
  expanded,
  onToggle,
}: {
  content: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  let parsed: { text?: string; segments?: TranscriptSegment[] } | null = null;
  try {
    parsed = JSON.parse(content);
  } catch {
    // Not valid JSON, show raw
    return (
      <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
        {content}
      </pre>
    );
  }

  if (!parsed) return null;

  return (
    <div className="space-y-4">
      {/* Full text */}
      {parsed.text && (
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {parsed.text}
          </p>
        </div>
      )}

      {/* Segments */}
      {parsed.segments && parsed.segments.length > 0 && (
        <div>
          <button
            onClick={onToggle}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors mb-2"
          >
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
            {parsed.segments.length} segments
          </button>

          {expanded && (
            <div className="space-y-1.5">
              {parsed.segments.map((seg, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-lg hover:bg-gray-50 px-3 py-2 transition-colors group"
                >
                  <span className="text-[11px] tabular-nums text-gray-400 pt-0.5 flex-shrink-0 font-mono w-20">
                    {formatTime(seg.start)} → {formatTime(seg.end)}
                  </span>
                  <p className="text-sm text-gray-700 flex-1 leading-relaxed">
                    {seg.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Subtitle (SRT/VTT) viewer ──
function SubtitleContent({ content }: { content: string }) {
  const segments = parseSubtitles(content);

  if (segments.length === 0) {
    return (
      <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
        {content}
      </pre>
    );
  }

  return (
    <div className="space-y-1.5">
      {segments.map((seg) => (
        <div
          key={seg.index}
          className="flex items-start gap-3 rounded-lg hover:bg-gray-50 px-3 py-2 transition-colors"
        >
          <div className="flex-shrink-0 w-28">
            <span className="text-[10px] font-mono text-gray-300 block">
              #{seg.index}
            </span>
            <span className="text-[11px] tabular-nums text-gray-400 font-mono">
              {seg.startTime}
            </span>
          </div>
          <p className="text-sm text-gray-700 flex-1 leading-relaxed whitespace-pre-wrap">
            {seg.text}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Helpers ──

function parseSubtitles(content: string): SubtitleSegment[] {
  const segments: SubtitleSegment[] = [];
  // Handle both SRT and VTT
  const isVTT = content.trimStart().startsWith("WEBVTT");
  const lines = content.split(/\r?\n/);

  let i = isVTT ? 1 : 0; // skip WEBVTT header
  let segIndex = 1;

  while (i < lines.length) {
    // Skip empty lines
    if (!lines[i].trim()) {
      i++;
      continue;
    }

    // Check if this is a number line (SRT index)
    const isIndex = /^\d+$/.test(lines[i].trim());
    if (isIndex) {
      i++; // skip index
    }

    // Look for timestamp line
    if (i < lines.length && lines[i].includes("-->")) {
      const timeParts = lines[i].split("-->");
      const startTime = timeParts[0].trim();
      const endTime = timeParts[1]?.trim().split(" ")[0] || "";
      i++;

      // Collect text lines until blank line
      const textLines: string[] = [];
      while (i < lines.length && lines[i].trim()) {
        textLines.push(lines[i].trim());
        i++;
      }

      segments.push({
        index: segIndex++,
        startTime,
        endTime,
        text: textLines.join("\n"),
      });
    } else {
      i++;
    }
  }

  return segments;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatTimeDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function extractPlainText(content: string, type: string): string {
  if (type === "TRANSCRIPT") {
    try {
      const parsed = JSON.parse(content);
      if (parsed.text) return parsed.text;
      if (parsed.segments) {
        return parsed.segments.map((s: TranscriptSegment) => s.text).join(" ");
      }
    } catch {
      // fall through
    }
  }
  // For SRT/VTT, strip timestamps and indices
  const lines = content.split(/\r?\n/);
  return lines
    .filter(
      (line) =>
        line.trim() &&
        !/^\d+$/.test(line.trim()) &&
        !line.includes("-->") &&
        !line.startsWith("WEBVTT")
    )
    .join("\n");
}
