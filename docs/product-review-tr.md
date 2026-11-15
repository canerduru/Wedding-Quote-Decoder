# Wedding Quote Decoder — Ürün, UX ve Ticarileştirme İncelemesi

Tarih: 2026-11-15 · Kapsam: `main` @ `8e340ed` · Kodda değişiklik yapılmadı.

> Varsayımlar: (1) Gerçek arayüz `index.html` içindeki Alpine.js uygulamasıdır. `src/App.tsx` boş, `src/main.tsx` hiçbir yerden yüklenmiyor. React iskeleti AI Studio şablonundan kalmış görünüyor. (2) `gemini-4-hydrogen` ve `gemini-3.1-flash-lite` model adlarının AI Studio ortamında geçerli olduğunu varsaydım, doğrulamadım. (3) `.env` okunmadı. Sadece `.env.example` incelendi.

---

## FAZ 1 — Projeyi Anlamak

### 1.1 Kullanıcı akışı (girdi → işleme → çıktı)

1. **Girdi:** Kullanıcı bir veya daha fazla dosyayı (PNG/JPEG/WEBP/PDF) hero alanındaki dropzone'a bırakır. Bu dosyalar WhatsApp ekran görüntüsü ya da mekan PDF'i olabilir. Alternatif olarak boş "manuel kart" da açılabilir.
2. **Okuma:** Tarayıcı dosyayı base64'e çevirir ve `POST /api/decode-quote` ile sunucuya gönderir. Birden fazla dosya varsa **sırayla** işlenir ve her dosya için durum gösterilir: sırada / okunuyor / tamam / hata.
3. **AI çözümleme:** Sunucu dosyayı ve uzun bir "lüks düğün finans denetçisi" prompt'unu Gemini'ye yollar. `responseSchema` ile şu JSON alınır:
   - `docCategory`: `venue` ya da `vendor_addon`
   - `name` ve `nameFound`, bölge, mekan tipi, kapasite (TR/EN)
   - `baseFeeEur` (kira) ve `fbPerPersonEur` (kişi başı yemek). **EUR'a çevirme işini model yapar**: 1 € = 38,5 ₺, 1,08 $, 0,85 £.
   - `flags[]`: kategori (tax/catering/music/floral/boat/photo/other), tür (risk/safe), etiket ve açıklama (TR/EN), hesap tipi (`fixed`/`per_guest`/`vat_pct`), tutar ve aktiflik
4. **Yönlendirme:**
   - `venue` gelirse yeni bir karşılaştırma kartı açılır ve arka planda gerçek mekan fotoğrafı aranır.
   - `vendor_addon` gelirse ve `targetVenueHint` tek bir kartla eşleşirse hizmet o karta eklenir. Eşleşme yoksa "Hangi mekana eklensin?" çubuğu çıkar: tek mekana ekle / hizmeti eksik olanlara ekle / tümüne ekle / ayrı kart aç.
   - Gerçek bir hizmet teklifi eklendiğinde karttaki aynı kategorideki tahmini kalem anahtar kelime eşleşmesiyle pasife alınır.
5. **Çıktı:** Her kart şunları gösterir:
   - Kira, kişi başı yemek ve seçili ekler
   - **Anahtar teslim toplam** ve kişi başı net tutar
   - En ucuz karta göre fark ve "En Avantajlı" rozeti
   - Maliyet dağılım çubuğu
   - Kategori sırasına hizalanmış ek kalemler
   - Kartlar üstünde misafir sayısı sliderı (5–300) ve EUR/TRY anahtarı bulunur.
6. **Paylaşım:** "Ortak Özet" modalı düz metin özeti kopyalar ve yazdırma/PDF çıktısı verir.

### 1.2 Teknoloji ve mimari

| Katman | Durum |
|---|---|
| Frontend | Tek dosya `index.html` (~2.700 satır). Alpine.js 3.14.8 (jsDelivr), Tailwind **CDN** (`cdn.tailwindcss.com`), Lucide **`@latest`** (unpkg). TR/EN sözlüğü ile birlikte gelir. |
| Kullanılmayan iskelet | React 19, `motion`, `@tailwindcss/vite`, `src/App.tsx` (boş). `package.json` adı hâlâ `react-example`. |
| Backend | `server.ts`: Express. Dev'de Vite middleware, prod'da `dist` statik sunumu. |
| Endpoint'ler | `POST /api/decode-quote`, `POST /api/find-venue-photo`, `GET /api/venue-photo?url=` (görsel proxy'si), `GET /health` |
| AI | `@google/genai`. Model sırası: `gemini-4-hydrogen` ×2, sonra `gemini-3.1-flash-lite` ×2. 503/429 hatasında artan bekleme ile yeniden dener. Fotoğraf için Google Search grounding kullanılır. |
| Fotoğraf | Önce Wikipedia (EN/TR) ve Commons aranır. Bulunamazsa Gemini ile resmi site bulunur ve `og:image`/JSON-LD'den görsel çekilir. Sunucu proxy'si SSRF korumalıdır. Önbellek 30 dk ve en fazla 200 kayıttır. |
| Durum (state) | Tamamen tarayıcı belleğinde. **Kalıcılık yok**: sayfa yenilenince her şey kaybolur. |
| Deploy | AI Studio → Cloud Run (europe-west3). Anahtar AI Studio Secrets ile gelir. |

### 1.3 Ekranlar ve bileşenler

| Bölüm | Gösterdiği veri |
|---|---|
| Header | Marka, "Teklif Yükle" ve "Karşılaştırma" çapaları (sadece masaüstü), "Ortak Özet" butonu |
| Hero + dropzone | Başlık, TR/EN seçici, çoklu dosya alanı, "boş kart ekle", "tümünü temizle" |
| OCR kuyruğu | Dosya bazında durum, hatalılar için "tekrar dene / manuel kart" |
| Vendor atama çubuğu | Okunan ek hizmet ve tahmini tutarı, atama seçenekleri |
| Equalizer bar | Misafir sliderı, para birimi, sabit referans kur, aktif mekan sayısı |
| Boş durum rehberi | 3 adımlı açıklama: Akıllı ayrıştırma / Adlandır & birleştir / Çifte sayımı önle |
| Mekan kartı | Kapak (gerçek foto / teklif görseli / stok "atmosfer"), ad, bölge, kapasite, düzenleme modu, birleştirme, kira, kişi başı yemek, dağılım çubuğu, toplam, fark, kategori hizalı kalemler (aç/kapa, sil, ekle), karta ek teklif bırakma alanı |
| Özet modalı | Mekan başına kira, yemek toplamı, ekler/KDV, toplam, kişi başı. Kopyala ve yazdır. |
| Toast | Tüm geri bildirimler. `aria-live` tanımlı. |

