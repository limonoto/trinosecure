"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Code, Eye, Save } from "lucide-react";
import {
  parseAccessControl, serializeAccessControl,
  parseAuth, serializeAuth,
  parseRgProps, serializeRgProps,
  parseGpProps, serializeGpProps,
  type AccessControlName, type AuthName, type RgManagerMode, type GpProviderName,
} from "@/lib/properties/configs";
import { cn } from "@/lib/utils";
import {
  saveAccessControl, saveAuth, saveResourceGroupsProps, saveGroupProviderProps,
  type SaveResult,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

// ─── Shared helpers ───────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-[12px]">{label}</Label>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{children}</p>;
}

function SaveBar({
  dirty, saving, error, onSave, version,
}: {
  dirty: boolean; saving: boolean; error: string | null; onSave: () => void; version: number | null;
}) {
  return (
    <div className="flex items-center gap-3">
      {error && (
        <span className="flex items-center gap-1 text-[12px] text-destructive">
          <AlertTriangle className="size-3.5" /> {error}
        </span>
      )}
      {!error && version !== null && !dirty && (
        <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
          <CheckCircle2 className="size-3.5 text-success" /> v{version} kaydedildi
        </span>
      )}
      <Button size="sm" disabled={!dirty || saving} onClick={onSave} className="ml-auto">
        <Save /> {saving ? "Kaydediliyor…" : "Kaydet"}
      </Button>
    </div>
  );
}

type EditorMode = "form" | "raw";

