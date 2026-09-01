import { describe, it, expect } from "vitest";
import { toCatalogProperties, parseCatalogProperties } from "./connectors";

describe("catalog .properties round-trip", () => {
  it("renders and parses back to the same connector + props", () => {
    const props = { "connection-url": "jdbc:postgresql://h:5432/db", "connection-user": "u" };
    const text = toCatalogProperties("postgresql", props);
    expect(text).toContain("connector.name=postgresql");
    const parsed = parseCatalogProperties(text);
    expect(parsed.connector).toBe("postgresql");
    expect(parsed.properties).toEqual(props);
  });

  it("skips comments and blank lines", () => {
    const parsed = parseCatalogProperties("# a comment\nconnector.name=memory\n\nkey=value\n");
    expect(parsed.connector).toBe("memory");
    expect(parsed.properties).toEqual({ key: "value" });
  });
});
