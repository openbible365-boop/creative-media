"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus, Trash2, Copy, Check,
  Mic, MicOff, Send, Loader2, MessageSquare,
} from "lucide-react";
import { Navbar } from "@/components/layout/navbar";

// ═══════════════════════════════════════
// Types
// ═══════════════════════════════════════

interface TranscriptMessage {
  content: string;
  time: string;
}

interface Chat {
  id: string;
  title: string;
  createdAt: string;
  messages: TranscriptMessage[];
}

const STORAGE_PREFIX = "cm_stt_chats_";
const MAX_CHATS = 100;

// ═══════════════════════════════════════
// Main Page Component
// ═══════════════════════════════════════

export default function SttPage() {
  const { data: session, status } = useSession();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const storageKey = session?.user?.email
    ? `${STORAGE_PREFIX}${session.user.email}`
    : null;

  // ── Load chats from localStorage ──
  useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as Chat[];
        setChats(parsed);
        if (parsed.length > 0) {
          setActiveChatId(parsed[0].id);
        }
      }
    } catch {
      // ignore
    }
  }, [storageKey]);

  // ── Auto scroll ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats, activeChatId]);

  // ── Save chats to localStorage ──
  const saveChats = useCallback(
    (updated: Chat[]) => {
      if (!storageKey) return;
      const trimmed = updated.slice(0, MAX_CHATS);
      setChats(trimmed);
      localStorage.setItem(storageKey, JSON.stringify(trimmed));
    },
    [storageKey]
  );

  // ── Chat management ──
  function createChat() {
    const newChat: Chat = {
      id: Date.now().toString(),
      title: "新对话",
      createdAt: new Date().toISOString(),
      messages: [],
    };
    const updated = [newChat, ...chats];
    saveChats(updated);
    setActiveChatId(newChat.id);
    setInputText("");
  }

  function selectChat(id: string) {
    setActiveChatId(id);
    setInputText("");
  }

  function deleteChat(id: string) {
    const updated = chats.filter((c) => c.id !== id);
    saveChats(updated);
    if (activeChatId === id) {
      setActiveChatId(updated.length > 0 ? updated[0].id : null);
    }
  }

  function clearAll() {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
      return;
    }
    saveChats([]);
    setActiveChatId(null);
    setConfirmClear(false);
  }

  const activeChat = chats.find((c) => c.id === activeChatId) || null;

  // ── Add message to active chat ──
  function addMessage(content: string) {
    if (!content.trim()) return;
    if (!activeChatId) {
      const newChat: Chat = {
        id: Date.now().toString(),
        title: content.slice(0, 30),
        createdAt: new Date().toISOString(),
        messages: [{ content, time: new Date().toISOString() }],
      };
      const updated = [newChat, ...chats];
      saveChats(updated);
      setActiveChatId(newChat.id);
      return;
    }

    const updated = chats.map((c) => {
      if (c.id !== activeChatId) return c;
      const newMessages = [
        ...c.messages,
        { content, time: new Date().toISOString() },
      ];
      return {
        ...c,
        title: c.messages.length === 0 ? content.slice(0, 30) : c.title,
        messages: newMessages,
      };
    });
    saveChats(updated);
  }

  function deleteMessage(index: number) {
    if (!activeChatId) return;
    const updated = chats.map((c) => {
      if (c.id !== activeChatId) return c;
      const newMessages = c.messages.filter((_, i) => i !== index);
      return { ...c, messages: newMessages };
    });
    saveChats(updated);
  }

  async function copyMessage(content: string, id: string) {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  // ── Submit input ──
  function handleSubmit() {
    if (!inputText.trim()) return;
    addMessage(inputText.trim());
    setInputText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  // ── Recording ──
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });

      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await transcribeAudio(audioBlob);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied:", err);
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }

  async function transcribeAudio(blob: Blob) {
    setIsTranscribing(true);
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ""
        )
      );

      const res = await fetch("/api/stt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioBase64: base64,
          mimeType: blob.type || "audio/webm",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        console.error("STT error:", data.error);
        return;
      }

      const { text } = await res.json();
      if (text) {
        setInputText((prev) => (prev ? prev + " " + text : text));
      }
    } catch (err) {
      console.error("Transcription failed:", err);
    } finally {
      setIsTranscribing(false);
    }
  }

  // ── Keyboard: left Shift to record ──
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (
        e.key === "Shift" &&
        e.location === 1 &&
        !isRecording &&
        !isTranscribing &&
        document.activeElement?.tagName !== "INPUT"
      ) {
        e.preventDefault();
        startRecording();
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.key === "Shift" && e.location === 1 && isRecording) {
        e.preventDefault();
        stopRecording();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording, isTranscribing]);

  // ── Auto-resize textarea ──
  function handleTextareaInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInputText(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }

  // ── Auth guard ──
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar breadcrumbs={[{ label: "Speech to Text" }]} />
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar breadcrumbs={[{ label: "Speech to Text" }]} />
        <div className="flex items-center justify-center py-32 text-gray-400">
          Please sign in to use Speech-to-Text.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ── Same Navbar as Dashboard ── */}
      <Navbar breadcrumbs={[{ label: "Speech to Text" }]} />

      {/* ── Centered container matching dashboard max-w-6xl ── */}
      <div className="mx-auto max-w-6xl w-full px-4 sm:px-6 py-6 flex-1 flex flex-col overflow-hidden">
        <div className="flex flex-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

          {/* ── Sidebar: hidden on mobile, visible on desktop ── */}
          <aside
            className={`
              hidden md:flex flex-shrink-0 flex-col border-r border-gray-200 bg-white overflow-hidden
              transition-all duration-300
              ${sidebarOpen ? "w-56" : "w-0"}
            `}
          >
            {/* Sidebar header — same height as main top bar */}
            <div className="px-4 py-2.5 flex items-center justify-between border-b border-gray-100">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                对话记录
              </h2>
              <button
                onClick={createChat}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-brand-500 transition-colors"
                title="新对话"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Chat list */}
            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
              {chats.length === 0 && (
                <div className="text-center py-8 text-gray-300">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">暂无对话</p>
                </div>
              )}
              {chats.map((chat) => (
                <div
                  key={chat.id}
                  className={`group flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer transition-colors text-sm ${
                    chat.id === activeChatId
                      ? "bg-brand-50 text-brand-700 font-medium"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                  onClick={() => { selectChat(chat.id); setSidebarOpen(false); }}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      chat.id === activeChatId ? "bg-brand-500" : "bg-transparent"
                    }`}
                  />
                  <span className="truncate flex-1">{chat.title}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteChat(chat.id);
                    }}
                    className="p-0.5 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>

            {/* Bottom — same height as main input area */}
            <div className="px-3 py-4 border-t border-gray-100">
              <button
                onClick={clearAll}
                className={`flex items-center gap-2 w-full text-xs px-2 py-1.5 rounded-lg transition-colors ${
                  confirmClear
                    ? "text-red-500 bg-red-50"
                    : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Trash2 className="w-3 h-3" />
                {confirmClear ? "再次点击确认清空" : "清空所有记录"}
              </button>
            </div>
          </aside>

          {/* ── Main content ── */}
          <main className="flex-1 flex flex-col min-w-0">
            {/* Top bar with sidebar toggle */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                title={sidebarOpen ? "隐藏侧栏" : "显示侧栏"}
              >
                <MessageSquare className="w-4 h-4" />
              </button>
              <h3 className="text-sm font-medium text-gray-700 truncate">
                {activeChat?.title || "新对话"}
              </h3>
              {activeChat && (
                <span className="text-xs text-gray-400 ml-auto">
                  {activeChat.messages.length} 条记录
                </span>
              )}
            </div>

            {/* Transcript list or empty state */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
              {(!activeChat || activeChat.messages.length === 0) ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-20 h-20 rounded-full bg-brand-50 flex items-center justify-center mb-6">
                    <Mic className="w-10 h-10 text-brand-400" />
                  </div>
                  <p className="text-gray-500 text-lg font-medium mb-1">
                    按住左 Shift 键开始录音
                  </p>
                  <p className="text-gray-400 text-sm">
                    松开后自动转为文字
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeChat.messages.map((msg, i) => {
                    const msgId = `${activeChat.id}-${i}`;
                    return (
                      <div
                        key={i}
                        className="group flex items-start gap-3 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 hover:border-gray-200 hover:shadow-sm transition-all"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[11px] text-gray-400 font-mono tabular-nums">
                              {new Date(msg.time).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            <button
                              onClick={() => copyMessage(msg.content, msgId)}
                              className="p-0.5 text-gray-300 hover:text-brand-500 transition-colors"
                              title="复制"
                            >
                              {copiedId === msgId ? (
                                <Check className="w-3 h-3 text-green-500" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                          <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">
                            {msg.content}
                          </p>
                        </div>
                        <button
                          onClick={() => deleteMessage(i)}
                          className="p-1 text-gray-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0 mt-1"
                          title="删除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input area */}
            <div className="px-4 sm:px-6 py-4 border-t border-gray-100">
              {/* Recording / transcribing indicator */}
              {(isRecording || isTranscribing) && (
                <div className="flex items-center gap-2 mb-3">
                  {isRecording && (
                    <>
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-sm text-red-500 font-medium">录音中...</span>
                    </>
                  )}
                  {isTranscribing && (
                    <>
                      <Loader2 className="w-3.5 h-3.5 text-brand-500 animate-spin" />
                      <span className="text-sm text-brand-500">转写中...</span>
                    </>
                  )}
                </div>
              )}

              <div className="flex items-end gap-2 sm:gap-3">
                {/* Record button */}
                <button
                  onMouseDown={() => !isRecording && !isTranscribing && startRecording()}
                  onMouseUp={() => isRecording && stopRecording()}
                  onTouchStart={() => !isRecording && !isTranscribing && startRecording()}
                  onTouchEnd={() => isRecording && stopRecording()}
                  className={`flex-shrink-0 p-2.5 sm:p-3 rounded-xl transition-all ${
                    isRecording
                      ? "bg-red-50 text-red-500 scale-110 shadow-sm"
                      : "bg-gray-50 text-gray-400 hover:text-brand-500 hover:bg-brand-50"
                  }`}
                  title="按住录音"
                >
                  {isRecording ? (
                    <MicOff className="w-5 h-5" />
                  ) : (
                    <Mic className="w-5 h-5" />
                  )}
                </button>

                {/* Textarea */}
                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={handleTextareaInput}
                  placeholder="输入消息，或按住左 Shift 录音..."
                  rows={1}
                  className="input flex-1 resize-none !rounded-xl !py-2.5 text-sm"
                />

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={!inputText.trim()}
                  className={`flex-shrink-0 p-2.5 sm:p-3 rounded-xl transition-all ${
                    inputText.trim()
                      ? "btn-primary !p-2.5 sm:!p-3"
                      : "bg-gray-100 text-gray-300 cursor-not-allowed"
                  }`}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
