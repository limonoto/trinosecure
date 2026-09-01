# 07 — Roadmap (NİZAM)

Phased plan for the **NİZAM** scope (see [`Projeİsterleri.txt`](../Projeİsterleri.txt)): full
visual management of every Trino config file + RBAC + versioning + deployment/drift + a complete
observability/metrics/analytics/alerting layer. Status legend: ⬜ not started · 🟨 in progress · ✅ done.

> **Rewrite (2026-06-29):** the project is being rebuilt on branch `nizam-rewrite` to cover the
> full NİZAM requirements with a **single dark theme + single-sidebar** UI. The proven pure-logic
> modules (rules parse/validate/diff, audit, environment context) are kept; the design system, shell,
> data model, and feature surface are rebuilt. Decisions: in-app observability (PostgreSQL + Recharts),
> dark single theme, single left sidebar. App runs on **port 3110**.

## Phase 0 — Skeleton & new design system ✅ (complete)
- ✅ Branch `nizam-rewrite`; deps added (recharts, next-intl, bcryptjs, croner, date-fns, tsx).
- ✅ **Single dark theme** design system ([`globals.css`](../src/app/globals.css)) — light palette /
  `.dark` toggle / theme switcher removed; one teal accent + semantic colors.
- ✅ **Single-sidebar shell** ([`sidebar.tsx`](../src/components/shell/sidebar.tsx) +
  minimal [`topbar.tsx`](../src/components/shell/topbar.tsx)); comprehensive nav covering all NİZAM
  areas ([`nav.ts`](../src/lib/nav.ts)).
- ✅ **next-intl** (single `tr` locale, no routing) — strings in [`messages/tr.json`](../messages/tr.json).
- ✅ **Prisma v2** schema: RBAC (`AppUserRole`), `TrinoNode`, `PasswordEntry`, `CatalogConfig`,
  time-series (`QueryStat`, `NodeMetric`, `ClusterMetric`, `ErrorBucket`), alerting (`AlertRule`,
  `AlertEvent`), new config types — migration `20260629…_nizam_v2_…` applied.
- ✅ Keycloak auth + **RBAC role claim → session** (edge-safe [`rbac.ts`](../src/lib/rbac.ts)).
- ✅ Real dashboard (live counts + audit feed); placeholder pages for all future routes.
- **Verified:** typecheck + lint + 47 unit + production build + 7 e2e (incl. real Keycloak login) green.

## Phase 1 — Authorization core (`rules.json`) 🟨 (near complete) — [2.1·2.2·4.1·4.2·4.3·5.1]
Structured editor (all sections) · drag&drop priority · SELECT/OWNERSHIP/INSERT/DELETE/UPDATE selection ·
versioning/history/rollback · import/export · line diff · publish Mode A (HTTP) + Mode B (file) — all
**carried over + verified** under the new shell. New analyses added this rewrite (pure libs + unit tests):
- ✅ **Effective-permission rule preview** — "can user/group X do Y?" first-match-wins evaluator
  ([`effective.ts`](../src/lib/rules/effective.ts)) + "Erişim Önizleme" drawer.
- ✅ **Allow/deny conflict & shadow detection** ([`conflicts.ts`](../src/lib/rules/conflicts.ts)) —
  duplicate-scope + catch-all unreachable rules, surfaced in the editor.
- ✅ **Logical (semantic) diff** ([`logical-diff.ts`](../src/lib/rules/logical-diff.ts)) — field-level
  changes ("privileges: [SELECT] → [SELECT, INSERT]"), shown on the import page.
- ✅ **Boot-readiness check** ([`boot-check.ts`](../src/lib/rules/boot-check.ts)) — "Trino'da ayağa
  kalkar/kalkmaz" badge + server-side save guard.
- ⬜ Remaining: optional **live** Trino probe (does the cluster accept the reload?) — deferred to Phase 4.

## Phase 2 — Identity & remaining config editors ✅ (complete) — [1.2·2.1·2.3]
- ✅ **`password.db` manager** — no plaintext (bcrypt hash only), add/remove users, change password,
  encoding type, `password.db` export. Pure format lib ([`passwords/format.ts`](../src/lib/passwords/format.ts))
  + tests; `/passwords`.
- ✅ **Catalog/JDBC editor** — connector registry with **type-aware suggested params**
  ([`catalogs/connectors.ts`](../src/lib/catalogs/connectors.ts)) + free-form key/value, `.properties`
  export. Tests; `/catalogs`.
- ✅ **`group-provider.txt`** — static/LDAP split, user→group table, file + `.properties` export
  ([`group-provider/format.ts`](../src/lib/group-provider/format.ts) + `provider.ts`); `/mapping`.
- ✅ **`resource-groups.json`** — tree visualization with graphical soft-memory bars + hard-concurrency/
  queue badges, selectors table, raw edit + validation + export ([`resource-groups/`](../src/lib/resource-groups/)); `/resource-groups`.
