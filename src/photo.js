const IMAGE_HOSTS = ['upload.wikimedia.org', 'thumb.wikimedia.org'];
const SKIP_WORDS = ['hotel', 'villa', 'palace', 'estate', 'resort', 'saray', 'sarayi', 'otel', 'the', 'and'];
const GENERIC_REGION = /belirtilmedi|unspecified|şehir|city|manuel|manual/i;
const WIKIS = ['https://en.wikipedia.org/w/api.php', 'https://tr.wikipedia.org/w/api.php'];

function nameTokens(str) {
  return (str || '')
    .toLowerCase()
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !SKIP_WORDS.includes(w));
}

function isUsableImage(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !IMAGE_HOSTS.includes(parsed.hostname)) return false;
  } catch {
    return false;
  }
  return !/\.(svg|ico)(\?|$)|(favicon|apple-touch-icon|logo|sprite|pixel|1x1|blank|placeholder|avatar|badge|spinner|loading|coat_of_arms|flag_of)/i.test(url);
}

async function getJson(fetchImpl, url) {
  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(5000) });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

const byIndex = (pages) => Object.values(pages || {}).sort((a, b) => (a.index ?? 99) - (b.index ?? 99));

export async function findVenuePhoto({ name, region, fetchImpl = (...args) => fetch(...args) }) {
  const tokens = nameTokens(name);
  if (tokens.length === 0) return { found: false };

  const cleanRegion = region && !GENERIC_REGION.test(region) ? region : '';
  const query = encodeURIComponent(cleanRegion ? `${name} ${cleanRegion}` : name);

  for (const endpoint of WIKIS) {
    const data = await getJson(
      fetchImpl,
      `${endpoint}?action=query&generator=search&gsrsearch=${query}&gsrlimit=5&prop=pageimages|info&inprop=url&piprop=thumbnail|original&pithumbsize=1200&format=json&origin=*`
    );
    for (const page of byIndex(data?.query?.pages)) {
      const title = nameTokens(page.title).join(' ');
      if (!tokens.some((tok) => title.includes(tok))) continue;
      const imageUrl = page.thumbnail?.source || page.original?.source || '';
      if (!isUsableImage(imageUrl) || (page.thumbnail?.width && page.thumbnail.width < 320)) continue;
      return { found: true, imageUrl, sourceUrl: page.fullurl || endpoint.replace('/w/api.php', ''), sourceLabel: 'Wikimedia / Wikipedia' };
    }
  }

  const commons = await getJson(
    fetchImpl,
    `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(name)}&gsrlimit=6&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=1200&format=json&origin=*`
  );
  const minMatches = tokens.length >= 2 ? 2 : 1;
  for (const page of byIndex(commons?.query?.pages)) {
    const title = nameTokens(page.title).join(' ');
    if (tokens.filter((tok) => title.includes(tok)).length < minMatches) continue;
    const info = page.imageinfo?.[0];
    if (!info || (info.mime && (!info.mime.startsWith('image/') || info.mime.includes('svg'))) || (info.width && info.width < 500)) continue;
    const imageUrl = info.thumburl || info.url || '';
    if (!isUsableImage(imageUrl)) continue;
    return { found: true, imageUrl, sourceUrl: info.descriptionurl || 'https://commons.wikimedia.org', sourceLabel: 'Wikimedia Commons' };
  }

  return { found: false };
}
