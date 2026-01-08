# 🛡️ MergeGuard

**Real-time Git merge conflict detection with line-level accuracy**

MergeGuard is a developer tool that **proactively detects merge-conflict risks** by continuously monitoring **local and remote Git changes** and analyzing them at the **exact file and line level**.
It alerts developers *before* pulling or merging — preventing broken builds, wasted reviews, and last-minute conflicts.

## 🚀 Why MergeGuard?

Most merge conflicts are discovered **too late**:

* During `git pull`
* While rebasing
* Inside PR reviews

MergeGuard shifts conflict detection **left** by:

* Watching your repository in real time
* Comparing **local feature branches** against **remote branches (e.g., main)**
* Reporting **exact files and line ranges** at risk


## ✨ Key Features

* 🔍 **Real-time Git monitoring** (local + remote)
* 📄 **Line-level diff analysis** (no coarse file-only checks)
* 🌿 **Branch-agnostic**

  * Works with feature branches (not limited to `main`)
* 🚨 **Conflict risk classification**

  * **HIGH** – overlapping lines in the same file
  * **MEDIUM** – same file, different regions
  * **LOW** – different files
  * **NONE** – no risk detected
* 🤖 **AI-assisted analysis with strict guardrails**

  * Uses only Git tool output
  * Zero hallucinations
* 🔌 **CLI + Socket.IO** for live alerts
* ⚡ **Smart caching** to avoid unnecessary recomputation


## 🧠 How It Works

1. **Repository Watcher**

   * Tracks uncommitted local changes
   * Periodically fetches remote updates

2. **Ground-truth data collection**

   * `git status`
   * `git diff --unified=0`
   * `git log` (ahead / behind)
   * Local vs remote diffs

3. **Line-level analysis**

   * Extracts exact line ranges from diff hunks
   * Matches local vs remote changes per file

4. **AI Safety Analysis**

   * Consumes only tool output
   * Explains *why* a conflict may occur
   * Never guesses or invents data

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

## 🛠️ Tech Stack

* **TypeScript**
* **Node.js**
* **simple-git**
* **Socket.IO**
* **LangChain**
* **Ollama (local LLMs)**
* **Yargs (CLI)**

## 📦 Installation

```bash
git clone https://github.com/<your-username>/mergeguard
cd mergeguard
npm install
npm run build
npm link
```

## ▶️ Usage

### Watch mode (recommended)

```bash
mergeguard -w
```

* Watches the repository continuously
* Emits alerts on:

  * Local file changes
  * Remote branch updates
  * Conflict-risk detection

### One-time analysis

```bash
mergeguard -a
```

With a custom prompt:

```bash
mergeguard -a "Analyze repository safety"
```

## 🧪 Supported Workflows
* ✅ Feature branch vs remote `main`
* ✅ Open-source contribution model
* ✅ Local commits ahead of remote
* ✅ Remote commits behind local
* ❌ No assumption that local and remote branches match

## 🧯 What MergeGuard Does *Not* Do

* ❌ Does NOT auto-merge
* ❌ Does NOT modify files
* ❌ Does NOT give generic Git advice without data

If required data is missing, MergeGuard explicitly reports:

**“Insufficient data from tools.”**

## 📌 Design Philosophy

**Never guess. Always verify.**

* Tool-first reasoning
* Explicit handling of missing data
* AI constrained to factual outputs only

## 🧑‍💻 Who This Is For

* Backend / Platform engineers
* Open-source contributors
* Teams with frequent rebases
* Developers tired of surprise merge conflicts

<img width="1325" height="403" alt="Screenshot 2026-01-07 at 22 54 09" src="https://github.com/user-attachments/assets/b5abd5b8-230f-4927-91ca-be02e83d911f" />
