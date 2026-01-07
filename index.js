import express from "express";
import cors from "cors";
import { config } from "dotenv";
import { ChatOllama } from "@langchain/ollama";
import {
  HumanMessage,
  ToolMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { Server } from "socket.io";
import http from "http";
import { tools as allTools } from "./tools/index.js";
import { getCache, setCache } from "./tools/cache.js";

config();

import { simpleGit } from "simple-git";

const model = new ChatOllama({
  model: "llama3.2:latest",
  temperature: 0,
  maxRetries: 3,
  requestTimeout: 120000,
});

const modelWithTools = model.bindTools(allTools);

const toolsMap = Object.fromEntries(allTools.map((t) => [t.name, t]));
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("Client got connected:",socket, socket.id);

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });
});

const git = simpleGit();

// ---------- GIT WATCHER ----------
let lastStatus = null;
async function watchGit() {
    try {
        const { getCommitStatus } = toolsMap;
        if (!getCommitStatus) return;

        const status = await getCommitStatus.invoke({});
        console.log("🔄 Git status updated, emitting...");
        console.log(status)
        
        // Only emit if something changed or first run
        if (JSON.stringify(status) !== JSON.stringify(lastStatus)) {
            console.log("🔄 Git status updated, emitting...");
            io.emit("git_status", status);
            lastStatus = status;
        }
    } catch (err) {
        console.error("Git watch error:", err.message);
    }
}
setInterval(watchGit, 5000);
async function getDynamicRepoContext() {
  try {
    const remote = await git.remote(["get-url", "origin"]);
    const branch = await git.revparse(["--abbrev-ref", "HEAD"]);
    const match = remote.match(/github\.com[:/](.+)\/(.+)\.git/);
    const owner = match ? match[1] : "unknown";
    const repo = match ? match[2] : "unknown";

    return `You are working on the '${repo}' repository owned by '${owner}'. 
Use these details for any GitHub tool calls if the user doesn't specify others.
Current local branch: '${branch}'.

CRITICAL INSTRUCTION:
Before performing any file edits or suggesting code changes, you MUST:
1. Use 'getLocalFileDiff' to check for uncommitted local changes. Report exactly which files are modified and the line numbers using the 'structuredChanges' field.
2. Use 'getCommitStatus' to check if the local branch is ahead or behind remote.

IF YOU ARE BEHIND:
- You MUST warn the user if they try to edit a file that has incoming changes.
- Check if any file in 'changedFiles' exists in the 'files' list of any commit in 'behind'. 
- IF there is an overlap, start your response with: "🚨 CONFLICT ALERT: You have local changes in [File Name] (Lines X-Y) and there are incoming updates to the same file."
- Explicitly tell the user they should 'git pull' before continuing to modify those specific files.
Always perform the check and give a data-driven report of ahead/behind counts and local line numbers.`;
  } catch (err) {
    return "You are working on a GitHub repository. Use your tools to detect the repository owner and name if needed.";
  }
}


async function safeInvoke(messages) {
  for (let i = 0; i < 3; i++) {
    try {
      return await modelWithTools.invoke(messages);
    } catch (err) {
      console.log(`🔁 Retry #${i + 1} — LLM error:`, err.message);
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error("LLM unreachable after retries");
}

app.post("/retrieve", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required" });

    // ---------- DYNAMIC CONTEXT ----------
    const dynamicRepoContext = await getDynamicRepoContext();
    io.emit("thinking", { message: "Analyzing request..." });

    // ---------- CACHE KEY ----------
    const cacheKey = `response:${message.trim().toLowerCase()}`;

    const cached = getCache(cacheKey);
    console.log("Key get:", cacheKey);
    console.log("Stored cache:", cached);

    if (cached) {
      console.log("⚡ CACHE HIT:", cacheKey);
      return res.json({ success: true, cached: true, content: cached });
    }

    console.log("🐢 CACHE MISS:", cacheKey);

    const messages = [
      new SystemMessage(dynamicRepoContext),
      new HumanMessage(message),
    ];

    console.log("🟣 Sending to model...");
    let result = await safeInvoke(messages);
    console.log("🟢 Model returned");

    // ---------- TOOL HANDLING ----------
    if (result.tool_calls?.length) {
      messages.push(result);

      for (const call of result.tool_calls) {
        const tool = toolsMap[call.name];
        if (!tool) continue;

        let toolResult;
        try {
          toolResult = await tool.invoke(call.args);
        } catch (err) {
          toolResult = { error: err.message };
        }

        // 🚨 AVOID HUGE JSON — shrink it but keep critical fields
        const safeToolResult = {
          success: toolResult?.success,
          error: toolResult?.error,
          issues: toolResult?.issues?.slice?.(0, 5),
          pulls: toolResult?.pulls?.slice?.(0, 5),
          commits: toolResult?.commits?.slice?.(0, 5)?.map?.((c) => ({
            message: c?.commit?.message || c?.message,
            author: c?.commit?.author?.name || c?.author,
            hash: c?.hash || c?.sha,
            files: c?.files,
          })),
          status: toolResult?.status,
          diff: toolResult?.diff?.slice?.(0, 1500),
          file: toolResult?.filePath,
          content: toolResult?.content?.slice?.(0, 5000),
          files: toolResult?.files?.slice?.(0, 50),
          hasChanges: toolResult?.hasChanges,
          changedFiles: toolResult?.changedFiles,
          structuredChanges: toolResult?.structuredChanges,
          root: toolResult?.root,
          branch: toolResult?.branch,
          ahead: toolResult?.ahead,
          behind: toolResult?.behind,
          aheadCount: toolResult?.aheadCount,
          behindCount: toolResult?.behindCount,
          remote: toolResult?.remote,
          owner: toolResult?.owner,
          repo: toolResult?.repo,
          summary: toolResult?.summary,
          remoteDiff: toolResult?.remoteDiff,
          remoteStructuredChanges: toolResult?.remoteStructuredChanges,
        };

        io.emit("tool_result", {
          tool: call.name,
          result: safeToolResult,
        });

        messages.push(
          new ToolMessage({
            tool_call_id: call.id,
            name: call.name,
            content: JSON.stringify(safeToolResult),
          })
        );
      }

      console.log("🟣 Sending FINAL result to model...");
      result = await safeInvoke(messages);
      console.log("🟢 Model returned final answer");
    }

    // ---------- NORMALIZE TEXT ----------
    let finalContent = "";

    if (Array.isArray(result.content)) {
      finalContent = result.content
        .map((c) => (typeof c === "string" ? c : c.text ?? ""))
        .join("");
    } else {
      finalContent = result.content ?? "";
    }

    io.emit("final_answer", { content: finalContent });

    // ---------- CACHE ONLY IF VALID ----------
    if (finalContent.trim()) {
      setCache(cacheKey, finalContent);
      console.log("✅ Cache set:", cacheKey);
    } else {
      console.log("⚠️ Not caching empty response");
    }

    res.json({ success: true, cached: false, content: finalContent });
  } catch (error) {
    console.error("❌ ERROR:", error);
    io.emit("error", { message: error.message });
    res.status(500).json({
      error: "Failed to process request",
      details: error.message,
    });
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Server + Socket.IO running at http://localhost:${PORT}`);
});
