import { z } from "zod";
/**
 * 🔹 scan entire repo tree
 */
export declare const scanRepoTree: import("@langchain/core/tools").DynamicStructuredTool<z.ZodObject<{}, z.core.$strip>, Record<string, never>, Record<string, never>, {
    root: string;
    files: any;
    error?: undefined;
} | {
    error: any;
    root?: undefined;
    files?: undefined;
}, "scan_repo_tree">;
/**
 * 🔹 read a local file SAFELY
 */
export declare const readLocalFile: import("@langchain/core/tools").DynamicStructuredTool<z.ZodObject<{
    filePath: z.ZodString;
}, z.core.$strip>, {
    filePath: string;
}, {
    filePath: string;
}, {
    filePath: string;
    content: string;
    error?: undefined;
} | {
    error: any;
    filePath?: undefined;
    content?: undefined;
}, "read_local_file">;
