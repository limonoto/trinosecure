# Trino-Secure UI

Trino kümelerinin **tüm güvenlik yapılandırmasını** tek bir görsel arayüzden yöneten web
uygulaması. Elle, hataya açık config dosyalarını (`rules.json`, `*.properties`, sertifikalar,
secrets) düzenlemek yerine; güvenli, rehberli ve doğrulamalı bir panel.

> Arayüz **Türkçe**, kod ve teknik dokümanlar İngilizce. Uygulama **`http://localhost:3100`**
> üzerinde çalışır.

---

## Hangi sorunu çözüyor?

[Trino](https://trino.io) dağıtık bir SQL sorgu motorudur: veriyi saklamaz, birçok kaynağı
(PostgreSQL, MySQL, nesne depolama…) tek bir SQL ile sorgular. Bu güç, **"kim hangi veriye, ne
kadar erişebilir?"** sorusunu kritik hâle getirir.

Bugün bu yetkilendirme, birbirine bağımlı ve elle düzenlenen dosyalarla yapılır:

- Kimlik doğrulama ayarları (`*.properties`, LDAP/OAuth…)
- Grup sağlayıcı (group provider) dosyaları
- **`rules.json`** (yetkilendirme — büyük, iç içe, kırılması kolay)
- TLS sertifikaları ve secrets

Tek bir virgül hatası ya **herkese her şeyi açar** ya da **herkesi kilitler**. "Bu kullanıcı
sonuçta neye erişebiliyor?" sorusunun tek bakışta cevabı yoktur ve teknik olmayan kişiler bu
dosyaları yönetemez.

**Trino-Secure UI**, bu dağınık ve teknik işi tıkla-seç kolaylığında, doğrulamalı bir kontrol
paneline çevirir.

## Hedefler

- Elle dosya düzenlemeyi → güvenli, görsel, doğrulamalı akışlarla değiştirmek.
- "Kim neye erişebilir?" sorusunu yönetilebilir kılmak.
- Arayüz ↔ dosyalar ↔ veritabanı arasında tutarsızlığı (drift) önlemek.
- **Birden fazla Trino kurulumunu tam bağımsız** yönetmek (her ortam izole).
- Uzman olmayanlar için yaklaşılabilir, ama tüm Trino güvenlik yüzeyini kapsayan bir araç olmak.

---

## Şu an ne yapıyor? (çalışan özellikler)

- 🔐 **Keycloak (OIDC) ile giriş** — sadece kimlik doğrulama; yetkilendirme verisi uygulamada.
- 🌐 **Çoklu Trino ortamı** — her ortam (Production/Staging/…) tamamen izole; topbar'dan aktif
  ortam seçilir (DB tabanlı).
- 🗄️ **Ortam (Environment) CRUD** — teslim modu (HTTP/dosya), hedef, yenileme periyodu.
- 👥 **Grup CRUD + üyelik** — `rules.json` kurallarının yazıldığı gruplar; ortama kapsanmış.
- 📝 **`rules.json` editörü** — kalbi:
  - **Yapısal editör — 11 bölümün tamamı**: table, catalog, schema, **function, procedure, query,
    impersonation, authorization, system_information, system/catalog session properties** için
    ekle/düzenle/sil + **sürükle-bırak sıralama** (ilk-eşleşen-kazanır). Tek bir bildirimsel kayıt
    defterinden (`rule-sections.ts`) sürülür; tablolar için **sütun maskesi/gizleme + satır filtresi**
    alt-editörü.
  - **Ham JSON editörü** + **canlı doğrulama** (geçersiz JSON/regex, "deny-all" uyarısı).
  - **Sürümleme**: her kayıt yeni bir sürüm; **geçmiş + geri alma (rollback)**.
- 🔁 **İçe aktar & Fark** — bir `rules.json` yapıştır/yükle → satır-farkı (diff) → yeni sürüm.
- ⬇️ **Dışa aktar** — aktif `rules.json` indir.
- 🚀 **Yayınla (Publish)**:
  - **Mode A (HTTP-served)**: `GET /api/trino/[envId]?token=…` aktif `rules.json`'u sunar; Trino
    `security.config-file` ile bu adresi periyodik çeker.
  - **Mode B (file-write)**: aktif kurallar `configTarget` dosya yoluna yazılır.
- 📋 **Denetim (audit)** — kim, neyi, ne zaman değiştirdi (her işlem kaydedilir).

## Yol haritası

| Durum | Kapsam |
|------|--------|
| ✅ | Proje iskeleti, tasarım sistemi + app shell, PostgreSQL/Prisma, Keycloak/Auth.js |
| ✅ | Ortam CRUD + çoklu-Trino izolasyonu, Grup CRUD + üyelik |
| ✅ | `rules.json` editörü (yapısal + ham + doğrulama + drag), geçmiş/rollback, import/diff, publish (Mode A/B) |
| ✅ | **11 kural bölümünün tamamı için yapısal editör** (functions, queries, impersonation, authorization…) + sütun maskesi/satır filtresi |
| ✅ | Test altyapısı: Vitest (birim) + Playwright (e2e) |
| ⬜ | Authentication yöntemleri (LDAP/OAuth/JWT/Kerberos…), TLS/HTTPS, Secrets |
| ⬜ | OPA / Apache Ranger erişim-kontrol backend'leri |
| ⬜ | "Bu kullanıcı neye erişebilir?" (effective permissions), drift tespiti |

---

## Mimari

```
Kullanıcı → Keycloak (sadece kimlik) → [Trino-Secure UI]
                                              │  Öncelik: arayüz işlemleri + config DOSYALARI
                                              │  (DB ise yedek/persist + audit katmanı)
                                              ▼
                                   Trino  ← rules.json / .properties / sertifikalar
                                              ▼
                                   connector'lar → asıl veri (catalog'lar)
```

- **Keycloak yalnızca kimlik doğrular** (kullanıcı + token). Grup/yetki verisi bu uygulamada.
- **Öncelik: arayüz + dosyalar**; **DB yedek/persist + audit** katmanıdır.
- **Çoklu ortam izolasyonu**: grup/kural/audit hepsi `environmentId`'ye bağlı; bir ortamı silmek
  yalnız kendi verisini cascade siler → kurulumlar tam bağımsız.
- Yayın iki modda: **Mode A** (uygulama HTTP'den sunar, Trino çeker) / **Mode B** (dosyaya yaz).

## Teknoloji yığını

- **Next.js 16** (App Router) + **React 19** + **TypeScript** (strict)
- **Tailwind CSS 4** (shadcn-hizalı token modeli; tema `designs/`'ten port edildi)
- **PostgreSQL 17** + **Prisma 7** (`@prisma/adapter-pg`)
- **Keycloak 26** + **Auth.js v5** (next-auth) — OIDC
- **Zod** (doğrulama) · **Vitest** (birim) · **Playwright** (e2e) · **Docker Compose**

## Proje yapısı

```
src/
  app/
    (app)/            # giriş sonrası korumalı sayfalar (shell + layout)
      page.tsx        # Panel (dashboard)
      rules/          # rules.json editörü (yapısal + ham), publish dialog
      import/         # içe aktar & fark
      history/        # sürüm geçmişi + rollback
      groups/         # grup CRUD + üyelik
      environments/   # ortam CRUD
      ...
    api/
      auth/[...nextauth]/   # Auth.js
      trino/[envId]/        # Mode A: Trino'nun çektiği rules.json endpoint'i
    auth/signin/      # Keycloak'a yönlendiren giriş sayfası
  lib/
    rules/            # rules.json domain'i: schema (Zod), parse/validate, diff, service
    db.ts             # Prisma client (pg adapter)
    audit.ts          # audit-log yardımcıları
    environment-context.ts  # aktif ortam (cookie) + listeleme
    validation.ts     # paylaşılan Zod şemaları
  proxy.ts            # Next 16 proxy (eski "middleware") — route koruması
prisma/               # şema + migration'lar
keycloak/import/      # yerel dev Keycloak realm import'u
e2e/                  # Playwright testleri
```

> **Not:** Ayrıntılı geliştirme dokümanları **`docs/`** altındadır (depoya dahildir): proje
> genel bakışı, mimari, veritabanı şeması, yol haritası, alınan kararlar, git geçmişi, kavram
> sözlüğü ve "gotcha"lar — yeni bir geliştirici buradan başlayabilir. Tasarım mockup'ları
> `designs/` altında. Oturum/asistan talimatları `CLAUDE.md`'dedir.

---

## Kurulum & çalıştırma

Gereksinimler: **Node.js 24+**, **Docker** (Compose ile).

```bash
# 1) Bağımlılıklar
npm install

# 2) Ortam değişkenleri (yerel varsayılanlar dahil)
cp .env.example .env
#   .env içindeki AUTH_SECRET'i kendiniz üretin: openssl rand -base64 32
#   (Keycloak alanları yerel dev için hazır gelir)

# 3) Altyapı: Postgres (5433) + Keycloak (8081), realm otomatik import
docker compose up -d

# 4) Veritabanı şeması
npm run db:migrate

# 5) Geliştirme sunucusu (http://localhost:3100)
npm run dev
```

Tarayıcıda **http://localhost:3100** → "Keycloak ile giriş yap" → yerel dev kullanıcısı
**`admin` / `admin`** → Panel.

> **Portlar** (yerelde 3000/8080/5432 başka projelerce kullanıldığı için kaydırıldı):
> uygulama **:3100**, Keycloak **:8081**, PostgreSQL **:5433**.

### Komutlar

| Komut | Açıklama |
|------|----------|
| `npm run dev` | Geliştirme sunucusu (:3100) |
| `npm run build` | Üretim derlemesi |
| `npm run lint` | ESLint |
| `npm test` | Vitest birim testleri |
| `npm run test:e2e` | Playwright e2e (Docker yığını ayakta olmalı) |
| `npm run db:up` | Sadece Postgres'i başlat |
| `npm run db:migrate` | Prisma migration |
| `npm run db:studio` | Prisma Studio |

## Test

- **Birim (Vitest):** rules.json domain'i (şema/parse/validate/diff), doğrulama şemaları, ortam
  çözümleme ve yardımcılar.
- **E2E (Playwright):** girişsiz yönlendirme, **Keycloak girişi** (admin/admin) ve **tüm çekirdek
  akış** — ortam oluştur, grup + üye, rules düzenle (ham/yapısal) → kaydet → sürüm geçmişi. Tek
  seferlik giriş (saklı oturum) + DB seed ile deterministik. Dev sunucusunu kendi başlatır;
  `docker compose up -d` ile Postgres + Keycloak ayakta olmalı.

## Dağıtım için Trino tarafı (Mode A örneği)

Uygulamadaki **Yayınla** dialog'undan alınan uç noktayı Trino'ya verin:

```properties
access-control.name=file
security.config-file=http://<host>:3100/api/trino/<envId>?token=<token>
security.refresh-period=30s
```
