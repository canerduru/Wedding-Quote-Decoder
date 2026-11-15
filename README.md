# Wedding Quote Decoder

Düğün mekanı ve dış hizmet tekliflerini (WhatsApp ekran görüntüsü veya PDF) Gemini ile okuyup
gizli kalemleri, servis bedelini ve KDV'yi hesaba katarak yan yana karşılaştıran bir panel.

Sunucusuz, tamamen statik bir sitedir. Hiçbir hosta bağlı değildir: `dist/` klasörünü sunan her yerde çalışır.

## Gemini anahtarı

Herkes kendi [Gemini API anahtarını](https://aistudio.google.com/apikey) sayfadaki kutuya girer.
Anahtar yalnızca kullanıcının tarayıcısında (`localStorage`) saklanır ve belge okunurken
doğrudan Google'a gönderilir. Başka hiçbir sunucuya uğramaz. Yedek dosyası anahtarı içermez.

## Çalıştırma

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # birim testleri
npm run build      # dist/ üretir
```

## Yayınlama

**GitHub Pages:** `main`'e her push `.github/workflows/pages.yml` ile otomatik yayınlanır.
Repo ayarlarında *Settings → Pages → Source* değeri **GitHub Actions** olmalı.

**Netlify:** Repoyu bağlayın. `netlify.toml` build komutunu (`npm run build`) ve yayın klasörünü (`dist`) tanımlar.

Build çıktısı göreli yollar kullanır (`base: './'`), bu yüzden alt yolda (`/Wedding-Quote-Decoder/`) da
kök alan adında da aynen çalışır.

## Kartlar nerede saklanır

Eklenen kartlar tarayıcıda otomatik kaydedilir. Teklif görselleri kaydedilmez.
"Yedeği İndir / Yükle" ile JSON dosyasına alabilirsiniz.

## Dış bağımlılıklar

Tailwind (3.4.17), Lucide (0.460.0) ve Google Fonts CDN'den yüklenir, sürümleri sabittir.
Alpine.js pakete dahildir. Gemini çağrıları `generativelanguage.googleapis.com`'a,
mekan fotoğrafı aramaları Wikipedia/Wikimedia'ya tarayıcıdan yapılır.
