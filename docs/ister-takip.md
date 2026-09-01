# NİZAM — İster Takip ve Yapılacaklar (Tek Kaynak)

**Güncelleme:** 2026-07-16
**Referans:** [`Projeİsterleri.txt`](../Projeİsterleri.txt) — bu doküman onun her maddesini birebir izler.
**Amaç:** "İsterler ne, ne yapıldı, ne kaldı" sorusunun **tek yetkili cevabı**. Daha önce
[`UYGUNLUK-RAPORU-2026-06-30.md`](../UYGUNLUK-RAPORU-2026-06-30.md), [`07-roadmap.md`](07-roadmap.md)
ve [`README.md`](README.md) arasında dağınık olan durum/yapılacak bilgisi burada toplanmıştır.

**Gösterim:** ✅ tam · 🟨 kısmi · ❌ eksik.

---

## 1. Özet Durum

| | Sayı | Oran |
|---|------|------|
| ✅ Tam karşılanıyor | 39 | **%100** |
| 🟨 Kısmi | 0 | %0 |
| ❌ Eksik | 0 | %0 |
| **Toplam alt-madde** | **39** | |

> `Projeİsterleri.txt`'in **tüm alt-maddeleri karşılanıyor**. Birkaç maddede modele bağlı bilinen
> sınır var (çok-cluster hata yoğunluğu, network throughput — bkz. §4), ama ister düzeyinde eksik yok.
> Kalan tek iş bir **test-ortamı** hazırlığıdır (yerel Trino'ya rules.json — §3/P3).

### Doğrulama anlık görüntüsü (2026-07-01)

| Kontrol | Sonuç |
|---------|-------|
| `tsc --noEmit` (typecheck) | ✅ temiz |
| `eslint` (lint) | ✅ temiz |
| `vitest run` (birim testleri) | ✅ **151/151** (31 dosya) |
| `next build` (production build) | ✅ 26 route |
| `playwright test` (e2e) | ✅ **7/7** (production build'e karşı — dev-overlay sorunu çözüldü) |
| Fonksiyonel (PBKDF2 + rollback) | ✅ canlı doğrulandı |

---

## 2. İster Ağacı ve Durum

### 1. Genel Hedef ve Kapsam

**1.1 Amaç** — Trino konfigürasyonlarını tek merkezden, güvenli, görsel, versiyonlu, denetlenebilir
yönetmek; dosya-bazlı dağınık yönetimi ortadan kaldırmak; Trino hata yönetimi. → ✅ (mimari + tüm alt
sistemlerle karşılanıyor).

**1.2 Kapsama giren konfigürasyonlar** — hepsi için görsel editör mevcut:

| Konfig | Durum | Ekran |
|--------|-------|-------|
| rules.json | ✅ | `/rules` |
| resource-groups.json | ✅ | `/resource-groups` |
| access-control.properties | ✅ | `/properties` |
| password-authenticator.properties | ✅ | `/properties` |
| resource-groups.properties | ✅ | `/properties` |
| group-provider.properties | ✅ | `/properties` |
| group-provider.txt | ✅ | `/mapping` |
| password.db | ✅ | `/passwords` |
| Katalog konfigleri | ✅ | `/catalogs` |
| API Endpointleri | ✅ | `/metrics` `/errors` `/nodes` `/performance` |

### 2. Mimari ve Temel Tasarım

**2.1 Görsel konfigürasyon editörleri**

| Dosya | İster maddesi | Durum | Kanıt |
|-------|---------------|-------|-------|
| rules.json | Rule priority (drag & drop) | ✅ | Native HTML5 drag&drop, `rules-client.tsx` |
| rules.json | Rule preview ("şunu yapabilir mi?") | ✅ | [`effective.ts`](../src/lib/rules/effective.ts) + `access-preview.tsx` |
| rules.json | Allow/deny çakışma tespiti | ✅ | [`conflicts.ts`](../src/lib/rules/conflicts.ts) |
| rules.json | SELECT/OWNERSHIP/INSERT/DELETE/UPDATE (user/grup) | ✅ | `rule-sections.ts` |
| resource-groups.json | Tree-based görselleştirme + hiyerarşi | ✅ | `resource-groups-client.tsx` (recursive `GroupNode`, connector lines, depth indent) |
| resource-groups.json | Hard/soft limit grafik | ✅ | `MemoryBar` (% mavi dolgu + üst referans çizgisi) + `ConcurrencyBar` (hard=kırmızı/soft=sarı) |
| resource-groups.json | CRUD (ekle/düzenle/sil) | ✅ | `GroupFormDialog` + tree mutation helpers (`insertGroup`/`updateGroupAtPath`/`deleteGroupAtPath`) |
| resource-groups.json | Otomatik bellek % hesabı | ✅ | Form dialogda üst grubun limitine göre oran ve taşma uyarısı |
| .properties dosyaları | CRUD + versiyonlama | ✅ | `/properties` (Cluster Konfigürasyonu) — 4 sekmeli form+ham editör |
| .properties dosyaları | Deploy pipeline entegrasyonu | ✅ | `buildFileMap` + `destinationFor` + Ansible/SHA-256/SSH import |
| group-provider.txt | LDAP / statik ayrımı | ✅ | `mapping-client.tsx` + [`provider.ts`](../src/lib/group-provider/provider.ts) |
| group-provider.txt | Kullanıcı→grup görsel tablo | ✅ | `mapping-client.tsx` |
| password.db | Plain text gösterimi yok | ✅ | yalnız hash, [`format.ts`](../src/lib/passwords/format.ts) |
| password.db | Şifre değiştirilebilir | ✅ | `passwords/actions.ts` |
| password.db | Kullanıcı eklenip silinebilir | ✅ | `passwords/actions.ts` |
| password.db | Password decryption tipi seçilebilir | ✅ | **bcrypt + PBKDF2** ([`hash.ts`](../src/lib/passwords/hash.ts), Trino formatı `iterations:salt:hash`) |
| Katalog | JDBC + tipe göre öneri param/key-value | ✅ | [`connectors.ts`](../src/lib/catalogs/connectors.ts) (12+ konnektör) |

**2.2 Canlı Validasyon**

| İster | Durum | Kanıt |
|-------|-------|-------|
| Edit sırasında: JSON şema + Trino semantik validasyon | ✅ | rules/resource-groups/katalog Zod + regex |
| Kaydetten sonra: "Trino'da ayağa kalkar mı" | ✅ | boot-check **rules.json** + **resource-groups.json** ([`boot-check.ts`](../src/lib/resource-groups/boot-check.ts)) + **katalog** ([`boot-check.ts`](../src/lib/catalogs/boot-check.ts)) |

**2.3 Cluster'a kullanıcı eklenmesi**

| İster | Durum | Kanıt |
|-------|-------|-------|
| Arayüzden ekle + gruba dahil et (tek akış) | ✅ | `passwords/actions.ts` |
| Tüm node'larda mevcut olduğunun doğrulanması | ✅ | Dağıtım → "Cluster tutarlılık doğrulama" ([`consistency.ts`](../src/lib/deploy/consistency.ts)) |

### 3. Güvenlik ve Yetkilendirme

| İster | Durum | Kanıt |
|-------|-------|-------|
| 3.1 RBAC rolleri (Viewer / Config Editör / Platform Admin) | ✅ | [`rbac.ts`](../src/lib/rbac.ts) |
| 3.2 Yetki kapsamı (salt-okuma / belirli dosya / belirli RG) | ✅ | [`authz.ts`](../src/lib/authz.ts) `getAccess`/`ensureConfigWrite`/`ensureResourceGroupWrite`; Ayarlar UI'sinde atanır |
| 3.3 Audit (kim/ne/ne zaman + önceki/sonraki değerler) | ✅ | [`audit.ts`](../src/lib/audit.ts) + config kayıtlarında gerçek içerik before/after |

### 4. Versiyonlama ve Rollback

| İster | Durum | Kanıt |
|-------|-------|-------|
| 4.1 Her değişiklik rollback yapılabilir | ✅ | rules/resource-groups/group-provider **+ password.db + katalog** ([`versioning.ts`](../src/lib/versioning.ts)); `/history` tüm tipleri listeler |
| 4.2 JSON diff + logical diff | ✅ | [`diff.ts`](../src/lib/rules/diff.ts) + [`logical-diff.ts`](../src/lib/rules/logical-diff.ts) |
| 4.3 Tek tıkla rollback + cluster'a re-deploy | ✅ | Rollback otomatik yeniden dağıtır ([`publish.ts`](../src/lib/deploy/publish.ts)) |

### 5. Deployment ve Entegrasyon

| İster | Durum | Kanıt |
|-------|-------|-------|
| 5.1 File sync / Ansible + controlled restart | ✅ | [`ansible.ts`](../src/lib/deploy/ansible.ts) `serial:1`; Mode A HTTP endpoint |
| 5.2 Multi-environment (Test / Prod) | ✅ | `TrinoEnvironment` + aktif ortam çerezi |
| 5.3 Configlerin tüm sunucularda eşitliği + kullanıcı eşitliği | ✅ | `verifyConsistency`: `/v1/info` node kontrolü + SHA-256 + doğrulama playbook'u |

### 6. Gözlemleme, Metrik ve Analitik

| İster | Durum | Kanıt / Kalan |
|-------|-------|---------------|
| 6.1 Trino API entegrasyonları (periyodik) | ✅ | `/v1/query`, `/v1/query/{id}`, `/v1/node`, `/v1/task` (best-effort), `/v1/info`, `/v1/status`. `/v1/cluster` Trino'da yok → durumlardan türetilir |
| 6.2.1 Hata toplama (USER/INTERNAL/INSUFFICIENT/EXCEEDED) | ✅ | [`ingest.ts`](../src/lib/metrics/ingest.ts) |
| 6.2.2 Hata grafikleri | ✅ | Zaman serisi/tip/kullanıcı/RG + **hata yoğunluğu (oran %)**; hatayı aldıran sunucu query detayında. (Cluster-arası kıyas çok-cluster gerektirir — §4) |
| 6.2.3 Hata drill-down (query→detay→node) | ✅ | `/queries/[queryId]` detay + ilgili node'lar |
| 6.3.1 Cluster sağlık metrikleri | ✅ | active/running/queued + **koordinatör-vs-worker yük** + **RG concurrency** (`/metrics`) |
| 6.3.2 Node bazlı istatistik (CPU/mem/heap/task/failed/network) | ✅ | per-worker CPU/heap/non-heap + task/failed + karşılaştırma tablosu (network "varsa" — Trino sunmuyor) |
| 6.4.1 Query performansı (runtime/queue/exec vs planning) | ✅ | `performance/page.tsx` + [`aggregate.ts`](../src/lib/metrics/aggregate.ts) |
| 6.4.2 Resource group performansı | ✅ | RG başına ort. süre + **concurrency doygunluğu (running/hard limit)** + **limit aşımı** ([`resourceGroupPerformance`](../src/lib/metrics/aggregate.ts), `/resource-performance`) |
| 6.5.1 4 standart dashboard | ✅ | Cluster (`/metrics`) · Error (`/errors`) · Node (`/nodes`) · **Resource Group Performance (`/resource-performance`)** |
| 6.5.2 Zaman aralığı (15dk/1s/24s/7g + spesifik) | ✅ | hazır aralıklar + özel from/to ([`range.ts`](../src/lib/metrics/range.ts)) |
| 6.5.3 Filtreleme (Cluster/Kullanıcı/Grup/Hata tipi) | ✅ | tip+kullanıcı+grup filtreleri (`/errors`); Cluster = aktif ortam |
| 6.6.1 Statik eşikler | ✅ | [`evaluate.ts`](../src/lib/alerts/evaluate.ts) |
| 6.6.2 Dinamik anomali | ✅ | z-score, 8 pencere ([`alerts/service.ts`](../src/lib/alerts/service.ts)) |

---

## 3. Yapılacaklar (Konsolide Backlog)

### ✅ Tamamlandı (2026-07-16 turu)
- ✅ **resource-groups.json CRUD + tree görselleştirme**: `GroupFormDialog` (tüm Trino alanları +
  otomatik bellek % hesabı + taşma uyarısı); recursive `GroupNode` bileşeni connector line'larıyla;
  `MemoryBar` + `ConcurrencyBar` grafiksel limitler; `insertGroup` / `updateGroupAtPath` /
  `deleteGroupAtPath` tree mutation yardımcıları (`src/lib/resource-groups/tree.ts`).
- ✅ **Tüm 4 `.properties` dosyası CRUD + deploy**: `access-control.properties`,
  `password-authenticator.properties`, `resource-groups.properties` (file + DB modu),
  `group-provider.properties` — `/properties` (Cluster Konfigürasyonu) sayfası. Versiyonlu
  `ConfigArtifact` olarak saklanır. `buildFileMap` → `destinationFor` → Ansible/SHA-256/SSH import
  pipeline'ına tam entegre; Prisma şeması genişletildi (`RESOURCE_GROUPS_PROPERTIES` +
  `GROUP_PROVIDER_PROPERTIES`).

### ✅ Tamamlandı (2026-07-01 turu)
- ✅ **6.4.2** RG performansı: concurrency doygunluğu + limit aşımı + ort. süre → yeni
  **`/resource-performance`** dashboard'u.
- ✅ **6.3.1** Koordinatör-vs-worker yük + RG concurrency → `/metrics` sayfasında.
- ✅ **6.5.1** Ayrı Resource Group Performance dashboard'u (4 dashboard tamamlandı).
- ✅ **6.2.2** Hata yoğunluğu (oran %) zaman serisi → `/errors`.
- ✅ **2.2** Boot-check rules + resource-groups + katalog için (save-guard).
- ✅ **D2–D5** Doküman dürüstlüğü: README/roadmap test/port ifadeleri, `.env.example`/gotchas port,
  01/03 kapsam notu düzeltildi.
- ✅ **E2E** production build'e karşı koşuyor (dev-overlay çözüldü) → **7/7 yeşil**.
- ✅ **İnteraktif kılavuz** `/guide` (sidebar → Yardım) + [`kullanici-kilavuzu.md`](kullanici-kilavuzu.md).
  İçinde **Sayfa ↔ Dosya Eşlemesi** referans tablosu (hangi sayfa hangi Trino config dosyasını nasıl
  yönetir) ve her sayfa kartında işlediği dosya/veri kaynağı (file/db/api) rozetleri.

### Kalan
- ✅ **Yerel Trino test-ortamı düzeltildi (2026-07-01)** — kopmuş `trino/etc` bind mount'u yeniden
      kuruldu (tam config + rules.json), container restart edildi, örnek sorgular çalıştırılıp metrik
      toplandı. **5 dashboard da gerçek veri gösteriyor** (`local-trino` ortamı seçiliyken). Runbook:
      [`recipes/run-trino-locally.md`](recipes/run-trino-locally.md).
- (Yok) — açık ister maddesi kalmadı.

---

## 4. Kapsam Dışı / Bilinen Sınırlar

- **`/v1/cluster`** Trino'nun herkese açık bir endpoint'i değildir; cluster sayımları `/v1/query`
  durumlarından türetilir (ister 6.1 bu endpoint'i listeliyor olsa da modern Trino sunmuyor).
- **`/v1/task`** iç (internal) endpoint olduğundan erişim kısıtlı olabilir; ulaşılamazsa per-node
  task sayıları failure detector'dan (`/v1/node`) elde edilir.
- **Network throughput** (6.3.2) ister gereği "**(varsa)**"; Trino temel REST API'si bu metriği
  sunmadığından toplanmıyor.
- **Cluster-arası hata yoğunluğu** (6.2.2): her ortam = tek cluster olduğundan "cluster bazlı yoğunluk"
  ortam-geneli hata oranı (%) olarak sunulur; birden çok cluster'ı yan yana kıyaslamak çok-cluster
  modeli gerektirir (gelecek).
- **Soft-memory limit etkisi** (6.4.2): `/resource-performance` **hard-concurrency doygunluğunu**
  görselleştirir; soft-memory limiti resource-groups editöründe bar olarak gösterilir.
- **Ansible** artefaktları (deploy + verify playbook) **metin olarak üretilir**; çalıştırma operasyon
  tarafındadır (sunucu SSH ile node'lara bağlanmaz).
- Uygulama kapsamı **yalnız Projeİsterleri.txt**'tir. `docs/01`/`03`'te geçen TLS/OAuth/Kerberos/
  OPA/Ranger/secrets **istere dahil değildir** (bkz. P2/D4).

---

## 5. Bu Doküman Neyi Birleştiriyor

| Kaynak | Ne için hâlâ tutuluyor |
|--------|------------------------|
| [`UYGUNLUK-RAPORU-2026-06-30.md`](../UYGUNLUK-RAPORU-2026-06-30.md) | Bir noktadaki denetim + test kanıtlarının anlık kaydı (tarihli) |
| [`07-roadmap.md`](07-roadmap.md) | Faz faz **nasıl** geliştirildiği (mimari tarihçe) |
| [`kullanici-kilavuzu.md`](kullanici-kilavuzu.md) | Son kullanıcı için **nasıl kullanılır** (detaylı) |
| Uygulama içi **`/guide`** (sidebar → Yardım) | **İnteraktif** kılavuz: **Sayfa ↔ Dosya Eşlemesi** tablosu + her sayfada işlemlerin nasıl yapıldığı ve işlediği dosya/veri kaynağı (file/db/api), aranabilir |
| **bu dosya** | **İster uygunluğu + kalan işler için tek güncel kaynak** |

> İster durumu değiştiğinde **önce bu dosyayı** güncelleyin; kod değişikliğinden sonra ilgili
> `docs/` sayfalarını da güncel tutun ([`09-conventions.md`](09-conventions.md)).
