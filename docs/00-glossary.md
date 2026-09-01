# Glossary

Plain-language definitions of every term used in this project. Aimed at a reader who is new
to Trino and to web development.

## Trino & data

- **Trino** — An open-source *distributed SQL query engine*. It does **not** store data; it
  queries data that lives elsewhere, across many sources at once, using SQL.
- **Connector** — A plugin that lets Trino talk to a specific data source (PostgreSQL, MySQL,
  object storage, …).
- **Catalog** — A configured connection to a data source (e.g. `postgres_prod`). The widest
  unit of data organization in Trino.
- **Schema** — A namespace inside a catalog (e.g. `sales`). Contains tables.
- **Table** — A set of rows/columns inside a schema (e.g. `customers`).
- **Column** — A single field of a table (e.g. `credit_card_no`).
- **Cluster** — A group of machines running Trino together to process queries in parallel.

## Identity & access

- **Authentication** — Verifying *who* a user is (login, password, token). "Are you really you?"
- **Authorization** — Deciding *what* an authenticated user may access. "What can you do?"
  This is the core concern of this project.
- **Principal** — The verified identity produced by authentication, before it is mapped to a
  Trino username.
- **User mapping** — Rules that translate an external principal into a Trino username.
- **Group mapping / Group provider** — Resolves which **groups** a user belongs to. Rules are
  usually written per-group, not per-user.
- **Group** — A named set of users (e.g. `analysts`). Permissions are granted to groups.
- **Role** — A named set of permissions a user can be assigned. Similar purpose to a group.
- **Impersonation** — One user running queries *as* another user.
- **Least privilege** — Security principle: grant only the access actually needed, nothing more.

## Authorization mechanics

- **Access control / System access control** — Trino's mechanism for enforcing authorization.
  Can be file-based, OPA, or Apache Ranger.
- **File-based access control** — Authorization defined in a JSON file (`rules.json`).
- **`rules.json`** — The JSON file holding authorization rules (who → what → which action).
  Evaluated top-to-bottom; first match wins; no match = deny.
- **Refresh period** — Setting that makes Trino re-read its config file periodically, without a
  restart.
- **Row filter** — A rule that limits *which rows* a user sees.
- **Column mask** — A rule that hides/obscures a column's value (e.g. shows `XXX-XX-1234`).

## Authentication providers & protocols

- **Keycloak** — An open-source Identity Provider (IdP). In this project it handles
  authentication only (usernames + tokens).
- **SSO (Single Sign-On)** — Log in once, access many systems without re-entering credentials.
- **OIDC / OAuth 2.0** — Standard protocols for delegated authentication; Keycloak speaks these
  and Trino can consume them.
- **JWT (JSON Web Token)** — A signed token carrying identity (and sometimes group) claims.
- **LDAP** — A directory service (e.g. Active Directory) where organizations store users/groups.
- **Kerberos** — An enterprise authentication protocol (ticket-based SSO).

## Transport & secrets

- **TLS / HTTPS** — Encryption for network communication.
- **PEM / JKS** — File formats for certificates and keys (PEM = text; JKS = Java KeyStore).
- **Secrets** — Sensitive values (passwords, keys) kept out of plain config, e.g. via
  environment-variable references.
- **OPA (Open Policy Agent)** — An external policy engine; an alternative access-control backend.
- **Apache Ranger** — An external permission-management system; another access-control backend.

## This app's architecture

- **Control plane** — The management UI (this project): where you *define* security config.
- **Data plane** — Trino itself: where security config is *enforced* against real queries.
- **Source of truth** — The authoritative copy of data. Here, priority is the UI operations and
  the config **files**; the database is a backup/persist + audit layer.
- **Drift** — When two copies of the truth (DB vs files) disagree. A core problem the UI prevents.

## Web stack

- **Next.js** — A full-stack React framework (frontend + server in one TypeScript codebase).
- **React** — A library for building user interfaces from components.
- **TypeScript** — JavaScript with static types (catches errors early).
- **Tailwind CSS / shadcn/ui** — Styling utilities and a ready-made component library.
- **PostgreSQL** — A relational database.
- **Prisma** — An ORM: lets you work with the database through typed code instead of raw SQL.
- **ORM (Object-Relational Mapping)** — A layer that maps database tables to code objects.
- **Auth.js (NextAuth)** — Authentication library for Next.js; integrates with Keycloak.
- **Zod** — A schema-validation library (used to validate `rules.json` and form input).
- **Playwright / Vitest** — End-to-end and unit testing tools.
- **Docker / Docker Compose** — Packaging and running the app (plus Trino, DB) in containers.
