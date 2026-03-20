"use client";

import { useState } from "react";
import { X, Loader2, Languages, FileText, Subtitles } from "lucide-react";
import { cn } from "@/lib/utils";

interface TranscribePanelProps {
  assetId: string;
  assetName: string;
  projectLocale: string;
  open: boolean;
  onClose: () => void;
  onSubmit: (taskId: string) => void;
}

const LANGUAGES = [
  { code: "auto", label: "Auto-detect", flag: "🌐" },
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
  { code: "ko", label: "한국어", flag: "🇰🇷" },
];

const OUTPUT_FORMATS = [
  { code: "transcript", label: "Transcript", desc: "Structured JSON with timestamps", icon: FileText },
  { code: "subtitle", label: "Subtitles", desc: "Timed subtitle file", icon: Subtitles },
];

const SUBTITLE_FORMATS = [
  { code: "srt", label: "SRT" },
  { code: "vtt", label: "VTT (WebVTT)" },
];

const TRANSLATE_TARGETS = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
  { code: "ko", label: "한국어", flag: "🇰🇷" },
];

export function TranscribePanel({
  assetId,
  assetName,
  projectLocale,
  open,
  onClose,
  onSubmit,
}: TranscribePanelProps) {
  const [language, setLanguage] = useState(projectLocale || "auto");
  const [outputFormat, setOutputFormat] = useState("transcript");
  const [subtitleFormat, setSubtitleFormat] = useState("srt");
  const [targetLanguages, setTargetLanguages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleTargetLang(lang: string) {
    setTargetLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    );
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId,
          language,
          outputFormat,
          subtitleFormat: outputFormat === "subtitle" ? subtitleFormat : undefined,
          targetLanguages: targetLanguages.length > 0 ? targetLanguages : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to start transcription");
        return;
      }
      const data = await res.json();
      onSubmit(data.taskId);
      onClose();
    } catch {
      setError("Network error — please try again");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900">Transcribe Audio</h2>
            <p className="text-xs text-gray-400 truncate max-w-xs">{assetName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Source Language */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
              Source Language
            </label>
            <div className="grid grid-cols-2 gap-2">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => setLanguage(lang.code)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all border",
                    language === lang.code
                      ? "border-brand-500 bg-brand-50 text-brand-700 shadow-sm"
                      : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                  )}
                >
                  <span className="text-base">{lang.flag}</span>
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          {/* Output Format */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
              Output Format
            </label>
            <div className="space-y-2">
              {OUTPUT_FORMATS.map((fmt) => {
                const Icon = fmt.icon;
                return (
                  <button
                    key={fmt.code}
                    onClick={() => setOutputFormat(fmt.code)}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-lg px-4 py-3 text-left transition-all border",
                      outputFormat === fmt.code
                        ? "border-brand-500 bg-brand-50 shadow-sm"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-5 h-5 flex-shrink-0",
                        outputFormat === fmt.code ? "text-brand-500" : "text-gray-400"
                      )}
                    />
                    <div>
                      <p
                        className={cn(
                          "text-sm font-medium",
                          outputFormat === fmt.code ? "text-brand-700" : "text-gray-700"
                        )}
                      >
                        {fmt.label}
                      </p>
                      <p className="text-xs text-gray-400">{fmt.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Subtitle Format (conditional) */}
            {outputFormat === "subtitle" && (
              <div className="mt-3 flex items-center gap-2 pl-1">
                <span className="text-xs text-gray-500">Format:</span>
                {SUBTITLE_FORMATS.map((sf) => (
                  <button
                    key={sf.code}
                    onClick={() => setSubtitleFormat(sf.code)}
                    className={cn(
                      "text-xs font-medium rounded-full px-3 py-1 transition-colors",
                      subtitleFormat === sf.code
                        ? "bg-brand-500 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    )}
                  >
                    {sf.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Auto-Translate */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Languages className="w-3.5 h-3.5" />
              Auto-Translate To (optional)
            </label>
            <div className="flex items-center gap-2">
              {TRANSLATE_TARGETS.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => toggleTargetLang(lang.code)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all border",
                    targetLanguages.includes(lang.code)
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm"
                      : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                  )}
                >
                  <span className="text-base">{lang.flag}</span>
                  {lang.label}
                </button>
              ))}
            </div>
            {targetLanguages.length > 0 && (
              <p className="text-xs text-gray-400 mt-1.5">
                Translated versions will be auto-generated after transcription.
              </p>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <button
            onClick={onClose}
            className="btn-secondary text-sm"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="btn-primary text-sm flex items-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                Start Transcription
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
