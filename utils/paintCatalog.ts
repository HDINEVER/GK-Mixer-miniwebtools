import { CatalogPaint, PaintBrand, PaintBrandGroup, PaintMatch } from "../types";
import { deltaE2000, labFromHex, Lab } from "./ciede2000";

export const FEATURED_BRANDS = [
  "Gaia",
  "Jumpwind",
  "Hobby Mio",
  "Night Works",
  "Sunin7",
  "Gunze",
  "Mr.Hobby",
  "Tamiya",
  "Vallejo",
  "Citadel",
  "AK",
  "AK Real Colors",
  "Army Painter",
  "Golden",
  "Green Stuff World",
  "Kimera Kolors",
  "Scale75",
];

/**
 * Default mainstream brands shown in the Paint Catalog Browser by default
 * (hides niche/uncommon overseas miniature & craft paint brands unless toggled on).
 */
export const COMMON_MODEL_BRANDS = [
  "Gaia",
  "Jumpwind",
  "Hobby Mio",
  "Night Works",
  "Sunin7",
  "Mr.Hobby",
  "Gunze",
  "Tamiya",
  "Vallejo",
  "Citadel",
  "AK",
  "AK Real Colors",
];

export type PaintApplicationType = "airbrush" | "brush";
export type PaintSolventType = "oil" | "water";

const AIRBRUSH_PRIMARY_BRANDS = new Set([
  "Gaia",
  "Jumpwind",
  "Hobby Mio",
  "Sunin7",
  "Mr.Hobby",
  "Gunze",
  "Tamiya",
  "AK Real Colors",
]);

/**
 * Distinguishes Oil-based (硝基/珐琅 油性漆) from Water-based (水性/丙烯漆) paints,
 * including brand-internal series distinctions (e.g. Jumpwind Aqueous JW-A, Mr.Hobby H/N, Tamiya X/XF vs LP/TS).
 */
export const getPaintSolventType = (paint: CatalogPaint): PaintSolventType => {
  const brand = paint.brand.trim();
  const code = (paint.code || "").trim();
  const setLower = (paint.set || "").toLowerCase();
  const nameLower = (paint.name || "").toLowerCase();

  // Pure oil-based lacquer/enamel brands
  if (
    brand === "Gaia" ||
    brand === "Hobby Mio" ||
    brand === "Sunin7" ||
    brand === "AK Real Colors"
  ) {
    return "oil";
  }

  // Jumpwind (匠域): JW-A / Aqueous is water-based; Basic/MEKA/NEO/Metal/Pearl/Clear are oil-based lacquer
  if (brand === "Jumpwind") {
    if (
      setLower.includes("aqueous") ||
      setLower.includes("水性") ||
      /^jw-?a/i.test(code) ||
      nameLower.includes("水性")
    ) {
      return "water";
    }
    return "oil";
  }

  // Mr.Hobby (郡士): H (Aqueous Hobby Color) and N (Acrysion) are water-based; C/GX/SM/UG/CL are oil-based
  if (brand === "Mr.Hobby") {
    if (
      setLower.includes("aqueous") ||
      setLower.includes("acrysion") ||
      setLower.includes("水性") ||
      /^[hn]\d/i.test(code) ||
      nameLower.includes("水性")
    ) {
      return "water";
    }
    return "oil";
  }

  // Gunze (郡士水性): Acrysion series is water-based unless C/GX lacquer code
  if (brand === "Gunze") {
    if (/^(c|gx|sm|mr)\d/i.test(code) || setLower.includes("mr color")) {
      return "oil";
    }
    return "water";
  }

  // Tamiya (田宫): LP (Lacquer Paint), TS / AS (Spray), Enamel are oil-based; X / XF (Acrylic Mini) are water-based
  if (brand === "Tamiya") {
    if (
      setLower.includes("lacquer") ||
      setLower.includes("spray") ||
      setLower.includes("enamel") ||
      /^(lp|ts|as)-?\d/i.test(code)
    ) {
      return "oil";
    }
    return "water";
  }

  // Vallejo / AK / Citadel / Night Works & miniature brands: mostly water-based except Liquid Gold / Spray / Enamel / Real Colors
  if (
    setLower.includes("liquid gold") ||
    setLower.includes("hobby paint") ||
    setLower.includes("spray") ||
    setLower.includes("enamel") ||
    setLower.includes("lacquer") ||
    setLower.includes("real color") ||
    setLower.includes("xtreme metal") ||
    setLower.includes("油性") ||
    setLower.includes("硝基")
  ) {
    return "oil";
  }

  return "water";
};

/**
 * Distinguishes Airbrush/Spray paints (喷涂漆) from Hand-Brush/Water-based Miniature paints (手涂漆).
 */
