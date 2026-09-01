# NİZAM — Kullanıcı Kılavuzu

Bu kılavuz, NİZAM (Trino-Secure UI) uygulamasını **uçtan uca nasıl kullanacağınızı** anlatır.
Her bölüm bir göreve karşılık gelir ve ekranda adım adım ne yapacağınızı gösterir. İster
listesindeki ([`Projeİsterleri.txt`](../Projeİsterleri.txt)) madde numaraları köşeli parantez
içinde verilmiştir (ör. `[2.1]`).

> Uygulama arayüzü Türkçedir. Teknik terimler (catalog, schema, rules.json, resource-group…)
> İngilizce bırakılmıştır.

> **İpucu:** Aynı içeriğin **uygulama içi interaktif sürümü** kenar çubuğundaki **Yardım → Kullanım
> Kılavuzu** (`/guide`) altındadır — her sayfa için adımları arayıp genişletebilir, doğrudan ilgili
> ekrana geçebilirsiniz.

## İçindekiler

1. [Başlarken: giriş ve ortam seçimi](#1-başlarken)
2. [Ortam yönetimi (Test/Prod)](#2-ortam-yönetimi-52)
3. [rules.json yetkilendirme editörü](#3-rulesjson-yetkilendirme-editörü-21)
4. [resource-groups.json editörü](#4-resource-groupsjson-editörü-21)
5. [Cluster Konfigürasyonu (.properties dosyaları)](#5-cluster-konfigürasyonu-properties-dosyaları)
6. [Kullanıcı & grup eşleme (group-provider)](#6-kullanıcı--grup-eşleme-21)
7. [password.db yönetimi (bcrypt / PBKDF2)](#7-passworddb-yönetimi-21)
8. [Katalog konfigleri](#8-katalog-konfigleri-21)
9. [Cluster'a kullanıcı ekleme](#9-clustera-kullanıcı-ekleme-23)
10. [Canlı validasyon ve boot kontrolü](#10-canlı-validasyon-22)
11. [Roller, ince yetki kapsamı (RBAC)](#11-roller-ve-i̇nce-yetki-kapsamı-31--32)
12. [Audit (denetim) günlüğü](#12-audit-denetim-günlüğü-33)
13. [Sürüm geçmişi, diff ve rollback](#13-sürüm-geçmişi-diff-ve-rollback-41--42--43)
14. [Dağıtım: yayınla, drift, Ansible, tutarlılık](#14-dağıtım-51--53)
15. [Gözlemleme: dashboard'lar](#15-gözlemleme-dashboardlar-6)
16. [Hata analitiği ve query drill-down](#16-hata-analitiği-ve-drill-down-62)
17. [Alerting ve anomali](#17-alerting-ve-anomali-66)
18. [Veri toplama (collector)](#18-veri-toplama-collector-61)

---

## 1. Başlarken

1. Uygulama **http://localhost:3110** adresinde çalışır. Açtığınızda Keycloak giriş ekranına
   yönlendirilirsiniz; kullanıcı adı/şifrenizle giriş yapın (yerel geliştirmede `admin / admin`).
2. Giriş sonrası **Dashboard**'a düşersiniz: canlı sayımlar ve son denetim akışı burada görünür.
3. Sol taraftaki **kenar çubuğu** tüm alanlara erişiminizdir. Üst çubuktaki **ortam seçici** ile
   hangi Trino kurulumunu yönettiğinizi seçersiniz — yaptığınız her işlem o ortama kaydedilir.

> İlk kez açıyorsanız ve hiç rol atanmamışsa, sistem sizi geçici olarak **Platform Admin** kabul
> eder (bootstrap). İlk rolü atadığınız an gerçek yetki denetimi devreye girer.

---

## 2. Ortam yönetimi [5.2]

Her Trino kurulumu bir **ortamdır** (Test, Prod, …) ve verileri birbirinden tamamen izoledir.

**Yeni ortam eklemek:**
1. Kenar çubuğu → **Ortamlar**.
2. **Yeni ortam** → şunları doldurun:
   - **Ad**: ör. `prod` veya `test` (ad, üst çubukta renk ipucu verir: prod=kırmızı, test=amber).
   - **Dağıtım modu**: `HTTP` (Trino config'i endpoint'ten çeker — önerilen) veya `FILE` (dosyaya yazılır).
   - **Hedef (configTarget)**: HTTP modda endpoint, FILE modda `rules.json` yolu (ör. `/etc/trino/rules.json`).
   - **refresh-period** (opsiyonel): Trino'nun config'i ne sıklıkla yeniden okuduğu (ör. `1s`).
   - **trinoBaseUrl** (opsiyonel ama gözlemleme/keşif için gerekli): koordinatörün REST API adresi
     (ör. `http://coordinator:8080`).
3. **Kaydet**. Üst çubuktan bu ortama geçerek çalışmaya başlayın.

---

## 3. rules.json yetkilendirme editörü [2.1]

Kenar çubuğu → **Kurallar**. Trino'nun dosya-tabanlı erişim kontrolünü (`rules.json`) görsel
düzenlersiniz.

### Kural ekleme / düzenleme
- Her bölüm (catalog, schema, **table**, impersonation, …) için **Ekle** ile yeni kural açılır.
- Table kuralında **kullanıcı ya da grup** seçip yetkileri işaretleyin:
  **SELECT · INSERT · DELETE · UPDATE · OWNERSHIP** (ve GRANT_SELECT).
- Diğer bölümlerde alanlar (orijinal/yeni kullanıcı, allow boolean, regex'ler) drawer'da düzenlenir.

### Öncelik sıralaması (drag & drop)
- Kurallar **yukarıdan aşağı, ilk eşleşen kazanır** mantığıyla çalışır. Sıra **anlamlıdır**.
- Table kurallarını fareyle **sürükleyip bırakarak** sıralayın; üstteki kural önceliklidir.

### "Bu user/grup şunu yapabilir mi?" önizleme
- Sağ üstte **Erişim Önizleme** drawer'ını açın.
- Kullanıcı + grup(lar) + (varsa) rol ile catalog/schema/table girin; her yetki için
  **izinli/yasaklı** sonucunu, ilk-eşleşen-kazanır mantığıyla görürsünüz.

### Çakışma tespiti
- Editör, **aynı kapsamı tekrarlayan** veya **altındaki kuralları gölgeleyen catch-all** kuralları
  uyarı olarak işaretler. Uyarıları okuyup gereksiz/erişilemez kuralları temizleyin.

### Ham JSON
- **Ham JSON** sekmesinden doğrudan JSON yazıp **Uygula** ile yapıya geri dönebilirsiniz.

### Kaydetme
- **Kaydet** ile yeni bir sürüm oluşur (geçmiş + rollback için). Kaydetmeden önce **boot kontrolü**
  çalışır (bkz. §9): Trino'da ayağa kalkmayacak config'i kaydetmeyi engeller.

---

## 4. resource-groups.json editörü [2.1]

Kenar çubuğu → **Resource Groups**. Sorgu eşzamanlılık/kuyruk limitlerini yöneten
`resource-groups.json` dosyasını düzenlersiniz.

- **Ağaç görünümü**: hiyerarşi (rootGroups → subGroups) girintili gösterilir; her grubun derinliği nettir.
- **Soft memory limiti** 0–100% **grafik bar** olarak; **hard concurrency** ve **maxQueued** rozet olarak görünür.
- **Selektörler** tablosu ile sorguların hangi gruba yönlendiğini görürsünüz.
- **Ham düzenle** + validasyon ile JSON'u doğrudan yazabilir, **dışa aktar** ile dosyayı indirebilirsiniz.
- **Kaydet** her değişikliği versiyonlar (rollback edilebilir).

> İnce yetki: yalnızca belirli resource-group'larla sınırlandırılmış bir Config Editör, kapsamı
> dışındaki grupları değiştiremez (bkz. §10).

---

## 5. Cluster Konfigürasyonu (.properties dosyaları)

Kenar çubuğu → **Konfigürasyon → Cluster Konfigürasyonu** (`/properties`). Trino koordinatörünün
dört temel `.properties` dosyasını görsel olarak düzenlersiniz; kaydedilen her dosya **Dağıtım**
sayfasından cluster'a iletilir.

### Sekmeler

| Sekme | Dosya | Ne ayarlar |
|-------|-------|-----------|
| `access-control.properties` | `/etc/trino/access-control.properties` | Yetkilendirme motoru seçimi (file / allow-all / read-only / OPA / Ranger) ve `rules.json` yolu |
| `password-authenticator.properties` | `/etc/trino/password-authenticator.properties` | Kimlik doğrulama yöntemi (file / LDAP / Salesforce) ve LDAP bağlantı parametreleri |
| `resource-groups.properties` | `/etc/trino/resource-groups.properties` | Resource group yöneticisi: **file** modu (JSON dosyası) veya **db** modu (JDBC bağlantısı ile HA) |
| `group-provider.properties` | `/etc/trino/group-provider.properties` | Grup sağlayıcısı: **file** modu veya **LDAP** modu |

### Form / Ham düzenleme

- Her sekme **Form** görünümü (belgelenmiş alanlar) veya **Ham** metin düzenleyicisi (ham
  `.properties` içeriği) arasında geçiş yapabilir.
- **Ham** modda `anahtar=değer` satırları doğrudan yazılır; **Form** modda bilinmeyen anahtarlar
  `extra` olarak korunur (kayıp olmaz).

### Kaydetme ve dağıtım

- **Kaydet** düğmesi yalnızca bir alan değiştirildiğinde etkinleşir (dirty detection).
- Kaydedilen içerik `ConfigArtifact` olarak sürümlenir (geçmiş + rollback `/history`'den).
- Altta gösterilen uyarı: kaydedilen `.properties` dosyaları **Dağıtım & Drift** sayfasından
  Ansible playbook çalıştırılmadıkça cluster'a otomatik iletilmez. File modundaki
  `refresh-period` bu dosyalar için geçerli değildir — Trino'nun yeniden başlatılması gerekir.

### resource-groups.properties DB modu

- `resource-groups.configuration-manager=db` seçildiğinde `resource-groups.json` yerine Trino,
  belirtilen JDBC veritabanındaki `resource_groups_*` tablolarını okur.
- **Avantaj:** Tüm koordinatörler aynı DB'yi okuduğundan HA kurulumlarda config senkronizasyonu
  sorunsuz olur; Trino yeniden başlatmaya gerek kalmadan resource group değişiklikleri uygulanır.
- Bu dosyayı kaydetmek ve dağıtmak yeterlidir; Trino'yu yeniden başlatın.

---

## 6. Kullanıcı & grup eşleme [2.1]

Kenar çubuğu → **Eşleme** (group-provider). Trino'nun grup sağlayıcısını yönetirsiniz.

- Üstteki sekmeyle **Statik (dosya)** veya **LDAP** sağlayıcı tipini seçin.
- **Kullanıcı → grup** ilişkisi görsel tabloda listelenir.
- **Gruplar** ekranından (kenar çubuğu → Gruplar) grup oluşturup üye ekleyebilirsiniz.
- **Dışa aktar** ile statik `group-provider.txt` dosyasını indirin.

---

## 7. password.db yönetimi [2.1]

Kenar çubuğu → **Şifreler**. Trino dosya-tabanlı kimlik doğrulamasının `password.db` dosyasını yönetirsiniz.

- **Düz metin asla gösterilmez/saklanmaz** — yalnızca hash tutulur.
- **Yeni kullanıcı**: kullanıcı adı + şifre girin, **Şifreleme tipi** seçin:
  - **bcrypt** — yaygın varsayılan (`$2y$…`).
  - **PBKDF2 (HMAC-SHA256)** — FIPS/uyum gerektiren ortamlar için. Trino her iki formatı da doğrular.
  - İsterseniz aynı adımda kullanıcıyı bir **gruba** dahil edin.
- **Şifre değiştir** ve **Sil** ile kullanıcıları yönetin.
- **Dışa aktar** ile `password.db` dosyasını indirin (hash'ler sunucu tarafında kalır).
- Her değişiklik `password.db`'yi **versiyonlar** — geçmişten eski bir sürüme dönebilirsiniz (§12).

---

## 8. Katalog konfigleri [2.1]

Kenar çubuğu → **Kataloglar**. Veri kaynağı bağlantılarını (`<katalog>.properties`) yönetirsiniz.

1. **Yeni katalog** → bir **connector** seçin (PostgreSQL, MySQL, Hive, Iceberg, BigQuery, …).
2. Seçtiğiniz tipe göre **önerilen parametreler** otomatik listelenir (JDBC URL, kullanıcı, şifre, …);
   doldurun. Gerekirse **serbest key/value** çiftleri ekleyin.
3. **Kaydet** → katalog versiyonlanır. **Dışa aktar** ile `.properties` dosyasını indirin.

---

## 9. Cluster'a kullanıcı ekleme [2.3]

Tek akışta kullanıcı oluşturup gruba atamak ve tüm node'larda varlığını doğrulamak:

1. **Şifreler** → **Yeni kullanıcı**: kullanıcı adı, şifre, (opsiyonel) **grup** seçin → **Kaydet**.
   Kullanıcı hem `password.db`'ye hem seçtiğiniz gruba eklenir.
2. Kullanıcının **tüm node'larda** olduğundan emin olmak için **Dağıtım** ekranındaki
   **Cluster tutarlılık doğrulama**'yı çalıştırın (bkz. §14). FILE modunda üretilen doğrulama
   playbook'u, `password.db`'nin her node'da birebir aynı olduğunu (dolayısıyla kullanıcının her
   yerde mevcut olduğunu) SHA-256 ile kontrol eder.

---

## 10. Canlı validasyon [2.2]

- **Düzenleme sırasında**: JSON şema ve semantik validasyon çalışır; geçersiz JSON/regex anında
  hata olarak görünür.
- **Kaydetten sonra**: `rules.json` için **"Trino'da ayağa kalkar mı"** (boot) kontrolü çalışır;
  geçersiz yapı / derlenmeyen regex içeren config'in kaydını **engeller** ve nedenini gösterir.

---

## 11. Roller ve İnce Yetki Kapsamı [3.1 / 3.2]

Kenar çubuğu → **Ayarlar** (Roller & Erişim). Yalnızca **Platform Admin** rol atayabilir.

### Roller [3.1]
- **Görüntüleyici (Viewer)** — yalnız okuma/dışa aktarma.
- **Config Editör** — config dosyalarını düzenleyebilir.
- **Platform Admin** — yayınlama, token döndürme, ortam silme gibi hassas işlemler dahil her şey.

### Rol atama
1. **Kullanıcı adı**, **Rol** ve **Ortam kapsamı** (Global ya da belirli bir ortam) seçin.
2. **Ata**. Atamalar tabloda listelenir; çöp kutusuyla kaldırabilirsiniz.

### İnce kapsam (yalnızca Config Editör) [3.2]
Rol olarak **Config Editör** seçtiğinizde ek bir kutu açılır:
- **Yalnızca bu config dosyaları**: rules.json / resource-groups / group-provider / Katalog /
  password.db kutularından işaretlediklerinizle sınırlandırın. Boş bırakırsanız tüm dosyaları düzenleyebilir.
- **Yalnızca bu resource-group'lar** (virgülle): ör. `etl, adhoc.reports`. Bu kullanıcı,
  resource-groups.json içinde **yalnız bu grupları** değiştirebilir; kapsam dışı bir grubu
  değiştirmeye çalışırsa kayıt reddedilir.

Etkin kapsam, tabloda **Yetki kapsamı** sütununda rozetlerle gösterilir.

---

## 12. Audit (denetim) günlüğü [3.3]

Kenar çubuğu → **Denetim**. **Kim, neyi, ne zaman** değiştirdi.

- Tabloyu **aktör / aksiyon / varlık** ile filtreleyin.
- Bir satırın detayını açtığınızda **önceki/sonraki değerler** JSON olarak görünür. Config
  dosyaları için bu, yalnız sürüm numarası değil **gerçek dosya içeriğinin** önceki/sonraki halidir
  — değişikliği birebir görebilirsiniz.

---

## 13. Sürüm geçmişi, diff ve rollback [4.1 / 4.2 / 4.3]

Kenar çubuğu → **Geçmiş**. Versiyonlanan **tüm** config dosyaları (rules.json, resource-groups,
group-provider, **password.db**, **Katalog**) ayrı kartlar halinde listelenir.

- Her dosya için tüm sürümler (kim, ne zaman, aktif/pasif) görünür.
- **Diff**: İçe aktarma ekranında JSON satır-diff'i ve **mantıksal diff** ("privileges:
  [SELECT] → [SELECT, INSERT]") gösterilir [4.2].
- **Geri al (rollback)** [4.3]: pasif bir sürümün yanındaki **Geri al** ile o sürümü tek tıkla
  aktif edersiniz. Sistem ayrıca:
  - Satır-tabanlı dosyaları (password.db, katalog) eski içeriğe göre **yeniden oluşturur**,
  - ve değişikliği cluster'a **otomatik yeniden dağıtır** (FILE modunda dosyayı yazar; HTTP modunda
    rules.json zaten endpoint'ten servis edilir). Yayınlama Platform Admin gerektirir; yetkiniz
    yoksa sürüm yine geri alınır, dağıtımı **Yayınla**'dan elle yaparsınız.

---

## 14. Dağıtım [5.1 / 5.3]

Kenar çubuğu → **Dağıtım**.

### Drift kontrolü
- **Kontrol et** ile uygulamanın aktif `rules.json`'ı ile cluster'daki gerçek dosyayı karşılaştırın.
  FILE modunda satır-diff gösterilir; HTTP modunda otomatik senkron kabul edilir.

### Düğüm keşfi
- **Düğümleri keşfet** ile Trino REST API'sinden (`/v1/node`) cluster düğümlerini envantere alın
  (koordinatör + worker'lar, son görülme zamanıyla).

### Cluster tutarlılık doğrulama [5.3 / 2.3]
- **Doğrula** ile:
  - Her düğümün **erişilebilirliği, Trino sürümü ve environment**'ı `/v1/info` ile kontrol edilir;
    sürüm/ortam tutarsızlığı rozetle uyarılır.
  - Her yönetilen config dosyasının **SHA-256** özeti listelenir — node'lar arası eşitliğin ölçüsü.
  - Beklenen **kullanıcı kümesi** gösterilir (tüm node'lara aynı dosyayla dağıtıldığından özdeş olmalı).
  - FILE modunda **Doğrulama playbook'u** indirilebilir; her node'da dosya checksum'ını beklenen
    değerle karşılaştırıp sapan node'u bulur.

### Ansible ile dağıtım [5.1]
- **Kontrollü yeniden başlatma** kutusu açıkken `serial: 1` ile **sıralı (rolling) restart**;
  kapalıyken Trino `refresh-period` ile sıcak yükler.
- **inventory + playbook indir** ile tüm config dosyalarını her node'a kopyalayan Ansible
  artefaktlarını alın ve operasyon tarafında çalıştırın.

---

## 15. Gözlemleme: Dashboard'lar [6]

Üst sağdaki **zaman aralığı** kontrolü tüm dashboard'larda ortaktır:
- Hazır aralıklar: **15m / 1h / 24h / 7d**.
- **Özel aralık** [6.5.2]: takvim ikonuna tıklayıp **başlangıç–bitiş** seçip **Uygula**.
- **Şimdi topla** ile anlık veri çekebilirsiniz.

Dört standart dashboard [6.5.1]:
- **Cluster Sağlığı** — çalışan/kuyrukta/bloke sorgu, aktif worker, zaman serisi; ayrıca
  **koordinatör vs worker yükü** (CPU/task) ve **anlık resource-group concurrency** tablosu [6.3.1].
- **Hatalar & Failure** (bkz. §15).
- **Düğüm Sağlığı** — koordinatör CPU/heap/**non-heap**; **düğüm karşılaştırma tablosu**
  (CPU, heap, non-heap, **task sayısı**, **failed task** ve **failed oranı**) [6.3.2].
- **Resource Group Performansı** — grup başına ort. süre, **concurrency doygunluğu** (running /
  hard-concurrency limit) barı ve **limit aşımı** sayısı [6.4.2].

Ek: **Performans** sayfası ort. çalışma süresi, kuyruk bekleme, execution vs planning ve
resource-group başına ort. süreyi gösterir [6.4.1].

---

## 16. Hata analitiği ve drill-down [6.2]

Kenar çubuğu → **Hatalar**.

- **Zaman serisi** (hata sayısı) + **hata yoğunluğu (oran %)** grafiği (hata/toplam sorgu) [6.2.2];
  ayrıca **tipe / kullanıcıya / resource-group'a** göre dağılım grafikleri.
- **Filtreler** [6.5.3]: üstteki çiplerle **Hata tipi**, **Kullanıcı** ve **Grup** bazında süzün;
  filtreler URL'de saklanır ve birleşik çalışır.
- Toplanan hata tipleri [6.2.1]: USER_ERROR, INTERNAL_ERROR, INSUFFICIENT_RESOURCES, EXCEEDED_TIME_LIMIT…
- **Drill-down** [6.2.3]: "Son hatalı sorgular" tablosunda bir **Query ID**'ye tıklayın →
  **query detay sayfası** açılır: durum, kullanıcı, resource-group, hata tipi/kodu/**mesajı**,
  zamanlama (kuyruk/analiz/planlama/yürütme/toplam) ve **sorguyu çalıştıran ilgili node'lar**
  (`/v1/query/{queryId}` canlı detayından; yoksa toplanan örnekten).

---

## 17. Alerting ve anomali [6.6]

Kenar çubuğu → **Uyarılar**.

- **Yeni kural** ile:
  - **Statik eşik** [6.6.1]: metrik (genel `error_rate` veya tip bazlı `error_rate:USER_ERROR`,
    `avg_runtime_ms` …), karşılaştırıcı (>, ≥, <, ≤) ve eşik değeri.
  - **Dinamik anomali** [6.6.2]: z-score temelli; önceki pencerelere göre **anormal hata artışı**
    veya **ani performans düşüşü**. Eşik = sigma (k) hassasiyeti.
  - **Pencere** (ör. `5m`, `1h`).
- Kurallar her veri toplamasından sonra değerlendirilir; durum **FIRING ↔ RESOLVED** geçişlerinde
  uyarı geçmişine işlenir. Etkinleştirme anahtarı + canlı durum + geçmiş ekranda görünür.

---

## 18. Veri toplama (collector) [6.1]

Gözlemleme verisi Trino REST API'lerinden toplanır:
- **Manuel**: herhangi bir dashboard'da **Şimdi topla**.
- **Periyodik**: `npm run collect` (croner zamanlayıcı, varsayılan 30 sn) `POST /api/collect`'i çağırır.
  `.env` içindeki `COLLECTOR_URL`, `COLLECTOR_TOKEN`, `COLLECTOR_CRON` ile ayarlanır.

Toplanan/entegre endpoint'ler: `/v1/query`, `/v1/query/{queryId}` (drill-down), `/v1/node`
(failure detector + worker keşfi), `/v1/status` (her node için CPU/heap/non-heap), `/v1/task`
(varsa, task sayımı için), `/v1/info` (sürüm/tutarlılık). Her kaynak bağımsızdır — biri başarısız
olursa diğerleri toplanmaya devam eder.

> Not: `/v1/cluster` Trino'da herkese açık bir endpoint değildir; cluster sayımları `/v1/query`
> durumlarından türetilir. `/v1/task` iç (internal) bir endpoint olduğundan erişim kısıtlı olabilir;
> bu durumda per-node task sayıları failure detector'dan (`/v1/node`) elde edilir.
