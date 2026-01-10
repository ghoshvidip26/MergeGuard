import { getCommitFiles } from "./gitLocal.js";
export declare const tools: (import("@langchain/core/tools").DynamicStructuredTool<import("zod").ZodObject<{
    githubOwner: import("zod").ZodString;
    repoName: import("zod").ZodString;
}, import("zod/v4/core").$strip>, {
    githubOwner: string;
    repoName: string;
}, {
    githubOwner: string;
    repoName: string;
}, {
    repo: string;
    defaultBranch: string;
    issues: {
        id: number;
        node_id: string;
        url: string;
        repository_url: string;
        labels_url: string;
        comments_url: string;
        events_url: string;
        html_url: string;
        number: number;
        state: string;
        state_reason?: "completed" | "reopened" | "not_planned" | "duplicate" | null;
        title: string;
        body?: string | null;
        user: import("@octokit/openapi-types").components["schemas"]["nullable-simple-user"];
        labels: import("@octokit/openapi-types").OneOf<[string, {
            id?: number;
            node_id?: string;
            url?: string;
            name?: string;
            description?: string | null;
            color?: string | null;
            default?: boolean;
        }]>[];
        assignee: import("@octokit/openapi-types").components["schemas"]["nullable-simple-user"];
        assignees?: import("@octokit/openapi-types").components["schemas"]["simple-user"][] | null;
        milestone: import("@octokit/openapi-types").components["schemas"]["nullable-milestone"];
        locked: boolean;
        active_lock_reason?: string | null;
        comments: number;
        pull_request?: {
            merged_at?: string | null;
            diff_url: string | null;
            html_url: string | null;
            patch_url: string | null;
            url: string | null;
        };
        closed_at: string | null;
        created_at: string;
        updated_at: string;
        draft?: boolean;
        closed_by?: import("@octokit/openapi-types").components["schemas"]["nullable-simple-user"];
        body_html?: string;
        body_text?: string;
        timeline_url?: string;
        type?: import("@octokit/openapi-types").components["schemas"]["issue-type"];
        repository?: import("@octokit/openapi-types").components["schemas"]["repository"];
        performed_via_github_app?: import("@octokit/openapi-types").components["schemas"]["nullable-integration"];
        author_association?: import("@octokit/openapi-types").components["schemas"]["author-association"];
        reactions?: import("@octokit/openapi-types").components["schemas"]["reaction-rollup"];
        sub_issues_summary?: import("@octokit/openapi-types").components["schemas"]["sub-issues-summary"];
        parent_issue_url?: string | null;
        issue_dependencies_summary?: import("@octokit/openapi-types").components["schemas"]["issue-dependencies-summary"];
        issue_field_values?: import("@octokit/openapi-types").components["schemas"]["issue-field-value"][];
    }[];
    pulls: {
        url: string;
        id: number;
        node_id: string;
        html_url: string;
        diff_url: string;
        patch_url: string;
        issue_url: string;
        commits_url: string;
        review_comments_url: string;
        review_comment_url: string;
        comments_url: string;
        statuses_url: string;
        number: number;
        state: string;
        locked: boolean;
        title: string;
        user: import("@octokit/openapi-types").components["schemas"]["nullable-simple-user"];
        body: string | null;
        labels: {
            id: number;
            node_id: string;
            url: string;
            name: string;
            description: string;
            color: string;
            default: boolean;
        }[];
        milestone: import("@octokit/openapi-types").components["schemas"]["nullable-milestone"];
        active_lock_reason?: string | null;
        created_at: string;
        updated_at: string;
        closed_at: string | null;
        merged_at: string | null;
        merge_commit_sha: string | null;
        assignee: import("@octokit/openapi-types").components["schemas"]["nullable-simple-user"];
        assignees?: import("@octokit/openapi-types").components["schemas"]["simple-user"][] | null;
        requested_reviewers?: import("@octokit/openapi-types").components["schemas"]["simple-user"][] | null;
        requested_teams?: import("@octokit/openapi-types").components["schemas"]["team"][] | null;
        head: {
            label: string;
            ref: string;
            repo: import("@octokit/openapi-types").components["schemas"]["repository"];
            sha: string;
            user: import("@octokit/openapi-types").components["schemas"]["nullable-simple-user"];
        };
        base: {
            label: string;
            ref: string;
            repo: import("@octokit/openapi-types").components["schemas"]["repository"];
            sha: string;
            user: import("@octokit/openapi-types").components["schemas"]["nullable-simple-user"];
        };
        _links: {
            comments: import("@octokit/openapi-types").components["schemas"]["link"];
            commits: import("@octokit/openapi-types").components["schemas"]["link"];
            statuses: import("@octokit/openapi-types").components["schemas"]["link"];
            html: import("@octokit/openapi-types").components["schemas"]["link"];
            issue: import("@octokit/openapi-types").components["schemas"]["link"];
            review_comments: import("@octokit/openapi-types").components["schemas"]["link"];
            review_comment: import("@octokit/openapi-types").components["schemas"]["link"];
            self: import("@octokit/openapi-types").components["schemas"]["link"];
        };
        author_association: import("@octokit/openapi-types").components["schemas"]["author-association"];
        auto_merge: import("@octokit/openapi-types").components["schemas"]["auto-merge"];
        draft?: boolean;
    }[];
    commits: {
        url: string;
        sha: string;
        node_id: string;
        html_url: string;
        comments_url: string;
        commit: {
            url: string;
            author: import("@octokit/openapi-types").components["schemas"]["nullable-git-user"];
            committer: import("@octokit/openapi-types").components["schemas"]["nullable-git-user"];
            message: string;
            comment_count: number;
            tree: {
                sha: string;
                url: string;
            };
            verification?: import("@octokit/openapi-types").components["schemas"]["verification"];
        };
        author: import("@octokit/openapi-types").components["schemas"]["simple-user"] | import("@octokit/openapi-types").components["schemas"]["empty-object"] | null;
        committer: import("@octokit/openapi-types").components["schemas"]["simple-user"] | import("@octokit/openapi-types").components["schemas"]["empty-object"] | null;
        parents: {
            sha: string;
            url: string;
            html_url?: string;
        }[];
        stats?: {
            additions?: number;
            deletions?: number;
            total?: number;
        };
        files?: import("@octokit/openapi-types").components["schemas"]["diff-entry"][];
    }[];
    compare: {
        url: string;
        html_url: string;
        permalink_url: string;
        diff_url: string;
        patch_url: string;
        base_commit: import("@octokit/openapi-types").components["schemas"]["commit"];
        merge_base_commit: import("@octokit/openapi-types").components["schemas"]["commit"];
        status: "diverged" | "ahead" | "behind" | "identical";
        ahead_by: number;
        behind_by: number;
        total_commits: number;
        commits: import("@octokit/openapi-types").components["schemas"]["commit"][];
        files?: import("@octokit/openapi-types").components["schemas"]["diff-entry"][];
    };
    commitDetails: {
        url: string;
        sha: string;
        node_id: string;
        html_url: string;
        comments_url: string;
        commit: {
            url: string;
            author: import("@octokit/openapi-types").components["schemas"]["nullable-git-user"];
            committer: import("@octokit/openapi-types").components["schemas"]["nullable-git-user"];
            message: string;
            comment_count: number;
            tree: {
                sha: string;
                url: string;
            };
            verification?: import("@octokit/openapi-types").components["schemas"]["verification"];
        };
        author: import("@octokit/openapi-types").components["schemas"]["simple-user"] | import("@octokit/openapi-types").components["schemas"]["empty-object"] | null;
        committer: import("@octokit/openapi-types").components["schemas"]["simple-user"] | import("@octokit/openapi-types").components["schemas"]["empty-object"] | null;
        parents: {
            sha: string;
            url: string;
            html_url?: string;
        }[];
        stats?: {
            additions?: number;
            deletions?: number;
            total?: number;
        };
        files?: import("@octokit/openapi-types").components["schemas"]["diff-entry"][];
    };
    error?: undefined;
} | {
    error: {};
    repo?: undefined;
    defaultBranch?: undefined;
    issues?: undefined;
    pulls?: undefined;
    commits?: undefined;
    compare?: undefined;
    commitDetails?: undefined;
}> | import("@langchain/core/tools").DynamicStructuredTool<import("zod").ZodObject<{
    owner: import("zod").ZodString;
    repo: import("zod").ZodString;
    limit: import("zod").ZodOptional<import("zod").ZodNumber>;
}, import("zod/v4/core").$strip>, {
    owner: string;
    repo: string;
    limit?: number | undefined;
}, {
    owner: string;
    repo: string;
    limit?: number | undefined;
}, {
    sha: string;
    message: string;
    author: string | undefined;
    date: string | undefined;
    files: {
        filename: string;
        status: "added" | "removed" | "modified" | "renamed" | "copied" | "changed" | "unchanged";
        additions: number;
        deletions: number;
    }[];
}[]> | import("@langchain/core/tools").DynamicStructuredTool<import("zod").ZodObject<{
    githubOwner: import("zod").ZodString;
    repoName: import("zod").ZodString;
    filePath: import("zod").ZodString;
    ref: import("zod").ZodOptional<import("zod").ZodString>;
}, import("zod/v4/core").$strip>, {
    githubOwner: string;
    repoName: string;
    filePath: string;
    ref?: string | undefined;
}, {
    githubOwner: string;
    repoName: string;
    filePath: string;
    ref?: string | undefined;
}, {
    repo: string;
    filePath: string;
    ref: string;
    fileMeta: ({
        type: "dir" | "file" | "submodule" | "symlink";
        size: number;
        name: string;
        path: string;
        content?: string;
        sha: string;
        url: string;
        git_url: string | null;
        html_url: string | null;
        download_url: string | null;
        _links: {
            git: string | null;
            html: string | null;
            self: string;
        };
    }[] & {
        type: "file";
        content: string;
        encoding: BufferEncoding;
    }) | ({
        type: "file";
        encoding: string;
        size: number;
        name: string;
        path: string;
        content: string;
        sha: string;
        url: string;
        git_url: string | null;
        html_url: string | null;
        download_url: string | null;
        _links: {
            git: string | null;
            html: string | null;
            self: string;
        };
        target?: string;
        submodule_git_url?: string;
    } & {
        type: "file";
        content: string;
        encoding: BufferEncoding;
    });
    fileContent: string;
    error?: undefined;
} | {
    error: {};
    repo?: undefined;
    filePath?: undefined;
    ref?: undefined;
    fileMeta?: undefined;
    fileContent?: undefined;
}> | import("@langchain/core/tools").DynamicStructuredTool<import("zod").ZodObject<{
    dirPath: import("zod").ZodOptional<import("zod").ZodString>;
}, import("zod/v4/core").$strip>, {
    dirPath?: string | undefined;
}, {
    dirPath?: string | undefined;
}, {
    name: string;
    isDirectory: boolean;
    extension: string;
}[] | {
    error: {};
}> | import("@langchain/core/tools").DynamicStructuredTool<import("zod").ZodObject<{}, import("zod/v4/core").$strip>, Record<string, never>, Record<string, never>, {
    hasChanges: boolean;
    changedFiles: {
        path: string;
        index: string;
        working_dir: string;
    }[];
    structuredChanges: any[];
    error?: undefined;
} | {
    error: any;
    hasChanges?: undefined;
    changedFiles?: undefined;
    structuredChanges?: undefined;
}> | import("@langchain/core/tools").DynamicStructuredTool<import("zod").ZodObject<{
    branch: import("zod").ZodOptional<import("zod").ZodString>;
    skipFetch: import("zod").ZodOptional<import("zod").ZodBoolean>;
}, import("zod/v4/core").$strip>, {
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
}> | import("@langchain/core/tools").DynamicStructuredTool<import("zod").ZodObject<{}, import("zod/v4/core").$strip>, Record<string, never>, Record<string, never>, {
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
}> | import("@langchain/core/tools").DynamicStructuredTool<import("zod").ZodObject<{}, import("zod/v4/core").$strip>, Record<string, never>, Record<string, never>, {
    success: boolean;
    summary: import("simple-git").PullDetailSummary;
    error?: undefined;
} | {
    error: any;
    success?: undefined;
    summary?: undefined;
}> | import("@langchain/core/tools").DynamicStructuredTool<import("zod").ZodObject<{}, import("zod/v4/core").$strip>, Record<string, never>, Record<string, never>, {
    root: string;
    files: any;
    error?: undefined;
} | {
    error: any;
    root?: undefined;
    files?: undefined;
}> | import("@langchain/core/tools").DynamicStructuredTool<import("zod").ZodObject<{
    filePath: import("zod").ZodString;
}, import("zod/v4/core").$strip>, {
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
}> | typeof getCommitFiles)[];
