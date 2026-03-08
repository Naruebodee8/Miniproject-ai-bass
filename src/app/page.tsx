"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Message = {
    role: "user" | "assistant";
    content: string;
    id?: string;
    source_ref?: string;
    confidence_score?: number;
    latency_ms?: number;
    feedback?: "up" | "down" | null;
};

type Session = {
    id: string;
    title: string;
    created_at: string;
    messages: Message[];
};

const CONFIDENCE_THRESHOLD = 0.6;
const STORAGE_KEY = "referee_gpt_sessions";

const EXAMPLE_QUESTIONS = [
    "กฎ Traveling คืออะไร และนับ Gather Step อย่างไร?",
    "ถ้าผู้เล่นฝ่ายรับยืนในครึ่งวงกลมใต้แป้น แล้วถูกชนคือฟาวล์ประเภทไหน?",
    "กฎ 24 วินาที รีเซ็ตเป็นเท่าไหร่หลังบอลโดนห่วง?",
    "Technical Foul และ Unsportsmanlike Foul ต่างกันอย่างไร?",
];

const WELCOME_MESSAGE: Message = {
    role: "assistant",
    content:
        "สวัสดีครับ! ผม Referee-GPT ผู้เชี่ยวชาญกฎบาสเกตบอล 🏀 ถามกฎข้อไหนก็ได้ครับ ผมจะตอบพร้อมอ้างอิงข้อกฎทุกครั้ง",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function loadSessions(): Session[] {
    if (typeof window === "undefined") return [];
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
        return [];
    }
}

