import { CatalogPaint, Language } from "../types";
import { deltaE2000, labFromHex } from "./ciede2000";
import { FEATURED_BRANDS, localizedBrand } from "./paintCatalog";

export interface BrandTintModifierItem {
  name: string; // e.g. "纯白 / 光泽白 (White)"
  shortName: string; // e.g. "白"
  hex: string; // e.g. "#F8FAFC"
  pct: number; // e.g. 10
  drops: number; // e.g. 1
  roleLabel: string; // e.g. "提亮明度 +9%L"
}

export interface BrandTintRecipe {
  targetHex: string;
  basePaint: {
    id: string;
    brand: string;
    brandZh: string;
    code: string;
    name: string;
    hex: string;
  };
  deltaE: number;
  similarityPct: number;
  deltaL: number; // Target L% - Base L%
  deltaS: number; // Target S% - Base S%
  isDirectMatch: boolean; // True when deltaE <= 2.2
  basePct: number; // 75 ~ 100
  baseDrops: number; // Out of 10 total drops (e.g. 8.5, 9, 10)
  modifier: BrandTintModifierItem | null;
  effectTag: string; // e.g. "+9%L 提亮" or "直喷"
  compactPillText: string; // e.g. "🔧 微调：NDL033 (90%) + 白 (10%) · [+9%L 提亮]"
  shortFormulaText: string; // e.g. "NDL033 (90%) + 白 (10%)"
  spokenTip: string; // Beginner-friendly natural language tip
}

