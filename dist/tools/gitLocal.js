import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { simpleGit } from "simple-git";
const git = simpleGit({
    baseDir: process.cwd(),
});
let lastFetchTime = 0;
const FETCH_THRESHOLD = 10000;
/* ---------------------------------------------------
   Helpers
--------------------------------------------------- */
export async function fetchIfOld() {
    const now = Date.now();
    if (now - lastFetchTime > FETCH_THRESHOLD) {
        try {
            await git.fetch("origin");
            lastFetchTime = now;
        }
        catch {
            // Ignore fetch errors in throttle (offline?)
        }
    }
}
async function getRemoteBranchSafe() {
    try {
        const branch = await git.revparse(["--abbrev-ref", "HEAD"]);
        const remotes = await git.branch(["-r"]);
        const direct = `origin/${branch}`;
        if (remotes.all.includes(direct))
            return direct;
        if (remotes.all.includes("origin/main"))
            return "origin/main";
        return null;
    }
    catch {
        return null;
    }
}
function parseDiff(diffRaw) {
    const lines = diffRaw.split("\n");
    const changes = [];
    let currentFile = null;
    let currentHunk = null;
    for (const line of lines) {
        if (line.startsWith("+++ b/")) {
            const file = line.substring(6);
            currentFile = isRealSource(file) ? file : null;
            continue;
        }
        if (line.startsWith("@@")) {
            if (!currentFile)
                continue;
            const match = line.match(/@@ -\d+(,\d+)? \+(\d+)(,(\d+))? @@/);
            if (match) {
                currentHunk = {
                    file: currentFile,
                    lineStart: parseInt(match[2]),
                    lineCount: parseInt(match[4] || "1"),
                    added: [],
                    removed: [],
                };
                changes.push(currentHunk);
            }
            continue;
        }
        if (!currentHunk)
            continue;
        if (line.startsWith("+") && !line.startsWith("+++")) {
            currentHunk.added.push(line.substring(1));
        }
        if (line.startsWith("-") && !line.startsWith("---")) {
            currentHunk.removed.push(line.substring(1));
        }
    }
    return changes;
}
/** Extract changed files + lines from a commit (deprecated for bulk use) */
async function getCommitFiles(hash) {
    const diff = await git.show([hash, "--unified=0"]);
    return parseDiff(diff).map((c) => ({
        path: c.file,
        lines: Array.from({ length: c.lineCount }, (_, i) => c.lineStart + i),
    }));
}
/* ---------------------------------------------------
   getLocalFileDiff (Uncommitted changes)
--------------------------------------------------- */
const IGNORED_PATHS = [
    "dist/",
    "node_modules/",
    ".map",
    ".d.ts",
    "build/",
    ".next/",
];
function isRealSource(file) {
    return !IGNORED_PATHS.some((p) => file.includes(p));
}
const statusCodeMap = {
    " ": "Unmodified",
    M: "Modified",
    A: "Added",
    D: "Deleted",
    R: "Renamed",
    C: "Copied",
    U: "Updated but unmerged",
    "?": "Untracked",
};
export const getLocalFileDiff = tool(async () => {
    try {
        const status = await git.status();
        const diffRaw = await git.diff(["--unified=0"]);
        const changes = parseDiff(diffRaw);
        const realFiles = status.files.map((f) => f.path).filter(isRealSource);
        return {
            hasChanges: realFiles.length > 0,
            changedFiles: status.files
                .filter((f) => isRealSource(f.path))
                .map((f) => ({
                path: f.path,
                index: f.index,
                working_dir: f.working_dir,
                statusStr: statusCodeMap[f.working_dir] ||
                    statusCodeMap[f.index] ||
                    "Unknown",
            })),
            structuredChanges: changes,
        };
    }
    catch (e) {
        return { error: e.message };
    }
}, {
    name: "getLocalFileDiff",
    description: "Returns uncommitted local changes with exact line numbers.",
    schema: z.object({}),
});
/* ---------------------------------------------------
   getCommitStatus (Remote vs Local commits)
--------------------------------------------------- */
export const getCommitStatus = tool(async ({ skipFetch }) => {
    try {
        if (!skipFetch) {
            await fetchIfOld();
        }
        const remote = await getRemoteBranchSafe();
        if (!remote) {
            return {
                aheadCount: 0,
                behindCount: 0,
                remoteChanges: [],
                localChanges: [],
                remoteStructuredChanges: [],
                localStructuredChanges: [],
            };
        }
        const behind = await git.log({ from: "HEAD", to: remote });
        const ahead = await git.log({ from: remote, to: "HEAD" });
        // Get ALL changes in one go for efficiency
        const remoteDiffRaw = await git.diff(["HEAD.." + remote, "--unified=0"]);
        const localDiffRaw = await git.diff([remote + "..HEAD", "--unified=0"]);
        const remoteStructuredChanges = parseDiff(remoteDiffRaw).filter((h) => isRealSource(h.file));
        const localStructuredChanges = parseDiff(localDiffRaw).filter((h) => isRealSource(h.file));
        return {
            aheadCount: ahead.total,
            behindCount: behind.total,
            remoteChanges: behind.all.map((c) => ({
                message: c.message,
                hash: c.hash,
            })),
            localChanges: ahead.all.map((c) => ({
                message: c.message,
                hash: c.hash,
            })),
            remoteStructuredChanges,
            localStructuredChanges,
        };
    }
    catch (e) {
        return { error: e.message };
    }
}, {
    name: "getCommitStatus",
    description: "Returns commit-level file & line changes between local and remote. Use skipFetch=true if repo was recently fetched.",
    schema: z.object({
        branch: z.string().optional(),
        skipFetch: z.boolean().optional(),
    }),
});
/* ---------------------------------------------------
   detectGithubRepo
--------------------------------------------------- */
export const detectGithubRepo = tool(async () => {
    try {
        let remote;
        try {
            remote = await git.remote(["get-url", "origin"]);
        }
        catch {
            const remotes = await git.getRemotes(true);
            const githubRemote = remotes.find((r) => r.refs.push.includes("github.com"));
            remote = githubRemote ? githubRemote.refs.push : null;
        }
        if (!remote) {
            throw new Error("GitHub remote not found.");
        }
        const branch = await git.revparse(["--abbrev-ref", "HEAD"]);
        const match = remote
            .trim()
            .match(/github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/);
        return {
            remote,
            branch,
            owner: match ? match[1] : null,
            repo: match ? match[2] : null,
        };
    }
    catch (err) {
        return { error: err.message };
    }
}, {
    name: "detectRepo",
    description: "Detects git repo URL, branch, owner, and repo name.",
    schema: z.object({}),
});
/* ---------------------------------------------------
   pullRemoteChanges
--------------------------------------------------- */
export const pullRemoteChanges = tool(async ({}) => {
    try {
        const branch = await git.revparse(["--abbrev-ref", "HEAD"]);
        const res = await git.pull("origin", branch);
        return { success: true, summary: res.summary };
    }
    catch (e) {
        return { error: e.message };
    }
}, {
    name: "pullRemoteChanges",
    description: "Pulls from origin for the current branch.",
    schema: z.object({}),
});
