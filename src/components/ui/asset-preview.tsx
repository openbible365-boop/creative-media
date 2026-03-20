"use client";

import { useState, useRef } from "react";
import {
  Play, Pause, X, Maximize2, FileText,
} from "lucide-react";
import { TranscriptViewer } from "@/components/ui/transcript-viewer";

interface AssetPreviewProps {
  type: string;
  mimeType: string | null;
  blobUrl: string;
  name: string;
  metadata?: Record<string, unknown> | null;
}

export function AssetPreview({ type, mimeType, blobUrl, name, metadata }: AssetPreviewProps) {
  const [expanded, setExpanded] = useState(false);

  if (type === "AUDIO" || type === "TTS_AUDIO") {
    return <AudioPreview blobUrl={blobUrl} />;
  }

  if (type === "VIDEO") {
    return (
      <>
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-1.5 text-xs text-purple-500 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg px-3 py-1.5 transition-colors"
        >
          <Play className="w-3.5 h-3.5" /> Preview
        </button>
        {expanded && (
          <VideoModal blobUrl={blobUrl} name={name} onClose={() => setExpanded(false)} />
        )}
      </>
    );
  }

  if (type === "IMAGE") {
    return (
      <>
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-1.5 text-xs text-amber-500 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg px-3 py-1.5 transition-colors"
        >
          <Maximize2 className="w-3.5 h-3.5" /> View
        </button>
        {expanded && (
          <ImageModal blobUrl={blobUrl} name={name} onClose={() => setExpanded(false)} />
        )}
      </>
    );
  }

  if (type === "TRANSCRIPT" || type === "SUBTITLE") {
    return (
      <>
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-1.5 text-xs text-emerald-500 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg px-3 py-1.5 transition-colors"
        >
          <FileText className="w-3.5 h-3.5" /> View
        </button>
        {expanded && (
          <TranscriptViewer
            blobUrl={blobUrl}
            name={name}
            type={type}
            metadata={metadata}
            onClose={() => setExpanded(false)}
          />
        )}
      </>
    );
  }

  return null;
}

// ── Audio Player ──
function AudioPreview({ blobUrl }: { blobUrl: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play();
    }
    setPlaying(!playing);
  }

  function handleTimeUpdate() {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    setProgress((audio.currentTime / audio.duration) * 100);
  }

  function handleEnded() {
    setPlaying(false);
    setProgress(0);
  }

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audio.currentTime = pct * audio.duration;
  }

  return (
    <div className="flex items-center gap-2">
      <audio
        ref={audioRef}
        src={blobUrl}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
      />
      <button
        onClick={toggle}
        className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center transition-colors"
      >
        {playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 ml-0.5" />}
      </button>
      <div
        className="w-20 h-1.5 rounded-full bg-gray-200 cursor-pointer overflow-hidden"
        onClick={handleSeek}
      >
        <div
          className="h-full rounded-full bg-blue-400 transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// ── Video Modal ──
function VideoModal({ blobUrl, name, onClose }: { blobUrl: string; name: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-black rounded-xl overflow-hidden max-w-4xl w-full mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-2 bg-gray-900">
          <span className="text-sm text-white/70 truncate">{name}</span>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <video src={blobUrl} controls autoPlay className="w-full max-h-[70vh]" />
      </div>
    </div>
  );
}

// ── Image Modal ──
function ImageModal({ blobUrl, name, onClose }: { blobUrl: string; name: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-2 bg-gray-900/80 rounded-t-xl">
          <span className="text-sm text-white/70 truncate">{name}</span>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <img
          src={blobUrl}
          alt={name}
          className="w-full max-h-[70vh] object-contain bg-gray-950 rounded-b-xl"
        />
      </div>
    </div>
  );
}
