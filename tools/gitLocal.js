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
    const diff = await git.diff(["--unified=0"]);
    return { diff };
  },
  {
    name: "getLocalFileDiff",
    description: "Returns local file changes with exact line numbers.",
    schema: z.object({}),
  }
);

export const getCommitStatus = tool(
  async ({ branch }) => {
    try {
      await git.fetch("origin");
      const currentBranch = branch || (await git.revparse(["--abbrev-ref", "HEAD"]));
      const behind = await git.log({ from: "HEAD", to: `origin/${currentBranch}` });
      const ahead = await git.log({ from: `origin/${currentBranch}`, to: "HEAD" });
      
      return {
        branch: currentBranch,
        ahead: ahead.all.map(c => ({ hash: c.hash.substring(0,7), message: c.message })),
        behind: behind.all.map(c => ({ hash: c.hash.substring(0,7), message: c.message })),
        aheadCount: ahead.total,
        behindCount: behind.total,
      };
    } catch (err) {
      return { error: err.message };
    }
  },
  {
    name: "getCommitStatus",
    description: "Shows commits ahead/behind remote for a branch.",
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
        repo: match ? match[2] : null
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
