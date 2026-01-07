import { tool } from "@langchain/core/tools";
import { z } from "zod";
import simpleGit from "simple-git";

const git = simpleGit();

/**
 * 🔹 Detect if local repo is behind remote + return diff & missing commits
 */
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
    description: "Fetch updates from a specific git remote (default is origin).",
    schema: z.object({
      remote: z.string().optional(),
    }),
  }
);