### 1.4 Teknik zayıf noktalar

**Hesaplama hataları (kodda doğrulandı):**

| # | Sorun | Yer | Etki |
|---|---|---|---|
| H1 | **Çift KDV** (mekanda "KDV hariç" kalemi aktifse). Karta eklenen dış hizmet kalemleri (`fixed`/`per_guest`) mekan KDV'sinin matrahına giriyor. Aynı hizmetin kendi KDV'si de ayrıca `vendor_vat_pct` olarak ekleniyor. | `index.html:769-788` | Ek hizmetli kartlarda toplam şişer. Karşılaştırma yanlış sonuç verir. |
| H2 | **Yüzdeler birbirinin üstüne binmiyor.** Servis bedeli (%10–25) ayrı bir hesap tipi olarak yok. Model bunu `vat_pct` olarak işaretlerse tüm yüzdeler aynı matraha uygulanır. Gerçekte KDV, servis bedeli dahil tutar üzerinden hesaplanır. | `calculateBreakdown` | Toplam düşük çıkar. |
| H3 | **Boş kart "En Avantajlı" görünüyor.** Toplamı 0 olan manuel kart en düşük toplam sayılıyor. | `index.html:826-839` | Yanıltıcı rozet çıkar, diğer kartlardaki farklar anlamsızlaşır. |
| H4 | **Kur dönüşümü LLM'de ve sabit.** Kurlar 38,5 / 1,08 / 0,85 olarak prompt'ta ve UI'da sabit yazılı. Modelin bölme işlemi de hata yapabilir. | `server.ts:569, 670-674`, `index.html:495` | Kur tarihi geçmiş olabilir. TRY tekliflerde sapma oluşur. |
| H5 | **Minimum harcama, depozito, ödeme takvimi, iptal ve teklif geçerlilik tarihi şemada yok.** | `quoteResponseSchema` | En sık sürpriz yaratan kalemler gözden kaçar. |

**Güvenlik ve dayanıklılık:**

- **Kimlik doğrulama ve rate limit yok.** Cloud Run URL'si herkese açık. Linki bulan herkes Gemini kotanı harcayabilir. Bu ilk "ürünleşme" riski.
- **`/api/venue-photo` açık bir görsel proxy'si.** SSRF filtresi iyi ama iki açık var:
  - DNS kontrolü ile `fetch` ayrı çözümleme yapıyor. DNS rebinding ile bu kontrol atlatılabilir (TOCTOU).
  - Endpoint herhangi bir site için ücretsiz bant genişliği olarak kötüye kullanılabilir.
- **Ham hata mesajları istemciye dönüyor** (`server.ts:742, 756`). Bu iç bilgi sızıntısıdır ve kullanıcı için de anlamsızdır.
- **Dosya boyutu tutarsız.** UI "Maks. 20 MB" diyor ama istemcide kontrol yok. Sunucu JSON limiti 25 MB, base64 ise boyutu ~%33 büyütüyor. Bu yüzden ~18,7 MB üstü dosyalar 413 alıyor. Gelen HTML hata sayfası `resp.json()` çağrısını patlatıyor ve kullanıcı genel bir hata görüyor.
- **`mimeType` sunucuda doğrulanmıyor.** Model `responseSchema` ile kısıtlı olduğu için risk düşük. Ama istemciden gelen değer doğrudan Gemini'ye gidiyor.
- **Prompt injection (düşük risk).** `fileName` prompt'a gömülü. Belge içeriğinde talimat olabilir. Çıktı şemayla sınırlı ama sayıları manipüle edebilir.
- **Tedarik zinciri.** `lucide@latest` sabitlenmemiş. Tailwind Play CDN üretim için önerilmiyor. İkisi de kırılma ve güvenlik riski taşıyor.
- **Gizlilik metni yok.** Finansal teklifler Google'a gidiyor. Kullanıcıya bununla ilgili hiçbir açıklama yapılmıyor.

**Diğer:**

- **Kalıcılık yok.** Yenileme, sekme kapatma ya da telefonun sekmeyi öldürmesi tüm veriyi siler. Kişisel kullanımda bile en büyük acı nokta bu.
- **Dosyalar sırayla işleniyor.** 6 dosya × ~10 sn yaklaşık 1 dakika bekleme demek.
- **Önizlemeler belleğe base64 olarak yazılıyor.** Çok görselde mobil bellek baskısı oluşur.
- **2.700 satırlık tek HTML dosyası.** Bakım, test ve tip güvenliği yok. Test hiç yok.
- **Mobil:**
  - Navigasyon `md` altında gizli. Kartlar mobilde alt alta diziliyor, yan yana karşılaştırma imkânsız.
  - Slider 5–300 aralığında. Türkiye'de 300+ davetli yaygın ([karekod](https://www.karekod.org/blog/dugun-salonu-fiyatlari/) 300 kişiyi referans alıyor).
- **Erişilebilirlik:**
  - Rozetlerde emoji var (ekran okuyucu "çiçek emojisi" diye okur).
  - Risk/güvenli ayrımı ağırlıkla renge dayanıyor.
  - Toplam 20 `aria-*` özelliği var.

### 1.5 Mevcut UX: dürüst değerlendirme

**İyi olanlar:**

- Editoryal ve sakin bir görsel dil: Cormorant + Jakarta, şampanya/inci tonları.
- Kategori hizalama fikri güçlü: aynı satırda "KDV", "Müzik" gibi kalemler kartlar arasında karşılaştırılabiliyor.
- Vendor eklentisi ve yer değiştirme mantığı rakiplerde olmayan bir şey.
- Kartlar düzenlenebilir. AI hata yaparsa düzeltme yolu var.

**Kafa karıştıranlar:**

