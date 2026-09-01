import { cookies } from "next/headers";
import { listEnvironments, getActiveEnvironmentId } from "@/lib/environment-context";
import { resolveActiveEnvironment } from "@/lib/environments-shared";
import { Topbar } from "@/components/shell/topbar";
import { ShellLayout } from "@/components/shell/shell-layout";

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [environments, activeId, jar] = await Promise.all([
    listEnvironments(),
    getActiveEnvironmentId(),
    cookies(),
  ]);
  const activeEnv = resolveActiveEnvironment(environments, activeId);
  const collapsed = jar.get("ts-sidebar")?.value === "1";

  return (
    <ShellLayout
      collapsed={collapsed}
      topbar={
        <Topbar
          environments={environments}
          activeEnvId={activeEnv?.id ?? null}
        />
      }
    >
      {children}
    </ShellLayout>
  );
}
