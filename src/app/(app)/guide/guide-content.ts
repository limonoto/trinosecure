/**
 * In-app interactive user guide content (Turkish). Each entry maps to an app page
 * and explains, step by step, what operations you can do there — surfaced at /guide.
 * Requirement numbers from Projeİsterleri.txt are noted in `req`.
 */

/**
 * A data source a page reads from or writes to.
 * - `file`  → a managed Trino config file on disk (name is the real file name).
 * - `db`    → a table in the app's own database (backup/audit/metadata layer).
 * - `api`   → live data pulled from the Trino REST API (read-only).
 */
export type DataSourceKind = "file" | "db" | "api";

export type DataSource = {
  kind: DataSourceKind;
  /** File name (for `file`) or human-readable source name (for `db`/`api`). */
  name: string;
  /** Short Turkish phrase: what this page does with the source. */
  op: string;
};

export type GuideSection = {
  id: string;
  title: string;
  href: string;
  group: string;
  req?: string;
  summary: string;
  /** The file(s) / data source(s) this page operates on, and how. */
  sources: DataSource[];
  steps: string[];
  tips?: string[];
};

export const GUIDE_GROUPS = [
  "Başlangıç",
  "Yetkilendirme",
  "Kimlik & Erişim",
  "Konfigürasyon",
  "Gözlemleme",
  "Yönetişim",
  "Ayarlar",
] as const;

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "dashboard",
    title: "Panel (Dashboard)",
    href: "/",
    group: "Başlangıç",
    summary: "Aktif ortamın canlı özeti: kural/grup/sürüm/düğüm sayıları ve son denetim etkinliği.",
    sources: [
      { kind: "db", name: "Uygulama DB", op: "Özet sayımlar ve son etkinlik okunur (salt-okunur)" },
      { kind: "api", name: "Trino API", op: "Canlı düğüm sayısı okunur" },
    ],
    steps: [
      "Üst çubuktaki ortam seçiciden hangi Trino kurulumunu yönettiğinizi seçin.",
      "Kartlardan hızlı sayımları, alttan son etkinlik akışını görün.",
    ],
    tips: ["Hiç rol atanmadıysa sistem sizi geçici olarak Platform Admin kabul eder; ilk rol atanınca gerçek yetki devreye girer."],
  },
  {
    id: "environments",
    title: "Ortamlar",
    href: "/environments",
    group: "Ayarlar",
    req: "5.2",
    summary: "Her Trino kurulumu bir ortamdır (Test/Prod). Verileri tamamen izoledir.",
    sources: [
      { kind: "db", name: "Environment tablosu", op: "Ortam oluştur/düzenle; hedef = rules.json yolu veya HTTP endpoint" },
    ],
    steps: [
      "“Yeni ortam” → Ad (ör. prod/test), Dağıtım modu (HTTP veya FILE), Hedef (endpoint ya da rules.json yolu).",
      "Opsiyonel: refresh-period ve trinoBaseUrl (gözlemleme/keşif için gerekli).",
      "Kaydet → üst çubuktan bu ortama geçin.",
    ],
  },
  {
    id: "rules",
    title: "Kurallar (rules.json)",
    href: "/rules",
    group: "Yetkilendirme",
    req: "2.1",
    summary: "rules.json yetkilendirmesini görsel düzenleyin: öncelik, önizleme, çakışma, yetkiler.",
    sources: [
      { kind: "file", name: "rules.json", op: "Kuralları görsel oluştur/düzenle, önceliklendir, önizle, kaydet (her kayıt yeni sürüm)" },
    ],
    steps: [
      "Bir bölümde (table, catalog, …) “Ekle” ile kural açın; table kuralında user/grup + SELECT/INSERT/DELETE/UPDATE/OWNERSHIP seçin.",
      "Table kurallarını sürükleyip bırakarak önceliklendirin (ilk eşleşen kazanır).",
      "Sağ üstteki “Erişim Önizleme” ile bir user/grubun bir aksiyonu yapıp yapamayacağını test edin.",
      "Editör, çakışan/gölgeleyen kuralları uyarır. “Kaydet” yeni sürüm oluşturur.",
    ],
    tips: ["Kaydetmeden önce boot kontrolü çalışır: Trino’da ayağa kalkmayacak config’i engeller."],
  },
  {
    id: "import",
    title: "İçe Aktar & Fark",
    href: "/import",
    group: "Yetkilendirme",
    req: "4.2",
    summary: "Mevcut bir rules.json’ı içe aktarın; satır-diff ve mantıksal diff ile karşılaştırın.",
    sources: [
      { kind: "file", name: "rules.json", op: "Dışarıdan gelen dosyayı içe aktar; satır & mantıksal diff; onayla → yeni sürüm" },
    ],
    steps: [
      "Dosya içeriğini yapıştırın/yükleyin.",
      "JSON satır-diff’i ve mantıksal diff’i (ör. privileges: [SELECT] → [SELECT, INSERT]) inceleyin.",
      "Onaylayıp içe aktarın.",
    ],
  },
  {
    id: "history",
    title: "Sürüm Geçmişi",
    href: "/history",
    group: "Yetkilendirme",
    req: "4.1 / 4.3",
    summary: "Tüm config dosyalarının (rules, resource-groups, group-provider, password.db, katalog) sürümleri.",
    sources: [
      { kind: "file", name: "rules.json", op: "Sürümleri gör; pasif sürüme geri al (rollback) + otomatik yeniden dağıt" },
      { kind: "file", name: "resource-groups.json", op: "Sürümleri gör; geri al" },
      { kind: "file", name: "group-provider.txt", op: "Sürümleri gör; geri al" },
      { kind: "file", name: "password.db", op: "Sürümleri gör; geri al (tablo yeniden oluşturulur)" },
      { kind: "file", name: "<katalog>.properties", op: "Sürümleri gör; geri al (tablo yeniden oluşturulur)" },
    ],
    steps: [
      "Her dosya kartında sürümleri (kim, ne zaman, aktif/pasif) görün.",
      "Pasif bir sürümde “Geri al” → o sürüm aktif olur, satır-tabanlı dosyalar yeniden oluşturulur ve cluster’a otomatik yeniden dağıtılır.",
    ],
    tips: ["Otomatik yayın Platform Admin gerektirir; yetkiniz yoksa sürüm yine geri alınır, dağıtımı Yayınla’dan elle yaparsınız."],
  },
  {
    id: "groups",
    title: "Gruplar",
    href: "/groups",
    group: "Kimlik & Erişim",
    req: "2.1",
    summary: "Uygulama içi grupları ve üyelerini yönetin (rules.json’daki group eşleşmelerinin temeli).",
    sources: [
      { kind: "db", name: "Group / GroupMember", op: "Grup ve üye oluştur/düzenle — group-provider.txt ve rules.json grup adlarının kaynağı" },
    ],
    steps: ["“Yeni grup” ile grup oluşturun.", "Grubun “Üyeler” ekranından kullanıcı ekleyin/çıkarın."],
  },
  {
    id: "mapping",
    title: "Kullanıcı Eşleme (group-provider)",
    href: "/mapping",
    group: "Kimlik & Erişim",
    req: "2.1",
    summary: "Trino grup sağlayıcısı: statik (dosya) veya LDAP; kullanıcı→grup tablosu.",
    sources: [
      { kind: "file", name: "group-provider.txt", op: "Kullanıcı→grup satırlarını düzenle; dışa aktar (statik dosya modu)" },
      { kind: "file", name: "group-provider.properties", op: "Sağlayıcı tipini (file/ldap) ve ayarlarını tanımlar" },
    ],
    steps: [
      "Sekmeden Statik (dosya) veya LDAP tipini seçin.",
      "Kullanıcı→grup ilişkisini tabloda görün.",
      "“Dışa aktar” ile group-provider.txt indirin.",
    ],
  },
  {
    id: "passwords",
    title: "Şifre Kullanıcıları (password.db)",
    href: "/passwords",
    group: "Kimlik & Erişim",
    req: "2.1 / 2.3",
    summary: "password.db kullanıcılarını yönetin — düz metin asla saklanmaz.",
    sources: [
      { kind: "file", name: "password.db", op: "Kullanıcı ekle/sil, şifre değiştir (bcrypt/PBKDF2); dışa aktar; her değişiklik versiyonlanır" },
    ],
    steps: [
      "“Yeni kullanıcı” → kullanıcı adı + şifre, şifreleme tipi (bcrypt veya PBKDF2), opsiyonel grup.",
      "“Şifre değiştir” ve “Sil” ile yönetin. “Dışa aktar” ile password.db indirin.",
    ],
    tips: ["Trino password.db hem bcrypt hem PBKDF2 (HMAC-SHA256) formatını doğrular.", "Her değişiklik password.db’yi versiyonlar — Geçmiş’ten geri alınabilir."],
  },
  {
    id: "resource-groups",
    title: "Resource Groups",
    href: "/resource-groups",
    group: "Konfigürasyon",
    req: "2.1",
    summary: "resource-groups.json ağaç görünümü; soft/hard limitler grafik olarak.",
    sources: [
      { kind: "file", name: "resource-groups.json", op: "Grup hiyerarşisini ağaçta gör; ham JSON düzenle; kaydet (boot kontrolü)" },
    ],
    steps: [
      "Ağaçta hiyerarşiyi (rootGroups → subGroups) ve her grubun soft-memory barı + concurrency/queue rozetlerini görün.",
      "“Ham düzenle” ile JSON’u değiştirip Kaydet. Kaydetmede boot kontrolü çalışır.",
    ],
  },
  {
    id: "catalogs",
    title: "Kataloglar",
    href: "/catalogs",
    group: "Konfigürasyon",
    req: "2.1",
    summary: "Veri kaynağı bağlantıları (<katalog>.properties); tipe göre önerilen parametreler.",
    sources: [
      { kind: "file", name: "<katalog>.properties", op: "Katalog başına bağlantı dosyası oluştur/düzenle; dışa aktar; versiyonlanır" },
    ],
    steps: [
      "“Yeni katalog” → connector seçin (PostgreSQL, Hive, Iceberg, …).",
      "Önerilen parametreleri (JDBC URL, kullanıcı, şifre) doldurun; gerekirse serbest key/value ekleyin.",
      "Kaydet → versiyonlanır. “Dışa aktar” ile .properties indirin.",
    ],
  },
  {
    id: "metrics",
    title: "Cluster Sağlığı",
    href: "/metrics",
    group: "Gözlemleme",
    req: "6.3.1",
    summary: "Çalışan/kuyrukta/bloke sorgu, koordinatör vs worker yükü, resource-group concurrency.",
    sources: [
      { kind: "api", name: "Trino REST API", op: "/v1/query, /v1/jmx’ten canlı metrik toplanır" },
      { kind: "db", name: "Metric (collector)", op: "Toplanan metrikler saklanır; zaman serisi buradan çizilir" },
    ],
    steps: [
      "Zaman aralığını seçin (15m/1h/24h/7d veya özel from/to).",
      "Sorgu yükü zaman serisini, koordinatör vs worker CPU/task kartlarını ve anlık RG concurrency tablosunu inceleyin.",
      "“Şimdi topla” ile anlık veri çekin.",
    ],
  },
  {
    id: "errors",
    title: "Hatalar & Failure",
    href: "/errors",
    group: "Gözlemleme",
    req: "6.2",
    summary: "Hata sayısı + hata yoğunluğu (oran), tip/kullanıcı/grup dağılımı ve query drill-down.",
    sources: [
      { kind: "api", name: "Trino REST API", op: "/v1/query’den başarısız sorgular okunur" },
      { kind: "db", name: "Metric (collector)", op: "Hata metrikleri/oranları saklanır ve filtrelenir" },
    ],
    steps: [
      "Üstteki çiplerle Hata tipi / Kullanıcı / Grup filtreleyin (birleşik).",
      "Hata oranı (%) grafiğiyle cluster genel hata yoğunluğunu görün.",
      "“Son hatalı sorgular” tablosunda bir Query ID’ye tıklayın → detay + ilgili node’lar.",
    ],
  },
  {
    id: "nodes",
    title: "Düğüm Sağlığı",
    href: "/nodes",
    group: "Gözlemleme",
    req: "6.3.2",
    summary: "Per-worker CPU/heap/non-heap + task sayısı/failed oranı; karşılaştırma tablosu.",
    sources: [
      { kind: "api", name: "Trino REST API", op: "/v1/node, /v1/jmx’ten düğüm başına metrik okunur" },
      { kind: "db", name: "Metric (collector)", op: "Düğüm metrikleri saklanır ve karşılaştırılır" },
    ],
    steps: [
      "CPU ve heap zaman serilerini inceleyin.",
      "“Düğüm karşılaştırması” tablosunda her node’un CPU/heap/non-heap/task/failed oranını görün.",
    ],
  },
  {
    id: "performance",
    title: "Performans",
    href: "/performance",
    group: "Gözlemleme",
    req: "6.4.1",
    summary: "Ortalama çalışma süresi, kuyruk bekleme, execution vs planning; RG başına süre.",
    sources: [
      { kind: "api", name: "Trino REST API", op: "/v1/query’den sorgu süreleri okunur" },
      { kind: "db", name: "Metric (collector)", op: "Süre/kuyruk metrikleri saklanır ve çizilir" },
    ],
    steps: ["Zaman aralığını seçin.", "Ortalama süre zaman serisini ve resource-group başına ortalama süreyi inceleyin."],
  },
  {
    id: "resource-performance",
    title: "Resource Group Performansı",
    href: "/resource-performance",
    group: "Gözlemleme",
    req: "6.4.2 / 6.5.1",
    summary: "Grup başına ort. süre, concurrency doygunluğu (running/hard limit) ve limit aşımları.",
    sources: [
      { kind: "api", name: "Trino REST API", op: "Resource-group durumları okunur" },
      { kind: "db", name: "Metric (collector)", op: "RG concurrency/doygunluk metrikleri saklanır" },
      { kind: "file", name: "resource-groups.json", op: "Hard-limit eşikleri buradan okunur (doygunluk hesabı)" },
    ],
    steps: [
      "Grup metrikleri tablosunda doygunluk barını (%) ve limit aşımı sayısını görün.",
      "Yüksek doygunluk (kırmızı) = grup hard-concurrency limitine yaklaşıyor demektir.",
    ],
  },
  {
    id: "alerts",
    title: "Alarmlar",
    href: "/alerts",
    group: "Yönetişim",
    req: "6.6",
    summary: "Statik eşik ve dinamik (z-score) anomali alarm kuralları.",
    sources: [
      { kind: "db", name: "AlertRule / AlertEvent", op: "Alarm kuralları tanımla; FIRING/RESOLVED geçmişi buraya yazılır" },
    ],
    steps: [
      "“Yeni kural” → Statik eşik (metrik + karşılaştırıcı + eşik) veya Dinamik anomali (sigma hassasiyeti).",
      "Pencere seçin (ör. 5m). Kural her toplamadan sonra değerlendirilir; FIRING↔RESOLVED geçişleri geçmişe işlenir.",
    ],
  },
  {
    id: "audit",
    title: "Denetim Günlüğü",
    href: "/audit",
    group: "Yönetişim",
    req: "3.3",
    summary: "Kim, neyi, ne zaman değiştirdi — önceki/sonraki değerlerle.",
    sources: [
      { kind: "db", name: "AuditLog", op: "Tüm config değişikliklerini önceki/sonraki içerikle okur (salt-okunur görünüm)" },
    ],
    steps: [
      "Tabloyu aktör/aksiyon/varlık ile filtreleyin.",
      "Bir satırın detayında önceki/sonraki içeriği (config dosyalarında gerçek içerik) görün.",
    ],
  },
  {
    id: "deploy",
    title: "Dağıtım & Drift",
    href: "/deploy",
    group: "Ayarlar",
    req: "5.1 / 5.3",
    summary: "Drift kontrolü, düğüm keşfi, cluster tutarlılık doğrulama ve Ansible dağıtım.",
    sources: [
      { kind: "file", name: "rules.json + tüm config dosyaları", op: "Aktif sürümleri cluster’a dağıt; SHA-256 ile drift/tutarlılık karşılaştır" },
      { kind: "file", name: "inventory.ini / playbook.yml", op: "Ansible envanter + playbook üretilir (indirilebilir çıktı)" },
      { kind: "api", name: "Trino API (/v1/node)", op: "Düğüm envanteri keşfedilir" },
    ],
    steps: [
      "“Kontrol et” ile aktif rules.json’ı cluster’daki dosyayla karşılaştırın (drift).",
      "“Düğümleri keşfet” ile /v1/node’dan node envanterini çekin.",
      "“Doğrula” ile her node’un erişim/sürüm/environment’ını ve her dosyanın SHA-256’sını kontrol edin; FILE modunda doğrulama playbook’u indirin.",
      "“inventory + playbook indir” ile Ansible dağıtımını üretin (kontrollü rolling restart opsiyonu).",
    ],
  },
  {
    id: "settings",
    title: "Roller & Erişim",
    href: "/settings",
    group: "Ayarlar",
    req: "3.1 / 3.2",
    summary: "RBAC rolleri (Viewer/Config Editör/Platform Admin) ve ince yetki kapsamı.",
    sources: [
      { kind: "db", name: "RoleAssignment", op: "Kullanıcıya rol + ortam kapsamı ata; Config Editör için config-dosyası bazında ince kapsam" },
    ],
    steps: [
      "Kullanıcı adı + Rol + Ortam kapsamı (Global/belirli ortam) seçip “Ata”.",
      "Config Editör için opsiyonel ince kapsam: yalnızca belirli config dosyaları ve/veya resource-group’lar.",
    ],
    tips: ["Yalnızca Platform Admin rol atayabilir. İnce kapsam boşsa Config Editör tüm dosyaları düzenleyebilir."],
  },
];

/** Turkish labels + short descriptions for each data-source kind. */
export const SOURCE_KIND_META: Record<DataSourceKind, { label: string; hint: string }> = {
  file: { label: "Config dosyası", hint: "Trino’nun disk üzerindeki güvenlik dosyası" },
  db: { label: "Uygulama DB", hint: "Uygulamanın kendi veritabanı (yedek/denetim/metadata)" },
  api: { label: "Trino API", hint: "Trino REST API’den canlı, salt-okunur veri" },
};

/**
 * Page ↔ file mapping: only the pages that read/write a managed Trino config
 * file, flattened to one row per (page, file). Powers the mapping table in the
 * guide so it stays in sync with the per-page `sources` above.
 */
export type FileMapRow = { file: string; title: string; href: string; op: string };

export const FILE_PAGE_MAP: FileMapRow[] = GUIDE_SECTIONS.flatMap((s) =>
  s.sources
    .filter((src) => src.kind === "file")
    .map((src) => ({ file: src.name, title: s.title, href: s.href, op: src.op })),
);
