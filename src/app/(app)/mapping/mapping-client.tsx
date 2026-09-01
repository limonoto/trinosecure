"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Network, Save, Users } from "lucide-react";
import {
  LDAP_FIELDS,
  toLdapProviderProperties,
  toFileProviderProperties,
  type GroupProviderConfig,
  type GroupProviderType,
} from "@/lib/group-provider/provider";
import type { UserGroups } from "@/lib/group-provider/format";
import { saveGroupProvider, exportGroupFile } from "./actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const DEFAULT_GROUP_FILE = "/etc/trino/group-provider.txt";

function download(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function MappingClient({
  userGroups,
  groupCount,
  config,
}: Readonly<{ userGroups: UserGroups[]; groupCount: number; config: GroupProviderConfig }>) {
  const router = useRouter();
  const [type, setType] = useState<GroupProviderType>(config.type);
  const [ldap, setLdap] = useState<Record<string, string>>(config.ldap);
  const [saved, setSaved] = useState(true);
  const [pending, start] = useTransition();

  function selectType(value: string) {
    setType(value === "LDAP" ? "LDAP" : "FILE");
    setSaved(false);
  }
  function updateLdap(next: Record<string, string>) {
    setLdap(next);
    setSaved(false);
  }

  function save() {
    start(async () => {
      const result = await saveGroupProvider({ type, ldap });
      if (result.ok) {
        setSaved(true);
        router.refresh();
      }
    });
  }

  function downloadGroupFile() {
    start(async () => {
      const result = await exportGroupFile();
      if (result.ok) download(result.content, result.filename);
    });
  }

  function downloadProperties() {
    const content = type === "LDAP" ? toLdapProviderProperties(ldap) : toFileProviderProperties(DEFAULT_GROUP_FILE);
    download(content, "group-provider.properties");
  }

  return (
    <div className="mt-5 space-y-5">
      <Card className="flex-row flex-wrap items-center gap-3 px-4 py-3">
        <span className="text-[13px] font-medium">Sağlayıcı tipi</span>
        <Tabs value={type} onValueChange={(v) => selectType(String(v))}>
          <TabsList>
            <TabsTrigger value="FILE">Statik (dosya)</TabsTrigger>
            <TabsTrigger value="LDAP">LDAP</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={downloadProperties}>
            <Download /> group-provider.properties
          </Button>
          <Button size="sm" onClick={save} disabled={pending || saved}>
            <Save /> {saved ? "Kaydedildi" : "Kaydet"}
          </Button>
        </div>
      </Card>

      {type === "LDAP" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Network className="size-4 text-muted-foreground" /> LDAP yapılandırması
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {LDAP_FIELDS.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label className="gap-1.5">
                  {field.label}
                  {field.required && <span className="text-destructive">*</span>}
                  <span className="font-mono text-[11px] font-normal text-muted-foreground">{field.key}</span>
                </Label>
                <Input
                  type={field.secret ? "password" : "text"}
                  value={ldap[field.key] ?? ""}
                  placeholder={field.placeholder}
                  onChange={(e) => updateLdap({ ...ldap, [field.key]: e.target.value })}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card className="gap-0 py-0">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Kullanıcı → Grup</h2>
              <Badge variant="neutral">{userGroups.length} kullanıcı</Badge>
              <Badge variant="neutral">{groupCount} grup</Badge>
            </div>
            <Button variant="outline" size="sm" onClick={downloadGroupFile} disabled={pending}>
              <Download /> group-provider.txt indir
            </Button>
          </div>
          {userGroups.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13px] text-muted-foreground">
              Henüz üye eşlemesi yok. Gruplar ve üyeler “Gruplar” ekranından yönetilir.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kullanıcı</TableHead>
                  <TableHead>Gruplar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userGroups.map((row) => (
                  <TableRow key={row.username}>
                    <TableCell className="font-mono text-[13px]">{row.username}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {row.groups.map((g) => (
                          <Badge key={g} variant="primarySoft">{g}</Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}
    </div>
  );
}
