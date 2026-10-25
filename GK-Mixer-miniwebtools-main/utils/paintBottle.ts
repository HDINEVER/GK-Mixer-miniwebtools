const HOSTS = [
  "/paints",
  "https://gkcolor-mixer.pages.dev/paints",
  "https://modkitswatch.afifzafri.com/paints",
  "https://cdn.jsdelivr.net/gh/afzafri/modkit-swatch@main/public/paints",
];

const BRAND_SLUG: Record<string, string> = {
  Gaia: "gaianotes",
  Gaianotes: "gaianotes",
  盖亚: "gaianotes",
  Jumpwind: "jumpwind",
  匠域: "jumpwind",
  "Hobby Mio": "hobby-mio",
  喵匠: "hobby-mio",
  "Night Works": "nightworks",
  夜之工坊: "nightworks",
  Sunin7: "sunin7",
  星影: "sunin7",
  "Mr.Hobby": "mr-color",
  "Mr Color": "mr-color",
  "Mr. Color": "mr-color",
  Gunze: "mr-color",
  郡士: "mr-color",
  Tamiya: "tamiya",
  田宫: "tamiya",
};

const codeCandidates = (brand: string, code: string): string[] => {
  const raw = String(code || "").trim();
  if (!raw) return [];
  const compact = raw.replace(/\s+/g, "");
  const preferred: string[] = [];

  if (brand === "Gaia" || brand === "Gaianotes" || brand === "盖亚") {
    const ex = compact.match(/^EX-?(\d+[A-Za-z]?)$/i);
    if (ex) {
      const num = ex[1].padStart(2, "0");
      preferred.push(`Ex-${num}`, `EX-${num}`, `EX${num}`, `ex-${num}`);
    }
    const series = compact.match(/^(GP|SP|EV|VO|FG|GS|NC|NP|GE|TL)-?([0-9A-Za-z]+)$/i);
    if (series) {
      const pfx = series[1].toUpperCase();
      const rest = series[2].toUpperCase();
      preferred.push(
        `${pfx}-${rest}`,
        `${pfx}${rest}`,
        `${pfx}-${series[2]}`,
        `${pfx.toLowerCase()}-${rest.toLowerCase()}`
      );
    }
  }
  if (brand === "Jumpwind" || brand === "匠域") {
    const mc = compact.match(/^MC\.?(\d+)$/i);
    if (mc) preferred.push(`MC${mc[1]}`);
  }
  if (brand === "Mr.Hobby" || brand === "Gunze" || brand === "郡士") {
    const digits = compact.match(/^C?(\d+[A-Za-z]?)$/i);
    if (digits) preferred.push(`C${digits[1]}`);
  }

  return [
    ...new Set([
      ...preferred,
      compact.replace(/\./g, ""),
      compact,
      raw,
    ]),
  ];
};

export const paintBottleUrls = (brand: string, code: string): string[] => {
  const slug = BRAND_SLUG[brand];
  if (!slug) return [];
  const codes = codeCandidates(brand, code);
  const urls: string[] = [];
  for (const host of HOSTS) {
    for (const item of codes) {
      urls.push(`${host}/${slug}/${encodeURIComponent(item)}.jpg`);
    }
  }
  return urls;
};

export const hasPaintBottleImage = (brand: string): boolean =>
  Boolean(BRAND_SLUG[brand]);