- **Jargon:** "Atölye", "Anahtar Teslim", "F&B", "Hiza Grubu", "Equalizer", "vat_pct" mantığı. Ortalama bir çift "F&B" ya da "Hiza Grubu" demez.
- **"Mekan mı ek hizmet mi?" ayrımı görünmüyor.** Kullanıcı dosyayı bıraktıktan sonra neden bir çubuk çıktığını anlamıyor.
- **AI çıktısının güvenilirliği belli değil.** Hangi rakam belgeden okundu, hangisi tahmin ya da kur çevirisi, ayırt edilemiyor. Rakamın belgedeki yerine bağlantı yok.
- **"Mekan Atmosferi" stok fotoğrafları gerçek mekanmış gibi görünüyor.** Wikipedia araması da yanlış yeri bulabilir.
- **Tek uzun sayfa.** Adım göstergesi yok, kullanıcı nerede olduğunu bilmiyor.

**Eksik olanlar:**

- Kaydetme ve geri alma (kart silme geri alınamıyor)
- "Mekana sorulacak sorular" ve pazarlık ipuçları
- Kırmızı bayrak özeti (en önemli 3 risk)
- Gerçek bir yan yana tablo görünümü
- Toplam düğün bütçesi bağlamı (mekan bütçenin yüzde kaçı?)
- Ödeme takvimi
- Teklif geçerlilik ve opsiyon tarihi

---

## FAZ 2 — Pazar ve Kullanıcı Araştırması

> Not: Reddit ve App Store yorumlarına doğrudan erişemedim. Bulgular rehber, inceleme ve agregatör sitelerinden geliyor. Bazı kaynaklar rakip pazarlamasıdır, ilgili yerde belirttim.

### 2.1 Rakipler ve komşu ürünler

