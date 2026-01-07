import {
  getGithubRepoSummary,
  getGithubFileContent,
  getCommitsWithFile,
} from "./github.js";

import {
  getLocalVsRemoteDiff,
  fetchRemoteRepo,
  getLocalFileDiff,
  getCommitStatus,
  detectGithubRepo,
} from "./gitLocal.js";

import { scanRepoTree, readLocalFile } from "./localRepo.js";

export const tools = [
  scanRepoTree,
  readLocalFile,
  getGithubRepoSummary,
  getGithubFileContent,
  getCommitsWithFile,
  getLocalVsRemoteDiff,
  fetchRemoteRepo,
  detectGithubRepo,
  getLocalFileDiff,
  getCommitStatus,
];
