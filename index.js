import express from "express";
import cors from "cors";
import { config } from "dotenv";
import { ChatOllama } from "@langchain/ollama";
import {
  HumanMessage,
  ToolMessage,
  SystemMessage,
} from "@langchain/core/messages";

import { tools as allTools } from "./tools/index.js";
import { getCache, setCache } from "./tools/cache.js";

config();

import { simpleGit } from "simple-git";

const git = simpleGit();

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
1. Use 'getLocalFileDiff' to check for uncommitted local changes and report them (including line numbers).
2. Use 'getCommitStatus' to check if the local branch is ahead or behind remote.
Always alert the user if they need to 'git pull' to avoid conflicts or if they have unsaved work that might be overwritten.`;
  } catch (err) {
    return "You are working on a GitHub repository. Use your tools to detect the repository owner and name if needed.";
  }
}

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cors());

// ---------- MODEL ----------
const model = new ChatOllama({
  model: "llama3.2",
  baseUrl: "http://localhost:11434", // <-- IMPORTANT
  temperature: 0,
  maxRetries: 3,
  requestTimeout: 120000, // <-- prevents headers timeout
});

const modelWithTools = model.bindTools(allTools);

const toolsMap = Object.fromEntries(allTools.map((t) => [t.name, t]));

// ---------- RETRY WRAPPER ----------
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

        // 🚨 AVOID HUGE JSON — shrink it
        const safeToolResult = {
          issues: toolResult?.issues?.slice?.(0, 5),
          pulls: toolResult?.pulls?.slice?.(0, 5),
          commits: toolResult?.commits?.slice?.(0, 5)?.map?.((c) => ({
            message: c?.commit?.message || c?.message,
            author: c?.commit?.author?.name || c?.author,
            hash: c?.hash || c?.sha,
          })),
          status: toolResult?.status,
          diff: toolResult?.diff?.slice?.(0, 1500), // slightly more diff
          file: toolResult?.filePath,
          branch: toolResult?.branch,
          ahead: toolResult?.ahead,
          behind: toolResult?.behind,
          aheadCount: toolResult?.aheadCount,
          behindCount: toolResult?.behindCount,
          remote: toolResult?.remote,
          owner: toolResult?.owner,
          repo: toolResult?.repo,
        };

        console.log(
          "Tool payload size:",
          JSON.stringify(safeToolResult).length
        );

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
    res.status(500).json({
      error: "Failed to process request",
      details: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
