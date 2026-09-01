# Gotchas

Non-obvious behaviors and traps that cost time. Add to this file whenever you discover a new one.

## Trino `rules.json` / access control

- **First match wins.** Rules are evaluated top-to-bottom; the first matching rule applies.
  Ordering is semantically significant — the editor must make order explicit.
- **No match = deny.** If no rule matches, access is denied. A missing rule silently blocks.
- **Empty array denies all.** An empty rule array (e.g. `"schemas": []`) denies all access at
  that level — easy to do by accident.
- **Regex defaults to `.*`.** Omitted `user`/`role`/`group`/`catalog`/… match everything. An
  overly broad rule near the top can shadow everything below it.
- **Group rules need a Group Provider.** `group` matches do nothing unless a group provider is
  configured. A rule can look correct yet never fire.
- **`information_schema` is exempt** from catalog/schema/table/column rules.
- **`refresh-period` is required for hot reload.** Without `security.refresh-period`, Trino only
  reads the config file at startup — published changes won't take effect until restart.
- **`config-file` can be an HTTP endpoint**, not just a path — this enables serving config from
  the app (Mode A) instead of writing files (Mode B).
- **Principal rules are deprecated** — use User Mapping instead.
- **System builtin functions** are always accessible; function rules cannot override them.

## Build / tooling

- **Tailwind v4 dark mode** is class-based via `@custom-variant dark (&:is(.dark *))` in
  `globals.css`; theme tokens are HSL triplets exposed through `@theme inline`.
- **Dynamic Tailwind classes don't work** — `bg-${tone}` is never generated. Map tones to literal
  class strings (see `ENV_TONE_DOT` in `src/lib/nav.ts`).
- **No setState in effects** (Next 16 `react-hooks/set-state-in-effect`) — cross-cutting client
  state uses `useSyncExternalStore` (`src/components/providers/ui-provider.tsx`).
- **The app runs on port 3110** (`next dev -p 3110`; `next start -p 3110`). Port 3100 is taken by
  another local project (`vardiya-app`). The **working local stack reuses existing containers**:
  **app :3110 · Keycloak (`epes-keycloak`) :8080 · Postgres (`epes-postgres`) :5432** (see the real
  `.env`). The bundled `docker-compose.yml` services (`trino-secure-keycloak` :8081,
  `trino-secure-db` :5433) are an **alternative** if you don't have the epes stack — pick one and
  keep `AUTH_URL` / redirect URIs / `DATABASE_URL` consistent with it.
- **Route protection lives in `src/proxy.ts`** — Next 16 renamed the `middleware` file convention to
  `proxy` (`export { auth as proxy }` + a matcher). Using `middleware.ts` logs a deprecation warning.

## Testing

- `npm test` runs **Vitest** unit tests (pure logic: validation, env resolution, helpers).
- `npm run test:e2e` runs **Playwright** e2e. It auto-starts the dev server but needs the Docker
  stack up (`docker compose up -d`) — it performs a real Keycloak login (admin/admin → dashboard).
- Keep pure/unit-testable logic out of `"use server"` / client files (e.g. `validation.ts`,
  `environments-shared.ts`) so it can be imported by tests without server/React deps.

## Auth (Keycloak / Auth.js v5)

- All routes are protected by `src/proxy.ts` (Next 16's renamed middleware; except `/api/auth`,
  `/api/trino` + static); unauthenticated requests redirect to the Auth.js sign-in → Keycloak.
- Login needs env vars `AUTH_SECRET` + `AUTH_KEYCLOAK_{ID,SECRET,ISSUER}` (see `.env.example`).
  Without them the app builds but login won't work.
- The Keycloak client's **Valid Redirect URI** must include
  `<app-origin>/api/auth/callback/keycloak` (e.g. `http://localhost:3110/api/auth/callback/keycloak`).
- **Keycloak** for the working local setup is the existing `epes-keycloak` on **host port 8080**; the
  `trino-secure` realm/client/test-user (**admin / admin** — dev-only) were imported from
  `keycloak/import/`. (The bundled `docker-compose.yml` keycloak alternative listens on :8081.)
- `pages.signIn = /auth/signin` (a minimal page that forwards to Keycloak) **must be excluded from
  the middleware matcher**, otherwise unauthenticated → signin → signin … loops.
- Health check: `curl http://localhost:8080/realms/trino-secure/.well-known/openid-configuration`.

## Prisma 7 / database

- **`url` is not allowed in the schema datasource** (Prisma 7). The Migrate connection URL lives
  in `prisma.config.ts` (`datasource.url`, loaded from `.env` via `import "dotenv/config"`); the
  runtime client connects through a **driver adapter** (`@prisma/adapter-pg`) in `src/lib/db.ts`.
- **Generated client import path is `@/generated/prisma/client`** (the `prisma-client` generator
  emits `client.ts`, not a barrel `index`). The folder is gitignored; `postinstall` regenerates it.
- **Postgres runs on host port 5433** (5432 was already in use locally) — see `docker-compose.yml`
  and `DATABASE_URL`.
- **`npm audit` shows 3 moderate advisories** from `prisma` → `@prisma/dev` → `@hono/node-server`.
  These are **dev-only** (the Prisma CLI's local dev-postgres server), not in the production
  bundle. The only "fix" (`npm audit fix --force`) downgrades Prisma to 6.x — **do not run it**.
  Accepted until Prisma ships a patched `@prisma/dev`.

## Environments / multi-tenant isolation

- **Always scope by environment.** Groups, config artifacts, and audit belong to a single
  `TrinoEnvironment`. Pages/actions get the active env from `getActiveEnvironment()` (cookie
  `ts-active-env`, `src/lib/environment-context.ts`) — never query these across environments, so
  multiple Trino installs stay fully independent.
- The topbar env switcher is **DB-driven** (not the old static list). With zero environments it
  shows an "Ortam ekle" link; create one at `/environments` first.
- **Mode A publish endpoint** `GET /api/trino/[envId]?token=…` serves the active rules.json for
  Trino to poll. It is **proxy-exempt** (matcher excludes `api/trino`) and gated by the
  environment's `httpToken` — rotate the token from the /rules Publish dialog.
