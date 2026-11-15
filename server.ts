import 'dotenv/config';
import dns from 'node:dns/promises';
import net from 'node:net';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import type { ViteDevServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getAiClient() {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface VenuePhotoResult {
  found: boolean;
  proxyUrl?: string;
  sourceUrl?: string;
  sourceLabel?: string;
}

const VENUE_PHOTO_CACHE_TTL_MS = 30 * 60 * 1000;
const venuePhotoCache = new Map<string, { expiresAt: number; result: VenuePhotoResult }>();

function setVenuePhotoCache(key: string, result: VenuePhotoResult) {
  if (venuePhotoCache.size >= 200) {
    const oldestKey = venuePhotoCache.keys().next().value;
    if (oldestKey) venuePhotoCache.delete(oldestKey);
  }
  venuePhotoCache.set(key, {
    expiresAt: Date.now() + VENUE_PHOTO_CACHE_TTL_MS,
    result,
  });
}

function isPrivateOrReservedIp(ip: string): boolean {
  const normalized = ip.toLowerCase().trim();
  if (normalized.startsWith('::ffff:')) {
    return isPrivateOrReservedIp(normalized.slice(7));
  }
  const version = net.isIP(normalized);
  if (version === 4) {
    const parts = normalized.split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return true;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  if (version === 6) {
    if (normalized === '::1' || normalized === '::') return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
    if (normalized.startsWith('fe80:')) return true;
    return false;
  }
  return true;
}

async function isSafePublicHttpUrl(rawUrl: string): Promise<URL | null> {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    const host = parsed.hostname.toLowerCase();
    if (!host || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
      return null;
    }
    if (net.isIP(host)) {
      return isPrivateOrReservedIp(host) ? null : parsed;
    }
    const records = await dns.lookup(host, { all: true });
    if (!records || records.length === 0) return null;
    for (const rec of records) {
      if (isPrivateOrReservedIp(rec.address)) {
        return null;
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

async function safeFetchWithRedirects(
  rawUrl: string,
  options: { timeoutMs?: number; accept?: string } = {},
  maxHops = 4
): Promise<{ response: Response; finalUrl: string } | null> {
  let currentUrl = rawUrl;
  const timeoutMs = options.timeoutMs ?? 6000;

  for (let hop = 0; hop <= maxHops; hop++) {
    const safeUrl = await isSafePublicHttpUrl(currentUrl);
    if (!safeUrl) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resp = await fetch(safeUrl.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9,tr;q=0.8',
          Accept: options.accept || '*/*',
        },
      });
      clearTimeout(timer);

      if (resp.status >= 300 && resp.status < 400) {
        const location = resp.headers.get('location');
        if (!location) return null;
        currentUrl = new URL(location, safeUrl).toString();
        continue;
      }

      return { response: resp, finalUrl: safeUrl.toString() };
    } catch {
      clearTimeout(timer);
      return null;
    }
  }
  return null;
}

function normalizePhotoTokens(str: string): string[] {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !['hotel', 'villa', 'palace', 'estate', 'resort', 'saray', 'sarayi', 'otel', 'the', 'and'].includes(w));
}

function isSuspiciousImageCandidate(urlStr: string): boolean {
  const lower = urlStr.toLowerCase();
  if (lower.startsWith('data:')) return true;
  if (/\.(svg|ico)(\?|$)/i.test(lower)) return true;
  return /(favicon|apple-touch-icon|logo|sprite|pixel|1x1|blank|placeholder|avatar|badge|spinner|loading|coat_of_arms|flag_of)/i.test(lower);
}

async function verifyRemoteImageUrl(imageUrl: string): Promise<boolean> {
  if (isSuspiciousImageCandidate(imageUrl)) return false;
  const fetched = await safeFetchWithRedirects(imageUrl, {
    timeoutMs: 5000,
    accept: 'image/avif,image/webp,image/apng,image/jpeg,image/png,image/*;q=0.8',
  });
  if (!fetched || !fetched.response.ok) return false;
  const contentType = (fetched.response.headers.get('content-type') || '').toLowerCase();
  try {
    await fetched.response.body?.cancel();
  } catch {
    // ignore stream cancel errors
  }
  return contentType.startsWith('image/') && !contentType.includes('svg') && !contentType.includes('icon');
}

async function searchWikimediaVenuePhoto(
  name: string,
  region: string
): Promise<{ imageUrl: string; sourceUrl: string; sourceLabel: string } | null> {
  const nameTokens = normalizePhotoTokens(name);
  if (nameTokens.length === 0) return null;

  const cleanRegion = region && !/belirtilmedi|unspecified|şehir|city|manuel|manual/i.test(region) ? region : '';
  const query = cleanRegion ? `${name} ${cleanRegion}` : name;
  const endpoints = ['https://en.wikipedia.org/w/api.php', 'https://tr.wikipedia.org/w/api.php'];

  for (const endpoint of endpoints) {
    try {
      const apiUrl = `${endpoint}?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=5&prop=pageimages|info&inprop=url&piprop=thumbnail|original&pithumbsize=1200&format=json&origin=*`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(apiUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'WeddingQuoteDecoder/1.0' },
      });
      clearTimeout(timer);
      if (!resp.ok) continue;

      const data = (await resp.json()) as {
        query?: {
          pages?: Record<
            string,
            {
              title?: string;
              index?: number;
              fullurl?: string;
              thumbnail?: { source?: string; width?: number; height?: number };
              original?: { source?: string; width?: number; height?: number };
            }
          >;
        };
      };

      const pages = Object.values(data?.query?.pages || {}).sort((a, b) => (a.index ?? 99) - (b.index ?? 99));
      for (const page of pages) {
        const titleNormalized = normalizePhotoTokens(page.title || '').join(' ');
        const matchedTokens = nameTokens.filter((tok) => titleNormalized.includes(tok));
        if (matchedTokens.length === 0) continue;

        const imgUrl = page.thumbnail?.source || page.original?.source || '';
        if (!imgUrl || isSuspiciousImageCandidate(imgUrl)) continue;
        if (page.thumbnail?.width && page.thumbnail.width < 320) continue;

        const ok = await verifyRemoteImageUrl(imgUrl);
        if (ok) {
          return {
            imageUrl: imgUrl,
            sourceUrl: page.fullurl || endpoint.replace('/w/api.php', ''),
            sourceLabel: 'Wikimedia / Wikipedia',
          };
        }
      }
    } catch {
      // continue to next wiki language
    }
  }

  // Fallback to Wikimedia Commons direct photo search (namespace 6 = File:)
  try {
    const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(name)}&gsrlimit=6&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=1200&format=json&origin=*`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(commonsUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'WeddingQuoteDecoder/1.0' },
    });
    clearTimeout(timer);
    if (resp.ok) {
      const data = (await resp.json()) as {
        query?: {
          pages?: Record<
            string,
            {
              title?: string;
              index?: number;
              imageinfo?: Array<{
                url?: string;
                thumburl?: string;
                descriptionurl?: string;
                mime?: string;
                width?: number;
              }>;
            }
          >;
        };
      };
      const pages = Object.values(data?.query?.pages || {}).sort((a, b) => (a.index ?? 99) - (b.index ?? 99));
      for (const page of pages) {
        const titleNormalized = normalizePhotoTokens(page.title || '').join(' ');
        const minRequired = nameTokens.length >= 2 ? 2 : 1;
        const matchedTokens = nameTokens.filter((tok) => titleNormalized.includes(tok));
        if (matchedTokens.length < minRequired) continue;

        const info = page.imageinfo?.[0];
        if (!info) continue;
        if (info.mime && (!info.mime.startsWith('image/') || info.mime.includes('svg'))) continue;
        if (info.width && info.width < 500) continue;

        const imgUrl = info.thumburl || info.url || '';
        if (!imgUrl || isSuspiciousImageCandidate(imgUrl)) continue;

        const ok = await verifyRemoteImageUrl(imgUrl);
        if (ok) {
          return {
            imageUrl: imgUrl,
            sourceUrl: info.descriptionurl || 'https://commons.wikimedia.org',
            sourceLabel: 'Wikimedia Commons',
          };
        }
      }
    }
  } catch {
    // continue to official website search
  }

  return null;
}

function extractImagesFromHtml(html: string, baseUrl: string): string[] {
  const candidates: string[] = [];
  const pushCandidate = (raw: string | undefined) => {
    if (!raw) return;
    const cleaned = raw.trim().replace(/&amp;/g, '&');
    if (!cleaned || cleaned.startsWith('data:')) return;
    try {
      const resolved = new URL(cleaned, baseUrl).toString();
      if (!isSuspiciousImageCandidate(resolved) && !candidates.includes(resolved)) {
        candidates.push(resolved);
      }
    } catch {
      // ignore invalid URL
    }
  };

  const metaRegex = /<meta\s+[^>]*?(?:property|name)\s*=\s*["'](?:og:image:secure_url|og:image|twitter:image:src|twitter:image)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = metaRegex.exec(html)) !== null) {
    const tag = match[0];
    const contentMatch = /content\s*=\s*["']([^"']+)["']/i.exec(tag);
    if (contentMatch) pushCandidate(contentMatch[1]);
  }

  const metaReverseRegex = /<meta\s+[^>]*?content\s*=\s*["']([^"']+)["'][^>]*?(?:property|name)\s*=\s*["'](?:og:image:secure_url|og:image|twitter:image:src|twitter:image)["'][^>]*>/gi;
  while ((match = metaReverseRegex.exec(html)) !== null) {
    pushCandidate(match[1]);
  }

  const linkRegex = /<link\s+[^>]*?rel\s*=\s*["']image_src["'][^>]*>/gi;
  while ((match = linkRegex.exec(html)) !== null) {
    const hrefMatch = /href\s*=\s*["']([^"']+)["']/i.exec(match[0]);
    if (hrefMatch) pushCandidate(hrefMatch[1]);
  }

  const jsonLdRegex = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      const collectJsonLdImages = (node: unknown) => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) {
          node.forEach(collectJsonLdImages);
          return;
        }
        const obj = node as Record<string, unknown>;
        if (obj.image) {
          if (typeof obj.image === 'string') pushCandidate(obj.image);
          else if (Array.isArray(obj.image)) {
            obj.image.forEach((item) => {
              if (typeof item === 'string') pushCandidate(item);
              else if (item && typeof item === 'object' && typeof (item as Record<string, unknown>).url === 'string') {
                pushCandidate((item as Record<string, unknown>).url as string);
              }
            });
          } else if (typeof obj.image === 'object' && typeof (obj.image as Record<string, unknown>).url === 'string') {
            pushCandidate((obj.image as Record<string, unknown>).url as string);
          }
        }
        if (obj['@graph']) collectJsonLdImages(obj['@graph']);
      };
      collectJsonLdImages(parsed);
    } catch {
      // ignore invalid JSON-LD
    }
  }

  return candidates;
}

const BLOCKED_SOCIAL_HOSTS = [
  'instagram.com',
  'facebook.com',
  'fb.com',
  'pinterest.com',
  'pin.it',
  'tiktok.com',
  'linkedin.com',
  'twitter.com',
  'x.com',
  'youtube.com',
];

function isBlockedPageHost(urlStr: string): boolean {
  try {
    const host = new URL(urlStr).hostname.toLowerCase();
    return BLOCKED_SOCIAL_HOSTS.some((blocked) => host === blocked || host.endsWith('.' + blocked));
  } catch {
    return true;
  }
}

async function searchOfficialWebsitePhoto(
  name: string,
  region: string
): Promise<{ imageUrl: string; sourceUrl: string; sourceLabel: string } | null> {
  if (!process.env.GEMINI_API_KEY) return null;

  const ai = getAiClient();
  const cleanRegion = region && !/belirtilmedi|unspecified|şehir|city|manuel|manual/i.test(region) ? region : '';
  const searchPrompt = `Find the official website homepage or venue page URL for the wedding venue "${name}"${cleanRegion ? ` in "${cleanRegion}"` : ''}.
Return ONLY a JSON object with this structure (no markdown fences):
{"officialUrl": "https://...", "backupUrls": ["https://..."]}`;

  const models = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'];
  const candidatePageUrls: string[] = [];

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: searchPrompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      for (const chunk of chunks) {
        const uri = chunk?.web?.uri;
        if (uri && /^https?:\/\//i.test(uri) && !candidatePageUrls.includes(uri)) {
          candidatePageUrls.push(uri);
        }
      }

      const rawText = (response.text || '').trim();
      const urlMatches = rawText.match(/https?:\/\/[^\s"'<>)\]]+/gi) || [];
      for (const foundUrl of urlMatches) {
        const cleaned = foundUrl.replace(/[.,;]+$/, '');
        if (!candidatePageUrls.includes(cleaned)) {
          candidatePageUrls.push(cleaned);
        }
      }

      if (candidatePageUrls.length > 0) break;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('503') || msg.includes('429') || msg.includes('UNAVAILABLE')) {
        continue;
      }
      break;
    }
  }

  let triedCount = 0;
  for (const pageUrl of candidatePageUrls) {
    if (triedCount >= 4) break;
    if (isBlockedPageHost(pageUrl)) continue;
    triedCount += 1;

    const fetched = await safeFetchWithRedirects(pageUrl, {
      timeoutMs: 6000,
      accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
    });
    if (!fetched || !fetched.response.ok) continue;

    const finalPageUrl = fetched.finalUrl;
    if (isBlockedPageHost(finalPageUrl)) {
      try {
        await fetched.response.body?.cancel();
      } catch {
        // ignore
      }
      continue;
    }

    const contentType = (fetched.response.headers.get('content-type') || '').toLowerCase();
    if (contentType.startsWith('image/') && !contentType.includes('svg')) {
      try {
        await fetched.response.body?.cancel();
      } catch {
        // ignore
      }
      if (!isSuspiciousImageCandidate(finalPageUrl)) {
        const hostLabel = new URL(finalPageUrl).hostname.replace(/^www\./, '');
        return { imageUrl: finalPageUrl, sourceUrl: finalPageUrl, sourceLabel: hostLabel };
      }
      continue;
    }

    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      try {
        await fetched.response.body?.cancel();
      } catch {
        // ignore
      }
      continue;
    }

    const html = (await fetched.response.text()).slice(0, 350000);
    const imgCandidates = extractImagesFromHtml(html, finalPageUrl);
    const hostLabel = new URL(finalPageUrl).hostname.replace(/^www\./, '');

    for (const imgUrl of imgCandidates.slice(0, 4)) {
      const ok = await verifyRemoteImageUrl(imgUrl);
      if (ok) {
        return {
          imageUrl: imgUrl,
          sourceUrl: finalPageUrl,
          sourceLabel: hostLabel,
        };
      }
    }
  }

  return null;
}

const quoteResponseSchema = {
  type: Type.OBJECT,
  properties: {
    docCategory: {
      type: Type.STRING,
      description:
        "Must be 'venue' if the document is a wedding venue/hotel/estate proposal, OR 'vendor_addon' if it is an external service quote (florist, boat/water taxi, external catering, DJ/band/lighting, tent/production, photography).",
    },
    vendorCategory: {
      type: Type.STRING,
      description:
        "If docCategory is 'vendor_addon', classify as one of: 'floral', 'boat', 'catering', 'music', 'photo', or 'other'. If docCategory is 'venue', return 'venue'.",
    },
    targetVenueHint: {
      type: Type.STRING,
      description:
        "If docCategory is 'vendor_addon' and the document explicitly mentions a target venue/hotel name (e.g., 'Delivery to Villa Balbiano'), return that venue name; otherwise return ''.",
    },
    nameFound: {
      type: Type.BOOLEAN,
      description:
        'true if an explicit venue, hotel, estate, or vendor/company name is visible in the document; false if the name is missing or cropped out.',
    },
    name: {
      type: Type.STRING,
      description: 'The exact venue or vendor company name found in the quote. If nameFound is false, return an empty string "".',
    },
    region: {
      type: Type.OBJECT,
      properties: {
        tr: { type: Type.STRING, description: 'City and country in Turkish (e.g., "Bodrum, Türkiye" or "Como Gölü, İtalya").' },
        en: { type: Type.STRING, description: 'City and country in English (e.g., "Bodrum, Turkey" or "Lake Como, Italy").' },
      },
      required: ['tr', 'en'],
    },
    venueType: {
      type: Type.OBJECT,
      properties: {
        tr: { type: Type.STRING, description: 'Short venue or service category in Turkish (e.g., "Boğaz Oteli", "Çiçek & Dekor").' },
        en: { type: Type.STRING, description: 'Short venue or service category in English (e.g., "Bosphorus Hotel", "Floral & Decor").' },
      },
      required: ['tr', 'en'],
    },
    capacityLabel: {
      type: Type.OBJECT,
      properties: {
        tr: { type: Type.STRING, description: 'Capacity or package summary in Turkish (e.g., "Maks. 250 Davetli" or "Tam Hizmet Paketi").' },
        en: { type: Type.STRING, description: 'Capacity or package summary in English (e.g., "Max 250 Guests" or "Full Service Package").' },
      },
      required: ['tr', 'en'],
    },
    originalCurrencyNote: {
      type: Type.OBJECT,
      properties: {
        tr: { type: Type.STRING, description: 'Short note in Turkish explaining original currency/amounts extracted from the file.' },
        en: { type: Type.STRING, description: 'Short note in English explaining original currency/amounts extracted from the file.' },
      },
      required: ['tr', 'en'],
    },
    baseFeeEur: {
      type: Type.NUMBER,
      description:
        'For venues: fixed venue rental fee normalized to EUR. For vendor_addon: fixed service package total normalized to EUR (use 0 if only per-person pricing exists). Convert TRY using 1 EUR = 38.5 TRY, USD using 1 EUR = 1.08 USD, GBP using 1 EUR = 0.85 GBP.',
    },
    fbPerPersonEur: {
      type: Type.NUMBER,
      description:
        'For venues: per-guest food & beverage price normalized to EUR. For vendor_addon: any per-guest service cost normalized to EUR (e.g., external catering per-guest menu cost; 0 if purely fixed fee).',
    },
    flags: {
      type: Type.ARRAY,
      description:
        'For venues: detected hidden costs, taxes (KDV/VAT/IVA), service charges, and included benefits. For vendor_addon: MUST include the main service package line item (type="risk", active=true) plus any separate excluded VAT/KDV or setup/delivery fees.',
      items: {
        type: Type.OBJECT,
        properties: {
          category: {
            type: Type.STRING,
            description:
              "Classify this item into one of: 'tax' (VAT/KDV/IVA/local taxes), 'catering' (F&B/external catering/kitchen setup), 'music' (SIAE/DJ/band/sound/lighting), 'floral' (flowers/decor), 'boat' (boat/water taxi/transfer/valet), 'photo' (photography/video), or 'other' (general venue/service fee).",
          },
          type: {
            type: Type.STRING,
            description: 'Must be either "risk" (for extra cost/excluded tax/vendor service fee) or "safe" (for included perk/protection).',
          },
          label: {
            type: Type.OBJECT,
            properties: {
              tr: { type: Type.STRING, description: 'Concise Turkish clause headline with amount/percentage if applicable.' },
              en: { type: Type.STRING, description: 'Concise English clause headline with amount/percentage if applicable.' },
            },
            required: ['tr', 'en'],
          },
          detail: {
            type: Type.OBJECT,
            properties: {
              tr: { type: Type.STRING, description: '1-sentence Turkish explanation of the financial impact or inclusion.' },
              en: { type: Type.STRING, description: '1-sentence English explanation of the financial impact or inclusion.' },
            },
            required: ['tr', 'en'],
          },
          calcType: {
            type: Type.STRING,
            description: 'Must be "fixed", "per_guest", or "vat_pct". For "safe" items use "fixed" with amount 0.',
          },
          amount: {
            type: Type.NUMBER,
            description: 'Numeric value in EUR (for fixed or per_guest) or percentage number like 20 or 22 (for vat_pct). 0 for safe items.',
          },
          active: {
            type: Type.BOOLEAN,
            description: 'true if this fee/tax should be included by default in turnkey total; false if optional or safe.',
          },
        },
        required: ['category', 'type', 'label', 'detail', 'calcType', 'amount', 'active'],
      },
    },
  },
  required: [
    'docCategory',
    'vendorCategory',
    'targetVenueHint',
    'nameFound',
    'name',
    'region',
    'venueType',
    'capacityLabel',
    'originalCurrencyNote',
    'baseFeeEur',
    'fbPerPersonEur',
    'flags',
  ],
};

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  app.post('/api/decode-quote', async (req, res) => {
    try {
      const { fileName, mimeType, base64Data } = req.body ?? {};
      if (!mimeType || !base64Data) {
        res.status(400).json({ error: 'Missing file data or mimeType.' });
        return;
      }

      if (!process.env.GEMINI_API_KEY) {
        res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
        return;
      }

      const promptText = `You are an elite luxury wedding financial auditor. Carefully read this uploaded quote image or PDF (filename: "${fileName || 'quote'}").
First, classify whether this document is a primary wedding venue/hotel/estate proposal ('venue') OR a standalone external vendor/service add-on quote ('vendor_addon') such as a florist, boat/water taxi charter, external catering company, DJ/band/sound/lighting, tent/production, or photography/video.

Rules:
1. Classification:
   - Set docCategory = 'venue' for wedding venues, hotels, villas, estates, or restaurants offering venue buyout/event hosting.
   - Set docCategory = 'vendor_addon' for standalone vendor quotes (floral/decor, boat/yacht/transfer, external catering, music/DJ/sound/lighting, photography/video, or other production service).
   - Set vendorCategory to 'floral', 'boat', 'catering', 'music', 'photo', or 'other' when docCategory is 'vendor_addon'; set 'venue' when docCategory is 'venue'.
   - If docCategory is 'vendor_addon' and the document explicitly mentions a target wedding venue/hotel name (e.g., "Delivery to Villa Balbiano" or "Çırağan Sarayı kurulumu"), put that venue name in targetVenueHint; otherwise set targetVenueHint = "".
2. Name Detection:
   - Put the exact venue name (for 'venue') or vendor/company name (for 'vendor_addon') in 'name' and set nameFound = true.
   - If NO name is visible (e.g., a cropped WhatsApp price snippet), set nameFound = false and 'name' = "" — NEVER invent or guess a name.
3. Currency Normalization to EUR:
   - EUR: keep as-is
   - TRY (₺ / TL): divide by 38.50
   - USD ($): divide by 1.08
   - GBP (£): divide by 0.85
4. Pricing & Category Alignment Extraction:
   - For EVERY item in flags[], set 'category' accurately to one of: 'tax', 'catering', 'music', 'floral', 'boat', 'photo', or 'other'.
   - For 'venue': put fixed venue rental in baseFeeEur, per-guest menu price in fbPerPersonEur. Put hidden costs, excluded VAT/KDV/IVA (category="tax", calcType="vat_pct"), service fees, SIAE/music (category="music"), external catering requirements (category="catering"), etc. in flags[].
   - IMPORTANT TAX RULE: If a venue quote explicitly states that VAT/KDV/IVA or taxes ARE INCLUDED (e.g., "KDV dahil", "VAT included", "IVA inclusa"), ALWAYS include a flag with category="tax", type="safe", calcType="fixed", amount=0, active=false (e.g., label.tr="KDV / Vergi Dahil", label.en="VAT / Taxes Included") so it aligns side-by-side with quotes where tax is excluded!
   - For 'vendor_addon': put fixed service total in baseFeeEur and any per-guest service cost in fbPerPersonEur. ALSO populate flags[] with the main service package line item (category matching vendorCategory, type="risk", active=true, calcType="fixed" or "per_guest", exact EUR amount) plus any separate setup/delivery fees and any excluded VAT/KDV/IVA (category="tax", type="risk", calcType="vat_pct", active=true) so it can be cleanly injected into a venue card as itemized rows. Do NOT double-count the same service fee across multiple flags.
5. Return clean, natural Turkish AND English labels and explanations.`;

      const ai = getAiClient();
      const modelsToTry = ['gemini-4-hydrogen', 'gemini-4-hydrogen', 'gemini-3.1-flash-lite', 'gemini-3.1-flash-lite'];
      let responseText = '';
      let usedModel = 'gemini-4-hydrogen';
      let lastError: unknown = null;

      for (let attempt = 0; attempt < modelsToTry.length; attempt++) {
        const modelName = modelsToTry[attempt];
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: base64Data,
                  },
                },
                { text: promptText },
              ],
            },
            config: {
              responseMimeType: 'application/json',
              responseSchema: quoteResponseSchema,
            },
          });

          responseText = (response.text ?? '').trim();
          if (responseText) {
            usedModel = modelName;
            break;
          }
        } catch (err) {
          lastError = err;
          const errStr = err instanceof Error ? err.message : String(err);
          const isTransient =
            errStr.includes('503') ||
            errStr.includes('UNAVAILABLE') ||
            errStr.includes('429') ||
            errStr.includes('RESOURCE_EXHAUSTED') ||
            errStr.includes('high demand');

          if (!isTransient) {
            throw err;
          }

          if (attempt < modelsToTry.length - 1) {
            const delayMs = 750 * (attempt + 1);
            await new Promise((r) => setTimeout(r, delayMs));
          }
        }
      }

      if (!responseText) {
        const rawMsg = lastError instanceof Error ? lastError.message : 'Model temporarily unavailable.';
        const isOverloaded = rawMsg.includes('503') || rawMsg.includes('UNAVAILABLE') || rawMsg.includes('high demand');
        res.status(isOverloaded ? 503 : 502).json({
          error: isOverloaded
            ? 'Yapay zeka servisinde anlık yoğunluk var (503). Lütfen birkaç saniye sonra tekrar deneyin veya manuel ekleyin.'
            : rawMsg,
        });
        return;
      }

      const parsed = JSON.parse(responseText);
      res.json({ venue: parsed, model: usedModel });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to decode quote.';
      console.error('Decode quote error:', message);
      const isOverloaded = message.includes('503') || message.includes('UNAVAILABLE') || message.includes('high demand');
      res.status(isOverloaded ? 503 : 500).json({
        error: isOverloaded
          ? 'Yapay zeka servisinde anlık yoğunluk var (503). Lütfen birkaç saniye sonra tekrar deneyin.'
          : message,
      });
    }
  });

  app.post('/api/find-venue-photo', async (req, res) => {
    try {
      const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
      const region = typeof req.body?.region === 'string' ? req.body.region.trim() : '';
      const force = Boolean(req.body?.force);

      if (!name || name.length < 2) {
        res.json({ found: false });
        return;
      }

      const cacheKey = `${name.toLowerCase()}::${region.toLowerCase()}`;
      if (!force) {
        const cached = venuePhotoCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
          res.json(cached.result);
          return;
        }
      }

      const wikiMatch = await searchWikimediaVenuePhoto(name, region);
      if (wikiMatch) {
        const result: VenuePhotoResult = {
          found: true,
          proxyUrl: `/api/venue-photo?url=${encodeURIComponent(wikiMatch.imageUrl)}`,
          sourceUrl: wikiMatch.sourceUrl,
          sourceLabel: wikiMatch.sourceLabel,
        };
        setVenuePhotoCache(cacheKey, result);
        res.json(result);
        return;
      }

      const officialMatch = await searchOfficialWebsitePhoto(name, region);
      if (officialMatch) {
        const result: VenuePhotoResult = {
          found: true,
          proxyUrl: `/api/venue-photo?url=${encodeURIComponent(officialMatch.imageUrl)}`,
          sourceUrl: officialMatch.sourceUrl,
          sourceLabel: officialMatch.sourceLabel,
        };
        setVenuePhotoCache(cacheKey, result);
        res.json(result);
        return;
      }

      const miss: VenuePhotoResult = { found: false };
      setVenuePhotoCache(cacheKey, miss);
      res.json(miss);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Photo search error';
      console.error('Find venue photo error:', msg);
      res.json({ found: false });
    }
  });

  app.get('/api/venue-photo', async (req, res) => {
    try {
      const rawUrl = typeof req.query?.url === 'string' ? req.query.url.trim() : '';
      if (!rawUrl) {
        res.status(400).json({ error: 'Missing image url.' });
        return;
      }

      const fetched = await safeFetchWithRedirects(rawUrl, {
        timeoutMs: 8000,
        accept: 'image/avif,image/webp,image/apng,image/jpeg,image/png,image/*;q=0.8',
      });
      if (!fetched || !fetched.response.ok) {
        res.status(404).json({ error: 'Image unavailable or blocked.' });
        return;
      }

      const contentType = (fetched.response.headers.get('content-type') || '').toLowerCase();
      if (!contentType.startsWith('image/') || contentType.includes('svg') || contentType.includes('icon')) {
        try {
          await fetched.response.body?.cancel();
        } catch {
          // ignore
        }
        res.status(415).json({ error: 'Unsupported remote content type.' });
        return;
      }

      const contentLength = Number(fetched.response.headers.get('content-length') || '0');
      if (contentLength > 10 * 1024 * 1024) {
        try {
          await fetched.response.body?.cancel();
        } catch {
          // ignore
        }
        res.status(413).json({ error: 'Image exceeds 10MB limit.' });
        return;
      }

      const arrayBuf = await fetched.response.arrayBuffer();
      if (arrayBuf.byteLength === 0 || arrayBuf.byteLength > 10 * 1024 * 1024) {
        res.status(413).json({ error: 'Invalid image payload size.' });
        return;
      }

      res.setHeader('Content-Type', contentType.split(';')[0] || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(Buffer.from(arrayBuf));
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Image proxy failed';
      console.error('Venue photo proxy error:', msg);
      res.status(502).json({ error: 'Failed to proxy venue photo.' });
    }
  });

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  if (process.env.NODE_ENV !== 'production') {
    let viteInstance: ViteDevServer | null = null;
    const viteReady = (async () => {
      const { createServer: createViteServer } = await import('vite');
      const instance = await createViteServer({
        server: {
          middlewareMode: true,
          hmr: false,
        },
        appType: 'spa',
      });
      viteInstance = instance;
      return instance;
    })();

    viteReady.catch((err) => {
      console.error('Vite middleware initialization failed:', err);
    });

    app.use(async (req, res, next) => {
      try {
        const vite = viteInstance ?? (await viteReady);
        vite.middlewares(req, res, next);
      } catch (err) {
        next(err);
      }
    });
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const portArgIdx = process.argv.indexOf('--port');
  const cliPort = portArgIdx !== -1 ? Number(process.argv[portArgIdx + 1]) : NaN;
  const port =
    Number.isFinite(cliPort) && cliPort > 0
      ? cliPort
      : process.env.NODE_ENV === 'production'
        ? Number(process.env.PORT) || 3000
        : 3000;

  app.listen(port, '0.0.0.0', () => {
    console.log(`Wedding Quote Decoder running on http://0.0.0.0:${port}`);
  });
}

startServer();