| Ürün | Odak | Bütçe / teklif özelliği | Zayıf yön | Fırsat |
|---|---|---|---|---|
| **The Knot / WeddingWire** (2019'da birleşti) | ABD pazar yeri + planlama | Tahmine dayalı bütçe, gerçek ödeme defteri değil | Satıcı spam'i, ücretli "önerilen" satıcılar, upsell | Tarafsız ve reklamsız analiz |
| **Zola** | Kayıt listesi, web sitesi, planlama | Tahmini ve gerçekleşen takibi, sözleşme yükleme | Bütçe hâlâ tahmin odaklı (rakip iddiası) | Teklifin içini okuyan derin analiz |
| **Joy** | Ücretsiz site ve RSVP | Bütçe ve satıcı yönetimi zayıf | — | — |
| **Bridebook** (UK) | Tedarikçi kataloğu, checklist, bütçe | Hitched'tan detaylı bütçe hesaplayıcı | Masa planı yok | UK/AB'de KDV ve servis farkı bilinci yüksek |
| **Hitched** (UK) | Hepsi bir arada | Temel bütçe | Misafir yönetimine erişim zor | — |
| **Aisle Planner / HoneyBook** | **Profesyonel planlamacı** CRM'i | Teklif ve fatura **gönderme** | Çift tarafına hitap etmiyor | B2B kanal: planlamacıya "müşteri teklifi analiz" aracı |
| **VowMath** (ücretsiz web) | **Doğrudan rakip:** 3 mekan teklifini karşılaştırma | Manuel giriş, "doğrulanmadı" durumu, minimum harcama, servis ve vergi matrahı seçimi, CSV ve PDF | AI ve yükleme yok, sadece USD | Onların manuel modelini AI ile otomatikleştirmek |
| **Wedding Co-Pilot** | AI planlama | Yapıştırılan tekliften ad, fiyat, depozito ve iletişim çıkarımı | Yüzeysel ayrıştırma, gizli maliyet analizi yok | Derinlik ve TR dili |
| **Düğün.com** (2007, 14 ülke) | TR pazar yeri, teklif talebi | Teklif akışı firma tarafında. Bütçe aracı bulunamadı. | Firma uygulaması 2,6★ | TR'de çift tarafında boş alan |
| **Excel / Gumroad şablonları** | Manuel karşılaştırma | Satır bazlı normalizasyon | Zahmetli | "Excel eziyeti bitsin" mesajı doğru konumlanmış |

### 2.2 Çiftlerin sevdikleri ve şikâyet ettikleri

| Sevilen | Şikâyet edilen |
|---|---|
| Tek yerde checklist, bütçe ve misafir listesi | **Satıcı spam'i:** tek talep, onlarca satıcıdan dönüş |
| Ücretsiz başlama | **Tarafsızlık şüphesi:** üstte duran satıcılar parayla orada |
| Detaylı bütçe kategorileri | Güncellemeden sonra **bütçe kalemlerinin sıfırlanması veya kopyalanması** (veri kaybı korkusu) |
| Temiz ve sakin tasarım | Upsell baskısı, gizli kayıt listesi ücretleri |
| | Küçük şehirlerde satıcı bulamamak |

**Çıkarım:** Güven, **tarafsızlık** ve **veri kaybetmemek** üzerine kurulu. Bu iki konu ürünün ana vaadi olmalı.

### 2.3 Çiftler teklifi nasıl karşılaştırıyor? Ne sürpriz yaratıyor?

- **Bakılanlar:** Toplam fiyat, kişi başı tutar, kapasite, tarih müsaitliği, neyin dahil olduğu, iptal politikası, yağmur planı.
- **En sık sürprizler:**

| Kalem | Tipik değer / not | Kaynak |
|---|---|---|
| KDV / VAT | UK'de +%20 "bütçeyi bir anda aşar". Bazı mekanlar kiraya dahil eder, bazıları etmez. | Coco, Bridebook |
| Servis bedeli | UK'de kira üzerinden %10–15. ABD'de yemek ve içecek üzerinden %18–25. Genelde ilk teklifte yazmaz. | Coco, Budget Savvy Bride |
| Servisin matrahı ve vergilenmesi | Yüzde hangi ara toplama uygulanıyor? Servis bedeline vergi var mı? | Budget & Bouquet, VowMath |
| Minimum harcama / minimum paket | TR salonları düşük davetlide de minimum paket uygular. Bodrum'da lüks oteller €50–80 bin minimum harcama ister. | karekod, Wedding Spots Turkey |
| Uzatma, mantar parası (corkage), pasta kesme, temizlik | Sonradan eklenir | Coco, Bridebook |
| Kır düğünü: jeneratör, sahne, ses, LED, yağmur planı | Her biri ayrı fiyatlanır | karekod, NTV |
| Fiyat sabitleme | TR'de çiftler enflasyona karşı fiyatı sözleşmeyle sabitlemeye çalışıyor | Posta |

- **Güven ve güvensizlik:**
  - Güveni artıran: Her rakamın kaynağının görünmesi, "doğrulanmadı" durumunun açıkça işaretlenmesi (VowMath'in yaklaşımı), reklam olmaması.
  - Güveni azaltan: Satıcı yönlendirmesi, verinin nereye gittiğinin belirsiz olması.

### 2.4 Beklenen ekranlar ve etkileşimler

- **Onboarding:** 2–3 soru yeterli: tarih / şehir, davetli sayısı, toplam bütçe. Bunun ötesi terk ettirir.
- **Bütçe paneli:** Hedef ve gerçek karşılaştırması. Kategori başına halka veya çubuk. "Ne kadar kaldı?"
- **Karşılaştırma tablosu:** Satırlar standart kalemler, sütunlar mekanlar. Eksik bilgi "?" ile gösterilir.
- **Checklist:** Mekana sorulacak sorular ([Guides for Brides'ın 50 sorusu](https://guidesforbrides.co.uk/wedding-ideas/50-questions-to-ask-your-wedding-venues-before-booking) tipi).
- **Paylaşım:** Partner veya aile ile link, ya da WhatsApp'a uygun özet. TR'de aile kararı belirleyici.
- **Ses tonu:** Sakin, "birlikte çözelim" diyen, suçlamayan bir dil. "Gizli maliyet" yerine "teklifte yazmayan kalemler" gibi.

### 2.5 Görsel trendler (2026)

- **Renk:** Blush/sage tek başına artık yetmiyor. Mocha Mousse, terracotta, koyu yeşil, lavanta + sage + krem ve opalesan tonlar öne çıkıyor.
- **Tipografi:** Editoryal ve moda markası tarzı büyük serif başlıklar, katmanlı serif'ler. Tipografi çiçeklerden önce "konuşuyor".
- **Düzen:** Dergi tarzı yerleşim. Düğün sitesi bir "planlama merkezi"ne dönüşüyor. Mobil uyum zorunlu.
- **Mevcut uygulamayla uyum:** Projenin Cormorant + şampanya paleti trendle uyumlu. Eksik olan, **veri okunabilirliği** için ikinci bir disiplin: tabular rakamlar, net hiyerarşi.

### 2.6 Türkiye ve uluslararası pazar farkları

| Boyut | Türkiye | Uluslararası / destinasyon |
|---|---|---|
| Para birimi | TRY. Yüksek enflasyon nedeniyle teklifler hızla eskiyor. Lüks segment ve otel tekliflerinde EUR yaygın (varsayım). | EUR (İtalya, Yunanistan, Bodrum'a gelen yabancılar), GBP, USD |
| Fiyat yapısı | Kişi başı menü + minimum paket. Salon "yemekli / yemeksiz". KDV dahil/hariç karışık. | Kira (gecelik buyout) + kişi başı yemek + servis % + VAT/IVA. Villa Balbiano gecelik €10–13 bin, en az 2 gece, yemek hariç. |
| Teklif kanalı | **WhatsApp ekran görüntüsü, sesli mesaj**, kısa PDF | E-posta PDF'i, uzun sözleşmeler |
| Pazarlık | Çok yaygın. Tarih, gün ve sezona göre indirim. Fiyat sabitleme talebi. | Daha az pazarlık. Paket ve sezon farkı daha belirgin. |
| Davetli sayısı | 200–500+ yaygın | 40–150 (destinasyon) |
| Karar verici | Aile katılımı yüksek | Çift + planlamacı |
| Fiyat seviyesi | Toplam düğün 500 bin – 1 milyon TL+ (kaynaklar tutarsız). 300 kişilik yemekli düğün 180–750 bin TL. | Bodrum'da €30–50 bin (Santorini'ye göre ucuz), Como'da €70–150 bin+ |

**Çıkarım:**
- TR için WhatsApp girişi, TRY ve enflasyon farkındalığı, pazarlık ipuçları ve aileyle paylaşım kritik.
- Uluslararası pazar için çok para birimi, servis yüzdesi, minimum harcama ve çok gecelik buyout desteği gerekli.

---

## FAZ 3 — Tasarım ve UX Önerileri

Efor ölçeği: **S** < 1 gün, **M** 2–5 gün, **L** > 1 hafta.

### 3.1 Öncelik listesi

#### MUST

| # | Sorun | Öneri | Etki | Efor |
|---|---|---|---|---|
| M1 | Hesaplama hataları H1–H3 | Vendor kalemlerini mekan KDV matrahından çıkar. Servis bedelini ayrı tip yap (`service_pct`) ve sırayı netleştir: ara toplam → servis → KDV. Toplamı 0 olan kartları "en avantajlı" hesabından çıkar. Her biri için test yaz. | Ürünün tek vaadi "doğru toplam". Hata varken güven sıfırlanır. | S |
| M2 | Yenilemede veri kaybı | Kişisel kullanım için `localStorage` otomatik kayıt + JSON yedek indir/yükle. Üründe sunucu tarafı kayıt (bkz. Faz 4). | En büyük kişisel acı noktası. Rakiplerdeki "veri sıfırlandı" şikâyetine cevap. | S |
| M3 | Açık API: kota yakma riski, ham hatalar | IP başına rate limit, istemcide boyut kontrolü (≤15 MB), sunucuda MIME beyaz listesi, kullanıcıya sade hata, ayrıntı sadece log'da. Fotoğraf proxy'sini sadece kendi bulduğu URL'lerle sınırla (imzalı token). | Maliyet ve güvenlik | S |
| M4 | Kur LLM'de ve sabit | Model sadece **orijinal para birimi ve tutarı** döndürsün, çeviri kodda yapılsın. Kur düzenlenebilir olsun ve tarihi gösterilsin (ileride TCMB/ECB'den otomatik). | Doğruluk ve şeffaflık | M |
| M5 | Kritik alanlar şemada yok (H5) | Şemaya ekle: `minimumSpend`, `deposit`, `paymentSchedule`, `cancellationPolicy`, `quoteValidUntil`, `overtimeFee`, `corkage`, `serviceChargePct`, `confidence` ve kalem başına `sourceQuote`. | Gerçek sürprizleri yakalar | M |
| M6 | AI çıktısına güvenilmiyor | Her rakamın yanında kaynak etiketi: "Belgeden" / "Tahmin" / "Belirtilmemiş". Rakama tıklayınca belgedeki alıntı görünsün. Düşük güvende sarı "Kontrol et" rozeti. | Güvenin temeli | M |
| M7 | Mobilde karşılaştırma imkânsız | Mobilde "tablo modu": mekan başlıkları sabit, yatay kaydırmalı sütunlar ya da iki mekanı seçip yan yana karşılaştırma. | Kullanıcıların çoğu telefonda (WhatsApp'tan geliyor) | M |
| M8 | Gizlilik belirsiz | Dropzone altında tek satır: "Teklifler sadece analiz için Google Gemini'ye gönderilir, saklanmaz." Gizlilik sayfası. Fotoğraf aramasını kapatma seçeneği. | Finansal veri hassasiyeti | S |

#### SHOULD

| # | Sorun | Öneri | Etki | Efor |
|---|---|---|---|---|
| S1 | Jargon | Kopya temizliği: "Anahtar Teslim" yerine "Gerçek Toplam", "F&B" yerine "Yemek & İçecek", "Hiza Grubu" yerine "Kategori", "Atölye" kaldırılsın. | Anlaşılırlık | S |
| S2 | Tek uzun sayfa, adım yok | 3 adımlı akış: **Yükle → Kontrol Et → Karşılaştır**. Üstte ilerleme göstergesi. | Yön duygusu | M |
| S3 | Karar desteği yok | Kart başına **"Kırmızı bayraklar" kutusu** (en fazla 3) ve **"Mekana sorulacak sorular"** listesi. Kopyalanıp WhatsApp'tan gönderilebilsin. | Rakiplerde olmayan değer | M |
| S4 | Pazarlık desteği yok | AI'dan teklif bazlı 2–3 **pazarlık ipucu**: hafta içi/sezon dışı tarih, minimum paketi düşürme, servis bedelini kiraya gömme. TR'de çok değerli. | Duygusal ve maddi kazanç | S |
| S5 | Stok fotoğraf yanıltıcı | Stok görsellerde "Temsili görsel" etiketi. Gerçek fotoğrafta kaynak linki görünür olsun. | Dürüstlük | S |
| S6 | Davetli aralığı dar | Slider 10–1000 + sayı girişi. TR varsayılanı 250, EN varsayılanı 100. | TR uyumu | S |
| S7 | Sıralı işleme yavaş | 2–3 paralel istek + kart iskeleti (skeleton) ve tahmini süre | Bekleme algısı | S |
| S8 | Geri alma yok | Silmede 5 sn'lik "Geri al" toast'u | Kaza önleme | S |
| S9 | Erişilebilirlik | Emoji yerine Lucide ikon + `aria-label`. Risk/güvenli ayrımı için ikon + metin. Kontrast (stone #6E6562 on pearl ≈ 5,5:1, sınırda ama geçer). Klavye ile slider. Odak halkaları. | WCAG AA | M |
| S10 | Teknik borç | Alpine tek dosyayı React + TS'ye (iskelet zaten var) ya da modüler Alpine'e taşı. Tailwind'i Vite eklentisiyle derle. Lucide'i sabitle. Hesaplamayı saf fonksiyona çıkar ve test yaz. | Ürünleşmenin ön şartı | L |

#### NICE-TO-HAVE

| # | Öneri | Efor |
|---|---|---|
| N1 | Toplam düğün bütçesi paneli (mekan, fotoğraf, gelinlik… hedef ve gerçek) | M |
| N2 | Ödeme takvimi zaman çizelgesi ve hatırlatma (depozito, ara ödeme) | M |
| N3 | Paylaşılabilir salt-okunur link (partner, aile, planlamacı) | M |
| N4 | Koyu mod | S |
| N5 | Sesli mesaj veya yapıştırılmış metin girişi (WhatsApp'tan kopyala-yapıştır) | S |
| N6 | Bölgesel fiyat referansı ("Bu kişi başı fiyat Bodrum ortalamasının %20 üstünde"). Veri biriktikçe açılır. | L |
| N7 | Teklif sürüm geçmişi (mekan revize teklif gönderdiğinde fark göster) | M |

### 3.2 Bilgi mimarisi ve navigasyon

```
Ana sayfa (pazarlama)
└─ Uygulama
   ├─ Düğünüm         (tarih, şehir, davetli, hedef bütçe, kur)
   ├─ Teklifler       (yükle + liste; durum: okunuyor / kontrol et / hazır)
   ├─ Karşılaştır     (tablo ⇄ kart görünümü)
   ├─ Bütçe           (N1)
   └─ Paylaş / Dışa aktar
```

- Mobil: Alt sekme çubuğunda 4 öğe (Teklifler, Karşılaştır, Bütçe, Daha fazla). Ana eylem için sabit "+" butonu.
- Masaüstü: Sol dar menü ya da mevcut üst bar + sekmeler.

### 3.3 Görsel kimlik

| Öğe | Öneri |
|---|---|
| Palet (açık) | Zemin `#FCFAF8` (inci), yüzey `#FFFFFF`, metin `#1E1A1C`, ikincil metin `#6E6562`, vurgu **şampanya** `#B8956A` (biraz koyulaştırıldı, kontrast için), ikinci vurgu **adaçayı** `#7C8B74` (trend uyumu) |
| Anlamsal renkler | Risk: yumuşak bordo `#9F1239` / `#FFF1F2`. Güvenli: koyu adaçayı `#3F6B4E` / `#EEF5EF`. Belirsiz: kehribar `#B45309` / `#FFFBEB`. Renk hiçbir zaman tek başına anlam taşımasın, yanında ikon ve metin olsun. |
| Palet (koyu) | Zemin `#161214`, yüzey `#211B1E`, metin `#F3EDE8`, şampanya `#D4B78F` |
| Tipografi | Başlık: Cormorant Garamond 500–600 (sadece başlıklar ve büyük toplamlar). Gövde ve veri: Plus Jakarta Sans + `tabular-nums`. Ölçek: 12 / 14 / 16 / 20 / 28 / 40. Mobilde gövde en az 16 px. |
| Boşluk | 4 px tabanlı ölçek (4–8–12–16–24–32–48). Kart iç boşluğu 20/24. |
| İkonografi | Lucide (sabit sürüm), 1,5 px çizgi. Emoji yok. Kategori ikonları: `receipt` vergi, `utensils` yemek, `music` müzik, `flower-2` çiçek, `ship` tekne, `camera` fotoğraf. |
| Görsel | Gerçek mekan fotoğrafı ya da tipografik kapak. Stok görsel kullanılıyorsa "temsili" etiketi. |

### 3.4 Ana ekranların yeniden tasarımı

**a) Karşılama / onboarding (3 soru)**
```
┌─────────────────────────────────┐
│  Tekliflerinizi birlikte okuyalım│  ← Cormorant 32
│  Gerçek toplamı, yazmayan        │
│  kalemleri ve sorulacakları      │
│  bir dakikada görün.             │
│                                  │
│  Düğün tarihi    [ Haz 2027  ▾ ] │
│  Şehir           [ Bodrum      ] │
│  Davetli         [ 250 ] − +     │
│  Para birimi     (TRY) (EUR)     │
│                                  │
│  [   Teklif yüklemeye geç   ]    │
│  Atla →                          │
│  🔒 Teklifler saklanmaz…          │  ← ikon, emoji değil
└─────────────────────────────────┘
```

**b) Teklif girişi**
```
┌─────────────────────────────────┐
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐    │
│    Ekran görüntüsü veya PDF       │
│    bırakın · ya da metni          │
│    yapıştırın                     │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘    │
│  [Dosya seç] [Kamera] [Yapıştır]  │
│                                   │
│  Okunuyor (2/4) ▓▓▓▓░░  ~20 sn    │
│  ✓ Villa A — mekan                │
│  ✓ Çiçekçi B — ek hizmet → Villa A│
│  … Otel C                         │
│  ! Foto D — okunamadı [Tekrar]    │
└─────────────────────────────────┘
```

**c) Çözümlenmiş sonuç (tek teklif, "Kontrol et" adımı)**
```
┌──────────────────────────────────┐
│ Villa A · Bodrum         [Belge ↗]│
│                                   │
│ GERÇEK TOPLAM (250 kişi)          │
│ €48.200          €193 / kişi      │  ← en büyük öğe
│ Teklifte görünen: €39.500 (+%22)  │  ← "fark" vurgusu
│                                   │
│ ⚠ Dikkat edilecek 3 şey           │
│  • KDV hariç (+%20)    Belgeden   │
│  • Servis %10          Belgeden   │
│  • Min. harcama yazmıyor  Sor     │
│                                   │
│ Kalemler                          │
│  Kira            €12.000  Belgeden│
│  Yemek €95×250   €23.750  Belgeden│
│  Servis %10       €3.575  Belgeden│
│  KDV %20          €7.865  Belgeden│
│  Müzik / DJ      tahmini   [?]    │
│                                   │
│ Sorulacaklar (kopyala)            │
│ Pazarlık ipuçları (2)             │
│ [Düzenle]           [Onayla ✓]    │
└──────────────────────────────────┘
```

**d) Karşılaştırma (masaüstü tablo, mobilde sabit ilk sütun + yatay kaydırma)**
```
                 Villa A   Otel B    Salon C
Gerçek toplam    €48.200   €44.900✓  €51.300
Kişi başı        €193      €180      €205
───────────────────────────────────────────
Kira             €12.000   dahil     €8.000
Yemek            €23.750   €30.000   €32.500
Servis           %10       dahil     %12
KDV              hariç     dahil     hariç
Müzik            ?         €2.500    dahil
Min. harcama     ?         €40.000   —
İptal            ?         60 gün    90 gün
───────────────────────────────────────────
Açık soru        3         0         1
```
- "?" hücreleri kehribar renkte, tıklanınca o mekan için "sorulacak soru" ekler.
- "En avantajlı" sadece eksik bilgisi olmayan kartlar arasında hesaplanır. Aksi halde "Eksik bilgi var" uyarısı çıkar.

**e) Bütçe özeti**
- Hedef bütçe halkası, kategori çubukları (mekan, foto, gelinlik…), "seçilen mekan bütçenin %X'i".

**f) Kayıtlı teklifler**
- Liste: mekan adı, tarih, toplam, durum (Taslak / Kontrol edildi / Seçildi / Elendi), "teklif geçerlilik: 5 gün kaldı" rozeti.

