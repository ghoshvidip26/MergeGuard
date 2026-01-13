#!/usr/bin/env node

import express from "express";
import cors from "cors";
import { config } from "dotenv";
import { model } from "../utils/LLM.js";
import {
  HumanMessage,
  ToolMessage,
  SystemMessage,
  BaseMessage,
} from "@langchain/core/messages";
import http from "http";
import { Server } from "socket.io";
import chalk from "chalk";
import { tools as allTools } from "../tools/index.js";
import { getCache, setCache } from "../tools/cache.js";
import { fetchIfOld } from "../tools/gitLocal.js";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { logger } from "../utils/LLM.js";
import { git } from "../utils/LLM.js";
import { chat } from "../RAG/index.js";
config();

// EXPRESS
const app = express();
app.use(express.json());
app.use(cors());

const PORT = 3000;

// SOCKET.IO
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// GLOBAL STATE
let lastState = {
  ahead: 0,
  behind: 0,
  changedFiles: [],
  remoteHash: "",
};

const modelWithTools = model.bindTools(allTools);
const toolsMap = Object.fromEntries(allTools.map((t) => [t.name, t]));
// CLIENT CONNECT
io.on("connection", (socket) => {
  logger.info(chalk.green(`Client connected: ${socket.id}`));
  socket.emit("status", { message: "Connected to MergeGuard" });
});

// DYNAMIC PROMPT
async function getRepoContext() {
  try {
    let remote;
    try {
      remote = await git.remote(["get-url", "origin"]);
    } catch {
      // Fallback: try to find any github remote
      const remotes = await git.getRemotes(true);
      const githubRemote = remotes.find((r) =>
        r.refs.push.includes("github.com")
      );
      remote = githubRemote ? githubRemote.refs.push : null;
    }

    const branch = await git.revparse(["--abbrev-ref", "HEAD"]);
    let owner = "unknown";
    let repo = "unknown";

    if (remote) {
      // More robust regex for GitHub URLs (handles https, git@, and optional .git)
      const match = remote
        .trim()
        .match(/github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/);

      owner = match?.[1] ?? "unknown";
      repo = match?.[2] ?? "unknown";
    }
    return `You are MergeGuard AI, monitoring repo ${owner}/${repo} on branch ${branch}.
Your goal is to provide a concise, fact-based safety analysis.

CRITICAL GUIDELINES:
1. ALWAYS use the data from tools: getLocalFileDiff and getCommitStatus.
2. 'aheadCount' = local commits NOT on remote.
3. 'behindCount' = remote commits NOT on local.
4. If 'behindCount' > 0, compare:
   - structuredChanges (local)
   - remoteStructuredChanges (remote)

   Risk classification:
   - RISK=HIGH: Same file AND overlapping line ranges.
   - RISK=MEDIUM: Same file, different line ranges.
   - RISK=LOW: Different files.
   - RISK=NONE: No changes OR branch is up-to-date.

5. Whenever changes are detected, you MUST include a **📍 File Change Details** section.

   You MUST read file-level data ONLY from:
   TOOL OUTPUTS → fileDetails[]

   Each file entry contains:
   - path
   - statusStr
   - isNew
   - hunks[]

   hunks format:
   {
     lineStart: number,
     lineEnd: number,
     added: string[],
     removed: string[]
   }

   You MUST render line numbers using:
   "Lines <lineStart>-<lineEnd>"

   If hunks[] is empty, write:
   "No line-level diff (file replaced or binary change)"

6. If RISK is HIGH or MEDIUM, you MUST include a **⚔️ Conflict Resolution Strategy** section.
   You MUST NOT choose a strategy automatically.
   Present the following options ONLY:

   Accept Remote:
   - Run 'git pull'
   - If conflicts occur:
     - 'git checkout --theirs <file>'
     - 'git add <file>'

   Keep Local:
   - During a merge conflict:
     - 'git checkout --ours <file>'
     - 'git add <file>'
   - Complete merge with 'git commit'

   Manual Merge:
   - Run 'git pull'
   - Manually resolve conflict markers in affected files

7. Avoid redundant prose.
   - Do NOT restate commit counts or file names in the Analysis section if already listed in Details.
   - Focus ONLY on the logic/risk interaction.

8. Clean Output Rules:
   - Do NOT include commit hashes, refs, SHAs, or internal IDs.
   - Report ONLY file paths and line numbers.

9. If GitHub owner or repo name is 'unknown':
   - Do NOT call getGithubRepoSummary
   - Do NOT call getCommitsWithFiles

10. Do NOT hallucinate.
    - Use ONLY fileDetails and hunks from TOOL OUTPUTS.
    - If fileDetails is empty, say "No changes detected."

11. Final response MUST use the following bold headers (no markdown ###):

🚩 ALERT: [RISK LEVEL] (Behind: [B], Ahead: [A])

📍 File Change Details

🧠 Analysis

⚔️ Conflict Resolution Strategy

12. If 'Commits Ahead' or 'Commits Behind' > 0, you MUST call getCommitStatus.
13. If 'Uncommitted Local Files' > 0, you MUST call getLocalFileDiff.

14. When rendering File Change Details:

DO NOT print raw JSON keys like:
"path", "statusStr", "isNew", "hunks"

You MUST format each file exactly as:

<file path>
  - Change Type: Local | Remote | Conflict
  - Exact Line Numbers: Lines X-Y, Lines A-B
  - File Creation Status: "New file created" or "Modified"
`;
  } catch {
    return "You are MergeGuard AI. Analyze the repository state and report file paths, line numbers, and changes precisely. Do not guess.";
  }
}