function usePropertiesEditor<T>(
  initial: string,
  parse: (t: string) => T,
  serialize: (cfg: T) => string,
  saveAction: (content: string) => Promise<SaveResult>,
) {
  const [content, setContent] = useState(initial);
  const [savedContent, setSavedContent] = useState(initial);
  const [mode, setMode] = useState<EditorMode>("form");
  const [saving, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState<number | null>(null);

  const cfg = (() => { try { return parse(content); } catch { return null; } })();
  const dirty = content !== savedContent;

  function updateCfg(updater: (prev: T) => T) {
    if (!cfg) return;
    setContent(serialize(updater(cfg)));
  }

  function save() {
    setError(null);
    startSave(async () => {
      const result = await saveAction(content);
      if (result.ok) { setSavedContent(content); setVersion(result.version); }
      else setError(result.error);
    });
  }

  return { content, setContent, mode, setMode, cfg, dirty, saving, error, version, save, updateCfg };
}

// ─── access-control.properties editor ────────────────────────────────────────

function AccessControlEditor({ initial }: { initial: string }) {
  const e = usePropertiesEditor(initial, parseAccessControl, serializeAccessControl, saveAccessControl);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-muted-foreground">
          Trino'nun hangi yetkilendirme motorunu kullanacağını ve <code>rules.json</code>'u nereden okuyacağını belirler.
        </p>
        <Tabs value={e.mode} onValueChange={(v) => e.setMode(v as EditorMode)}>
          <TabsList className="h-7">
            <TabsTrigger value="form" className="text-[11px]"><Eye className="mr-1 size-3" />Form</TabsTrigger>
            <TabsTrigger value="raw" className="text-[11px]"><Code className="mr-1 size-3" />Ham</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {e.mode === "raw" ? (
        <Textarea className="min-h-[200px] font-mono text-[12px]" spellCheck={false}
          value={e.content} onChange={(ev) => e.setContent(ev.target.value)} />
      ) : e.cfg ? (
        <div className="space-y-4">
          <Field label="access-control.name">
            <Select value={e.cfg.name} onValueChange={(v) => e.updateCfg((c) => ({ ...c, name: v as AccessControlName }))}>
              <SelectTrigger className="font-mono text-[13px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["file", "allow-all", "read-only", "opa", "ranger"] as AccessControlName[]).map((n) => (
                  <SelectItem key={n} value={n} className="font-mono text-[13px]">{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {(e.cfg.name === "file" || e.cfg.name === "ranger") && (
            <>
              <Field label="security.config-file">
                <Input className="font-mono text-[13px]" value={e.cfg.configFile}
                  onChange={(ev) => e.updateCfg((c) => ({ ...c, configFile: ev.target.value }))} />
              </Field>
              <Field label="security.refresh-period">
                <Input className="font-mono text-[13px]" value={e.cfg.refreshPeriod} placeholder="ör. 30s"
                  onChange={(ev) => e.updateCfg((c) => ({ ...c, refreshPeriod: ev.target.value }))} />
              </Field>
            </>
          )}

          {e.cfg.name === "opa" && (
            <Field label="opa.policy.uri">
              <Input className="font-mono text-[13px]" value={e.cfg.opaUri} placeholder="http://opa:8181/v1/data/trino/allow"
                onChange={(ev) => e.updateCfg((c) => ({ ...c, opaUri: ev.target.value }))} />
            </Field>
          )}

          {Object.keys(e.cfg.extra).length > 0 && (
            <div className="rounded-md border p-3 text-[12px]">
              <SectionTitle>Tanımsız anahtarlar (ham)</SectionTitle>
              <div className="mt-2 space-y-1 font-mono text-muted-foreground">
                {Object.entries(e.cfg.extra).map(([k, v]) => (
                  <div key={k}>{k}={v}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-[12px] text-destructive">Geçersiz .properties formatı</p>
      )}

      <SaveBar dirty={e.dirty} saving={e.saving} error={e.error} onSave={e.save} version={e.version} />
    </div>
  );
}

// ─── password-authenticator.properties editor ─────────────────────────────────

function AuthEditor({ initial }: { initial: string }) {
  const e = usePropertiesEditor(initial, parseAuth, serializeAuth, saveAuth);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-muted-foreground">
          Şifre doğrulama mekanizmasını yapılandırır: dosya tabanlı, LDAP veya Salesforce.
        </p>
        <Tabs value={e.mode} onValueChange={(v) => e.setMode(v as EditorMode)}>
          <TabsList className="h-7">
            <TabsTrigger value="form" className="text-[11px]"><Eye className="mr-1 size-3" />Form</TabsTrigger>
            <TabsTrigger value="raw" className="text-[11px]"><Code className="mr-1 size-3" />Ham</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {e.mode === "raw" ? (
        <Textarea className="min-h-[200px] font-mono text-[12px]" spellCheck={false}
          value={e.content} onChange={(ev) => e.setContent(ev.target.value)} />
      ) : e.cfg ? (
        <div className="space-y-4">
          <Field label="password-authenticator.name">
            <Select value={e.cfg.name} onValueChange={(v) => e.updateCfg((c) => ({ ...c, name: v as AuthName }))}>
              <SelectTrigger className="font-mono text-[13px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["file", "ldap", "salesforce"] as AuthName[]).map((n) => (
                  <SelectItem key={n} value={n} className="font-mono text-[13px]">{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {e.cfg.name === "file" && (
            <>
              <SectionTitle>Dosya ayarları</SectionTitle>
              <Field label="file.password-file">
                <Input className="font-mono text-[13px]" value={e.cfg.passwordFile}
                  onChange={(ev) => e.updateCfg((c) => ({ ...c, passwordFile: ev.target.value }))} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="file.refresh-period">
                  <Input className="font-mono text-[13px]" value={e.cfg.fileRefreshPeriod} placeholder="ör. 5s"
                    onChange={(ev) => e.updateCfg((c) => ({ ...c, fileRefreshPeriod: ev.target.value }))} />
                </Field>
                <Field label="file.auth-token-cache.max-size">
                  <Input className="font-mono text-[13px]" type="number" value={e.cfg.tokenCacheMaxSize}
                    onChange={(ev) => e.updateCfg((c) => ({ ...c, tokenCacheMaxSize: ev.target.value }))} />
                </Field>
              </div>
            </>
          )}

          {e.cfg.name === "ldap" && (
            <>
              <SectionTitle>LDAP ayarları</SectionTitle>
              <Field label="ldap.url">
                <Input className="font-mono text-[13px]" value={e.cfg.ldapUrl} placeholder="ldap://host:389"
                  onChange={(ev) => e.updateCfg((c) => ({ ...c, ldapUrl: ev.target.value }))} />
              </Field>
              <Field label="ldap.user-bind-pattern">
                <Input className="font-mono text-[13px]" value={e.cfg.ldapUserBindPattern}
                  placeholder="uid=${USER},ou=people,dc=example,dc=com"
                  onChange={(ev) => e.updateCfg((c) => ({ ...c, ldapUserBindPattern: ev.target.value }))} />
              </Field>
              <Field label="ldap.group-authorization-filter">
                <Input className="font-mono text-[13px]" value={e.cfg.ldapGroupAuthorizationFilter} placeholder="isteğe bağlı"
                  onChange={(ev) => e.updateCfg((c) => ({ ...c, ldapGroupAuthorizationFilter: ev.target.value }))} />
              </Field>
              <Field label="ldap.cache-ttl">
                <Input className="font-mono text-[13px]" value={e.cfg.ldapCacheTtl} placeholder="ör. 1h"
                  onChange={(ev) => e.updateCfg((c) => ({ ...c, ldapCacheTtl: ev.target.value }))} />
              </Field>
            </>
          )}

          {Object.keys(e.cfg.extra).length > 0 && (
            <div className="rounded-md border p-3 text-[12px]">
              <SectionTitle>Tanımsız anahtarlar (ham)</SectionTitle>
              <div className="mt-2 space-y-1 font-mono text-muted-foreground">
                {Object.entries(e.cfg.extra).map(([k, v]) => <div key={k}>{k}={v}</div>)}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-[12px] text-destructive">Geçersiz .properties formatı</p>
      )}

      <SaveBar dirty={e.dirty} saving={e.saving} error={e.error} onSave={e.save} version={e.version} />
    </div>
  );
}

// ─── resource-groups.properties editor ───────────────────────────────────────

function RgPropsEditor({ initial }: { initial: string }) {
  const e = usePropertiesEditor(initial, parseRgProps, serializeRgProps, saveResourceGroupsProps);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-muted-foreground">
          Resource group yöneticisini seçer: <strong>file</strong> (JSON dosyası) veya <strong>db</strong> (restart gerektirmez, HA için ideal).
        </p>
        <Tabs value={e.mode} onValueChange={(v) => e.setMode(v as EditorMode)}>
          <TabsList className="h-7">
            <TabsTrigger value="form" className="text-[11px]"><Eye className="mr-1 size-3" />Form</TabsTrigger>
            <TabsTrigger value="raw" className="text-[11px]"><Code className="mr-1 size-3" />Ham</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {e.mode === "raw" ? (
        <Textarea className="min-h-[200px] font-mono text-[12px]" spellCheck={false}
          value={e.content} onChange={(ev) => e.setContent(ev.target.value)} />
      ) : e.cfg ? (
        <div className="space-y-4">
          <Field label="resource-groups.configuration-manager">
            <Select value={e.cfg.mode} onValueChange={(v) => e.updateCfg((c) => ({ ...c, mode: v as RgManagerMode }))}>
              <SelectTrigger className="font-mono text-[13px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="file" className="font-mono text-[13px]">file — JSON dosyasından okur</SelectItem>
                <SelectItem value="db" className="font-mono text-[13px]">db — Veritabanından okur (HA)</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {e.cfg.mode === "file" && (
            <Field label="resource-groups.config-file">
              <Input className="font-mono text-[13px]" value={e.cfg.configFile}
                onChange={(ev) => e.updateCfg((c) => ({ ...c, configFile: ev.target.value }))} />
            </Field>
          )}

          {e.cfg.mode === "db" && (
            <>
              <SectionTitle>Veritabanı bağlantısı</SectionTitle>
              <Field label="resource-groups.config-db-url">
                <Input className="font-mono text-[13px]" value={e.cfg.dbUrl}
                  placeholder="jdbc:postgresql://host:5432/trino_rg"
                  onChange={(ev) => e.updateCfg((c) => ({ ...c, dbUrl: ev.target.value }))} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="resource-groups.config-db-user">
                  <Input className="font-mono text-[13px]" value={e.cfg.dbUser}
                    onChange={(ev) => e.updateCfg((c) => ({ ...c, dbUser: ev.target.value }))} />
                </Field>
                <Field label="resource-groups.config-db-password">
                  <Input className="font-mono text-[13px]" type="password" value={e.cfg.dbPassword}
                    onChange={(ev) => e.updateCfg((c) => ({ ...c, dbPassword: ev.target.value }))} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="resource-groups.config-db-environment">
                  <Input className="font-mono text-[13px]" value={e.cfg.dbEnvironment} placeholder="production"
                    onChange={(ev) => e.updateCfg((c) => ({ ...c, dbEnvironment: ev.target.value }))} />
                </Field>
                <Field label="resource-groups.config-db-refresh-interval (ms)">
                  <Input className="font-mono text-[13px]" type="number" value={e.cfg.dbRefreshIntervalMs}
                    onChange={(ev) => e.updateCfg((c) => ({ ...c, dbRefreshIntervalMs: ev.target.value }))} />
                </Field>
              </div>
              <div className={cn("rounded-md border p-3 text-[12px]", "border-info/40 bg-info/5")}>
                <strong>DB modunda:</strong> Bu dosyayı kaydedin ve cluster'a dağıtın. Ardından Trino,
                resource-groups.json yerine DB tablolarını okur ve tüm coordinator'lar otomatik senkronize olur.
              </div>
            </>
          )}

          {Object.keys(e.cfg.extra).length > 0 && (
            <div className="rounded-md border p-3 text-[12px]">
              <SectionTitle>Tanımsız anahtarlar (ham)</SectionTitle>
              <div className="mt-2 space-y-1 font-mono text-muted-foreground">
                {Object.entries(e.cfg.extra).map(([k, v]) => <div key={k}>{k}={v}</div>)}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-[12px] text-destructive">Geçersiz .properties formatı</p>
      )}

      <SaveBar dirty={e.dirty} saving={e.saving} error={e.error} onSave={e.save} version={e.version} />
    </div>
  );
}

// ─── group-provider.properties editor ────────────────────────────────────────

function GpPropsEditor({ initial }: { initial: string }) {
  const e = usePropertiesEditor(initial, parseGpProps, serializeGpProps, saveGroupProviderProps);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-muted-foreground">
          Grup üyeliği sağlayıcısını yapılandırır: dosya (<code>group-provider.txt</code>) veya LDAP dizini.
        </p>
        <Tabs value={e.mode} onValueChange={(v) => e.setMode(v as EditorMode)}>
          <TabsList className="h-7">
            <TabsTrigger value="form" className="text-[11px]"><Eye className="mr-1 size-3" />Form</TabsTrigger>
            <TabsTrigger value="raw" className="text-[11px]"><Code className="mr-1 size-3" />Ham</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {e.mode === "raw" ? (
        <Textarea className="min-h-[200px] font-mono text-[12px]" spellCheck={false}
          value={e.content} onChange={(ev) => e.setContent(ev.target.value)} />
      ) : e.cfg ? (
        <div className="space-y-4">
          <Field label="group-provider.name">
            <Select value={e.cfg.name} onValueChange={(v) => e.updateCfg((c) => ({ ...c, name: v as GpProviderName }))}>
              <SelectTrigger className="font-mono text-[13px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="file" className="font-mono text-[13px]">file — grup-provider.txt dosyası</SelectItem>
                <SelectItem value="ldap" className="font-mono text-[13px]">ldap — LDAP dizininden gruplar</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {e.cfg.name === "file" && (
            <>
              <Field label="file.group-file">
                <Input className="font-mono text-[13px]" value={e.cfg.groupFile}
                  onChange={(ev) => e.updateCfg((c) => ({ ...c, groupFile: ev.target.value }))} />
              </Field>
              <Field label="file.refresh-period">
                <Input className="font-mono text-[13px]" value={e.cfg.fileRefreshPeriod} placeholder="ör. 30s"
                  onChange={(ev) => e.updateCfg((c) => ({ ...c, fileRefreshPeriod: ev.target.value }))} />
              </Field>
            </>
          )}

          {e.cfg.name === "ldap" && (
            <>
              <SectionTitle>LDAP bağlantısı</SectionTitle>
              <Field label="ldap.url">
                <Input className="font-mono text-[13px]" value={e.cfg.ldapUrl} placeholder="ldap://host:389"
                  onChange={(ev) => e.updateCfg((c) => ({ ...c, ldapUrl: ev.target.value }))} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="ldap.user-base-dn">
                  <Input className="font-mono text-[13px]" value={e.cfg.ldapUserBaseDn}
                    onChange={(ev) => e.updateCfg((c) => ({ ...c, ldapUserBaseDn: ev.target.value }))} />
                </Field>
                <Field label="ldap.group-base-dn">
                  <Input className="font-mono text-[13px]" value={e.cfg.ldapGroupBaseDn}
                    onChange={(ev) => e.updateCfg((c) => ({ ...c, ldapGroupBaseDn: ev.target.value }))} />
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="ldap.group-name-attribute">
                  <Input className="font-mono text-[13px]" value={e.cfg.ldapGroupNameAttribute}
                    onChange={(ev) => e.updateCfg((c) => ({ ...c, ldapGroupNameAttribute: ev.target.value }))} />
                </Field>
                <Field label="ldap.group-member-attribute">
                  <Input className="font-mono text-[13px]" value={e.cfg.ldapGroupMemberAttribute}
                    onChange={(ev) => e.updateCfg((c) => ({ ...c, ldapGroupMemberAttribute: ev.target.value }))} />
                </Field>
                <Field label="ldap.user-member-attribute">
                  <Input className="font-mono text-[13px]" value={e.cfg.ldapUserMemberAttribute}
                    onChange={(ev) => e.updateCfg((c) => ({ ...c, ldapUserMemberAttribute: ev.target.value }))} />
                </Field>
              </div>
              <Field label="ldap.cache-ttl">
                <Input className="font-mono text-[13px]" value={e.cfg.ldapCacheTtl} placeholder="ör. 1h"
                  onChange={(ev) => e.updateCfg((c) => ({ ...c, ldapCacheTtl: ev.target.value }))} />
              </Field>
            </>
          )}

          {Object.keys(e.cfg.extra).length > 0 && (
            <div className="rounded-md border p-3 text-[12px]">
              <SectionTitle>Tanımsız anahtarlar (ham)</SectionTitle>
              <div className="mt-2 space-y-1 font-mono text-muted-foreground">
                {Object.entries(e.cfg.extra).map(([k, v]) => <div key={k}>{k}={v}</div>)}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-[12px] text-destructive">Geçersiz .properties formatı</p>
      )}

      <SaveBar dirty={e.dirty} saving={e.saving} error={e.error} onSave={e.save} version={e.version} />
    </div>
  );
}

// ─── Main tabbed client ───────────────────────────────────────────────────────

const TABS = [
  { id: "access-control", label: "access-control.properties" },
  { id: "auth", label: "password-authenticator.properties" },
  { id: "resource-groups", label: "resource-groups.properties" },
  { id: "group-provider", label: "group-provider.properties" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export type PropertiesContent = {
  accessControl: string;
  auth: string;
  resourceGroupsProps: string;
  groupProviderProps: string;
};

export function PropertiesClient({ content }: Readonly<{ content: PropertiesContent }>) {
  const [tab, setTab] = useState<TabId>("access-control");

  return (
    <div className="mt-5 space-y-4">
      {/* File tabs */}
      <div className="flex flex-wrap gap-1 border-b pb-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-t-md border-b-2 px-3 py-2 font-mono text-[12px] transition-colors",
              tab === t.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Editor panels */}
      <Card className="p-5">
        {tab === "access-control" && <AccessControlEditor initial={content.accessControl} />}
        {tab === "auth" && <AuthEditor initial={content.auth} />}
        {tab === "resource-groups" && <RgPropsEditor initial={content.resourceGroupsProps} />}
        {tab === "group-provider" && <GpPropsEditor initial={content.groupProviderProps} />}
      </Card>

      {/* Deploy reminder */}
      <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 p-3 text-[12px]">
        <AlertTriangle className="mt-0.5 size-3.5 flex-none text-warning" />
        <p>
          Kaydedilen <code>.properties</code> dosyaları cluster'a otomatik dağıtılmaz.{" "}
          <strong>Dağıtım &amp; Drift</strong> sayfasından Ansible playbook'u çalıştırın veya dosyaları
          cluster node'larına manuel kopyalayın. Değişiklikler Trino'yu yeniden başlatmadan etkili olmaz
          (file modunda <code>refresh-period</code> geçerli değildir — Trino'yu yeniden başlatın).
        </p>
      </div>
    </div>
  );
}