### 3.5 Mobil öncelikli davranış ve durumlar

- **Giriş:** Kamera ile fotoğraf çek, paylaşım menüsünden al (PWA share target). WhatsApp'tan doğrudan "Paylaş → Decoder" akışı en büyük kazanım.
- **Mikro etkileşimler:**
  - Toplam değişince sayı yumuşakça sayarak değişir (≤300 ms).
  - Kalem açılıp kapanırken satır kısa süre vurgulanır.
  - `prefers-reduced-motion` desteklenir.
- **Durumlar:**

| Durum | Gösterilen |
|---|---|
| Boş | Tek cümle + örnek teklifle dene butonu (demo veri) |
| Yükleniyor | Kart iskeleti + "Kalemleri ayırıyoruz…" gibi sakin mesajlar |
| Kısmi | "Mekan adı bulunamadı, siz yazın" satır içi alanı |
| Hata | "Bu dosyayı okuyamadık. Daha net bir ekran görüntüsü deneyin ya da rakamları kendiniz girin." [Tekrar] [Manuel]. Teknik kod gösterilmez. |
| Çevrimdışı | Mevcut veri görünür, yükleme pasif |

### 3.6 Güven, gizlilik, erişilebilirlik, i18n

- **Güven:**
  - Her sayının kaynağı gösterilir.
  - "Reklam yok, satıcıdan para almıyoruz" vaadi (iş modeli bununla çelişmemeli, bkz. 4.2).
