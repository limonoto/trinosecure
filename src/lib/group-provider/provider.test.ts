import { describe, it, expect } from "vitest";
import {
  toLdapProviderProperties,
  toFileProviderProperties,
  parseGroupProviderConfig,
  DEFAULT_GROUP_PROVIDER_CONFIG,
} from "./provider";

describe("toLdapProviderProperties", () => {
  it("renders group-provider.name=ldap then sorted ldap.* lines, skipping empties", () => {
    const out = toLdapProviderProperties({
      "ldap.url": "ldaps://h:636",
      "ldap.user-base-dn": "ou=u,dc=x",
      "ldap.admin-password": "",
    });
    expect(out).toBe("group-provider.name=ldap\nldap.url=ldaps://h:636\nldap.user-base-dn=ou=u,dc=x\n");
  });
});

describe("toFileProviderProperties", () => {
  it("points the file provider at the group file", () => {
    expect(toFileProviderProperties("/etc/trino/group-provider.txt")).toBe(
      "group-provider.name=file\nfile.group-file=/etc/trino/group-provider.txt\n",
    );
  });
});

describe("parseGroupProviderConfig", () => {
  it("defaults to the file provider on null/invalid input", () => {
    expect(parseGroupProviderConfig(null)).toEqual(DEFAULT_GROUP_PROVIDER_CONFIG);
    expect(parseGroupProviderConfig("{bad")).toEqual(DEFAULT_GROUP_PROVIDER_CONFIG);
  });

  it("reads a stored LDAP config", () => {
    const cfg = parseGroupProviderConfig(JSON.stringify({ type: "LDAP", ldap: { "ldap.url": "x" } }));
    expect(cfg.type).toBe("LDAP");
    expect(cfg.ldap["ldap.url"]).toBe("x");
  });
});
