# 🏆 GitHub Achievements Tracker

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
```

---

## 📁 Project Structure

```text
.
├── index.html                   # Interactive dashboard UI
├── docs.html                    # GitHub REST API & architecture documentation
├── src/
│   ├── css/styles.css           # Responsive Dark/Light theme styles
│   └── js/
│       ├── achievements.js      # Achievements catalog & tier math
│       ├── github-api.js        # GitHub REST API v3 client
│       ├── analyzer.js          # Quickdraw detector, repo ranker & insights
│       ├── coauthor.js          # Co-authored-by trailer generator
│       ├── exporter.js          # Markdown badge & JSON report exporter
│       ├── i18n.js              # PT-BR & EN translations
│       ├── toolkit-ui.js        # Interactive toolkit widgets
│       └── app.js               # Main controller & DOM renderer
└── tests/
    ├── achievements.test.mjs
    ├── analyzer.test.mjs
    └── exporter.test.mjs
```

---

## 🤝 Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

Released under the [MIT License](LICENSE).
