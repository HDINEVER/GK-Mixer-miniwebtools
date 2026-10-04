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
              ? "点「使用」会在取色点钉上可拖拽色卡，导出 PNG 时一起画进原图。"
              : lang === "ja"
                ? "「使う」で採取点にカードを置き、書き出し時に画像へ合成します。"
                : "Use pins a draggable swatch at the sample point. Export burns it into the photo."
            : lang === "zh"
              ? "先在左侧图上点一下取色，再点「使用」，色卡才会出现在图上。"
              : lang === "ja"
                ? "先に左の画像で色を採取してから「使う」を押すと、カードが画像に出ます。"
                : "Pick a point on the left image first, then Use to drop a card on that spot."}
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
        <div className={`space-y-3 overflow-y-auto pr-1 ${compact ? "max-h-56" : "max-h-80"}`}>
          {groups.map((group) => (
            <div key={group.brand}>
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {localizedBrand(group.brand, lang)}
              </div>
              <div className="space-y-1">
                {group.matches.map((match) => {
                  const active = selectedId === match.paint.id;
                  const used = assignedId === match.paint.id;
                  const quality = matchQuality(match.deltaE);
                  const qualityClass =
                    quality === "close"
                      ? "text-emerald-600"
                      : quality === "usable"
                        ? "text-sky-600"
                        : "text-slate-400";
                  const useLabel = used
                    ? lang === "zh"
                      ? "已用"
                      : lang === "ja"
                        ? "使用中"
                        : "Used"
                    : lang === "zh"
                      ? "使用"
                      : lang === "ja"
                        ? "使う"
                        : "Use";
                  return (
                    <PaintBottleHover
                      key={match.paint.id}
                      brand={match.paint.brand}
                      code={match.paint.code}
                      name={match.paint.name}
                      hex={match.paint.hex}
                    >
                    <div
                      className={`flex w-full items-center gap-2 rounded-xl border p-2.5 transition-all duration-150 active:scale-[0.98] ${
                        active
                          ? "border-macaron-purple bg-macaron-purple/10 ring-1 ring-macaron-purple shadow-xs"
                          : "border-slate-100 dark:border-slate-800/80 bg-white/60 dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      <button
                        type="button"
                        disabled={!selectable}
                        onClick={() => {
                          if (!selectable) return;
                          onSelect?.(catalogToPaintBrand(match.paint));
                        }}
                        className={`flex min-w-0 flex-1 items-center gap-2.5 text-left ${
                          selectable ? "cursor-pointer" : "cursor-default"
                        }`}
                      >
                        <div
                          className="h-9 w-9 flex-shrink-0 rounded-lg border border-slate-200/80 shadow-xs dark:border-slate-700"
                          style={{ backgroundColor: match.paint.hex }}
                        />
                        <div className="min-w-0 flex-1">
                          <span className="block truncate font-mono text-xs font-bold text-slate-700 dark:text-slate-200">
                            {match.paint.code} {match.paint.name}
                          </span>
                          <span className="block truncate font-mono text-[10px] text-slate-500">
                            {match.paint.hex}
                            {match.paint.set ? ` · ${match.paint.set}` : ""}
                            {match.paint.approx ? (lang === "zh" ? " · 近似" : " · approx") : ""}
                            <span className={`ml-1 font-semibold ${qualityClass}`}>
                              · ΔE {match.deltaE.toFixed(1)} · {matchQualityLabel(match.deltaE, lang)}
                            </span>
                          </span>
                        </div>
                      </button>
                      {onAssignCatalog && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onAssignCatalog(match.paint);
                          }}
                          className={`flex h-8 min-w-[3.5rem] flex-shrink-0 items-center justify-center rounded-full px-3 text-[11px] font-bold transition-all duration-150 active:scale-95 cursor-pointer ${
                            used
                              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300"
                              : "bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-900/30 dark:text-sky-300"
                          }`}
                        >
                          {useLabel}
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
            <div className="py-4 text-center text-[11px] text-slate-400">
              {lang === "zh" ? "没有匹配结果" : "No matches"}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BrandMatchPanel;
