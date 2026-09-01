# Trino-Secure UI — Documentation

This `docs/` directory is the **single source of truth** for the project. It is written so
that any new session — human or AI — can understand the entire project (purpose,
architecture, plans, conventions, file map, history) and know where to continue **without
scanning the source tree**.

> Read this index first, then the docs relevant to your task.

## Index

| # | Doc | What's inside |
|---|-----|---------------|
| ★ | [İster Takip (TR)](ister-takip.md) | **Single source of truth** for requirement compliance + backlog: every `Projeİsterleri.txt` item with ✅/🟨/❌ status, verification snapshot, and the consolidated to-do list |
| — | [Genel Tanıtım (TR)](genel-tanitim.md) | Newcomer intro (Turkish): what the app does, its capabilities, duties, and general requirements — zero prior knowledge needed |
| — | [Kullanıcı Kılavuzu (TR)](kullanici-kilavuzu.md) | End-user manual (Turkish): what the app does, Trino connections, auth, authorization steps |
| — | [Dağıtım & Senkronizasyon Kılavuzu (TR)](kilavuz-dagitim-senkronizasyon.md) | Operator guide (Turkish): HTTP vs FILE mode, SSH config, Ansible runner setup, per-scenario walkthroughs, background flow |
| — | [Glossary](00-glossary.md) | Plain-language definitions of every Trino / security / web term used |
| 01 | [Project Overview](01-project-overview.md) | What we are building, the problem, goals, scope |
| 02 | [Architecture](02-architecture.md) | Control-plane model, DB-as-backup, Keycloak, file-sync strategy |
| 03 | [Trino Security Model](03-trino-security-model.md) | Full inventory of Trino security operations the UI must manage |
| 04 | [rules.json Reference](04-rules-json-reference.md) | The 13 rule types of file-based access control, in detail |
| 05 | [Database Schema](05-database-schema.md) | App DB tables (groups, config versions, audit) — backup/persist layer |
| 06 | [Tech Stack](06-tech-stack.md) | Technologies, verified versions, rationale |
| 07 | [Roadmap](07-roadmap.md) | Phased plan (Phase 0–6) with status |
| 08 | [Git History](08-git-history.md) | Every commit: hash, date, message, significance |
| 09 | [Conventions](09-conventions.md) | Clean code, SonarQube policy, docs discipline, versioning |
| 10 | [Design Brief](10-design-brief.md) | UI screen inventory + design-tool prompt; locks the visual direction |
| 11 | [Deployment Guide](11-deployment-guide.md) | Config sync strategy per topology (single-node / Docker cluster / production multi-host), Ansible runner setup, environment checklist, decision tree |
| — | [Gotchas](gotchas.md) | Non-obvious behaviors and traps |

## Subfolders

- [recipes/](recipes/) — step-by-step checklists for common multi-file tasks (filled as the code grows).
- [interfaces/](interfaces/) — function signatures, component and API contracts (filled as the code grows).

## How to use

**At session start:** read this README → read the doc(s) for your task → check [gotchas.md](gotchas.md).
**During work:** keep changes aligned with [09-conventions.md](09-conventions.md).
**After changes:** update every affected doc, and [08-git-history.md](08-git-history.md) on every commit.

## Status

- **NİZAM rewrite + gap-closure — all `Projeİsterleri.txt` requirements met** on branch
  `nizam-rewrite`: single **dark** single-sidebar UI; config editors (rules.json + analyses,
  resource-groups, group-provider, password.db incl. PBKDF2, catalogs); RBAC + fine-grained scope +
  audit viewer; deployment + drift + per-node consistency + Ansible; observability collector →
  dashboards (incl. query drill-down, custom range, filters, RG performance) → alerting. Current
  live status in [`ister-takip.md`](ister-takip.md). Verified: typecheck + lint + **151 unit** +
  build green; **e2e 7/7** (runs against a production build — the earlier dev-overlay flake is
  fixed). App on **port 3110**.
- `docs/` and `designs/` are **committed** — the source of truth for contributors (the root
  `README.md` is the public entry point; `docs/` holds the detailed technical docs).

## Last Updated

2026-07-16 — Resource-groups CRUD + tree visualization; `.properties` CRUD + deploy pipeline.
Resource-groups editor gains full add/edit/delete via `GroupFormDialog`, recursive tree with
connector lines (`GroupNode`), `MemoryBar`/`ConcurrencyBar` graphics, and auto memory %
calculation with parent-overflow warning. New `/properties` page (Cluster Konfigürasyonu)
manages all 4 Trino `.properties` files with typed form + raw toggle editors, dirty detection,
and version history. Prisma schema extended with `RESOURCE_GROUPS_PROPERTIES` +
`GROUP_PROVIDER_PROPERTIES`. `buildFileMap` → `destinationFor` → Ansible/SHA-256/SSH import
pipeline covers all 4 new files. Sidebar: Konfigürasyon → Cluster Konfigürasyonu.

2026-07-01 — Gap-closure pass: fine-grained authz (3.2), audit before/after (3.3), password.db +
catalog versioning + PBKDF2 (4.1/2.1), rollback auto re-deploy (4.3), per-node consistency (2.3/5.3),
query drill-down + per-worker/task metrics + custom range + filters (6.x), plus RG performance
dashboard, coordinator-vs-worker load, and boot-check for all config files. Single-source status:
[`ister-takip.md`](ister-takip.md). In-app interactive guide at `/guide`.

2026-07-01 — **Local Trino repaired + dashboards populated.** The container's `trino/etc` host bind
mount had detached (host dir deleted), so `/v1/query` returned HTTP 500 and the observability
dashboards were empty. Recreated the full `trino/etc` config + `rules.json` and restarted the
container; ran sample queries and collected metrics for `local-trino`. All five dashboards now render
real data. Full runbook (including the detached-mount gotcha): [recipes/run-trino-locally.md](recipes/run-trino-locally.md).

2026-06-22 — Added a local Trino dev cluster (`trinodb/trino:481`, host port 8085) with file-based
access control reading `trino/etc/rules.json` and sample catalogs (tpch, memory).

2026-06-16 — Phase 1 MVP complete: rules.json editor (structured+raw+validation+drag), history/rollback, import/diff, publish Mode A/B (…`eecc43e`).
