/**
 * Auth stub — authentication is disabled until a login strategy is decided.
 * All functions return no-op values; swap this file with a real NextAuth
 * implementation (Keycloak, credentials, etc.) when ready.
 */

export type StubSession = {
  user: { username: string; email: string | null; name?: string | null; image?: string | null };
  roles: never[];
  expires: string;
};

const STUB_SESSION: StubSession = {
  user: { username: "system", email: null },
  roles: [],
  expires: "2099-01-01T00:00:00.000Z",
};

export async function auth(): Promise<StubSession> {
  return STUB_SESSION;
}

// Stubs for NextAuth handler exports — not used while auth is disabled.
export const handlers = {
  GET: () => new Response("auth disabled", { status: 404 }),
  POST: () => new Response("auth disabled", { status: 404 }),
};
export async function signIn() {}
export async function signOut() {}
