# 02 — Architecture

## High-level model

This app is a **control plane**: a place to *define* Trino security configuration. Trino itself
is the **data plane**: it *enforces* that configuration against real queries.

```
Users (from anywhere)
      │
      ▼
┌──────────────┐
│   Keycloak   │   Authentication ONLY (username + token / OIDC)
└──────┬───────┘
       │ "this is user X"
       ▼
┌─────────────────────────────────────────────────────────────┐
│                  TRINO-SECURE UI (this app)                   │
│                                                               │
│  PRIORITY 1: UI operations + config FILE data                │
│    forms · validation · import/export · diff                 │
│                                                               │
│  PRIORITY 2: App DATABASE (backup / persist + audit)         │
│    groups & concepts · config versions · audit log           │
│                                                               │
│        DB  ── confirmed import updates ──▶  matches files     │
└───────────────────────────┬─────────────────────────────────┘
                            │  writes / serves the files Trino reads
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                            TRINO                              │
│   rules.json · *.properties · certificates · secrets         │
│   reads them and enforces authorization                      │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
              connectors → the real data (catalogs)
```

## Key principles

1. **Files and UI operations are the priority; the DB is a backup/persist + audit layer.**
   The artifacts Trino actually reads are authoritative. The DB exists to persist app-managed
   concepts (groups, etc.), keep history, and record audit. On a confirmed import, the DB is
   updated to match the files.
2. **Keycloak does authentication only.** Group membership and all authorization data live in
   this app, not in Keycloak.
3. **Everything is two-way.** Every managed concept can be created/edited in the UI *and*
   imported/exported as its native file format.

## Config delivery to Trino — two supported modes

Trino's `security.config-file` accepts **either a local file path or an HTTP endpoint**, and
`security.refresh-period` makes Trino re-read it periodically without a restart.

- **Mode A — HTTP-served (preferred):** the app exposes the config (e.g. `rules.json`) at an
  endpoint; Trino fetches it on its refresh interval. This minimizes filesystem coupling and
  largely dissolves the sync problem.
- **Mode B — File-write (fallback):** the app writes the artifact to the path Trino reads
  (shared volume / same host / transfer). Used when HTTP delivery is not possible.

The chosen mode is per **Trino environment** (see [05-database-schema.md](05-database-schema.md)).

### Ansible Runner sidecar (`ansible-runner/`)

Mode B needs to reach hosts the Next.js process cannot touch directly, so file delivery and
config import are delegated to a small FastAPI sidecar that ships in this repo and runs as its
own Docker Compose service. It holds no state and no credentials: SSH user, password or PEM key
arrive per request, are written to a temp workspace (key at `0600`), and the workspace is removed
in a `finally` block once the run ends.

| Endpoint | Purpose |
| --- | --- |
| `POST /run` | Run a playbook, block until `ansible-playbook` exits, return stdout/stderr/return code. |
| `POST /run/stream` | Same, streaming Ansible output line by line as SSE. |
| `POST /probe` | `ansible.builtin.ping` against one host — SSH reachability check (30 s timeout). |
| `POST /import` | Fetch `rules.json`, `resource-groups.json`, `group-provider.txt`, `password.db` and `catalog/*.properties` from a coordinator over SFTP. |
| `GET /health` | Liveness probe used by the Compose healthcheck. |

The app addresses it via `ANSIBLE_RUNNER_URL` (defaults to `http://ansible-runner:8000` under
Compose). Operational details are in [11-deployment-guide.md](11-deployment-guide.md).

## The central challenge: consistency across UI ↔ files ↔ DB

This is the engineering core of the project. The UI must handle:

- **Validation** — valid JSON and regex; referenced groups/catalogs exist; rule order sane.
  Block save on invalid config (`rules.json` first-match-wins makes ordering dangerous).
- **Import & diff** — when importing existing files, show a diff vs the DB and let the user
  review/merge before the DB is updated.
- **Versioning & rollback** — every saved change produces a new version; the user can view
  history and roll back.
- **Audit log** — record who changed what, when (the user's logging requirement).
- **Drift detection** — warn when the file Trino reads diverges from the app's expected state.

## Artifact types the UI manages

The security surface is **not all JSON**. The UI handles four artifact shapes:

| Shape | Examples |
|-------|----------|
| JSON rule files | `rules.json` (system + per-catalog) |
| `.properties` config | `access-control.properties`, `password-authenticator.properties`, `resource-groups.properties`, `group-provider.properties` — managed at `/properties` (Cluster Konfigürasyonu) |
| Certificate / key files | PEM, JKS for TLS/HTTPS |
| Secret references | environment-variable references for sensitive values |

All four `.properties` files are visually edited at `/properties` (sidebar → Konfigürasyon →
Cluster Konfigürasyonu). Each has a typed form editor (with a "Ham" raw-text toggle) and is
stored as a versioned `ConfigArtifact`. Saved versions are automatically included in the deploy
pipeline: `buildFileMap` picks them up, `destinationFor` maps them to `/etc/trino/`, and the
Ansible generator + SHA-256 consistency checker cover them alongside `rules.json` and the
other managed files.

See [03-trino-security-model.md](03-trino-security-model.md) for the full mapping.

## Multi-environment (independent installations)

Each Trino installation is a `TrinoEnvironment`; **all** scoped data (groups, config artifacts,
audit) carries its `environmentId`, and deleting an environment cascades only its own data — so
installations are fully independent. The **active environment** is chosen in the topbar and
persisted in the `ts-active-env` cookie (`src/lib/environment-context.ts`:
`getActiveEnvironment`); every page/action that operates on one installation must scope its
queries by the active environment's id. (Switching is a server action that re-validates the
layout; theme stays client-side in `ui-provider`, environment is server state.)

## Open architectural questions (decide before/while building the relevant phase)

- ✅ Auth.js v5 chosen (Keycloak provider).
- ✅ Mode A HTTP-serving contract: `GET /api/trino/[envId]?token=…` returns the active rules.json
  (per-environment bearer token, `cache-control: no-store`, proxy-exempt).
- How certificates/secrets are stored at rest in the app (encryption-at-rest strategy) — for the
  deferred TLS/secrets phase.
