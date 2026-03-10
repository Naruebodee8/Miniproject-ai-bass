"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

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

const STORAGE_KEY = "mrzebra_sessions_gs_pill_colors";
const CONFIDENCE_THRESHOLD = 0.6;

const EXAMPLE_QUESTIONS = [
    "กฎ Traveling คืออะไร และนับ Gather Step อย่างไร?",
    "ถ้าผู้เล่นฝ่ายรับยืนในครึ่งวงกลมใต้แป้น แล้วถูกชนคือฟาวล์ประเภทไหน?",
    "กฎ 24 วินาที รีเซ็ตเป็นเท่าไหร่หลังบอลโดนห่วง?",
    "Technical Foul และ Unsportsmanlike Foul ต่างกันอย่างไร?",
];

const WELCOME_MESSAGE: Message = {
    role: "assistant",
    content:
        "สวัสดีครับ! ผม **Mr.ZebraBKB** ผู้เชี่ยวชาญกฎบาสเกตบอล 🏀 ถามกฎข้อไหนก็ได้ครับ ผมจะตอบพร้อมอ้างอิงอิงข้อกฎทุกครั้งอย่างแม่นยำ",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function loadSessions(): Session[] {
    if (typeof window === "undefined") return [];
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch { return []; }
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
    return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ChatPage() {
    const router = useRouter();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [currentId, setCurrentId] = useState<string>("");
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

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

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [sessions, currentId, isLoading]);

    const currentSession = sessions.find((s) => s.id === currentId);
    const messages = currentSession?.messages ?? [WELCOME_MESSAGE];

    const updateSession = useCallback((id: string, updater: (s: Session) => Session) => {
        setSessions((prev) => {
            const next = prev.map((s) => (s.id === id ? updater(s) : s));
            saveSessions(next);
            return next;
        });
    }, []);

    const startNewChat = () => {
        const s = createSession();
        setSessions((prev) => {
            const next = [s, ...prev];
            saveSessions(next);
            return next;
        });
        setCurrentId(s.id);
        setInput("");
        setDeleteConfirm(null);
        setTimeout(() => inputRef.current?.focus(), 100);
    };

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

    const handleFeedback = async (msgIndex: number, id: string, is_correct: boolean) => {
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

    const sendMessage = async (question: string) => {
        if (!question.trim() || isLoading || !currentId) return;
        const userMsg: Message = { role: "user", content: question };
        setInput("");
        setIsLoading(true);

        updateSession(currentId, (s) => ({
            ...s,
            title: s.title === "การสนทนาใหม่" ? question.slice(0, 30) : s.title,
            messages: [...s.messages, userMsg],
        }));

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question }),
            });
            const data = await res.json();
            const aiMsg: Message = {
                role: "assistant",
                content: data.answer,
                id: data.id,
                source_ref: data.source_ref,
                confidence_score: data.confidence_score,
                latency_ms: data.latency_ms,
                feedback: null,
            };
            updateSession(currentId, (s) => ({ ...s, messages: [...s.messages, aiMsg] }));
        } catch {
            const errMsg: Message = { role: "assistant", content: "❌ ระบบขัดข้อง ลองใหม่อีกครั้งนะครับ!" };
            updateSession(currentId, (s) => ({ ...s, messages: [...s.messages, errMsg] }));
        } finally {
            setIsLoading(false);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    };

    return (
        <div className="flex h-screen bg-white text-slate-800 overflow-hidden font-sans">

            {/* ── Sidebar ── */}
            <aside className={`bg-white border-r border-slate-200 flex flex-col transition-all duration-300 shrink-0 ${sidebarOpen ? "w-72" : "w-0 overflow-hidden"}`}>
                <div className="p-4 flex-shrink-0 border-b border-slate-100">
                    <button
                        onClick={startNewChat}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 font-semibold text-sm hover:bg-slate-200 transition-all active:scale-95"
                    >
                        <span className="text-base">+</span>
                        เริ่มการสนทนาใหม่
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1 custom-scrollbar">
                    <p className="px-3 text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-2">ประวัติการพูดคุย</p>
                    {sessions.map((s) => (
                        <div key={s.id} className="relative group">
                            <button
                                onClick={() => {
                                    setCurrentId(s.id);
                                    setDeleteConfirm(null);
                                }}
                                className={`w-full text-left px-3 py-3 pr-10 rounded-xl transition-all ${s.id === currentId
                                    ? "bg-sky-50 text-sky-700"
                                    : "text-slate-600 hover:bg-slate-50"
                                    }`}
                            >
                                <p className={`text-sm font-medium truncate`}>{s.title}</p>
                                <p className="text-[11px] text-slate-400 mt-0.5">{formatDate(s.created_at)}</p>
                            </button>

                            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 z-20">
                                {deleteConfirm === s.id ? (
                                    <div className="flex items-center gap-1 bg-white border border-red-200 rounded-lg p-1 shadow-md">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                                            className="text-[10px] bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 transition-colors"
                                        >
                                            ลบ
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setDeleteConfirm(null); }}
                                            className="text-[10px] text-slate-500 hover:text-slate-700 px-1"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm(s.id); }}
                                        className="p-1.5 text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all rounded-lg hover:bg-red-50"
                                        title="ลบแชท"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" /></svg>
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </aside>

            {/* ── Main Area ── */}
            <main className="flex-1 flex flex-col bg-white relative min-w-0">

                {/* Top Navigation Bar */}
                <header className="flex items-center justify-between px-6 h-14 bg-white border-b border-slate-200 z-20 shrink-0">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
                        </button>
                        {/* Logo */}
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">Z</div>
                            <h1 className="text-lg font-bold tracking-tight">
                                <span className="text-sky-600">Mr.Zebra</span><span className="text-orange-500">BKB</span>
                            </h1>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <nav className="flex items-center gap-1">
                        <button
                            className="px-4 py-1.5 rounded-lg text-sm font-medium text-sky-600 bg-sky-50 transition-all"
                        >
                            💬 แชท
                        </button>
                        <button
                            onClick={() => router.push("/dashboard")}
                            className="px-4 py-1.5 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-50 transition-all"
                        >
                            📊 แดชบอร์ด
                        </button>
                    </nav>
                </header>

                {/* ── Chat Messages ── */}
                <div className="flex-1 overflow-y-auto custom-scrollbar-light bg-slate-50">
                    <div className="max-w-3xl mx-auto p-6 space-y-5">

                        {/* Show example questions if only welcome message */}
                        {messages.length === 1 && messages[0].role === "assistant" && (
                            <div className="mb-6">
                                <div className="flex gap-3 justify-start">
                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm">Z</div>
                                    <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm max-w-[80%]">
                                        <p className="text-sm text-slate-700 leading-relaxed">{messages[0].content}</p>
                                    </div>
                                </div>

                                <div className="mt-6 ml-12">
                                    <p className="text-xs text-slate-400 font-medium mb-3 flex items-center gap-1.5">
                                        <span>💡</span> ลองถามคำถามเหล่านี้
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {EXAMPLE_QUESTIONS.map((q, i) => (
                                            <button
                                                key={i}
                                                onClick={() => sendMessage(q)}
                                                className="text-left text-sm text-slate-600 bg-white border border-slate-200 rounded-xl px-4 py-3 hover:border-sky-300 hover:text-sky-700 hover:bg-sky-50 transition-all shadow-sm"
                                            >
                                                {q}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Messages (skip first welcome if already shown above) */}
                        {(messages.length > 1 ? messages : []).map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} gap-3`}>
                                {msg.role === "assistant" && (
                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm mt-0.5">Z</div>
                                )}
                                <div className={`flex flex-col gap-1.5 max-w-[78%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
                                    <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.role === "user"
                                        ? "bg-slate-800 text-white rounded-br-sm"
                                        : "bg-white border border-slate-200 text-slate-700 rounded-bl-sm"
                                        }`}>
                                        {msg.content}
                                    </div>

                                    {/* Confidence warning */}
                                    {msg.role === "assistant" && msg.confidence_score !== undefined && msg.confidence_score < CONFIDENCE_THRESHOLD && (
                                        <div className="flex items-start gap-2 bg-red-50 border border-red-200 px-3 py-2 rounded-xl max-w-sm text-xs">
                                            <span>⚠️</span>
                                            <p className="text-red-600">
                                                AI ไม่มั่นใจในคำตอบนี้ (Confidence: {(msg.confidence_score * 100).toFixed(0)}%) โปรดตรวจสอบจาก FIBA อีกครั้ง
                                            </p>
                                        </div>
                                    )}

                                    {/* Source ref & feedback */}
                                    {msg.role === "assistant" && (
                                        <div className="flex flex-wrap items-center gap-2 px-1">
                                            {msg.source_ref && (
                                                <span className="text-[11px] text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                                                    📖 {msg.source_ref}
                                                </span>
                                            )}
                                            {msg.id && (
                                                <div className="flex items-center gap-1 ml-auto">
                                                    <button
                                                        onClick={() => msg.feedback === null ? handleFeedback(i, msg.id!, true) : undefined}
                                                        disabled={msg.feedback !== null}
                                                        className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs transition-all ${msg.feedback === "up" ? "bg-emerald-100 text-emerald-600" : "bg-white border border-slate-200 text-slate-400 hover:border-emerald-300 hover:text-emerald-500"} ${msg.feedback !== null ? "cursor-default" : "cursor-pointer"}`}
                                                    >👍</button>
                                                    <button
                                                        onClick={() => msg.feedback === null ? handleFeedback(i, msg.id!, false) : undefined}
                                                        disabled={msg.feedback !== null}
                                                        className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs transition-all ${msg.feedback === "down" ? "bg-red-100 text-red-500" : "bg-white border border-slate-200 text-slate-400 hover:border-red-300 hover:text-red-500"} ${msg.feedback !== null ? "cursor-default" : "cursor-pointer"}`}
                                                    >👎</button>
                                                    {msg.feedback && (
                                                        <span className="text-[10px] text-slate-400 ml-0.5">ขอบคุณ</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                {msg.role === "user" && (
                                    <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-sm font-bold shrink-0 mt-0.5">N</div>
                                )}
                            </div>
                        ))}

                        {isLoading && (
                            <div className="flex justify-start gap-3">
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-white text-sm font-bold shrink-0">Z</div>
                                <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm flex gap-1.5 items-center">
                                    <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" />
                                    <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce [animation-delay:0.2s]" />
                                    <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce [animation-delay:0.4s]" />
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white border-t border-slate-200 shrink-0">
                    <div className="max-w-3xl mx-auto">
                        <div className="relative flex items-center gap-2 bg-white border border-slate-300 rounded-2xl shadow-sm focus-within:ring-2 focus-within:ring-sky-300 focus-within:border-sky-300 transition-all p-1">
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage(input))}
                                placeholder="ป้อนคำถาม..."
                                rows={1}
                                className="flex-1 bg-transparent px-4 py-3 text-sm outline-none resize-none placeholder:text-slate-400 text-slate-800"
                            />
                            <button
                                onClick={() => sendMessage(input)}
                                disabled={!input.trim() || isLoading}
                                className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600 disabled:opacity-30 transition-all shadow-sm shrink-0"
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>
                            </button>
                        </div>
                        <p className="text-center text-[11px] text-slate-400 mt-2">
                            AI วิเคราะห์ข้อมูลจาก <span className="text-sky-500 font-medium">กฎบาสเกตบอล FIBA</span> อย่างเป็นทางการ
                        </p>
                    </div>
                </div>
            </main>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                .custom-scrollbar-light::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar-light::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar-light::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                .custom-scrollbar-light::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
            `}</style>
        </div>
    );
}