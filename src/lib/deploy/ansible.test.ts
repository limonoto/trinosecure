import { describe, it, expect } from "vitest";
import { generateInventory, generatePlaybook } from "./ansible";

describe("generateInventory", () => {
  it("renders a [trino] group with hosts", () => {
    expect(generateInventory(["w1", " w2 ", ""])).toBe("[trino]\nw1\nw2\n");
  });
});

describe("generatePlaybook", () => {
  const files = [{ filename: "rules.json", dest: "/etc/trino/rules.json" }];

  it("copies each file and uses a restart handler when restart=true", () => {
    const yaml = generatePlaybook(files, { restart: true });
    expect(yaml).toContain("hosts: trino");
    expect(yaml).toContain("src: files/rules.json");
    expect(yaml).toContain("dest: /etc/trino/rules.json");
    expect(yaml).toContain("notify: restart trino");
    expect(yaml).toContain("state: restarted");
    expect(yaml).toContain("serial: 1"); // controlled rolling restart
  });

  it("uses a hot-reload note when restart=false", () => {
    const yaml = generatePlaybook(files, { restart: false });
    expect(yaml).toContain("notify: reload note");
    expect(yaml).not.toContain("state: restarted");
  });
});
