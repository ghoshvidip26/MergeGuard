import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { Octokit } from "@octokit/rest";
import "dotenv/config";
import fs from "fs";
import path from "path";

const octokit = new Octokit({
  auth: process.env.GITHUB_API,
});

export const getGithubRepoSummary = tool(
  async ({ githubOwner, repoName }) => {
    try {
      const [issues, pulls, commits, repoInfo] = await Promise.all([
        octokit.rest.issues.listForRepo({
          owner: githubOwner,
          repo: repoName,
          state: "open",
          per_page: 10,
        }),
        octokit.rest.pulls.list({
          owner: githubOwner,
          repo: repoName,
          state: "open",
          per_page: 10,
        }),
        octokit.rest.repos.listCommits({
          owner: githubOwner,
          repo: repoName,
          per_page: 10,
        }),
        octokit.rest.repos.get({
          owner: githubOwner,
          repo: repoName,
        }),
      ]);

      const defaultBranch = repoInfo.data.default_branch;

      const compare = await octokit.rest.repos.compareCommits({
        owner: githubOwner,
        repo: repoName,
        base: defaultBranch,
        head: defaultBranch,
      });

      return {
        repo: `${githubOwner}/${repoName}`,
        defaultBranch,
        issues: issues.data,
        pulls: pulls.data,
        commits: commits.data,
        compare: compare.data,
      };
    } catch (err) {
      return { error: err?.message ?? "Unknown error" };
    }
  },
  {
    name: "getGithubRepoSummary",
    description:
      "Get a summary of a GitHub repository, including open issues, pull requests, and recent commits.",
    schema: z.object({
      githubOwner: z.string(),
      repoName: z.string(),
    }),
  }
);

import { Buffer } from "buffer";

export const getGithubFileContent = tool(
  async ({ githubOwner, repoName, filePath, ref }) => {
    try {
      const res = await octokit.rest.repos.getContent({
        owner: githubOwner,
        repo: repoName,
        path: filePath,
        ref: ref ?? "main",
      });

      if (Array.isArray(res.data)) {
        return { error: "Path is a directory, not a file." };
      }

      const decoded = Buffer.from(res.data.content, res.data.encoding).toString(
        "utf8"
      );

      return {
        repo: `${githubOwner}/${repoName}`,
        filePath,
        ref: ref ?? "main",
        fileMeta: res.data,
        fileContent: decoded,
      };
    } catch (err) {
      return { error: err?.message ?? "File not found" };
    }
  },
  {
    name: "getGithubFileContent",
    description:
      "Fetch and return the decoded content of a specific file from a GitHub repository.",
    schema: z.object({
      githubOwner: z.string(),
      repoName: z.string(),
      filePath: z.string(),
      ref: z.string().optional(), // optional branch/tag/SHA
    }),
  }
);

import { simpleGit } from "simple-git";

const git = simpleGit();

export const getLocalVsRemoteDiff = tool(
  async ({ remoteBranch }) => {
    try {
      await git.fetch("origin");

      const branch = remoteBranch ?? "main";
      console.log(branch);
      const remote = `origin/${branch}`;
      console.log(remote);
      // commits you DON'T have yet
      const behindLog = await git.log({ from: "HEAD", to: remote });
      console.log(behindLog);
      const status =
        behindLog.total > 0 ? "behind-remote" : "up-to-date";

      const diff = await git.diff(["HEAD", remote]);

      const missingCommits = behindLog.all
        .map(
          (c) => `${c.hash.substring(0, 7)} ${c.message}`
        )
        .join("\n");

      return {
        remoteBranch: branch,
        status,
        missingCommits,
        diff,
      };
    } catch (err) {
      return { error: err?.message ?? "Git unavailable" };
    }
  },
  {
    name: "getLocalVsRemoteDiff",
    description:
      "Compare the local git state with the remote origin branch and return missing commits and diff.",
    schema: z.object({
      remoteBranch: z.string().optional(),
    }),
  }
);

export const listLocalFiles = tool(
  async ({ dirPath }) => {
    try {
      const targetPath = dirPath || ".";
      const files = fs.readdirSync(targetPath, { withFileTypes: true });
      
      return files.map(file => ({
        name: file.name,
        isDirectory: file.isDirectory(),
        extension: path.extname(file.name)
      }));
    } catch (err) {
      return { error: err?.message ?? "Could not read directory" };
    }
  },
  {
    name: "list_files",
    description: "List files in the local project directory to understand the project structure.",
    schema: z.object({
      dirPath: z.string().optional().describe("The directory path to list files from (default is .)"),
    }),
  }
);
