# 11 — Deployment Guide: Config Sync & Ansible

How TrinoSecure delivers managed config files to Trino — across single-node dev instances,
Docker Compose clusters, and production multi-host clusters — and how the Ansible runner
automates distribution in each scenario.

---

## 1. The problem: Trino reads files, the app manages them

Trino enforces security from **files on disk** (`rules.json`, `password.db`, `group-provider.txt`,
`resource-groups.json`, catalog `*.properties`). TrinoSecure manages those files visually, but after
any edit the new content must reach the path(s) Trino reads.

This is the **sync problem**, and the solution differs by topology:

| Topology | Sync strategy |
|----------|---------------|
| Single-node, local mount | FILE mode — direct write to the bound path |
| Single-node, HTTP-ready | HTTP mode — Trino polls the app endpoint |
| Multi-node cluster | Ansible runner — SSH copy to every coordinator |

---

## 2. Config delivery modes

Each `TrinoEnvironment` in the app carries a `deliveryMode`. It is set once at environment
creation and determines how every publish, rollback, and auto-redeploy reaches Trino.

### Mode A — HTTP (preferred for any network-reachable Trino)

```
TrinoSecure (writes to DB) ──────────────────────────────────────────────────────────────────────
                                                                                                  │
Trino ────────────────► GET /api/trino/<envId>?token=<httpToken>  ←── every refresh-period ──────┘
```

Trino's `access-control.properties`:
```properties
access-control.name=file
security.config-file=http://trinosecure-host:3110/api/trino/<envId>?token=<token>
security.refresh-period=30s
```

**Result:** No Ansible needed. Every publish updates the DB; Trino picks it up within
`refresh-period`. Applies only to `rules.json` — other files (password.db, catalogs) always
require file distribution.

**Limitations:**
- Trino must reach the TrinoSecure app over the network.
- Only `rules.json` can be HTTP-served (Trino supports HTTP for the access-control file only).
- All other managed artifacts (`password.db`, `group-provider.txt`, `resource-groups.json`,
  catalog `*.properties`) must still be distributed via file.

### Mode B — File (required when HTTP is not possible, or for non-rules artifacts)

```
TrinoSecure ──► writes content ──► path on disk ──► Trino reads it
```

The target path is `TrinoEnvironment.configTarget` (e.g. `/etc/trino/rules.json`).
Sibling files land in the same directory by convention (`/etc/trino/`).

**How the write happens** depends on the topology (see sections 3–5 below).

---

## 3. Topology A: Single-node Trino on the same host

This is the local dev setup (`trinosecure/trino/`): coordinator-only, no workers, no TLS,
`node-scheduler.include-coordinator=true`.

```
trinosecure/ (Next.js)        trino/etc/ (bind-mounted into trinodb/trino container)
      │                               │
      │  writeFile(configTarget)  ────►  /etc/trino/rules.json  ← Trino reads
      │                               │
```

**Config:**

| Setting | Value |
|---------|-------|
| `coordinator` | `true` |
| `node-scheduler.include-coordinator` | `true` |
| `http-server.http.port` | `8080` |
| `security.refresh-period` | `5s` (fast iteration in dev) |
| Auth | none (dev — no `PASSWORD` auth) |
| TLS | none |

**Environment setup in the app:**

| Field | Example |
|-------|---------|
| Name | `local-trino` |
| Delivery mode | `FILE` |
| Config target | `/home/berkay/Desktop/Projeler/TrinoSecure/trinosecure/trino/etc/rules.json` |
| Refresh period | `5s` |
| Trino base URL | `http://localhost:8085` |

**No Ansible needed.** The app's `redeployArtifact()` (`src/lib/deploy/publish.ts`) calls
`writeFile()` directly. The local bind-mount makes the file immediately visible to Trino.

> For HTTP mode with local Trino: point `security.config-file` at
> `http://localhost:3110/api/trino/<envId>?token=<token>`. The app must be reachable from
> the Trino container (use `host.docker.internal` if Trino runs in Docker).

---

## 4. Topology B: Cluster Trino — Docker Compose (dev/test)

The `cluster-trino/` setup: 1 coordinator + 2 workers, HTTPS/TLS, `PASSWORD` auth.

### File distribution across nodes

