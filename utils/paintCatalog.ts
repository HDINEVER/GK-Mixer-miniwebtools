import { CatalogPaint, PaintBrand, PaintBrandGroup, PaintMatch } from "../types";
import { deltaE2000, labFromHex, Lab } from "./ciede2000";

export const FEATURED_BRANDS = [
  "Gaia",
  "Jumpwind",
  "Hobby Mio",
  "Sunin7",
  "QNC",
  "Gunze",
  "Mr.Hobby",
  "Tamiya",
  "Vallejo",
  "Citadel",
  "AK",
];

export const localizedBrand = (brand: string, lang: "en" | "zh" | "ja") => {
  if (lang !== "zh") return brand;
  switch (brand) {
    case "Gaia":
      return "盖亚";
    case "Jumpwind":
      return "匠域";
    case "Hobby Mio":
      return "星影";
    case "Sunin7":
      return "七色";
    case "Gunze":
      return "郡士水性";
    case "Mr.Hobby":
      return "郡士";
    case "Tamiya":
      return "田宫";
    default:
      return brand;
  }
};

export type MatchQuality = "close" | "usable" | "reference" | "browse";

export const matchQuality = (deltaE: number): MatchQuality => {
  if (deltaE < 2) return "close";
  if (deltaE < 5) return "usable";
  if (deltaE < 10) return "reference";
  return "browse";
};

export const matchQualityLabel = (deltaE: number, lang: "en" | "zh" | "ja") => {
  const quality = matchQuality(deltaE);
  const labels = {
    close: { zh: "接近", en: "Close", ja: "近い" },
    usable: { zh: "可参考", en: "Usable", ja: "参考可" },
    reference: { zh: "仅供浏览", en: "Reference", ja: "参考" },
    browse: { zh: "色差较大", en: "Far", ja: "差大" },
  };
  return labels[quality][lang];
};

const OTHER_PREFIX = "其他";

export const paintPrefix = (paint: CatalogPaint): string => {
  const code = paint.code.trim();
  const set = paint.set.trim();
  const dot = code.indexOf(".");
  if (dot > 0 && [...code.slice(0, dot)].every((ch) => ch >= "0" && ch <= "9")) {
    return `${code.slice(0, dot)}.`;
  }
  let letters = "";
  for (const ch of code) {
    if (/[A-Za-z]/.test(ch)) letters += ch;
    else break;
  }
  if (letters.length >= 1 && letters.length <= 4) {
    const rest = code.slice(letters.length);
    if (!rest || /[0-9\-._ ]/.test(rest[0])) return letters.toUpperCase();
  }
  if (/^\d{3,}$/.test(code)) {
    const value = Number(code);
    const base = Math.floor(value / 100) * 100;
    return `${base}–${base + 99}`;
  }
  return set || OTHER_PREFIX;
};

export const sortPaints = (paints: CatalogPaint[]) =>
  [...paints].sort((a, b) => {
    const code = a.code.localeCompare(b.code, undefined, { numeric: true });
    if (code !== 0) return code;
    return a.name.localeCompare(b.name);
  });

export const prefixGroups = (
  paints: CatalogPaint[],
  brand: string,
  searchText: string,
  solidsOnly: boolean,
  prefixFilter?: string | null
) => {
  const filtered = paints.filter((paint) => {
    if (paint.brand !== brand) return false;
    if (solidsOnly && paint.finish !== "standard") return false;
    if (searchText) {
      const hay = `${paint.code} ${paint.name} ${paint.hex} ${paint.set}`.toLowerCase();
      if (!hay.includes(searchText.toLowerCase())) return false;
    }
    return true;
  });
  const codePrefixes = new Set(filtered.map(paintPrefix));
  const bucket = new Map<string, CatalogPaint[]>();
  for (const paint of filtered) {
    const key =
      codePrefixes.size <= 1 && paint.set.trim()
        ? paint.set.trim()
        : paintPrefix(paint);
    const list = bucket.get(key) ?? [];
    list.push(paint);
    bucket.set(key, list);
  }
  const prefixes = [...bucket.keys()].sort((a, b) => {
    if (a === OTHER_PREFIX) return 1;
    if (b === OTHER_PREFIX) return -1;
    return a.localeCompare(b, undefined, { numeric: true });
  });
  const groups = prefixes
    .filter((prefix) => !prefixFilter || prefix === prefixFilter)
    .map((prefix) => ({ prefix, paints: sortPaints(bucket.get(prefix) ?? []) }));
  return { groups, prefixes };
};

interface CatalogFile {
  paints?: CatalogPaint[];
}

