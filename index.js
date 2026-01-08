#!/usr/bin/env node
import express from "express";
import cors from "cors";
import { config } from "dotenv";
import { ChatOllama } from "@langchain/ollama";
import {
  HumanMessage,
  ToolMessage,
  SystemMessage,
} from "@langchain/core/messages";
import http from "http";
import { Server } from "socket.io";
import { simpleGit } from "simple-git";

import { tools as allTools } from "./tools/index.js";
import { getCache, setCache } from "./tools/cache.js";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

config();

// EXPRESS
const app = express();
app.use(express.json());
app.use(cors());

const PORT = 3000;

// SOCKET.IO
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// GIT
const git = simpleGit();

// GLOBAL STATE
let lastState = {
  ahead: 0,
  behind: 0,
  changedFiles: [],
  remoteHash: "",
};

// MODEL
const model = new ChatOllama({
  model: "llama3.2:latest",
  baseUrl: "http://127.0.0.1:11434",
  temperature: 0,
  maxRetries: 3,
  requestTimeout: 120000,
});

const modelWithTools = model.bindTools(allTools);
const toolsMap = Object.fromEntries(allTools.map((t) => [t.name, t]));
// CLIENT CONNECT
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
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
      const githubRemote = remotes.find((r) => r.refs.push.includes("github.com"));
      remote = githubRemote ? githubRemote.refs.push : null;
    }

    if (!remote) throw new Error("No remote found");

    const branch = await git.revparse(["--abbrev-ref", "HEAD"]);

    // More robust regex for GitHub URLs (handles https, git@, and optional .git)
    const match = remote
      .trim()
      .match(/github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/);

    const owner = match?.[1] ?? "unknown";
    const repo = match?.[2] ?? "unknown";

    return `You are MergeGuard AI, monitoring repo ${owner}/${repo} on branch ${branch}.
Your goal is to provide a concise, fact-based safety analysis.

CRITICAL GUIDELINES:
1. ALWAYS use the data from tools (getLocalFileDiff, getCommitStatus).
2. 'aheadCount' = local commits NOT on remote.
3. 'behindCount' = remote commits NOT on local.
4. If 'behindCount' > 0, compare 'structuredChanges' (local) with 'remoteStructuredChanges' (remote):
   - RISK=HIGH: Changes on the same line or overlapping line ranges in the same file.
   - RISK=MEDIUM: Changes in the same file but in different line ranges.
   - RISK=LOW: Changes in the repository but in different files.
   - RISK=NONE: No changes or local branch is up-to-date with remote.
5. Whenever changes are detected, you MUST include a "📍 File Change Details" section.
   For each changed file, list:
   - File Path
   - Change Type (Local/Remote/Conflict)
   - Exact Line Numbers (from structuredChanges/remoteStructuredChanges)
   - Brief snippet of what changed
6. If RISK=HIGH or MEDIUM, you MUST provide a "⚔️ Conflict Resolution Strategy" section:
   - Available resolution options:
      - Accept Remote: \`git pull && git checkout --theirs <file>\`
      - Keep Local: \`git checkout --ours <file> && git add <file>\`
      - Manual Merge: \`git pull\` and resolve markers.
7. Avoid redundant prose. Do NOT restate commit counts or file names in the 'Analysis' section if they are already in the 'Details' section. Focus only on the *logic/risk* interaction.
8. Clean Output: Do NOT include commit hashes (e.g., ab12cd3), technical refs, or internal IDs in your report. Focus on file paths and line numbers only.
9. If github owner or repo name is 'unknown', do NOT call getGithubRepoSummary or getCommitsWithFiles.
10. Do NOT hallucinate numbers. Use exact tool values.
11. Format your response with clear, bold headers (using **bold** instead of ###):
   **🚩 ALERT: [RISK LEVEL] (Behind: [B], Ahead: [A])**
   
   **📍 File Change Details**
   
   **🧠 Analysis**
   
   **⚔️ Conflict Resolution Strategy**`;
  } catch {
    return "You are MergeGuard AI. Analyze the repository state and report file paths, line numbers, and changes precisely. Do not guess.";
  }
}

