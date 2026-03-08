"use client";

import { useEffect, useState } from "react";
import { supabase, QaLog } from "@/lib/supabase";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
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
    color,
}: {
    icon: string;
    title: string;
    value: string;
    sub: string;
    color: string;
}) {
    return (
        <div
            className={`bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 hover:border-${color}-500/40 transition-all duration-300`}
        >
            <div className="flex items-center gap-3 mb-4">
                <div
                    className={`w-10 h-10 rounded-xl bg-${color}-500/20 flex items-center justify-center text-xl`}
                >
                    {icon}
                </div>
                <p className="text-sm text-slate-400 font-medium">{title}</p>
            </div>
            <p className="text-3xl font-bold text-white">{value}</p>
            <p className="text-xs text-slate-500 mt-1">{sub}</p>
        </div>
    );
}

export default function DashboardPage() {
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

                // Calculate KPIs
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

                // Chart: last 10 entries (reversed to chronological order)
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
        const interval = setInterval(fetchData, 30000); // Auto-refresh every 30s
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                    <p className="text-slate-400 text-sm">กำลังโหลดข้อมูล...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center max-w-md">
                    <p className="text-red-400 font-semibold mb-2">⚠️ เกิดข้อผิดพลาด</p>
                    <p className="text-red-400/70 text-sm">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 px-4 py-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-white mb-1">
                        📊 แดชบอร์ด Referee-GPT
                    </h1>
                    <p className="text-slate-400 text-sm">
                        ข้อมูลรวม {kpi?.total ?? 0} คำถาม · รีเฟรชทุก 30 วินาที
                    </p>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                    <KPICard
                        icon="💬"
                        title="คำถามทั้งหมด"
                        value={`${kpi?.total ?? 0}`}
                        sub="คำถาม-คำตอบในระบบ"
                        color="orange"
                    />
                    <KPICard
                        icon="⚡"
                        title="เวลาตอบสนองเฉลี่ย"
                        value={
                            kpi?.avgLatency
                                ? `${(kpi.avgLatency / 1000).toFixed(1)}s`
                                : "—"
                        }
                        sub={`${kpi?.avgLatency?.toLocaleString() ?? 0} ms`}
                        color="blue"
                    />
                    <KPICard
                        icon="🎯"
                        title="อัตราความแม่นยำ"
                        value={kpi?.ratedCount ? `${kpi.accuracyRate}%` : "—"}
                        sub={
                            kpi?.ratedCount
                                ? `จาก ${kpi.ratedCount} คำตอบที่ได้รับการประเมิน`
                                : "ยังไม่มีการประเมิน"
                        }
                        color="green"
                    />
                </div>

                {/* Latency Chart */}
                {chartData.length > 0 && (
                    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 mb-8">
                        <h2 className="text-base font-semibold text-white mb-4">
                            ⚡ เวลาตอบสนอง (10 คำถามล่าสุด)
                        </h2>
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={chartData} barSize={32}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                                <YAxis
                                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                                    tickFormatter={(v) => `${v}ms`}
                                />
                                <Tooltip
                                    contentStyle={{
                                        background: "#1e293b",
                                        border: "1px solid #334155",
                                        borderRadius: "8px",
                                        color: "#f1f5f9",
                                    }}
                                    formatter={(v: number) => [`${v.toLocaleString()} ms`, "เวลาตอบสนอง"]}
                                />
                                <Bar dataKey="latency" fill="#f97316" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* Recent Logs Table */}
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-700/50">
                        <h2 className="text-base font-semibold text-white">
                            📋 คำถาม-คำตอบล่าสุด
                        </h2>
                    </div>
                    {logs.length === 0 ? (
                        <div className="p-12 text-center text-slate-500">
                            <p className="text-4xl mb-3">🏀</p>
                            <p>ยังไม่มีข้อมูล ลองถามคำถามแรกได้เลย!</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-700/50 text-left">
                                        <th className="px-6 py-3 text-slate-400 font-medium">คำถาม</th>
                                        <th className="px-4 py-3 text-slate-400 font-medium">อ้างอิง</th>
                                        <th className="px-4 py-3 text-slate-400 font-medium">Confidence</th>
                                        <th className="px-4 py-3 text-slate-400 font-medium">Latency</th>
                                        <th className="px-4 py-3 text-slate-400 font-medium">ผล</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((log) => (
                                        <tr
                                            key={log.id}
                                            className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors"
                                        >
                                            <td className="px-6 py-3 text-slate-200 max-w-xs">
                                                <p className="truncate">{log.question}</p>
                                                <p className="text-slate-500 text-xs truncate mt-0.5">
                                                    {log.answer}
                                                </p>
                                            </td>
                                            <td className="px-4 py-3">
                                                {log.source_ref ? (
                                                    <span className="px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                                        {log.source_ref}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-600">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {log.confidence_score !== null ? (
                                                    <span
                                                        className={`text-xs font-semibold ${(log.confidence_score ?? 0) >= 0.6
                                                                ? "text-green-400"
                                                                : "text-red-400"
                                                            }`}
                                                    >
                                                        {((log.confidence_score ?? 0) * 100).toFixed(0)}%
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-600">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-slate-400 text-xs">
                                                {log.latency_ms?.toLocaleString()} ms
                                            </td>
                                            <td className="px-4 py-3">
                                                {log.is_correct === true ? (
                                                    <span className="text-green-400 font-bold">👍</span>
                                                ) : log.is_correct === false ? (
                                                    <span className="text-red-400 font-bold">👎</span>
                                                ) : (
                                                    <span className="text-slate-600 text-xs">รอ</span>
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
        </div>
    );
}