- ✅ **Cluster user provisioning** — add a password user **and** assign to a group in one step
  (`/passwords` create flow). Live "present on all nodes" verification is wired in Phase 4 (drift),
  which adds the node inventory + Trino API.

Reusable: a generic versioned [`config-artifact.ts`](../src/lib/config-artifact.ts) (active version +
history + rollback) now backs group-provider, resource-groups, and future file editors.

**Phase 2 verified:** typecheck, lint, 92 unit, build, 7 e2e.

## Phase 3 — RBAC & audit governance ✅ (complete) — [3.1·3.2·3.3]
- ✅ **Audit-log viewer** (`/audit`) — filterable table (actor / action / entity) + detail drawer with
  before/after JSON.
- ✅ **RBAC enforcement** ([`authz.ts`](../src/lib/authz.ts)) — every mutating server action is gated:
  writes need **CONFIG_EDITOR**, sensitive ops (publish, token rotate, env delete) need
  **PLATFORM_ADMIN**; reads/exports open to **VIEWER**. Effective role = max(Keycloak realm roles,
  `NIZAM_ADMIN_USERS`, DB `AppUserRole` global/per-env). Bootstrap: unconfigured ⇒ admin.
- ✅ **Roles admin** (`/settings`) — assign/remove roles per user, global or per-environment; shows the
  current user's effective role (3.1/3.2).

**Phase 3 verified:** typecheck, lint, 92 unit, build, 7 e2e (writes pass under bootstrap admin).

## Phase 4 — Deployment & environment consistency ✅ (complete) — [5.1·5.2·5.3]
- ✅ **Trino REST API client** ([`trino-api/client.ts`](../src/lib/trino-api/client.ts)) — typed,
  tested normalizers for `/v1/info`, `/v1/cluster`, `/v1/node`, `/v1/query` (shared with Phase 5).
- ✅ **Drift detection** (`/deploy`) — FILE mode reads the target file and diffs it against the active
  rules.json; HTTP mode reports auto-sync. `trinoBaseUrl` added to environments.
- ✅ **Node consistency** — discover cluster nodes via `/v1/node` into the `TrinoNode` inventory
  (coordinator + workers), shown with last-seen.
- ✅ **Ansible** ([`deploy/ansible.ts`](../src/lib/deploy/ansible.ts)) — generate inventory + playbook
  that copies every managed config file to all nodes; **controlled restart** via `serial: 1` rolling
  handler, or hot-reload when off. Multi-env Test/Prod via the existing environment model.

**Phase 4 verified:** typecheck, lint, 98 unit, build, 7 e2e.

## Phase 5 — Observability foundation (collection) ✅ (complete) — [6.1·6.3·6.4 data]
- ✅ **Ingestion** ([`metrics/ingest.ts`](../src/lib/metrics/ingest.ts)) — tested `parseTrinoDuration`
  + `normalizeQuery` (/v1/query → QueryStat), plus `/v1/status` CPU/heap normalizer.
- ✅ **Collector** ([`metrics/collector.ts`](../src/lib/metrics/collector.ts)) — `collectOnce`/`collectAll`
  write ClusterMetric, NodeMetric (coordinator), and per-query QueryStat (upserted by queryId so
  re-polling never double-counts). Each source is independent/fault-tolerant.
- ✅ **Trigger**: token-protected `POST /api/collect` (proxy-exempt) + standalone scheduler
  ([`src/collector/index.ts`](../src/collector/index.ts), `npm run collect`, croner) + a `collectNow`
  action for manual UI runs.

