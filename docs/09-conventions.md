# 09 — Conventions

Binding conventions for this project. [CLAUDE.md](../CLAUDE.md) is the short, always-loaded
summary; this file is the detailed reference.

## Language
- **Code and docs in English** (identifiers, comments, commit messages, documentation).
- **Application UI in Turkish** — all user-facing strings are Turkish, except well-established
  technical terms (catalog, schema, table, column, connector, `rules.json`, OAuth, LDAP, …).
- User-facing strings go through i18n (next-intl) with `tr` as the primary/default locale;
  never hardcode UI strings.
- The user converses in Turkish; chat in Turkish, keep code and docs in English.

## Dependency versions
- Before adding or upgrading a dependency, verify the current stable version
  (`npm view <pkg> version`). Record it in [06-tech-stack.md](06-tech-stack.md).
- Prefer the latest stable releases; avoid betas unless explicitly decided (and noted).

## Clean code
- Meaningful names; single responsibility; DRY without premature abstraction.
- TypeScript strict mode; no `any` (justify any unavoidable exception inline).
- No dead code, no commented-out blocks, no leftover debug logging.
- Error handling at system boundaries (API routes, file IO, external calls).
- Small, focused modules; colocate by feature.

## Code quality / SonarQube
- Linter + SonarQube (SonarJS) findings are **blocking**.
- **Fix any warning/error/code smell you encounter — even pre-existing, even not yours** —
  immediately if small, or report to the user if large. Never label something "not my change."

## Testing
- Unit tests (Vitest) for non-trivial logic (validation, parsing, diffing, rule serialization).
- E2E tests (Playwright) for critical flows (login, edit+publish `rules.json`, import/diff).
- New logic ships with tests; do not regress green.

## Database
- All schema changes via **Prisma migrations** with descriptive names
  (`npx prisma migrate dev --name <desc>`). Never `db push` or raw SQL for schema changes.
- Keep [05-database-schema.md](05-database-schema.md) in sync with the Prisma schema.

## Config-file handling (domain-specific)
- Treat Trino artifacts (`rules.json`, `.properties`, certs) as the source of truth; the DB is
  backup/persist + audit.
- Validate before publishing: JSON validity, regex validity, referenced group/catalog existence,
  `rules.json` deny-all/empty-array and ordering hazards (first-match-wins).
- Every publish/import/rollback writes an `AuditLog` entry and a `ConfigVersion`.

## Git & commits
- Branch off `main`; do not commit to `main` directly unless asked.
- Commit or push only when the user asks.
- On every commit: update affected `docs/` and append an entry to
  [08-git-history.md](08-git-history.md) (hash, date, message, significance, docs updated).
- Commit messages: imperative subject; end with the configured `Co-Authored-By` trailer.

## Documentation discipline
- `docs/` and `designs/` are **committed** and are the primary source of truth — a fresh session
  (human or AI) must be able to understand the project from the repo (`README.md` + `docs/`) alone.
- Update affected docs with every change. Add new recipes/interfaces/gotchas as the code grows.
- When a function signature changes, update the relevant `interfaces/` contract; when a
  multi-file task pattern emerges, add a `recipes/` checklist; when a trap is found, add to
  [gotchas.md](gotchas.md).
