# Trino-Secure UI — Session Instructions

> Read this file first, every session. It points you to the single source of truth: [`docs/`](docs/README.md).

## Startup (do this first, every session)

1. Read [`docs/README.md`](docs/README.md) — the index/map of the whole project.
2. Read the docs relevant to your task (the README tells you which).
3. **Do NOT** scan the codebase with broad `find` / `glob` / `grep` to understand the
   project. `docs/` already contains the full structure, plans, decisions, and file map.
   Use targeted file reads only when you need exact implementation details for a change.

`docs/` is the project's brain: a fresh session — human or AI — must be able to understand
the entire project and know where to continue **from `docs/` alone**, without browsing the
source tree.

## What this project is (one line)

A web UI that manages **all** of Trino's security operations (authorization `rules.json`,
authentication, group/user mapping, TLS, secrets, …) visually, with its own database as a
backup/audit layer. See [`docs/01-project-overview.md`](docs/01-project-overview.md).

## Standards (always enforce)

### Latest, verified versions
- Before adding or upgrading any dependency, **verify the current stable version**
  (`npm view <pkg> version`) — never rely on memory. Record what you used in
  [`docs/06-tech-stack.md`](docs/06-tech-stack.md).
- Prefer the most current stable releases of all tools, frameworks, and libraries.

### Clean code & best practices
- Meaningful names, single responsibility, DRY without premature abstraction.
- TypeScript strict mode; avoid `any`.
- No dead code, no commented-out blocks.
- Error handling at system boundaries.
- Follow [`docs/09-conventions.md`](docs/09-conventions.md).

### Code quality / SonarQube
- Treat linter and SonarQube (SonarJS, etc.) findings as blocking.
- **If you see ANY warning, error, or code smell — even one you did not cause — fix it
  immediately** (or report it to the user if it is large). Never dismiss a problem as
  "pre-existing" or "not my change." If you see it, you own it.

### Documentation discipline (`docs/`)
- `docs/` and `designs/` are **committed** and are the primary source of truth for context — so
  anyone (human or AI) can pick up the project from the repo. Keep them current at all times.
- **After every code change or commit, update ALL affected docs** — proactively, without being
  asked.
- [`docs/08-git-history.md`](docs/08-git-history.md) is the project changelog: log every commit
  there (hash, date, message, significance) right after committing.
- When you add a feature, system, or file, create or update the matching doc and keep the
  file map current.

### Git
- Branch off `main`; do not commit directly to `main` unless asked.
- Commit or push only when the user asks.

### Language
- **Code and docs are in English** (identifiers, comments, documentation).
- **The application UI is in Turkish** — all user-facing strings are Turkish, except
  well-established technical terms (catalog, schema, table, column, connector, `rules.json`, …).
  Use next-intl with `tr` as the primary locale; never hardcode UI strings.
- The user converses in Turkish — reply in Turkish; keep code and docs in English.

## Tech stack (summary — see [`docs/06-tech-stack.md`](docs/06-tech-stack.md))

Next.js (App Router) + React + TypeScript · Tailwind CSS + shadcn/ui · PostgreSQL + Prisma ·
Keycloak + Auth.js (NextAuth) · Zod · Playwright + Vitest · Docker Compose.
