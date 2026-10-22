import React, { useEffect, useMemo, useState } from "react";
import { Drawer } from "vaul";
import { CatalogPaint, ColorData, Language, PaintMatch } from "../types";
import { deltaE2000, labFromHex } from "../utils/ciede2000";
import {
  FEATURED_BRANDS,
  loadPaintCatalog,
  localizedBrand,
  matchQualityLabel,
} from "../utils/paintCatalog";
import { PaintBottleImg } from "./PaintBottleHover";
import {
  SparkleIcon,
  MagnifyingGlassIcon,
  XIcon,
  CheckIcon,
  ArrowRightIcon,
  FlaskIcon,
  TagIcon,
  TargetIcon,
} from "@phosphor-icons/react";

interface QuickPaintAssignSheetProps {
  isOpen: boolean;
  onClose: () => void;
  targetColor: ColorData | null;
  sampleIndex: number;
  catalogPaints?: CatalogPaint[];
  onAssignPaint: (paint: CatalogPaint, targetColorId: string) => void;
  onUnassignPaint: (targetColorId: string) => void;
  onNavigateToBrandMatches?: (color: ColorData) => void;
  onNavigateToBrands?: (color: ColorData) => void;
  onNavigateToMixer: (color: ColorData) => void;
  lang: Language;
}

