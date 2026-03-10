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
        "สวัสดีครับ! ผม Mr.ZebraBKB ผู้เชี่ยวชาญกฎบาสเกตบอล 🦓 ถามกฎข้อไหนก็ได้ครับ ผมจะตอบพร้อมอ้างอิงข้อกฎทุกครั้งอย่างแม่นยำ",
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
        <div className="flex h-[calc(100vh-64px)] bg-[#fbfcfd] overflow-hidden">
            {/* ── Sidebar ─────────────────────────────────────────────────────── */}
            <aside
                className={`flex-shrink-0 flex flex-col bg-white border-r border-slate-100/80 shadow-[4px_0_24px_rgba(0,0,0,0.01)] transition-all duration-300 z-10 ${sidebarOpen ? "w-80" : "w-0"} overflow-hidden`}
            >
                {/* Sidebar header */}
                <div className="p-5 flex-shrink-0">
                    <button
                        onClick={startNewChat}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-sky-50 hover:bg-sky-100 text-sky-700 font-semibold transition-all duration-300 hover:shadow-sm"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                            <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
                        </svg>
                        เริ่มการสนทนาใหม่
                    </button>
                </div>

                {/* Session list */}
                <div className="flex-1 overflow-y-auto px-3 pb-4">
                    <h3 className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">ประวัติการพูดคุย</h3>
                    {sessions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-32 text-center">
                            <span className="text-2xl mb-2 opacity-30">🗂️</span>
                            <p className="text-slate-400 text-sm">ยังไม่มีประวัติ</p>
                        </div>
                    ) : (
                        sessions.map((s) => (
                            <div
                                key={s.id}
                                className={`group relative mb-1.5 rounded-2xl overflow-hidden transition-all duration-300 ${s.id === currentId
                                    ? "bg-white shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-sky-100/50"
                                    : "hover:bg-slate-50 border border-transparent"
                                    }`}
                            >
                                <button
                                    onClick={() => { setCurrentId(s.id); setDeleteConfirm(null); }}
                                    className="w-full text-left px-4 py-3 pr-10"
                                >
                                    <p className={`text-sm font-medium truncate leading-snug transition-colors ${s.id === currentId ? "text-sky-700" : "text-slate-600"}`}>
                                        {s.title}
                                    </p>
                                    <p className="text-[11px] text-slate-400 mt-1">
                                        {formatDate(s.created_at)}
                                    </p>
                                </button>

                                {deleteConfirm === s.id ? (
                                    <div className="absolute right-0 top-0 bottom-0 flex items-center bg-white/95 backdrop-blur-sm px-3 gap-2">
                                        <button onClick={() => deleteSession(s.id)} className="w-7 h-7 flex items-center justify-center rounded-full bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-colors"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5a.75.75 0 0 1 .786-.711Z" clipRule="evenodd" /></svg></button>
                                        <button onClick={() => setDeleteConfirm(null)} className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" /></svg></button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm(s.id); }}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all p-1.5 text-slate-300 hover:text-red-400 hover:bg-red-50 rounded-full"
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
            </aside>

            {/* ── Chat Area ────────────────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col min-w-0 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-[#f8faff]/90 to-[#f0f5ff]/90 -z-10"></div>

                {/* Topbar */}
                <div className="flex items-center px-4 py-3 bg-white/50 backdrop-blur-md border-b border-white/40 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex-shrink-0 z-10 sticky top-0">
                    <button
                        onClick={() => setSidebarOpen((v) => !v)}
                        className="p-2 rounded-xl text-slate-400 hover:text-sky-600 hover:bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-300 mr-4 bg-white/50"
                        title={sidebarOpen ? "ซ่อนประวัติ" : "แสดงประวัติ"}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
                        </svg>
                    </button>
                    {currentSession && (
                        <div className="font-medium text-slate-700 truncate">{currentSession.title}</div>
                    )}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-8 relative">
                    <div className="max-w-3xl mx-auto space-y-8">
                        {messages.map((msg, i) => (
                            <div
                                key={i}
                                className={`message-enter flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                            >
                                {/* Avatar */}
                                <div className={`flex-shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center text-lg shadow-sm ${msg.role === "user"
                                    ? "bg-gradient-to-br from-orange-400 to-orange-500 text-white"
                                    : "bg-gradient-to-br from-sky-400 to-sky-600 text-white"
                                    }`}>
                                    {msg.role === "user" ? "👤" : "🦓"}
                                </div>

                                <div className={`max-w-[80%] flex flex-col gap-2 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                                    {/* Bubble */}
                                    <div className={`px-5 py-3.5 text-[15px] leading-relaxed shadow-sm ${msg.role === "user"
                                        ? "bg-gradient-to-r from-orange-400 to-orange-500 text-white rounded-3xl rounded-tr-sm"
                                        : "bg-white text-slate-700 rounded-3xl rounded-tl-sm border border-slate-100"
                                        }`}>
                                        {msg.content}
                                    </div>

                                    {/* Metadata (AI only) */}
                                    {msg.role === "assistant" && msg.id && (
                                        <div className="flex flex-col gap-2 w-full pl-2">
                                            <div className="flex items-center gap-3 flex-wrap">
                                                {msg.source_ref && (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-600 border border-sky-100/50">
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 0 0 3 3.5v9A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 11.5 2h-7ZM4 3.5a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 .5.5v9a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5v-9Z" clipRule="evenodd" /></svg>
                                                        {msg.source_ref}
                                                    </span>
                                                )}
                                                {msg.latency_ms && (
                                                    <span className="text-xs text-slate-400 flex items-center gap-1">
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M11.986 3H12a2 2 0 0 1 2 2v6a2 2 0 0 1-1.5 1.937V7A2.5 2.5 0 0 0 10 4.5H4.063A2 2 0 0 1 6 3h.014A2.25 2.25 0 0 1 8.25 1h1.5a2.25 2.25 0 0 1 2.236 2ZM10.5 4v-.75a.75.75 0 0 0-.75-.75h-1.5a.75.75 0 0 0-.75.75V4h3Z" clipRule="evenodd" /><path fillRule="evenodd" d="M3 6a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H3Zm1.75 2.5a.75.75 0 0 0 0 1.5h3.5a.75.75 0 0 0 0-1.5h-3.5ZM4 11.75a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 0 1.5h-3.5a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" /></svg>
                                                        {msg.latency_ms.toLocaleString()} ms
                                                    </span>
                                                )}
                                            </div>

                                            {msg.confidence_score !== undefined && msg.confidence_score < CONFIDENCE_THRESHOLD && (
                                                <div className="flex items-start gap-3 px-4 py-3 mt-1 rounded-2xl bg-orange-50 border border-orange-100/50 text-orange-700 text-sm max-w-sm">
                                                    <span className="text-lg">⚠️</span>
                                                    <div>
                                                        <p className="font-bold text-orange-800 mb-0.5">ความมั่นใจของ AI ต่ำ</p>
                                                        <p className="text-xs opacity-80 leading-relaxed">
                                                            คำตอบนี้อาจไม่แม่นยำ 100% (Confidence: {(msg.confidence_score * 100).toFixed(0)}%) แนะนำให้ตรวจสอบกับคู่มือ FIBA อีกครั้ง
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex items-center gap-1.5 mt-1">
                                                <span className="text-xs text-slate-400 mr-2">คำตอบนี้มีประโยชน์หรือไม่?</span>

                                                <button
                                                    onClick={() => msg.feedback === null ? handleFeedback(i, msg.id!, true) : undefined}
                                                    disabled={msg.feedback !== null && msg.feedback !== undefined}
                                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all duration-300
                            ${msg.feedback === "up" ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20" : "bg-white border border-slate-200 text-slate-400 hover:border-emerald-500 hover:text-emerald-500"}
                            ${msg.feedback !== null && msg.feedback !== undefined ? "cursor-default scale-110" : "cursor-pointer"}`}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M1 8.25a1.25 1.25 0 1 1 2.5 0v7.5a1.25 1.25 0 1 1-2.5 0v-7.5ZM11 3V1.7c0-.268.14-.526.395-.607A2 2 0 0 1 14 3c0 .995-.182 1.948-.514 2.826-.204.54.166 1.09.72 1.09h2.38c1.39 0 2.219 1.483 1.554 2.651l-1.42 2.488a5.353 5.353 0 0 1-1.444 1.637A5.968 5.968 0 0 1 11.237 15H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2Z" /></svg>
                                                </button>

                                                <button
                                                    onClick={() => msg.feedback === null ? handleFeedback(i, msg.id!, false) : undefined}
                                                    disabled={msg.feedback !== null && msg.feedback !== undefined}
                                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all duration-300
                            ${msg.feedback === "down" ? "bg-red-500 text-white shadow-md shadow-red-500/20" : "bg-white border border-slate-200 text-slate-400 hover:border-red-500 hover:text-red-500"}
                            ${msg.feedback !== null && msg.feedback !== undefined ? "cursor-default scale-110" : "cursor-pointer"}`}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M1 11.75a1.25 1.25 0 1 0 2.5 0v-7.5a1.25 1.25 0 1 0-2.5 0v7.5Zm10-8.75V4.3c0 .268.14.526.395.607A2 2 0 0 0 14 4c0-.995-.182-1.948-.514-2.826-.204-.54.166-1.09.72-1.09h2.38c1.39 0 2.219-1.483 1.554-2.651l-1.42-2.488a5.353 5.353 0 0 0-1.444-1.637A5.968 5.968 0 0 0 11.237 2H9a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2Z" /></svg>
                                                </button>
                                                {msg.feedback && (
                                                    <span className="text-[11px] font-medium ml-2 text-slate-400">
                                                        ขอบคุณสำหรับคำติชม
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {isLoading && (
                            <div className="message-enter flex gap-4">
                                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-400 to-sky-600 text-white flex items-center justify-center text-lg shadow-sm">🦓</div>
                                <div className="bg-white border border-slate-100 shadow-sm px-5 py-4 rounded-3xl rounded-tl-sm flex items-center gap-2">
                                    <span className="typing-dot w-2 h-2 rounded-full bg-sky-400 inline-block"></span>
                                    <span className="typing-dot w-2 h-2 rounded-full bg-sky-400 inline-block"></span>
                                    <span className="typing-dot w-2 h-2 rounded-full bg-orange-400 inline-block"></span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                {/* Example questions (new chat only) */}
                {messages.length <= 1 && (
                    <div className="max-w-3xl mx-auto px-4 pb-4 w-full relative z-10">
                        <div className="flex items-center gap-2 mb-3 px-1">
                            <span className="text-xl">💡</span>
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">ลองถามคำถามเหล่านี้</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {EXAMPLE_QUESTIONS.map((q) => (
                                <button
                                    key={q}
                                    onClick={() => sendMessage(q)}
                                    className="text-left px-5 py-3.5 rounded-2xl text-[13px] text-slate-600 bg-white/80 backdrop-blur-md border border-white hover:border-sky-200 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:bg-white hover:-translate-y-0.5 transition-all duration-300"
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Input Area */}
                <div className="bg-gradient-to-t from-[#f0f5ff] via-[#f0f5ff] to-transparent pt-8 pb-6 px-4 z-20">
                    <div className="max-w-3xl mx-auto">
                        <div className="bg-white rounded-[2rem] p-2 pr-3 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/80 flex items-end gap-3 focus-within:shadow-[0_8px_30px_rgba(14,165,233,0.1)] focus-within:border-sky-200 transition-all duration-300">
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="พิมพ์ข้อสงสัยหรือถามกฎบาสเกตบอลได้ที่นี่..."
                                rows={1}
                                className="flex-1 bg-transparent text-slate-800 placeholder-slate-400 text-[15px] resize-none outline-none max-h-32 leading-relaxed py-3.5 pl-5"
                                style={{ scrollbarWidth: "none" }}
                                disabled={isLoading}
                            />
                            <button
                                onClick={() => sendMessage(input)}
                                disabled={!input.trim() || isLoading}
                                className="flex-shrink-0 w-12 h-12 mb-0.5 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 disabled:from-slate-100 disabled:to-slate-100 disabled:text-slate-300 disabled:cursor-not-allowed flex items-center justify-center text-white transition-all duration-300 hover:scale-[1.05] active:scale-95 shadow-md shadow-orange-500/20 disabled:shadow-none"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 ml-0.5">
                                    <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                                </svg>
                            </button>
                        </div>
                        <p className="text-center text-[11px] text-slate-400 mt-4 font-medium tracking-wide">
                            AI อ้างอิงข้อมูลจาก <span className="text-sky-600">กฎบาสเกตบอล FIBA อย่างเป็นทางการ</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
