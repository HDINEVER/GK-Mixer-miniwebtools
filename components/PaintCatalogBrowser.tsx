import React, { useEffect, useMemo, useState } from "react";
import { CatalogPaint, Language } from "../types";
import PaintBottleHover from "./PaintBottleHover";
import IOSSearchBar from "./IOSSearchBar";
import {
  CheckIcon,
  CaretDownIcon,
  PlusIcon,
  MinusIcon,
  ArrowUpRightIcon,
} from "@phosphor-icons/react";
import {
  FEATURED_BRANDS,
  loadPaintCatalog,
  localizedBrand,
  prefixGroups,
} from "../utils/paintCatalog";

interface PaintCatalogBrowserProps {
  lang: Language;
  onPickHex?: (hex: string) => void;
}

const PaintCatalogBrowser: React.FC<PaintCatalogBrowserProps> = ({ lang, onPickHex }) => {
  const [paints, setPaints] = useState<CatalogPaint[]>([]);
  const [brand, setBrand] = useState(FEATURED_BRANDS[0]);
  const [search, setSearch] = useState("");
  const [solidsOnly, setSolidsOnly] = useState(false);
  const [prefix, setPrefix] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadPaintCatalog().then((loaded) => {
      setPaints(loaded);
      if (loaded.length && !loaded.some((paint) => paint.brand === brand)) {
        setBrand(loaded[0].brand);
      }
    });
  }, []);

  const brands = useMemo(() => {
    const unique = Array.from(new Set<string>(paints.map((paint) => paint.brand)));
    return unique.sort((lhs, rhs) => {
      const li = FEATURED_BRANDS.indexOf(lhs);
      const ri = FEATURED_BRANDS.indexOf(rhs);
      const left = li === -1 ? Number.MAX_SAFE_INTEGER : li;
      const right = ri === -1 ? Number.MAX_SAFE_INTEGER : ri;
      if (left !== right) return left - right;
      return lhs.localeCompare(rhs);
    });
  }, [paints]);

  const { groups, prefixes } = useMemo(
    () => prefixGroups(paints, brand, search, solidsOnly, prefix),
    [paints, brand, search, solidsOnly, prefix]
  );

  const visible = groups.reduce((sum, group) => sum + group.paints.length, 0);
  const brandTotal = paints.filter((paint) => paint.brand === brand).length;

  return (
    <div className="flex min-h-[32rem] flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold tracking-widest text-slate-400">
          {lang === "zh" ? "数据库" : lang === "ja" ? "データベース" : "PAINT CATALOG"}
        </h2>
        <span className="text-[10px] text-slate-400">
          {visible} / {brandTotal}
        </span>
      </div>

      {/* Konsta/iOS-style Horizontal Scrollable Brand Tabs (min 44px touch target) */}
      <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto py-1 no-scrollbar scroll-smooth">
        {brands.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setBrand(item);
              setPrefix(null);
            }}
            className={`whitespace-nowrap rounded-full px-4 min-h-[44px] flex items-center justify-center text-[12px] font-bold transition-all duration-150 active:scale-[0.97] touch-manipulation cursor-pointer flex-shrink-0 ${
              brand === item
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                : "bg-slate-100 text-slate-600 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            {localizedBrand(item, lang)}
          </button>
        ))}
      </div>

      {/* iOS-Style Search & Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[13rem] flex-1">
          <IOSSearchBar
            value={search}
            onChange={setSearch}
            placeholder={lang === "zh" ? "搜索色号 / 名称 / HEX" : "Search code / name / HEX"}
          />
        </div>

        <button
          type="button"
          onClick={() => setSolidsOnly(!solidsOnly)}
          className={`h-10 sm:h-11 px-3 rounded-xl sm:rounded-2xl border text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 active:scale-[0.96] shrink-0 cursor-pointer ${
            solidsOnly
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-xs'
              : 'bg-slate-100/90 dark:bg-slate-800/90 text-slate-600 dark:text-slate-400 border-slate-200/50 dark:border-slate-700/50 hover:bg-slate-200/60'
          }`}
        >
          <span className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[10px] border transition-colors ${
            solidsOnly ? 'bg-sky-500 border-sky-500 text-white' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'
          }`}>
            {solidsOnly && <CheckIcon className="w-2.5 h-2.5" weight="bold" />}
          </span>
          <span>{lang === "zh" ? "仅实色" : "Solids"}</span>
        </button>

        <div className="relative shrink-0">
          <select
            value={prefix ?? ""}
            onChange={(event) => setPrefix(event.target.value || null)}
            className="h-10 sm:h-11 pl-3.5 pr-8 rounded-xl sm:rounded-2xl border border-slate-200/60 dark:border-slate-700/60 bg-slate-100/90 dark:bg-slate-800/90 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500/20 appearance-none cursor-pointer active:scale-[0.97] transition-all"
          >
            <option value="">{lang === "zh" ? "全部系列" : "All series"}</option>
            {prefixes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
            <CaretDownIcon className="w-2.5 h-2.5" weight="bold" />
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto pr-1">
        {groups.map((group) => {
          const isCollapsed = collapsed.has(group.prefix);
          return (
            <section key={group.prefix}>
              <button
                type="button"
                onClick={() => {
                  setCollapsed((prev) => {
                    const next = new Set(prev);
                    if (next.has(group.prefix)) next.delete(group.prefix);
                    else next.add(group.prefix);
                    return next;
                  });
                }}
                className="mb-2 flex w-full items-center justify-between text-left text-[11px] font-bold text-slate-500"
              >
                <span>
                  {group.prefix}
                  <span className="ml-2 font-normal text-slate-400">{group.paints.length}</span>
                </span>
                <span>{isCollapsed ? <PlusIcon className="w-3 h-3" weight="bold" /> : <MinusIcon className="w-3 h-3" weight="bold" />}</span>
              </button>
              {!isCollapsed && (
                <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
                  {group.paints.map((paint) => (
                    <PaintBottleHover
                      key={paint.id}
                      brand={paint.brand}
                      code={paint.code}
                      name={paint.name}
                      hex={paint.hex}
                      className="block w-full min-w-0"
                    >
                      <div className="w-full overflow-hidden rounded-lg border border-slate-100 bg-slate-50 text-left dark:border-slate-700 dark:bg-slate-800 transition-transform duration-100 active:scale-[0.97] cursor-pointer">
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => onPickHex?.(paint.hex)}
                          onKeyDown={(e) => { if (e.key === 'Enter') onPickHex?.(paint.hex); }}
                          className="h-11 w-full cursor-pointer transition-opacity hover:opacity-95"
                          style={{ backgroundColor: paint.hex }}
                        />
                        <div className="px-1.5 py-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate font-mono text-[9px] text-slate-400">{paint.hex}</span>
                            {paint.shopUrl && (
                              <a
                                href={paint.shopUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="shrink-0 rounded px-1 text-[9px] font-bold text-amber-600 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/40 inline-flex items-center gap-0.5"
                                title={lang === "zh" ? "前往官方店铺购买" : "Official store"}
                              >
                                <span>{lang === "zh" ? "购买" : "Buy"}</span>
                                <ArrowUpRightIcon className="w-2.5 h-2.5" weight="bold" />
                              </a>
                            )}
                          </div>
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => onPickHex?.(paint.hex)}
                            onKeyDown={(e) => { if (e.key === 'Enter') onPickHex?.(paint.hex); }}
                            className="cursor-pointer truncate text-[10px] font-bold leading-tight text-slate-700 dark:text-slate-200"
                          >
                            {paint.code} {paint.name}
                          </div>
                        </div>
                      </div>
                    </PaintBottleHover>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
};

export default PaintCatalogBrowser;
