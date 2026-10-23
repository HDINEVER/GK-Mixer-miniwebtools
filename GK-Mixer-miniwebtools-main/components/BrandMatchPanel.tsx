import React, { useEffect, useMemo, useState } from "react";
import { CatalogPaint, Language, PaintBrand, PaintBrandGroup, PaintMatch } from "../types";
import PaintBottleHover, { PaintBottleImg } from "./PaintBottleHover";
import IOSSearchBar from "./IOSSearchBar";
import {
  CheckIcon,
  ArrowsClockwiseIcon,
  FlaskIcon,
  PaletteIcon,
  CaretDownIcon,
  SquaresFour as SquaresFourIcon,
  ListIcon,
  SparkleIcon,
} from "@phosphor-icons/react";
import {
  FEATURED_BRANDS,
  PaintMatchEngine,
  catalogToPaintBrand,
  loadPaintCatalog,
  localizedBrand,
  matchQuality,
  matchQualityLabel,
} from "../utils/paintCatalog";
import { computeBrandTintRecipe } from "../utils/brandTintRecipe";

function shiftHexLightness(hex: string, deltaLPct: number): string {
  if (deltaLPct === 0) return hex.toUpperCase();
  const clean = hex.replace("#", "").trim();
  const num = parseInt(clean, 16);
  if (Number.isNaN(num)) return hex.toUpperCase();
  let r = ((num >> 16) & 255) / 255;
  let g = ((num >> 8) & 255) / 255;
  let b = (num & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  let l = (max + min) / 2;
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
  l = Math.max(0.08, Math.min(0.95, l + deltaLPct / 100));
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  let nr = l;
  let ng = l;
  let nb = l;
  if (s !== 0) {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    nr = hue2rgb(p, q, h + 1 / 3);
    ng = hue2rgb(p, q, h);
    nb = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, "0");
  return `#${toHex(nr)}${toHex(ng)}${toHex(nb)}`.toUpperCase();
}

export interface BrandMatchPanelProps {
  hex: string | null;
  lang: Language;
  selectable?: boolean;
  selectedId?: string | null;
  assignedId?: string | null;
  onSelect?: (paint: PaintBrand) => void;
  onAssignCatalog?: (paint: CatalogPaint) => void;
  compact?: boolean;
  disableInternalScroll?: boolean;
  hasSamplePoint?: boolean;
  // Tab 2 "近邻" standalone props
  standaloneMode?: boolean;
  onChangeHex?: (hex: string) => void;
  onSyncToWorkbench?: (hex: string) => void;
  onOpenChromaMatrix?: (hex: string) => void;
  sourceOptions?: {
    workbenchHex?: string | null;
    customMixHex?: string | null;
    basicMixHex?: string | null;
    libraryHex?: string | null;
  };
}

export const BrandMatchPanel: React.FC<BrandMatchPanelProps> = ({
  hex: hexProp,
  lang,
  selectable = false,
  selectedId,
  assignedId,
  onSelect,
  onAssignCatalog,
  compact = false,
  disableInternalScroll = false,
  hasSamplePoint = false,
  standaloneMode = false,
  onChangeHex,
  onSyncToWorkbench,
  onOpenChromaMatrix,
  sourceOptions,
}) => {
  const [localHex, setLocalHex] = useState<string>(hexProp || "#3B6EE4");
  const [activeSourceLabel, setActiveSourceLabel] = useState<string>("混色台");
  const [showSourceMenu, setShowSourceMenu] = useState(false);
  const [showBrandPopover, setShowBrandPopover] = useState(false);
  const [viewMode, setViewMode] = useState<"card" | "list">("card");
  const [tintDeltaL, setTintDeltaL] = useState<number>(0);
  const [selectedTintBaseIdx, setSelectedTintBaseIdx] = useState<number>(0);

  useEffect(() => {
    if (hexProp) {
      setLocalHex(hexProp.toUpperCase());
      setTintDeltaL(0);
      setSelectedTintBaseIdx(0);
    }
  }, [hexProp]);

  const hex = standaloneMode ? localHex : hexProp;

  const [paints, setPaints] = useState<CatalogPaint[] | null>(null);
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(
    () => new Set(FEATURED_BRANDS)
  );
  const [solidsOnly, setSolidsOnly] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    loadPaintCatalog().then((loaded) => {
      if (!cancelled) setPaints(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const engine = useMemo(
    () => (paints ? new PaintMatchEngine(paints, compact ? 2 : 4) : null),
    [paints, compact]
  );

  const allBrands = useMemo(() => {
    if (!engine) return FEATURED_BRANDS;
    const extra = engine.brands.filter((b) => !FEATURED_BRANDS.includes(b));
    return [...FEATURED_BRANDS, ...extra];
  }, [engine]);

  const groups: PaintBrandGroup[] = useMemo(() => {
    if (!engine || !hex) return [];
    return engine.groupedMatches({
      hex,
      brands: selectedBrands,
      solidsOnly,
      search,
    });
  }, [engine, hex, selectedBrands, solidsOnly, search]);

  const totalMatchesCount = useMemo(
    () => groups.reduce((acc, g) => acc + g.matches.length, 0),
    [groups]
  );

  // Top 6 featured closest matches across all selected brands
  const top6Matches: PaintMatch[] = useMemo(() => {
    const flat: PaintMatch[] = [];
    for (const g of groups) {
      for (const m of g.matches) {
        flat.push(m);
      }
    }
    flat.sort((a, b) => a.deltaE - b.deltaE);
    return flat.slice(0, 6);
  }, [groups]);

  const tintedTargetHex = useMemo(
    () => (hex ? shiftHexLightness(hex, tintDeltaL) : "#3B6EE4"),
    [hex, tintDeltaL]
  );

  const activeTintBasePaint = useMemo(() => {
    if (top6Matches.length === 0) return null;
    const safeIdx = Math.min(selectedTintBaseIdx, Math.min(2, top6Matches.length - 1));
    return top6Matches[safeIdx]?.paint || top6Matches[0].paint;
  }, [top6Matches, selectedTintBaseIdx]);

  const activeTintRecipe = useMemo(() => {
    if (!activeTintBasePaint || !tintedTargetHex) return null;
    return computeBrandTintRecipe(tintedTargetHex, activeTintBasePaint, lang);
  }, [activeTintBasePaint, tintedTargetHex, lang]);

  const toggleBrand = (brand: string) => {
    setSelectedBrands((prev) => {
      const next = new Set(prev);
      if (next.has(brand)) {
        if (next.size === 1) return prev;
        next.delete(brand);
      } else {
        next.add(brand);
      }
      return next;
    });
  };

  const handlePickManualColor = (newHex: string) => {
    const up = newHex.toUpperCase();
    setLocalHex(up);
    setActiveSourceLabel("手动");
    onChangeHex?.(up);
  };

  const handleSelectSource = (label: string, targetHex?: string | null) => {
    setShowSourceMenu(false);
    setActiveSourceLabel(label);
    if (targetHex) {
      const up = targetHex.toUpperCase();
      setLocalHex(up);
      onChangeHex?.(up);
    }
  };

  if (!hex) return null;

  return (
    <div className="flex flex-col gap-3.5 w-full max-w-full min-w-0">
      {/* Desktop (lg+) standalone: target bar + search side-by-side; mobile keeps stacked rows */}
      <div
        className={
          standaloneMode
            ? "flex flex-col gap-3.5 lg:grid lg:grid-cols-12 lg:gap-4 lg:items-center"
            : "contents"
        }
      >
      {/* 1. Compact Single-Line Target Color Bar (~68px height) when in Tab 2 "近邻" standalone mode */}
      {standaloneMode ? (
        <div className="bp-subcard-lg relative lg:col-span-6 flex items-center justify-between gap-2 rounded-2xl border border-slate-200/85 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl px-3.5 py-2.5 shadow-xs min-h-[66px]">
          {/* Left: 42x42 Swatch + HEX + Subtitle (Clickable to pick color) */}
          <label
            className="flex items-center gap-3 cursor-pointer min-w-0 group"
            title="点击重选目标颜色"
          >
            <input
              type="color"
              value={hex}
              onChange={(e) => handlePickManualColor(e.target.value)}
              className="sr-only"
            />
            <span
              className="bp-swatch h-[42px] w-[42px] rounded-xl border-2 border-white dark:border-slate-700 shadow-md shrink-0 transition-transform group-hover:scale-105"
              style={{ backgroundColor: hex }}
            />
            <div className="min-w-0 leading-tight">
              <div className="font-mono text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight truncate">
                {hex.toUpperCase()}
              </div>
              <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500 truncate mt-0.5">
                {activeSourceLabel} · 点击重选
              </div>
            </div>
          </label>

          {/* Right: Single-line [🔄 来源] Dropdown Pill + [🧪 同步混色台] Solid Accent Pill */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSourceMenu((v) => !v)}
                className="bp-pill flex items-center gap-1 rounded-full border border-slate-200/90 dark:border-slate-700 bg-slate-100/90 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200/80 transition cursor-pointer whitespace-nowrap"
              >
                <ArrowsClockwiseIcon className="h-3.5 w-3.5 text-slate-500" weight="bold" />
                <span>来源</span>
                <CaretDownIcon className="h-3 w-3 opacity-70" />
              </button>

              {showSourceMenu && (
                <div className="bp-subcard-lg absolute right-0 top-full mt-1.5 z-40 w-44 rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-1.5 shadow-xl space-y-0.5">
                  {[
                    { label: "混色台拾色", hexVal: sourceOptions?.workbenchHex || hexProp },
                    { label: "自选调色结果", hexVal: sourceOptions?.customMixHex },
                    { label: "基础混色结果", hexVal: sourceOptions?.basicMixHex },
                    { label: "涂装库色卡", hexVal: sourceOptions?.libraryHex },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      disabled={!item.hexVal}
                      onClick={() => handleSelectSource(item.label, item.hexVal)}
                      className="w-full flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition"
                    >
                      <span className="truncate">{item.label}</span>
                      {item.hexVal && (
                        <span
                          className="bp-dot h-3.5 w-3.5 rounded-full border border-black/15 shrink-0"
                          style={{ backgroundColor: item.hexVal }}
                        />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {onSyncToWorkbench && (
              <button
                type="button"
                onClick={() => onSyncToWorkbench(hex)}
                className="bp-pill-active flex items-center gap-1 rounded-full bg-coral px-3 py-1.5 text-xs font-extrabold text-white shadow-sm hover:opacity-95 active:scale-95 transition cursor-pointer whitespace-nowrap"
                title="将该颜色同步至混色台进行配方分解"
              >
                <FlaskIcon className="h-3.5 w-3.5" weight="bold" />
                <span>同步混色台</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-xs font-bold tracking-wider text-accent">
            {lang === "zh" ? "品牌近邻" : lang === "ja" ? "ブランド近似" : "BRAND MATCH"}
            <span className="bp-badge rounded-full bg-accent/12 dark:bg-accent/20 px-2 py-0.5 text-[10px] font-semibold text-accent dark:text-accent-light">
              CIEDE2000
            </span>
          </h3>
        </div>
      )}

      {onAssignCatalog && !standaloneMode && (
        <p className="text-[10px] leading-relaxed text-slate-400">
          {hasSamplePoint
            ? lang === "zh"
              ? "点击下方任意品牌漆卡片（或右侧「使用」）即可为取样点生成悬浮色卡。"
              : "Tap any paint card or [Use] to pin a floating swatch at the sample point."
            : lang === "zh"
              ? "先在图上点击取样点，再点击漆卡即可生成色卡。"
              : "Select a sample point first, then tap any paint card."}
        </p>
      )}

      {/* 2. Search Bar */}
      <div className="flex items-center gap-2 w-full max-w-full min-w-0 lg:col-span-6 pr-1.5 pb-0.5">
        <div className="flex-1 min-w-0">
          <IOSSearchBar
            value={search}
            onChange={setSearch}
            placeholder={
              lang === "zh"
                ? "搜索色号 / 名称 / 品牌"
                : lang === "ja"
                  ? "品番・色名で検索"
                  : "Search code / name"
            }
          />
        </div>
        <button
          type="button"
          onClick={() => setSolidsOnly(!solidsOnly)}
          className={`h-10 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition shrink-0 cursor-pointer whitespace-nowrap ${
            solidsOnly
              ? "bp-pill-active bg-accent text-white border-transparent shadow-xs"
              : "bp-pill bg-slate-100/90 dark:bg-slate-800/90 text-slate-600 dark:text-slate-400 border-slate-200/60 dark:border-slate-700/60"
          }`}
        >
          <span
            className={`bp-dot w-3.5 h-3.5 rounded flex items-center justify-center text-[10px] border ${
              solidsOnly
                ? "bg-white text-accent border-white"
                : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            }`}
          >
            {solidsOnly && <CheckIcon className="w-2.5 h-2.5" weight="bold" />}
          </span>
          <span>{lang === "zh" ? "仅实色" : "Solids"}</span>
        </button>
      </div>
      </div>

      {/* 2.5. 现成品牌漆 + 明度微调补正助手 (Smart Tint Corrector) */}
      {standaloneMode && activeTintRecipe && (
        <div className="bp-subcard-lg rounded-2xl border border-slate-200/85 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 p-3.5 shadow-xs space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="bp-badge px-2 py-0.5 rounded-md bg-accent/15 text-accent dark:text-white text-[10px] font-black font-mono">
                🍼 滴数微调助手
              </span>
              <span className="text-xs font-black text-slate-900 dark:text-white">
                现成品牌漆 + 几滴微调补正配方 (Smart Tint Corrector)
              </span>
            </div>
            {onOpenChromaMatrix && (
              <button
                type="button"
                onClick={() => onOpenChromaMatrix(tintedTargetHex)}
                className="bp-pill flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:border-accent transition cursor-pointer"
              >
                <SquaresFourIcon className="h-3.5 w-3.5 text-accent" />
                <span>打开完整 7×7 明度色卡</span>
              </button>
            )}
          </div>

          {/* 5 阶快捷明暗微调条 + 候选基底漆切换 */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
            <div className="lg:col-span-5 space-y-1">
              <div className="text-[10px] font-bold text-slate-400 flex items-center justify-between">
                <span>① 点选期望明暗变化（或保持 0%L 原色）：</span>
                <span className="font-mono text-slate-600 dark:text-slate-300">目标 {tintedTargetHex}</span>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {[
                  { dL: -16, label: "-16%L 阴影" },
                  { dL: -8, label: "-8%L 微暗" },
                  { dL: 0, label: "0%L 原目标" },
                  { dL: 8, label: "+8%L 提亮" },
                  { dL: 16, label: "+16%L 高光" },
                ].map((step) => {
                  const stepHex = shiftHexLightness(hex, step.dL);
                  const active = tintDeltaL === step.dL;
                  return (
                    <button
                      key={step.dL}
                      type="button"
                      onClick={() => setTintDeltaL(step.dL)}
                      className={`bp-swatch flex flex-col items-center justify-between p-1.5 rounded-lg border text-center transition cursor-pointer ${
                        active
                          ? "border-accent ring-2 ring-accent/40 scale-[1.02]"
                          : "border-slate-200 dark:border-slate-700 opacity-85 hover:opacity-100"
                      }`}
                      style={{ backgroundColor: stepHex }}
                    >
                      <span className="px-1 py-0.5 rounded bg-black/45 text-white font-mono text-[8px] font-black leading-none whitespace-nowrap">
                        {step.label}
                      </span>
                      <span className="mt-1 font-mono text-[8px] font-bold px-1 rounded bg-white/85 text-slate-900 leading-tight">
                        {stepHex}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-7 space-y-2">
              {/* 选择手头/想买的主品牌漆 */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-400 mr-1">② 选择主基底品牌漆：</span>
                {top6Matches.slice(0, 3).map((m, idx) => {
                  const brandZh = localizedBrand(m.paint.brand, lang);
                  const active = idx === selectedTintBaseIdx;
                  return (
                    <button
                      key={m.paint.id}
                      type="button"
                      onClick={() => setSelectedTintBaseIdx(idx)}
                      className={`bp-pill flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold border transition cursor-pointer ${
                        active
                          ? "bp-pill-active border-accent bg-accent text-white shadow-2xs"
                          : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-accent"
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-full border border-white/60 shrink-0"
                        style={{ backgroundColor: m.paint.hex }}
                      />
                      <span>
                        {brandZh} {m.paint.code} {m.paint.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* 滴数补正结果区 */}
              {activeTintRecipe.isDirectMatch ? (
                <div className="bp-subcard rounded-xl border border-emerald-500/40 bg-emerald-500/10 dark:bg-emerald-950/50 px-3 py-2 flex items-center justify-between gap-3">
                  <div className="text-xs font-extrabold text-emerald-900 dark:text-emerald-100 leading-snug">
                    {activeTintRecipe.spokenTip}
                  </div>
                  <span
                    className="bp-swatch w-8 h-8 rounded-lg border border-black/15 shrink-0"
                    style={{ backgroundColor: activeTintRecipe.basePaint.hex }}
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    <div className="bp-subcard flex items-center justify-between gap-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 px-2.5 py-1.5 text-[11px]">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="w-4 h-4 rounded border border-black/15 shrink-0"
                          style={{ backgroundColor: activeTintRecipe.basePaint.hex }}
                        />
                        <span className="font-extrabold text-slate-800 dark:text-slate-100 truncate">
                          🧴 主漆：【{activeTintRecipe.basePaint.brandZh} {activeTintRecipe.basePaint.code}】
                        </span>
                      </div>
                      <span className="font-mono font-black text-accent shrink-0">
                        {activeTintRecipe.basePct}% (约{activeTintRecipe.baseDrops}滴)
                      </span>
                    </div>

                    {activeTintRecipe.modifier && (
                      <div className="bp-subcard flex items-center justify-between gap-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 px-2.5 py-1.5 text-[11px]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="w-4 h-4 rounded border border-slate-300 dark:border-slate-600 shrink-0"
                            style={{ backgroundColor: activeTintRecipe.modifier.hex }}
                          />
                          <span className="font-extrabold text-slate-800 dark:text-slate-100 truncate">
                            ➕ 补正：【{activeTintRecipe.modifier.name.split(" ")[0]}】
                          </span>
                        </div>
                        <span className="font-mono font-black text-amber-600 dark:text-amber-400 shrink-0">
                          {activeTintRecipe.modifier.pct}% (约{activeTintRecipe.modifier.drops}滴)
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 零接缝对比条 + 口诀 */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="bp-swatch grid grid-cols-2 h-7 sm:w-44 shrink-0 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 text-[9px] font-mono font-bold">
                      <div
                        className="px-2 flex items-center justify-between text-white"
                        style={{ backgroundColor: activeTintRecipe.basePaint.hex }}
                      >
                        <span>原漆</span>
                        <span>{activeTintRecipe.basePaint.code}</span>
                      </div>
                      <div
                        className="px-2 flex items-center justify-between text-white"
                        style={{ backgroundColor: activeTintRecipe.targetHex }}
                      >
                        <span>目标</span>
                        <span>{activeTintRecipe.effectTag}</span>
                      </div>
                    </div>
                    <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200 leading-snug flex-1">
                      {activeTintRecipe.spokenTip}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. Merged Results Header Row: Left [匹配结果 XX 款], Center [🎨 品牌 (N) ⌄], Right [色卡 | 列表] */}
      <div className="relative flex flex-wrap items-center justify-between gap-2 pt-0.5 pr-1.5 pb-0.5">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100 whitespace-nowrap">
            匹配结果 {totalMatchesCount} 款
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Center: Merged Brand Filter Pill Button */}
          <button
            type="button"
            onClick={() => setShowBrandPopover((v) => !v)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              showBrandPopover
                ? "bp-pill-active border-accent bg-accent/10 text-accent dark:bg-accent/20 dark:text-accent-light"
                : "bp-pill border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-accent/60"
            }`}
          >
            <PaletteIcon className="h-3.5 w-3.5 text-accent" weight="bold" />
            <span>品牌 ({selectedBrands.size})</span>
            <CaretDownIcon
              className={`h-3 w-3 transition-transform ${showBrandPopover ? "rotate-180" : ""}`}
            />
          </button>

          {/* Right: [色卡 | 列表] Segmented View Toggle */}
          <div className="bp-segmented inline-flex rounded-full bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200/80 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setViewMode("card")}
              className={`bp-segmented-item flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition cursor-pointer whitespace-nowrap ${
                viewMode === "card"
                  ? "bp-segmented-item-active bg-white dark:bg-slate-900 text-accent dark:text-white shadow-2xs"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              <SquaresFourIcon className="h-3 w-3 shrink-0" />
              <span>色卡</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`bp-segmented-item flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition cursor-pointer whitespace-nowrap ${
                viewMode === "list"
                  ? "bp-segmented-item-active bg-white dark:bg-slate-900 text-accent dark:text-white shadow-2xs"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              <ListIcon className="h-3 w-3 shrink-0" />
              <span>列表</span>
            </button>
          </div>
        </div>

        {/* Collapsible Brand Filter Popover */}
        {showBrandPopover && (
          <div className="bp-subcard-lg w-full mt-1.5 rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-3 shadow-lg space-y-2.5 z-30">
            <div className="flex items-center justify-between text-xs">
              <span className="font-extrabold text-slate-700 dark:text-slate-200">
                筛选模型漆品牌 ({selectedBrands.size}/{allBrands.length})
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedBrands(new Set(allBrands))}
                  className="text-[11px] font-bold text-accent dark:text-accent-light hover:underline whitespace-nowrap"
                >
                  全选
                </button>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedBrands(new Set(FEATURED_BRANDS))}
                  className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white whitespace-nowrap"
                >
                  重置常用
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {allBrands.map((brand) => {
                const isSelected = selectedBrands.has(brand);
                return (
                  <button
                    key={brand}
                    type="button"
                    onClick={() => toggleBrand(brand)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? "bp-pill-active bg-accent text-white shadow-2xs"
                        : "bp-pill bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                    }`}
                  >
                    {localizedBrand(brand, lang)}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 4. Top 6 Featured Matches (精选匹配 TOP 6) with high-contrast #1~#6 badges */}
      {!compact && top6Matches.length > 0 && viewMode === "card" && (
        <div className="space-y-2 pr-1.5 pb-1.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <SparkleIcon className="h-3.5 w-3.5 text-amber-500" weight="fill" />
              <span>精选匹配 TOP 6</span>
            </span>
            <span className="text-[10px] font-mono text-slate-400">跨品牌最小色差排序</span>
          </div>

          <div
            className={
              standaloneMode
                ? "grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 md:gap-3"
                : "grid grid-cols-2 sm:grid-cols-3 gap-2"
            }
          >
            {top6Matches.map((match, idx) => {
              const rank = idx + 1;
              const used = assignedId === match.paint.id;
              const isInteractive = !!onAssignCatalog || selectable;
              const handleCardClick = () => {
                if (onAssignCatalog) onAssignCatalog(match.paint);
                else if (selectable) onSelect?.(catalogToPaintBrand(match.paint));
              };

              return (
                <div
                  key={`top6-${match.paint.id}`}
                  role={isInteractive ? "button" : undefined}
                  tabIndex={isInteractive ? 0 : undefined}
                  onClick={handleCardClick}
                  className={`bp-subcard-lg bp-subcard-interactive group relative flex flex-col justify-between rounded-2xl border p-2.5 transition-all ${
                    isInteractive ? "cursor-pointer active:scale-[0.98]" : ""
                  } ${
                    used
                      ? "bp-subcard-active border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 ring-1 ring-emerald-500/40"
                      : "border-slate-200/85 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-accent/60 shadow-xs"
                  }`}
                >
                  {/* Color Swatch Header with High-Contrast Rank Badge (#1 gold, #2~#6 dark charcoal glass) */}
                  <div
                    className={`bp-swatch bp-bottom-divider relative h-14 ${standaloneMode ? "md:h-20" : ""} w-full rounded-xl border border-black/10 dark:border-white/10 overflow-hidden mb-2 flex items-center justify-center`}
                    style={{ backgroundColor: match.paint.hex }}
                  >
                    <PaintBottleImg
                      brand={match.paint.brand}
                      code={match.paint.code}
                      className="h-12 w-12 object-contain drop-shadow-sm"
                    />
                    <span
                      className={`bp-badge absolute left-1.5 top-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] font-black leading-none shadow-sm ${
                        rank === 1
                          ? "bg-amber-400 text-slate-950 border border-white/60"
                          : "bg-slate-900/82 text-white backdrop-blur-md border border-white/25"
                      }`}
                    >
                      #{rank}
                    </span>
                    <span className="bp-badge absolute right-1.5 bottom-1.5 rounded-md bg-slate-900/78 backdrop-blur-md px-1.5 py-0.5 font-mono text-[9px] font-bold text-white border border-white/15">
                      ΔE {match.deltaE.toFixed(1)}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-[10px] font-bold text-accent dark:text-accent-light">
                        {localizedBrand(match.paint.brand, lang)}
                      </span>
                      <span className="font-mono text-[10px] font-bold text-slate-400">
                        {match.paint.code}
                      </span>
                    </div>
                    <div className="truncate text-xs font-extrabold text-slate-900 dark:text-white mt-0.5">
                      {match.paint.name}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Grouped Brand Results (Card or Compact List Mode) */}
      {!paints ? (
        <div className="py-4 text-center text-[11px] text-slate-400">
          {lang === "zh" ? "正在载入色库…" : "Loading catalog…"}
        </div>
      ) : (
        <div
          className={`space-y-3 pr-1.5 pb-1.5 ${
            disableInternalScroll || standaloneMode
              ? ""
              : compact
                ? "max-h-56 overflow-y-auto"
                : "max-h-80 overflow-y-auto"
          }`}
        >
          {groups.map((group) => (
            <div key={group.brand}>
              <div className="bp-dashed-header mb-1.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                <span>{localizedBrand(group.brand, lang)}</span>
                <span className="bp-badge px-1.5 py-0.5 rounded text-[10px] font-mono font-normal">
                  {group.matches.length} {lang === "zh" ? "款匹配" : "matches"}
                </span>
              </div>
              <div
                className={
                  viewMode === "card"
                    ? standaloneMode
                      ? "grid grid-cols-1 gap-1.5 lg:grid-cols-2 lg:gap-3 xl:grid-cols-3"
                      : "space-y-1.5"
                    : "bp-subcard-lg divide-y divide-slate-100 dark:divide-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"
                }
              >
                {group.matches.map((match) => {
                  const active = selectedId === match.paint.id;
                  const used = assignedId === match.paint.id;
                  const quality = matchQuality(match.deltaE);
                  const qualityClass =
                    quality === "close"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : quality === "usable"
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-slate-400";
                  const useLabel = used
                    ? lang === "zh"
                      ? "已选配"
                      : "Used"
                    : lang === "zh"
                      ? "使用"
                      : "Use";

                  const isInteractive = !!onAssignCatalog || selectable;

                  const handleItemClick = () => {
                    if (onAssignCatalog) {
                      onAssignCatalog(match.paint);
                    } else if (selectable) {
                      onSelect?.(catalogToPaintBrand(match.paint));
                    }
                  };

                  if (viewMode === "list") {
                    return (
                      <div
                        key={match.paint.id}
                        role={isInteractive ? "button" : undefined}
                        tabIndex={isInteractive ? 0 : undefined}
                        onClick={handleItemClick}
                        className={`flex items-center justify-between gap-2.5 px-3 py-2 text-xs transition ${
                          isInteractive ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60" : ""
                        } ${used ? "bg-emerald-50/60 dark:bg-emerald-950/30" : ""}`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="bp-swatch h-6 w-6 rounded-lg border border-black/15 shrink-0"
                            style={{ backgroundColor: match.paint.hex }}
                          />
                          <span className="font-mono font-bold text-slate-900 dark:text-white shrink-0">
                            {match.paint.code}
                          </span>
                          <span className="truncate font-medium text-slate-700 dark:text-slate-200">
                            {match.paint.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`font-mono text-[11px] font-bold ${qualityClass}`}>
                            ΔE {match.deltaE.toFixed(1)}
                          </span>
                          {onAssignCatalog && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onAssignCatalog(match.paint);
                              }}
                              className={`rounded-lg px-2 py-1 text-[11px] font-bold whitespace-nowrap ${
                                used
                                  ? "bp-use-btn-used bg-emerald-600 text-white"
                                  : "bp-use-btn bg-accent/10 dark:bg-accent/20 text-accent dark:text-accent-light"
                              }`}
                            >
                              {useLabel}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <PaintBottleHover
                      key={match.paint.id}
                      brand={match.paint.brand}
                      code={match.paint.code}
                      name={match.paint.name}
                      hex={match.paint.hex}
                    >
                      <div
                        role={isInteractive ? "button" : undefined}
                        tabIndex={isInteractive ? 0 : undefined}
                        onClick={handleItemClick}
                        onKeyDown={(e) => {
                          if (isInteractive && (e.key === "Enter" || e.key === " ")) {
                            e.preventDefault();
                            handleItemClick();
                          }
                        }}
                        className={`bp-subcard bp-subcard-interactive group relative flex w-full max-w-full min-w-0 items-center gap-2.5 sm:gap-3 rounded-xl sm:rounded-2xl border p-2 sm:p-2.5 transition-all duration-150 active:scale-[0.985] ${
                          isInteractive ? "cursor-pointer" : ""
                        } ${
                          used
                            ? "bp-subcard-active border-emerald-500/70 bg-emerald-50/70 dark:bg-emerald-950/40 ring-1 ring-emerald-500/40 shadow-xs"
                            : active
                              ? "bp-subcard-active border-accent bg-accent/10 ring-1 ring-accent shadow-xs"
                              : "border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-800/80 hover:border-accent/60 hover:bg-accent/5 dark:hover:border-accent/50 dark:hover:bg-slate-800 shadow-xs"
                        }`}
                      >
                        <div
                          className="bp-swatch relative h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 rounded-xl border border-black/15 dark:border-white/15 shadow-sm overflow-hidden flex items-center justify-center"
                          style={{ backgroundColor: match.paint.hex }}
                        >
                          <PaintBottleImg
                            brand={match.paint.brand}
                            code={match.paint.code}
                            className="h-full w-full object-contain p-0.5"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="block truncate font-mono text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-accent dark:group-hover:text-accent-light transition-colors">
                            {match.paint.code} {match.paint.name}
                          </span>
                          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-mono text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                            <span>{match.paint.hex}</span>
                            {match.paint.set ? <span>· {match.paint.set}</span> : null}
                            <span className={`font-bold ${qualityClass}`}>
                              · ΔE {match.deltaE.toFixed(1)} · {matchQualityLabel(match.deltaE, lang)}
                            </span>
                          </div>
                        </div>
                        {onAssignCatalog && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onAssignCatalog(match.paint);
                            }}
                            className={`flex min-h-[34px] sm:min-h-[36px] min-w-[3.75rem] sm:min-w-[4.25rem] flex-shrink-0 items-center justify-center gap-1 rounded-xl px-2.5 sm:px-3 text-xs font-bold transition-all duration-150 active:scale-95 cursor-pointer shadow-xs whitespace-nowrap ${
                              used
                                ? "bp-use-btn-used bg-emerald-600 text-white shadow-emerald-500/25"
                                : "bp-use-btn bg-accent/10 text-accent hover:bg-accent hover:text-white dark:bg-accent/20 dark:text-accent-light dark:hover:bg-accent dark:hover:text-white border border-accent/25 dark:border-accent/40"
                            }`}
                          >
                            {used && <CheckIcon className="w-3.5 h-3.5" weight="bold" />}
                            <span>{useLabel}</span>
                          </button>
                        )}
                      </div>
                    </PaintBottleHover>
                  );
                })}
              </div>
            </div>
          ))}
          {groups.length === 0 && (
            <div className="py-6 text-center text-xs text-slate-400">
              {lang === "zh" ? "没有匹配结果" : "No matches"}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ==========================================
// 供 Tab 3 涂装工程详情页「指派油漆详情」复用的模块 B：近似匹配推荐卡片
// ==========================================
export const NearestMatchesModule: React.FC<{
  hex: string;
  lang: Language;
  currentBrand?: string;
  currentCode?: string;
  onReplacePaint?: (paint: CatalogPaint) => void;
}> = ({ hex, lang, currentBrand, currentCode, onReplacePaint }) => {
  const [paints, setPaints] = useState<CatalogPaint[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadPaintCatalog().then((loaded) => {
      if (!cancelled) setPaints(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const topMatches = useMemo(() => {
    if (!paints.length || !hex) return [];
    const engine = new PaintMatchEngine(paints, 2);
    const groups = engine.groupedMatches({
      hex,
      brands: new Set(FEATURED_BRANDS),
      solidsOnly: false,
    });
    const flat: PaintMatch[] = [];
    for (const g of groups) {
      for (const m of g.matches) {
        if (
          currentBrand &&
          currentCode &&
          m.paint.brand.toLowerCase() === currentBrand.toLowerCase() &&
          m.paint.code.toLowerCase() === currentCode.toLowerCase()
        ) {
          continue;
        }
        flat.push(m);
      }
    }
    flat.sort((a, b) => a.deltaE - b.deltaE);
    return flat.slice(0, 6);
  }, [paints, hex, currentBrand, currentCode]);

  return (
    <div className="bp-subcard-lg rounded-2xl border border-slate-200/85 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="bp-badge flex h-7 w-7 items-center justify-center rounded-xl bg-accent/12 text-accent dark:text-accent-light">
            <SparkleIcon className="h-4 w-4" weight="fill" />
          </span>
          <div>
            <h4 className="text-xs font-black text-slate-900 dark:text-white">
              跨品牌近似油漆推荐 (CIEDE2000)
            </h4>
            <p className="text-[10px] text-slate-400">
              可一键将当前色卡替换为其他品牌的等效色号
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pr-1 pb-1">
        {topMatches.map((match, idx) => {
          const rank = idx + 1;
          return (
            <div
              key={match.paint.id}
              className="bp-subcard bp-subcard-interactive flex items-center justify-between gap-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 p-2 hover:border-accent/60 transition"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="bp-swatch relative h-10 w-10 rounded-xl border border-black/15 shrink-0 overflow-hidden flex items-center justify-center"
                  style={{ backgroundColor: match.paint.hex }}
                >
                  <PaintBottleImg
                    brand={match.paint.brand}
                    code={match.paint.code}
                    className="h-full w-full object-contain p-0.5"
                  />
                  <span
                    className={`bp-badge absolute left-0.5 top-0.5 rounded px-1 py-px font-mono text-[8px] font-black leading-none ${
                      rank === 1
                        ? "bg-amber-400 text-slate-950"
                        : "bg-slate-900/80 text-white backdrop-blur-xs"
                    }`}
                  >
                    #{rank}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="truncate text-xs font-extrabold text-slate-900 dark:text-white">
                    {localizedBrand(match.paint.brand, lang)} {match.paint.code}
                  </div>
                  <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                    {match.paint.name} · <span className="font-mono">ΔE {match.deltaE.toFixed(1)}</span>
                  </div>
                </div>
              </div>

              {onReplacePaint && (
                <button
                  type="button"
                  onClick={() => onReplacePaint(match.paint)}
                  className="bp-use-btn rounded-lg bg-accent/10 dark:bg-accent/20 border border-accent/25 dark:border-accent/40 px-2.5 py-1.5 text-[11px] font-bold text-accent dark:text-accent-light hover:bg-accent hover:text-white transition shrink-0 cursor-pointer whitespace-nowrap"
                >
                  替换
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BrandMatchPanel;
