import { describe, it, expect } from "vitest";
import { environmentSchema, groupSchema, memberSchema } from "@/lib/validation";

describe("environmentSchema", () => {
  it("accepts valid input", () => {
    const result = environmentSchema.safeParse({
      name: "prod",
      deliveryMode: "HTTP",
      configTarget: "https://x",
    });
    expect(result.success).toBe(true);
  });
  it("rejects a blank name", () => {
    expect(
      environmentSchema.safeParse({ name: "   ", deliveryMode: "HTTP", configTarget: "x" }).success,
    ).toBe(false);
  });
  it("rejects an invalid delivery mode", () => {
    expect(
      environmentSchema.safeParse({ name: "x", deliveryMode: "FTP", configTarget: "x" }).success,
    ).toBe(false);
  });
  it("trims the name", () => {
    const result = environmentSchema.safeParse({
      name: "  prod  ",
      deliveryMode: "FILE",
      configTarget: "/etc/trino",
    });
    expect(result.success ? result.data.name : null).toBe("prod");
  });
});

describe("groupSchema", () => {
  it("accepts a name without a description", () => {
    expect(groupSchema.safeParse({ name: "analysts" }).success).toBe(true);
  });
  it("rejects a blank name", () => {
    expect(groupSchema.safeParse({ name: "" }).success).toBe(false);
  });
});

describe("memberSchema", () => {
  it("accepts a username", () => {
    expect(memberSchema.safeParse({ username: "ali" }).success).toBe(true);
  });
  it("rejects a blank username", () => {
    expect(memberSchema.safeParse({ username: " " }).success).toBe(false);
  });
});
