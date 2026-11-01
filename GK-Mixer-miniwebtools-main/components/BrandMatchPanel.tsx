import React, { useEffect, useMemo, useState } from "react";
import { CatalogPaint, Language, PaintBrand, PaintBrandGroup, PaintMatch } from "../types";
import PaintBottleHover from "./PaintBottleHover";
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
  assignedPaint?: CatalogPaint | null;
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
  // Beginner Mode Sandbox Sync props
  beginnerSandboxMode?: boolean;
  sandboxSwatches?: {
    id: string;
    hex: string;
    brand: string;
    code: string;
    name: string;
    isConfirmed: boolean;
    regionCount: number;
  }[];
  onSelectSandboxSwatch?: (hex: string, id: string) => void;
  onNavigateToSandbox?: () => void;
}

export const BrandMatchPanel: React.FC<BrandMatchPanelProps> = ({
  hex: hexProp,
  lang,
  selectable = false,
  selectedId,
  assignedId,
  assignedPaint,
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
  beginnerSandboxMode = false,
  sandboxSwatches = [],
  onSelectSandboxSwatch,
  onNavigateToSandbox,
}) => {
  const [localHex, setLocalHex] = useState<string>(hexProp || "#3B6EE4");
  const [activeSourceLabel, setActiveSourceLabel] = useState<string>(
    beginnerSandboxMode ? "模拟试色台 · 已上色备选" : "混色台"
  );
  const [showSourceMenu, setShowSourceMenu] = useState(false);
  const [showBrandPopover, setShowBrandPopover] = useState(false);
  const [viewMode, setViewMode] = useState<"card" | "list">("card");
  const [tintDeltaL, setTintDeltaL] = useState<number>(0);
  const [selectedTintBasePaint, setSelectedTintBasePaint] = useState<CatalogPaint | null>(null);
  const [quickBrandFilter, setQuickBrandFilter] = useState<string>("all");

  const isSameCatalogPaint = (a?: CatalogPaint | null, b?: CatalogPaint | null): boolean => {
    if (!a || !b) return false;
    if (a.id === b.id) return true;
    const sameCode = a.code.trim().toUpperCase() === b.code.trim().toUpperCase();
    if (!sameCode) return false;
    return (
      a.brand.toLowerCase() === b.brand.toLowerCase() ||
      localizedBrand(a.brand, lang) === localizedBrand(b.brand, lang)
    );
  };

  useEffect(() => {
    if (hexProp) {
      setLocalHex(hexProp.toUpperCase());
      setTintDeltaL(0);
      if (!assignedPaint && !assignedId) {
        setSelectedTintBasePaint(null);
      }
      if (beginnerSandboxMode) {
        setActiveSourceLabel("模拟试色台 · 已上色备选");
      }
    }
  }, [hexProp, beginnerSandboxMode]);

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

  // Automatically sync Smart Tint Corrector base paint whenever assignedPaint or assignedId changes
  useEffect(() => {
    if (assignedPaint) {
      if (paints) {
        const canonical = paints.find((p) => isSameCatalogPaint(p, assignedPaint));
        setSelectedTintBasePaint(canonical || assignedPaint);
      } else {
        setSelectedTintBasePaint(assignedPaint);
      }
      return;
    }
    if (assignedId && paints) {
      const found = paints.find((p) => p.id === assignedId);
      if (found) {
        setSelectedTintBasePaint(found);
        return;
      }
    }
    setSelectedTintBasePaint(null);
  }, [assignedId, assignedPaint, paints, lang]);

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

  const effectiveQuickBrand = useMemo(() => {
    if (quickBrandFilter === "all") return "all";
    return groups.some((g) => g.brand === quickBrandFilter) ? quickBrandFilter : "all";
  }, [quickBrandFilter, groups]);

  const visibleGroups: PaintBrandGroup[] = useMemo(() => {
    if (effectiveQuickBrand === "all") return groups;
    return groups.filter((g) => g.brand === effectiveQuickBrand);
  }, [groups, effectiveQuickBrand]);

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
    if (selectedTintBasePaint) {
      if (paints) {
        const canonical = paints.find((p) => isSameCatalogPaint(p, selectedTintBasePaint));
        if (canonical) return canonical;
      }
      return selectedTintBasePaint;
    }
    if (assignedPaint) {
      if (paints) {
        const canonical = paints.find((p) => isSameCatalogPaint(p, assignedPaint));
        if (canonical) return canonical;
      }
      return assignedPaint;
    }
    if (assignedId && paints) {
      const byId = paints.find((p) => p.id === assignedId);
      if (byId) return byId;
    }
    return top6Matches[0]?.paint || null;
  }, [selectedTintBasePaint, assignedPaint, assignedId, paints, top6Matches, lang]);

  const tintBaseOptions = useMemo(() => {
    const top3 = top6Matches.slice(0, 3).map((m) => m.paint);
    if (
      activeTintBasePaint &&
      !top3.some((p) => isSameCatalogPaint(p, activeTintBasePaint))
    ) {
      return [activeTintBasePaint, ...top3.slice(0, 2)];
    }
    return top3;
  }, [top6Matches, activeTintBasePaint, lang]);

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
    <div className={`flex flex-col gap-3.5 w-full max-w-full min-w-0 ${!standaloneMode ? "h-full" : ""}`}>
      {/* Standalone: full-width target bar + full-width search bar so HEX & source labels never truncate */}
      <div
        className={
          standaloneMode
            ? `relative ${showSourceMenu ? "z-50" : "z-30"} flex flex-col gap-3`
            : "contents"
        }
      >
      {/* 1. Compact Target Color Bar when in Tab 2 "近邻" standalone mode */}
      {standaloneMode ? (
        <div className={`bp-subcard-lg relative ${showSourceMenu ? "z-50" : "z-30"} flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-slate-200/85 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl px-3.5 py-2.5 shadow-xs min-h-[64px]`}>
          {/* Left: 42x42 Swatch + HEX + Subtitle (Clickable to pick color) */}
          <label
            className="flex items-center gap-3 cursor-pointer min-w-[175px] flex-1 group"
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
              <div className="font-mono text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight whitespace-nowrap">
                {hex.toUpperCase()}
              </div>
              <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500 truncate mt-0.5">
                {activeSourceLabel} · 点击重选
              </div>
            </div>
          </label>

          {/* Right: [🔄 来源] Dropdown Pill + Sync/Assign Action Pill */}
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSourceMenu((v) => !v)}
                className="bp-pill flex items-center gap-1 rounded-full border border-slate-200/90 dark:border-slate-700 bg-slate-100/90 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200/80 transition cursor-pointer whitespace-nowrap"
              >
                <ArrowsClockwiseIcon className="h-3.5 w-3.5 text-slate-500" weight="bold" />
                <span>{beginnerSandboxMode ? `试色来源 (${sandboxSwatches.length})` : "来源"}</span>
                <CaretDownIcon className="h-3 w-3 opacity-70" />
              </button>

              {showSourceMenu && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setShowSourceMenu(false)}
                  />
                  <div className="bp-subcard-lg absolute right-0 top-full mt-1.5 z-40 w-60 rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-1.5 shadow-xl space-y-1 max-h-72 overflow-y-auto">
                    {beginnerSandboxMode ? (
                      <>
                        <div className="px-2.5 py-1 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                          🎨 模拟试色台（备选且已上色）
                        </div>
                        {sandboxSwatches.length > 0 ? (
                          sandboxSwatches.map((sw) => {
                            const isCurrent = sw.hex.toUpperCase() === hex.toUpperCase();
                            return (
                              <button
                                key={sw.id}
                                type="button"
                                onClick={() => {
                                  setShowSourceMenu(false);
                                  setActiveSourceLabel(`试色台 · ${sw.brand} ${sw.code}`);
                                  setLocalHex(sw.hex.toUpperCase());
                                  onSelectSandboxSwatch?.(sw.hex.toUpperCase(), sw.id);
                                }}
                                className={`w-full flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-bold transition cursor-pointer ${
                                  isCurrent
                                    ? "bg-accent/15 text-accent dark:text-white"
                                    : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className="bp-dot h-4 w-4 rounded-md border border-black/15 shrink-0"
                                    style={{ backgroundColor: sw.hex }}
                                  />
                                  <div className="min-w-0">
                                    <div className="truncate font-extrabold leading-tight">
                                      {sw.brand} {sw.code} {sw.name !== sw.hex ? sw.name : ""}
                                    </div>
                                    <div className="text-[10px] font-mono text-slate-400">
                                      {sw.hex} · {sw.regionCount}处分区
                                    </div>
                                  </div>
                                </div>
                                {isCurrent && (
                                  <CheckIcon className="w-3.5 h-3.5 text-accent shrink-0" weight="bold" />
                                )}
                              </button>
                            );
                          })
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setShowSourceMenu(false);
                              onNavigateToSandbox?.();
                            }}
                            className="w-full rounded-xl px-2.5 py-2 text-left text-xs font-bold text-accent hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                          >
                            暂无已上色备选 ➔ 前往模拟试色台涂色
                          </button>
                        )}
                        {sourceOptions?.libraryHex && (
                          <>
                            <div className="h-[1px] bg-slate-100 dark:bg-slate-800 my-1" />
                            <button
                              type="button"
                              onClick={() => handleSelectSource("涂装库色卡", sourceOptions.libraryHex)}
                              className="w-full flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                            >
                              <span className="truncate">涂装库色卡</span>
                              <span
                                className="bp-dot h-3.5 w-3.5 rounded-full border border-black/15 shrink-0"
                                style={{ backgroundColor: sourceOptions.libraryHex }}
                              />
                            </button>
                          </>
                        )}
                      </>
                    ) : (
                      <>
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
                            className="w-full flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition cursor-pointer"
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
                        {sandboxSwatches.length > 0 && (
                          <>
                            <div className="h-[1px] bg-slate-100 dark:bg-slate-800 my-1" />
                            <div className="px-2.5 py-1 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                              🎨 模拟试色台（备选且已上色）
                            </div>
                            {sandboxSwatches.map((sw) => {
                              const isCurrent = sw.hex.toUpperCase() === hex.toUpperCase();
                              return (
                                <button
                                  key={sw.id}
                                  type="button"
                                  onClick={() => {
                                    setShowSourceMenu(false);
                                    setActiveSourceLabel(`试色台 · ${sw.brand} ${sw.code}`);
                                    setLocalHex(sw.hex.toUpperCase());
                                    onSelectSandboxSwatch?.(sw.hex.toUpperCase(), sw.id);
                                  }}
                                  className={`w-full flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-bold transition cursor-pointer ${
                                    isCurrent
                                      ? "bg-accent/15 text-accent dark:text-white"
                                      : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span
                                      className="bp-dot h-4 w-4 rounded-md border border-black/15 shrink-0"
                                      style={{ backgroundColor: sw.hex }}
                                    />
                                    <div className="min-w-0">
                                      <div className="truncate font-extrabold leading-tight">
                                        {sw.brand} {sw.code} {sw.name !== sw.hex ? sw.name : ""}
                                      </div>
                                      <div className="text-[10px] font-mono text-slate-400">
                                        {sw.hex} · {sw.regionCount}处分区
                                      </div>
                                    </div>
                                  </div>
                                  {isCurrent && (
                                    <CheckIcon className="w-3.5 h-3.5 text-accent shrink-0" weight="bold" />
                                  )}
                                </button>
                              );
                            })}
                          </>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            {beginnerSandboxMode ? (
              activeTintBasePaint && onAssignCatalog && (
                <button
                  type="button"
                  onClick={() => onAssignCatalog(activeTintBasePaint)}
                  className="bp-pill-active flex items-center gap-1 rounded-full bg-coral px-3 py-1.5 text-xs font-extrabold text-white shadow-sm hover:opacity-95 active:scale-95 transition cursor-pointer whitespace-nowrap"
                  title="将当前选中基底品牌漆同步锁定至左侧试色台色卡预览图"
                >
                  <CheckIcon className="h-3.5 w-3.5" weight="bold" />
                  <span>同步至色卡预览</span>
                </button>
              )
            ) : (
              onSyncToWorkbench && (
                <button
                  type="button"
                  onClick={() => onSyncToWorkbench(hex)}
                  className="bp-pill-active flex items-center gap-1 rounded-full bg-coral px-3 py-1.5 text-xs font-extrabold text-white shadow-sm hover:opacity-95 active:scale-95 transition cursor-pointer whitespace-nowrap"
                  title="将该颜色同步至混色台进行配方分解"
                >
                  <FlaskIcon className="h-3.5 w-3.5" weight="bold" />
                  <span>同步混色台</span>
                </button>
              )
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
      <div className="flex items-center gap-2 w-full max-w-full min-w-0 pb-0.5">
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
        <div className="bp-subcard-lg rounded-2xl border border-slate-200/85 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 p-3.5 sm:p-4 shadow-xs space-y-3">
          {/* Header Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200/70 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bp-badge px-2 py-0.5 rounded-md bg-accent/15 text-accent dark:text-white text-[10px] font-black font-mono">
                🍼 滴数微调助手
              </span>
              <span className="text-xs sm:text-[13px] font-black text-slate-900 dark:text-white">
                现成品牌漆 + 几滴微调补正配方 (Smart Tint Corrector)
              </span>
              <span className="hidden sm:inline-block text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                — 按 ①选明暗 ➔ ②选基底漆指派 ➔ ③按滴数补正 三步即可调出目标色
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

          {/* Top Row: Step ① (5-Step Lightness) + Step ② (3 Candidate Base Paints Grid) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
            {/* STEP ①: 点选期望明暗变化 */}
            <div className="bp-subcard lg:col-span-5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-2.5 flex flex-col justify-between gap-2 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-1.5 min-w-0">
                <span className="text-[11px] font-black text-slate-800 dark:text-slate-100 whitespace-nowrap shrink-0">
                  ① 点选期望明暗变化
                </span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-[10px] font-black text-slate-700 dark:text-slate-200 whitespace-nowrap shrink-0">
                  <span
                    className="w-2.5 h-2.5 rounded-xs border border-black/20 shrink-0"
                    style={{ backgroundColor: tintedTargetHex }}
                  />
                  <span>
                    目标 {tintedTargetHex} (
                    {tintDeltaL === 0 ? "0%L 原色" : `${tintDeltaL > 0 ? `+${tintDeltaL}` : tintDeltaL}%L`})
                  </span>
                </span>
              </div>

              <div className="grid grid-cols-5 gap-1.5 min-w-0">
                {[
                  { dL: -16, shortTag: "-16%L", role: "阴影" },
                  { dL: -8, shortTag: "-8%L", role: "微暗" },
                  { dL: 0, shortTag: "0%L", role: "原色" },
                  { dL: 8, shortTag: "+8%L", role: "提亮" },
                  { dL: 16, shortTag: "+16%L", role: "高光" },
                ].map((step) => {
                  const stepHex = shiftHexLightness(hex, step.dL);
                  const active = tintDeltaL === step.dL;
                  return (
                    <button
                      key={step.dL}
                      type="button"
                      onClick={() => setTintDeltaL(step.dL)}
                      title={`切换目标明度为 ${step.shortTag} ${step.role} (${stepHex})，右侧实时重算补正滴数`}
                      className={`bp-swatch relative min-h-[70px] min-w-0 overflow-hidden flex flex-col items-center justify-between p-1 rounded-lg border text-center transition cursor-pointer ${
                        active
                          ? "border-accent ring-2 ring-accent/45 scale-[1.02] z-10 shadow-sm"
                          : "border-slate-200 dark:border-slate-700 opacity-90 hover:opacity-100"
                      }`}
                      style={{ backgroundColor: stepHex }}
                    >
                      <span
                        className={`w-full px-0.5 py-0.5 rounded flex flex-col items-center justify-center leading-tight ${
                          active ? "bg-accent text-white" : "bg-black/65 text-white"
                        }`}
                      >
                        <span className="font-mono text-[8.5px] font-black leading-none tracking-tight">
                          {step.shortTag}
                        </span>
                        <span className="text-[8px] font-bold leading-none mt-0.5">
                          {step.role}
                        </span>
                      </span>
                      <span className="mt-1 w-full truncate font-mono text-[8px] font-extrabold tracking-tighter px-0.5 py-0.5 rounded bg-white/92 text-slate-900 leading-none">
                        {stepHex}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* STEP ②: 选择并指派主基底品牌漆 (3 Equal-Width Cards) */}
            <div className="lg:col-span-7 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-2.5 flex flex-col justify-between gap-2">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <span className="text-[11px] font-black text-slate-800 dark:text-slate-100">
                  ② 点选并指派主基底品牌漆
                </span>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  点击任意候选漆即可设为基底主漆并同步指派
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {tintBaseOptions.map((paint, idx) => {
                  const brandZh = localizedBrand(paint.brand, lang);
                  const active = isSameCatalogPaint(paint, activeTintBasePaint);
                  const cleanName = paint.name.split("/")[0].trim() || paint.name;
                  const cleanCode =
                    paint.code && paint.code !== "null" && paint.code !== "undefined"
                      ? paint.code
                      : "";
                  return (
                    <button
                      key={`tint-base-${paint.id}-${paint.code}`}
                      type="button"
                      onClick={() => {
                        setSelectedTintBasePaint(paint);
                        if (onAssignCatalog) {
                          onAssignCatalog(paint);
                        }
                      }}
                      title={`${brandZh} ${cleanCode} ${paint.name} (${paint.hex}) — 点击指派为主基底漆并计算补正滴数`}
                      className={`bp-subcard bp-subcard-interactive flex flex-col justify-between gap-1.5 p-2 rounded-xl border text-left transition cursor-pointer ${
                        active
                          ? "bp-subcard-active border-accent bg-accent/10 dark:bg-accent/20 ring-1 ring-accent shadow-xs"
                          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-accent"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5 w-full">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="w-4 h-4 rounded-md border border-black/20 shrink-0"
                            style={{ backgroundColor: paint.hex }}
                          />
                          <span className="font-mono text-[10.5px] font-black text-slate-900 dark:text-white truncate">
                            {brandZh} {cleanCode}
                          </span>
                        </div>
                        <span
                          className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-extrabold leading-none ${
                            active
                              ? "bg-accent text-white"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                          }`}
                        >
                          {active ? "✓ 已指派" : idx === 0 ? "🎯 首推" : "点选指派"}
                        </span>
                      </div>
                      <div
                        className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200 truncate w-full"
                        title={paint.name}
                      >
                        {cleanName}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom Full-Width Row: STEP ③ 滴数微调补正实操方案 (Full width so paint names never truncate!) */}
          <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/60 p-2.5 sm:p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-black text-slate-800 dark:text-slate-100">
                ③ 实操调漆与黑白补正配方
                {tintDeltaL !== 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 font-mono text-[10px]">
                    针对 {tintDeltaL > 0 ? `+${tintDeltaL}%L 提亮` : `${tintDeltaL}%L 压暗`} 目标 {tintedTargetHex}
                  </span>
                )}
              </span>

              {activeTintBasePaint && onAssignCatalog && (
                <button
                  type="button"
                  onClick={() => onAssignCatalog(activeTintBasePaint)}
                  className="bp-pill-active inline-flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1 text-[11px] font-extrabold text-white shadow-2xs hover:opacity-95 cursor-pointer transition"
                  title="将当前基底主漆及微调配方指派绑定至试色台色卡"
                >
                  <CheckIcon className="h-3.5 w-3.5" weight="bold" />
                  <span>
                    指派【{activeTintRecipe.basePaint.brandZh} {activeTintRecipe.basePaint.code}】至当前色卡
                  </span>
                </button>
              )}
            </div>

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
              <div className="space-y-2">
                {/* 3-Column Visual Equation: [主漆比例] + [黑白补正比例] = [原漆 vs 目标 零接缝对比] */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-stretch">
                  <div className="md:col-span-5 bp-subcard flex items-center justify-between gap-2 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-5 h-5 rounded-md border border-black/15 shrink-0"
                        style={{ backgroundColor: activeTintRecipe.basePaint.hex }}
                      />
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold text-slate-400 leading-none">🧴 基底主漆</div>
                        <div className="font-black text-slate-900 dark:text-white truncate mt-0.5">
                          {activeTintRecipe.basePaint.brandZh} {activeTintRecipe.basePaint.code}{" "}
                          {activeTintRecipe.basePaint.name.split("/")[0].trim()}
                        </div>
                      </div>
                    </div>
                    <span className="font-mono text-xs font-black text-accent shrink-0">
                      {activeTintRecipe.basePct}% (约{activeTintRecipe.baseDrops}滴)
                    </span>
                  </div>

                  {activeTintRecipe.modifier && (
                    <div className="md:col-span-4 bp-subcard flex items-center justify-between gap-2 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-5 h-5 rounded-md border border-slate-300 dark:border-slate-600 shrink-0"
                          style={{ backgroundColor: activeTintRecipe.modifier.hex }}
                        />
                        <div className="min-w-0">
                          <div className="text-[10px] font-bold text-slate-400 leading-none">➕ 微调补正漆</div>
                          <div className="font-black text-slate-900 dark:text-white truncate mt-0.5">
                            {activeTintRecipe.modifier.name.split(" ")[0]}
                          </div>
                        </div>
                      </div>
                      <span className="font-mono text-xs font-black text-amber-600 dark:text-amber-400 shrink-0">
                        {activeTintRecipe.modifier.pct}% (约{activeTintRecipe.modifier.drops}滴)
                      </span>
                    </div>
                  )}

                  {/* 零接缝对比条 */}
                  <div className="md:col-span-3 bp-swatch grid grid-cols-2 min-h-[42px] rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 text-[10px] font-mono font-black">
                    <div
                      className="px-2 flex flex-col justify-center text-white leading-tight"
                      style={{ backgroundColor: activeTintRecipe.basePaint.hex }}
                    >
                      <span className="opacity-80 text-[8.5px]">原漆</span>
                      <span className="truncate">{activeTintRecipe.basePaint.code}</span>
                    </div>
                    <div
                      className="px-2 flex flex-col justify-center text-white leading-tight"
                      style={{ backgroundColor: activeTintRecipe.targetHex }}
                    >
                      <span className="opacity-80 text-[8.5px]">补正后</span>
                      <span className="truncate">{activeTintRecipe.effectTag}</span>
                    </div>
                  </div>
                </div>

                {/* 口诀说明 */}
                <div className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-relaxed px-0.5">
                  {activeTintRecipe.spokenTip}
                </div>
              </div>
            )}
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
              const used =
                assignedId === match.paint.id ||
                isSameCatalogPaint(match.paint, assignedPaint);
              const isInteractive = !!onAssignCatalog || selectable;
              const handleCardClick = () => {
                setSelectedTintBasePaint(match.paint);
                if (onAssignCatalog) onAssignCatalog(match.paint);
                else if (selectable) onSelect?.(catalogToPaintBrand(match.paint));
              };

              return (
                <PaintBottleHover
                  key={`top6-${match.paint.id}`}
                  brand={match.paint.brand}
                  code={match.paint.code}
                  name={match.paint.name}
                  hex={match.paint.hex}
                >
                  <div
                    role={isInteractive ? "button" : undefined}
                    tabIndex={isInteractive ? 0 : undefined}
                    onClick={handleCardClick}
                    className={`bp-subcard-lg bp-subcard-interactive group relative flex h-full flex-col justify-between rounded-2xl border p-2.5 transition-all ${
                      isInteractive ? "cursor-pointer active:scale-[0.98]" : ""
                    } ${
                      used
                        ? "bp-subcard-active border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 ring-1 ring-emerald-500/40"
                        : "border-slate-200/85 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-accent/60 shadow-xs"
                    }`}
                  >
                    {/* Pure Color Swatch Header with High-Contrast Rank Badge (#1 gold, #2~#6 dark charcoal glass) */}
                    <div
                      className={`bp-swatch bp-bottom-divider relative h-14 ${standaloneMode ? "md:h-20" : ""} w-full rounded-xl border border-black/10 dark:border-white/10 overflow-hidden mb-2`}
                      style={{ backgroundColor: match.paint.hex }}
                    >
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
                </PaintBottleHover>
              );
            })}
          </div>
        </div>
      )}

      {/* 4.5. Quick Brand Navigation Bar: One-click jump/filter to any brand without scrolling 17 sections */}
      {paints && groups.length > 1 && (
        <div className="bp-subcard rounded-2xl border border-slate-200/85 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 p-2.5 pr-3 space-y-1.5">
          <div className="flex items-center justify-between gap-2 px-0.5">
            <span className="text-[11px] font-extrabold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <span>🏷️ {lang === "zh" ? "快速打开品牌" : "Quick Brand Select"}</span>
              <span className="text-[10px] font-normal text-slate-400">
                {lang === "zh" ? "（点击即刻展开对应品牌，免翻页）" : "(Click to view brand directly)"}
              </span>
            </span>
            {effectiveQuickBrand !== "all" && (
              <button
                type="button"
                onClick={() => setQuickBrandFilter("all")}
                className="text-[11px] font-bold text-accent hover:underline cursor-pointer whitespace-nowrap"
              >
                {lang === "zh" ? "显示全部品牌" : "Show All"}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setQuickBrandFilter("all")}
              className={`px-2.5 py-1 rounded-xl text-xs font-extrabold transition cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                effectiveQuickBrand === "all"
                  ? "bp-pill-active bg-accent text-white shadow-2xs"
                  : "bp-pill bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-accent/60"
              }`}
            >
              <span>{lang === "zh" ? `全部 (${groups.length})` : `All (${groups.length})`}</span>
            </button>
            {groups.map((g) => {
              const isAct = effectiveQuickBrand === g.brand;
              const bestMatch = g.matches[0];
              return (
                <button
                  key={`quick-brand-${g.brand}`}
                  type="button"
                  onClick={() =>
                    setQuickBrandFilter(effectiveQuickBrand === g.brand ? "all" : g.brand)
                  }
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    isAct
                      ? "bp-pill-active bg-accent text-white shadow-2xs"
                      : "bp-pill bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-accent/60"
                  }`}
                >
                  {bestMatch && (
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-black/20 shrink-0"
                      style={{ backgroundColor: bestMatch.paint.hex }}
                    />
                  )}
                  <span>{localizedBrand(g.brand, lang)}</span>
                  {bestMatch && (
                    <span
                      className={`font-mono text-[9.5px] ${
                        isAct ? "text-white/90" : "text-slate-400"
                      }`}
                    >
                      Δ{bestMatch.deltaE.toFixed(1)}
                    </span>
                  )}
                </button>
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
                : "flex-1 min-h-[22rem] max-h-[29rem] overflow-y-auto"
          }`}
        >
          {visibleGroups.map((group) => (
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
                      ? "grid grid-cols-1 gap-2 sm:grid-cols-2 lg:gap-2.5"
                      : "space-y-1.5"
                    : "bp-subcard-lg divide-y divide-slate-100 dark:divide-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"
                }
              >
                {group.matches.map((match) => {
                  const active = selectedId === match.paint.id;
                  const used =
                    assignedId === match.paint.id ||
                    isSameCatalogPaint(match.paint, assignedPaint);
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
                    setSelectedTintBasePaint(match.paint);
                    if (onAssignCatalog) {
                      onAssignCatalog(match.paint);
                    } else if (selectable) {
                      onSelect?.(catalogToPaintBrand(match.paint));
                    }
                  };

                  if (viewMode === "list") {
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
                                  setSelectedTintBasePaint(match.paint);
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
                      </PaintBottleHover>
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
                          className="bp-swatch relative h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 rounded-xl border border-black/15 dark:border-white/15 shadow-sm overflow-hidden"
                          style={{ backgroundColor: match.paint.hex }}
                        />
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
                              setSelectedTintBasePaint(match.paint);
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
            <PaintBottleHover
              key={match.paint.id}
              brand={match.paint.brand}
              code={match.paint.code}
              name={match.paint.name}
              hex={match.paint.hex}
            >
              <div className="bp-subcard bp-subcard-interactive flex items-center justify-between gap-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 p-2 hover:border-accent/60 transition">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="bp-swatch relative h-10 w-10 rounded-xl border border-black/15 shrink-0 overflow-hidden"
                    style={{ backgroundColor: match.paint.hex }}
                  >
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
            </PaintBottleHover>
          );
        })}
      </div>
    </div>
  );
};

export default BrandMatchPanel;
