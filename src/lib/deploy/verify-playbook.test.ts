import { describe, it, expect } from "vitest";
import { generateVerifyPlaybook } from "./ansible";

describe("generateVerifyPlaybook", () => {
  it("asserts each file's sha256 on every node", () => {
    const yaml = generateVerifyPlaybook([{ dest: "/etc/trino/rules.json", sha256: "abc123" }]);
    expect(yaml).toContain("hosts: trino");
    expect(yaml).toContain("checksum_algorithm: sha256");
    expect(yaml).toContain('checksum == "abc123"');
    expect(yaml).toContain("path: /etc/trino/rules.json");
  });

  it("handles multiple files with distinct registers", () => {
    const yaml = generateVerifyPlaybook([
      { dest: "/etc/trino/rules.json", sha256: "h1" },
      { dest: "/etc/trino/password.db", sha256: "h2" },
    ]);
    expect(yaml).toContain("stat_/etc/trino/rules.json".replace(/[^a-zA-Z0-9]/g, "_"));
    expect(yaml).toContain("stat_/etc/trino/password.db".replace(/[^a-zA-Z0-9]/g, "_"));
  });
});
