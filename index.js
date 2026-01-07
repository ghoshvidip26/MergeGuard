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
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

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
    const remote = await git.remote(["get-url", "origin"]);
    const branch = await git.revparse(["--abbrev-ref", "HEAD"]);

    const match = remote.match(/github\.com[:/](.+?)\/(.+?)(\.git)?$/);

    const owner = match?.[1] ?? "unknown";
    const repo = match?.[2] ?? "unknown";

    return `You are monitoring repo ${owner}/${repo} on branch ${branch}.
Always:
1) call getLocalFileDiff
2) call getCommitStatus
NEVER assume risk without tool data.
Always output facts.`;
  } catch {
    return "You are working on a GitHub repo. Detect details using tools.";
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

      const trimmed = {
        success: result?.success,
        hasChanges: result?.hasChanges,
        changedFiles: result?.changedFiles,
        structuredChanges: result?.structuredChanges,
        aheadCount: result?.aheadCount,
        behindCount: result?.behindCount,
        commits: result?.commits?.slice?.(0, 5),
      };

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
      JSON.stringify(changedFiles) !==
        JSON.stringify(lastState.changedFiles);

    if (!changed) return;

    lastState = {
      ahead: status.ahead,
      behind: status.behind,
      remoteHash,
      changedFiles,
    };

    io.emit("git_status", lastState);

    if (status.behind > 0 || changedFiles.length > 0) {
      console.log(`🚩 Change detected! Behind: ${status.behind}, Local Changes: ${changedFiles.length}`);
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
  .help()
  .parseAsync()
  .then(async(argv) => {
    if (argv.watch) {
      console.log("👀 Watcher enabled");
      await setInterval(watchRepo, 5000);
    }

    server.listen(PORT, () =>
      console.log(`🚀 MergeGuard running on http://localhost:${PORT}`)
    );
  });
