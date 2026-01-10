"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchRepoOwner = fetchRepoOwner;
exports.fetchAllRepoFiles = fetchAllRepoFiles;
exports.fetchRepoFile = fetchRepoFile;
exports.getGithubRepoSummary = getGithubRepoSummary;
var rest_1 = require("@octokit/rest");
var dotenv_1 = require("dotenv");
var LLM_1 = require("../utils/LLM");
(0, dotenv_1.config)();
var octokit = new rest_1.Octokit({
    auth: process.env.GITHUB_API,
});
/* ---------------------------- Type Guards ---------------------------- */
function isGithubFile(data) {
    return (typeof data === "object" &&
        data !== null &&
        data.type === "file" &&
        typeof data.content === "string");
}
/* ---------------------- Git Repo Detection ---------------------- */
function fetchRepoOwner() {
    return __awaiter(this, void 0, void 0, function () {
        var remote, remoteResult, _a, remotes, githubRemote, branchResult, currentBranch, owner, repo, match;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    remote = null;
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 5]);
                    return [4 /*yield*/, LLM_1.git.remote(["get-url", "origin"])];
                case 2:
                    remoteResult = _b.sent();
                    remote = remoteResult ? remoteResult.trim() : null;
                    return [3 /*break*/, 5];
                case 3:
                    _a = _b.sent();
                    return [4 /*yield*/, LLM_1.git.getRemotes(true)];
                case 4:
                    remotes = _b.sent();
                    githubRemote = remotes.find(function (r) {
                        return r.refs.push.includes("github.com");
                    });
                    remote = githubRemote ? githubRemote.refs.push.trim() : null;
                    return [3 /*break*/, 5];
                case 5: return [4 /*yield*/, LLM_1.git.revparse(["--abbrev-ref", "HEAD"])];
                case 6:
                    branchResult = _b.sent();
                    currentBranch = branchResult ? branchResult.trim() : "main";
                    owner = "unknown";
                    repo = "unknown";
                    if (remote) {
                        match = remote.match(/github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?$/);
                        if (match) {
                            owner = match[1];
                            repo = match[2];
                        }
                    }
                    return [2 /*return*/, { remote: remote, owner: owner, repo: repo, currentBranch: currentBranch }];
            }
        });
    });
}
/* ---------------------- CORE: Branch → Tree ---------------------- */
function getBranchTreeSha(owner, repo, branch) {
    return __awaiter(this, void 0, void 0, function () {
        var ref, commitSha, commit;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, octokit.rest.git.getRef({
                        owner: owner,
                        repo: repo,
                        ref: "heads/".concat(branch),
                    })];
                case 1:
                    ref = (_a.sent()).data;
                    commitSha = ref.object.sha;
                    return [4 /*yield*/, octokit.rest.git.getCommit({
                            owner: owner,
                            repo: repo,
                            commit_sha: commitSha,
                        })];
                case 2:
                    commit = (_a.sent()).data;
                    return [2 /*return*/, commit.tree.sha];
            }
        });
    });
}
/* ---------------------- Fetch All Repo Files ---------------------- */
function fetchAllRepoFiles(owner_1, repo_1, branch_1) {
    return __awaiter(this, arguments, void 0, function (owner, repo, branch, extensions) {
        var treeSha, tree, codeFiles, files, batchSize, i, batch, results;
        var _this = this;
        if (extensions === void 0) { extensions = [".ts", ".tsx", ".js", ".jsx", ".py", ".java", ".go"]; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBranchTreeSha(owner, repo, branch)];
                case 1:
                    treeSha = _a.sent();
                    return [4 /*yield*/, octokit.rest.git.getTree({
                            owner: owner,
                            repo: repo,
                            tree_sha: treeSha,
                            recursive: "true",
                        })];
                case 2:
                    tree = (_a.sent()).data;
                    codeFiles = tree.tree.filter(function (f) {
                        return f.type === "blob" &&
                            f.path &&
                            extensions.some(function (ext) { return f.path.endsWith(ext); });
                    });
                    files = [];
                    batchSize = 10;
                    i = 0;
                    _a.label = 3;
                case 3:
                    if (!(i < codeFiles.length)) return [3 /*break*/, 6];
                    batch = codeFiles.slice(i, i + batchSize);
                    return [4 /*yield*/, Promise.allSettled(batch.map(function (f) { return __awaiter(_this, void 0, void 0, function () {
                            var data;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, octokit.rest.repos.getContent({
                                            owner: owner,
                                            repo: repo,
                                            path: f.path,
                                            ref: branch,
                                        })];
                                    case 1:
                                        data = (_a.sent()).data;
                                        if (!isGithubFile(data))
                                            return [2 /*return*/, null];
                                        return [2 /*return*/, {
                                                path: f.path,
                                                content: Buffer.from(data.content, data.encoding).toString("utf8"),
                                                type: f.path.split(".").pop() || "unknown",
                                                size: data.size,
                                                url: data.html_url,
                                            }];
                                }
                            });
                        }); }))];
                case 4:
                    results = _a.sent();
                    results.forEach(function (r) {
                        if (r.status === "fulfilled" && r.value) {
                            files.push(r.value);
                        }
                    });
                    _a.label = 5;
                case 5:
                    i += batchSize;
                    return [3 /*break*/, 3];
                case 6: return [2 /*return*/, files];
            }
        });
    });
}
/* ---------------------- Fetch Single File ---------------------- */
function fetchRepoFile(owner, repo, path, branch) {
    return __awaiter(this, void 0, void 0, function () {
        var data;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, octokit.rest.repos.getContent({
                        owner: owner,
                        repo: repo,
                        path: path,
                        ref: branch,
                    })];
                case 1:
                    data = (_a.sent()).data;
                    if (!isGithubFile(data)) {
                        throw new Error("Not a file");
                    }
                    return [2 /*return*/, Buffer.from(data.content, data.encoding).toString("utf8")];
            }
        });
    });
}
/* ---------------------- Repo Metadata ---------------------- */
function getGithubRepoSummary(owner, repo) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, issues, prs, commits, info;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, Promise.all([
                        octokit.rest.issues.listForRepo({ owner: owner, repo: repo, state: "open" }),
                        octokit.rest.pulls.list({ owner: owner, repo: repo, state: "open" }),
                        octokit.rest.repos.listCommits({ owner: owner, repo: repo, per_page: 10 }),
                        octokit.rest.repos.get({ owner: owner, repo: repo }),
                    ])];
                case 1:
                    _a = _b.sent(), issues = _a[0], prs = _a[1], commits = _a[2], info = _a[3];
                    return [2 /*return*/, {
                            repo: "".concat(owner, "/").concat(repo),
                            stars: info.data.stargazers_count,
                            forks: info.data.forks_count,
                            openIssues: issues.data.map(function (i) { return i.title; }),
                            openPRs: prs.data.map(function (p) { return p.title; }),
                            recentCommits: commits.data.map(function (c) { return c.commit.message; }),
                        }];
            }
        });
    });
}
