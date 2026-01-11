"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.git = exports.logger = exports.embeddings = exports.model = void 0;
var ollama_1 = require("@langchain/ollama");
var winston_1 = require("winston");
var simple_git_1 = require("simple-git");
require("dotenv/config");
exports.model = new ollama_1.ChatOllama({
    model: "llama3.2:latest",
    baseUrl: "http://127.0.0.1:11434",
    temperature: 0,
    maxRetries: 3,
});
exports.embeddings = new ollama_1.OllamaEmbeddings({
    model: "mxbai-embed-large",
    baseUrl: "http://localhost:11434",
});
exports.logger = (0, winston_1.createLogger)({
    level: "info",
    format: winston_1.format.combine(winston_1.format.timestamp({ format: "HH:mm:ss" }), winston_1.format.printf(function (_a) {
        var level = _a.level, message = _a.message, timestamp = _a.timestamp;
        return "[".concat(timestamp, "] ").concat(level.toUpperCase(), ": ").concat(message);
    })),
    transports: [
        // ⛔ DO NOT log to stdout
        new winston_1.transports.Console({
            stderrLevels: ["info", "warn", "error", "debug"],
        }),
        new winston_1.transports.File({ filename: "mergeguard.log" }),
    ],
});
// GIT
exports.git = (0, simple_git_1.simpleGit)();