let catalogPromise: Promise<CatalogPaint[]> | null = null;

export const loadPaintCatalog = (): Promise<CatalogPaint[]> => {
  if (!catalogPromise) {
    catalogPromise = fetch("/PaintCatalog.json")
      .then((response) => {
        if (!response.ok) throw new Error(`Paint catalog ${response.status}`);
        return response.json() as Promise<CatalogFile>;
      })
      .then((data) => data.paints ?? [])
      .catch((error) => {
        console.warn("Failed to load paint catalog", error);
        catalogPromise = null;
        return [];
      });
  }
  return catalogPromise;
};

const labOf = (paint: CatalogPaint): Lab => {
  if (paint.lab?.length >= 3) {
    return { l: paint.lab[0], a: paint.lab[1], b: paint.lab[2] };
  }
  return labFromHex(paint.hex) ?? { l: 0, a: 0, b: 0 };
};

export class PaintMatchEngine {
  private paintsByBrand: Map<string, CatalogPaint[]>;
  readonly brandOrder: string[];

  constructor(
    paints: CatalogPaint[],
    readonly perBrand = 3
  ) {
    this.paintsByBrand = new Map();
    for (const paint of paints) {
      const list = this.paintsByBrand.get(paint.brand) ?? [];
      list.push(paint);
      this.paintsByBrand.set(paint.brand, list);
    }
    this.brandOrder = [...this.paintsByBrand.keys()].sort((lhs, rhs) => {
      const li = FEATURED_BRANDS.indexOf(lhs);
      const ri = FEATURED_BRANDS.indexOf(rhs);
      const left = li === -1 ? Number.MAX_SAFE_INTEGER : li;
      const right = ri === -1 ? Number.MAX_SAFE_INTEGER : ri;
      if (left !== right) return left - right;
      return lhs.localeCompare(rhs);
    });
  }

  get brands() {
    return this.brandOrder;
  }

  groupedMatches(options: {
    hex: string;
    brands?: Set<string>;
    solidsOnly?: boolean;
    search?: string;
    perBrand?: number;
  }): PaintBrandGroup[] {
    const target = labFromHex(options.hex);
    if (!target) return [];
    const selected = options.brands?.size
      ? this.brandOrder.filter((brand) => options.brands!.has(brand))
      : this.brandOrder;
    const query = options.search?.trim().toLowerCase() ?? "";
    const limit = options.perBrand ?? this.perBrand;
    const solidsOnly = options.solidsOnly !== false;

    return selected.flatMap((brand) => {
      const catalog = this.paintsByBrand.get(brand);
      if (!catalog) return [];
      const matches = this.topMatches(catalog, target, solidsOnly, query, limit);
      return matches.length ? [{ brand, matches }] : [];
    });
  }

  private topMatches(
    catalog: CatalogPaint[],
    target: Lab,
    solidsOnly: boolean,
    query: string,
    limit: number
  ): PaintMatch[] {
    const best: PaintMatch[] = [];
    for (const paint of catalog) {
      if (solidsOnly && paint.finish !== "standard") continue;
      if (query) {
        const hay = `${paint.code} ${paint.name} ${paint.hex} ${paint.set} ${paint.brand}`.toLowerCase();
        if (!hay.includes(query)) continue;
      }
      const deltaE = deltaE2000(target, labOf(paint));
      if (best.length < limit) {
        best.push({ paint, deltaE });
        best.sort((a, b) => a.deltaE - b.deltaE);
      } else if (deltaE < best[best.length - 1].deltaE) {
        best[best.length - 1] = { paint, deltaE };
        best.sort((a, b) => a.deltaE - b.deltaE);
      }
    }
    return best;
  }
}

export const catalogToPaintBrand = (paint: CatalogPaint): PaintBrand => ({
  id: paint.id,
  brand: paint.brand,
  code: paint.code,
  name: paint.name,
  hex: paint.hex,
});

export const nearestCatalogPaint = (
  paints: CatalogPaint[],
  hex: string,
  brands = FEATURED_BRANDS,
  solidsOnly = true
): CatalogPaint | undefined => {
  const target = labFromHex(hex);
  if (!target || !paints.length) return undefined;
  const allowed = new Set(brands);
  let best: CatalogPaint | undefined;
  let bestDelta = Infinity;
  for (const paint of paints) {
    if (allowed.size && !allowed.has(paint.brand)) continue;
    if (solidsOnly && paint.finish !== "standard") continue;
    const deltaE = deltaE2000(target, labOf(paint));
    if (deltaE < bestDelta) {
      bestDelta = deltaE;
      best = paint;
    }
  }
  return best;
};
