import React, { useEffect, useMemo, useState } from "react";
import { CatalogPaint, Language, PaintBrand, PaintBrandGroup } from "../types";
import PaintBottleHover from "./PaintBottleHover";
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-xs font-bold tracking-wider text-macaron-purple">
          {lang === "zh" ? "品牌近邻" : lang === "ja" ? "ブランド近似" : "BRAND MATCH"}
          <span className="rounded bg-purple-100 px-2 py-0.5 text-[10px] font-normal text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
            CIEDE2000
          </span>
        </h3>
        <label className="flex items-center gap-1 text-[10px] text-slate-500">
          <input
            type="checkbox"
            checked={solidsOnly}
            onChange={(event) => setSolidsOnly(event.target.checked)}
          />
          {lang === "zh" ? "仅实色" : lang === "ja" ? "ソリッドのみ" : "Solids only"}
        </label>
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

      <div className="flex flex-wrap gap-1">
        {FEATURED_BRANDS.map((brand) => (
          <button
            key={brand}
            type="button"
            onClick={() => toggleBrand(brand)}
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold transition-colors ${
              selectedBrands.has(brand)
                ? "bg-macaron-purple text-white"
                : "bg-slate-100 text-slate-500 dark:bg-slate-800"
            }`}
          >
            {localizedBrand(brand, lang)}
          </button>
        ))}
        {extraBrands.length > 0 && (
          <button
            type="button"
            onClick={() => setShowMore((value) => !value)}
            className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800"
          >
            {showMore
              ? lang === "zh"
                ? "收起"
                : "Less"
              : lang === "zh"
                ? `更多 ${extraBrands.length}`
                : `More ${extraBrands.length}`}
          </button>
        )}
      </div>

      {showMore && (
        <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto">
          {extraBrands.map((brand) => (
            <button
              key={brand}
              type="button"
              onClick={() => toggleBrand(brand)}
              className={`rounded-full px-2 py-0.5 text-[10px] ${
                selectedBrands.has(brand)
                  ? "bg-slate-700 text-white"
                  : "bg-slate-50 text-slate-500 dark:bg-slate-800"
              }`}
            >
              {localizedBrand(brand, lang)}
            </button>
          ))}
        </div>
      )}

      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={lang === "zh" ? "搜索色号 / 名称" : "Search code / name"}
        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
      />

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
                      className={`flex w-full items-center gap-2 rounded-md border p-2 transition-all ${
                        active
                          ? "border-macaron-purple bg-macaron-purple/10 ring-1 ring-macaron-purple"
                          : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      <button
                        type="button"
                        disabled={!selectable}
                        onClick={() => {
                          if (!selectable) return;
                          onSelect?.(catalogToPaintBrand(match.paint));
                        }}
                        className={`flex min-w-0 flex-1 items-center gap-2 text-left ${
                          selectable ? "" : "cursor-default"
                        }`}
                      >
                        <div
                          className="h-8 w-8 flex-shrink-0 rounded-md border border-slate-200 shadow-sm dark:border-slate-600"
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
                            <span className={`ml-1 ${qualityClass}`}>
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
                          className={`flex h-8 min-w-[3.25rem] flex-shrink-0 items-center justify-center rounded-full px-2.5 text-[11px] font-bold ${
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
