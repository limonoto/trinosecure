# 08 — Git History

The project changelog (committed in `docs/`). Log every commit here right after committing:
**hash · date · message · significance** (per [CLAUDE.md](../CLAUDE.md) and
[09-conventions.md](09-conventions.md)).

## Format

```
### <short-hash> — <YYYY-MM-DD> — <commit message subject>
- Significance: <why this commit matters / what it changes>
- Docs updated: <which docs/ files were updated with it>
```

## History

### 48d052f — 2026-06-16 — chore: initialize repository with project conventions
- Significance: Root commit. Establishes the repo with `CLAUDE.md` (session instructions +
  standards) and `.gitignore`. (`docs/` + `designs/` were later moved into version control.)
- Docs updated: 08-git-history.md (this entry).

### 77b6ee0 — 2026-06-16 — chore: scaffold Next.js 16 app (TypeScript, Tailwind, App Router)
- Significance: Phase 0 application skeleton. `create-next-app` base (Next 16.2.9, React 19.2.4,
  TypeScript, Tailwind 4, ESLint flat config); package renamed to `trino-secure-ui`. Pinned
  `postcss` to `^8.5.10` via `overrides` to clear 2 moderate npm-audit advisories (from Next's
  bundled postcss) **without** the destructive `audit fix --force` next@9 downgrade. ESLint
  ignores `designs/` + `docs/`. Verified: build OK, lint 0 problems, audit 0 vulnerabilities.
- Docs updated: 08-git-history.md, 07-roadmap.md (Phase 0 → in progress), README.md (status).

### da94ed6 — 2026-06-16 — feat: design-system theme + app shell (rail, context column, topbar)
- Significance: Ported the locked design system (`designs/assets/theme.css`) to Tailwind v4
  (`@theme inline`, class-based dark mode, component classes) and built the app shell — icon
  rail + context-column sidebar + topbar (env switcher, search, theme toggle) — with theme/env
  state via `useSyncExternalStore`. Turkish UI labels, lucide icons, `cn()` util. Dashboard +
  placeholder pages for all in-scope routes. Verified: build OK, lint 0.
- Docs updated: 08-git-history.md, 07-roadmap.md.

### 7904a6d — 2026-06-16 — feat: PostgreSQL + Prisma data layer (schema, init migration, pg adapter)
- Significance: Phase 0 persistence. Prisma 7 schema (TrinoEnvironment, AppGroup,
  AppGroupMember, ConfigArtifact, ConfigVersion, AuditLog + enums). Runtime client via
  `@prisma/adapter-pg` (Prisma 7: url in `prisma.config.ts` for Migrate, adapter for the
  client), singleton in `src/lib/db.ts`. Generated client → `src/generated/prisma` (gitignored;
  `postinstall` regenerates). docker-compose Postgres 17 on host port 5433 (5432 was taken).
  First migration `20260616080715_init` applied; build + lint clean.
- Docs updated: 05-database-schema.md, 06-tech-stack.md, 07-roadmap.md, 08-git-history.md, gotchas.md.

### 28f6670 — 2026-06-16 — feat: Keycloak authentication via Auth.js v5 (OIDC, protected routes)
- Significance: Phase 0 auth. next-auth v5 (beta) + Keycloak provider (JWT sessions, edge
  middleware). `src/auth.ts`, `app/api/auth/[...nextauth]/route.ts`, `src/middleware.ts` (protects
  all routes but `/api/auth` + static), `src/lib/auth-actions.ts` (sign-out). The `(app)` layout
  reads the session server-side → topbar shows the user + sign-out. Env-driven (`AUTH_SECRET`,
  `AUTH_KEYCLOAK_*`). Build + lint clean. End-to-end login NOT verified (needs the live Keycloak
  realm + a browser).
- Docs updated: 07-roadmap.md, 08-git-history.md, README.md, gotchas.md.

