const HOSTS = [
  "https://modkitswatch.afifzafri.com/paints",
  "https://cdn.jsdelivr.net/gh/afzafri/modkit-swatch@main/public/paints",
];

const BRAND_SLUG: Record<string, string> = {
  Gaia: "gaianotes",
  Gaianotes: "gaianotes",
  Jumpwind: "jumpwind",
  "Hobby Mio": "hobby-mio",
  Sunin7: "sunin7",
  "Mr.Hobby": "mr-color",
  "Mr Color": "mr-color",
  "Mr. Color": "mr-color",
  Tamiya: "tamiya",
};

const codeCandidates = (brand: string, code: string): string[] => {
  const raw = String(code || "").trim();
  if (!raw) return [];
  const compact = raw.replace(/\s+/g, "");
  const preferred: string[] = [];

  if (brand === "Jumpwind") {
    const mc = compact.match(/^MC\.?(\d+)$/i);
    if (mc) preferred.push(`MC${mc[1]}`);
  }
  if (brand === "Mr.Hobby" || brand === "Gunze") {
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
