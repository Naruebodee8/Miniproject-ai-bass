import fs from "fs";
import path from "path";

export function loadRulesContext(): string {
    const rulesPath = path.join(process.cwd(), "rules_context.txt");
    return fs.readFileSync(rulesPath, "utf-8");
}
