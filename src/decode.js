import { classifyGeminiError } from './apikey.js';

export const MODELS = ['gemini-4-hydrogen', 'gemini-4-hydrogen', 'gemini-3.1-flash-lite', 'gemini-3.1-flash-lite'];

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    docCategory: {
      type: 'STRING',
      description:
        "Must be 'venue' if the document is a wedding venue/hotel/estate proposal, OR 'vendor_addon' if it is an external service quote (florist, boat/water taxi, external catering, DJ/band/lighting, tent/production, photography).",
    },
    vendorCategory: {
      type: 'STRING',
      description:
        "If docCategory is 'vendor_addon', classify as one of: 'floral', 'boat', 'catering', 'music', 'photo', or 'other'. If docCategory is 'venue', return 'venue'.",
    },
    targetVenueHint: {
      type: 'STRING',
      description:
        "If docCategory is 'vendor_addon' and the document explicitly mentions a target venue/hotel name (e.g., 'Delivery to Villa Balbiano'), return that venue name; otherwise return ''.",
    },
    nameFound: {
      type: 'BOOLEAN',
      description:
        'true if an explicit venue, hotel, estate, or vendor/company name is visible in the document; false if the name is missing or cropped out.',
    },
    name: {
      type: 'STRING',
      description: 'The exact venue or vendor company name found in the quote. If nameFound is false, return an empty string "".',
    },
    region: {
      type: 'OBJECT',
      properties: {
        tr: { type: 'STRING', description: 'City and country in Turkish (e.g., "Bodrum, Türkiye" or "Como Gölü, İtalya").' },
        en: { type: 'STRING', description: 'City and country in English (e.g., "Bodrum, Turkey" or "Lake Como, Italy").' },
      },
      required: ['tr', 'en'],
    },
    venueType: {
      type: 'OBJECT',
      properties: {
        tr: { type: 'STRING', description: 'Short venue or service category in Turkish (e.g., "Boğaz Oteli", "Çiçek & Dekor").' },
        en: { type: 'STRING', description: 'Short venue or service category in English (e.g., "Bosphorus Hotel", "Floral & Decor").' },
      },
      required: ['tr', 'en'],
    },
    capacityLabel: {
      type: 'OBJECT',
      properties: {
        tr: { type: 'STRING', description: 'Capacity or package summary in Turkish (e.g., "Maks. 250 Davetli" or "Tam Hizmet Paketi").' },
        en: { type: 'STRING', description: 'Capacity or package summary in English (e.g., "Max 250 Guests" or "Full Service Package").' },
      },
      required: ['tr', 'en'],
    },
    originalCurrencyNote: {
      type: 'OBJECT',
      properties: {
        tr: { type: 'STRING', description: 'Short note in Turkish explaining original currency/amounts extracted from the file.' },
        en: { type: 'STRING', description: 'Short note in English explaining original currency/amounts extracted from the file.' },
      },
      required: ['tr', 'en'],
    },
    baseFeeEur: {
      type: 'NUMBER',
      description:
        'For venues: fixed venue rental fee normalized to EUR. For vendor_addon: fixed service package total normalized to EUR (use 0 if only per-person pricing exists). Convert TRY using 1 EUR = 38.5 TRY, USD using 1 EUR = 1.08 USD, GBP using 1 EUR = 0.85 GBP.',
    },
    fbPerPersonEur: {
      type: 'NUMBER',
      description:
        'For venues: per-guest food & beverage price normalized to EUR. For vendor_addon: any per-guest service cost normalized to EUR (e.g., external catering per-guest menu cost; 0 if purely fixed fee).',
    },
    flags: {
      type: 'ARRAY',
      description:
        'For venues: detected hidden costs, taxes (KDV/VAT/IVA), service charges, and included benefits. For vendor_addon: MUST include the main service package line item (type="risk", active=true) plus any separate excluded VAT/KDV or setup/delivery fees.',
      items: {
        type: 'OBJECT',
        properties: {
          category: {
            type: 'STRING',
            description:
              "Classify this item into one of: 'tax' (VAT/KDV/IVA/local taxes), 'catering' (F&B/external catering/kitchen setup), 'music' (SIAE/DJ/band/sound/lighting), 'floral' (flowers/decor), 'boat' (boat/water taxi/transfer/valet), 'photo' (photography/video), or 'other' (general venue/service fee).",
          },
          type: {
            type: 'STRING',
            description: 'Must be either "risk" (for extra cost/excluded tax/vendor service fee) or "safe" (for included perk/protection).',
          },
          label: {
            type: 'OBJECT',
            properties: {
              tr: { type: 'STRING', description: 'Concise Turkish clause headline with amount/percentage if applicable.' },
              en: { type: 'STRING', description: 'Concise English clause headline with amount/percentage if applicable.' },
            },
            required: ['tr', 'en'],
          },
          detail: {
            type: 'OBJECT',
            properties: {
              tr: { type: 'STRING', description: '1-sentence Turkish explanation of the financial impact or inclusion.' },
              en: { type: 'STRING', description: '1-sentence English explanation of the financial impact or inclusion.' },
            },
            required: ['tr', 'en'],
          },
          calcType: {
            type: 'STRING',
            description:
              'Must be "fixed", "per_guest", "service_pct", or "vat_pct". Use "service_pct" for a percentage service charge / service fee (servis bedeli, service charge, gratuity) and "vat_pct" only for VAT/KDV/IVA/taxes. For "safe" items use "fixed" with amount 0.',
          },
          amount: {
            type: 'NUMBER',
            description: 'Numeric value in EUR (for fixed or per_guest) or percentage number like 10 or 20 (for service_pct or vat_pct). 0 for safe items.',
          },
          active: {
            type: 'BOOLEAN',
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

const buildPrompt = (safeName) => `You are an elite luxury wedding financial auditor. Carefully read this uploaded quote image or PDF (filename: "${safeName}").
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
   - SERVICE CHARGE RULE: a percentage service charge/fee (e.g. "servis %10", "service charge 12%") MUST use calcType="service_pct" (category="other"), NEVER "vat_pct". Only taxes use "vat_pct".
   - For 'venue': put fixed venue rental in baseFeeEur, per-guest menu price in fbPerPersonEur. Put hidden costs, excluded VAT/KDV/IVA (category="tax", calcType="vat_pct"), service fees, SIAE/music (category="music"), external catering requirements (category="catering"), etc. in flags[].
   - IMPORTANT TAX RULE: If a venue quote explicitly states that VAT/KDV/IVA or taxes ARE INCLUDED (e.g., "KDV dahil", "VAT included", "IVA inclusa"), ALWAYS include a flag with category="tax", type="safe", calcType="fixed", amount=0, active=false (e.g., label.tr="KDV / Vergi Dahil", label.en="VAT / Taxes Included") so it aligns side-by-side with quotes where tax is excluded!
   - For 'vendor_addon': put fixed service total in baseFeeEur and any per-guest service cost in fbPerPersonEur. ALSO populate flags[] with the main service package line item (category matching vendorCategory, type="risk", active=true, calcType="fixed" or "per_guest", exact EUR amount) plus any separate setup/delivery fees and any excluded VAT/KDV/IVA (category="tax", type="risk", calcType="vat_pct", active=true) so it can be cleanly injected into a venue card as itemized rows. Do NOT double-count the same service fee across multiple flags.
5. Return clean, natural Turkish AND English labels and explanations.`;

export class DecodeError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const MESSAGES = {
  API_KEY_INVALID: 'Gemini API anahtarınız geçersiz görünüyor. Anahtarı kontrol edip yeniden girin.',
  OVERLOADED: 'Yapay zeka servisinde anlık yoğunluk var. Lütfen birkaç saniye sonra tekrar deneyin veya manuel ekleyin.',
  NETWORK: 'Bağlantı kurulamadı. İnternetinizi kontrol edip tekrar deneyin.',
  FAILED: 'Bu belge okunamadı. Daha net bir görsel deneyin ya da rakamları kendiniz girin.',
};

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function decodeQuote({
  apiKey,
  fileName,
  mimeType,
  base64Data,
  fetchImpl = (...args) => fetch(...args),
  sleep = defaultSleep,
}) {
  const safeName = String(fileName || 'quote').replace(/"/g, '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const body = JSON.stringify({
    contents: [{ parts: [{ inlineData: { mimeType, data: base64Data } }, { text: buildPrompt(safeName) }] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
  });

  let sawTransient = false;
  for (let attempt = 0; attempt < MODELS.length; attempt++) {
    const model = MODELS[attempt];
    let response;
    try {
      response = await fetchImpl(`${ENDPOINT}/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body,
      });
    } catch {
      throw new DecodeError('NETWORK', MESSAGES.NETWORK);
    }

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const detail = `${response.status} ${payload?.error?.status ?? ''} ${payload?.error?.message ?? ''}`;
      const kind = classifyGeminiError(detail);
      if (kind === 'key_invalid') throw new DecodeError('API_KEY_INVALID', MESSAGES.API_KEY_INVALID);
      if (kind === 'model_unavailable') continue;
      if (kind === 'transient') {
        sawTransient = true;
        if (attempt < MODELS.length - 1) await sleep(750 * (attempt + 1));
        continue;
      }
      throw new DecodeError('FAILED', MESSAGES.FAILED);
    }

    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text === 'string' && text.trim()) {
      try {
        return { venue: JSON.parse(text), model };
      } catch {
        continue;
      }
    }
  }

  throw new DecodeError(sawTransient ? 'OVERLOADED' : 'FAILED', sawTransient ? MESSAGES.OVERLOADED : MESSAGES.FAILED);
}
