import { tool } from "@langchain/core/tools";
import { z } from "zod";
import fs from "fs";
import path from "path";
const ROOT = process.cwd();
const IGNORE_DIRS = new Set([
    "node_modules",
    ".git",
    "dist",
    "build",
    ".next",
    ".cache",
    "coverage",
    "tmp",
]);
const MAX_FILE_SIZE = 300 * 1024; // 300kb
/**
 * 🔹 recursively walk repo — return file paths only
 */
function walk(dir, result = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        if (IGNORE_DIRS.has(entry.name))
            continue;
        if (entry.name.startsWith("."))
            continue; // hidden
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(full, result);
        }
        else {
            result.push(full.replace(ROOT + path.sep, ""));
        }
    }
    return result;
}
/**
 * 🔹 scan entire repo tree
 */
export const scanRepoTree = tool(async () => {
    try {
        const files = walk(ROOT);
        return { root: ROOT, files };
    }
    catch (err) {
        return { error: err.message ?? "Failed to scan repository" };
    }
}, {
    name: "scan_repo_tree",
    description: "Recursively scan the entire local repository and return a list of all files.",
    schema: z.object({}),
});
/**
 * 🔹 read a local file SAFELY
 */
export const readLocalFile = tool(async ({ filePath }) => {
    try {
        const resolved = path.resolve(ROOT, filePath);
        if (!resolved.startsWith(ROOT)) {
            return { error: "Access denied outside project root" };
        }
        const stat = fs.statSync(resolved);
        if (stat.size > MAX_FILE_SIZE) {
            return { error: "File too large to read safely" };
        }
        const content = fs.readFileSync(resolved, "utf8");
        if (content.includes("\u0000")) {
            return { error: "Binary file — not readable as text" };
        }
        return { filePath, content };
    }
    catch (err) {
        return { error: err.message ?? "Unable to read file" };
    }
}, {
    name: "read_local_file",
    description: "Read the full text content of a local project file. Only works inside the project root.",
    schema: z.object({
        filePath: z.string(),
    }),
});
