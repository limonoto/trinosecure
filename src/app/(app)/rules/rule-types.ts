import type { RulesDocument } from "@/lib/rules/schema";
import { SECTION_KEYS } from "./rule-sections";

/** A rule row with a stable client key (so editable/reorderable lists keep identity). */
export type EditorRule = Record<string, unknown> & { __key: string };

export type EditorDoc = {
  /** Rows per section key (functions, tables, …). */
  sections: Record<string, EditorRule[]>;
  /** Section keys that existed in the source doc (so an intentional empty array is preserved). */
  present: string[];
  /** Other top-level keys preserved verbatim. */
  rest: Record<string, unknown>;
};

let keyCounter = 0;
export function nextKey(): string {
  keyCounter += 1;
  return `r${keyCounter}`;
}

export function toEditorDoc(doc: RulesDocument): EditorDoc {
  const record: Record<string, unknown> = doc;
  const sections: Record<string, EditorRule[]> = {};
  const present: string[] = [];

  for (const key of SECTION_KEYS) {
    const value = record[key];
    if (Array.isArray(value)) {
      present.push(key);
      sections[key] = value.map((row) => ({ ...(row as Record<string, unknown>), __key: nextKey() }));
    } else {
      sections[key] = [];
    }
  }

  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (!SECTION_KEYS.includes(key)) rest[key] = value;
  }

  return { sections, present, rest };
}

export function toDocument(ed: EditorDoc): RulesDocument {
  const out: Record<string, unknown> = { ...ed.rest };
  for (const key of SECTION_KEYS) {
    const rows = ed.sections[key] ?? [];
    // Emit a section if it has rows, or it was present originally (keep intentional [] = deny-all).
    if (rows.length > 0 || ed.present.includes(key)) {
      out[key] = rows.map((row) => {
        const copy: Record<string, unknown> = { ...row };
        delete copy.__key;
        return copy;
      });
    }
  }
  return out as RulesDocument;
}

/** Move an item within an array (immutably). */
export function moveItem<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