- **Gizlilik:**
  - Dosyaları analizden sonra saklama, ya da kullanıcı seçsin.
  - Hesap sil ve veriyi dışa aktar.
  - KVKK aydınlatma metni.
  - Gemini veri kullanım koşulları gözden geçirilmeli: ücretli API kullanımı, eğitime kapalı.
- **Erişilebilirlik:**
  - WCAG 2.2 AA, dokunma hedefi en az 44 px, görünür odak.
  - Tablo için doğru `<table>` semantiği. Toplam değişimlerinde `aria-live`.
- **i18n:**
  - Mevcut TR/EN sözlüğü korunmalı.
  - Para ve tarih formatları `Intl` ile, kur ve para birimi kullanıcı tercihi olarak.
  - Sonraki diller: DE, IT, AR (destinasyon düğünü kaynak pazarları, varsayım).

### 3.7 Duygusal ton

- **Yap:**
  - "Birlikte bakalım", "Bu teklifte yazmayan 3 şey var. Sormak için hazır mesajı kopyalayın."
  - Kutlama anları: ilk karşılaştırma tamamlandığında ince bir konfeti değil, zarif bir "Hazır" işareti.
- **Yapma:**
  - "UYARI! GİZLİ MALİYET TESPİT EDİLDİ" gibi alarmcı dil.
  - Kırmızı yoğun ekranlar, fintech tablosu soğukluğu.
