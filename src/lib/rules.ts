import fs from "fs";
import path from "path";

export function loadRulesContext(): string {
    const rulesPath = path.join(process.cwd(), "rules_context.txt");
    return fs.readFileSync(rulesPath, "utf-8");
}

/**
 * ดึงเนื้อหาของกฎข้อที่ระบุจาก rules_context.txt
 * รองรับ format: "Art 25", "Art 16.5", "Art 8 & 9", "Rule 01" ฯลฯ
 */
export function extractRuleContent(sourceRef: string): string | null {
    if (!sourceRef) return null;

    const rulesText = loadRulesContext();
    const lines = rulesText.split("\n");

    // แยก article numbers จาก source_ref (อาจมีหลายตัว เช่น "Art 16.5, Art 34")
    const refs = sourceRef.split(/[,&]/).map((r) => r.trim()).filter(Boolean);

    const results: string[] = [];

    for (const ref of refs) {
        // normalize: "Art 25" → "25", "Art 16.5" → "16.5", "Rule 01" → "01"
        const numMatch = ref.match(/(?:Art|Rule)\s*([\d.]+(?:\s*&\s*[\d.]+)?)/i);
        if (!numMatch) continue;
        const artNum = numMatch[1].trim();

        // ค้นหาบรรทัดที่ match Art XX หรือ Art XX.X
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // pattern: "- Art 25:" หรือ "- Art 16.5:" หรือ "- Art 8 & 9:"
            const lineMatch = line.match(/- (?:Art|Rule)\s*([\d.]+(?:\s*[&]\s*[\d.]+)?)\s*:/i);
            if (lineMatch && lineMatch[1].trim() === artNum) {
                // collect this line + any continuation lines (indented with spaces/tabs)
                const collected: string[] = [line.replace(/^-\s*/, "").trim()];
                for (let j = i + 1; j < lines.length; j++) {
                    const next = lines[j];
                    if (next.match(/^\s+\*/) || next.match(/^\s{4,}/)) {
                        collected.push(next.trim());
                    } else {
                        break;
                    }
                }
                results.push(collected.join("\n"));
                break;
            }
        }
    }

    return results.length > 0 ? results.join("\n\n") : null;
}
