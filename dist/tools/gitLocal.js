import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { simpleGit } from "simple-git";
const git = simpleGit({
    baseDir: process.cwd(),
});
async function getOriginUrlSafe() {
    try {
        const url = await git.remote(["get-url", "origin"]);
        return url ? url.trim() : null;
    }
    catch {
        return null;
    }
}
export const getLocalVsRemoteDiff = tool(async ({ remoteBranch }) => {
    try {
        const originUrl = await getOriginUrlSafe();
        if (!originUrl) {
            return { error: "Remote 'origin' not configured." };
        }
        const listRemotes = await git.getRemotes(true);
        // Fixed: Removed type signature from runtime call
        const userConfig = await git.getConfig("user.name");
        if (!userConfig) {
            return;
        }
        if (!originUrl) {
            throw new Error("Remote 'origin' not configured.");
        }
        const branch = remoteBranch ?? "main";
        let targetRemote = `origin/${branch}`;
        // Check if remote branch exists before logging/diffing
        const remotes = await git.branch(["-r"]);
        if (!remotes.all.includes(targetRemote)) {
            if (remotes.all.includes("origin/main")) {
                targetRemote = "origin/main";
            }
            else {
                return {
                    status: "no-remote-branch",
                    message: `The remote branch '${targetRemote}' does not exist and 'origin/main' was not found.`
                };
            }
        }
        const behindLog = await git.log({ from: "HEAD", to: targetRemote });
        const status = behindLog.total > 0 ? "behind-remote" : "up-to-date";
        const diff = await git.diff(["HEAD", targetRemote]);
        const missingCommits = behindLog.all
            .map((c) => `${c.hash.substring(0, 7)} ${c.message}`)
            .join("\n");
        return {
            remoteBranch: branch,
            status,
            missingCommits,
            diff,
            listRemotes,
            origin: originUrl,
        };
    }
    catch (err) {
        return { error: err.message ?? "Git unavailable" };
    }
}, {
    name: "getLocalVsRemoteDiff",
    description: "Compare local HEAD against origin/<branch> and return missing commits and diff.",
    schema: z.object({
        remoteBranch: z.string().optional(),
    }),
});
/**
 * 🔹 Explicitly fetch from a remote
 */