function saveSessions(sessions: Session[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function createSession(): Session {
    return {
        id: crypto.randomUUID(),
        title: "การสนทนาใหม่",
        created_at: new Date().toISOString(),
        messages: [WELCOME_MESSAGE],
    };
}

function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    });
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ChatPage() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [currentId, setCurrentId] = useState<string>("");
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // ── Init sessions from localStorage ──
    useEffect(() => {
        const stored = loadSessions();
        if (stored.length === 0) {
            const first = createSession();
            setSessions([first]);
            setCurrentId(first.id);
            saveSessions([first]);
        } else {
            setSessions(stored);
            setCurrentId(stored[0].id);
        }
    }, []);

    // ── Scroll to bottom on new message ──
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [sessions, currentId, isLoading]);

    // ── Current session data ──
    const currentSession = sessions.find((s) => s.id === currentId);
    const messages = currentSession?.messages ?? [WELCOME_MESSAGE];

    // ── Update a session helper ──
    const updateSession = useCallback(
        (id: string, updater: (s: Session) => Session) => {
            setSessions((prev) => {
                const next = prev.map((s) => (s.id === id ? updater(s) : s));
                saveSessions(next);
                return next;
            });
        },
        []
    );

    // ── New chat ──
    const startNewChat = () => {
        const s = createSession();
        setSessions((prev) => {
            const next = [s, ...prev];
            saveSessions(next);
            return next;
        });
        setCurrentId(s.id);
        setInput("");
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    // ── Delete session ──
    const deleteSession = (id: string) => {
        setSessions((prev) => {
            const next = prev.filter((s) => s.id !== id);
            if (next.length === 0) {
                const fresh = createSession();
                saveSessions([fresh]);
                setCurrentId(fresh.id);
                return [fresh];
            }
            saveSessions(next);
            if (currentId === id) setCurrentId(next[0].id);
            return next;
        });
        setDeleteConfirm(null);
    };

    // ── Send message ──
    const sendMessage = async (question: string) => {
        if (!question.trim() || isLoading || !currentId) return;

        const userMsg: Message = { role: "user", content: question };
        setInput("");
        setIsLoading(true);

        // Optimistically add user message & set title
        updateSession(currentId, (s) => ({
            ...s,
            title: s.title === "การสนทนาใหม่" ? question.slice(0, 40) : s.title,
            messages: [...s.messages, userMsg],
        }));

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "API error");

            const aiMsg: Message = {
                role: "assistant",
                content: data.answer,
                id: data.id,
                source_ref: data.source_ref,
                confidence_score: data.confidence_score,
                latency_ms: data.latency_ms,
                feedback: null,
            };
            updateSession(currentId, (s) => ({
                ...s,
                messages: [...s.messages, aiMsg],
            }));
        } catch (err) {
            const errMsg =
                String(err).includes("503") || String(err).includes("high demand")
                    ? "⏳ Gemini API มีผู้ใช้งานสูงชั่วคราว กรุณาลองใหม่ใน 10 วินาทีครับ"
                    : "❌ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้งครับ";
            updateSession(currentId, (s) => ({
                ...s,
                messages: [...s.messages, { role: "assistant", content: errMsg }],
            }));
            console.error(err);
        } finally {
            setIsLoading(false);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    };

    // ── HITL feedback ──
    const handleFeedback = async (
        msgIndex: number,
        id: string,
        is_correct: boolean
    ) => {
        updateSession(currentId, (s) => ({
            ...s,
            messages: s.messages.map((m, i) =>
                i === msgIndex ? { ...m, feedback: is_correct ? "up" : "down" } : m
            ),
        }));
        try {
            await fetch("/api/feedback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, is_correct }),
            });
        } catch (err) {
            console.error("Feedback error:", err);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage(input);
        }
    };

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="flex h-[calc(100vh-64px)] bg-slate-950">
            {/* ── Sidebar ─────────────────────────────────────────────────────── */}
            <aside
                className={`flex-shrink-0 flex flex-col bg-slate-900 border-r border-slate-800 transition-all duration-300 overflow-hidden ${sidebarOpen ? "w-72" : "w-0"
                    }`}
            >
                {/* Sidebar header */}
                <div className="p-3 border-b border-slate-800 flex-shrink-0">
                    <button
                        onClick={startNewChat}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-95"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                            <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
                        </svg>
                        การสนทนาใหม่
                    </button>
                </div>

                {/* Session list */}
                <div className="flex-1 overflow-y-auto py-2">
                    {sessions.length === 0 ? (
                        <p className="text-center text-slate-600 text-xs p-4">ยังไม่มีประวัติ</p>
                    ) : (
                        sessions.map((s) => (
                            <div
                                key={s.id}
                                className={`group relative mx-2 mb-1 rounded-xl overflow-hidden transition-all duration-200 ${s.id === currentId
                                        ? "bg-slate-800 border border-slate-700/70"
                                        : "hover:bg-slate-800/50 border border-transparent"
                                    }`}
                            >
                                <button
                                    onClick={() => { setCurrentId(s.id); setDeleteConfirm(null); }}
                                    className="w-full text-left px-3 py-2.5 pr-9"
                                >
                                    <p className={`text-sm font-medium truncate leading-snug ${s.id === currentId ? "text-white" : "text-slate-300"}`}>
                                        🏀 {s.title}
                                    </p>
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                        {formatDate(s.created_at)} · {s.messages.length - 1} คำถาม
                                    </p>
                                </button>

                                {deleteConfirm === s.id ? (
                                    <div className="flex items-center gap-1 px-3 pb-2">
                                        <span className="text-xs text-slate-400 flex-1">ลบเลย?</span>
                                        <button onClick={() => deleteSession(s.id)} className="text-xs text-red-400 hover:text-red-300 font-semibold">ลบ</button>
                                        <button onClick={() => setDeleteConfirm(null)} className="text-xs text-slate-500 hover:text-slate-300 ml-2">ยกเลิก</button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm(s.id); }}
                                        className="absolute right-2 top-2.5 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-500 hover:text-red-400 rounded"
                                        title="ลบการสนทนา"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                                            <path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5a.75.75 0 0 1 .786-.711Z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        ))
                    )}
                </div>

                <div className="p-3 border-t border-slate-800 flex-shrink-0">
                    <p className="text-center text-[11px] text-slate-600">{sessions.length} การสนทนา</p>
                </div>
            </aside>

            {/* ── Chat Area ────────────────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Topbar */}
                <div className="flex items-center px-4 py-2 border-b border-slate-800/60 flex-shrink-0">
                    <button
                        onClick={() => setSidebarOpen((v) => !v)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-all duration-200"
                        title={sidebarOpen ? "ซ่อนประวัติ" : "แสดงประวัติ"}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                            <path fillRule="evenodd" d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75Zm0 10.5a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1-.75-.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Z" clipRule="evenodd" />
                        </svg>
                    </button>
                    {currentSession && (
                        <span className="ml-3 text-sm text-slate-400 truncate">{currentSession.title}</span>
                    )}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto">
                    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
                        {messages.map((msg, i) => (
                            <div
                                key={i}
                                className={`message-enter flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                            >
                                <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-lg ${msg.role === "user" ? "bg-orange-500 text-white" : "bg-slate-700 text-white"
                                    }`}>
                                    {msg.role === "user" ? "👤" : "🏀"}
                                </div>

                                <div className={`max-w-[80%] flex flex-col gap-2 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                                    <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${msg.role === "user"
                                            ? "bg-orange-500 text-white rounded-tr-sm"
                                            : "bg-slate-800 text-slate-100 rounded-tl-sm border border-slate-700/50"
                                        }`}>
                                        {msg.content}
                                    </div>

                                    {msg.role === "assistant" && msg.id && (
                                        <div className="flex flex-col gap-2 w-full">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {msg.source_ref && (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                                        📖 {msg.source_ref}
                                                    </span>
                                                )}
                                                {msg.latency_ms && (
                                                    <span className="text-xs text-slate-500">⚡ {msg.latency_ms.toLocaleString()} ms</span>
                                                )}
                                            </div>

                                            {msg.confidence_score !== undefined && msg.confidence_score < CONFIDENCE_THRESHOLD && (
                                                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                                                    <span className="text-base">⚠️</span>
                                                    <div>
                                                        <p className="font-semibold">ความมั่นใจต่ำ</p>
                                                        <p className="text-red-400/80">
                                                            AI ไม่มั่นใจในคำตอบนี้ (Confidence: {(msg.confidence_score * 100).toFixed(0)}%) กรุณาตรวจสอบกับคู่มืออย่างเป็นทางการด้วย
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-slate-500">คำตอบถูกต้องไหม?</span>
                                                <button
                                                    onClick={() => msg.feedback === null ? handleFeedback(i, msg.id!, true) : undefined}
                                                    disabled={msg.feedback !== null && msg.feedback !== undefined}
                                                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-base transition-all duration-200
                            ${msg.feedback === "up" ? "bg-green-500 scale-110" : "bg-slate-700 hover:bg-green-500/30 hover:scale-110"}
                            ${msg.feedback !== null && msg.feedback !== undefined ? "cursor-default" : "cursor-pointer"}`}
                                                >👍</button>
                                                <button
                                                    onClick={() => msg.feedback === null ? handleFeedback(i, msg.id!, false) : undefined}
                                                    disabled={msg.feedback !== null && msg.feedback !== undefined}
                                                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-base transition-all duration-200
                            ${msg.feedback === "down" ? "bg-red-500 scale-110" : "bg-slate-700 hover:bg-red-500/30 hover:scale-110"}
                            ${msg.feedback !== null && msg.feedback !== undefined ? "cursor-default" : "cursor-pointer"}`}
                                                >👎</button>
                                                {msg.feedback && (
                                                    <span className="text-xs text-slate-500">
                                                        {msg.feedback === "up" ? "✅ บันทึกแล้ว" : "❌ บันทึกแล้ว"}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {isLoading && (
                            <div className="message-enter flex gap-3">
                                <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-lg">🏀</div>
                                <div className="bg-slate-800 border border-slate-700/50 px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1.5">
                                    <span className="typing-dot w-2 h-2 rounded-full bg-orange-400 inline-block"></span>
                                    <span className="typing-dot w-2 h-2 rounded-full bg-orange-400 inline-block"></span>
                                    <span className="typing-dot w-2 h-2 rounded-full bg-orange-400 inline-block"></span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                {/* Example questions (new chat only) */}
                {messages.length <= 1 && (
                    <div className="max-w-3xl mx-auto px-4 pb-2 w-full">
                        <p className="text-xs text-slate-500 mb-2">ตัวอย่างคำถาม:</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {EXAMPLE_QUESTIONS.map((q) => (
                                <button
                                    key={q}
                                    onClick={() => sendMessage(q)}
                                    className="text-left px-3 py-2 rounded-xl text-xs text-slate-300 bg-slate-800/60 border border-slate-700/50 hover:border-orange-500/50 hover:bg-slate-700/60 transition-all duration-200"
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Input */}
                <div className="border-t border-slate-800 bg-slate-950/80 backdrop-blur-sm flex-shrink-0">
                    <div className="max-w-3xl mx-auto px-4 py-4">
                        <div className="flex items-end gap-3 bg-slate-800 border border-slate-700/50 rounded-2xl px-4 py-3 focus-within:border-orange-500/50 transition-colors duration-200">
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="พิมพ์คำถามเกี่ยวกับกฎบาสเกตบอล... (Enter เพื่อส่ง)"
                                rows={1}
                                className="flex-1 bg-transparent text-slate-100 placeholder-slate-500 text-sm resize-none outline-none max-h-32 leading-relaxed"
                                style={{ scrollbarWidth: "none" }}
                                disabled={isLoading}
                            />
                            <button
                                onClick={() => sendMessage(input)}
                                disabled={!input.trim() || isLoading}
                                className="flex-shrink-0 w-9 h-9 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:bg-slate-700 disabled:cursor-not-allowed flex items-center justify-center text-white transition-all duration-200 hover:scale-105 active:scale-95"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                    <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                                </svg>
                            </button>
                        </div>
                        <p className="text-center text-xs text-slate-600 mt-2">
                            Referee-GPT อ้างอิงจากกฎบาสเกตบอล FIBA อย่างเป็นทางการ
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
