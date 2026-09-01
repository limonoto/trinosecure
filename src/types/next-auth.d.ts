import type { DefaultSession } from "next-auth";
import type { AppRole } from "@/lib/rbac";

/**
 * Module augmentation: carry the Keycloak username + mapped app roles through
 * the JWT and into the session (see src/auth.ts).
 */
declare module "next-auth" {
  interface Session {
    roles: AppRole[];
    user: {
      username?: string | null;
    } & DefaultSession["user"];
  }

  interface Profile {
    preferred_username?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    roles?: AppRole[];
    username?: string;
  }
}
