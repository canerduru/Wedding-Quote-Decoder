# Wedding Quote Decoder

Düğün mekanı ve dış hizmet tekliflerini (WhatsApp ekran görüntüsü veya PDF) Gemini ile okuyup
gizli kalemleri, KDV ve servis bedelini hesaba katarak yan yana karşılaştıran bir panel.

## Çalıştırma

```bash
npm install --legacy-peer-deps
cp .env.example .env
npm run dev        # http://localhost:3000
npm test           # birim testleri
```

## Gemini anahtarı: iki mod

| Mod | Ayar | Ne olur |
|---|---|---|
| **Herkese açık** (varsayılan) | `APP_PASSWORD` boş | Siteyi herkes açabilir. Her kullanıcı sayfadaki kutuya **kendi** Gemini API anahtarını girer (ücretsiz: [Google AI Studio](https://aistudio.google.com/apikey)). Sunucudaki `GEMINI_API_KEY` bu modda kullanılmaz. |
| **Özel** | `APP_PASSWORD` dolu | Tarayıcı şifre sorar (kullanıcı adı önemsiz). `GEMINI_API_KEY` de tanımlıysa sunucu kendi anahtarını kullanır. |

Anahtarlar `.env` dosyasında kalır. `.env*` dosyaları `.gitignore` ile repo dışında tutulur,
`.env.example` içine gerçek anahtar yazmayın.

Kullanıcı anahtarı yalnızca kullanıcının tarayıcısında (`localStorage`) saklanır ve her okumada
sunucuya `x-gemini-key` başlığıyla iletilir. Sunucu onu kaydetmez ve loglamaz.

## Kartlar nerede saklanır

Eklediğiniz kartlar tarayıcınızda otomatik kaydedilir. Teklif görselleri kaydedilmez.
"Yedeği İndir / Yükle" ile JSON dosyasına alabilirsiniz. Yedek dosyası anahtarınızı içermez.