function colorizeRisk(output: string) {
  if (
    output.includes("🚩 ALERT: RISK=HIGH") ||
    output.includes("🚩 ALERT: HIGH")
  )
    return chalk.redBright(output);
  if (
    output.includes("🚩 ALERT: RISK=MEDIUM") ||
    output.includes("🚩 ALERT: MEDIUM")
  )
    return chalk.red(output);
  if (output.includes("🚩 ALERT: RISK=LOW") || output.includes("🚩 ALERT: LOW"))
    return chalk.yellow(output);
  if (
    output.includes("🚩 ALERT: RISK=NONE") ||
    output.includes("🚩 ALERT: NONE")
  )
    return chalk.green(output);
  return output;
}

async function getRemoteBranchSafe() {
  try {
    const branch = await git.revparse(["--abbrev-ref", "HEAD"]);
    const remotes = await git.branch(["-r"]);

    const remoteBranch = `origin/${branch}`;

    if (remotes.all.includes(remoteBranch)) {
      return remoteBranch;
    }

    // Fallback to origin/main if the current branch doesn't exist on remote
    if (remotes.all.includes("origin/main")) {
      logger.info(
        chalk.yellow(
          `ℹ️ Branch origin/${branch} not found. Defaulting to origin/main for comparison.`
        )
      );
      return "origin/main";
    }

    return null;
  } catch {
    return null;
  }
}

