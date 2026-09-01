/**
 * SSH credential read/write for automated Ansible deployments.
 *
 * Passwords and private key PEM content are encrypted with AES-256-GCM
 * (src/lib/crypto.ts) before being stored; they are decrypted only when
 * a playbook run is about to be dispatched to the ansible-runner service.
 */

import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";

export type SshConfigInput = {
  sshUser: string;
  sshPassword?: string;
  privateKey?: string;
};

export type SshConfigPublic = {
  sshUser: string;
  hasPassword: boolean;
  hasPrivateKey: boolean;
};

export async function getSshConfigPublic(environmentId: string): Promise<SshConfigPublic | null> {
  const row = await prisma.environmentSshConfig.findUnique({ where: { environmentId } });
  if (!row) return null;
  return {
    sshUser: row.sshUser,
    hasPassword: row.sshPassword !== null,
    hasPrivateKey: row.privateKey !== null,
  };
}

/** Resolve decrypted SSH credentials for a runner request. Never returns plaintext to the client. */
export async function getSshCredentials(
  environmentId: string,
): Promise<{ sshUser: string; sshPassword?: string; sshPrivateKey?: string } | null> {
  const row = await prisma.environmentSshConfig.findUnique({ where: { environmentId } });
  if (!row) return null;
  return {
    sshUser: row.sshUser,
    sshPassword: row.sshPassword ? decrypt(row.sshPassword) : undefined,
    sshPrivateKey: row.privateKey ? decrypt(row.privateKey) : undefined,
  };
}

export async function saveSshConfig(environmentId: string, input: SshConfigInput): Promise<void> {
  const data = {
    sshUser: input.sshUser || "ansible",
    sshPassword: input.sshPassword ? encrypt(input.sshPassword) : null,
    privateKey: input.privateKey ? encrypt(input.privateKey) : null,
  };
  await prisma.environmentSshConfig.upsert({
    where: { environmentId },
    create: { environmentId, ...data },
    update: data,
  });
}

export async function deleteSshConfig(environmentId: string): Promise<void> {
  await prisma.environmentSshConfig.deleteMany({ where: { environmentId } });
}