export const fetchRemoteRepo = tool(async ({ remote }) => {
    try {
        const targetRemote = remote ?? "origin";
        const result = await git.fetch(targetRemote);
        return {
            success: true,
            remote: targetRemote,
            raw: result,
        };
    }
    catch (err) {
        return { error: err.message ?? `Failed to fetch from ${remote}` };
    }
}, {
    name: "fetchRemoteRepo",
    description: "Fetch updates from a specific git remote (default is origin).",
    schema: z.object({
        remote: z.string().optional(),
    }),
});
export const getLocalFileDiff = tool(async () => {
    try {
        const summary = await git.status();
        const diffRaw = await git.diff(["--unified=0"]);
        // Parse diff to find line numbers
        // Hunk header format: @@ -line,count +line,count @@
        const lines = diffRaw.split("\n");
        const changes = [];
        let currentFile = null;
        for (const line of lines) {
            if (line.startsWith("--- a/"))
                continue;
            if (line.startsWith("+++ b/")) {
                currentFile = line.substring(6);
                continue;
            }
            if (line.startsWith("@@")) {
                const match = line.match(/@@ -\d+(,\d+)? \+(\d+)(,(\d+))? @@/);
                if (match && currentFile) {
                    changes.push({
                        file: currentFile,
                        lineStart: parseInt(match[2] || "2"),
                        lineCount: parseInt(match[4] || "1"),
                        header: line,
                    });
                }
            }
        }
        return {
            hasChanges: summary.files.length > 0,
            changedFiles: summary.files.map((f) => ({
                path: f.path,
                index: f.index,
                working_dir: f.working_dir,
            })),
            structuredChanges: changes,
            diff: diffRaw.slice(0, 5000),
        };
    }
    catch (err) {
        return { error: err.message };
    }
}, {
    name: "getLocalFileDiff",
    description: "Returns uncommitted local changes (working directory) with exact line numbers and modified files.",
    schema: z.object({}),
});
export const getCommitStatus = tool(async ({ branch }) => {
    try {
        await git.fetch("origin");
        const currentBranch = branch || (await git.revparse(["--abbrev-ref", "HEAD"]));
        const remote = `origin/${currentBranch}`;
        // Check if remote branch exists before logging/diffing
        const remotes = await git.branch(["-r"]);
        let targetRemote = remote;
        if (!remotes.all.includes(remote)) {
            if (remotes.all.includes("origin/main")) {
                targetRemote = "origin/main";
            }
            else {
                return {
                    error: `The remote branch '${remote}' does not exist and 'origin/main' was not found.`,
                    aheadCount: 0,
                    behindCount: 0,
                    remoteChanges: { total: 0, files: [], structured: [] },
                    localCommits: { total: 0, files: [], structured: [] }
                };
            }
        }
        const behind = await git.log({ from: "HEAD", to: targetRemote });
        const ahead = await git.log({ from: targetRemote, to: "HEAD" });
        // Helper to parse diff hunks
        const parseDiff = (diffRaw) => {
            const lines = diffRaw.split("\n");
            const changes = [];
            let currentFile = null;
            for (const line of lines) {
                if (line.startsWith("--- a/"))
                    continue;
                if (line.startsWith("+++ b/")) {
                    currentFile = line.substring(6);
                    continue;
                }
                if (line.startsWith("@@")) {
                    const match = line.match(/@@ -\d+(,\d+)? \+(\d+)(,(\d+))? @@/);
                    if (match && currentFile && currentFile !== "/dev/null") {
                        changes.push({
                            file: currentFile,
                            lineStart: parseInt(match[2]),
                            lineCount: parseInt(match[4] || "1"),
                            header: line,
                        });
                    }
                }
            }
            return changes;
        };
        // 1. INCOMING CHANGES (Remote changes we don't have)
        const incomingDiffRaw = await git.diff(["HEAD", targetRemote, "--unified=0"]);
        const incomingStatusRaw = await git.diffSummary(["HEAD", targetRemote]);
        const incomingStructured = parseDiff(incomingDiffRaw);
        // 2. OUTGOING CHANGES (Local commits not on remote)
        const outgoingDiffRaw = await git.diff([targetRemote, "HEAD", "--unified=0"]);
        const outgoingStatusRaw = await git.diffSummary([targetRemote, "HEAD"]);
        const outgoingStructured = parseDiff(outgoingDiffRaw);
        // Get file list details from status summary
        const getFileDetails = (summary) => summary.files.map((f) => ({
            path: f.file,
            status: f.changes > 0
                ? f.insertions > 0 && f.deletions === 0
                    ? "A"
                    : "M"
                : "M",
            // Note: diffSummary doesn't explicitly give A/M/D in the same way as name-status,
            // but we can infer 'A' if it's all insertions.
        }));
        return {
            branch: currentBranch,
            aheadCount: ahead.total,
            behindCount: behind.total,
            remoteChanges: {
                total: behind.total,
                files: getFileDetails(incomingStatusRaw),
                structured: incomingStructured,
            },
            localCommits: {
                total: ahead.total,
                files: getFileDetails(outgoingStatusRaw),
                structured: outgoingStructured,
            },
        };
    }
    catch (err) {
        return { error: err.message };
    }
}, {
    name: "getCommitStatus",
    description: "Shows committed changes ahead/behind remote. Useful for analyzing incoming/outgoing commits.",
    schema: z.object({
        branch: z.string().optional(),
    }),
});
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
export const pullRemoteChanges = tool(async ({ branch }) => {
    try {
        const currentBranch = branch || (await git.revparse(["--abbrev-ref", "HEAD"]));
        const result = await git.pull("origin", currentBranch);
        return {
            success: true,
            summary: result.summary,
            files: result.files,
        };
    }
    catch (err) {
        return { error: err.message };
    }
}, {
    name: "pullRemoteChanges",
    description: "Pull updates from origin for a specific branch.",
    schema: z.object({
        branch: z.string().optional(),
    }),
});