// SAFE INVOKE
async function safeInvoke(messages: any) {
  for (let i = 0; i < 3; i++) {
    try {
      return await modelWithTools.invoke(messages);
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error("Model unreachable");
}

function renderUnified(
  fileDetails: any[],
  risk: string,
  behind: number,
  ahead: number
) {
  let out = `🚩 ALERT: ${risk} (Behind: ${behind}, Ahead: ${ahead})\n\n📍 File Change Details\n`;

  for (const f of fileDetails) {
    out += `- ${f.path}\n`;
    out += `  - Change Type: ${f.source || "Local"}\n`;
    out += `  - Status: ${f.status || "M"}\n`;
    out += `  - File Creation Status: ${
      f.isNew ? "New file created" : "Modified"
    }\n`;

    if (!f.hunks || f.hunks.length === 0) {
      out += `  - Exact Line Numbers: No line-level diff (file replaced or binary change)\n`;
    } else {
      const ranges = f.hunks.map(
        (h: any) => `Lines ${h.lineStart}-${h.lineEnd}`
      );
      out += `  - Exact Line Numbers: ${ranges.join(", ")}\n`;
    }
  }

  return out;
}

// MAIN ANALYZER
async function triggerAI(message: string = "") {
  try {
    const query =
      message ??
      "Analyze repository safety. Detect local changes and remote updates. Report merge-conflict risk.";

    const cacheKey = `${lastState.remoteHash}:${lastState.changedFiles.join(
      ","
    )}:${query}`;

    const cached = getCache(cacheKey);
    if (cached) {
      io.emit("final_answer", { cached: true, content: cached });
      return;
    }

    const remoteBranch = await getRemoteBranchSafe();

    if (!remoteBranch) {
      logger.info(
        chalk.yellow(
          "⚠️ No remote branch detected. Analyzing local changes only."
        )
      );
      io.emit("git_status", {
        status: "no-remote",
        message:
          "No remote branch detected for current branch. Analysis will focus on local changes.",
      });
    }

    const ctx = await getRepoContext();

    const summaryMsg = `Repository Status Summary:
- Commits Ahead: ${lastState.ahead}
- Commits Behind: ${lastState.behind}
- Uncommitted Local Files: ${lastState.changedFiles.length}
- Changed Files: ${JSON.stringify(lastState.changedFiles)}
- Target Remote: ${remoteBranch ?? "None (Local Only)"}

Task: ${query}`;

    const msgs: BaseMessage[] = [
      new SystemMessage(ctx),
      new HumanMessage(summaryMsg),
    ];

    // PRE-CALL TOOLS: Get data directly and inject into context
    let toolResults = "";
    let localFileResults: any = null;

    if (lastState.changedFiles.length > 0) {
      const localDiffTool = toolsMap["getLocalFileDiff"];
      localFileResults = await (localDiffTool as any).invoke({});
      toolResults += `\n\nLOCAL FILE DIFF RESULTS:\n${JSON.stringify(
        localFileResults,
        null,
        2
      )}`;
    }

    if (lastState.ahead > 0 || lastState.behind > 0) {
      const commitStatusTool = toolsMap["getCommitStatus"];
      const result = await (commitStatusTool as any).invoke({});
      toolResults += `\n\nCOMMIT STATUS RESULTS:\n${JSON.stringify(
        result,
        null,
        2
      )}`;
    }

    // Add tool results to the human message
    msgs[1] = new HumanMessage(summaryMsg + toolResults);

    logger.info(chalk.bgBlue("🧠 Requesting AI Analysis..."));
    let ai = await safeInvoke(msgs);

    if (ai.tool_calls?.length) {
      msgs.push(ai);

      for (const call of ai.tool_calls) {
        const tool = toolsMap[call.name];
        if (!tool) continue;

        let result = {};

        try {
          result = await (tool as any).invoke(call.args);
        } catch (e: any) {
          result = { error: e.message };
        }

        // Create a copy and trim large fields to prevent context overflow while keeping all relevant data
        const response = JSON.parse(JSON.stringify(result));
        // 🔑 Attach hunks to files so LLM knows line numbers per file
        if (response.changedFiles) {
          const hunksByFile: Record<string, any[]> = {};

          // Map hunks if they exist
          if (response.structuredChanges) {
            for (const h of response.structuredChanges) {
              if (!hunksByFile[h.file]) hunksByFile[h.file] = [];
              hunksByFile[h.file].push({
                lineStart: h.lineStart,
                lineEnd: h.lineStart + h.lineCount - 1,
                added: h.added,
                removed: h.removed,
              });
            }
          }

          response.fileDetails = response.changedFiles.map((f: any) => ({
            path: f.path,
            statusStr: f.statusStr,

            isNew: f.index === "A" && f.working_dir !== "M",

            // 🚨 THIS IS THE FIX
            source: "local",

            hunks: hunksByFile[f.path] || [],
          }));
        }

        if (
          response.remoteStructuredChanges &&
          Array.isArray(response.remoteStructuredChanges)
        )
          response.remoteStructuredChanges =
            response.remoteStructuredChanges.slice(0, 15);
        if (
          response.localStructuredChanges &&
          Array.isArray(response.localStructuredChanges)
        )
          response.localStructuredChanges =
            response.localStructuredChanges.slice(0, 15);
        if (
          response.structuredChanges &&
          Array.isArray(response.structuredChanges)
        )
          response.structuredChanges = response.structuredChanges.slice(0, 15);

        const trimmed = response;

        logger.info(chalk.blue(`🛠 Executing tool: ${call.name}`));
        io.emit("tool_result", { tool: call.name, result: trimmed });

        msgs.push(
          new ToolMessage({
            tool_call_id: call.id as any,
            name: call.name,
            content: JSON.stringify(trimmed),
          })
        );
      }

      ai = await safeInvoke(msgs);
    }

    const text = Array.isArray(ai.content)
      ? ai.content.map((x) => x.text ?? "").join("")
      : ai.content ?? "";

    // Enhanced fallback detection
    const hasNoToolCalls = !ai.tool_calls?.length;
    const hasGenericResponse =
      text.includes("Lines X-Y, Lines A-B") ||
      text.includes("No changes were found") ||
      text.includes("no changes detected") ||
      text.includes("Since there are no changes detected");

    if (
      hasNoToolCalls &&
      (hasGenericResponse || lastState.changedFiles.length > 0)
    ) {
      // Use the pre-fetched localFileResults if available, otherwise get status
      let fileDetails = [];
      if (localFileResults && localFileResults.changedFiles) {
        const hunksByFile: Record<string, any[]> = {};
        if (localFileResults.structuredChanges) {
          for (const h of localFileResults.structuredChanges) {
            if (!hunksByFile[h.file]) hunksByFile[h.file] = [];
            hunksByFile[h.file].push({
              lineStart: h.lineStart,
              lineEnd: h.lineStart + h.lineCount - 1,
            });
          }
        }

        fileDetails = localFileResults.changedFiles.map((f: any) => ({
          path: f.path,
          isNew: f.index === "?" || f.index === "A",
          status: f.working_dir || f.index,
          source: "Local",
          hunks: hunksByFile[f.path] || [],
        }));
      } else {
        const status = await git.status();
        fileDetails = status.files.map((f) => ({
          path: f.path,
          isNew: f.index === "?" || f.index === "A",
          status: f.working_dir || f.index,
          source: "Local",
          hunks: [],
        }));
      }

      const risk = lastState.behind > 0 ? "MEDIUM" : "LOW";
      const fallbackText =
        renderUnified(fileDetails, risk, lastState.behind, lastState.ahead) +
        `\n🧠 Analysis\nFound ${fileDetails.length} uncommitted ${
          fileDetails.length === 1 ? "file" : "files"
        }. ` +
        (lastState.behind > 0
          ? `The remote branch is ${lastState.behind} commit${
              lastState.behind > 1 ? "s" : ""
            } ahead. `
          : "") +
        `Review these changes before proceeding.`;

      logger.info(chalk.bgGreen("\n🤖 AI Analysis (Unified):\n"));
      logger.info(colorizeRisk(fallbackText));

      io.emit("final_answer", {
        cached: false,
        content: fallbackText,
        isFallback: true,
      });
      setCache(cacheKey, fallbackText, 300);
    } else {
      logger.info(chalk.bgGreen("\n🤖 AI Analysis:\n"));
      logger.info(colorizeRisk(text));
      io.emit("final_answer", {
        cached: false,
        content: text,
        isFallback: false,
      });
      setCache(cacheKey, text, 300);
    }
  } catch (err: any) {
    logger.error(`AI Analysis Error: ${err.message}`);
    io.emit("final_answer", {
      error: true,
      content: `Analysis failed: ${err.message}`,
    });
  }
}

// WATCHER
async function watchRepo() {
  try {
    await fetchIfOld();

    const status = await git.status();
    const branch = status.current;

    const changedFiles = status.files.map((f) => f.path);

    // Safely check for remote branch existence
    const remotes = await git.branch(["-r"]);
    const remoteBranch = branch ? `origin/${branch}` : null;
    let remoteHash = "";

    if (remoteBranch) {
      try {
        remoteHash = await git.revparse([remoteBranch]);
      } catch {
        // Remote branch doesn't exist or isn't fetchable yet
        remoteHash = "";
      }
    }

    const changed =
      status.ahead !== lastState.ahead ||
      status.behind !== lastState.behind ||
      remoteHash !== lastState.remoteHash ||
      JSON.stringify(changedFiles) !== JSON.stringify(lastState.changedFiles);

    if (!changed) return;
    lastState = {
      ahead: status.ahead,
      behind: status.behind,
      remoteHash,
      changedFiles: changedFiles as any,
    };

    io.emit("git_status", lastState);

    if (status.behind > 0 || changedFiles.length > 0) {
      logger.info(
        chalk.yellow(
          `🚩 Change detected! Behind: ${status.behind}, Local Changes: ${changedFiles.length}`
        )
      );
      await triggerAI();
    } else {
      logger.info(chalk.green("✅ Repo is clean and up to date."));
    }
  } catch (err: any) {
    logger.error(`Watcher error: ${err.message}`);
  }
}
// MANUAL TRIGGER ENDPOINT
app.post("/retrieve", async (req, res) => {
  await triggerAI(req.body?.message);
  res.json({ success: true });
});

// CLI HANDLER
yargs(hideBin(process.argv))
  .option("watch", {
    alias: "w",
    type: "boolean",
    description: "Start server with repository watcher active",
  })
  .option("interval", {
    alias: "i",
    type: "number",
    default: 5000,
    description: "Polling interval in milliseconds",
  })
  .option("analyze", {
    alias: "a",
    type: "string",
    description: "Run one-time AI analysis (optional: custom prompt)",
  })
  .option("chat", {
    alias: "c",
    type: "boolean",
    description: "Start interactive chat about the repository",
  })

  .help()
  .parseAsync()
  .then(async (argv) => {
    if (argv.analyze !== undefined) {
      const prompt =
        typeof argv.analyze === "string" && argv.analyze.length > 0
          ? argv.analyze
          : null;
      if (prompt) {
        await triggerAI(prompt);
      }

      if (!argv.watch) process.exit(0);
    }

    // CHAT MODE — no watcher, no server
    if (argv.chat) {
      await chat();
      process.exit(0);
    }

    // WATCH MODE
    if (argv.watch) {
      logger.info(
        chalk.greenBright(`👀 Watcher enabled (Interval: ${argv.interval}ms)`)
      );
      setInterval(watchRepo, argv.interval);
    }

    // SERVER MODE
    server.listen(PORT, () =>
      logger.info(
        chalk.green(`🚀 MergeGuard running on http://localhost:${PORT}`)
      )
    );
  });
