# 🛡️ MergeGuard

**Real-time Git merge conflict detection with line-level accuracy.**

MergeGuard is a proactive CLI tool that monitors your local workspace and remote repositories. It uses Local AI (Ollama) to analyze potential conflicts in real-time, giving you a risk assessment and resolution strategy *before* you even run `git pull`.

---

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

---

## ✨ Key Features

- 🔍 **Real-time Git monitoring** (local + remote)
- 📄 **Line-level diff analysis** (no coarse file-only checks)
- 🌿 **Branch-agnostic** (works with any feature branch)
- 🚨 **Conflict risk classification**:
  - **HIGH** – overlapping lines in the same file
  - **MEDIUM** – same file, different regions
  - **LOW** – different files
  - **NONE** – no risk detected
- 🤖 **AI-assisted analysis** (via Ollama) with strict factual guardrails
- 🔌 **CLI + Socket.IO** for live alerts
- ⚡ **Smart caching** to avoid unnecessary recomputation

---

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

---

## 🧠 How It Works

1. **Repository Watcher**: Tracks uncommitted local changes and periodically fetches remote updates.
2. **Data Collection**: Uses `git status`, `git diff`, and `git log` to collect ground-truth data.
3. **Line-level analysis**: Extracts exact line ranges from diff hunks to match local vs remote changes per file.
4. **AI Analysis**: Consumes tool output to explain *why* a conflict may occur and recommends resolution strategies.

---

## 📊 Sample Output

```
🚩 ALERT: HIGH (Behind: 2, Ahead: 1)

📍 File Change Details
- File: src/auth.js
  - Local Changes: Lines 45–50
  - Remote Changes: Lines 48–52

🧠 Analysis
Both local and remote branches modify overlapping logic in the same function.

⚔️ Conflict Resolution Strategy
- Accept Remote
- Keep Local
- Manual Merge
```

---

## ⚙️ Advanced Configuration

To improve remote detection accuracy and avoid GitHub rate limits, add a Personal Access Token:

1. Create a `.env` file in the MergeGuard root directory.
2. Add your token:
   ```env
   GITHUB_API=github_pat_your_token_here
   ```
3. Restart the watcher.

---

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

---

## 🛠 Troubleshooting

- **Node Version**: If you see syntax errors, ensure you are on **Node 20+**.
- **Ollama Connection**: If analysis hangs, ensure `ollama run llama3.2` works independently.
- **Permissions**: You may need `sudo npm link` on some systems.

---

## 🛠️ Tech Stack

- **TypeScript** & **Node.js**
- **simple-git** for Git operations
- **Socket.IO** for live updates
- **LangChain** & **Ollama** for AI analysis
- **Yargs** for CLI management

---

## 🧑‍💻 Who This Is For

- Backend / Platform engineers
- Open-source contributors
- Teams with frequent rebases
- Developers tired of surprise merge conflicts
