import { describe, it, expect } from "vitest";
import { getConnector, toCatalogProperties, CONNECTORS } from "./connectors";

describe("connector registry", () => {
  it("exposes JDBC connectors with connection-url + user + password", () => {
    const pg = getConnector("postgresql");
    expect(pg?.label).toBe("PostgreSQL");
    expect(pg?.params.map((p) => p.key)).toEqual([
      "connection-url",
      "connection-user",
      "connection-password",
    ]);
    expect(pg?.params.find((p) => p.key === "connection-password")?.secret).toBe(true);
  });

  it("includes a no-param connector (memory)", () => {
    expect(getConnector("memory")?.params).toEqual([]);
  });

  it("has unique connector names", () => {
    const names = CONNECTORS.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("toCatalogProperties", () => {
  it("renders connector.name first, then sorted key=value, skipping empties", () => {
    const out = toCatalogProperties("postgresql", {
      "connection-user": "trino",
      "connection-url": "jdbc:postgresql://db:5432/app",
      "connection-password": "",
    });
    expect(out).toBe(
      "connector.name=postgresql\nconnection-url=jdbc:postgresql://db:5432/app\nconnection-user=trino\n",
    );
  });
});
