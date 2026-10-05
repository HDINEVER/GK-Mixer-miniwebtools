import React, { useEffect, useMemo, useState } from "react";
import { CatalogPaint, Language, PaintBrand, PaintBrandGroup } from "../types";
import PaintBottleHover from "./PaintBottleHover";
import IOSSearchBar from "./IOSSearchBar";
import { CheckIcon } from "@phosphor-icons/react";
import {
  FEATURED_BRANDS,
  PaintMatchEngine,
  catalogToPaintBrand,
  loadPaintCatalog,
  localizedBrand,
  matchQuality,
  matchQualityLabel,
} from "../utils/paintCatalog";

interface BrandMatchPanelProps {
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
}

const BrandMatchPanel: React.FC<BrandMatchPanelProps> = ({
  hex,
  lang,
  selectable = false,
  selectedId,
  assignedId,
  onSelect,
  onAssignCatalog,
  compact = false,
  disableInternalScroll = false,
  hasSamplePoint = false,
}) => {
  const [paints, setPaints] = useState<CatalogPaint[] | null>(null);
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(
    () => new Set(FEATURED_BRANDS)
  );
  const [solidsOnly, setSolidsOnly] = useState(true);
  const [search, setSearch] = useState("");
  const [showMore, setShowMore] = useState(false);

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
    () => (paints ? new PaintMatchEngine(paints, compact ? 2 : 3) : null),
    [paints, compact]
  );

  const groups: PaintBrandGroup[] = useMemo(() => {
    if (!engine || !hex) return [];
    return engine.groupedMatches({
      hex,
      brands: selectedBrands,
      solidsOnly,
      search,
    });
  }, [engine, hex, selectedBrands, solidsOnly, search]);

  const extraBrands = engine?.brands.filter((brand) => !FEATURED_BRANDS.includes(brand)) ?? [];

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

  if (!hex) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xs font-bold tracking-wider text-macaron-purple">
          {lang === "zh" ? "品牌近邻" : lang === "ja" ? "ブランド近似" : "BRAND MATCH"}
          <span className="rounded-full bg-purple-100 dark:bg-purple-900/40 px-2 py-0.5 text-[10px] font-semibold text-purple-600 dark:text-purple-300">
            CIEDE2000
          </span>
        </h3>
        <button
          type="button"
          onClick={() => {
            if (selectedBrands.size === 0) {
              setSelectedBrands(new Set(FEATURED_BRANDS));
            } else {
              setSelectedBrands(new Set());
            }
          }}
          className="text-[11px] font-medium text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
        >
          {selectedBrands.size === 0
            ? (lang === "zh" ? "默认品牌" : "Default")
            : (lang === "zh" ? "清空选择" : "Clear")}
        </button>
      </div>
      {onAssignCatalog && (
        <p className="text-[10px] leading-relaxed text-slate-400">
          {hasSamplePoint
            ? lang === "zh"
              ? "点击下方任意品牌漆卡片（或右侧「使用」）即可为取样点生成悬浮色卡。"
              : lang === "ja"
                ? "カードまたは「使う」をタップすると採取点に色カードを配置します。"
                : "Tap any paint card or [Use] to pin a floating swatch at the sample point."
            : lang === "zh"
              ? "先在图上点击取样点，再点击漆卡即可生成色卡。"
              : lang === "ja"
                ? "先に画像上の採取点を選んでから漆カードをタップしてください。"
                : "Select a sample point first, then tap any paint card."}
        </p>
      )}

      {/* Konsta/iOS-style Horizontal Scrollable Featured Brands (min 40px touch target) */}
      <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto py-1 no-scrollbar scroll-smooth">
        {FEATURED_BRANDS.map((brand) => {
          const isSelected = selectedBrands.has(brand);
          return (
            <button
              key={brand}
              type="button"
              onClick={() => toggleBrand(brand)}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-150 active:scale-[0.96] flex items-center justify-center shrink-0 cursor-pointer whitespace-nowrap ${
                isSelected
                  ? "bg-macaron-purple text-white shadow-sm shadow-purple-500/25 ring-2 ring-purple-300/40"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 border border-slate-200/50 dark:border-slate-700/50"
              }`}
            >
              {localizedBrand(brand, lang)}
            </button>
          );
        })}
        {extraBrands.length > 0 && (
          <button
            type="button"
            onClick={() => setShowMore((value) => !value)}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-150 active:scale-[0.96] flex items-center justify-center shrink-0 cursor-pointer whitespace-nowrap border ${
              showMore
                ? "bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200/80 border-slate-200/50 dark:border-slate-700/50"
            }`}
          >
            {showMore
              ? (lang === "zh" ? "收起" : "Less")
              : (lang === "zh" ? `更多 ${extraBrands.length}` : `More ${extraBrands.length}`)}
          </button>
        )}
      </div>

      {showMore && (
        <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto py-1 no-scrollbar scroll-smooth">
          {extraBrands.map((brand) => {
            const isSelected = selectedBrands.has(brand);
            return (
              <button
                key={brand}
                type="button"
                onClick={() => toggleBrand(brand)}
                className={`min-h-[38px] px-3 py-1 rounded-full text-xs font-medium transition-all duration-150 active:scale-[0.96] flex items-center justify-center shrink-0 cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? "bg-slate-700 dark:bg-slate-200 text-white dark:text-slate-900 shadow-sm"
                    : "bg-slate-100/90 dark:bg-slate-800/90 text-slate-500 dark:text-slate-400 hover:bg-slate-200/80 border border-slate-200/40 dark:border-slate-700/40"
                }`}
              >
                {localizedBrand(brand, lang)}
              </button>
            );
          })}
        </div>
      )}

      {/* iOS-Style Search & Solids Only Toolbar */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <IOSSearchBar
            value={search}
            onChange={setSearch}
            placeholder={lang === "zh" ? "搜索色号 / 名称" : lang === "ja" ? "品番・色名で検索" : "Search code / name"}
          />
        </div>

        <button
          type="button"
          onClick={() => setSolidsOnly(!solidsOnly)}
          className={`h-10 sm:h-11 px-3 rounded-xl sm:rounded-2xl border text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 active:scale-[0.96] shrink-0 cursor-pointer ${
            solidsOnly
              ? 'bg-purple-600 text-white dark:bg-purple-500 dark:text-white border-transparent shadow-xs'
              : 'bg-slate-100/90 dark:bg-slate-800/90 text-slate-600 dark:text-slate-400 border-slate-200/50 dark:border-slate-700/50 hover:bg-slate-200/60'
          }`}
        >
          <span className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[10px] border transition-colors ${
            solidsOnly ? 'bg-white text-purple-600 border-white' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'
          }`}>
            {solidsOnly && <CheckIcon className="w-2.5 h-2.5" weight="bold" />}
          </span>
          <span>{lang === "zh" ? "仅实色" : lang === "ja" ? "ソリッド" : "Solids"}</span>
        </button>
      </div>

      {!paints ? (
        <div className="py-4 text-center text-[11px] text-slate-400">
          {lang === "zh" ? "正在载入色库…" : "Loading catalog…"}
        </div>
      ) : (
        <div
          className={`space-y-3 ${
            disableInternalScroll
              ? ""
              : compact
              ? "max-h-56 overflow-y-auto pr-1"
              : "max-h-80 overflow-y-auto pr-1"
          }`}
        >
          {groups.map((group) => (
            <div key={group.brand}>
              <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                <span>{localizedBrand(group.brand, lang)}</span>
                <span className="text-[10px] font-mono font-normal">
                  {group.matches.length} {lang === "zh" ? "款匹配" : "matches"}
                </span>
              </div>
              <div className="space-y-1.5">
                {group.matches.map((match) => {
                  const active = selectedId === match.paint.id;
                  const used = assignedId === match.paint.id;
                  const quality = matchQuality(match.deltaE);
                  const qualityClass =
                    quality === "close"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : quality === "usable"
                        ? "text-sky-600 dark:text-sky-400"
                        : "text-slate-400";
                  const useLabel = used
                    ? lang === "zh"
                      ? "已选配"
                      : lang === "ja"
                        ? "使用中"
                        : "Used"
                    : lang === "zh"
                      ? "使用"
                      : lang === "ja"
                        ? "使う"
                        : "Use";

                  const isInteractive = !!onAssignCatalog || selectable;

                  const handleItemClick = () => {
                    if (onAssignCatalog) {
                      onAssignCatalog(match.paint);
                    } else if (selectable) {
                      onSelect?.(catalogToPaintBrand(match.paint));
                    }
                  };

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
                        if (isInteractive && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          handleItemClick();
                        }
                      }}
                      className={`group relative flex w-full items-center gap-3 rounded-2xl border p-2.5 sm:p-3 transition-all duration-150 active:scale-[0.985] ${
                        isInteractive ? "cursor-pointer" : ""
                      } ${
                        used
                          ? "border-emerald-500/70 bg-emerald-50/70 dark:bg-emerald-950/40 ring-1 ring-emerald-500/40 shadow-xs"
                          : active
                          ? "border-macaron-purple bg-macaron-purple/10 ring-1 ring-macaron-purple shadow-xs"
                          : "border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-800/80 hover:border-sky-400 hover:bg-sky-50/40 dark:hover:border-sky-500/50 dark:hover:bg-slate-800 shadow-xs"
                      }`}
                    >
                      <div
                        className="h-10 w-10 flex-shrink-0 rounded-xl border border-black/15 dark:border-white/15 shadow-sm transition-transform duration-150 group-hover:scale-105"
                        style={{ backgroundColor: match.paint.hex }}
                      />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                          {match.paint.code} {match.paint.name}
                        </span>
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-mono text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                          <span>{match.paint.hex}</span>
                          {match.paint.set ? <span>· {match.paint.set}</span> : null}
                          {match.paint.approx ? <span>· {lang === "zh" ? "近似" : "approx"}</span> : null}
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
                          className={`flex min-h-[38px] min-w-[4.5rem] flex-shrink-0 items-center justify-center gap-1 rounded-xl px-3.5 text-xs font-bold transition-all duration-150 active:scale-95 cursor-pointer shadow-xs ${
                            used
                              ? "bg-emerald-600 text-white shadow-emerald-500/25"
                              : "bg-sky-50 text-sky-700 hover:bg-sky-500 hover:text-white dark:bg-sky-950/60 dark:text-sky-300 dark:hover:bg-sky-600 dark:hover:text-white border border-sky-200/90 dark:border-sky-800"
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

export default BrandMatchPanel;
