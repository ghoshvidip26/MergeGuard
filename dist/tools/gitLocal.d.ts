import { z } from "zod";
export declare function fetchIfOld(): Promise<void>;
export declare const getLocalFileDiff: import("@langchain/core/tools").DynamicStructuredTool<z.ZodObject<{}, z.core.$strip>, Record<string, never>, Record<string, never>, {
    hasChanges: boolean;
    changedFiles: {
        path: string;
        index: string;
        working_dir: string;
        statusStr: string;
    }[];
    structuredChanges: any[];
    error?: undefined;
} | {
    error: any;
    hasChanges?: undefined;
    changedFiles?: undefined;
    structuredChanges?: undefined;
}, "getLocalFileDiff">;
export declare const getCommitStatus: import("@langchain/core/tools").DynamicStructuredTool<z.ZodObject<{
    branch: z.ZodOptional<z.ZodString>;
    skipFetch: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>, {
    branch?: string | undefined;
    skipFetch?: boolean | undefined;
}, {
    branch?: string | undefined;
    skipFetch?: boolean | undefined;
}, {
    aheadCount: number;
    behindCount: number;
    remoteChanges: {
        message: string;
        hash: string;
    }[];
    localChanges: {
        message: string;
        hash: string;
    }[];
    remoteStructuredChanges: any[];
    localStructuredChanges: any[];
    error?: undefined;
} | {
    error: any;
    aheadCount?: undefined;
    behindCount?: undefined;
    remoteChanges?: undefined;
    localChanges?: undefined;
    remoteStructuredChanges?: undefined;
    localStructuredChanges?: undefined;
}, "getCommitStatus">;
export declare const detectGithubRepo: import("@langchain/core/tools").DynamicStructuredTool<z.ZodObject<{}, z.core.$strip>, Record<string, never>, Record<string, never>, {
    remote: string;
    branch: string;
    owner: string | null;
    repo: string | null;
    error?: undefined;
} | {
    error: any;
    remote?: undefined;
    branch?: undefined;
    owner?: undefined;
    repo?: undefined;
}, "detectRepo">;
export declare const pullRemoteChanges: import("@langchain/core/tools").DynamicStructuredTool<z.ZodObject<{}, z.core.$strip>, Record<string, never>, Record<string, never>, {
    success: boolean;
    summary: import("simple-git").PullDetailSummary;
    error?: undefined;
} | {
    error: any;
    success?: undefined;
    summary?: undefined;
}, "pullRemoteChanges">;
