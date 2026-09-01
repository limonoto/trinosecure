# Dağıtım & Senkronizasyon Kılavuzu

Bu kılavuz, NİZAM'da yaptığınız config değişikliklerinin Trino cluster'ına nasıl ulaştığını,
hangi ayarları yapmanız gerektiğini ve arka planda neler döndüğünü adım adım açıklar.

> **Tek cümle özet:** Uygulamada bir kural veya şifre değiştirdiğinizde bu değişiklik önce
> veritabanına kaydedilir. Asıl iş bu değişikliği Trino'nun okuduğu dosyaya taşımaktır —
> bunu nasıl yapacağınızı bu kılavuz anlatır.

---

## İçindekiler

1. [Trino neden dosya okur?](#1-trino-neden-dosya-okur)
2. [İki dağıtım modu: HTTP ve FILE](#2-i̇ki-dağıtım-modu-http-ve-file)
3. [Ortam ayarları — her alan ne anlama geliyor?](#3-ortam-ayarları)
4. [Senaryo A — Tek sunucu (local / aynı makine)](#4-senaryo-a--tek-sunucu)
5. [Senaryo B — Docker Compose cluster (test)](#5-senaryo-b--docker-compose-cluster)
6. [Senaryo C — Üretim cluster'ı (ayrı VM'ler)](#6-senaryo-c--üretim-clusteri)
7. [SSH yapılandırması — adım adım](#7-ssh-yapılandırması)
8. [Ansible runner nedir, ne yapar?](#8-ansible-runner)
9. [Dağıtım sayfası — her buton ne yapar?](#9-dağıtım-sayfası)
10. [Arka planda ne oluyor? (teknik akış)](#10-arka-planda-ne-oluyor)
11. [Sorun giderme](#11-sorun-giderme)

---

## 1. Trino neden dosya okur?

Trino, "bu kullanıcı şu tabloyu okuyabilir mi?" sorusunu cevaplamak için `/etc/trino/rules.json`
dosyasına bakar. Kullanıcı şifrelerini `/etc/trino/password.db`'den, grupları
`/etc/trino/group-provider.txt`'den, kaynak sınırlarını `resource-groups.json`'dan okur.

NİZAM bu dosyaları **görsel arayüzden yönetir** ve değiştirir. Ama Trino dosyaya baktığı için,
bir kural eklediğinizde o kuralın **dosyaya da yansıması** gerekir — aksi takdirde Trino eski
halini uygulamaya devam eder.

İşte bu "DB'deki değişikliği Trino'nun okuduğu dosyaya taşıma" işlemi, dağıtımdır.

---

## 2. İki dağıtım modu: HTTP ve FILE

Ortam oluştururken **Dağıtım modu** seçersiniz. Bu seçim, değişikliklerinizin Trino'ya nasıl
ulaşacağını belirler.

### HTTP modu (önerilen)

```
Siz kural kaydedersiniz
    → NİZAM veritabanına yazar
    → Trino her 30 saniyede bir NİZAM'a sorar: "rules.json'ın son hali nedir?"
    → NİZAM o an aktif sürümü döner
    → Trino kendi belleğini günceller
```

**Avantajı:** Hiçbir şey yapmanıza gerek yok. Kaydettiğiniz kural en geç `refresh-period`
(genellikle 30 saniye) içinde Trino tarafından uygulanır.

**Kısıtı:** Yalnızca `rules.json` için geçerlidir. `password.db`, katalog ayarları ve
`group-provider.txt` her durumda dosya olarak dağıtılmalıdır.

**Trino tarafındaki ayar** (`access-control.properties`):
```properties
access-control.name=file
security.config-file=http://nizamsunucu:3110/api/trino/ORTAM_ID?token=TOKEN
security.refresh-period=30s
```
Bu değerleri **Ortamlar** sayfasında ortamı oluşturduğunuzda sistem otomatik üretir.

---

### FILE modu

```
Siz kural kaydedersiniz
    → NİZAM veritabanına yazar
    → Siz "Yayınla" dersiniz
    → NİZAM dosyayı belirttiğiniz yola yazar
    → Trino dosyayı refresh-period sonunda okur
```

**Avantajı:** Trino'nun NİZAM'a erişemediği kapalı ağlarda çalışır.

**Kısıtı:** Dosyanın Trino'nun beklediği yola ulaşması için ek adım gerekir (aynı makine,
paylaşımlı disk veya Ansible).

**Trino tarafındaki ayar** (`access-control.properties`):
```properties
access-control.name=file
security.config-file=/etc/trino/rules.json
security.refresh-period=30s
```

---

### Hangi modu seçmeliyim?

| Durum | Öneri |
|-------|-------|
| Trino ve NİZAM aynı ağda, HTTP erişimi var | **HTTP** — en kolay |
| Trino NİZAM'a erişemiyor (kapalı ağ/air-gap) | **FILE** |
| Docker Compose'da aynı makinede çalışıyorsunuz | **FILE** (bind-mount zaten senkron tutar) |
| Üretimde ayrı VM'ler, SSH erişimi var | **FILE** + Ansible |

---

## 3. Ortam ayarları

**Kenar çubuğu → Ortamlar → Yeni ortam** (veya mevcut ortamı düzenle):

| Alan | Açıklama | Örnek |
|------|----------|-------|
| **Ad** | Ortamı tanımlayan isim. Üst çubukta görünür. | `prod`, `test`, `staging` |
| **Dağıtım modu** | HTTP veya FILE — bir üstteki bölüme bakın | `FILE` |
| **Hedef (configTarget)** | FILE modda: `rules.json`'ın tam yolu. HTTP modda: aynı değer kullanılır, sistem endpoint'i otomatik üretir. | `/etc/trino/rules.json` |
| **refresh-period** | Trino'nun config'i ne sıklıkla yeniden okuyacağı. Trino'nun `access-control.properties`'indekiyle eşleşmeli. | `30s` |
| **Trino API adresi** | Coordinator'ın REST API'sine erişim adresi. Düğüm keşfi, drift kontrolü ve metrik toplama için gerekli. | `https://coord.sirket.local:8443` |

> **Dikkat:** `configTarget` değeri, NİZAM'ın çalıştığı sunucudan erişilebilir bir yol olmalıdır.
> Trino uzak bir VM'deyse bu yol o VM'deki Trino'nun okuduğu yoldur — NİZAM bunu Ansible
> aracılığıyla oraya kopyalar.

---

## 4. Senaryo A — Tek sunucu

**Durum:** NİZAM ve Trino aynı makinede çalışıyor (geliştirme ortamı).

```
[Makine]
  ├── NİZAM (Next.js, port 3110)
  └── Trino (Docker, /etc/trino/ ← bind-mount ← /home/user/trino/etc/)
```

### Ayarlar

| Alan | Değer |
|------|-------|
| Dağıtım modu | `FILE` |
| Hedef | `/home/user/trino/etc/rules.json` (bind-mount'taki host yolu) |
| Trino API adresi | `http://localhost:8085` |

### Ne yapmanız gerekiyor?

Yalnızca ortamı bu ayarlarla oluşturun. Başka hiçbir şey gerekmez.

Bir kural kaydettiğinizde ve **Yayınla**'ya bastığınızda, NİZAM dosyayı doğrudan o yola yazar.
Docker bind-mount sayesinde Trino container'ı değişikliği anında görür ve `refresh-period`
sonunda (ör. 5 saniye) uygular.

**Ansible gerekmez. SSH gerekmez.**

---

## 5. Senaryo B — Docker Compose cluster (test)

**Durum:** Tek makine üzerinde Docker Compose ile 1 coordinator + 2 worker çalışıyor.

```
[Makine]
  ├── NİZAM (port 3110)
  └── Docker Compose
        ├── trino-coordinator   ← ./shared/rules.json bind-mount'la bağlı
        ├── trino-worker-1      ← ./shared/catalog/ bind-mount'la bağlı
        └── trino-worker-2      ← ./shared/catalog/ bind-mount'la bağlı
```

### Neden sadece coordinator'da rules.json var?

Worker'lar yetkilendirme kararı vermez. Bir sorgu geldiğinde coordinator erişim kontrolünü
uygular; worker'lar yalnızca sorgu parçalarını çalıştırır. Bu yüzden:

- `rules.json`, `password.db`, `resource-groups.json`, `group-provider.txt` → **sadece coordinator**
- `catalog/*.properties` → **coordinator + tüm worker'lar**

### Ayarlar

| Alan | Değer |
|------|-------|
| Dağıtım modu | `FILE` |
| Hedef | `/home/user/cluster-trino/shared/rules.json` |
| Trino API adresi | `https://localhost:8090` |

### Ne yapmanız gerekiyor?

Senaryo A ile aynı. Bind-mount her şeyi halleder. Kuralı kaydedin, Yayınla'ya basın, bitti.

**Ansible gerekmez.**

---

## 6. Senaryo C — Üretim cluster'ı (ayrı VM'ler)

**Durum:** Coordinator ve worker'lar farklı sunucularda. Paylaşımlı disk yok.

```
[NİZAM Sunucusu]          [Coordinator VM]          [Worker-1 VM]     [Worker-2 VM]
     NİZAM          →SSH→  /etc/trino/rules.json   /etc/trino/catalog/ /etc/trino/catalog/
  (port 3110)              /etc/trino/password.db
                           /etc/trino/group-provider.txt
                           /etc/trino/resource-groups.json
                           /etc/trino/catalog/
```

Dosyaları uzak sunuculara kopyalamak için **Ansible** kullanılır. NİZAM bunu otomatik yapar —
siz sadece SSH bilgilerini bir kez tanımlarsınız.

### Gereksinimler

**NİZAM sunucusunda:**
- `ansible-runner` Docker servisi çalışıyor olmalı:
  ```bash
  docker compose up -d ansible-runner
  ```

**Trino sunucularında (coordinator + worker'lar):**
- SSH servisi açık
- Ansible için bir kullanıcı mevcut (genellikle `ansible`)
- Bu kullanıcının `sudo` yetkisi var:
  ```
  ansible ALL=(ALL) NOPASSWD: ALL
  ```
  veya en azından:
  ```
  ansible ALL=(ALL) NOPASSWD: /bin/cp, /bin/systemctl restart trino
  ```
- Trino `systemd` servisi olarak kurulu (restart seçeneği için)

### Ayarlar

| Alan | Değer |
|------|-------|
| Dağıtım modu | `FILE` |
| Hedef | `/etc/trino/rules.json` |
| Trino API adresi | `https://coordinator.sirket.local:8443` |

### Ne yapmanız gerekiyor?

1. Ortamı oluşturun (yukarıdaki ayarlar).
2. **Düğümleri keşfet** ile coordinator ve worker'ları envantere alın.
3. SSH bilgilerini tanımlayın (aşağıdaki bölüm).
4. **Dağıtımı Çalıştır** ile her şey otomatik olarak tüm sunuculara kopyalanır.

---

## 7. SSH yapılandırması

SSH yapılandırması **Dağıtım** sayfasındaki **SSH Yapılandırması** bölümünden yapılır.
Bu bilgiler şifreli olarak veritabanında saklanır — ekranda asla düz metin göstermez.

### Adımlar

1. **Kenar çubuğu → Dağıtım** sayfasını açın.
2. **SSH Yapılandırması** kartını genişletin (sağ köşedeki oka tıklayın).
3. Şu alanları doldurun:

| Alan | Açıklama |
|------|----------|
| **SSH Kullanıcı Adı** | Trino sunucularına bağlanacak kullanıcı. Varsayılan: `ansible` |
| **SSH Şifresi** | Şifreyle bağlanıyorsanız. Boş bırakırsanız var olan korunur. |
| **PEM Özel Anahtar** | Anahtar dosyasıyla bağlanıyorsanız. `-----BEGIN RSA PRIVATE KEY-----` ile başlar. |

4. **Kaydet**'e tıklayın.

> **Şifre mi, anahtar mı?** İkisini aynı anda girebilirsiniz. Anahtar varsa Ansible onu tercih eder.
> Üretimde anahtar kullanmanız önerilir — şifreler "expire" olabilir veya policy ile devre dışı bırakılabilir.

### Arka planda ne oluyor?

Kaydet'e bastığınızda:
1. Şifre veya özel anahtar **AES-256-GCM** ile şifrelenir (256-bit anahtar, `ENCRYPTION_KEY` env var).
2. Şifreli değer veritabanına yazılır.
3. Ekranda yalnızca "Şifre mevcut ✓" veya "Özel anahtar mevcut ✓" görünür — düz metin hiçbir
   zaman arayüze geri gönderilmez.
4. Dağıtım sırasında şifre RAM'de çözülür, ansible-runner'a HTTPS üzerinden gönderilir,
   runner bunu kullanır ve hemen siler. Hiçbir log'a yazılmaz.

---

## 8. Ansible runner

**Ansible runner**, arka planda çalışan küçük bir servistir. Trino sunucularına SSH bağlantısı
kurarak dosya kopyalama ve servis yönetimini yapar.

```
Siz "Dağıtımı Çalıştır"a basarsınız
    ↓
NİZAM tüm config dosyalarını hazırlar (rules.json, password.db, ...)
    ↓
NİZAM, Ansible runner'a şunu söyler:
  "Bu dosyaları, şu envanter (host listesi) ile, şu SSH bilgisiyle kopyala"
    ↓
Ansible runner, her sunucuya SSH ile bağlanır
    ↓
Dosyaları /etc/trino/ dizinine kopyalar
    ↓
(Seçtiyseniz) Trino servisini birden fazla sunucuda sırayla yeniden başlatır
    ↓
Sonuç (başarılı/başarısız + tam log) NİZAM'a döner
    ↓
Ekranda log görüntülenir, geçmişe kaydedilir
```

### Ansible runner çalışıyor mu?

Dağıtım sayfasının üst kartında şu badge'i görmelisiniz:

- 🟢 **Erişilebilir** — hazır, dağıtım yapabilirsiniz
- 🔴 **Erişilemiyor** — servis başlatılmamış

Erişilemiyorsa:
```bash
cd /path/to/trinosecure
docker compose up -d ansible-runner
```

---

## 9. Dağıtım sayfası

**Kenar çubuğu → Dağıtım**

### Drift kontrolü

Uygulamanın aktif sürümü ile Trino'nun okuduğu gerçek dosyayı karşılaştırır.

- **FILE modunda:** Dosya okunur, satır-satır diff gösterilir. Fark varsa kırmızı/yeşil satırlar görünür.
- **HTTP modunda:** Trino endpoint'ten okuduğu için her zaman senkron kabul edilir.

**Ne zaman kullanın?** Bir şeylerin "uygulansa da Trino'ya yansımadığı" şüphesi olduğunda.

### Düğümleri keşfet

Trino REST API'sini (`/v1/node`) sorgulayarak cluster'daki tüm node'ları (coordinator + worker'lar)
veritabanına kaydeder.

**Ne zaman kullanın?**
- Ortamı ilk kurduğunuzda.
- Cluster'a yeni worker eklendiğinde.
- Node'ların listesini güncellemek istediğinizde.

**Arka planda:** Coordinator'ın `/v1/node` endpoint'ine istek atılır. Dönen her node URL'si
veritabanına kaydedilir (son görülme zamanıyla). Bu liste Ansible'ın hedef envanteri olur.

### Cluster tutarlılık doğrulama

Her node'un sağlık durumunu ve config dosyalarının senkronluğunu kontrol eder.

- **Erişilebilirlik:** Her node'a `/v1/info` isteği atılır. Yanıt veremeyen node "erişilemeyen"
  olarak işaretlenir.
- **Sürüm tutarlılığı:** Tüm node'lar aynı Trino sürümünü mü çalıştırıyor? Farklıysa uyarı verilir.
- **SHA-256 özetleri:** Her yönetilen dosya (rules.json, password.db, ...) için beklenen SHA-256
  özeti hesaplanır ve listelenir. Ansible doğrulama playbook'u bu özetleri her node'da kontrol eder.

### Ansible ile otomatik dağıtım

**Kontrollü yeniden başlatma (rolling restart):**

- **Kapalı (varsayılan):** Dosyalar kopyalanır, Trino `refresh-period` sonunda kendi kendine
  yeniden okur. **Kesinti yok.** Ancak değişiklik hemen değil, `refresh-period` (ör. 30 saniye)
  sonra aktif olur.
- **Açık:** Dosyalar kopyalanır; ardından Trino her node'da **sırayla** yeniden başlatılır
  (`serial: 1`). Bir node başlatılıp ayağa kalkana kadar bir sonrakine geçilmez.
  **Kısa kesinti olur** (o node geçici olarak devre dışı) ama değişiklik anında aktif olur.

**Dağıtımı Çalıştır:**

Tüm config dosyalarını keşfedilmiş her node'a otomatik olarak kopyalar. Ekranda canlı log
açılır, işlem bittiğinde **Başarılı** veya **Başarısız** gösterilir.

**Doğrulamayı Çalıştır** (FILE modunda görünür):

Dağıtımın gerçekten her node'a ulaştığını doğrular. Her sunucuda beklenen SHA-256 özetiyle
karşılaştırır; farklı olan node'u raporlar. Dağıtımdan sonra çalıştırmanız önerilir.

**Artifact İndir:**

inventory.ini + deploy-trino.yml dosyalarını bilgisayarınıza indirir. Ansible'ı kendiniz
çalıştırmak veya CI/CD pipeline'ınıza entegre etmek isteyenler için.

### Dağıtım geçmişi

Son 20 dağıtım kaydı listelenir: tip (Dağıtım/Doğrulama), durum, tarih, süre.
Bir kaydın yanındaki **Log** butonuna basarak Ansible çıktısının tamamını görebilirsiniz.

---

## 10. Arka planda ne oluyor?

### Kural kaydettiğinizde

```
1. Tarayıcı → NİZAM: "Bu kuralları kaydet"
2. NİZAM: Validasyon (JSON şema + boot kontrolü — bu config Trino'yu başlatır mı?)
3. Hata varsa → kayıt engellenir, neden gösterilir
4. Hata yoksa → veritabanına yeni ConfigVersion yazılır (versiyonlama)
5. HTTP modunda → bir sonraki Trino polinginde yeni sürüm dönecek (otomatik)
6. FILE modunda → "Yayınla" beklenecek
```

### Yayınla'ya bastığınızda (FILE modu)

```
1. NİZAM aktif sürümü veritabanından okur
2. configTarget yoluna writeFile() ile yazar
3. Dosya artık Trino'nun beklediği yerde
4. Trino refresh-period sonunda dosyayı yeniden okur ve uygular
```

### "Dağıtımı Çalıştır"a bastığınızda (Ansible)

```
1. Veritabanından aktif SSH kimlik bilgisi alınır (AES-256-GCM ile çözülür)
2. Tüm yönetilen dosyalar render edilir:
   - rules.json → aktif kural versiyonu
   - password.db → PasswordEntry tablosundan formatlanır (bcrypt/PBKDF2 hash'ler)
   - group-provider.txt → AppGroup tablosundan formatlanır
   - resource-groups.json → aktif versiyon
   - catalog/*.properties → CatalogConfig tablosundan formatlanır
3. TrinoNode tablosundan host listesi alınır; URL'lerden hostname'ler çıkarılır
4. Ansible inventory dosyası oluşturulur (hostname listesi + SSH değişkenleri)
5. Ansible playbook dosyası oluşturulur (her dosya için copy görevi)
6. Her şey ansible-runner servisine HTTP ile gönderilir
7. ansible-runner:
   a. Geçici bir dizin oluşturur
   b. Dosyaları files/ klasörüne yazar
   c. SSH özel anahtarını geçici dosyaya yazar (izin: 0600)
   d. inventory.ini ve playbook.yml dosyalarını yazar
   e. ansible-playbook -i inventory.ini playbook.yml çalıştırır
   f. Ansible her host'a sırayla SSH bağlantısı kurar
   g. Dosyaları /etc/trino/ altına kopyalar
   h. (restart=true ise) Trino servisini yeniden başlatır
   i. Geçici dizin silinir
8. Sonuç (stdout + stderr + çıkış kodu) NİZAM'a döner
9. DeploymentRun tablosuna kaydedilir (tip, durum, log, süre)
10. Ekranda log gösterilir
```

### "Düğümleri keşfet"e bastığınızda

```
1. trinoBaseUrl/v1/node endpoint'ine istek atılır
2. Dönen her node için:
   - URL'den nodeId çıkarılır
   - Coordinator (trinoBaseUrl ile aynı) olarak işaretlenir
   - Worker'lar type=WORKER olarak kaydedilir
3. TrinoNode tablosuna upsert (yeni ise ekle, var ise lastSeen güncelle)
4. Denetim logu yazılır
```

### "Doğrulamayı Çalıştır"a bastığınızda

```
1. Tüm yönetilen dosyalar render edilir
2. Her dosya için SHA-256 özeti hesaplanır
3. Ansible verify playbook'u oluşturulur:
   Her dosya için: "Bu node'da bu dosyanın SHA-256'sı beklenen değer mi?"
4. Playbook ansible-runner'a gönderilir ve çalıştırılır
5. Herhangi bir node'da özetin farklı olması halinde Ansible "FAILED" döner
6. Sonuç loglanır ve gösterilir
```

---

## 11. Sorun giderme

### "ansible-runner servisi erişilemiyor"

```bash
# Servisi başlatın
docker compose up -d ansible-runner

# Logları kontrol edin
docker logs trino-secure-ansible-runner
```

### "SSH kimlik bilgisi tanımlı değil"

Dağıtım sayfası → SSH Yapılandırması bölümünü genişletin ve kaydedin.

### Dağıtım çalışıyor ama Ansible başarısız oluyor

Log modalındaki çıktıya bakın. En yaygın nedenler:

| Hata | Neden | Çözüm |
|------|-------|-------|
| `Permission denied (publickey,password)` | SSH anahtarı yanlış veya kullanıcı yok | Kullanıcı adını ve anahtarı doğrulayın |
| `sudo: a terminal is required` | Sudo şifre istiyor | NOPASSWD ekleyin: `ansible ALL=(ALL) NOPASSWD: ALL` |
| `Could not resolve hostname` | Hostname çözülemiyor | IP adresi kullanın veya DNS'i kontrol edin |
| `[Errno 111] Connection refused` | SSH kapalı veya yanlış port | `sshd` servisini kontrol edin |
| `Timeout exceeded` | Sunucu yavaş veya ulaşılamıyor | `trinoBaseUrl`'yi ve ağ bağlantısını kontrol edin |

### Drift kontrolü "sapma var" diyor ama dağıtım yaptım

Trino `refresh-period` bekleniyor olabilir. `refresh-period` kadar (ör. 30 saniye) bekleyip
tekrar kontrol edin. Hâlâ farklıysa dosya yazma iznini kontrol edin.

### "Düğüm envanteri boş"

Trino API adresini (trinoBaseUrl) ortam ayarlarında tanımladıktan sonra **Düğümleri keşfet**
butonuna basın. API adresine Trino servis kullanıcısıyla (`.env`'de `TRINO_SERVICE_USER`)
erişildiğinden bu kullanıcının credential'larının doğru olduğundan emin olun.

---

## Hızlı başlangıç özeti

**Yerel geliştirme:**
```
Ortam oluştur (FILE, configTarget=bind-mount yolu) → Kural kaydet → Yayınla → Bitti
```

**Test cluster (Docker Compose):**
```
Ortam oluştur (FILE, configTarget=shared/ yolu) → Düğümleri keşfet → Kural kaydet → Yayınla → Bitti
```

**Üretim (ayrı VM'ler):**
```
docker compose up -d ansible-runner
→ Ortam oluştur (FILE, configTarget=/etc/trino/rules.json)
→ Düğümleri keşfet
→ SSH Yapılandırması → kaydet
→ Kural değiştir → kaydet
→ Dağıtımı Çalıştır
→ Doğrulamayı Çalıştır (her node'da SHA-256 onayı)
```
