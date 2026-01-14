# 🛡️ MergeGuard

**Real-time Git merge conflict detection with line-level accuracy.**

MergeGuard is a proactive CLI tool that monitors your local workspace and remote repositories. It uses Local AI (Ollama) to analyze potential conflicts in real-time, giving you a risk assessment and resolution strategy *before* you even run `git pull`.


## 🚀 Quick Start

### 1. Prerequisites

Ensure your environment meets the following requirements:

| **Requirement** | **Command to Check** | **Minimum Version** |
| --------------- | -------------------- | ------------------- |
| **Node.js**     | `node -v`            | **v20.x.x**         |
| **Git**         | `git --version`      | Latest              |
| **Ollama**      | `ollama --version`   | Latest              |

**Prepare the AI Brain:**

1. Download Ollama from [ollama.com](https://ollama.com/).
2. Run the following in your terminal:
   ```bash
   ollama pull llama3.2
   ```
   *Note: Ensure Ollama is running in the background.*

### 2. Installation

Clone the repository and link the CLI to your system:

```bash
# Clone the repository
git clone https://github.com/ghoshvidip26/MergeGuard
cd MergeGuard

# Install dependencies and build
npm install
npm run build

# Link globally so you can use the 'mergeguard' command anywhere
npm link
```

**Verify Installation:**
```bash
mergeguard --help
```

### 🧪 How to Verify a "High Risk" Conflict
To see MergeGuard’s true power, follow this specific test case:
1. **Setup:** Run mergeguard -w in your test repo.
2. **Action A (Remote):** Go to GitHub.com, edit line 10 of README.md, and commit.
3. **Action B (Local):** Immediately edit line 10 of README.md in your local editor. Do not commit.
4. **The Result:** MergeGuard will detect you are Behind: 1 and have Local Changes. The AI will flag this as HIGH RISK because the line ranges overlap.

### 📊 Understanding AI Alerts
| Alert Level | Meaning                                       | Suggested Action                      |
|-------------|-----------------------------------------------|---------------------------------------|
| NONE        | No local or remote changes detected.          | Keep coding!                          |
| LOW         | Remote changes exist, but in different files. | git pull is safe.                     |
| MEDIUM      | Same file changed, but different lines.       | git pull is likely safe (auto-merge). |
| HIGH        | Same lines changed on both sides.             | Stop. Coordinate before pulling.      |

## ✨ Key Features
- 🔍 **Real-time Git monitoring** (local + remote)
- 📄 **Line-level diff analysis** (no coarse file-only checks)
- 🌿 **Branch-agnostic** (works with any feature branch)
- 🚨 **Conflict risk classification**:
  - **🔴 RISK=HIGH** – Same file AND overlapping line ranges.
  - **🟡 RISK=MEDIUM** – Same file, but different line ranges.
  - **🟢 RISK=LOW** – Different files entirely.
  - **⚪ RISK=NONE** – No changes or branch is up-to-date.
- 🤖 **AI-assisted analysis** (via Ollama) with strict factual guardrails
- 🔌 **CLI + Socket.IO** for live alerts
- ⚡ **Smart caching** to avoid unnecessary recomputation


## ▶️ Usage

### Watch mode (recommended)
Navigate to any active Git repository and run:
```bash
mergeguard -w
```
- Watches the repository continuously.
- Emits alerts on local changes, remote updates, and conflict risks.

### One-time analysis
```bash
mergeguard -a
```
Or with a custom prompt:
```bash
mergeguard -a "Analyze repository safety"
```


## 🧠 How It Works

1. **Repository Watcher**: Tracks uncommitted local changes and periodically fetches remote updates.
2. **Data Collection**: Uses `git status`, `git diff`, and `git log` to collect ground-truth data.
3. **Line-level analysis**: Extracts exact line ranges from diff hunks to match local vs remote changes per file.
4. **AI Analysis**: Consumes tool output to explain *why* a conflict may occur and recommends resolution strategies.


## 📊 Sample Output
MergeGuard provides a clean, fact-based report based on actual Git hunks and AI analysis:
**Example-1:**
```
🚩 ALERT: LOW (Behind: 0, Ahead: 0)

📍 File Change Details
- src/index.ts
  - Change Type: Local
  - Status: M
  - File Creation Status: Modified
  - Exact Line Numbers: Lines 249–277, Lines 328–328, ...

🧠 Analysis
Found 3 uncommitted files...
```

**Example-2:**
```
🚩 ALERT: HIGH (Behind: 1, Ahead: 0)

📍 File Change Details
- README.md
  - Change Type: Remote | Conflict
  - Exact Line Numbers: Lines 6–64, Lines 66–66
  - File Creation Status: Modified

🧠 Analysis
The analysis indicates that there is a HIGH RISK due to overlapping line ranges in the same file. The remote changes have been detected and are causing this risk.

⚔️ Conflict Resolution Strategy
To resolve this conflict, you can choose one of the following strategies:
- Accept Remote: Run 'git pull' and manually resolve conflict markers in affected files.
- Keep Local: During a merge conflict, run 'git checkout --ours <file>' and add the file. Complete the merge with 'git commit'.
- Manual Merge: Run 'git pull' and manually resolve conflict markers in affected files.

Please note that you should coordinate before pulling to avoid any potential issues.
```

## 🔥 Remote vs Local Conflict Detection (Line-Level)

MergeGuard doesn’t just tell you that you’re behind or ahead —  
it shows **exactly which lines changed on remote vs your local branch.**

<img width="1377" height="568" alt="Screenshot 2026-01-14 at 11 12 48" src="https://github.com/user-attachments/assets/e57b308c-09c3-430f-8e25-b3d30aa7fc1a" />

In this example:

- The remote branch modified `README.md` at:
  - Lines 103, 106, 111, 113, 118  
- The local branch modified the same file at:
  - Lines 249–277 and 328  

Because both sides changed the same file, MergeGuard correctly reports:
**🚩 RISK = MEDIUM** and requires a merge decision.

This prevents blind `git pull` conflicts before they happen.


## 🧠 Unified Local + Remote Change Detection

MergeGuard doesn’t just list changed files — it shows **exactly which lines were modified locally and on the remote branch in a single unified view.**

This allows you to see *before pulling* whether you are about to hit a merge conflict.

### Example
<img width="1401" height="483" alt="Screenshot 2026-01-14 at 13 42 34" src="https://github.com/user-attachments/assets/d8b50cf9-af92-49cb-97ca-7710554cbb5b" />

In this example:

- The local branch has uncommitted changes in:
  - `src/index.ts`
  - `tools/gitLocal.ts`

- The remote branch has updates in:
  - `README.md`

## 🤖 RAG-powered Codebase Q&A
<img width="2048" height="1192" alt="image" src="https://github.com/user-attachments/assets/beacae7e-13bb-40c4-9eab-e177fe42fb94" />

## ⚙️ Advanced Configuration

To improve remote detection accuracy and avoid GitHub rate limits, add a Personal Access Token:

1. Create a `.env` file in the MergeGuard root directory.
2. Add your token:
   ```env
   GITHUB_API=github_pat_your_token_here
   ```
3. Restart the watcher.

## 🌐 GitHub API Integration

The tool uses the GitHub REST API to fetch additional repository metadata (e.g., pull request status, branch protection rules) when a `GITHUB_API` is provided. This enables more accurate conflict risk assessment and avoids hitting unauthenticated rate limits.

- Set `GITHUB_API` in your `.env` as described in the **Advanced Configuration** section.
- The token must have `repo` scope for private repositories.
- If no token is set, the tool falls back to unauthenticated API calls with lower rate limits.


## 🧪 Supported Workflows

- ✅ Feature branch vs remote `main`
- ✅ Open-source contribution model
- ✅ Local commits ahead of remote
- ✅ Remote commits behind local
- ❌ Does NOT auto-merge or modify files


## 🛠 Troubleshooting

- **Node Version**: If you see syntax errors, ensure you are on **Node 20+**.
- **Ollama Connection**: If analysis hangs, ensure `ollama run llama3.2` works independently.
- **Permissions**: You may need `sudo npm link` on some systems.


## 🛠️ Tech Stack

- **TypeScript** & **Node.js**
- **simple-git** for Git operations
- **Socket.IO** for live updates
- **LangChain** & **Ollama** for AI analysis
- **Yargs** for CLI management


## 🧑‍💻 Who This Is For

- Backend / Platform engineers
- Open-source contributors
- Teams with frequent rebases
- Developers tired of surprise merge conflicts