### b8b4475 — 2026-06-16 — feat: self-contained local Keycloak (realm import) + sign-in page
- Significance: Local dev Keycloak verified end-to-end. docker-compose Keycloak 26 on host port
  8081 (8080 taken by another local Keycloak) with realm/client/test-user imported from
  `keycloak/import/trino-secure-realm.json` (realm `trino-secure`, client `trino-secure-ui`, user
  admin/admin — dev-only). Auth.js `pages.signIn=/auth/signin` + minimal sign-in page forwarding
  to Keycloak; middleware excludes `/auth/signin`. Verified: OIDC discovery 200, password-grant
  token (admin/admin), providers=keycloak, "/" → 307 `/auth/signin` → 200. Build + lint clean.
- Docs updated: 07-roadmap.md, 08-git-history.md, gotchas.md.

### d255d4d — 2026-06-16 — feat: Environments CRUD (DB-backed, server actions, audit)
- Significance: First Phase 1 DB-CRUD slice + reusable patterns. `/environments` page (list +
  create/edit/delete) on real Prisma data; server actions with Zod validation + `recordAudit()`
  (`src/lib/audit.ts`) writing AuditLog with the Keycloak actor. Modal via native `<dialog>` +
  `useActionState`. New dep: zod. Verified: build + lint clean and runtime DB CRUD (smoke).
- Docs updated: 07-roadmap.md, 08-git-history.md, README.md.

### 6877132 — 2026-06-16 — feat: DB-driven active-environment context (multi-Trino isolation)
- Significance: Makes multiple Trino installations independently manageable at the app layer (the
  data model already isolated everything by `environmentId`). Active env via the `ts-active-env`
  cookie (`src/lib/environment-context.ts` + `environment-actions.ts`); topbar switcher now lists
  DB environments and switches the active one; sidebar reflects it. ui-provider trimmed to
  theme-only; nav.ts dropped the hardcoded env list. Build + lint clean.
- Docs updated: 02-architecture.md, 07-roadmap.md, 08-git-history.md, gotchas.md.

### 884a0be — 2026-06-16 — feat: Groups CRUD + membership (scoped to active environment)
- Significance: First per-environment identity feature. `/groups` scoped to the active env;
  create/edit/delete groups (Zod + audit) + member add/remove via a side drawer (optimistic
  list). Every action verifies the group belongs to the active env (cross-env isolation). Group
  modal = native `<dialog>` + `useActionState`; members drawer = `<dialog>` + transitions.
  Verified: build + lint clean; runtime smoke OK (env→group→members + cascade delete).
- Docs updated: 07-roadmap.md, 08-git-history.md, README.md.

### fb835ea — 2026-06-16 — test: Vitest unit tests + extract pure validation/env modules
- Significance: Test foundation. Vitest wired (`npm test`); extracted pure, testable modules
  (`validation.ts` Zod schemas, `environments-shared.ts`, `form.ts`) and added 20 unit tests.
  Fixed SonarQube S6551 (FormData stringification) via `formString`.
- Docs updated: 06-tech-stack.md, 07-roadmap.md, 08-git-history.md, gotchas.md.

### 3f32a2e — 2026-06-16 — test: Playwright e2e (auth) + pin app to port 3100
- Significance: E2E coverage including a **full Keycloak login** (admin/admin → dashboard, the
  complete browser OIDC round-trip). Pinned the app to **port 3100** (3000/8080/5432 are used by
  another local project); realm redirect URIs + `AUTH_URL` → :3100. Renamed `middleware.ts` →
  `proxy.ts` (Next 16 proxy convention; clears the deprecation warning). All green: build + lint +
  20 unit + 2 e2e.
- Docs updated: 06-tech-stack.md, 07-roadmap.md, 08-git-history.md, gotchas.md.

### 4e0a04c — 2026-06-16 — feat: rules.json domain model + validation (unit-tested)
- Significance: Pure, tested core for the rules editor. Zod schemas (catalog/schema/table +
  column constraints) with passthrough; parse/serialize/validate (regex + deny-all), ruleCounts,
  EMPTY_RULES. 13 unit tests.
- Docs updated: 07-roadmap.md, 08-git-history.md.

