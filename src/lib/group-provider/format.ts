/**
 * Trino file-based group provider (`group-provider.txt`) helpers — requirement 2.1.
 *
 * The static file lists one `group_name:user1,user2,…` per line. These pure
 * helpers convert between the app's group/member model and that file, plus build
 * the user→group view the UI shows.
 */

export type GroupWithMembers = { name: string; members: string[] };
export type UserGroups = { username: string; groups: string[] };

/** Render groups as a `group-provider.txt` file (sorted; empty groups skipped). */
export function formatGroupProviderFile(groups: readonly GroupWithMembers[]): string {
  const lines = [...groups]
    .filter((g) => g.members.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((g) => `${g.name}:${[...g.members].sort((a, b) => a.localeCompare(b)).join(",")}`);
  return lines.length > 0 ? `${lines.join("\n")}\n` : "";
}

/** Parse a `group-provider.txt` file into groups (skips blank/malformed lines). */
export function parseGroupProviderFile(text: string): GroupWithMembers[] {
  const groups: GroupWithMembers[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    const colon = line.indexOf(":");
    if (colon <= 0) continue;
    const name = line.slice(0, colon).trim();
    const members = line
      .slice(colon + 1)
      .split(",")
      .map((m) => m.trim())
      .filter((m) => m !== "");
    if (name !== "") groups.push({ name, members });
  }
  return groups;
}

/** Invert groups → a sorted user→groups table for display. */
export function buildUserGroups(groups: readonly GroupWithMembers[]): UserGroups[] {
  const byUser = new Map<string, Set<string>>();
  for (const group of groups) {
    for (const member of group.members) {
      if (!byUser.has(member)) byUser.set(member, new Set());
      byUser.get(member)!.add(group.name);
    }
  }
  return [...byUser.entries()]
    .map(([username, set]) => ({ username, groups: [...set].sort((a, b) => a.localeCompare(b)) }))
    .sort((a, b) => a.username.localeCompare(b.username));
}
