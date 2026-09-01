/** Read a FormData field as a string (non-string values such as File → ""). */
export function formString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}
