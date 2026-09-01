import { z } from "zod";

/** Input schema for a Trino environment (create/update). */
export const environmentSchema = z.object({
  name: z.string().trim().min(1, { message: "Ad zorunlu" }).max(64),
  deliveryMode: z.enum(["HTTP", "FILE"]),
  configTarget: z.string().trim().min(1, { message: "Hedef zorunlu" }).max(512),
  refreshPeriod: z.string().trim().max(32).optional(),
  /** Coordinator REST API base URL (/v1/*) — required for node discovery. */
  trinoBaseUrl: z.string().trim().min(1, { message: "Trino API adresi zorunlu" }).max(512),
  /** Trino HTTP API username for basic auth — required. */
  trinoUsername: z.string().trim().min(1, { message: "Trino kullanıcı adı zorunlu" }).max(256),
});

/** Input schema for a group (create/update). */
export const groupSchema = z.object({
  name: z.string().trim().min(1, { message: "Ad zorunlu" }).max(128),
  description: z.string().trim().max(512).optional(),
});

/** Input schema for a group member's username. */
export const memberSchema = z.object({
  username: z.string().trim().min(1, { message: "Kullanıcı adı zorunlu" }).max(256),
});

/** Input schema for a password-file user (create). */
export const passwordUserSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, { message: "Kullanıcı adı zorunlu" })
    .max(256)
    .refine((v) => !/[:\s]/.test(v), { message: "Kullanıcı adı ':' veya boşluk içeremez" }),
  password: z.string().min(6, { message: "Şifre en az 6 karakter olmalı" }).max(256),
  encoding: z.enum(["BCRYPT", "PBKDF2"]).default("BCRYPT"),
});

/** Input schema for changing a password-file user's password. */
export const passwordChangeSchema = z.object({
  password: z.string().min(6, { message: "Şifre en az 6 karakter olmalı" }).max(256),
});

/** Input schema for an alert rule (requirement 6.6). */
export const alertRuleSchema = z.object({
  name: z.string().trim().min(1, { message: "Ad zorunlu" }).max(128),
  kind: z.enum(["STATIC", "DYNAMIC"]),
  metric: z.string().trim().min(1, { message: "Metrik seçin" }).max(64),
  comparator: z.enum(["GT", "GTE", "LT", "LTE"]),
  threshold: z.coerce.number().finite({ message: "Eşik sayısal olmalı" }),
  window: z.string().trim().min(1).max(16),
});

/** Input schema for a catalog connector configuration. */
export const catalogConfigSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Katalog adı zorunlu" })
    .max(128)
    .refine((v) => /^[a-z0-9_]+$/.test(v), {
      message: "Katalog adı yalnızca küçük harf, rakam ve alt çizgi içerebilir",
    }),
  connector: z.string().trim().min(1, { message: "Connector seçin" }).max(64),
  properties: z.record(z.string(), z.string()),
});