### 6aafc8f — 2026-06-16 — feat: rules.json workspace UI (structured view + raw editor, versioned save)
- Significance: First functional rules editor. `/rules` scoped to the active env; structured read
  tables (catalog/schema/table) + a raw JSON editor with live validation; versioned save
  (ConfigArtifact/ConfigVersion + audit) via `src/lib/rules/service.ts`. The per-rule structured
  editor + drag-to-reorder + import/publish are follow-ups (editing is raw-JSON for now).
  Verified: build + lint + 33 unit + a versioning runtime smoke.
- Docs updated: 07-roadmap.md, 08-git-history.md, README.md.

### c0e82a8 — 2026-06-16 — feat: structured per-rule editor for rules.json (add/edit/delete + drag-reorder)
- Significance: The /rules structured view is editable — add/edit/delete + drag-to-reorder
  (first-match-wins) for table/catalog/schema rules via per-kind drawer forms; stable client keys
  keep identity across reorder; the "Ham JSON" tab round-trips into the structured doc via
  "Uygula"; save persists a new version. build + lint + 33 unit green.
- Docs updated: 07-roadmap.md, 08-git-history.md.

### 212d4b4 — 2026-06-16 — feat: rules version history + rollback + export
- Significance: /history lists an environment's rules.json versions (active badge, author, UTC
  date, note) with one-click rollback (makes an older version active); /rules gains an export
  download. Service: listRulesVersions / getVersionContent / rollbackRules (audit ROLLBACK).
- Docs updated: 07-roadmap.md, 08-git-history.md.

### 742c841 — 2026-06-16 — feat: rules.json import & diff
- Significance: /import — paste/upload a rules.json → live validation → LCS line diff vs current →
  apply as a new version (audit IMPORT). New testable diff.ts (diffLines/diffStats) + 4 unit tests.
- Docs updated: 07-roadmap.md, 08-git-history.md.

### eecc43e — 2026-06-16 — feat: publish rules.json to Trino — Mode A (HTTP) + Mode B (file)
- Significance: Mode A — `GET /api/trino/[envId]` serves the active rules.json (per-env bearer
  token, proxy-exempt) for Trino to poll; Mode B — write the active rules.json to configTarget.
  Publish dialog on /rules (endpoint URL + token rotate + Trino config snippet, or file write).
  Migration `add_env_http_token`. Endpoint verified proxy-exempt (404 for unknown env, not a
  redirect).
- Docs updated: 02-architecture.md, 07-roadmap.md, 08-git-history.md, README.md, gotchas.md.

### 699e098 — 2026-06-16 — docs: version docs/ + designs/, add comprehensive README
- Significance: The project is now self-documenting in the repo. Added a self-contained root
  `README.md` and brought `docs/` (technical docs) + `designs/` (UI mockups) into version control
  (previously local-only) so contributors can pick up the project from a clone alone.
- Docs updated: CLAUDE.md, 02-architecture, 07-roadmap, 09-conventions, docs/README, 08-git-history.

### 63abc98 — 2026-06-16 — test: comprehensive e2e for the core flow (auth reuse + DB seed)
- Significance: Verifies the whole "manage JSON from the UI" pipeline end-to-end against the real
  stack — environments, groups + members, rules raw-edit→Uygula→Kaydet→history, structured rule
  add. Playwright projects (setup/guest/authed) + a tsx-seeded `e2e-main` env. All green: lint,
  37 unit, build, 6 e2e.
- Docs updated: 07-roadmap.md, 08-git-history.md, README.md.

### 15eb407 — 2026-06-16 — feat: structured editors for all 11 rules.json sections (registry-driven)
- Significance: The rules.json editor now manages **every** section structurally, not just
  table/catalog/schema. Introduced a single declarative registry
  (`src/app/(app)/rules/rule-sections.ts`) describing each section's form fields + table columns;
  the drawer and the section tables are now fully data-driven from it. Added a **column-mask /
  column-hide + row-filter sub-editor** for table rules. Generalized the editor document model
  (`rule-types.ts`: `toEditorDoc`/`toDocument` over all sections, preserving intentional empty
  arrays = deny-all and round-tripping unknown top-level keys). Sections covered: tables, catalogs,
  schemas, functions, procedures, queries, impersonation, authorization, system_information,
  system_session_properties, catalog_session_properties.
