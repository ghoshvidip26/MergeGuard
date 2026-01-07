import {
  getGithubRepoSummary,
  getGithubFileContent,
  getCommitsWithFiles,
} from "./github.js";

import {
  getLocalVsRemoteDiff,
  fetchRemoteRepo,
  getLocalFileDiff,
  getCommitStatus,
  detectGithubRepo,
  pullRemoteChanges,
} from "./gitLocal.js";

import { scanRepoTree, readLocalFile } from "./localRepo.js";

export const tools = [
  scanRepoTree,
  readLocalFile,
  getGithubRepoSummary,
  getGithubFileContent,
  getCommitsWithFiles,
  getLocalVsRemoteDiff,
  fetchRemoteRepo,
  detectGithubRepo,
  getLocalFileDiff,
  getCommitStatus,
  pullRemoteChanges,
];
