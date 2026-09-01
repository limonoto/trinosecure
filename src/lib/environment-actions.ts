"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ACTIVE_ENV_COOKIE } from "@/lib/environment-context";

/** Switch the active Trino environment (persisted in a cookie). */
export async function setActiveEnvironment(id: string): Promise<void> {
  const jar = await cookies();
  jar.set(ACTIVE_ENV_COOKIE, id, { path: "/", sameSite: "lax" });
  // Re-render the whole app shell + pages so everything reflects the new env.
  revalidatePath("/", "layout");
}
