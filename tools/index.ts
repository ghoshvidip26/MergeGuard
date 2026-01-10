import {
  getGithubRepoSummary,
  getCommitsWithFiles,
  getGithubFileContent,
  listLocalFiles,
} from "./github.js";

import {
  getLocalFileDiff,
  getCommitStatus,
  detectGithubRepo,
  pullRemoteChanges,
  getCommitFiles,
} from "./gitLocal.js";

import { scanRepoTree, readLocalFile } from "./localRepo.js";

export const tools = [
  getGithubRepoSummary,
  getCommitsWithFiles,
  getGithubFileContent,
  listLocalFiles,
  getLocalFileDiff,
  getCommitStatus,
  detectGithubRepo,
  pullRemoteChanges,
  scanRepoTree,
  readLocalFile,
  getCommitFiles,
];
