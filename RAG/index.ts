#!/usr/bin/env node

import { createInterface } from "readline";
import { model, logger, embeddings } from "../utils/LLM.js";
import chalk from "chalk";
import { Ollama } from "ollama/browser";
import {
  fetchRepoOwner,
  checkBranchExists,
  getBranchTreeSha,
  fetchAllRepoFiles,
  getGithubRepoSummary,
} from "../RAG/Data.js";
import { Document } from "langchain";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { FaissStore } from "@langchain/community/vectorstores/faiss";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type GithubFile = {
  type: "file";
  content: string;
  encoding: BufferEncoding;
};

let chatHistory: ChatMessage[] = [];

// Print UI messages safely
function ui(text: string) {
  process.stdout.write(text + "\n");
}

// Ask user input
function ask(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

export async function chat() {
  ui(chalk.cyan.bold("\n🧠 MergeGuard RAG CLI"));
  ui(chalk.gray("Type /new to reset • /exit to quit\n"));

  while (true) {
    const userInput = await ask(chalk.greenBright("You: "));

    if (!userInput) continue;

    logger.debug(`User input: ${userInput}`);

    if (userInput.trim().toLowerCase() === "/exit") {
      ui(chalk.magentaBright("Goodbye 👋"));
      rl.close();
      process.exit(0);
    }

    if (userInput.trim().toLowerCase() === "/new") {
      chatHistory = [];
      ui(chalk.magentaBright("🔄 New chat started\n"));
      logger.info("Chat history reset");
      continue;
    }

    chatHistory.push({ role: "user", content: userInput });

    try {
      const response = await model.invoke(userInput);

      process.stdout.write(chalk.blueBright("AI: "));

      let aiText = "";

      for await (const chunk of response.content) {
        const token = chunk.toString();
        process.stdout.write(token);
        aiText += token;
      }

      process.stdout.write("\n");

      chatHistory.push({ role: "assistant", content: aiText });

      logger.info(chalk.greenBright.bold("AI response streamed successfully"));
    } catch (error: any) {
      logger.error(chalk.redBright.bold("AI error:", error.message));
      ui("❌ AI failed to respond.");
    }
  }
}

const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 800,
  chunkOverlap: 150,
});

const docs: Document[] = [];

async function buildRepoDocuments() {
  const repoOwner = await fetchRepoOwner();

  const allFiles = await fetchAllRepoFiles(
    repoOwner.owner,
    repoOwner.repo,
    repoOwner.currentBranch
  );

  const repoDetails = await getGithubRepoSummary(
    repoOwner.owner,
    repoOwner.repo
  );

  const documents: Document[] = [];

  // Repo-level context
  documents.push(
    new Document({
      pageContent: `
Repository: ${repoOwner.owner}/${repoOwner.repo}
Stars: ${repoDetails.stars}
Open Issues: ${repoDetails.openIssues.length}
Open PRs: ${repoDetails.openPRs.length}
`,
      metadata: {
        type: "repo_summary",
        repo: `${repoOwner.owner}/${repoOwner.repo}`,
        branch: repoOwner.currentBranch,
      },
    })
  );

  // File-level documents
  for (const file of allFiles) {
    documents.push(
      new Document({
        pageContent: file.content,
        metadata: {
          type: "source_code",
          path: file.path,
          repo: `${repoOwner.owner}/${repoOwner.repo}`,
          branch: repoOwner.currentBranch,
          size: file.size,
          url: file.url,
        },
      })
    );
  }
  return documents;
}

async function splitDoc() {
  const rawDocs = await buildRepoDocuments();

  const splitDocs = await textSplitter.splitDocuments(rawDocs);

  console.log(
    `Created ${splitDocs.length} chunks from ${rawDocs.length} documents`
  );
}