**Phase 5 verified:** typecheck, lint, 103 unit, build. (Per-worker CPU/heap beyond the coordinator
needs each worker's `/v1/status` reachable — noted for later.)

## Phase 6 — Dashboards & analytics ✅ (complete) — [6.2·6.3·6.4·6.5]
Recharts dashboards over the Phase-5 time series, with a shared time-range control + themed chart
wrappers ([`charts.tsx`](../src/components/charts.tsx)) and tested aggregation helpers
([`metrics/aggregate.ts`](../src/lib/metrics/aggregate.ts), `range.ts`).
- ✅ **Cluster Overview** (`/metrics`), **Error & Failure** (`/errors`, with error-type filter +
  drill-down table of recent failed queries), **Node Health** (`/nodes`), **Resource Group Performance**
  (`/performance`).
- ✅ Error analytics: counts by type/user/resource-group + time series. Performance: avg runtime / queue
  wait / execution vs planning + per-RG runtime. Cluster: running/queued/blocked + workers.
- ✅ Time range 15m/1h/24h/7d (`?range=`); "Şimdi topla" trigger on each dashboard.

**Phase 6 verified:** typecheck, lint, 110 unit, build. (Live charts populate once the collector reaches
a Trino; explicit per-user/group filters beyond error-type are a follow-up.)

## Phase 7 — Alerting & anomaly ✅ (complete) — [6.6]
- ✅ **Static thresholds** — error rate %, specific-error rate %, avg runtime; comparator + threshold
  over a window ([`alerts/evaluate.ts`](../src/lib/alerts/evaluate.ts), tested).
- ✅ **Dynamic anomaly** — z-score vs the preceding windows (abnormal error spike / sudden perf drop).
- ✅ **Rule engine** ([`alerts/service.ts`](../src/lib/alerts/service.ts)) — evaluated after every
  collection; AlertEvents written only on FIRING↔RESOLVED transitions.
- ✅ **Alerts UI** (`/alerts`) — rule CRUD + enable toggle + live status + alert history.

**Phase 7 verified:** typecheck, lint, 116 unit, build, 7 e2e.

---

## Status: all phases (0–7) complete + gap-closure done
The full NİZAM scope ([`Projeİsterleri.txt`](../Projeİsterleri.txt)) is implemented on `nizam-rewrite`:
config editors (rules / resource-groups / group-provider / password.db / catalogs), RBAC + audit,
deployment + drift + Ansible, and the observability stack (collector → time series → dashboards →
alerting). **Current verified status: 151 unit + build + typecheck + lint green; e2e 7/7** (e2e now
runs against a production build; the earlier dev-overlay flake is fixed — see
[`ister-takip.md`](ister-takip.md) for the single-source live status). The deferred follow-ups
(PBKDF2, per-worker/task metrics, custom range + user/group filters, fine-grained authz, per-node
consistency, rollback re-deploy, RG performance dashboard, coordinator-vs-worker load) are now
implemented — see the gap-closure section below. (OPA/Ranger & TLS/secrets remain out of the
`Projeİsterleri.txt` scope.)

## Gap-closure pass (2026-06-30) — deferred follow-ups now implemented

A compliance audit ([`../UYGUNLUK-RAPORU-2026-06-30.md`](../UYGUNLUK-RAPORU-2026-06-30.md)) flagged
several partial/missing items; all are now done and verified (typecheck, lint, **140 unit**, build,
runtime smoke + functional rollback test):

- ✅ **[3.2] Fine-grained authorization** — `scopeConfigTypes` / `scopeResourceGroups` are enforced
  (`getAccess`, `ensureConfigWrite`, `ensureResourceGroupWrite` in [`authz.ts`](../src/lib/authz.ts));
  Settings UI assigns per-file + per-resource-group scope. Resource-group scope is diffed at save
  ([`changedGroupPaths`](../src/lib/resource-groups/tree.ts)).
- ✅ **[3.3] Audit before/after** — `ConfigArtifact` saves/rollbacks record the real previous/next
  **content**, not just the version number ([`config-artifact.ts`](../src/lib/config-artifact.ts),
  [`rules/service.ts`](../src/lib/rules/service.ts)).
- ✅ **[4.1] Versioning for password.db + catalogs** — snapshotted on every change with rollback that
  re-materializes rows ([`passwords/service.ts`](../src/lib/passwords/service.ts),
  [`catalogs/service.ts`](../src/lib/catalogs/service.ts), generic
  [`versioning.ts`](../src/lib/versioning.ts)); History page lists all artifact types.
- ✅ **[4.3] Rollback auto re-deploy** — rollback writes the restored file (FILE) / relies on the
  endpoint (HTTP) via [`deploy/publish.ts`](../src/lib/deploy/publish.ts).
- ✅ **[2.1] PBKDF2** — real Trino-format `iterations:salt:hash` digests
  ([`passwords/hash.ts`](../src/lib/passwords/hash.ts)); selectable in the UI.
- ✅ **[2.3 / 5.3] Per-node verification** — `verifyConsistency` checks each node's reachability +
  version (`/v1/info`), hashes every managed file (SHA-256), and emits a checksum **verify playbook**
  ([`deploy/consistency.ts`](../src/lib/deploy/consistency.ts), Deploy page "Cluster tutarlılık").
- ✅ **[6.1] /v1/query/{queryId} + /v1/task** — query **drill-down page** `/queries/[queryId]` with
  related nodes; per-node CPU/heap/**non-heap** + task/failed counts collected per worker
  ([`collector.ts`](../src/lib/metrics/collector.ts), [`ingest.ts`](../src/lib/metrics/ingest.ts)).
- ✅ **[6.5.2 / 6.5.3] Custom range + filters** — from/to custom range in
  [`range.ts`](../src/lib/metrics/range.ts) + time-range control; user/group/type filters on `/errors`.
- ✅ Node Health page now shows non-heap + a per-node comparative table (CPU/heap/non-heap/tasks/failed).

## Cross-cutting (every phase)
- Single dark theme; no hardcoded UI strings (next-intl `tr`).
- Keep `docs/` current; log commits in [08-git-history.md](08-git-history.md).
- Zero lint/SonarQube findings; tests for new logic; verify dependency versions before adding.
