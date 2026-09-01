import { describe, it, expect } from "vitest";
import { formatGroupProviderFile, parseGroupProviderFile, buildUserGroups } from "./format";

describe("formatGroupProviderFile", () => {
  it("renders sorted group:members lines and skips empty groups", () => {
    const out = formatGroupProviderFile([
      { name: "analysts", members: ["bob", "alice"] },
      { name: "empty", members: [] },
      { name: "admins", members: ["root"] },
    ]);
    expect(out).toBe("admins:root\nanalysts:alice,bob\n");
  });
});

describe("parseGroupProviderFile", () => {
  it("parses group:csv lines, skipping comments/blanks", () => {
    expect(parseGroupProviderFile("# x\nanalysts:alice,bob\n\nadmins:root\n")).toEqual([
      { name: "analysts", members: ["alice", "bob"] },
      { name: "admins", members: ["root"] },
    ]);
  });
});

describe("buildUserGroups", () => {
  it("inverts groups into a sorted user→groups table", () => {
    expect(
      buildUserGroups([
        { name: "analysts", members: ["alice", "bob"] },
        { name: "admins", members: ["alice"] },
      ]),
    ).toEqual([
      { username: "alice", groups: ["admins", "analysts"] },
      { username: "bob", groups: ["analysts"] },
    ]);
  });
});
