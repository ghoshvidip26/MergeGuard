import express from "express";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";
import cors from "cors";
import { config } from "dotenv";
import {
  getGithubFileContent,
  getGithubRepoSummary,
  getLocalVsRemoteDiff,
  listLocalFiles,
} from "./github.js";

config();

const app = express();
app.use(express.json());
app.use(cors());

const model = new ChatGoogleGenerativeAI({
  model: "gemini-3-flash-preview",
  apiKey: process.env.GEMINI_API_KEY,
  temperature: 0,
});

const tools = [getGithubFileContent, getGithubRepoSummary, getLocalVsRemoteDiff, listLocalFiles];
const modelWithTools = model.bindTools(tools);

const toolsMap = {
  getGithubFileContent,
  getGithubRepoSummary,
  getLocalVsRemoteDiff,
  list_files: listLocalFiles,
};

app.post("/retrieve", async (req, res) => {
  try {
    //  "message": "Am I behind main branch?" 
    // Message from user
    const { message } = req.body;
    console.log(message);
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // First call - may return tool calls
    let result = await modelWithTools.invoke([new HumanMessage(message)]);

    // If model wants to use tools, execute them
    if (result.tool_calls && result.tool_calls.length > 0) {
      const toolResults = [];

      for (const toolCall of result.tool_calls) {
        const tool = toolsMap[toolCall.name];
        if (tool) {
          const toolResult = await tool.invoke(toolCall.args);
          toolResults.push({
            role: "tool",
            content: JSON.stringify(toolResult),
            tool_call_id: toolCall.id,
          });
        }
      }
      const messages = [new HumanMessage(message), result, ...toolResults];
      result = await modelWithTools.invoke(messages);
    }
    res.json({
      success: true,
      content: result.content,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      error: "Failed to process request",
      details: error.message,
    });
  }
});

app.listen(3000, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
