# 04 — `rules.json` Reference (File-Based Access Control)

The authoritative reference for the file-based access control rules — the heart of the UI.
Source: `https://trino.io/docs/current/security/file-system-access-control.html`.

## How it is loaded

Configured in `etc/access-control.properties`:

```
access-control.name=file
security.config-file=<local path OR http(s):// endpoint>
security.json-pointer=/data        # optional, when rules are nested in a larger JSON
security.refresh-period=1s         # optional, reload without restarting Trino
```

- `security.config-file` may be a **local file or an HTTP endpoint** (enables "Mode A" in
  [02-architecture.md](02-architecture.md)).
- With `refresh-period`, Trino periodically re-reads the file.

## Evaluation semantics (critical for the UI)

- Rules are evaluated **top-to-bottom; the first match wins.**
- **No matching rule = access denied** (secure default).
- `user` / `role` / `group` fields are **regular expressions**, default `.*` (match all).
- An **empty rule array** (e.g. `"schemas": []`) **denies all** access at that level.
- `information_schema` tables are exempt from catalog/schema/table/column rules.
- **Group rules require a configured Group Provider.**

> UI implication: ordering is dangerous and must be explicit (drag-to-reorder), and the editor
> must validate JSON + regex and warn about deny-all empty arrays and unreachable rules.

## The 13 rule types

| # | Rule type | Controls | Key fields / allowed values |
|---|-----------|----------|-----------------------------|
| 1 | **Catalog rules** | access level to a catalog | `user`,`role`,`group`,`catalog`; `allow`: `all` / `read-only` / `none` |
| 2 | **Schema rules** | schema ownership | `…`,`schema`; `owner` (bool) |
| 3 | **Table rules** | table privileges | `…`,`table`; `privileges`: SELECT/INSERT/DELETE/UPDATE/OWNERSHIP/GRANT_SELECT; plus `columns`, `filter` |
| 4 | **Column constraints** | column access + masking | `name`, `allow` (bool), `mask` (expression), `mask_environment` |
| 5 | **Row filters** | which rows are visible | `filter` (boolean expr, e.g. `user = current_user`), `filter_environment` |
| 6 | **Function rules** | execute/create/drop functions | `…`,`function`; `privileges`: EXECUTE/GRANT_EXECUTE/OWNERSHIP |
| 7 | **Procedure rules** | `CALL` procedure execution | `…`,`procedure`; `privileges`: EXECUTE/GRANT_EXECUTE |
| 8 | **Session property rules** | set session properties | `property`, `allow` (bool); sections `system_session_properties` + `catalog_session_properties` |
| 9 | **Query rules** | execute/view/kill queries | `user`,`role`,`group`,`queryOwner`; `allow`: execute/view/kill |
| 10 | **Impersonation rules** | run as another user | `original_user`,`original_role`,`new_user` (regex + capture groups), `allow` |
| 11 | **Authorization rules** | `ALTER … SET AUTHORIZATION` | `original_*`, `new_user`/`new_role`, `allow` |
| 12 | **Principal rules** *(deprecated)* | principal → username | use **User mapping** instead |
| 13 | **System information rules** | REST endpoints, shutdown | `user`,`role`; `allow`: read/write (note: `/v1/info`,`/v1/info/state`,`/v1/status` always public) |

> **UI coverage (implemented):** all of these are now editable through structured forms. The
> editor exposes **11 top-level sections**, in the canonical hierarchy order (report §4.5
> "rules.json Genel Yapısı") — `catalogs`, `schemas`, `tables`, `functions`, `procedures`,
> `queries`, `impersonation`, `system_information`, `system_session_properties`,
> `catalog_session_properties`, `authorization`. Column constraints (4) and row
> filters (5) are edited as a **sub-editor inside table rules**; principal rules (12, deprecated)
> are intentionally omitted in favor of user mapping. Sections are declared once in
> `src/app/(app)/rules/rule-sections.ts` (fields + table columns) — that array is the single
> source of truth for section order, driving both the on-screen order and the serialized JSON
> key order (`toDocument` in `rule-types.ts`), so the UI and the raw file stay identical. Adding
> a field is a one-line change. Any unmodeled top-level key is preserved verbatim and remains
> raw-JSON editable.

### Notes on selected types

- **Column masking (4):** `mask` is an expression applied to the column, e.g.
  `"'XXX-XX-' + substring(ssn, -4)"`.
- **Row filter (5):** applied inside table rules; restricts returned rows per user.
- **Impersonation (10):** `new_user` supports capture-group substitution, e.g. original
  `"team_(.*)"` → `"team_$1_sandbox"`.
- **System builtin functions** are always accessible and cannot be overridden by function rules.

## System-level vs catalog-level

The same rule structure can be applied **per connector** (catalog-level access control), enabled
with properties like:

```
iceberg.security=FILE
security.config-file=etc/catalog/rules.json
```

Catalog-level supports schema, table, column, row-filter, function, and session-property rules.
The UI must manage both system-wide and per-catalog rule files.

## UI design implications (summary)

- Not a raw JSON textarea: a structured editor per rule type, with forms, regex helpers, and
  **explicit drag-to-reorder** (first-match-wins).
- Live validation (JSON, regex, referenced group/catalog existence, deny-all detection).
- Import existing `rules.json` → diff vs DB → confirm.
- Export / serve to Trino (Mode A HTTP or Mode B file write).
