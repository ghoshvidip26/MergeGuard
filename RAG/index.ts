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
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";

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
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 800,
  chunkOverlap: 150,
});

const docs: Document[] = [];

async function buildRepoDocuments() {
  const repoOwner = await fetchRepoOwner();

  const allFiles = (
    await fetchAllRepoFiles(
      repoOwner.owner,
      repoOwner.repo,
      repoOwner.currentBranch
    )
  ).filter((f) => !f.path.startsWith("dist/") && !f.path.endsWith(".d.ts"));

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
        pageContent: `FILE PATH: ${file.path}\n\n${file.content}`, // ✅ FIX
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

export async function splitDoc(rawDocs: Document[]) {
  return await textSplitter.splitDocuments(rawDocs);
}
const vectorStore = new MemoryVectorStore(embeddings);

export async function addDocIntoVectorStore(rawDocs: Document[]) {
  const splitDocs = await splitDoc(rawDocs);

  await vectorStore.addDocuments(splitDocs);

  return {
    chunks: splitDocs.length,
    status: "indexed",
  };
}

export async function call(question: string) {
  const docs = await vectorStore.similaritySearch(question, 6);

  if (!docs.length) {
    return model.stream("I don’t know based on this repository.");
  }

  const context = docs
    .map((d) => `FILE: ${d.metadata.path}\n${d.pageContent}`)
    .join("\n\n");

  const prompt = `
You are MergeGuard AI.

You are a codebase analysis assistant.
You MUST only answer using the repository context below.

If the answer is not in the context, reply exactly:
"I don't know based on this repository."

===== REPOSITORY CONTEXT =====
${context}
=============================

Question: ${question}

Answer:
`;

  return model.stream(prompt);
}

function extractText(chunk: any): string {
  if (!chunk?.content) return "";

  if (typeof chunk.content === "string") {
    return chunk.content;
  }

  // If it's an array of blocks
  if (Array.isArray(chunk.content)) {
    return chunk.content
      .map((c) => {
        if (typeof c === "string") return c;
        if (typeof c?.text === "string") return c.text;
        return "";
      })
      .join("");
  }

  return "";
}

export async function chat() {
  ui(chalk.cyan.bold("\n🧠 MergeGuard RAG CLI"));
  ui(chalk.gray("Type /new to reset • /exit to quit\n"));

  ui(chalk.yellow("⏳ Indexing repository..."));
  try {
    const docs = await buildRepoDocuments();
    await addDocIntoVectorStore(docs);
    ui(chalk.green("✅ Repository indexed successfully!\n"));
  } catch (error) {
    ui(chalk.red("❌ Failed to index repository: " + error.message + "\n"));
  }

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
      process.stdout.write(chalk.blueBright("AI: "));

      const stream = await call(userInput);

      let aiText = "";

      for await (const chunk of stream) {
        const token = extractText(chunk);
        process.stdout.write(token);
        aiText += token;
      }

      process.stdout.write("\n");

      chatHistory.push({ role: "assistant", content: aiText });

      logger.info(chalk.greenBright("AI response streamed successfully"));
    } catch (error) {
      ui(chalk.redBright("❌ AI failed to respond."));
      logger.error(error);
    }
  }
}
