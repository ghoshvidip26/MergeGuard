import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { simpleGit, type SimpleGit } from "simple-git";

const git: SimpleGit = simpleGit({
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
    } catch {
      // Ignore fetch errors in throttle (offline?)
    }
  }
}

async function getRemoteBranchSafe(): Promise<string | null> {
  try {
    const branch = await git.revparse(["--abbrev-ref", "HEAD"]);
    const remotes = await git.branch(["-r"]);

    const direct = `origin/${branch}`;
    if (remotes.all.includes(direct)) return direct;

    if (remotes.all.includes("origin/main")) return "origin/main";
    return null;
  } catch {
    return null;
  }
}

/* ---------------------------------------------------
   FIXED: parseDiff function
--------------------------------------------------- */
function parseDiff(diffRaw: string) {
  if (!diffRaw || diffRaw.trim().length === 0) {
    return [];
  }

  const lines = diffRaw.split("\n");
  const changes: any[] = [];
  let currentFile: string | null = null;

  for (const line of lines) {
    // Extract filename from: diff --git a/file.ts b/file.ts
    if (line.startsWith("diff --git")) {
      const match = line.match(/diff --git a\/(.+?) b\/(.+)/);
      if (match) {
        const file = match[2].trim();
        currentFile = isRealSource(file) ? file : null;
      }
      continue;
    }

    // Parse hunk header: @@ -oldStart,oldCount +newStart,newCount @@
    if (line.startsWith("@@") && currentFile) {
      const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      if (match) {
        const newStart = parseInt(match[3]);
        const newCount = parseInt(match[4] || "1");

        changes.push({
          file: currentFile,
          lineStart: newStart,
          lineCount: newCount,
        });
      }
    }
  }

  return changes;
}

/** Extract changed files + lines from a commit (deprecated for bulk use) */
export async function getCommitFiles(hash: string) {
  const diff = await git.show([hash, "--unified=0"]);
  return parseDiff(diff).map((c) => ({
    path: c.file,
    lines: Array.from({ length: c.lineCount }, (_, i) => c.lineStart + i),
  }));
}

/* ---------------------------------------------------
   File filtering
--------------------------------------------------- */
const IGNORED_PATHS = [
  "dist/",
  "node_modules/",
  ".map",
  ".d.ts",
  "build/",
  ".next/",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
];

function isRealSource(file: string) {
  return !IGNORED_PATHS.some((p) => file.includes(p));
}

const statusCodeMap: Record<string, string> = {
  " ": "Unmodified",
  M: "Modified",
  A: "Added",
  D: "Deleted",
  R: "Renamed",
  C: "Copied",
  U: "Updated but unmerged",
  "?": "Untracked",
};

/* ---------------------------------------------------
   getLocalFileDiff (Uncommitted changes)
--------------------------------------------------- */
export const getLocalFileDiff = tool(
  async () => {
    try {
      const status = await git.status();
      
      // Get diff of uncommitted changes
      const diffRaw = await git.diff(["--unified=0"]);
      
      // Parse the diff
      const changes = parseDiff(diffRaw);

      // Filter to real source files
      const realFiles = status.files
        .map((f) => f.path)
        .filter(isRealSource);

      // ✅ DEBUG LOGGING (remove in production)
      console.log("\n📋 getLocalFileDiff Debug:");
      console.log(`   Files in status: ${status.files.length}`);
      console.log(`   Real source files: ${realFiles.length}`);
      console.log(`   Parsed changes: ${changes.length}`);
      if (changes.length > 0) {
        console.log("   Files with line changes:");
        changes.forEach(c => {
          console.log(`     - ${c.file}: lines ${c.lineStart}-${c.lineStart + c.lineCount - 1}`);
        });
      }

      return {
        success: true,
        hasChanges: realFiles.length > 0,
        changedFiles: status.files
          .filter((f) => isRealSource(f.path))
          .map((f) => ({
            path: f.path,
            index: f.index,
            working_dir: f.working_dir,
            statusStr:
              statusCodeMap[f.working_dir] ||
              statusCodeMap[f.index] ||
              "Unknown",
          })),
        structuredChanges: changes,
      };
    } catch (e: any) {
      console.error("❌ getLocalFileDiff error:", e.message);
      return { 
        success: false,
        error: e.message,
        hasChanges: false,
        changedFiles: [],
        structuredChanges: []
      };
    }
  },
  {
    name: "getLocalFileDiff",
    description: "Returns uncommitted local changes with exact line numbers.",
    schema: z.object({}),
  }
);