export const QuickPaintAssignSheet: React.FC<QuickPaintAssignSheetProps> = ({
  isOpen,
  onClose,
  targetColor,
  sampleIndex,
  catalogPaints,
  onAssignPaint,
  onUnassignPaint,
  onNavigateToBrandMatches,
  onNavigateToBrands,
  onNavigateToMixer,
  lang,
}) => {
  const [activeTab, setActiveTab] = useState<"top10" | "search">("top10");
  const [solidsOnly, setSolidsOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedBrand, setSelectedBrand] = useState<string>("ALL");
  const [fallbackCatalog, setFallbackCatalog] = useState<CatalogPaint[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    if (Array.isArray(catalogPaints) && catalogPaints.length > 0) return;
    if (fallbackCatalog.length > 0) return;
    let cancelled = false;
    loadPaintCatalog()
      .then((list) => {
        if (!cancelled && Array.isArray(list)) setFallbackCatalog(list);
      })
      .catch((err) => {
        console.error("Failed to load fallback paint catalog:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, catalogPaints, fallbackCatalog.length]);

  const effectiveCatalog: CatalogPaint[] = useMemo(() => {
    if (Array.isArray(catalogPaints) && catalogPaints.length > 0) {
      return catalogPaints;
    }
    return fallbackCatalog;
  }, [catalogPaints, fallbackCatalog]);

  const targetHex =
    typeof targetColor?.hex === "string" && targetColor.hex.startsWith("#")
      ? targetColor.hex.toUpperCase()
      : "#808080";

  // 1. Compute Top 10 closest paints by CIEDE2000 deltaE
  const top10Matches: PaintMatch[] = useMemo(() => {
    if (
      !isOpen ||
      !targetColor?.hex ||
      typeof targetColor.hex !== "string" ||
      !targetColor.hex.startsWith("#") ||
      effectiveCatalog.length === 0
    ) {
      return [];
    }
    const targetLab = labFromHex(targetColor.hex);
    if (!targetLab) return [];

    const featuredSet = new Set(FEATURED_BRANDS);
    const pool = effectiveCatalog.filter((p) => {
      if (!p || !featuredSet.has(p.brand)) return false;
      if (solidsOnly && p.finish !== "standard") return false;
      if (!solidsOnly && p.finish !== "standard" && p.finish !== "metallic") return false;
      return true;
    });

    const scored: PaintMatch[] = pool.map((paint) => {
      const pLab =
        paint.lab && paint.lab.length >= 3
          ? { l: paint.lab[0], a: paint.lab[1], b: paint.lab[2] }
          : labFromHex(paint.hex) ?? { l: 0, a: 0, b: 0 };
      return {
        paint,
        deltaE: deltaE2000(targetLab, pLab),
      };
    });

    scored.sort((a, b) => a.deltaE - b.deltaE);
    return scored.slice(0, 10);
  }, [isOpen, targetColor, effectiveCatalog, solidsOnly]);

  // 2. Search across full catalog (supporting space-separated brand + code/name tokens)
  const searchResults: PaintMatch[] = useMemo(() => {
    if (
      !isOpen ||
      !targetColor?.hex ||
      typeof targetColor.hex !== "string" ||
      !targetColor.hex.startsWith("#") ||
      effectiveCatalog.length === 0
    ) {
      return [];
    }
    const targetLab = labFromHex(targetColor.hex) ?? { l: 50, a: 0, b: 0 };
    const tokens = searchQuery
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    const matched: PaintMatch[] = [];
    for (const paint of effectiveCatalog) {
      if (!paint) continue;
      if (selectedBrand !== "ALL" && paint.brand !== selectedBrand) continue;
      if (tokens.length > 0) {
        const bZh = localizedBrand(paint.brand, "zh").toLowerCase();
        const hay = `${paint.brand ?? ""} ${bZh} ${paint.code ?? ""} ${paint.name ?? ""} ${paint.hex ?? ""} ${paint.set ?? ""}`.toLowerCase();
        let allHit = true;
        for (const tk of tokens) {
          if (!hay.includes(tk)) {
            allHit = false;
            break;
          }
        }
        if (!allHit) continue;
      }

      const pLab =
        paint.lab && paint.lab.length >= 3
          ? { l: paint.lab[0], a: paint.lab[1], b: paint.lab[2] }
          : labFromHex(paint.hex) ?? { l: 0, a: 0, b: 0 };
      matched.push({
        paint,
        deltaE: deltaE2000(targetLab, pLab),
      });
      if (tokens.length === 0 && matched.length >= 40) break;
    }

    matched.sort((a, b) => a.deltaE - b.deltaE);
    return matched.slice(0, 30);
  }, [isOpen, targetColor, effectiveCatalog, searchQuery, selectedBrand]);

  if (!targetColor) return null;

  const assigned = targetColor?.assignedPaint;
  const activeList = activeTab === "top10" ? top10Matches : searchResults;
  const displaySampleNum = Math.max(1, (Number.isFinite(sampleIndex) ? sampleIndex : 0) + 1);

  return (
    <Drawer.Root
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      shouldScaleBackground={false}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs transition-opacity" />
        <Drawer.Content className="bp-modal-shell fixed bottom-0 left-0 right-0 z-50 mx-auto flex max-h-[86dvh] w-full max-w-lg flex-col rounded-t-[28px] border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl outline-none">
          {/* Grabber handle */}
          <div className="my-2.5 mx-auto h-1.5 w-10 shrink-0 rounded-full bg-slate-300 dark:bg-slate-700" />

          {/* Sheet Header: Target Sample Point Info */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 px-4 pb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="bp-swatch h-9 w-9 rounded-xl border-2 border-white dark:border-slate-700 shadow-md shrink-0"
                style={{ backgroundColor: targetHex }}
              />
              <div className="min-w-0">
                <Drawer.Title className="flex items-center gap-1.5 text-sm font-black tracking-tight text-slate-900 dark:text-white truncate">
                  <TargetIcon className="h-4 w-4 text-accent shrink-0" weight="bold" />
                  <span>
                    正在为取色点 #{displaySampleNum} · {targetHex} 指派油漆
                  </span>
                </Drawer.Title>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                  {assigned
                    ? `当前已绑定：${localizedBrand(assigned.brand, lang)} ${assigned.code} ${assigned.name}`
                    : "点击任意油漆即刻绑定至当前取色点并同步悬浮色卡"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {assigned && (
                <button
                  type="button"
                  onClick={() => {
                    onUnassignPaint(targetColor.id);
                    onClose();
                  }}
                  className="bp-pill rounded-full bg-rose-500/10 hover:bg-rose-500/20 px-2.5 py-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 transition whitespace-nowrap cursor-pointer"
                >
                  ✕ 解绑
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="bp-btn flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:bg-slate-200 transition cursor-pointer"
                aria-label="Close"
              >
                <XIcon className="h-4 w-4" weight="bold" />
              </button>
            </div>
          </div>

          {/* Dual-Mode Switcher: [✨ 最佳近似油漆 (TOP 10) | 🔍 搜索全部油漆库] */}
          <div className="px-4 pt-3 pb-2 space-y-2.5 shrink-0">
            <div className="flex items-center gap-2">
              <div className="bp-segmented flex flex-1 rounded-full bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200/70 dark:border-slate-700/70">
                <button
                  type="button"
                  onClick={() => setActiveTab("top10")}
                  className={`bp-segmented-item flex-1 flex items-center justify-center gap-1 rounded-full py-1.5 px-2.5 text-xs font-extrabold transition whitespace-nowrap cursor-pointer ${
                    activeTab === "top10"
                      ? "bp-segmented-item-active bg-accent text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
                  }`}
                >
                  <SparkleIcon className="h-3.5 w-3.5 shrink-0" weight="fill" />
                  <span>最佳近似油漆 (TOP 10)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("search")}
                  className={`bp-segmented-item flex-1 flex items-center justify-center gap-1 rounded-full py-1.5 px-2.5 text-xs font-extrabold transition whitespace-nowrap cursor-pointer ${
                    activeTab === "search"
                      ? "bp-segmented-item-active bg-accent text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
                  }`}
                >
                  <MagnifyingGlassIcon className="h-3.5 w-3.5 shrink-0" weight="bold" />
                  <span>搜索全部油漆库</span>
                </button>
              </div>

              {activeTab === "top10" && (
                <button
                  type="button"
                  onClick={() => setSolidsOnly((v) => !v)}
                  className={`h-8 px-2.5 rounded-full border text-[11px] font-bold flex items-center gap-1 shrink-0 whitespace-nowrap transition cursor-pointer ${
                    solidsOnly
                      ? "bp-pill-active bg-accent text-white border-accent"
                      : "bp-pill bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                  }`}
                >
                  {solidsOnly && <CheckIcon className="h-3 w-3" weight="bold" />}
                  <span>仅实色</span>
                </button>
              )}
            </div>

            {/* Search Input & Brand Chips when in Search Tab */}
            {activeTab === "search" && (
              <div className="space-y-2">
                <div className="relative">
                  <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="按品牌+色号空格搜索，如：盖亚 红 / Gaia 003 / 星影 金"
                    className="bp-input w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 pl-9 pr-8 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-accent"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 pr-1">
                  <button
                    type="button"
                    onClick={() => setSelectedBrand("ALL")}
                    className={`h-6 px-2.5 rounded-full text-[11px] font-bold shrink-0 whitespace-nowrap transition cursor-pointer ${
                      selectedBrand === "ALL"
                        ? "bp-pill-active bg-accent text-white"
                        : "bp-pill bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    全部品牌
                  </button>
                  {FEATURED_BRANDS.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setSelectedBrand(b)}
                      className={`h-6 px-2.5 rounded-full text-[11px] font-bold shrink-0 whitespace-nowrap transition cursor-pointer ${
                        selectedBrand === b
                          ? "bp-pill-active bg-accent text-white"
                          : "bp-pill bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {localizedBrand(b, lang)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Scrollable Paint Match List */}
          <div className="flex-1 overflow-y-auto px-4 py-1.5 space-y-1.5">
            {activeList.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                未找到匹配的模型油漆，请尝试其他关键词
              </div>
            ) : (
              activeList.map(({ paint, deltaE }, idx) => {
                const isCurrentAssigned = assigned?.id === paint.id;
                const bName = localizedBrand(paint.brand, lang);
                return (
                  <button
                    key={paint.id}
                    type="button"
                    onClick={() => {
                      onAssignPaint(paint, targetColor.id);
                      onClose();
                    }}
                    className={`bp-subcard bp-subcard-interactive w-full flex items-center justify-between gap-2.5 rounded-2xl border p-2 text-left transition-colors active:scale-[0.99] cursor-pointer ${
                      isCurrentAssigned
                        ? "bp-subcard-active border-accent bg-accent/10 dark:bg-accent/20 shadow-xs"
                        : "border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:border-accent/50 hover:bg-slate-50/70 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    {/* Left: Rank + 1:1 Bottle/Color Swatch + Brand/Code/Name */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {activeTab === "top10" && (
                        <span
                          className={`w-5 text-center font-mono text-[11px] font-black shrink-0 ${
                            idx < 3 ? "text-accent" : "text-slate-400"
                          }`}
                        >
                          #{idx + 1}
                        </span>
                      )}

                      <div className="bp-swatch relative h-10 w-10 rounded-xl border border-slate-200/80 dark:border-slate-700 overflow-hidden shrink-0 flex items-center justify-center bg-slate-50 dark:bg-slate-800">
                        <span
                          className="absolute inset-0"
                          style={{ backgroundColor: paint.hex }}
                        />
                        <PaintBottleImg
                          brand={paint.brand}
                          code={paint.code}
                          className="relative z-10 h-full w-full object-contain p-0.5 bg-white/90 dark:bg-slate-900/80"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                            {bName} {paint.code} {paint.name}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-400">
                          <span className="inline-flex items-center gap-1 font-mono font-bold">
                            <span
                              className="bp-dot h-2.5 w-2.5 rounded-full border border-black/15"
                              style={{ backgroundColor: paint.hex ?? "#808080" }}
                            />
                            {(paint.hex ?? "#808080").toUpperCase()}
                          </span>
                          <span>·</span>
                          <span className="font-mono font-semibold text-slate-500 dark:text-slate-400">
                            ΔE {deltaE.toFixed(1)} ({matchQualityLabel(deltaE, lang)})
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Instant Assign Pill */}
                    <span
                      className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-extrabold whitespace-nowrap transition-colors ${
                        isCurrentAssigned
                          ? "bp-pill-active bg-accent text-white"
                          : "bp-pill bg-accent/12 text-accent dark:bg-accent/22 dark:text-accent-light group-hover:bg-accent group-hover:text-white"
                      }`}
                    >
                      {isCurrentAssigned ? "✓ 已指派" : "指派"}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Bottom Cross-Page Action Bar */}
          <div
            className="grid grid-cols-2 gap-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/95 px-4 pt-3 pb-4 shrink-0"
            style={{
              paddingBottom: "max(1rem, env(safe-area-inset-bottom, 1rem))",
            }}
          >
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onNavigateToBrandMatches) {
                  onNavigateToBrandMatches(targetColor);
                } else if (onNavigateToBrands) {
                  onNavigateToBrands(targetColor);
                }
              }}
              className="bp-btn flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 px-3 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-accent hover:text-accent transition-colors whitespace-nowrap cursor-pointer"
            >
              <TagIcon className="h-3.5 w-3.5 text-accent shrink-0" weight="bold" />
              <span>前往「品牌近邻」深度筛选</span>
              <ArrowRightIcon className="h-3 w-3 shrink-0" weight="bold" />
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigateToMixer(targetColor);
              }}
              className="bp-btn flex items-center justify-center gap-1.5 rounded-xl bg-accent hover:bg-accent-hover py-2.5 px-3 text-xs font-extrabold text-white shadow-xs transition-colors whitespace-nowrap cursor-pointer"
            >
              <FlaskIcon className="h-3.5 w-3.5 shrink-0" weight="bold" />
              <span>前往「调色分解」计算混色</span>
              <ArrowRightIcon className="h-3 w-3 shrink-0" weight="bold" />
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
};

export default QuickPaintAssignSheet;