- Tests: Vitest 47 unit (new: all-section schema validation + editor round-trip + moveItem);
  Playwright 6 e2e (added a non-table generic-editor test — impersonation). Build + lint + types
  all clean (SonarQube diagnostics heeded: removed unnecessary type assertions).
- Docs updated: 04-rules-json-reference.md, 07-roadmap.md, 08-git-history.md, README.md.

_Next: a live-Trino enforcement check (point a real Trino at the Mode A endpoint); then deferred phases (auth methods, TLS, secrets, OPA/Ranger)._

---

## NİZAM rewrite (branch `nizam-rewrite`)

Full rebuild for the NİZAM scope ([`Projeİsterleri.txt`](../Projeİsterleri.txt)) — single dark theme,
single sidebar, full requirements. Proven pure-logic modules kept; design + data model + feature
surface rebuilt. See [07-roadmap.md](07-roadmap.md).

### 1f0e68e — 2026-06-29 — feat(nizam): Phase 0 — dark single-theme redesign + foundation
- Significance: New design system (single **dark** theme, single sidebar), next-intl (`tr`), Prisma v2
  schema (RBAC + nodes + time-series metrics + alerts), Keycloak/RBAC role-claim auth, real dashboard,
  placeholder routes. App on port 3110.
- Verified: typecheck, lint, 47 unit, build, 7 e2e (real Keycloak login).
- Docs updated: 05-database-schema, 07-roadmap, README.

### 417efe9 — 2026-06-29 — feat(nizam): Phase 1 — rules.json analyses
- Significance: Pure, tested analyses + UI — effective-permission preview ("can user/group X do Y?"),
  allow/deny conflict & shadow detection, logical (semantic) diff, boot-readiness check (badge +
  server guard).
- Verified: typecheck, lint, 71 unit, build, 7 e2e.
- Docs updated: 07-roadmap.

### 9d1b087 — 2026-06-29 — feat(nizam): Phase 2 (a,b) — password.db + catalog editors
- Significance: `password.db` manager (bcrypt-only, no plaintext, CRUD + export) and catalog/JDBC editor
  (connector registry with type-aware suggested params + `.properties` export).
- Verified: typecheck, lint, 80 unit, build, e2e.
- Docs updated: 07-roadmap.

### 35f3f3b — 2026-06-30 — feat(nizam): Phase 2 (c,d,e) — group-provider, resource-groups, provisioning
- Significance: `group-provider.txt` (static/LDAP, user→group table, exports), `resource-groups.json`
  (tree view with graphical soft/hard limits + selectors + raw edit), and cluster user provisioning
  (create password user + assign group). Introduces a reusable generic `config-artifact.ts` (versioned
  active/history/rollback storage). **Phase 2 complete.**
- Verified: typecheck, lint, 92 unit, build, 7 e2e.
- Docs updated: 07-roadmap.

### e194ba8 — 2026-06-30 — feat(nizam): Phase 3a — audit-log viewer
- Significance: `/audit` filterable table (actor/action/entity) + before/after detail drawer over the
  audit trail recordAudit writes everywhere.
- Docs updated: 07-roadmap.

### 9386acb — 2026-06-30 — feat(nizam): Phase 3b — RBAC enforcement + roles admin
- Significance: `authz.ts` effective-role resolution + bootstrap; every mutating action gated
  (CONFIG_EDITOR writes, PLATFORM_ADMIN for publish/token/env-delete); `/settings` roles admin.
  **Phase 3 complete.**
- Verified: typecheck, lint, 92 unit, build, 7 e2e.
- Docs updated: 07-roadmap; `.env.example` (NIZAM_ADMIN_USERS).

