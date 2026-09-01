# 06 — Tech Stack

**Architecture choice:** a single full-stack TypeScript app (Next.js) — frontend and backend in
one codebase. Chosen for speed of development by a small team, native Keycloak integration,
straightforward server-side file access, and consistency with the sibling project `yazam`.

> **Standing rule:** before adding or upgrading any dependency, verify the current stable
> version with `npm view <pkg> version` and update the table below. Do not pin from memory.

## Stack

| Layer | Choice | Role |
|-------|--------|------|
| Language | **TypeScript** (strict) | One typed language across the whole app |
| Framework | **Next.js** (App Router) + **React** | Full-stack: UI + server routes/actions |
| UI | **Tailwind CSS** + **shadcn/ui** | Styling + ready-made accessible components |
| Database | **PostgreSQL** | Backup/persist + audit + version history |
| ORM | **Prisma** | Typed DB access; migrations |
| Auth | **Keycloak** + **Auth.js (NextAuth)** | Authentication only (OIDC) |
| Validation | **Zod** | Validate `rules.json`, `.properties`, and forms |
| i18n | **next-intl** | Turkish UI (primary locale `tr`); English only for established terms |
| Testing | **Playwright** (e2e) + **Vitest** (unit) | Automated regression safety |
| Packaging | **Docker** + **Docker Compose** | Run app + Trino + Postgres together |

## Verified versions (2026-06-15)

Checked via `npm view <pkg> version`:

| Package | Latest stable |
|---------|---------------|
| next | 16.2.9 |
| react / react-dom | 19.2.7 |
| typescript | 6.0.3 |
| prisma / @prisma/client | 7.8.0 |
| zod | 4.4.3 |
| tailwindcss | 4.3.1 |
| @playwright/test | 1.61.0 |
| vitest | 4.1.9 |
| next-intl | 4.13.0 |
| next-auth | 5.0.0-beta.31 (Auth.js v5, in use) |
| vitest | 4.1.9 |
| @playwright/test | 1.61.0 |

Runtime deps added during Phase 0: `@prisma/adapter-pg` + `pg` (DB driver adapter), `dotenv`
(Prisma config env loading), `clsx` + `tailwind-merge` (`cn()`), `lucide-react` (icons).

Non-npm components:
- **Node.js** — 24 LTS (local toolchain currently 25). Pin via `.nvmrc`.
- **Keycloak** — 26.x (verify at deploy).
- **PostgreSQL** — 17 (docker-compose; host port **5433** to avoid a local 5432 conflict).

## Caveats to resolve at scaffold time

- **Auth.js v5 vs NextAuth v4:** `next-auth` stable is `4.x`; **Auth.js v5** (the
  `next-auth@beta` / `@auth/*` line) is what `yazam` uses but is still beta. Decide v4 vs v5 at
  scaffold time and record the decision here and in [08-git-history.md](08-git-history.md).
- **TypeScript 6 / React 19 / Next 16 / Tailwind 4 / Prisma 7 / Zod 4** are all recent majors —
  confirm peer-compatibility when scaffolding and lock versions in `package.json`.

## Why not the alternatives (summary)

- **Separate frontend + backend (e.g. React + Spring Boot/NestJS/FastAPI):** cleaner layering
  and Java would match Trino's ecosystem, but means two projects, two deploys, and more setup —
  unnecessary overhead for a single-maintainer config UI. Revisit only if a hard requirement
  ("backend must be Java", multiple client apps) appears.
- **MUI / Ant Design instead of shadcn/ui:** heavier, less customizable than owning the
  components via shadcn/ui.
- **Drizzle / TypeORM instead of Prisma:** Prisma has the gentlest learning curve and strong
  typed migrations.
