import { createHash } from "node:crypto";

/**
 * Cluster consistency verification (requirements 2.3 + 5.3): confirm a config file
 * is identical on every node and that users/groups are present uniformly across
 * the cluster. Pure helpers here; the server action wires them to live nodes and
 * the Ansible verify playbook.
 */

/** Stable SHA-256 hex of a config file's content — the unit of equality across nodes. */
export function sha256Hex(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export type NodeInfo = {
  host: string;
  reachable: boolean;
  version: string | null;
  environment: string | null;
};

export type VersionConsistency = {
  allReachable: boolean;
  versionConsistent: boolean;
  environmentConsistent: boolean;
  /** Distinct non-null versions seen across reachable nodes. */
  versions: string[];
  /** Distinct non-null environments seen across reachable nodes. */
  environments: string[];
  unreachable: string[];
};

/** Determine whether all reachable nodes report the same Trino version + environment. */
export function nodeVersionConsistency(infos: readonly NodeInfo[]): VersionConsistency {
  const reachable = infos.filter((i) => i.reachable);
  const versions = [...new Set(reachable.map((i) => i.version).filter((v): v is string => !!v))];
  const environments = [...new Set(reachable.map((i) => i.environment).filter((v): v is string => !!v))];
  return {
    allReachable: infos.length > 0 && infos.every((i) => i.reachable),
    versionConsistent: versions.length <= 1,
    environmentConsistent: environments.length <= 1,
    versions,
    environments,
    unreachable: infos.filter((i) => !i.reachable).map((i) => i.host),
  };
}
