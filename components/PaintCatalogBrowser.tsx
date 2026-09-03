import React, { useEffect, useMemo, useState } from "react";
import { CatalogPaint, Language } from "../types";
import PaintBottleHover from "./PaintBottleHover";
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

      <div className="-mx-1 flex gap-1 overflow-x-auto pb-1">
        {brands.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setBrand(item);
              setPrefix(null);
            }}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-bold ${
              brand === item
                ? "bg-slate-800 text-white dark:bg-white dark:text-slate-900"
                : "bg-slate-100 text-slate-500 dark:bg-slate-800"
            }`}
          >
            {localizedBrand(item, lang)}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={lang === "zh" ? "搜索色号 / 名称 / HEX" : "Search code / name / HEX"}
          className="min-w-[12rem] flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
        />
        <label className="flex items-center gap-1 text-[10px] text-slate-500">
          <input
            type="checkbox"
            checked={solidsOnly}
            onChange={(event) => setSolidsOnly(event.target.checked)}
          />
          {lang === "zh" ? "仅实色" : "Solids"}
        </label>
        <select
          value={prefix ?? ""}
          onChange={(event) => setPrefix(event.target.value || null)}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="">{lang === "zh" ? "全部系列" : "All series"}</option>
          {prefixes.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
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
                <span>{isCollapsed ? "+" : "–"}</span>
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
                      <button
                        type="button"
                        onClick={() => onPickHex?.(paint.hex)}
                        className="w-full overflow-hidden rounded-lg border border-slate-100 bg-slate-50 text-left dark:border-slate-700 dark:bg-slate-800"
                      >
                        <div className="h-11 w-full" style={{ backgroundColor: paint.hex }} />
                        <div className="px-1.5 py-1">
                          <div className="truncate font-mono text-[9px] text-slate-400">{paint.hex}</div>
                          <div className="truncate text-[10px] font-bold leading-tight text-slate-700 dark:text-slate-200">
                            {paint.code} {paint.name}
                          </div>
                        </div>
                      </button>
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
