/**
 * Trino password-file (`password.db`) helpers — requirement 2.1.
 *
 * The file is htpasswd-style: one `username:hash` per line, where `hash` is a
 * bcrypt (`$2y$…`) or PBKDF2 digest. Plain-text passwords are never stored or
 * shown; only the hash lives in the DB / file. These helpers are pure (no hashing
 * — that happens server-side with bcryptjs) so they are unit-testable.
 */

export type PasswordRow = { username: string; passwordHash: string };

/** A username valid for the password file: non-empty, no `:`, no whitespace. */
export function isValidPasswordUsername(name: string): boolean {
  return name.length > 0 && !/[:\s]/.test(name);
}

/** Render rows as a Trino `password.db` file (stable, sorted by username). */
export function formatPasswordDb(rows: readonly PasswordRow[]): string {
  const lines = [...rows]
    .sort((a, b) => a.username.localeCompare(b.username))
    .map((r) => `${r.username}:${r.passwordHash}`);
  return lines.length > 0 ? `${lines.join("\n")}\n` : "";
}

/** Parse a `password.db` file into rows (skips blank / malformed lines). */
export function parsePasswordDb(text: string): PasswordRow[] {
  const rows: PasswordRow[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    const colon = line.indexOf(":");
    if (colon <= 0) continue;
    const username = line.slice(0, colon);
    const passwordHash = line.slice(colon + 1);
    if (isValidPasswordUsername(username) && passwordHash.length > 0) {
      rows.push({ username, passwordHash });
    }
  }
  return rows;
}
