# Kapalı kart özeti, aç/kapat butonu ve sürükle-bırak sıralama

Tarih: 2026-11-16. Durum: tasarım onaylandı, uygulama bekliyor.

## Amaç

Çok mekan olduğunda kart görünümü uzun ve okunması zor. Kartlar varsayılan olarak
kısa bir özet gösterir, istenen kart ya da hepsi aşağı doğru açılır. Tüm kartlar
kapalıyken kullanıcı kartların sırasını sürükleyip bırakarak değiştirir.

## Kapsam

- Sadece kart görünümü. Tablo görünümü ve tablo sütun mantığı değişmez, ancak sütunlar
  yeni kart sırasını izler.
- Hesaplama, Gemini isteği ve para birimi mantığı değişmez.

## Davranış

### Kapalı kart (özet)

- Üstte ince fotoğraf şeridi (`h-20`, şimdiki `h-36` yerine).
- Villa adı, büyük anahtar teslim toplam (`calculateBreakdown(...).turnkeyTotalEur`),
  küçük "kişi başı X", "N özellik dahil" rozeti.
- Varsa "En düşük" rozeti ya da "+X fark", ve "N eksik" uyarısı (`completeness(venue)`).
- Sağda aç/kapat oku. Solda sürükleme tutamacı (grip ikonu).
- Toplamı 0 olan kartta fiyat yerine sessiz "—" görünür (mevcut "fiyatsız kart" kuralı).
- Özet kartlar dar ızgarada durur: `repeat(auto-fit, minmax(min(100%, 230px), 1fr))`.

"N özellik dahil" = `venue.flags` içinde `type === 'safe'` olanların sayısı. Sayı
0 ise rozet gizlenir.

### Açık kart

- Açık kart bugünkü kartın aynısıdır: kapak, başlık, kira, yemek, ek ücretler, koşullar,
  bayraklar, düzenleme, birleştirme, çakışmalar. Kapağın sağ üstüne bir "kapat" oku eklenir.
- Kapalıyken özet blok görünür, açılınca yerini bugünkü kart alır; kart aşağı doğru uzar.
- Izgara tek parçadır ve `venues` sırasını korur. Tüm kartlar kapalıyken dar ızgara
  (`minmax(230px, 1fr)`, `auto-fill`) kullanılır; en az bir kart açıksa mevcut geniş ızgara
  (`density` ayarına uyar) kullanılır ve kapalı kartlar o ızgarada tek sütun kaplar.
- Kart boyutu (density) düğmeleri sadece en az bir kart açıkken görünür.

### Genel buton

- Kart başlığının yanında tek buton: "Detayları aç" / "Detayları kapat".
- `cardsOpen` (genel) ve `openCards` (kart başına istisna, id -> boolean) iki durum.
  Bir kart açık mı: `openCards[id] ?? cardsOpen`. Tek mekan varken kart her zaman açıktır.
- Genel butona basınca `openCards` sıfırlanır ve `cardsOpen` tersine döner.
- Kapalıyken bir kartın okuna basınca sadece o kart açılır.
- Varsayılan: kapalı. `cardsOpen` `localStorage` anahtarı `wqd:cards-open` ile
  hatırlanır. `openCards` kaydedilmez.
- Tek mekan varken ya da tablo görünümündeyken buton görünmez, tek kart her zaman açık.

### Sürükle-bırak

- Yalnızca kart görünümünde, `cardsOpen` false ve `openCards` boşken etkin.
  Aksi halde tutamaç gizlenir.
- Sürükleme sadece tutamaçtan başlar (`handle`), böylece telefonda sayfa kaydırma
  ile karışmaz.
- Kendi pointer-event sürüklemesi, bağımlılık yok. Tutamaçta `pointerdown` ile başlar,
  `setPointerCapture` ile fare ve dokunmatikte aynı çalışır (tutamaçta `touch-none`).