- **Denge:** Veri alanı sakin ve tabular. Duygu başlıklarda ve boşlukta.

---

## FAZ 4 — Ticarileştirme Notları

### 4.1 Hedef segmentler ve değer önerisi

| Segment | Acı | Değer önerisi | Öncelik |
|---|---|---|---|
| **TR'li çiftler, orta-üst segment** (salon, otel, kır düğünü) | WhatsApp'ta dağınık teklifler, KDV/servis belirsizliği, pazarlık | "Teklifleri at, gerçek toplamı ve soracaklarını gör" | 1 |
| **Destinasyon düğünü yapan yabancı çiftler** (Bodrum, Como, Toskana, Yunanistan) | Çok para birimi, servis %, minimum harcama, buyout geceleri | "Avrupa'daki mekan tekliflerini aynı dilde karşılaştır" (EUR/GBP/USD) | 2 (daha yüksek ödeme isteği) |
| **Bağımsız düğün planlamacıları** | Müşteriye teklif karşılaştırması hazırlamak saatler alıyor | Beyaz etiketli rapor, müşteri başına çalışma alanı | 3 (B2B, düzenli gelir) |

**Farklılaştırıcılar:**
1. Teklifin **içini** okuyup gizli kalemi ve matrahı hesaplayan tek tüketici aracı. VowMath manuel çalışıyor, Co-Pilot yüzeysel.
2. WhatsApp ekran görüntüsü ve TR odağı.
3. Tarafsızlık: satıcı listesi ya da reklam yok.
4. Vendor eklentisinin mekan kartına eklenmesi.

### 4.2 Gelir modeli seçenekleri

| Model | Artı | Eksi | Not |
|---|---|---|---|
| **Freemium** (2 teklif ücretsiz, sonrası tek seferlik "Düğün Paketi") | Düğün tek seferlik bir olay, abonelik mantıksız. Net değer anı var. | Dönüşüm anı iyi tasarlanmalı | **Önerilen.** Örnek: ücretsiz önizleme + tam karşılaştırma için ~$29 benzeri tek ödeme (market-radar konsept fiyatı). TR için yerel fiyat. |
| Teklif başına kredi | Kullanım = maliyet (Gemini) eşleşir | Kullanıcı her yüklemede tereddüt eder | Freemium içinde ek paket olarak |
| Planlamacı aboneliği (B2B) | Düzenli gelir, düşük churn | Satış eforu | 2. aşama. HoneyBook/Aisle Planner ~$36–40/ay referans. |
| Satıcı ortaklığı / lead | Büyük gelir potansiyeli | **Tarafsızlık vaadini öldürür.** The Knot şikâyetlerinin kaynağı bu. | Önerilmez, en azından açık etiketlemeyle sınırla |
| Affiliate (düğün sigortası, döviz, kredi kartı taksit) | Değer katan, tarafsız kalabilen | Düşük gelir | Uygun bağlamda (ör. EUR teklif → döviz) |

### 4.3 Kişisel araçtan ürüne geçiş: teknik değişiklikler