export const getPaintApplicationType = (paint: CatalogPaint): PaintApplicationType => {
  const brand = paint.brand.trim();
  const setLower = (paint.set || "").toLowerCase();
  const nameLower = (paint.name || "").toLowerCase();

  if (brand === "Night Works") {
    if (
      setLower.includes("预调喷涂") ||
      setLower.includes("水补土") ||
      nameLower.includes("预调喷涂")
    ) {
      return "airbrush";
    }
    return "brush";
  }

  if (AIRBRUSH_PRIMARY_BRANDS.has(brand)) {
    if (setLower.includes("笔涂") || nameLower.includes("笔涂")) {
      return "brush";
    }
    return "airbrush";
  }

  // Water-based / miniature brands: check if it's an Air / Airbrush / Primer series
  if (
    /\bair\b/.test(setLower) ||
    setLower.includes("airbrush") ||
    setLower.includes("mecha") ||
    setLower.includes("primer") ||
    setLower.includes("喷涂") ||
    /\bair\b/.test(nameLower)
  ) {
    return "airbrush";
  }

  return "brush";
};

export const localizedBrand = (brand: string, lang: "en" | "zh" | "ja") => {
  if (lang !== "zh") return brand;
  switch (brand) {
    case "Gaia":
      return "盖亚";
    case "Jumpwind":
      return "匠域";
    case "Hobby Mio":
      return "喵匠";
    case "Night Works":
      return "夜之工坊";
    case "Sunin7":
      return "星影";
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

export const NIGHTWORKS_CATEGORY_ORDER = [
  "薄涂漆",
  "底涂漆",
  "对比漆",
  "笔涂金属漆",
  "预调喷涂金属漆",
  "预调喷涂消光色",
  "阴影洗漆",
  "滤镜罩染漆",
  "笔涂荧光色",
  "预调喷涂荧光色",
  "战棋水补土",
  "特效漆",
];

export const GAIA_CATEGORY_ORDER = [
  "001–099 基础标准色",
  "EX 大瓶装系列",
  "GP 魔幻与高级色",
  "棱镜偏光与珍珠色",
  "星光与金属色",
  "荧光色系列",
  "NAZCA 机甲专业色",
  "GS 水补土 Evo",
  "EVA 福音战士限定色",
  "VO 电脑战机限定色",
  "FG 机娘联名限定色",
  "GE 珐琅与旧化特殊色",
  "军事色系列",
  "铁道模型色",
];

export const paintPrefix = (paint: CatalogPaint): string => {
  if (paint.brand === "Night Works") {
    return paint.set.trim() || OTHER_PREFIX;
  }
  const code = paint.code.trim();
  const set = paint.set.trim();
  if (paint.brand === "Gaia") {
    if (set && set !== "Gaia Notes") {
      return set;
    }
    if (/^\d{3}$/.test(code)) {
      const value = Number(code);
      if (value < 100) return "001–099 基础标准色";
      if (value < 200) return "100–199 特殊/金属/荧光";
      return "军事色系列";
    }
    return set || OTHER_PREFIX;
  }
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
    if (!rest || /[0-9\-._ ]/.test(rest[0])) {
      const upper = letters.toUpperCase();
      if (upper === paint.brand.trim().toUpperCase() && set) {
        return set;
      }
      return upper;
    }
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
    if (brand === "Night Works") {
      const li = NIGHTWORKS_CATEGORY_ORDER.indexOf(a);
      const ri = NIGHTWORKS_CATEGORY_ORDER.indexOf(b);
      const left = li === -1 ? Number.MAX_SAFE_INTEGER : li;
      const right = ri === -1 ? Number.MAX_SAFE_INTEGER : ri;
      if (left !== right) return left - right;
    }
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

  findClosest(hex: string, limit = 4, solidsOnly = true): PaintMatch[] {
    const target = labFromHex(hex);
    if (!target) return [];
    const allPaints: CatalogPaint[] = [];
    for (const list of this.paintsByBrand.values()) {
      allPaints.push(...list);
    }
    return this.topMatches(allPaints, target, solidsOnly, "", limit);
  }

  findClosestByBrands(
    hex: string,
    brands: string[],
    limit = 4,
    solidsOnly = true
  ): PaintMatch[] {
    const target = labFromHex(hex);
    if (!target) return [];
    const scopedPaints: CatalogPaint[] = [];
    for (const b of brands) {
      const list = this.paintsByBrand.get(b);
      if (list) scopedPaints.push(...list);
    }
    return this.topMatches(scopedPaints, target, solidsOnly, "", limit);
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

export const nearestCatalogPaintWithDeltaE = (
  paints: CatalogPaint[],
  hex: string,
  brands = FEATURED_BRANDS,
  solidsOnly = true
): { paint: CatalogPaint; deltaE: number } | undefined => {
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
  return best ? { paint: best, deltaE: bestDelta } : undefined;
};

export const nearestCatalogPaint = (
  paints: CatalogPaint[],
  hex: string,
  brands = FEATURED_BRANDS,
  solidsOnly = true
): CatalogPaint | undefined => {
  return nearestCatalogPaintWithDeltaE(paints, hex, brands, solidsOnly)?.paint;
};