```
cluster-trino/shared/         ← host directory, bind-mounted :ro into all containers
├── rules.json                ← coordinator only (access-control)
├── resource-groups.json      ← coordinator only (resource-groups.properties)
├── password.db               ← coordinator only (password-authenticator.properties)
├── group-provider.txt        ← coordinator only (group-provider.properties)
├── access-control.properties ← coordinator only
├── password-authenticator.properties ← coordinator only
├── group-provider.properties ← coordinator only
├── resource-groups.properties ← coordinator only
├── tls/keystore.jks          ← coordinator only
└── catalog/                  ← ALL nodes (coordinator + workers)
    ├── memory.properties
    └── tpch.properties
```

**Workers only receive:** `config.properties`, `node.properties`, `jvm.config`,
`log.properties`, `catalog/*.properties`. Security files (rules, passwords, groups,
resource-groups) live only on the coordinator — workers never enforce authorization directly;
they receive query fragments from the coordinator which has already applied access control.

### File sync in Docker Compose

Because `shared/` is a bind-mount from the **host**, updating a file there immediately makes
it visible inside all containers. There is no SSH or Ansible involved.

The app's `configTarget` points to the host path:

| Field | Example |
|-------|---------|
| Name | `cluster-trino` |
| Delivery mode | `FILE` |
| Config target | `/home/berkay/Desktop/Projeler/TrinoSecure/cluster-trino/shared/rules.json` |
| Refresh period | `30s` |
| Trino base URL | `https://localhost:8090` |

`redeployArtifact()` writes directly to that host path. Because Trino containers bind-mount
it `:ro`, a new file content is visible after at most `refresh-period` (30s) — **no restart,
no Ansible**.

> The `check-sync.py` script in `cluster-trino/` is a standalone diagnostic: it reads the
> host file and queries `/v1/info` to verify the cluster is healthy. It does not modify files.

### HTTP mode with the cluster

Set `security.config-file` in `access-control.properties` to the app's HTTP endpoint:

```properties
access-control.name=file
security.config-file=http://host.docker.internal:3110/api/trino/<envId>?token=<token>
security.refresh-period=30s
```

The Trino containers reach the host via `host.docker.internal`. The coordinator polls every
30s and picks up every publish automatically. Workers are unaffected (they never read
`rules.json`).

---

## 5. Topology C: Production multi-host cluster (Ansible required)

In production, coordinator and workers run on separate VMs or bare-metal nodes. There is no
shared filesystem — files must be copied over SSH.

### Which nodes receive which files

| File | Coordinator | Workers |
|------|:-----------:|:-------:|
| `rules.json` | ✓ | — |
| `resource-groups.json` | ✓ | — |
| `password.db` | ✓ | — |
| `group-provider.txt` | ✓ | — |
| `access-control.properties` | ✓ | — |
| `password-authenticator.properties` | ✓ | — |
| `resource-groups.properties` | ✓ | — |
| `group-provider.properties` | ✓ | — |
| `catalog/*.properties` | ✓ | ✓ |

The Ansible playbook targets the `[trino]` inventory group (all discovered nodes). The
destination path for coordinator-only files is `/etc/trino/<file>` on all hosts — **this is
safe**: workers ignore files they don't reference in their `config.properties`. Trino only
reads files explicitly pointed to by a `*.properties` directive; an unreferenced file on disk
has no effect.

If you want strict separation (copy security files to coordinator only), create a sub-group
`[trino_coordinator]` in the inventory and scope the copy tasks to it. The current playbook
generator does not do this by default; it targets all discovered nodes for simplicity.

### Node discovery

The app discovers nodes via the Trino REST API (`/v1/node`). On the Deploy page:

1. Set `trinoBaseUrl` on the environment to the coordinator's HTTP endpoint.
2. Click **"Düğümleri keşfet"** — the action calls `/v1/node`, upserts coordinator + workers
   into `TrinoNode`, and saves their host URLs.
3. The Ansible inventory is built from `TrinoNode` records; host URLs are stripped to bare
   hostnames: `https://coord.prod.internal:8090` → `coord.prod.internal`.

### SSH credential setup

On the Deploy page, expand **SSH Yapılandırması** and save:

| Field | Notes |
|-------|-------|
| SSH user | Must have `sudo` rights on all Trino hosts (for `become: true`) |
| SSH password | Optional; used by `sshpass` inside the runner container |
| PEM private key | Optional; preferred; written to a 0600 temp file per run |

Credentials are AES-256-GCM encrypted before storage (`ENCRYPTION_KEY` env var).
They are decrypted only at playbook execution time inside the ansible-runner container and
never logged or persisted in plaintext.

