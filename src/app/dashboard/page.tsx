"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, QaLog } from "@/lib/supabase";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from "recharts";

type KPI = {
    total: number;
    avgLatency: number;
    accuracyRate: number;
    ratedCount: number;
};

type ChartPoint = {
    label: string;
    latency: number;
};

function KPICard({
    icon,
    title,
    value,
    sub,
    accent,
}: {
    icon: string;
    title: string;
    value: string;
    sub: string;
    accent: "orange" | "sky" | "emerald";
}) {
    const accentMap = {
        orange: "bg-white border-orange-100 shadow-[0_8px_30px_rgba(249,115,22,0.05)]",
        sky: "bg-white border-sky-100 shadow-[0_8px_30px_rgba(14,165,233,0.05)]",
        emerald: "bg-white border-emerald-100 shadow-[0_8px_30px_rgba(16,185,129,0.05)]",
    };
    const iconBg = {
        orange: "bg-gradient-to-br from-orange-400 to-orange-500 text-white shadow-orange-500/20",
        sky: "bg-gradient-to-br from-sky-400 to-sky-600 text-white shadow-sky-500/20",
        emerald: "bg-gradient-to-br from-emerald-400 to-emerald-500 text-white shadow-emerald-500/20",
    };
    return (
        <div className={`rounded-[2rem] p-6 border transition-all duration-300 hover:-translate-y-1 ${accentMap[accent]}`}>
            <div className="flex items-center gap-4 mb-5">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-md ${iconBg[accent]}`}>
                    {icon}
                </div>
                <div>
                    <p className="text-sm text-slate-500 font-medium">{title}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>
                </div>
            </div>
            <p className="text-4xl font-bold text-slate-800 tracking-tight">{value}</p>
        </div>
    );
}

export default function DashboardPage() {
    const router = useRouter();
    const [logs, setLogs] = useState<QaLog[]>([]);
    const [kpi, setKpi] = useState<KPI | null>(null);
    const [chartData, setChartData] = useState<ChartPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchData() {
            try {
                const { data, error } = await supabase
                    .from("qa_logs")
                    .select("*")
                    .order("created_at", { ascending: false })
                    .limit(50);

                if (error) throw error;

                const rows = (data as QaLog[]) || [];
                setLogs(rows);

                const total = rows.length;
                const avgLatency =
                    total > 0
                        ? Math.round(
                            rows.reduce((s, r) => s + (r.latency_ms ?? 0), 0) / total
                        )
                        : 0;

                const rated = rows.filter((r) => r.is_correct !== null);
                const correct = rated.filter((r) => r.is_correct === true);
                const accuracyRate =
                    rated.length > 0
                        ? Math.round((correct.length / rated.length) * 100)
                        : 0;

                setKpi({ total, avgLatency, accuracyRate, ratedCount: rated.length });

                const chartRows = [...rows].reverse().slice(-10);
                const points: ChartPoint[] = chartRows.map((r, i) => ({
                    label: `#${i + 1}`,
                    latency: r.latency_ms ?? 0,
                }));
                setChartData(points);
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
            } finally {
                setLoading(false);
            }
        }

        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-sky-600 font-medium text-sm tracking-wide">กำลังประมวลผลข้อมูล...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
                <div className="bg-white border text-center border-red-100 rounded-[2rem] p-8 max-w-md shadow-[0_8px_30px_rgba(239,68,68,0.06)]">
                    <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">⚠️</div>
                    <p className="text-slate-800 font-bold text-lg mb-2">ไม่สามารถโหลดข้อมูลได้</p>
                    <p className="text-slate-500 text-sm mb-6">{error}</p>
                    <button onClick={() => window.location.reload()} className="px-6 py-2.5 bg-sky-50 text-sky-600 rounded-xl text-sm font-semibold hover:bg-sky-100 transition-colors">
                        ลองใหม่อีกครั้ง
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">

            {/* ── Shared Navbar ── */}
            <header className="flex items-center justify-between px-6 h-14 bg-white border-b border-slate-200 z-20 shrink-0 sticky top-0">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">Z</div>
                    <h1 className="text-lg font-bold tracking-tight">
                        <span className="text-sky-600">Mr.Zebra</span><span className="text-orange-500">BKB</span>
                    </h1>
                </div>
                <nav className="flex items-center gap-1">
                    <button
                        onClick={() => router.push("/")}
                        className="px-4 py-1.5 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-50 transition-all"
                    >
                        💬 แชท
                    </button>
                    <button
                        className="px-4 py-1.5 rounded-lg text-sm font-medium text-sky-600 bg-sky-50 transition-all"
                    >
                        📊 แดชบอร์ด
                    </button>
                </nav>
            </header>

            {/* ── Page Content ── */}
            <div className="px-4 py-8 relative flex-1">
                {/* Background Decor */}
                <div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-b from-[#f0f5ff] to-transparent -z-10 pointer-events-none"></div>

                <div className="max-w-6xl mx-auto">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10 pl-2">
                        <div>
                            <h1 className="text-3xl font-bold text-slate-800 mb-2 tracking-tight">
                                ข้อมูลเชิงลึก <span className="text-sky-600">Mr.Zebra</span>
                                <span className="text-orange-500">BKB</span>
                            </h1>
                            <p className="text-slate-500 text-sm flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                อัปเดตล่าสุดเมื่อสักครู่ — {kpi?.total ?? 0} คำถามในระบบ
                            </p>
                        </div>
                        <div className="bg-white px-4 py-2 rounded-xl text-[13px] text-slate-500 border border-slate-100 shadow-sm flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-sky-500"><path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clipRule="evenodd" /></svg>
                            รีเฟรชอัตโนมัติทุก 30 วินาที
                        </div>
                    </div>

                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <KPICard
                            icon="💬"
                            title="จำนวนคำถามทั้งหมด"
                            value={`${kpi?.total ?? 0}`}
                            sub="หมวดหมู่: กฎบาสเกตบอล FIBA"
                            accent="orange"
                        />
                        <KPICard
                            icon="⚡"
                            title="ความเร็วในการตอบกลับ"
                            value={
                                kpi?.avgLatency
                                    ? `${(kpi.avgLatency / 1000).toFixed(1)}s`
                                    : "—"
                            }
                            sub={`เฉลี่ย ${kpi?.avgLatency?.toLocaleString() ?? 0} ms`}
                            accent="sky"
                        />
                        <KPICard
                            icon="🎯"
                            title="ความพึงพอใจโดยรวม"
                            value={kpi?.ratedCount ? `${kpi.accuracyRate}%` : "—"}
                            sub={
                                kpi?.ratedCount
                                    ? `ประเมินโดยผู้ใช้งาน ${kpi.ratedCount} ครั้ง`
                                    : "รอการประเมินจากผู้ใช้งาน"
                            }
                            accent="emerald"
                        />
                    </div>

                    {/* Main Content Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Activity Table */}
                        <div className="lg:col-span-2 space-y-4">
                            <h2 className="text-lg font-bold text-slate-800 pl-2">รายการถาม-ตอบล่าสุด</h2>

                            <div className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.03)] pb-2">
                                {logs.length === 0 ? (
                                    <div className="p-16 text-center">
                                        <div className="w-20 h-20 bg-sky-50 text-sky-300 rounded-full flex items-center justify-center text-4xl mx-auto mb-4">🏀</div>
                                        <p className="text-slate-800 font-medium mb-1">ยังไม่มีประวัติการถาม</p>
                                        <p className="text-slate-400 text-sm">เมื่อมีการถามคำถาม ข้อมูลจะแสดงที่นี่</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-[13px]">
                                            <thead>
                                                <tr className="border-b border-slate-100 text-left bg-slate-50/50">
                                                    <th className="px-6 py-4 text-slate-500 font-medium uppercase tracking-wider text-[11px]">กิจกรรม</th>
                                                    <th className="px-4 py-4 text-slate-500 font-medium uppercase tracking-wider text-[11px] w-32">ความมั่นใจ</th>
                                                    <th className="px-4 py-4 text-slate-500 font-medium uppercase tracking-wider text-[11px] w-24">เวลา</th>
                                                    <th className="px-6 py-4 text-slate-500 font-medium uppercase tracking-wider text-[11px] w-24 text-center">Feedback</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {logs.map((log) => (
                                                    <tr
                                                        key={log.id}
                                                        className="border-b border-slate-50 hover:bg-sky-50/30 transition-colors group"
                                                    >
                                                        <td className="px-6 py-4">
                                                            <p className="font-semibold text-slate-700 truncate max-w-xs sm:max-w-sm mb-1">{log.question}</p>
                                                            {log.source_ref ? (
                                                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-600">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 0 0 3 3.5v9A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 11.5 2h-7ZM4 3.5a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 .5.5v9a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5v-9Z" clipRule="evenodd" /></svg>
                                                                    {log.source_ref}
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-400 text-[11px]">ไม่มีข้อมูลอ้างอิง</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            {log.confidence_score !== null ? (
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                                        <div
                                                                            className={`h-full rounded-full ${(log.confidence_score ?? 0) >= 0.8 ? "bg-emerald-400" : (log.confidence_score ?? 0) >= 0.6 ? "bg-orange-400" : "bg-red-400"}`}
                                                                            style={{ width: `${(log.confidence_score ?? 0) * 100}%` }}
                                                                        ></div>
                                                                    </div>
                                                                    <span className="text-slate-600 font-medium">{((log.confidence_score ?? 0) * 100).toFixed(0)}%</span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-300">—</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-4 text-slate-500 font-medium font-mono">
                                                            {log.latency_ms ? `${(log.latency_ms / 1000).toFixed(1)}s` : "—"}
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            {log.is_correct === true ? (
                                                                <span className="inline-flex w-7 h-7 bg-emerald-50 text-emerald-500 rounded-full items-center justify-center shadow-sm" title="น่าพึงพอใจ">👍</span>
                                                            ) : log.is_correct === false ? (
                                                                <span className="inline-flex w-7 h-7 bg-red-50 text-red-500 rounded-full items-center justify-center shadow-sm" title="ควรปรับปรุง">👎</span>
                                                            ) : (
                                                                <span className="inline-block w-2 h-2 rounded-full bg-slate-200 group-hover:bg-sky-200 transition-colors" title="ยังไม่มีการประเมิน"></span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Latency Chart */}
                        <div className="space-y-4">
                            <h2 className="text-lg font-bold text-slate-800 pl-2">ความเสถียรของระบบ</h2>

                            <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.03)] h-fit sticky top-24">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-700">เวลาตอบสนอง</p>
                                        <p className="text-[11px] text-slate-400 mt-0.5">10 คำถามล่าสุด (ms)</p>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-11.25a.75.75 0 0 0-1.5 0v2.5h-2.5a.75.75 0 0 0 0 1.5h2.5v2.5a.75.75 0 0 0 1.5 0v-2.5h2.5a.75.75 0 0 0 0-1.5h-2.5v-2.5Z" clipRule="evenodd" /></svg>
                                    </div>
                                </div>

                                {chartData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={240}>
                                        <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                            <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                                            <YAxis
                                                tick={{ fill: "#94a3b8", fontSize: 10 }}
                                                axisLine={false}
                                                tickLine={false}
                                                tickFormatter={(v) => `${v}`}
                                            />
                                            <Tooltip
                                                cursor={{ fill: '#f8fafc' }}
                                                contentStyle={{
                                                    background: "rgba(255, 255, 255, 0.95)",
                                                    border: "none",
                                                    borderRadius: "16px",
                                                    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                                                    color: "#334155",
                                                    fontSize: "12px",
                                                    padding: "12px"
                                                }}
                                                itemStyle={{ color: "#f97316", fontWeight: 600 }}
                                                formatter={(v: number) => [`${v.toLocaleString()} ms`, "เวลา"]}
                                            />
                                            <Bar dataKey="latency" radius={[6, 6, 6, 6]}>
                                                {
                                                    chartData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.latency > 15000 ? "#fca5a5" : entry.latency > 5000 ? "#fbbf24" : "#38bdf8"} />
                                                    ))
                                                }
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-[240px] flex items-center justify-center flex-col text-slate-400">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 outline-slate-200 mb-2 opacity-50"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" /></svg>
                                        <span className="text-sm">ไม่มีข้อมูลกราฟแสดงผล</span>
                                    </div>
                                )}
                                <div className="mt-4 flex flex-col gap-2">
                                    <span className="inline-flex items-center gap-2 text-[11px] text-slate-500"><span className="w-2.5 h-2.5 rounded-full bg-sky-400"></span> ปกติ (เร็ว)</span>
                                    <span className="inline-flex items-center gap-2 text-[11px] text-slate-500"><span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span> ช้าเล็กน้อย ({'>'} 5s)</span>
                                    <span className="inline-flex items-center gap-2 text-[11px] text-slate-500"><span className="w-2.5 h-2.5 rounded-full bg-red-300"></span> ช้ามาก ({'>'} 15s)</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