/* ---------------------------------------------------
   getCommitStatus (Remote vs Local commits)
--------------------------------------------------- */
export const getCommitStatus = tool(
  async ({ skipFetch }) => {
    try {
      if (!skipFetch) {
        await fetchIfOld();
      }

      const remote = await getRemoteBranchSafe();
      if (!remote) {
        return {
          success: true,
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

      const remoteStructuredChanges = parseDiff(remoteDiffRaw).filter((h) =>
        isRealSource(h.file)
      );

      const localStructuredChanges = parseDiff(localDiffRaw).filter((h) =>
        isRealSource(h.file)
      );

      // ✅ DEBUG LOGGING (remove in production)
      console.log("\n📋 getCommitStatus Debug:");
      console.log(`   Behind: ${behind.total} commits`);
      console.log(`   Ahead: ${ahead.total} commits`);
      console.log(`   Remote changes: ${remoteStructuredChanges.length} files`);
      console.log(`   Local changes: ${localStructuredChanges.length} files`);
      if (remoteStructuredChanges.length > 0) {
        console.log("   Remote files:");
        remoteStructuredChanges.forEach(c => {
          console.log(`     - ${c.file}: lines ${c.lineStart}-${c.lineStart + c.lineCount - 1}`);
        });
      }

      return {
        success: true,
        aheadCount: ahead.total,
        behindCount: behind.total,
        remoteChanges: behind.all.map((c) => ({
          message: c.message,
          hash: c.hash.substring(0, 7),
        })),
        localChanges: ahead.all.map((c) => ({
          message: c.message,
          hash: c.hash.substring(0, 7),
        })),
        remoteStructuredChanges,
        localStructuredChanges,
      };
    } catch (e: any) {
      console.error("❌ getCommitStatus error:", e.message);
      return { 
        success: false,
        error: e.message,
        aheadCount: 0,
        behindCount: 0,
        remoteChanges: [],
        localChanges: [],
        remoteStructuredChanges: [],
        localStructuredChanges: []
      };
    }
  },
  {
    name: "getCommitStatus",
    description:
      "Returns commit-level file & line changes between local and remote. Use skipFetch=true if repo was recently fetched.",
    schema: z.object({
      branch: z.string().optional(),
      skipFetch: z.boolean().optional(),
    }),
  }
);

/* ---------------------------------------------------
   detectGithubRepo
--------------------------------------------------- */
export const detectGithubRepo = tool(
  async () => {
    try {
      let remote;
      try {
        const remoteResult = await git.remote(["get-url", "origin"]);
        remote = remoteResult ? remoteResult.trim() : null;
      } catch {
        const remotes = await git.getRemotes(true);
        const githubRemote = remotes.find((r: any) =>
          r.refs.push.includes("github.com")
        );
        remote = githubRemote ? githubRemote.refs.push.trim() : null;
      }
      
      if (!remote) {
        throw new Error("GitHub remote not found.");
      }
      
      const branchResult = await git.revparse(["--abbrev-ref", "HEAD"]);
      const branch = branchResult ? branchResult.trim() : "main";
      
      const match = remote.match(/github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/);
      
      return {
        success: true,
        remote,
        branch,
        owner: match ? match[1] : null,
        repo: match ? match[2] : null,
      };
    } catch (err: any) {
      return { 
        success: false,
        error: err.message 
      };
    }
  },
  {
    name: "detectRepo",
    description: "Detects git repo URL, branch, owner, and repo name.",
    schema: z.object({}),
  }
);

/* ---------------------------------------------------
   pullRemoteChanges
--------------------------------------------------- */
export const pullRemoteChanges = tool(
  async ({}) => {
    try {
      const branchResult = await git.revparse(["--abbrev-ref", "HEAD"]);
      const branch = branchResult ? branchResult.trim() : "main";
      
      const res = await git.pull("origin", branch);
      
      return { 
        success: true, 
        summary: res.summary 
      };
    } catch (e: any) {
      return { 
        success: false,
        error: e.message 
      };
    }
  },
  {
    name: "pullRemoteChanges",
    description: "Pulls from origin for the current branch.",
    schema: z.object({}),
  }
);