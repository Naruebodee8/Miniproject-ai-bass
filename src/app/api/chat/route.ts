import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { loadRulesContext } from "@/lib/rules";
import { supabase } from "@/lib/supabase";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const MODEL_NAME = process.env.NEXT_PUBLIC_MODEL_NAME || "gemini-2.5-flash-lite";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function generateWithRetry(prompt: string, maxRetries = 2): Promise<string> {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    let lastErr: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const result = await model.generateContent(prompt);
            return result.response.text().trim();
        } catch (err: unknown) {
            lastErr = err;
            const msg = String(err);
            // Retry only on 503 (overload) or 429 (rate limit)
            if ((msg.includes("503") || msg.includes("429")) && attempt < maxRetries) {
                console.warn(`Gemini ${attempt + 1}/${maxRetries} retry after overload...`);
                await sleep(3000 * (attempt + 1));
                continue;
            }
            throw err;
        }
    }
    throw lastErr;
}

export async function POST(req: NextRequest) {
    try {
        const { question } = await req.json();

        if (!question || typeof question !== "string") {
            return NextResponse.json({ error: "Invalid question" }, { status: 400 });
        }

        const rulesContext = loadRulesContext();
        const start = Date.now();


        const prompt = `คุณคือ "Mr.ZebraBKB" ผู้เชี่ยวชาญกฎกีฬาบาสเกตบอลอย่างเป็นทางการ
ตอบคำถามเป็นภาษาไทยเสมอ และต้องอ้างอิงข้ออย่างชัดเจน (เช่น Art 25, Art 33) ทุกครั้งในคำตอบ

กฎบาสเกตบอล (Knowledge Base):
---
${rulesContext}
---

คำถาม: ${question}

ตอบในรูปแบบ JSON เท่านั้น (ห้ามมีข้อความอื่นนอก JSON block):
{
  "answer": "คำตอบภาษาไทยอ้างอิงข้อกฎ เช่น Art 25",
  "source_ref": "Art XX",
  "confidence_score": 0.9
}

กฎการให้ confidence_score:
- 0.9-1.0: มีข้อกฎรองรับชัดเจนใน Knowledge Base
- 0.6-0.89: มีข้อกฎรองรับบางส่วนหรือต้องตีความ
- 0.0-0.59: ไม่แน่ใจหรือไม่มีข้อกฎรองรับโดยตรง`;

        const text = await generateWithRetry(prompt);
        const latency_ms = Date.now() - start;

        let parsedResponse = { answer: text, source_ref: "ไม่ระบุ", confidence_score: 0.5 };
        try {
            const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
            parsedResponse = JSON.parse(cleaned);
        } catch {
            // keep fallback above
        }

        // Save to Supabase (non-blocking — don't let DB failure crash the response)
        let logId: string | null = null;
        try {
            const { data } = await supabase
                .from("qa_logs")
                .insert({
                    question,
                    answer: parsedResponse.answer,
                    source_ref: parsedResponse.source_ref || null,
                    confidence_score: parsedResponse.confidence_score ?? null,
                    latency_ms,
                })
                .select("id")
                .single();
            logId = data?.id ?? null;
        } catch (dbErr) {
            console.error("Supabase insert error:", dbErr);
        }

        return NextResponse.json({
            id: logId,
            answer: parsedResponse.answer,
            source_ref: parsedResponse.source_ref,
            confidence_score: parsedResponse.confidence_score,
            latency_ms,
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Chat API error:", msg);
        // Return actual error message so we can debug via browser network tab
        return NextResponse.json(
            { error: msg },
            { status: 500 }
        );
    }
}
