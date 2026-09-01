import { describe, it, expect } from "vitest";
import { formatPasswordDb, parsePasswordDb, isValidPasswordUsername } from "./format";

describe("isValidPasswordUsername", () => {
  it("rejects empty, colon, and whitespace", () => {
    expect(isValidPasswordUsername("alice")).toBe(true);
    expect(isValidPasswordUsername("")).toBe(false);
    expect(isValidPasswordUsername("a:b")).toBe(false);
    expect(isValidPasswordUsername("a b")).toBe(false);
  });
});

describe("formatPasswordDb", () => {
  it("renders sorted username:hash lines with a trailing newline", () => {
    const out = formatPasswordDb([
      { username: "bob", passwordHash: "$2y$b" },
      { username: "alice", passwordHash: "$2y$a" },
    ]);
    expect(out).toBe("alice:$2y$a\nbob:$2y$b\n");
  });

  it("renders an empty string for no rows", () => {
    expect(formatPasswordDb([])).toBe("");
  });
});

describe("parsePasswordDb", () => {
  it("round-trips with formatPasswordDb and skips blank/comment lines", () => {
    const text = "# header\nalice:$2y$a\n\nbob:$2y$b\n";
    expect(parsePasswordDb(text)).toEqual([
      { username: "alice", passwordHash: "$2y$a" },
      { username: "bob", passwordHash: "$2y$b" },
    ]);
  });

  it("keeps only the first colon as the separator (bcrypt hashes contain none, but be safe)", () => {
    expect(parsePasswordDb("alice:$2y$a:extra")).toEqual([
      { username: "alice", passwordHash: "$2y$a:extra" },
    ]);
  });
});
