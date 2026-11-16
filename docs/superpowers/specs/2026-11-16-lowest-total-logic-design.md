# "En düşük" mantığı: eksik fiyatlı teklif sahte düşük sayılmasın

Tarih: 2026-11-16. Durum: tasarım onaylandı, uygulama bekliyor.

## Sorun

Kira ya da yemek yazmayan bir teklifin hesaplanan toplamı gerçek toplamdan düşüktür.
Bugün böyle bir mekan "En düşük" rozetini alabiliyor ve "+X fark" bu eksik toplamlara
göre hesaplanıyor. Kullanıcı yanlış mekanı en ucuz sanabilir.

## Tanımlar

- **Eksiksiz mekan:** `completeness(venue)` sonucunda `rentMissing`, `foodMissing`
  false ve `needsPriceCount === 0`.
- **Eksikli mekan:** eksiksiz olmayan mekan. Toplamı bir alt sınırdır: gerçek toplam
  gösterilenden küçük olamaz.
- **Fiyatlı mekan:** `calculateBreakdown(venue, guestCount).turnkeyTotalEur > 0`.
- Teklifteki toplam ile hesaplanan toplamın uyuşmaması (`statedTotalCheck`) bu tanımı
  etkilemez.

## Kurallar

1. **"En düşük" (`best`)**: mekan fiyatlı ve eksiksiz olmalı, ve toplamı diğer tüm fiyatlı
   mekanların toplamından küçük ya da eşit olmalı (eksiksiz rakipler kendi toplamıyla,
   eksikli rakipler alt sınırlarıyla). Eşitlik `Math.round` ile karşılaştırılır. En az iki
   fiyatlı mekan yoksa kimse `best` olmaz.
2. **Fark (`deltaEur`)**: sadece eksiksiz mekanlarda, eksiksiz mekanlar içindeki en düşük
   toplama göre `toplam - taban`. Taban yoksa, mekan eksikliyse ya da toplam 0 ise 0.
3. Toplamı 0 olan mekan hiçbir hesaba girmez (mevcut kural).
4. Hiç eksiksiz mekan yoksa ya da bir eksikli rakibin alt sınırı en düşük eksiksiz
   toplamdan küçükse kimse `best` olmaz.

Örnekler (100 davetli, hepsi fiyatlı):

| Mekanlar | Sonuç |
|---|---|
| A eksiksiz 5.500, B eksikli 2.000 | kimse `best` değil; A için fark 0 (taban A) |
| A eksiksiz 5.500, B eksikli 6.000 | A `best` |
| A eksiksiz 5.500, B eksiksiz 6.500 | A `best`, B fark +1.000 |
| A eksikli 2.000, B eksikli 3.000 | kimse `best` değil, fark yok |
| A eksiksiz 5.500 (tek fiyatlı) | `best` yok (en az iki fiyatlı kuralı) |

## Kod

- Yeni `src/lowest.js`: `lowestStanding(venues, guestCount)` kendi girdi sırasında
  `[{ id, total, complete, best, deltaEur }]` dizisi döner. `calc.js` ile
  `completeness.js` birbirini import ettiği için bu mantık ikisinden birine konmaz;
  yeni modül ikisini de kullanır.
- `src/table.js`: `buildComparison` `lowestStanding` sonucunu kullanır; sütunlara
  `best`, `deltaEur` ve `complete` alanları gelir.
- `index.html`: `isBestValue(venue)` ve `getDeltaFromLowest(venue)` sarmalayıcıları
  `lowestStanding` sonucuna bakar. Hesaplama render başına bir kez yapılır (getter ile
  önbelleğe alınır), mekan başına tekrar edilmez. `getLowestTotalEur` sarmalayıcısı
  kullanılmıyorsa silinir.
- `src/calc.js`: `getLowestTotalEur`, `getDeltaFromLowest`, `isBestValue` kaldırılır;
  `calc.test.js` içindeki H3 testleri `lowest.test.js` içine taşınıp yeni kurala göre
  yeniden yazılır.
- `src/matrix.js`: "En ucuza fark" satırı `deltaEur > 0` koşulunu zaten kullanıyor, değişmez.
  Satır bazlı en düşük vurgusu (kira satırı gibi) değişmez.

## Ekran

- **"en az" etiketi:** eksikli mekanın toplamının önüne küçük "en az" yazısı gelir
  (EN: "from"). Yerler: kompakt kart, açık kartın toplam alanı ve tablo başlığı.
- **İpucu satırı:** kart ya da tablo görünümünde en az iki fiyatlı mekan var ama kimse
  `best` değilse ve en az bir fiyatlı mekan eksikliyse, karşılaştırma başlığının altında
  tek satır: "En düşük belirlenemiyor: N mekanın fiyatı eksik" (EN: "Lowest can't be
  determined: N venues have missing prices"). N, fiyatlı eksikli mekan sayısıdır.
- Rozet ve "+X fark" yalnızca yeni `best` ve `deltaEur` değerlerine bağlıdır; mevcut
  işaretleme koşulları aynı kalır.
- Yeni i18n anahtarları (TR/EN): `fromPrefix`, `lowestUnknownHint`.

## Test planı

`src/lowest.test.js` (yeni):
- Yukarıdaki beş örnek tablo satırı.
- Eşitlik: iki eksiksiz mekan aynı toplam, ikisi de `best`.
- Toplamı 0 olan mekan `best` olmaz ve diğerlerini etkilemez.
- Boş dizi ve tek mekan.
- Girdi sırası korunur, girdi değişmez.
- `needsPriceCount > 0` olan mekan eksikli sayılır; `rentMissing` ve `foodMissing`
  ayrı ayrı eksikli sayılır.

`src/table.test.js`: `buildComparison` sütunlarında `best`, `deltaEur`, `complete`.

Tarayıcı (yerleşik tarayıcı, 1200 px ve 375 px): demo verisinde eksikli ucuz mekan
rozet almıyor, "en az" etiketi görünüyor, ipucu satırı çıkıyor; eksikler tamamlanınca
rozet geliyor; konsolda hata yok.

## Kapsam dışı

Teklif toplamı uyuşmazlığına göre sınıflama, farklı süre ve tarihli teklifleri
işaretleme, eksikli mekanlar için tahmini toplam üretme, kurlar ve davetli sayısı uyarıları.
