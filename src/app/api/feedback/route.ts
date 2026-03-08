import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
    try {
        const { id, is_correct } = await req.json();

        if (!id || typeof is_correct !== "boolean") {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        const { error } = await supabase
            .from("qa_logs")
            .update({ is_correct })
            .eq("id", id);

        if (error) {
            console.error("Supabase update error:", error);
            return NextResponse.json({ error: "Database update failed" }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Feedback API error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