### 696beec — 2026-06-30 — feat(nizam): Phase 4 — deployment, drift, node discovery, Ansible
- Significance: Trino REST API client (tested normalizers), `/deploy` with drift detection (FILE diff /
  HTTP auto-sync), node discovery into TrinoNode inventory, and Ansible inventory+playbook generation
  with controlled rolling restart. `trinoBaseUrl` added to environments. **Phase 4 complete.**
- Verified: typecheck, lint, 98 unit, build, 7 e2e.
- Docs updated: 07-roadmap.

### a7d25a3 — 2026-06-30 — feat(nizam): Phase 5 — observability collector + ingestion
- Significance: tested ingestion (parseTrinoDuration/normalizeQuery), collector (ClusterMetric/
  NodeMetric/QueryStat, upsert-deduped), token-gated `/api/collect` + standalone croner scheduler
  (`npm run collect`) + `collectNow` action. **Phase 5 complete.**
- Verified: typecheck, lint, 103 unit, build.
- Docs updated: 07-roadmap; `.env.example` (COLLECTOR_*).

### fdc57c2 — 2026-06-30 — feat(nizam): Phase 6 — observability dashboards (Recharts)
- Significance: four standard dashboards (Cluster Overview, Error & Failure with drill-down + type
  filter, Node Health, Resource Group Performance) over the Phase-5 time series; shared time-range
  control + themed Recharts wrappers + tested aggregation/range helpers. **Phase 6 complete.**
- Verified: typecheck, lint, 110 unit, build.
- Docs updated: 07-roadmap.

### d984ec1 — 2026-06-30 — feat(nizam): Phase 7 — alerting & anomaly detection
- Significance: static threshold + z-score anomaly evaluation (tested), windowed metric computation +
  rule engine writing AlertEvents on FIRING↔RESOLVED transitions (run after each collection), and the
  `/alerts` rule CRUD + history UI. **All NİZAM phases (0–7) complete.**
- Verified: typecheck, lint, 116 unit, build, 7 e2e.
- Docs updated: 07-roadmap, README.

_All phases complete. Deferred follow-ups: live PBKDF2, per-worker node metrics, extra dashboard
filters, and the original deferred set (auth methods, TLS, secrets, OPA/Ranger)._

### 41860f3 — 2026-06-30 — feat(ui): collapsible sidebar; remove active-environment card
- Significance: Sidebar collapses to an icon-only rail (state persisted via the `ts-sidebar` cookie,
  read server-side to avoid a hydration flash); dropped the redundant active-environment card.
- Docs updated: —

### 120e097 — 2026-07-03 — feat(nizam): gap-closure pass — implement deferred audit follow-ups
- Significance: Implements the remaining deferred audit follow-ups identified in the gap-closure pass.
- Docs updated: —

### f7f1ccf — 2026-07-03 — fix(ui): responsive sidebar — mobile off-canvas drawer + hamburger trigger
- Significance: Below `lg` the sidebar was `hidden` with no fallback, so small screens lost all
  navigation. Adds a slide-in mobile drawer (backdrop + close button, dismissed on route change)
  toggled by a topbar hamburger; shared sidebar state moved to `SidebarContext` and brand/nav
  extracted for reuse between the desktop rail and the drawer. Fulfills the design brief's
  "mobile nav drawer" / "responsive sidebar" requirement. Hardcoded Turkish rail labels moved to a
  new `sidebar` i18n namespace.
- Verified: typecheck, lint, 151 unit.
- Docs updated: 08-git-history.md (this entry).

---

## Public repository (fresh history)

This directory was re-initialized as a standalone Git repository for publishing to GitHub, so
the commits above belong to the original working repository and are kept here as the project
changelog. The public repository starts from a single squashed commit.

### e280a9a — 2026-09-01 — Initial commit: Trino-Secure UI
- Significance: First commit of the public repository — full snapshot of the project (276 files).
- Excluded from version control: `environments-backup.json` (a local database dump containing an
  internal cluster IP and absolute local paths); added to `.gitignore`.
- Docs updated: 08-git-history.md (this entry).