function hexToHslPct(hex: string): { h: number; s: number; l: number } {
  const clean = hex.replace("#", "").trim();
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return { h: 215, s: 65, l: 50 };
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function roundHalf(v: number): number {
  return Math.round(v * 2) / 2;
}

/**
 * Computes a beginner-friendly "Base Commercial Paint (75%~100%) + Drop-in Modifier (White/Black/Gray)"
 * recipe to reach `targetHex` starting from `basePaint`.
 */
export function computeBrandTintRecipe(
  targetHex: string,
  basePaint: {
    id?: string;
    brand: string;
    code: string;
    name: string;
    hex: string;
  },
  lang: Language = "zh"
): BrandTintRecipe {
  const normTarget = (targetHex || "#638FEC").toUpperCase();
  const normBase = (basePaint.hex || normTarget).toUpperCase();
  const brandZh = localizedBrand(basePaint.brand, lang === "ja" ? "ja" : "zh");

  const labTarget = labFromHex(normTarget);
  const labBase = labFromHex(normBase);
  const dE = Number(deltaE2000(labTarget, labBase).toFixed(1));
  const similarityPct = clamp(Math.round(100 - dE * 2.4), 60, 100);

  const hslTarget = hexToHslPct(normTarget);
  const hslBase = hexToHslPct(normBase);
  const deltaL = hslTarget.l - hslBase.l;
  const deltaS = hslTarget.s - hslBase.s;

  // Case 1: Extremely close match (ΔE <= 2.2 or negligible L/S difference)
  if (dE <= 2.2 || (Math.abs(deltaL) <= 2 && Math.abs(deltaS) <= 4)) {
    return {
      targetHex: normTarget,
      basePaint: {
        id: basePaint.id || `${basePaint.brand}-${basePaint.code}`,
        brand: basePaint.brand,
        brandZh,
        code: basePaint.code,
        name: basePaint.name,
        hex: normBase,
      },
      deltaE: dE,
      similarityPct: Math.max(96, similarityPct),
      deltaL,
      deltaS,
      isDirectMatch: true,
      basePct: 100,
      baseDrops: 10,
      modifier: null,
      effectTag: "直喷",
      compactPillText: `✅ [${brandZh} ${basePaint.code}] 原瓶直喷 (接近度 ${Math.max(96, similarityPct)}%)`,
      shortFormulaText: `${brandZh} ${basePaint.code} (直喷)`,
      spokenTip: `✅ 完美匹配【${brandZh} ${basePaint.code} ${basePaint.name}】（接近度 ${Math.max(
        96,
        similarityPct
      )}% · ΔE ${dE}），无需自己调色，直接开瓶喷涂即可！`,
    };
  }

  // Case 2: Needs brightening (+L), darkening (-L), or desaturation (-S)
  let modName = "纯白 / 光泽白 (White)";
  let modShort = "白";
  let modHex = "#F8FAFC";
  let modPct = 10;
  let effectTag = "";
  let roleLabel = "";

  if (deltaL >= 3) {
    modName = "纯白 / 冷白 (White)";
    modShort = "白";
    modHex = "#F8FAFC";
    modPct = clamp(Math.round(deltaL * 1.15), 5, 25);
    effectTag = `+${deltaL}%L 提亮`;
    roleLabel = `提亮明度 +${deltaL}%L`;
  } else if (deltaL <= -3) {
    modName = "消光黑 / 深灰 (Black)";
    modShort = "黑";
    modHex = "#1E293B";
    modPct = clamp(Math.round(Math.abs(deltaL) * 1.1), 5, 25);
    effectTag = `${deltaL}%L 压暗`;
    roleLabel = `压暗阴影 ${deltaL}%L`;
  } else if (deltaS <= -5) {
    modName = "标准中性灰 (Neutral Gray)";
    modShort = "灰";
    modHex = "#8E8E99";
    modPct = clamp(Math.round(Math.abs(deltaS) * 0.45), 5, 20);
    effectTag = `${deltaS}%S 降纯`;
    roleLabel = `柔和降纯 ${deltaS}%S`;
  } else {
    // Minor hue/chroma nudge
    const isLighter = deltaL >= 0;
    modName = isLighter ? "纯白 / 亮色剂 (White)" : "深灰 / 暗色剂 (Dark Gray)";
    modShort = isLighter ? "白" : "深灰";
    modHex = isLighter ? "#F8FAFC" : "#334155";
    modPct = clamp(Math.round(dE * 2.2), 5, 18);
    const signedL = deltaL >= 0 ? `+${deltaL}%L` : `${deltaL}%L`;
    effectTag = `${signedL} 微调`;
    roleLabel = `微调色阶 (${signedL})`;
  }

  const basePct = 100 - modPct;
  const modDrops = Math.max(0.5, roundHalf((modPct / 100) * 10));
  const baseDrops = roundHalf(10 - modDrops);
  const ratioPerOneDrop = Math.max(3, Math.round(basePct / Math.max(1, modPct)));

  const modifier: BrandTintModifierItem = {
    name: modName,
    shortName: modShort,
    hex: modHex,
    pct: modPct,
    drops: modDrops,
    roleLabel,
  };

  const compactPillText = `🔧 微调：${basePaint.code} (${basePct}%) + ${modShort} (${modPct}%) · [${effectTag}]`;
  const shortFormulaText = `${basePaint.code} (${basePct}%) + ${modShort} (${modPct}%)`;
  const spokenTip = `💡 以【${brandZh} ${basePaint.code} ${basePaint.name}】为底 (约 ${basePct}%) ➕ 加入【${modName.split(" ")[0]}】约 ${modPct}%（即每 ${ratioPerOneDrop} 滴主漆 + 1 滴${modShort}，${roleLabel}）`;

  return {
    targetHex: normTarget,
    basePaint: {
      id: basePaint.id || `${basePaint.brand}-${basePaint.code}`,
      brand: basePaint.brand,
      brandZh,
      code: basePaint.code,
      name: basePaint.name,
      hex: normBase,
    },
    deltaE: dE,
    similarityPct,
    deltaL,
    deltaS,
    isDirectMatch: false,
    basePct,
    baseDrops,
    modifier,
    effectTag,
    compactPillText,
    shortFormulaText,
    spokenTip,
  };
}

/**
 * Finds the top N closest commercial paints for a given hex color.
 */
export function findTopBrandMatchesForHex(
  hex: string,
  catalogPaints: CatalogPaint[],
  count = 4,
  lang: Language = "zh"
): { paint: CatalogPaint; deltaE: number; brandZh: string }[] {
  if (!catalogPaints || catalogPaints.length === 0) return [];
  const featuredSet = new Set(FEATURED_BRANDS);
  const featuredPool = catalogPaints.filter((p) => featuredSet.has(p.brand));
  const pool = featuredPool.length > 0 ? featuredPool : catalogPaints;
  const targetLab = labFromHex(hex);
  const scored: { paint: CatalogPaint; deltaE: number; brandZh: string }[] = [];
  for (const p of pool) {
    if (!p.lab || p.lab.length < 3) continue;
    const dE = deltaE2000(targetLab, [p.lab[0], p.lab[1], p.lab[2]]);
    scored.push({
      paint: p,
      deltaE: dE,
      brandZh: localizedBrand(p.brand, lang === "ja" ? "ja" : "zh"),
    });
  }
  scored.sort((a, b) => a.deltaE - b.deltaE);
  return scored.slice(0, count);
}
