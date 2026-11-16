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

- Özet başlık aynen kalır, altına şimdiki gövde açılır: kira, yemek, ek ücretler,
  koşullar, bayraklar, düzenleme paneli, birleştirme, çakışmalar.
- Fotoğraf yenile, kapak değiştir, sil gibi kapak kontrolleri açık kartta görünür.
- Açık kartlar şimdiki geniş ızgarada (`density` ayarına uyar), kapalılar dar ızgarada
  durur. Karışık durumda sayfa iki bölüm olarak akar: önce açık kartlar, sonra
  kapalılar. Kartlar yerinde büyümez.

### Genel buton

- Kart başlığının yanında tek buton: "Detayları aç" / "Detayları kapat".
- `cardsOpen` (genel) ve `openCards` (kart başına istisna kümesi) iki durum.
  Bir kart açıksa: `cardsOpen || openCards.has(id)`.
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
- Kütüphane: SortableJS, npm ile paketlenir, mevcut Vite build'ine girer. Fare ve
  dokunmatik çalışır.
- Alpine render'ı doğru kaynak kalır: sürükleme bitince (`onEnd`) kütüphanenin
  taşıdığı DOM düğümü eski yerine geri alınır, sonra `venues` dizisi
  `moveItem(...)` ile güncellenir ve Alpine yeniden çizer.
- Sıra `venues` dizisinin kendisidir. `serializeState` zaten diziyi sırasıyla
  kaydettiği için yenilemeden sonra da korunur. Tablo ve `matrix` aynı diziyi okur.
- Sürüklemeye özel geri alma yok.

## Kod yapısı

| Dosya | Değişiklik |
|---|---|
| `src/reorder.js` (yeni) | `moveItem(list, fromId, toId)` (yeni dizi döner, aynı/yok id'de aynı sırayı döner), `includedCount(venue)` |
| `src/reorder.test.js` (yeni) | birim testler |
| `src/viewmode.js` | `loadCardsOpen/saveCardsOpen`, `compactGridStyle()` |
| `src/viewmode.test.js` | yeni fonksiyonların testleri |
| `package.json` | `sortablejs` bağımlılığı (sabit sürüm) |
| `index.html` | özet başlık, açılır gövde, genel buton, Sortable bağlantısı, TR/EN metinler |

`index.html` içinde yeni durum ve metotlar: `cardsOpen`, `openCards`, `isCardOpen(venue)`,
`toggleCard(venue)`, `toggleAllCards()`, `canReorder()`, `initSortable(el)`.

Yeni i18n anahtarları (TR/EN): `cardsExpandAll`, `cardsCollapseAll`, `cardExpand`,
`cardCollapse`, `dragHandleLabel`, `includedCountLabel` (ör. "{n} özellik dahil").

## Hata ve uç durumlar

- Sortable yüklenemezse ya da `window.Sortable` yoksa sıralama sessizce devre dışı kalır,
  kartlar yine açılıp kapanır.
- Sürükleme sırasında yeni kart eklenirse ya da silinirse `onEnd` id ile çalıştığı için
  yanlış kart taşınmaz.
- Kapalı kartta ad boşsa `displayVenueName` zaten yedek adı döner.
- `localStorage` engelliyse genel durum sadece bellekte kalır (mevcut `viewmode`
  kalıbıyla aynı try/catch).

## Test planı

Birim (node --test):
- `moveItem`: başa, sona, ortaya taşıma; aynı id; bilinmeyen id; yeni dizi döner,
  girdi değişmez.
- `includedCount`: sadece `safe` sayılır, `info` ve `risk` sayılmaz, bayraksız mekan 0.
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
