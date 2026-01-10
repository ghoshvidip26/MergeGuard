import { ChatOllama, OllamaEmbeddings } from "@langchain/ollama";
import { createLogger, format, transports } from "winston";
import { simpleGit } from "simple-git";
import "dotenv/config";
export const model = new ChatOllama({
    model: "llama3.2:latest",
    baseUrl: "http://127.0.0.1:11434",
    temperature: 0,
    maxRetries: 3,
});
export const embeddings = new OllamaEmbeddings({
    model: "mxbai-embed-large",
    baseUrl: "http://localhost:11434",
});
export const logger = createLogger({
    level: "info",
    format: format.combine(format.timestamp({ format: "HH:mm:ss" }), format.printf(({ level, message, timestamp }) => {
        return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    })),
    transports: [
        // ⛔ DO NOT log to stdout
        new transports.Console({
            stderrLevels: ["info", "warn", "error", "debug"],
        }),
        new transports.File({ filename: "mergeguard.log" }),
    ],
});
// GIT
export const git = simpleGit();
