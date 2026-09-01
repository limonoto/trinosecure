# 03 — Trino Security Model (Inventory)

The complete inventory of Trino security operations, from the Trino security documentation
(`https://trino.io/docs/current/security.html`). This is a **reference of the full surface**, not
the delivered scope.

> **Scope note (2026-07-01):** The delivered scope is [`Projeİsterleri.txt`](../Projeİsterleri.txt)
> (rules.json, resource-groups, group-provider, password.db, catalogs, API/observability). Items
> below that are **not** in `Projeİsterleri.txt` — TLS/HTTPS, OAuth 2.0, Kerberos, JWT, certificate
> auth, OPA, Ranger, internal-comm, secrets-at-rest — are **not implemented** (future/aspirational).
> Current implementation status: [`ister-takip.md`](ister-takip.md).

## Two questions, several stages

Trino security answers two questions, split across stages:

1. **Who are you?** → Authentication
2. **What can you access?** → Authorization

In this project: **Keycloak** answers (1) (username + token only); **this app + `rules.json`**
drives (2).

## Categories

### A. Cluster access security
| Operation | Artifact | UI must let you… |
|-----------|----------|------------------|
| TLS and HTTPS | certificate + `config.properties` | enable HTTPS, configure TLS |
| PEM files | certificate file | upload/inspect PEM certs |
| JKS files | Java KeyStore file | upload/inspect JKS keystores |

### B. Authentication
| Operation | Artifact | UI must let you… |
|-----------|----------|------------------|
| Authentication types (selection) | `config.properties` | choose active method(s) |
| Password file | `.properties` + password file | add/remove users (bcrypt) |
| LDAP | `.properties` | configure directory connection |
| Salesforce | `.properties` | configure IdP integration |
| OAuth 2.0 | `.properties` | configure OAuth/OIDC |
| Kerberos | `.properties` + keytab | configure Kerberos SSO |
| Certificate | `.properties` + certificate | configure mTLS auth |
| JWT | `.properties` | configure token validation |

> In this project Keycloak fronts authentication, but the UI must still be able to manage these
> native Trino mechanisms for completeness ("users can come from anywhere").

### C. User name management
| Operation | Artifact | UI must let you… |
|-----------|----------|------------------|
| User mapping | rule file / `.properties` | map external principal → Trino username |
| Group mapping (group provider) | `.properties` + group file | map group ↔ users (DB + export) |

### D. Access control (authorization)
| Operation | Artifact | UI must let you… |
|-----------|----------|------------------|
| System access control (selection) | `access-control.properties` | choose file / OPA / Ranger |
| **File-based access control** | **`rules.json`** | visually build all 13 rule types (the heart — see [04](04-rules-json-reference.md)) |
| Open Policy Agent (OPA) | `.properties` + OPA service | configure external policy engine |
| Apache Ranger | `.properties` + Ranger | configure Ranger-based control |

### E. Security inside the cluster
| Operation | Artifact | UI must let you… |
|-----------|----------|------------------|
| Secure internal communication | `config.properties` | set shared secret / inter-node TLS |
| Secrets | env-variable references | move sensitive values out of plain config |

## Suggested configuration order (Trino's recommended hardening path)

1. TLS/HTTPS on the cluster.
2. Shared secret for internal communication.
3. Authentication (client → Trino) — here, via Keycloak/OIDC.
4. User/group mapping.
5. Access control / authorization (`rules.json`).
6. Secrets for sensitive values.

The UI's roadmap (see [07-roadmap.md](07-roadmap.md)) front-loads authorization (`rules.json`)
because it is both the most-used and the most error-prone surface, then fills in the rest.
