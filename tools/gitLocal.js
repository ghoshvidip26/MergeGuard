import { tool } from "@langchain/core/tools";
import { z } from "zod";
import simpleGit from "simple-git";

const git = simpleGit();

export const getLocalVsRemoteDiff = tool(
  async ({ remoteBranch }) => {
    try {
      await git.fetch("origin");
      const listRemotes = await git.getRemotes(true);
      const config = await git.getConfig();
      const originUrl = config.values["remote.origin.url"];

      if (!originUrl) {
        throw new Error("Remote 'origin' not configured.");
      }

      const branch = remoteBranch ?? "main";
      const remote = `origin/${branch}`;

      const behindLog = await git.log({ from: "HEAD", to: remote });

      const status = behindLog.total > 0 ? "behind-remote" : "up-to-date";

      const diff = await git.diff(["HEAD", remote]);

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
    } catch (err) {
      return { error: err?.message ?? "Git unavailable" };
    }
  },
  {
    name: "getLocalVsRemoteDiff",
    description:
      "Compare local HEAD against origin/<branch> and return missing commits and diff.",
    schema: z.object({
      remoteBranch: z.string().optional(),
    }),
  }
);

/**
 * 🔹 Explicitly fetch from a remote
 */
export const fetchRemoteRepo = tool(
  async ({ remote }) => {
    try {
      const targetRemote = remote ?? "origin";
      const result = await git.fetch(targetRemote);
      return {
        success: true,
        remote: targetRemote,
        raw: result,
      };
    } catch (err) {
      return { error: err?.message ?? `Failed to fetch from ${remote}` };
    }
  },
  {
    name: "fetchRemoteRepo",
    description:
      "Fetch updates from a specific git remote (default is origin).",
    schema: z.object({
      remote: z.string().optional(),
    }),
  }
);

export const getLocalFileDiff = tool(
  async () => {
    try {
      const summary = await git.status();
      const diffRaw = await git.diff(["--unified=0"]);

      // Parse diff to find line numbers
      // Hunk header format: @@ -line,count +line,count @@
      const lines = diffRaw.split("\n");
      const changes = [];
      let currentFile = null;

      for (const line of lines) {
        if (line.startsWith("--- a/")) continue;
        if (line.startsWith("+++ b/")) {
          currentFile = line.substring(6);
          continue;
        }
        if (line.startsWith("@@")) {
          const match = line.match(/@@ -\d+(,\d+)? \+(\d+)(,(\d+))? @@/);
          if (match && currentFile) {
            changes.push({
              file: currentFile,
              lineStart: parseInt(match[2]),
              lineCount: parseInt(match[4] || "1"),
              header: line,
            });
          }
        }
      }

      return {
        hasChanges: summary.files.length > 0,
        changedFiles: summary.files.map((f) => f.path),
        structuredChanges: changes,
        diff: diffRaw.slice(0, 5000),
      };
    } catch (err) {
      return { error: err.message };
    }
  },
  {
    name: "getLocalFileDiff",
    description:
      "Returns local file changes with exact line numbers and modified files.",
    schema: z.object({}),
  }
);

export const getCommitStatus = tool(
  async ({ branch }) => {
    try {
      await git.fetch("origin");
      const currentBranch =
        branch || (await git.revparse(["--abbrev-ref", "HEAD"]));
      const remote = `origin/${currentBranch}`;

      const behind = await git.log({ from: "HEAD", to: remote });
      const ahead = await git.log({ from: remote, to: "HEAD" });

      const remoteDiffRaw = await git.diff(["HEAD", remote, "--unified=0"]);

      // Parse remote diff to find line numbers
      const lines = remoteDiffRaw.split("\n");
      const remoteChanges = [];
      let currentFile = null;

      for (const line of lines) {
        if (line.startsWith("--- a/")) continue;
        if (line.startsWith("+++ b/")) {
          currentFile = line.substring(6);
          continue;
        }
        if (line.startsWith("@@")) {
          const match = line.match(/@@ -\d+(,\d+)? \+(\d+)(,(\d+))? @@/);
          if (match && currentFile) {
            remoteChanges.push({
              file: currentFile,
              lineStart: parseInt(match[2]),
              lineCount: parseInt(match[4] || "1"),
              header: line,
            });
          }
        }
      }

      // Get files for behind commits
      const behindWithFiles = await Promise.all(
        behind.all.map(async (c) => {
          const filesRaw = await git.show([
            c.hash,
            "--name-only",
            "--pretty=format:",
          ]);
          const files = filesRaw.trim().split("\n").filter(Boolean);
          return { hash: c.hash.substring(0, 7), message: c.message, files };
        })
      );

      return {
        branch: currentBranch,
        aheadCount: ahead.total,
        behindCount: behind.total,
        behind: behindWithFiles,
        remoteDiff: remoteDiffRaw.slice(0, 5000),
        remoteStructuredChanges: remoteChanges,
      };
    } catch (err) {
      return { error: err.message };
    }
  },
  {
    name: "getCommitStatus",
    description:
      "Shows commits ahead/behind remote, includes remote diff and line-level changes to detect potential conflicts.",
    schema: z.object({
      branch: z.string().optional(),
    }),
  }
);

export const detectGithubRepo = tool(
  async () => {
    try {
      const remote = await git.remote(["get-url", "origin"]);
      const branch = await git.revparse(["--abbrev-ref", "HEAD"]);
      // Parse owner and repo from remote URL
      // e.g. https://github.com/ghoshvidip26/MergeGuard.git or git@github.com:ghoshvidip26/MergeGuard.git
      const match = remote.match(/github\.com[:/](.+)\/(.+)\.git/);
      return {
        remote,
        branch,
        owner: match ? match[1] : null,
        repo: match ? match[2] : null,
      };
    } catch (err) {
      return { error: err.message };
    }
  },
  {
    name: "detectRepo",
    description: "Detects git repo URL, branch, owner, and repo name.",
    schema: z.object({}),
  }
);

export const pullRemoteChanges = tool(
  async ({ branch }) => {
    try {
      const currentBranch =
        branch || (await git.revparse(["--abbrev-ref", "HEAD"]));
      const result = await git.pull("origin", currentBranch);
      return {
        success: true,
        summary: result.summary,
        files: result.files,
      };
    } catch (err) {
      return { error: err.message };
    }
  },
  {
    name: "pullRemoteChanges",
    description: "Pull updates from origin for a specific branch.",
    schema: z.object({
      branch: z.string().optional(),
    }),
  }
);
