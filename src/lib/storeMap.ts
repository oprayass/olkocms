// Central store resolver — single source of truth
// जुनसुकै input (cuid / email / Excel text / alias) → canonical display name

interface StoreInfo {
  cuid: string;
  email: string;
  name: string;
  active: boolean;
}

// Active stores (DarazStore table सँग मिल्ने)
export const STORES: StoreInfo[] = [
  { cuid: "cmprwajvg0000mqyvdz6wtw98", email: "yagyapremiums@gmail.com",      name: "Yagya Premiums",     active: true },
  { cuid: "cmprxpxqy0000jmafgoe2cxxd", email: "budgetdealsnepal@gmail.com",   name: "Budget Deal",        active: true },
  { cuid: "cmprxw8jg0001jmafa97cnedj", email: "blackdragonnepal@gmail.com",   name: "Black Dragon",       active: true },
  { cuid: "cmpry2jil0002jmafz062s19p", email: "dealmeonsnepal@gmail.com",     name: "Deal Me",            active: true },
  { cuid: "cmpry6t130003jmafp262sgzp", email: "firstdrop79@gmail.com",        name: "New Idea",           active: true },
  { cuid: "cmpryagir0004jmafkp9sqkp6", email: "gadgetfinder2020@gmail.com",   name: "Raibaar Infotel",    active: true },
  { cuid: "cmpryeoep0005jmafjrgbrb2p", email: "gadgetsfindernepal@gmail.com", name: "Batuk Mart",         active: true },
  { cuid: "cmpryj9pm0006jmafim0lj9c5", email: "selfcarenepa@gmail.com",       name: "Premium Lifestyle",  active: true },
  { cuid: "cmprymwy00007jmaf9z110uiy", email: "tb200247@gmail.com",           name: "Best Gadget Nepal",  active: true },
];

// Aliases — Excel text variants, पुराना/बन्द store नाम → canonical name
// (lowercase मा match हुन्छ)
const ALIASES: Record<string, string> = {
  // Yagya Premiums
  "yagya premiums": "Yagya Premiums",
  "yagya": "Yagya Premiums",
  // Budget Deal
  "budget deal": "Budget Deal",
  "budget": "Budget Deal",
  // Black Dragon
  "black dragon": "Black Dragon",
  // Deal Me
  "deal me": "Deal Me",
  "dealme": "Deal Me",
  // New Idea
  "new idea": "New Idea",
  // Raibaar Infotel
  "raibaar infotel": "Raibaar Infotel",
  "raibar infotel": "Raibaar Infotel",
  // Batuk Mart (+ पुरानो नाम "Gadget Finder")
  "batuk mart": "Batuk Mart",
  "gadget finder": "Batuk Mart",
  "gadgetfinder": "Batuk Mart",
  // Premium Lifestyle
  "premium lifestyle": "Premium Lifestyle",
  "premiums life style": "Premium Lifestyle",
  "premiums lifestyle": "Premium Lifestyle",
  // Best Gadget Nepal
  "best gadget nepal": "Best Gadget Nepal",
  // बन्द/पुरानो stores (DarazStore मा छैन)
  "nepal shopping center": "Nepal Shopping Center (Closed)",
};

// Lookup maps (fast resolve)
const byCuid = new Map(STORES.map((s) => [s.cuid, s]));
const byEmail = new Map(STORES.map((s) => [s.email.toLowerCase(), s]));

/**
 * जुनसुकै store identifier लाई display name मा resolve गर्ने।
 * @param input - cuid, email, Excel text, alias, वा raw string
 * @returns display name (नभेटिए raw input वा "Unknown Store")
 */
export function resolveStoreName(input: string | null | undefined): string {
  if (!input) return "Unknown Store";
  const raw = input.trim();
  if (!raw) return "Unknown Store";

  // 1. cuid मा match
  const byId = byCuid.get(raw);
  if (byId) return byId.name;

  // 2. email मा match
  const byMail = byEmail.get(raw.toLowerCase());
  if (byMail) return byMail.name;

  // 3. alias / Excel text मा match
  const alias = ALIASES[raw.toLowerCase()];
  if (alias) return alias;

  // 4. नभेटिए — raw value नै देखाउने (email जस्तो भए @ अघिको भाग)
  if (raw.includes("@")) return raw.split("@")[0];
  return raw;
}

/**
 * Excel store text → canonical cuid (import मा प्रयोग)
 * @returns cuid वा null (नभेटिए)
 */
export function resolveStoreCuid(input: string | null | undefined): string | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw) return null;

  // already cuid?
  if (byCuid.has(raw)) return raw;

  // email?
  const byMail = byEmail.get(raw.toLowerCase());
  if (byMail) return byMail.cuid;

  // alias → name → cuid
  const name = ALIASES[raw.toLowerCase()];
  if (name) {
    const store = STORES.find((s) => s.name === name);
    if (store) return store.cuid;
  }

  return null;
}