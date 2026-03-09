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

const STORAGE_KEY = "mrzebra_sessions_gs_thai";

const EXAMPLE_QUESTIONS = [
    "กฎ Traveling คืออะไร และนับ Gather Step อย่างไร?",
    "ถ้าผู้เล่นฝ่ายรับยืนในครึ่งวงกลมใต้แป้น แล้วถูกชนคือฟาวล์ประเภทไหน?",
    "กฎ 24 วินาที รีเซ็ตเป็นเท่าไหร่หลังบอลโดนห่วง?",
    "Technical Foul และ Unsportsmanlike Foul ต่างกันอย่างไร?",
];

const WELCOME_MESSAGE: Message = {
    role: "assistant",
    content:
        "สวัสดีครับ! ผม **Mr.Zebra** พร้อมเคลียร์ทุกข้อสงสัยตามกฎบาสเกตบอล FIBA ถามมาได้เลยครับ!",
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
    const [sessions, setSessions] = useState<Session[]>([]);
    const [currentId, setCurrentId] = useState<string>("");
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    
    // ── 🌟 State สำหรับ Navigation ──
    const [activeTab, setActiveTab] = useState<"chat" | "dashboard">("chat");

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
        if (activeTab === "chat") {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [sessions, currentId, isLoading, activeTab]);

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
        setActiveTab("chat");
        setTimeout(() => inputRef.current?.focus(), 100);
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
        } catch (err) {
            const errMsg: Message = { role: "assistant", content: "❌ ระบบขัดข้อง ลองใหม่อีกครั้งนะครับ!" };
            updateSession(currentId, (s) => ({ ...s, messages: [...s.messages, errMsg] }));
        } finally {
            setIsLoading(false);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    };

    const totalQueries = sessions.reduce((acc, s) => acc + s.messages.filter(m => m.role === "user").length, 0);

    return (
        <div className="flex h-screen bg-[#1D428A] text-white overflow-hidden font-sans">
            {/* ── Sidebar ── */}
            <aside className={`bg-[#1D428A] border-r border-[#FFC72C]/20 flex flex-col transition-all duration-500 ${sidebarOpen ? "w-80" : "w-0"}`}>
                <div className="p-6 flex-shrink-0">
                    <button 
                        onClick={startNewChat}
                        className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-[#FFC72C] text-[#1D428A] font-black text-sm shadow-lg hover:bg-[#ffcf4d] transition-all active:scale-95"
                    >
                        <span className="text-xl">+</span>
                        เปิดคอร์ทใหม่ (แชท)
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 space-y-2 custom-scrollbar">
                    <p className="px-3 text-[11px] text-[#FFC72C]/70 font-bold mb-2">ประวัติการพูดคุย</p>
                    {sessions.map((s) => (
                        <div key={s.id} className="relative">
                            <button
                                onClick={() => { 
                                    setCurrentId(s.id); 
                                    setActiveTab("chat");
                                }}
                                className={`w-full text-left p-4 rounded-xl transition-all border ${
                                    s.id === currentId && activeTab === "chat"
                                    ? "bg-[#264f9c] border-[#FFC72C]/50 shadow-md" 
                                    : "border-transparent hover:bg-[#264f9c]/50"
                                }`}
                            >
                                <p className={`text-sm font-bold truncate ${s.id === currentId && activeTab === "chat" ? "text-[#FFC72C]" : "text-white/70"}`}>🏀 {s.title}</p>
                                <p className="text-[10px] text-white/40 mt-1 font-mono">{formatDate(s.created_at)}</p>
                            </button>
                        </div>
                    ))}
                </div>
                
                {/* Zebra Stripes Accent */}
                <div className="h-2 w-full flex">
                    {[...Array(12)].map((_, i) => (
                        <div key={i} className={`flex-1 h-full ${i % 2 === 0 ? "bg-[#FFC72C]" : "bg-[#1D428A]"}`} />
                    ))}
                </div>
            </aside>

            {/* ── Main Area ── */}
            <main className="flex-1 flex flex-col bg-[#f0f0f0] relative">
                
                {/* 🌟 Top Navigation Bar 🌟 */}
                <header className="flex items-center justify-between px-8 py-0 h-16 bg-[#1D428A] border-b-4 border-[#FFC72C] z-20 shadow-xl shrink-0">
                    <div className="flex items-center gap-4 h-full">
                        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                            <svg className="w-6 h-6 text-[#FFC72C]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
                        </button>
                        <div className="flex items-center gap-3">
                            <h1 className="text-xl font-black tracking-tighter text-white italic">Mr.Zebra</h1>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <nav className="flex h-full">
                        <button 
                            onClick={() => setActiveTab("chat")} 
                            className={`px-6 h-full flex items-center text-sm font-bold transition-all border-b-4 ${
                                activeTab === "chat" 
                                ? "border-[#FFC72C] text-[#FFC72C] bg-white/5" 
                                : "border-transparent text-white/50 hover:text-white/80 hover:bg-white/5"
                            }`}
                        >
                            สนามแชท
                        </button>
                        <button 
                            onClick={() => setActiveTab("dashboard")} 
                            className={`px-6 h-full flex items-center text-sm font-bold transition-all border-b-4 ${
                                activeTab === "dashboard" 
                                ? "border-[#FFC72C] text-[#FFC72C] bg-white/5" 
                                : "border-transparent text-white/50 hover:text-white/80 hover:bg-white/5"
                            }`}
                        >
                            หน้าสถิติ
                        </button>
                    </nav>
                </header>

                {/* ── 🗣️ หน้า Chat ── */}
                {activeTab === "chat" && (
                    <>
                        <div className="flex-1 overflow-y-auto custom-scrollbar-light bg-slate-100">
                            <div className="max-w-4xl mx-auto p-8 space-y-6">
                                {messages.map((msg, i) => (
                                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                        <div className={`flex gap-3 max-w-[85%] ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0 shadow-md border-2 ${
                                                msg.role === "user" ? "bg-[#1D428A] border-[#FFC72C] text-white" : "bg-[#FFC72C] border-[#1D428A] text-[#1D428A]"
                                            }`}>
                                                {msg.role === "user" ? "🏀" : "🦓"}
                                            </div>
                                            <div className={`space-y-1 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                                                <div className={`px-5 py-3 rounded-2xl text-[15px] shadow-sm font-medium ${
                                                    msg.role === "user" 
                                                    ? "bg-[#1D428A] text-white rounded-tr-none" 
                                                    : "bg-white text-[#1D428A] border-l-4 border-[#FFC72C] rounded-tl-none"
                                                }`}>
                                                    {msg.content}
                                                </div>
                                                {msg.source_ref && (
                                                    <span className="text-[10px] font-bold text-[#1D428A]/50 px-2">อ้างอิง: {msg.source_ref}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {isLoading && (
                                    <div className="flex justify-start">
                                        <div className="w-10 h-10 rounded-full bg-[#FFC72C] border-2 border-[#1D428A] flex items-center justify-center animate-bounce text-xl">🦓</div>
                                        <div className="ml-3 bg-white px-6 py-4 rounded-2xl rounded-tl-none shadow-sm flex gap-1 items-center">
                                            <div className="w-2 h-2 bg-[#1D428A] rounded-full animate-bounce" />
                                            <div className="w-2 h-2 bg-[#1D428A] rounded-full animate-bounce [animation-delay:0.2s]" />
                                            <div className="w-2 h-2 bg-[#1D428A] rounded-full animate-bounce [animation-delay:0.4s]" />
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                        </div>

                        {/* Input Area */}
                        <div className="p-8 bg-slate-100 shrink-0">
                            <div className="max-w-4xl mx-auto">
                                <div className="relative flex items-center p-1 bg-white border-2 border-[#1D428A] rounded-2xl shadow-xl focus-within:ring-4 focus-within:ring-[#FFC72C]/30 transition-all">
                                    <textarea
                                        ref={inputRef}
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage(input))}
                                        placeholder="ถามคำถามเกี่ยวกับกฎบาสเกตบอลที่นี่..."
                                        rows={1}
                                        className="flex-1 bg-transparent px-6 py-4 text-sm font-bold outline-none resize-none placeholder:text-[#1D428A]/40 text-[#1D428A]"
                                    />
                                    <button
                                        onClick={() => sendMessage(input)}
                                        disabled={!input.trim() || isLoading}
                                        className="w-14 h-14 rounded-xl bg-[#1D428A] text-[#FFC72C] flex items-center justify-center hover:bg-[#264f9c] disabled:opacity-20 transition-all shadow-lg shadow-[#1D428A]/20"
                                    >
                                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>
                                    </button>
                                </div>
                                <div className="flex justify-between items-center mt-4 px-2">
                                    <p className="text-[11px] text-[#1D428A]/50 font-bold">บอทผู้ช่วย Mr.Zebra อย่างเป็นทางการ</p>
                                    <p className="text-[11px] text-[#1D428A]/50 font-bold">อ้างอิงกฎ FIBA ล่าสุด</p>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* ── 📊 หน้า Dashboard ── */}
                {activeTab === "dashboard" && (
                    <div className="flex-1 overflow-y-auto bg-slate-100 p-8 custom-scrollbar-light">
                        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-500">
                            
                            <h2 className="text-2xl font-black text-[#1D428A] border-l-8 border-[#FFC72C] pl-4">
                                สถิติภาพรวมประจำฤดูกาล
                            </h2>

                            {/* Top Stat Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-white p-6 rounded-3xl shadow-lg border-t-8 border-[#1D428A]">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-xl">🏀</span>
                                        <p className="text-sm text-[#1D428A]/70 font-bold">เข้าใช้งานทั้งหมด (ครั้ง)</p>
                                    </div>
                                    <p className="text-5xl font-black text-[#1D428A]">{sessions.length}</p>
                                </div>
                                
                                <div className="bg-white p-6 rounded-3xl shadow-lg border-t-8 border-[#FFC72C]">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-xl">❓</span>
                                        <p className="text-sm text-[#1D428A]/70 font-bold">ถามคำถามทั้งหมด (ข้อ)</p>
                                    </div>
                                    <p className="text-5xl font-black text-[#1D428A]">{totalQueries}</p>
                                </div>

                                <div className="bg-gradient-to-br from-[#1D428A] to-[#0c2a63] p-6 rounded-3xl shadow-lg border-t-8 border-[#FFC72C] text-white relative overflow-hidden">
                                    <div className="relative z-10">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-xl">🎯</span>
                                            <p className="text-sm text-white/80 font-bold">ความแม่นยำของ AI</p>
                                        </div>
                                        <p className="text-5xl font-black text-[#FFC72C]">99.9%</p>
                                    </div>
                                    <div className="absolute -bottom-6 -right-6 text-9xl opacity-10">🦓</div>
                                </div>
                            </div>

                            {/* Chart Area */}
                            <div className="bg-white p-8 rounded-3xl shadow-lg border border-[#1D428A]/10">
                                <h3 className="text-xl font-black text-[#1D428A] mb-8">สัดส่วนหมวดหมู่คำถาม (จำลองข้อมูล)</h3>
                                
                                <div className="space-y-8">
                                    {/* Bar 1 */}
                                    <div>
                                        <div className="flex justify-between text-sm font-bold text-[#1D428A] mb-3">
                                            <span>การฟาวล์และบทลงโทษ</span>
                                            <span className="text-[#FFC72C] text-lg">45%</span>
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden shadow-inner">
                                            <div className="bg-[#1D428A] h-full rounded-full transition-all duration-1000 ease-out" style={{ width: '45%' }}></div>
                                        </div>
                                    </div>

                                    {/* Bar 2 */}
                                    <div>
                                        <div className="flex justify-between text-sm font-bold text-[#1D428A] mb-3">
                                            <span>การผิดระเบียบ (ทราเวลลิ่ง, ดับเบิ้ลเดาะ)</span>
                                            <span className="text-[#FFC72C] text-lg">35%</span>
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden shadow-inner">
                                            <div className="bg-[#FFC72C] h-full rounded-full transition-all duration-1000 ease-out delay-100" style={{ width: '35%' }}></div>
                                        </div>
                                    </div>

                                    {/* Bar 3 */}
                                    <div>
                                        <div className="flex justify-between text-sm font-bold text-[#1D428A] mb-3">
                                            <span>เรื่องเวลาและขนาดสนาม</span>
                                            <span className="text-[#FFC72C] text-lg">20%</span>
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden shadow-inner">
                                            <div className="bg-[#4a7ecf] h-full rounded-full transition-all duration-1000 ease-out delay-200" style={{ width: '20%' }}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <p className="text-center text-xs text-[#1D428A]/50 font-bold mt-8">
                                ดึงข้อมูลจากตัวเครื่อง • ระบบสถิติ Mr.Zebra อย่างเป็นทางการ
                            </p>
                        </div>
                    </div>
                )}
            </main>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #FFC72C; border-radius: 10px; }
                .custom-scrollbar-light::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar-light::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar-light::-webkit-scrollbar-thumb { background: #1D428A20; border-radius: 10px; }
                .custom-scrollbar-light::-webkit-scrollbar-thumb:hover { background: #1D428A40; }
            `}</style>
        </div>
    );
}