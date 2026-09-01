import { describe, it, expect } from "vitest";
import { hashPassword, verifyPbkdf2, detectEncoding } from "./hash";

describe("PBKDF2 hashing", () => {
  it("produces a Trino-format digest that verifies", async () => {
    const hash = await hashPassword("s3cret!", "PBKDF2");
    expect(hash).toMatch(/^\d+:[0-9a-f]+:[0-9a-f]+$/);
    expect(verifyPbkdf2("s3cret!", hash)).toBe(true);
    expect(verifyPbkdf2("wrong", hash)).toBe(false);
  });

  it("uses a fresh salt each time", async () => {
    const a = await hashPassword("same", "PBKDF2");
    const b = await hashPassword("same", "PBKDF2");
    expect(a).not.toBe(b);
  });

  it("rejects malformed PBKDF2 strings", () => {
    expect(verifyPbkdf2("x", "not-a-hash")).toBe(false);
    expect(verifyPbkdf2("x", "1000:zz:zz")).toBe(false);
  });
});

describe("bcrypt hashing", () => {
  it("produces a bcrypt digest", async () => {
    const hash = await hashPassword("hunter2", "BCRYPT");
    expect(hash.startsWith("$2")).toBe(true);
  });
});

describe("detectEncoding", () => {
  it("classifies bcrypt and pbkdf2 hashes", () => {
    expect(detectEncoding("$2y$10$abcdefghijklmnopqrstuv")).toBe("BCRYPT");
    expect(detectEncoding("100000:deadbeef:cafebabe")).toBe("PBKDF2");
    expect(detectEncoding("plain")).toBeNull();
  });
});
