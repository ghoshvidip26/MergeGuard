import { z } from "zod";
export declare const getLocalVsRemoteDiff: import("@langchain/core/tools").DynamicStructuredTool<z.ZodObject<{
    remoteBranch: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, {
    remoteBranch?: string | undefined;
}, {
    remoteBranch?: string | undefined;
}, {
    status: string;
    message: string;
    remoteBranch?: undefined;
    missingCommits?: undefined;
    diff?: undefined;
    listRemotes?: undefined;
    origin?: undefined;
    error?: undefined;
} | {
    remoteBranch: string;
    status: string;
    missingCommits: string;
    diff: string;
    listRemotes: import("simple-git").RemoteWithRefs[];
    origin: string;
    message?: undefined;
    error?: undefined;
} | {
    error: any;
    status?: undefined;
    message?: undefined;
    remoteBranch?: undefined;
    missingCommits?: undefined;
    diff?: undefined;
    listRemotes?: undefined;
    origin?: undefined;
} | undefined>;
/**
 * 🔹 Explicitly fetch from a remote
 */
export declare const fetchRemoteRepo: import("@langchain/core/tools").DynamicStructuredTool<z.ZodObject<{
    remote: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, {
    remote?: string | undefined;
}, {
    remote?: string | undefined;
}, {
    success: boolean;
    remote: string;
    raw: import("simple-git").FetchResult;
    error?: undefined;
} | {
    error: any;
    success?: undefined;
    remote?: undefined;
    raw?: undefined;
}>;
export declare const getLocalFileDiff: import("@langchain/core/tools").DynamicStructuredTool<z.ZodObject<{}, z.core.$strip>, Record<string, never>, Record<string, never>, {
    hasChanges: boolean;
    changedFiles: {
        path: any;
        index: any;
        working_dir: any;
    }[];
    structuredChanges: {
        file: string;
        lineStart: number;
        lineCount: number;
        header: string;
    }[];
    diff: string;
    error?: undefined;
} | {
    error: any;
    hasChanges?: undefined;
    changedFiles?: undefined;
    structuredChanges?: undefined;
    diff?: undefined;
}>;
export declare const getCommitStatus: import("@langchain/core/tools").DynamicStructuredTool<z.ZodObject<{
    branch: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, {
    branch?: string | undefined;
}, {
    branch?: string | undefined;
}, {
    error: string;
    aheadCount: number;
    behindCount: number;
    remoteChanges: {
        total: number;
        files: never[];
        structured: never[];
    };
    localCommits: {
        total: number;
        files: never[];
        structured: never[];
    };
    branch?: undefined;
} | {
    branch: string;
    aheadCount: number;
    behindCount: number;
    remoteChanges: {
        total: number;
        files: any;
        structured: {
            file: any;
            lineStart: number;
            lineCount: number;
            header: any;
        }[];
    };
    localCommits: {
        total: number;
        files: any;
        structured: {
            file: any;
            lineStart: number;
            lineCount: number;
            header: any;
        }[];
    };
    error?: undefined;
} | {
    error: any;
    aheadCount?: undefined;
    behindCount?: undefined;
    remoteChanges?: undefined;
    localCommits?: undefined;
    branch?: undefined;
}>;
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
}>;
export declare const pullRemoteChanges: import("@langchain/core/tools").DynamicStructuredTool<z.ZodObject<{
    branch: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, {
    branch?: string | undefined;
}, {
    branch?: string | undefined;
}, {
    success: boolean;
    summary: import("simple-git").PullDetailSummary;
    files: string[];
    error?: undefined;
} | {
    error: any;
    success?: undefined;
    summary?: undefined;
    files?: undefined;
}>;
