import { ChatOllama, OllamaEmbeddings } from "@langchain/ollama";
import "dotenv/config";
export declare const model: ChatOllama;
export declare const embeddings: OllamaEmbeddings;
export declare const logger: import("winston").Logger;
export declare const git: import("simple-git").SimpleGit;
