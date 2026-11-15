import test from 'node:test';
import assert from 'node:assert/strict';
import { findVenuePhoto } from './photo.js';

const IMG = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Villa.jpg/1200px-Villa.jpg';

const wikiPages = (pages) => ({ query: { pages: Object.fromEntries(pages.map((p, i) => [String(i), { index: i + 1, ...p }])) } });
const page = (title, source = IMG, width = 1200) => ({
  title,
  fullurl: `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
  thumbnail: { source, width, height: 800 },
});

function mockFetch(handlers) {
  const urls = [];
  const fn = async (url) => {
    urls.push(url);
    for (const [match, body] of handlers) {
      if (url.includes(match)) {
        if (body instanceof Error) throw body;
        return { ok: true, json: async () => body };
      }
    }
    return { ok: true, json: async () => ({}) };
  };
  fn.urls = urls;
  return fn;
}

test('Wikipedia sonucundan basligi eslesen sayfanin gorselini dondurur', async () => {
  const f = mockFetch([['en.wikipedia.org', wikiPages([page('Villa Balbiano')])]]);
  const out = await findVenuePhoto({ name: 'Villa Balbiano', region: 'Como Gölü, İtalya', fetchImpl: f });
  assert.equal(out.found, true);
  assert.equal(out.imageUrl, IMG);
  assert.equal(out.sourceLabel, 'Wikimedia / Wikipedia');
  assert.ok(f.urls[0].includes(encodeURIComponent('Villa Balbiano Como Gölü, İtalya')));
});

test('thumb.wikimedia.org adresli kucuk resimler kabul edilir', async () => {
  const thumb = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/54/Ciragan.jpg/1200px-Ciragan.jpg';
  const f = mockFetch([['en.wikipedia.org', wikiPages([page('Villa Balbiano', thumb)])]]);
  assert.equal((await findVenuePhoto({ name: 'Villa Balbiano', region: '', fetchImpl: f })).imageUrl, thumb);
});

test('Turkce noktasiz i ile yazilan adlar eslesir (Çırağan)', async () => {
  const f = mockFetch([['en.wikipedia.org', wikiPages([page('Çırağan Palace')])]]);
  assert.equal((await findVenuePhoto({ name: 'Çırağan Sarayı', region: '', fetchImpl: f })).found, true);
});

test('baslik eslesmeyen sayfalar atlanir', async () => {
  const f = mockFetch([['en.wikipedia.org', wikiPages([page('Completely Unrelated Place')])]]);
  const out = await findVenuePhoto({ name: 'Villa Balbiano', region: '', fetchImpl: f });
  assert.equal(out.found, false);
});

test('belirtilmedi gibi bolge degerleri aramaya girmez', async () => {
  const f = mockFetch([]);
  await findVenuePhoto({ name: 'Villa Balbiano', region: 'Belirtilmedi', fetchImpl: f });
  assert.ok(!f.urls[0].includes('Belirtilmedi'));
});

test('Wikipedia bulamazsa Commons e duser', async () => {
  const commons = {
    query: {
      pages: {
        1: {
          index: 1,
          title: 'File:Villa Balbiano Lenno.jpg',
          imageinfo: [{ thumburl: IMG, url: IMG, descriptionurl: 'https://commons.wikimedia.org/wiki/File:x', mime: 'image/jpeg', width: 2000 }],
        },
      },
    },
  };
  const f = mockFetch([['commons.wikimedia.org', commons]]);
  const out = await findVenuePhoto({ name: 'Villa Balbiano', region: '', fetchImpl: f });
  assert.equal(out.found, true);
  assert.equal(out.sourceLabel, 'Wikimedia Commons');
});

test('wikimedia disi host, logo, svg ve kucuk gorseller reddedilir', async () => {
  for (const bad of [
    page('Villa Balbiano', 'https://evil.example/villa.jpg'),
    page('Villa Balbiano', 'https://upload.wikimedia.org/x/Villa_logo.png'),
    page('Villa Balbiano', 'https://upload.wikimedia.org/x/Villa.svg'),
    page('Villa Balbiano', IMG, 200),
  ]) {
    const f = mockFetch([['en.wikipedia.org', wikiPages([bad])]]);
    assert.equal((await findVenuePhoto({ name: 'Villa Balbiano', region: '', fetchImpl: f })).found, false);
  }
});

test('cok kisa ad aramaz, ag hatasi found:false olur', async () => {
  const f = mockFetch([]);
  assert.equal((await findVenuePhoto({ name: 'a', region: '', fetchImpl: f })).found, false);
  assert.equal(f.urls.length, 0);
  const broken = mockFetch([['wikipedia.org', new Error('network')], ['commons', new Error('network')]]);
  assert.equal((await findVenuePhoto({ name: 'Villa Balbiano', region: '', fetchImpl: broken })).found, false);
});
