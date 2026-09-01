/**
 * Generic Java `.properties` file parser and serializer.
 * Handles `key=value` lines; `#` and `!` comment lines; blank lines.
 */

/** Parse a `.properties` text into a key→value map (order preserved). */
export function parseProperties(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("!")) continue;
    const idx = line.indexOf("=");
    if (idx > 0) {
      result[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
  }
  return result;
}

/** Serialize a key→value map to `.properties` text. */
export function serializeProperties(props: Record<string, string>, header?: string): string {
  const lines: string[] = [];
  if (header) {
    for (const h of header.split("\n")) lines.push(`# ${h}`);
    lines.push("");
  }
  for (const [k, v] of Object.entries(props)) {
    if (v !== "") lines.push(`${k}=${v}`);
  }
  return `${lines.join("\n")}\n`;
}