- DOM'a dokunulmaz: sürüklenen kart Alpine durumundaki `drag` ile CSS `transform`
  kullanarak imleci izler, hedef kart halkayla işaretlenir, bırakınca `venues` dizisi
  güncellenir. Hedef kart `indexAtPoint` ile bulunur.
- SortableJS denendi ve bırakıldı: `forceFallback` sürükleme klonunu `x-for` kapsamı
  dışında DOM'a ekliyor, Alpine onu başlatmaya çalışıp her sürüklemede yüzlerce
  `venue is not defined` hatası üretiyor.
- Sıra `venues` dizisinin kendisidir. `serializeState` zaten diziyi sırasıyla
  kaydettiği için yenilemeden sonra da korunur. Tablo ve `matrix` aynı diziyi okur.
- Sürüklemeye özel geri alma yok.

## Kod yapısı

| Dosya | Değişiklik |
|---|---|
| `src/reorder.js` (yeni) | `moveIndex(list, from, to)` (yeni dizi döner, aralık dışı ya da aynı indekste aynı diziyi döner), `indexAtPoint(rects, x, y, fallback)` |
| `src/reorder.test.js` (yeni) | birim testler |
| `src/cardsummary.js` (yeni) | `cardSummary(venue, guestCount)` -> `{ totalEur, perGuestEur, included, gaps }` |
| `src/cardsummary.test.js` (yeni) | birim testler |
| `src/viewmode.js` | `CARDS_OPEN_KEY`, `loadCardsOpen/saveCardsOpen`, `compactGridStyle()` |
| `src/viewmode.test.js` | yeni fonksiyonların testleri |
| `index.html` | özet başlık, açılır gövde, genel buton, sürükleme durumu ve metotları, TR/EN metinler |

`index.html` içinde yeni durum ve metotlar: `cardsOpen`, `openCards`, `isCardOpen(venue)`,
`toggleCard(venue)`, `toggleAllCards()`, `canReorder()`, `startDrag(event, venue)`, `dragCardStyle`, `dragCardClass`.

Yeni i18n anahtarları (TR/EN): `cardsExpandAll`, `cardsCollapseAll`, `cardExpand`,
`cardCollapse`, `dragHandleLabel`, `includedCountLabel` (ör. "{n} özellik dahil").

## Hata ve uç durumlar

- Sürükleme iptal edilirse (`pointercancel`) sıra değişmez.
- Sürükleme bırakılınca kart indeksleri başlangıçtaki dizi üzerinden hesaplandığı için
  sürükleme sırasında eklenen ya da silinen bir kart sırayı bozmaz (yeni indeksler aralık
  kontrolünden geçer).
- Kapalı kartta ad boşsa `displayVenueName` zaten yedek adı döner.
- `localStorage` engelliyse genel durum sadece bellekte kalır (mevcut `viewmode`
  kalıbıyla aynı try/catch).

## Test planı

Birim (node --test):
- `moveIndex`: başa, sona, ortaya taşıma; aynı indeks; aralık dışı indeks; yeni dizi
  döner, girdi değişmez.
- `cardSummary`: sadece `safe` sayılır, `info` ve `risk` sayılmaz; toplam, kişi başı ve
  eksik sayısı doğru; boş mekan 0 toplam ve 2 eksik.
- `loadCardsOpen/saveCardsOpen`: varsayılan false, bozuk değer, engelli storage.

Tarayıcı (yerleşik tarayıcı, 1200 px ve 375 px):
- Kapalı özet doğru ad, toplam, dahil sayısı gösteriyor.
- Genel buton hepsini açıp kapatıyor, tek kart açılıyor.
- Sürükle-bırak sırayı değiştiriyor, yenilemeden sonra sıra korunuyor, tablo aynı sırada.
- Açık kart varken tutamaç gizli.
- 10 mekanla kapalı görünüm 2 sıraya sığıyor, sayfada yatay taşma yok.

## Kapsam dışı

Kapalı kartta kira/yemek ayrımı, kart yerinde büyüme animasyonu, sürükleme için geri
alma, sıralamayı tablo başlığından değiştirme.
