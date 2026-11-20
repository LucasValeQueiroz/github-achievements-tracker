# 🏆 GitHub Achievements Tracker

![GitHub Achievements Tracker Preview](assets/og-preview.png)

[![Live Demo](https://img.shields.io/badge/Live_Demo-GitHub_Pages-2f81f7?style=for-the-badge&logo=github)](https://lucasvalequeiroz.github.io/github-achievements-tracker/)
[![API Docs](https://img.shields.io/badge/Docs-GitHub_REST_API-3fb950?style=for-the-badge&logo=bookstack)](https://lucasvalequeiroz.github.io/github-achievements-tracker/docs.html)
[![License: MIT](https://img.shields.io/badge/License-MIT-e3b341?style=for-the-badge)](LICENSE)

Interactive dashboard and developer toolkit powered by the **GitHub REST API v3** to inspect any GitHub profile's progress across **Achievements**, **Tiers**, **Profile Highlights**, and **Retired Badges** — 100% client-side with zero runtime dependencies.

👉 **Try it live:** https://lucasvalequeiroz.github.io/github-achievements-tracker/  
👉 **Check your own profile directly:** `https://lucasvalequeiroz.github.io/github-achievements-tracker/?user=YOUR_USERNAME`

---

## ✨ Features

- **Live GitHub REST API Analysis:** Tracks **Pull Shark** (merged public PRs), **Starstruck** (top starred owned repositories), and **Quickdraw** (issues or PRs closed within 5 minutes of creation).
- **Tier Progress & Recommendations:** Calculates exact remaining counts across **Default → Bronze → Silver → Gold** tiers and prioritizes the closest unlockable milestones.
- **Pair Extraordinaire Generator:** Resolves any real GitHub collaborator username via API into a verified `id+username@users.noreply.github.com` `Co-authored-by:` trailer and copy-ready `git commit` command.
- **Galaxy Brain Q&A Finder:** Detects primary languages from owned repositories and generates filtered GitHub Discussions search links for open, unanswered Q&A threads.
- **Profile README & JSON Exporter:** Builds ready-to-paste Markdown tables with Shields.io badges and downloadable JSON reports.
- **Shareable Profile Card Generator:** Exports dark/light 1200×630 PNG & SVG profile cards ready for LinkedIn, portfolios, and social sharing.
- **Pull Shark Pace Calculator:** Interactive daily PR pace slider estimating remaining days and target dates for Bronze (16), Silver (128), and Gold (1024).
- **Side-by-Side Profile Comparator:** Compares any two GitHub users across merged PRs, top/total stars, active achievements, and followers.
- **Local Progress History (`localStorage`):** Automatically saves deduplicated browser-side snapshots per username and highlights deltas (`+PRs`, `+⭐`, `+🏆`) between visits.
- **Skin Tone Preference Preview:** Interactive 6-tone preview for **Quickdraw** and **Starstruck** with a direct link to GitHub Appearance settings.
- **GitHub Flow CLI (`Ship-PR`):** Zero-dependency Node.js CLI (`scripts/ship-pr.mjs`) to turn everyday real edits into short-lived branches + merged PRs in one command, with secret-file guardrails and verified `-CoAuthor` trailer resolution.
- **Bilingual & Accessible UI:** Instant **PT-BR / EN** language toggle, **Dark / Light** theme switcher, live API rate-limit indicator, and optional client-side Personal Access Token support (for 5,000 req/hr).

---

## 🔌 GitHub REST API Integration

All requests run directly in the browser against `https://api.github.com` with `Accept: application/vnd.github+json` and `X-GitHub-Api-Version: 2022-11-28`:

| Endpoint | Purpose |
| :--- | :--- |
| `GET /users/{username}` | Public profile info & collaborator noreply email resolution |
| `GET /users/{username}/repos?type=owner&per_page=100` | Owned repository star counts & primary languages |
| `GET /search/issues?q=author:{username}+type:pr+is:merged` | Merged public pull request count (Pull Shark) |
| `GET /search/issues?q=author:{username}+is:closed` | Recent closed items for 5-minute Quickdraw detection |

See full technical details in [docs.html](https://lucasvalequeiroz.github.io/github-achievements-tracker/docs.html).

---

## 🧪 Local Development & Tests

No build step or external packages are required — just Node.js 20+ to run the native test suite:

```bash
git clone https://github.com/LucasValeQueiroz/github-achievements-tracker.git
cd github-achievements-tracker

# Run unit tests (node:test)
node --test tests/*.test.mjs

# Preview locally with any static server
python -m http.server 8080

# Use the GitHub Flow CLI (requires git + authenticated GitHub CLI `gh`)
node scripts/ship-pr.mjs "feat: your real change"
node scripts/ship-pr.mjs "fix: pair fix" -CoAuthor collaborator-username -DryRun
```

---

## 📁 Project Structure

```text
.
├── index.html                   # Interactive dashboard UI
├── docs.html                    # GitHub REST API & architecture documentation
├── scripts/
│   └── ship-pr.mjs              # One-command GitHub Flow & Co-authored-by CLI
├── src/
│   ├── css/styles.css           # Responsive Dark/Light theme styles
│   └── js/
│       ├── achievements.js      # Achievements catalog & tier math
│       ├── github-api.js        # GitHub REST API v3 client
│       ├── analyzer.js          # Quickdraw detector, repo ranker & insights
│       ├── card-generator.js    # Shareable 1200x630 PNG/SVG card renderer
│       ├── coauthor.js          # Co-authored-by trailer generator
│       ├── comparator.js        # Side-by-side profile comparison engine
│       ├── exporter.js          # Markdown badge & JSON report exporter
│       ├── history.js           # Local snapshot history & delta tracker
│       ├── i18n.js              # PT-BR & EN translations
│       ├── pace-calculator.js   # Pull Shark daily pace & roadmap calculator
│       ├── skin-tones.js        # Quickdraw & Starstruck skin-tone preview
│       ├── toolkit-ui.js        # Interactive toolkit widgets
│       └── app.js               # Main controller & DOM renderer
└── tests/
    ├── achievements.test.mjs
    ├── analyzer.test.mjs
    ├── card-generator.test.mjs
    ├── comparator.test.mjs
    ├── exporter.test.mjs
    ├── history.test.mjs
    ├── metadata.test.mjs
    ├── pace-calculator.test.mjs
    ├── ship-pr.test.mjs
    └── skin-tones.test.mjs
```

---

## 🤝 Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

Released under the [MIT License](LICENSE).
