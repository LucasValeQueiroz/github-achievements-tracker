# Contributing to GitHub Achievements Tracker

Thank you for your interest in contributing! Every genuine improvement — code, translations, documentation, or bug reports — is welcome.

## Development Setup

This project uses zero-dependency ES Modules and Node.js native testing (Node 20+ recommended).

1. Fork and clone the repository:
   ```bash
   git clone https://github.com/LucasValeQueiroz/github-achievements-tracker.git
   cd github-achievements-tracker
   ```
2. Run the unit test suite:
   ```bash
   node --test tests/*.test.mjs
   ```
3. Preview locally with any static HTTP server (e.g., `npx serve .` or Python `python -m http.server 8080`).

## Pull Request Guidelines

- Create a feature branch from `main` (e.g., `feat/my-improvement` or `fix/rate-limit-copy`).
- Keep PRs focused and small.
- Add or update unit tests in `tests/` when changing logic in `src/js/`.
- If pair programming with a teammate, feel free to include a verified `Co-authored-by:` trailer in your commit message!