### ansible-runner sidecar

The runner is a separate Docker Compose service (`ansible-runner/`) that:

1. Receives `POST /run` with: inventory (structural), playbook YAML, file contents, SSH creds.
2. Appends `[trino:vars]` with SSH parameters to the inventory.
3. Writes all files to a temp directory.
4. Runs `ansible-playbook` as a subprocess.
5. Returns combined stdout/stderr + return code.
6. Cleans up the temp directory.

The Next.js server action (`runAnsibleDeploy`) calls it, stores the result in `DeploymentRun`,
and shows the output log in the UI.

```
Deploy page (browser)
  → runAnsibleDeploy() server action
      → getSshCredentials() — decrypt from DB
      → buildFileMap() — render all managed files
      → generateInventory() + generatePlaybook()
      → executePlaybook() — POST to ansible-runner:8000/run
          → ansible-playbook -i inventory.ini playbook.yml
              → SSH → coordinator + workers
      → DeploymentRun saved (status, stdout, duration)
  → log modal shown in UI
```

### Generated playbook structure

```yaml
---
- name: Deploy Trino security configuration (NİZAM)
  hosts: trino           # all discovered nodes
  become: true
  serial: 1              # rolling: one node at a time
  tasks:
    - name: Copy rules.json
      ansible.builtin.copy:
        src: files/rules.json
        dest: /etc/trino/rules.json
        mode: "0640"
      notify: restart trino   # or "reload note" when restart=false

  handlers:
    - name: restart trino
      ansible.builtin.service:
        name: trino
        state: restarted
```

`serial: 1` ensures a rolling restart: the coordinator restarts, becomes healthy, then each
worker follows in sequence. The cluster remains available throughout.

When `restart=false` (the default), Trino relies on `security.refresh-period` to hot-reload
config without any restart. No downtime, but the change is not immediate — it takes up to
`refresh-period` (typically 30s) to propagate.

### Verify playbook

After distribution, run **"Doğrulamayı Çalıştır"** (or download the verify playbook):

```yaml
- name: Verify Trino security configuration consistency (NİZAM)
  hosts: trino
  become: true
  tasks:
    - name: Hash /etc/trino/rules.json
      ansible.builtin.stat:
        path: /etc/trino/rules.json
        checksum_algorithm: sha256
      register: stat_etc_trino_rules_json
    - name: Assert /etc/trino/rules.json matches the published version
      ansible.builtin.assert:
        that: stat_etc_trino_rules_json.stat.exists and stat_etc_trino_rules_json.stat.checksum == "<sha256>"
        fail_msg: "/etc/trino/rules.json bu node'da farklı/eksik — yeniden dağıtım gerekir."
```

The playbook fails if any node's SHA-256 differs from the app's current version. This surfaces
drift caused by manual edits, failed copies, or partial deployments.

---

## 6. Environment setup checklist by scenario

### Scenario 1 — Local single-node dev

```
[ ] Create environment: deliveryMode=FILE, configTarget=<absolute path to rules.json>
[ ] Bind-mount that path into the Trino container (or use the same local path)
[ ] Set trinoBaseUrl to http://localhost:<port>
[ ] Click "Düğümleri keşfet" (optional — only needed for the consistency check)
[ ] Publish any edit → file is written immediately → Trino hot-reloads within refresh-period
```

No Ansible, no SSH, no runner service needed.

### Scenario 2 — Docker Compose cluster (dev/test)

```
[ ] Create environment: deliveryMode=FILE, configTarget=<host path to shared/rules.json>
[ ] Ensure bind-mount in docker-compose.yml: - ./shared/rules.json:/etc/trino/rules.json:ro
[ ] Set trinoBaseUrl to https://localhost:8090
[ ] Click "Düğümleri keşfet" — coordinator + workers appear in the inventory
[ ] Publish any edit → file written to host path → all containers see it via mount
[ ] Use "Drift kontrolü" to confirm the file matches the active version
```

For HTTP mode: change `access-control.properties` to point at the app endpoint instead of
a local file. Publish still writes the DB; Trino polls the app.

No Ansible needed (bind-mount handles sync). Ansible artifacts (downloadable) remain useful
for documenting what *should* be on disk.

### Scenario 3 — Production multi-host cluster

