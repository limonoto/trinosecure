# 01 — Project Overview

## What this is

**Trino-Secure UI** is a web application that lets an administrator manage **all** of Trino's
security configuration from a single visual interface — instead of hand-editing scattered,
error-prone config files (`rules.json`, `*.properties`, certificates, secrets).

## The problem

Trino can reach many data sources at once, which makes controlling **"who can access what"**
critical. Today that control is configured through several interdependent files:

- Authentication config (`*.properties`, LDAP/OAuth/etc.)
- Group provider files (group → user mapping)
- `rules.json` (authorization — large, nested, easy to break)
- Per-catalog connector config
- TLS certificates and secrets

These files must stay mutually consistent (a group named in `rules.json` must exist in the
group provider; a catalog referenced must be connected). A single typo can either expose
everything or lock everyone out. There is no single view of "what can user X actually access,"
and non-technical staff cannot manage any of it.

## What we are building

A control-plane UI that:

1. Manages **every** Trino security operation visually (see
   [03-trino-security-model.md](03-trino-security-model.md)).
2. Edits both **file-based** artifacts (JSON, `.properties`, certs) **and** keeps an in-app
   database copy.
3. Supports **import/export** of every concept (groups and beyond), in both directions.
4. **Validates** consistency before saving (valid JSON/regex, referenced groups/catalogs exist).
5. Keeps an **audit log** and version history (who changed what, when; rollback).

## Priority & data ownership (important)

- **Priority 1:** UI operations and the data in the **config files**.
- **Priority 2:** the application **database** — a backup / persistence + audit layer. When an
  import is reviewed and confirmed, the DB is updated to match.
- **Keycloak handles authentication only** (usernames + token authorization). Group and
  authorization data live in this app, not in Keycloak.

## Goals

- Replace manual file editing with safe, guided, visual workflows.
- Make "who can access what" answerable at a glance.
- Prevent inconsistency/drift between the UI, the files, and the DB.
- Be approachable for non-experts while covering the full Trino security surface.

## Scope

> **Scope note (2026-07-01):** This section describes the *long-term* vision (the full Trino
> security surface). The **actual delivered scope is [`Projeİsterleri.txt`](../Projeİsterleri.txt)**
> — see [`ister-takip.md`](ister-takip.md) for what is implemented. TLS/HTTPS, OAuth 2.0, Kerberos,
> JWT, Salesforce, OPA and Ranger below are **not in `Projeİsterleri.txt` and are not implemented**;
> treat them as future/aspirational.

**In scope (vision):** all security topics on the Trino security docs page — cluster access security
(TLS/HTTPS, PEM/JKS), authentication (password file, LDAP, OAuth 2.0, Kerberos, certificate,
JWT, Salesforce), user/group mapping, access control (file-based, OPA, Ranger), internal
communication, secrets. See [03-trino-security-model.md](03-trino-security-model.md).

**Out of scope (for now):** managing Trino query workloads, data catalog browsing beyond what
authorization needs, and being a general Keycloak admin console.

## Primary users

- **Platform/security admins** who define and audit access policies.
- (Secondarily) less-technical operators who manage group membership and simple permissions.

## Reference

This project mirrors the documentation discipline and (loosely) the tech stack of the
sibling project **yazam** (`~/Desktop/yazam`), whose `reports/` directory plays the same role
as our `docs/`.
