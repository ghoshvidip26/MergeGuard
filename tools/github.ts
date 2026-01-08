import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { Octokit } from "@octokit/rest";
import "dotenv/config";
import fs from "fs";
import path from "path";

const octokit = new Octokit({
  auth: process.env.GITHUB_API,
});

type GithubFile = {
  type: "file";
  content: string;
  encoding: BufferEncoding;
};

function isGithubFile(data: unknown): data is GithubFile {
  return (
    !!data &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    (data as any).type === "file" &&
    typeof (data as any).content === "string" &&
    typeof (data as any).encoding === "string"
  );
}

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

      const commitDetails = await octokit.rest.repos.getCommit({
        owner: githubOwner,
        repo: repoName,
        ref: "",
      });

      return {
        repo: `${githubOwner}/${repoName}`,
        defaultBranch,
        issues: issues.data,
        pulls: pulls.data,
        commits: commits.data,
        compare: compare.data,
        commitDetails: commitDetails.data,
      };
    } catch (err) {
      return { error: err ?? "Unknown error" };
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

export const getCommitsWithFiles = tool(
  async ({ owner, repo, limit = 10 }) => {
    const commitDetails = await octokit.rest.repos.listCommits({
      owner,
      repo,
      per_page: limit,
    });

    const results = [];

    for (const c of commitDetails.data) {
      const details = await octokit.rest.repos.getCommit({
        owner,
        repo,
        ref: c.sha,
      });

      results.push({
        sha: c.sha,
        message: c.commit.message,
        author: c.commit.author?.name,
        date: c.commit.author?.date,
        files:
          details.data.files?.map((f) => ({
            filename: f.filename,
            status: f.status,
            additions: f.additions,
            deletions: f.deletions,
          })) ?? [],
      });
    }

    return results;
  },
  {
    name: "getCommitsWithFiles",
    description:
      "Return recent commits along with the list of files changed in each commit.",
    schema: z.object({
      owner: z.string(),
      repo: z.string(),
      limit: z.number().optional(),
    }),
  }
);

import { Buffer } from "buffer";

export const getGithubFileContent = tool(
  async ({ githubOwner, repoName, filePath, ref }) => {
    try {
      const { data } = await octokit.rest.repos.getContent({
        owner: githubOwner,
        repo: repoName,
        path: filePath,
        ref: ref ?? "main",
      });

      if (!isGithubFile(data)) {
        throw new Error("Path is not a file or file content unavailable");
      }

      const decoded = Buffer.from(data.content, data.encoding).toString("utf8");

      return {
        repo: `${githubOwner}/${repoName}`,
        filePath,
        ref: ref ?? "main",
        fileMeta: data,
        fileContent: decoded,
      };
    } catch (err) {
      return { error: err ?? "File not found" };
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

export const listLocalFiles = tool(
  async ({ dirPath }) => {
    try {
      const targetPath = dirPath || ".";
      const files = fs.readdirSync(targetPath, { withFileTypes: true });

      return files.map((file) => ({
        name: file.name,
        isDirectory: file.isDirectory(),
        extension: path.extname(file.name),
      }));
    } catch (err) {
      return { error: err ?? "Could not read directory" };
    }
  },
  {
    name: "list_files",
    description:
      "List files in the local project directory to understand the project structure.",
    schema: z.object({
      dirPath: z
        .string()
        .optional()
        .describe("The directory path to list files from (default is .)"),
    }),
  }
);