| Alan | Gereken |
|---|---|
| Kod tabanı | Alpine tek dosyadan React + TS'ye geçiş (iskelet var). Hesaplama motoru saf TS modülü + birim testleri. Tailwind derlemeli. |
| Auth | E-posta magic link + Google/Apple ile giriş. Misafir modu (yerel) → hesaba taşıma. |
| Veritabanı | Postgres (ör. Supabase): `users`, `weddings`, `quotes`, `quote_items`, `shares`. Her tabloda **RLS**. Dosyalar özel bucket'ta, kısa ömürlü imzalı URL ile. |
| Çoklu kullanıcı | Düğün başına üyeler (partner, planlamacı) ve roller (sahip / düzenleyici / görüntüleyici) |
| AI hattı | Kuyruk (Cloud Tasks vb.), idempotent işler, kullanıcı başına kota, sonuç önbelleği (dosya hash'i), model ve prompt sürümleme, değerlendirme seti (20–50 gerçek anonim teklif + beklenen JSON) |
| Güvenlik | Rate limit, CSP, imzalı fotoğraf proxy'si, sabitlenmiş bağımlılıklar, gizli anahtarlar Secret Manager'da, sadece sunucuda |
| Ödeme | Stripe (global) + iyzico/PayTR (TR, taksit). Webhook ile `entitlements` tablosu. |
| Analitik | Gizlilik dostu ürün analitiği (PostHog EU / Plausible). Huni: yükle → kontrol et → karşılaştır → paylaş → öde. Teklif içeriği analitiğe gönderilmez. |
| Hukuk | **KVKK:** aydınlatma metni, açık rıza (yurt dışına aktarım, Google), VERBİS gerekliliği kontrolü. **GDPR:** DPA, veri işleme kaydı, silme ve dışa aktarma hakkı. Kullanım şartları: "finansal ya da hukuki tavsiye değildir". Google Gemini API şartları. |
| Gözlemlenebilirlik | Hata izleme (Sentry), AI maliyet panosu, model hata oranı |

### 4.4 MVP yol haritası

**0–30 gün: "Güvenilir kişisel araç"**
- M1 hesaplama düzeltmeleri + testler
- M2 yerel kayıt
- M3 rate limit ve hata yönetimi
- M4 kur kodda
- M8 gizlilik notu
- S1 kopya temizliği, S5 temsili görsel etiketi, S6 davetli aralığı
- 10 gerçek teklifle doğruluk değerlendirme seti
- Çıktı: kendi düğünün için güvenle kullanabileceğin sürüm

**31–60 gün: "Kapalı beta"**
- React + TS geçişi (S10), hesap ve DB (Supabase + RLS)
- M5 genişletilmiş şema, M6 kaynak etiketleri, M7 mobil tablo
- S2 adımlı akış, S3 kırmızı bayrak ve sorulacaklar, S4 pazarlık ipuçları
- 20–30 çiftle beta (TR odaklı). Tek metrik: "karşılaştırmayı tamamlayan ve paylaşan çift oranı"

**61–90 gün: "Ücretli lansman"**
- Freemium + ödeme (iyzico + Stripe), KVKK/GDPR metinleri
- Paylaşılabilir link (N3), PWA ve paylaşım hedefi (WhatsApp → uygulama)
- EN pazarlama sayfası (destinasyon düğünü), planlamacılarla 5 keşif görüşmesi (B2B doğrulama)
- Başarı ölçütü: ≥%5 ücretsiz → ücretli dönüşüm, AI doğruluğu ≥%90 (kalem bazında)

---

## İlk 5 hızlı kazanım (onayına sunuyorum)

Her biri bağımsız. Tek tek onaylayabilirsin.

1. **Hesaplama hatalarını düzelt (H1–H3)**: Çift KDV, servis yüzdesi sırası, boş kartın "En Avantajlı" çıkması. Önce test, sonra düzeltme. Efor **S**.
2. **Otomatik kayıt**: Durumu `localStorage`'a yaz, JSON yedek indir/yükle. Yenileyince veri kaybolmasın. Efor **S**.
3. **API koruması ve sade hata mesajları**: Rate limit, istemcide dosya boyutu kontrolü, MIME beyaz listesi, ham hata yerine kullanıcı dostu mesaj. Efor **S**.
4. **Düzenlenebilir kur + kodda dönüşüm**: Model orijinal tutar ve para birimini döndürsün. Kur UI'dan değişsin ve tarihi görünsün. Efor **S–M**.
5. **Kopya ve dürüstlük temizliği**: Jargonu sadeleştir, stok kapaklara "Temsili görsel" etiketi koy, davetli aralığını 10–1000 yap, gizlilik notunu ekle. Efor **S**.

---

## Kaynaklar

- Gizli maliyetler, KDV ve servis: [Coco Wedding Venues](https://cocoweddingvenues.co.uk/the-blog/planning/coco-advice/the-hidden-costs-you-need-to-be-aware-of/), [Bridebook – Hidden costs](https://bridebook.com/uk/article/hidden-wedding-costs-every-couple-needs-to-know-about), [Paperlust](https://paperlust.co/blog/hidden-wedding-costs/), [Guides for Brides – 50 soru](https://guidesforbrides.co.uk/wedding-ideas/50-questions-to-ask-your-wedding-venues-before-booking)
- Teklif normalizasyonu: [The Budget Savvy Bride](https://thebudgetsavvybride.com/venue-tracking-spreadsheet/), [Budget & Bouquet](https://budgetandbouquet.com/blog/wedding-venue-comparison), [VowMath Reality Check](https://vowmath.com/reality-check)
- Rakip karşılaştırmaları ve şikâyetler: [Unstar 2026 ranking](https://unstar.app/blog/zola-the-knot-joy-weddingwire-minted-wedding-planning-apps-ranked-2026), [Kaiplan – Zola alternatives](https://kaiplan.pages.dev/compare/alternatives/zola) (rakip), [Nathan Tailors](https://www.nathantailors.com/en/blog/zola-vs-the-knot-vs-weddingwire-2026), [Trustpilot – WeddingWire](https://www.trustpilot.com/review/weddingwire.com?page=5), [Zola – vendor siteleri](https://www.zola.com/expert-advice/best-websites-for-finding-vendors)
- Bridebook, Hitched, Joy, pro araçlar: [TechRadar](https://techradar.com/computing/websites-apps/the-5-best-wedding-apps-and-websites), [Protectivity](https://www.protectivity.com/knowledge-centre/ranking-3-all-in-one-wedding-planning-apps/), [HoneyBook vs Aisle Planner](https://www.honeybook.com/blog/honeybook-vs-aisle-planner), [Joy – apps](https://withjoy.com/blog/15-best-wedding-planning-apps-that-make-wedding-prep-easy/)
- AI teklif araçları: [Wedding Co-Pilot](https://hunted.space/product/wedding-co-pilot), [WeddingFlow (GetApp)](https://www.getapp.com/all-software/a/weddingflow/), [market-radar IDEA-096](https://market-radar-egs.pages.dev/consumer/ideas/IDEA-096), [Easy Weddings – Bree](https://www.easyweddings.com.au/pro-education/meet-bree-ai-assistant/)
- Türkiye: [karekod – Düğün salonu fiyatları 2026](https://www.karekod.org/blog/dugun-salonu-fiyatlari/), [karekod – Düğün masrafları](https://www.karekod.org/blog/dugun-masraflari/), [Posta – Fiyat sabitleme](https://www.posta.com.tr/ekonomi/ciftler-sozlesmeyle-fiyatlari-sabitliyor-2639441), [Posta – Tercihler değişti](https://www.posta.com.tr/gundem/dugun-maliyetleri-artti-tercihler-degisti-2892250), [NTV](https://www.ntv.com.tr/ntvpara/galeri-dugun-sezonu-basladi-gelinlik-denemek-bile-ucretli-1727825), [Paratic – TESK](https://paratic.com/tesk-baskani-acikladi-dugun-maliyeti-500-bin-tlden-basliyor), [İTÜ – Düğün.com](https://ikm.itu.edu.tr/firma/dugun-com), [Düğün.com uygulaması (appwisp)](https://appwisp.com/app/android/com.dugun.mobile), [Düğün.com İş Ortağım](https://apps.apple.com/tr/app/dugun-com-is-ortagim/id1211237367)
- Destinasyon: [Wedding Spots Turkey – 2026 maliyet](https://weddingspotsturkeycom.pages.dev/en/guides/destination-wedding-turkey-cost-2026), [Amanruya Bodrum](https://weddingspotsturkeycom.pages.dev/en/venues/amanruya-bodrum), [Rixos Premium Bodrum](https://weddingspotsturkeycom.pages.dev/en/venues/rixos-premium-bodrum), [Tulle Together – Villa Balbiano](https://tulletogether.com/2026/02/10/how-much-does-it-cost-to-get-married-at-villa-balbiano-in-italy/), [Princess Apulia – İtalya bütçe](https://princessapulia.com/blog/cost-of-wedding-in-italy/)
- Tasarım trendleri: [Paperlust – Trends 2026](https://paperlust.co/blog/wedding-trends-2026/), [Joy – 2026 trends](https://withjoy.com/blog/2026-wedding-trends-what-couples-are-actually-doing-this-year/), [Paper Culture](https://www.paperculture.com/2026-wedding-trends-stationery), [CyberOptik – wedding websites](https://www.cyberoptik.net/blog/best-wedding-websites/)
