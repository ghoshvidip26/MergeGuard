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

const REPO_CONTEXT =
  "You are working on the 'MergeGuard' repository owned by 'ghoshvidip26'. Use these details for any GitHub tool calls if the user doesn't specify others.";

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
      new SystemMessage(REPO_CONTEXT),
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
            message: c?.commit?.message,
            author: c?.commit?.author?.name,
          })),
          status: toolResult?.status,
          diff: toolResult?.diff?.slice?.(0, 1000), // truncate if needed
          file: toolResult?.filePath,
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
