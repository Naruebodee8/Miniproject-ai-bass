import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type QaLog = {
    id: string;
    question: string;
    answer: string;
    source_ref: string | null;
    confidence_score: number | null;
    latency_ms: number | null;
    is_correct: boolean | null;
    created_at: string;
};