async function getRemoteBranchSafe() {
  try {
    const branch = await git.revparse(["--abbrev-ref", "HEAD"]);
    const remotes = await git.branch(["-r"]);

    const remoteBranch = `origin/${branch}`;

    if (!remotes.all.includes(remoteBranch)) {
      return null;
    }

    return remoteBranch;
  } catch {
    return null;
  }
}

// SAFE INVOKE
async function safeInvoke(messages) {
  for (let i = 0; i < 3; i++) {
    try {
      return await modelWithTools.invoke(messages);
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error("Model unreachable");
}

// MAIN ANALYZER
async function triggerAI(message = null) {
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
    io.emit("git_status", {
      status: "no-remote",
      message:
        "No remote branch detected for current branch. Push your repo first.",
      action: "git push -u origin HEAD",
    });
    return;
  }

  const ctx = await getRepoContext();

  const msgs = [new SystemMessage(ctx), new HumanMessage(query)];

  console.log("🧠 Requesting AI Analysis...");
  let ai = await safeInvoke(msgs);

  if (ai.tool_calls?.length) {
    msgs.push(ai);

    for (const call of ai.tool_calls) {
      const tool = toolsMap[call.name];
      if (!tool) continue;

      let result = {};

      try {
        result = await tool.invoke(call.args);
      } catch (e) {
        result = { error: e.message };
      }

      // Create a copy and trim large fields to prevent context overflow while keeping all relevant data
      const response = JSON.parse(JSON.stringify(result));

      if (response.diff && typeof response.diff === "string")
        response.diff = response.diff.slice(0, 2000);
      if (response.remoteDiff && typeof response.remoteDiff === "string")
        response.remoteDiff = response.remoteDiff.slice(0, 2000);
      if (Array.isArray(response.behind))
        response.behind = response.behind.slice(0, 5);
      if (Array.isArray(response.commits))
        response.commits = response.commits.slice(0, 5);
      if (Array.isArray(response.structuredChanges))
        response.structuredChanges = response.structuredChanges.slice(0, 10);
      if (Array.isArray(response.remoteStructuredChanges))
        response.remoteStructuredChanges = response.remoteStructuredChanges.slice(0, 10);

      const trimmed = response;

      console.log(`🛠 Executing tool: ${call.name}`);
      io.emit("tool_result", { tool: call.name, result: trimmed });

      msgs.push(
        new ToolMessage({
          tool_call_id: call.id,
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

  console.log("\n🤖 AI Analysis:\n");
  console.log(text);
  console.log("\n──────────────────────────────\n");

  io.emit("final_answer", { cached: false, content: text });

  setCache(cacheKey, text, 300);
}

// WATCHER
async function watchRepo() {
  try {
    await git.fetch();

    const status = await git.status();
    const branch = status.current;

    const changedFiles = status.files.map((f) => f.path);
    const remoteHash = await git.revparse([`origin/${branch}`]);

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
      changedFiles,
    };

    io.emit("git_status", lastState);

    if (status.behind > 0 || changedFiles.length > 0) {
      console.log(
        `🚩 Change detected! Behind: ${status.behind}, Local Changes: ${changedFiles.length}`
      );
      await triggerAI();
    } else {
      console.log("✅ Repo is clean and up to date.");
    }
  } catch (err) {
    console.log("Watcher error:", err.message);
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
  .help()
  .parseAsync()
  .then(async (argv) => {
    if (argv.analyze !== undefined) {
      const prompt =
        typeof argv.analyze === "string" && argv.analyze.length > 0
          ? argv.analyze
          : null;
      await triggerAI(prompt);
      if (!argv.watch) process.exit(0);
    }

    if (argv.watch) {
      console.log(`👀 Watcher enabled (Interval: ${argv.interval}ms)`);
      setInterval(watchRepo, argv.interval);
    }

    server.listen(PORT, () =>
      console.log(`🚀 MergeGuard running on http://localhost:${PORT}`)
    );
  });
