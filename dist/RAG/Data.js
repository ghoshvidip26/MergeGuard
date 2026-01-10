import { Octokit } from "@octokit/rest";
import { config } from "dotenv";
import { git } from "../utils/LLM.js";
import path from "path";
// Load .env from parent directory (GithubAI-Agent root)
config({ path: path.join(process.cwd(), "../.env") });
const octokit = new Octokit({
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
export async function fetchRepoOwner() {
    let remote = null;
    try {
        const remoteResult = await git.remote(["get-url", "origin"]);
        remote = remoteResult ? remoteResult.trim() : null;
    }
    catch {
        const remotes = await git.getRemotes(true);
        const githubRemote = remotes.find((r) => r.refs.push.includes("github.com"));
        remote = githubRemote ? githubRemote.refs.push.trim() : null;
    }
    const branchResult = await git.revparse(["--abbrev-ref", "HEAD"]);
    const currentBranch = branchResult ? branchResult.trim() : "main";
    let owner = "unknown";
    let repo = "unknown";
    if (remote) {
        const match = remote.match(/github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?$/);
        if (match) {
            owner = match[1];
            repo = match[2];
        }
    }
    return { remote, owner, repo, currentBranch };
}
/* ---------------------- CORE: Branch → Tree ---------------------- */
export async function checkBranchExists(owner, repo, branch) {
    try {
        await octokit.rest.git.getRef({
            owner,
            repo,
            ref: `heads/${branch}`,
        });
        return true;
    }
    catch (error) {
        if (error.status === 404) {
            return false;
        }
        throw error;
    }
}
export async function getBranchTreeSha(owner, repo, branch) {
    // Check if branch exists remotely, fallback to 'main' if not
    const branchExists = await checkBranchExists(owner, repo, branch);
    const targetBranch = branchExists ? branch : "main";
    if (!branchExists) {
        console.warn(`⚠️  Branch '${branch}' not found on remote. Falling back to 'main'.`);
    }
    // 1️⃣ Branch → Commit SHA
    const { data: ref } = await octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${targetBranch}`,
    });
    const commitSha = ref.object.sha;
    // 2️⃣ Commit → Tree SHA
    const { data: commit } = await octokit.rest.git.getCommit({
        owner,
        repo,
        commit_sha: commitSha,
    });
    return { treeSha: commit.tree.sha, resolvedBranch: targetBranch };
}
/* ---------------------- Fetch All Repo Files ---------------------- */
export async function fetchAllRepoFiles(owner, repo, branch, extensions = [".ts", ".tsx", ".md"]) {
    // Resolve branch → tree
    const { treeSha, resolvedBranch } = await getBranchTreeSha(owner, repo, branch);
    // Fetch entire tree
    const { data: tree } = await octokit.rest.git.getTree({
        owner,
        repo,
        tree_sha: treeSha,
        recursive: "true",
    });
    // Filter to source files only (exclude dist/, node_modules/, etc.)
    const excludePaths = ["dist/", "node_modules/", ".git/", "build/", "out/"];
    const codeFiles = tree.tree.filter((f) => f.type === "blob" &&
        f.path &&
        extensions.some((ext) => f.path.endsWith(ext)) &&
        !excludePaths.some((exclude) => f.path.startsWith(exclude)));
    const files = [];
    const batchSize = 10;
    for (let i = 0; i < codeFiles.length; i += batchSize) {
        const batch = codeFiles.slice(i, i + batchSize);
        const results = await Promise.allSettled(batch.map(async (f) => {
            const { data } = await octokit.rest.repos.getContent({
                owner,
                repo,
                path: f.path,
                ref: resolvedBranch,
            });
            if (!isGithubFile(data))
                return null;
            return {
                path: f.path,
                content: Buffer.from(data.content, data.encoding).toString("utf8"),
                type: f.path.split(".").pop() || "unknown",
                size: data.size,
                url: data.html_url,
            };
        }));
        results.forEach((r) => {
            if (r.status === "fulfilled" && r.value) {
                files.push(r.value);
            }
        });
    }
    return files;
}
/* ---------------------- Fetch Single File ---------------------- */
export async function fetchRepoFile(owner, repo, path, branch) {
    const { data } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref: branch,
    });
    if (!isGithubFile(data)) {
        throw new Error("Not a file");
    }
    return Buffer.from(data.content, data.encoding).toString("utf8");
}
/* ---------------------- Repo Metadata ---------------------- */
export async function getGithubRepoSummary(owner, repo) {
    const [issues, prs, commits, info] = await Promise.all([
        octokit.rest.issues.listForRepo({ owner, repo, state: "open" }),
        octokit.rest.pulls.list({ owner, repo, state: "open" }),
        octokit.rest.repos.listCommits({ owner, repo, per_page: 10 }),
        octokit.rest.repos.get({ owner, repo }),
    ]);
    return {
        repo: `${owner}/${repo}`,
        stars: info.data.stargazers_count,
        forks: info.data.forks_count,
        openIssues: issues.data.map((i) => i.title),
        openPRs: prs.data.map((p) => p.title),
        recentCommits: commits.data.map((c) => c.commit.message),
    };
}