```
[ ] Ensure each Trino node has an SSH-accessible user with sudo rights
[ ] Start the ansible-runner sidecar: docker compose up -d ansible-runner
[ ] Create environment: deliveryMode=FILE, configTarget=/etc/trino/rules.json
[ ] Set trinoBaseUrl to the coordinator's HTTP endpoint
[ ] Click "Düğümleri keşfet" — builds the TrinoNode inventory from /v1/node
[ ] Open Deploy page → SSH Yapılandırması → save SSH user + key (or password)
[ ] Verify ansible-runner shows "Erişilebilir"
[ ] Click "Dağıtımı Çalıştır" → log modal shows ansible-playbook output
[ ] After distribution: click "Doğrulamayı Çalıştır" → SHA-256 check on every node
```

### Scenario 4 — HA coordinator (multiple coordinators)

Trino does not natively support active-active coordinator HA; in practice each cluster has
one coordinator. If you run multiple coordinator replicas behind a load balancer:

```
[ ] Add all coordinator hostnames to the TrinoNode inventory (manual upsert or custom discover)
[ ] Set trinoBaseUrl to the load balancer address (for /v1/node queries)
[ ] Run "Dağıtımı Çalıştır" — serial:1 ensures nodes are updated one-by-one
[ ] Run "Doğrulamayı Çalıştır" after — asserts all coordinators have identical files
```

For true consistency, prefer a shared filesystem (NFS, Ceph, Kubernetes ConfigMap) over
Ansible-based distribution; Ansible is eventually consistent, not atomic.

---

## 7. Ansible prerequisites on production nodes

Each Trino host must satisfy:

```
# 1. Python 3 (Ansible requires it on managed nodes)
python3 --version

# 2. Sudo rights for the SSH user
# In /etc/sudoers (or sudoers.d/):
ansible ALL=(ALL) NOPASSWD: /usr/bin/cp, /usr/bin/systemctl restart trino

# 3. SSH server running and reachable from the ansible-runner container
# 4. /etc/trino/ writable by root (become: true handles this)
# 5. Trino installed as a systemd service named "trino"
#    (if using restart=true — otherwise not needed)
```

The ansible-runner container has `ansible-core`, `openssh-client`, and `sshpass` installed.
No additional packages are needed on the runner side.

---

## 8. Environment variable reference

| Variable | Where set | Purpose |
|----------|-----------|---------|
| `ANSIBLE_RUNNER_URL` | `trinosecure/.env` | HTTP base URL for the runner sidecar (default: `http://ansible-runner:8000`) |
| `ENCRYPTION_KEY` | `trinosecure/.env` | 64-hex-char key for AES-256-GCM encryption of SSH credentials at rest |
| `NODE_TLS_REJECT_UNAUTHORIZED=0` | `trinosecure/.env` | Disable TLS verification when connecting to Trino with self-signed certs (dev only) |
| `TRINO_SERVICE_USER` / `TRINO_SERVICE_PASSWORD` | `trinosecure/.env` | Credentials the app uses for Trino REST API calls (`/v1/node`, `/v1/info`, etc.) |

Generate a fresh `ENCRYPTION_KEY` with:
```bash
openssl rand -hex 32
```

---

## 9. Drift detection and the consistency loop

The Deploy page provides three independent checks:

| Check | What it compares | Trigger |
|-------|-----------------|---------|
| **Drift kontrolü** | DB active version vs file on disk (FILE mode) or reports auto-sync (HTTP) | Manual, on demand |
| **Cluster tutarlılık** | Each node's HTTP reachability + Trino version; SHA-256 of every managed file vs DB | Manual, on demand |
| **Doğrulamayı Çalıştır** | SHA-256 on every node via ansible `stat` module | Automatic (via runner) |

Recommended post-deploy loop:
```
Publish edit
  → Dağıtımı Çalıştır (Ansible distributes files)
  → Doğrulamayı Çalıştır (SHA-256 confirms every node matches)
  → Drift kontrolü (file on disk matches DB)
```

All results are stored in `DeploymentRun` and visible in the deployment history table.

---

## 10. Decision tree: which mode to use?

```
Is Trino network-reachable from the TrinoSecure app?
├─ YES → Use HTTP mode for rules.json (no Ansible for auth rules)
│         Use Ansible/FILE for password.db, group-provider, catalogs
│
└─ NO  → Use FILE mode for everything
          │
          Is Trino on the same host or shared mount?
          ├─ YES → Direct writeFile() — no Ansible
          └─ NO  → Ansible runner required
```
