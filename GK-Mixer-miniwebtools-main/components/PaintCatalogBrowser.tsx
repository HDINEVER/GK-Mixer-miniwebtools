import React, { useEffect, useMemo, useRef, useState } from "react";
import { CatalogPaint, ColorData, Language } from "../types";
import PaintBottleHover from "./PaintBottleHover";
import IOSSearchBar from "./IOSSearchBar";
import {
  CheckIcon,
  CaretDownIcon,
  PlusIcon,
  MinusIcon,
  ArrowUpRightIcon,
  SquaresFour as SquaresFourIcon,
  ListIcon,
  XIcon,
  FunnelSimpleIcon,
  CrosshairIcon,
} from "@phosphor-icons/react";
import {
  COMMON_MODEL_BRANDS,
  FEATURED_BRANDS,
  PaintApplicationType,
  getPaintApplicationType,
  loadPaintCatalog,
  localizedBrand,
  paintPrefix,
  sortPaints,
} from "../utils/paintCatalog";

interface PaintCatalogBrowserProps {
  lang: Language;
  initialPaints?: CatalogPaint[];
  onPickHex?: (hex: string) => void;
  onAssignCatalog?: (paint: CatalogPaint) => void;
  activeSampleColor?: ColorData | null;
}

const INITIAL_GROUP_BATCH = 6;
const GROUP_BATCH_STEP = 8;

const FINISH_LABELS: Record<string, { zh: string; colorClass: string }> = {
  standard: { zh: "标准实色", colorClass: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  metallic: { zh: "金属漆", colorClass: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" },
  wash: { zh: "渍洗/阴影", colorClass: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300" },
  ink: { zh: "透明/滤镜", colorClass: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300" },
  other: { zh: "特殊/底漆", colorClass: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300" },
};

const QUICK_CHIPS = [
  { id: "primer", label: "🔥 常用底漆", keyword: "补土 底漆 primer" },
  { id: "metallic", label: "✨ 金属漆", finish: "metallic", keyword: "金 银 铁 铜 金属" },
  { id: "matte", label: "🌫️ 消光/半光", keyword: "消光 半光 哑光" },
  { id: "fluorescent", label: "🎨 荧光色", keyword: "荧光" },
  { id: "pearl", label: "🫧 珍珠色", keyword: "珍珠 偏光 魔幻" },
  { id: "clear", label: "💎 透明色", keyword: "透明 滤镜 阴影" },
];

const PaintCatalogBrowser: React.FC<PaintCatalogBrowserProps> = ({
  lang,
  initialPaints,
  onPickHex,
  onAssignCatalog,
  activeSampleColor,
}) => {
  const [paints, setPaints] = useState<CatalogPaint[]>(() =>
    initialPaints && initialPaints.length > 0 ? initialPaints : []
  );
  const [isReady, setIsReady] = useState<boolean>(false);
  const [brand, setBrand] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");
  const [solidsOnly, setSolidsOnly] = useState<boolean>(false);
  const [prefix, setPrefix] = useState<string | null>(null);
  const [finishFilter, setFinishFilter] = useState<string | null>(null);
  const [activeQuickChip, setActiveQuickChip] = useState<string | null>(null);
  const [showUncommonBrands, setShowUncommonBrands] = useState<boolean>(false);
  const [applicationFilter, setApplicationFilter] = useState<"all" | PaintApplicationType>("all");
  const [viewMode, setViewMode] = useState<"gallery" | "compact">("gallery");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [openFilterMenu, setOpenFilterMenu] = useState<"series" | "finish" | null>(null);
  const [visibleGroupLimit, setVisibleGroupLimit] = useState<number>(INITIAL_GROUP_BATCH);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

  const commonBrandsSet = useMemo(() => new Set<string>(COMMON_MODEL_BRANDS), []);

  useEffect(() => {
    if (initialPaints && initialPaints.length > 0) {
      setPaints(initialPaints);
    } else {
      loadPaintCatalog().then((loaded) => {
        setPaints(loaded);
      });
    }
    // Defer heavy card list mount by 1 animation frame so tab switch paints instantaneously
    let timer: number | undefined;
    const raf = window.requestAnimationFrame(() => {
      timer = window.setTimeout(() => {
        setIsReady(true);
      }, 24);
    });
    return () => {
      window.cancelAnimationFrame(raf);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [initialPaints]);

  // Reset progressive window when filters change
  useEffect(() => {
    setVisibleGroupLimit(INITIAL_GROUP_BATCH);
  }, [
    brand,
    solidsOnly,
    finishFilter,
    prefix,
    search,
    activeQuickChip,
    showUncommonBrands,
    applicationFilter,
    viewMode,
  ]);

  const allUniqueBrands = useMemo(() => {
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

  // Pre-build search haystack & application mode (喷涂 vs 手涂) once per catalog load
  const searchMetaMap = useMemo(() => {
    const map = new Map<
      string,
      { pfx: string; hay: string; appType: PaintApplicationType }
    >();
    for (const paint of paints) {
      const pfx = paintPrefix(paint);
      const appType = getPaintApplicationType(paint);
      const appLabel = appType === "airbrush" ? "喷涂 喷笔" : "手涂 笔涂 水性";
      const localizedB = localizedBrand(paint.brand, "zh").toLowerCase();
      const hay = `${paint.brand} ${localizedB} ${paint.code} ${paint.name} ${paint.hex} ${paint.set} ${paint.finish} ${appLabel}`.toLowerCase();
      map.set(paint.id, { pfx, hay, appType });
    }
    return map;
  }, [paints]);

  // Brands that actually contain at least 1 paint for the active applicationFilter (hides spray-only brands when "手涂/笔涂漆" is selected)
  const brandsMatchingAppFilter = useMemo(() => {
    if (applicationFilter === "all") return new Set<string>(allUniqueBrands);
    const set = new Set<string>();
    for (const paint of paints) {
      const appType = searchMetaMap.get(paint.id)?.appType ?? getPaintApplicationType(paint);
      if (appType === applicationFilter) {
        set.add(paint.brand);
      }
    }
    return set;
  }, [paints, searchMetaMap, applicationFilter, allUniqueBrands]);

  const brands = useMemo(() => {
    const baseList = showUncommonBrands
      ? allUniqueBrands
      : allUniqueBrands.filter((b) => commonBrandsSet.has(b));
    if (applicationFilter === "all") return baseList;
    return baseList.filter((b) => brandsMatchingAppFilter.has(b));
  }, [allUniqueBrands, showUncommonBrands, commonBrandsSet, applicationFilter, brandsMatchingAppFilter]);

  // If the active brand has no paints under the newly switched applicationFilter (e.g. switching to 手涂漆 while Gaia is active), reset to ALL
  useEffect(() => {
    if (brand !== "ALL" && !brands.includes(brand)) {
      setBrand("ALL");
      setPrefix(null);
    }
  }, [brands, brand]);

  const uncommonBrandCount = Math.max(0, allUniqueBrands.length - commonBrandsSet.size);

  // Space-separated multi-keyword matching + Common/Uncommon Brand Scope + Spray/Brush Filter
  const filteredPaints = useMemo(() => {
    const tokens = search
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    const chipObj = QUICK_CHIPS.find((c) => c.id === activeQuickChip);
    const chipKeywords = chipObj ? chipObj.keyword.toLowerCase().split(/\s+/) : [];

    return paints.filter((paint) => {
      if (!showUncommonBrands && !commonBrandsSet.has(paint.brand)) return false;
      if (brand !== "ALL" && paint.brand !== brand) return false;
      if (solidsOnly && paint.finish !== "standard") return false;
      if (finishFilter && paint.finish !== finishFilter) return false;

      const meta = searchMetaMap.get(paint.id);
      const appType = meta ? meta.appType : getPaintApplicationType(paint);
      if (applicationFilter !== "all" && appType !== applicationFilter) return false;

      const pfx = meta ? meta.pfx : paintPrefix(paint);
      if (prefix && pfx !== prefix) return false;

      const hay =
        meta?.hay ??
        `${paint.brand} ${localizedBrand(paint.brand, "zh")} ${paint.code} ${paint.name} ${paint.hex} ${paint.set} ${paint.finish}`.toLowerCase();

      if (tokens.length > 0) {
        for (const tk of tokens) {
          if (!hay.includes(tk)) return false;
        }
      }

      if (chipObj) {
        if (chipObj.finish && paint.finish === chipObj.finish) return true;
        const matchedAny = chipKeywords.some((kw) => hay.includes(kw));
        if (!matchedAny) return false;
      }

      return true;
    });
  }, [
    paints,
    searchMetaMap,
    showUncommonBrands,
    commonBrandsSet,
    brand,
    solidsOnly,
    finishFilter,
    applicationFilter,
    prefix,
    search,
    activeQuickChip,
  ]);

  const scopedPaintsCount = useMemo(() => {
    return paints.filter((p) => {
      if (!showUncommonBrands && !commonBrandsSet.has(p.brand)) return false;
      if (applicationFilter !== "all") {
        const appType = searchMetaMap.get(p.id)?.appType ?? getPaintApplicationType(p);
        if (appType !== applicationFilter) return false;
      }
      return true;
    }).length;
  }, [paints, showUncommonBrands, commonBrandsSet, applicationFilter, searchMetaMap]);

  const availablePrefixes = useMemo(() => {
    const scope = paints.filter((p) => {
      if (!showUncommonBrands && !commonBrandsSet.has(p.brand)) return false;
      if (brand !== "ALL" && p.brand !== brand) return false;
      return true;
    });
    const set = new Set<string>();
    for (const p of scope) {
      set.add(searchMetaMap.get(p.id)?.pfx ?? paintPrefix(p));
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [paints, searchMetaMap, showUncommonBrands, commonBrandsSet, brand]);

  const groups = useMemo(() => {
    const bucket = new Map<string, CatalogPaint[]>();
    for (const paint of filteredPaints) {
      const pfx = searchMetaMap.get(paint.id)?.pfx ?? paintPrefix(paint);
      const key =
        brand === "ALL"
          ? `${localizedBrand(paint.brand, lang)} · ${pfx}`
          : pfx;
      const list = bucket.get(key) ?? [];
      list.push(paint);
      bucket.set(key, list);
    }
    return Array.from(bucket.entries()).map(([grpKey, list]) => ({
      prefix: grpKey,
      paints: sortPaints(list),
    }));
  }, [filteredPaints, searchMetaMap, brand, lang]);

  const visibleGroups = useMemo(
    () => groups.slice(0, visibleGroupLimit),
    [groups, visibleGroupLimit]
  );
  const hasMoreGroups = visibleGroupLimit < groups.length;

  // Automatically expand visible groups when scrolling near the sentinel
  useEffect(() => {
    if (!isReady || !hasMoreGroups) return;
    const node = loadMoreSentinelRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleGroupLimit((prev) => Math.min(groups.length, prev + GROUP_BATCH_STEP));
        }
      },
      { rootMargin: "360px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [isReady, hasMoreGroups, groups.length]);

  const toggleCollapse = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="flex min-h-[32rem] flex-col gap-3 select-none">
      {/* 1. Sticky Top Brand Rail + Collapsible Notion Filter Bar */}
      <div className="sticky top-0 z-20 pt-1 pb-2.5 space-y-2.5 bg-[#F8FAFC]/95 dark:bg-slate-900/95 backdrop-blur-md">
        {activeSampleColor && onAssignCatalog && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-accent/25 bg-accent/8 dark:bg-accent/15 px-3 py-1.5 mr-11 lg:mr-0 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <CrosshairIcon className="h-3.5 w-3.5 text-accent shrink-0" weight="bold" />
              <span className="font-bold text-slate-700 dark:text-slate-200 truncate">
                {lang === "zh" ? "当前待指派取色点:" : "Target Sample:"}
              </span>
              <span
                className="h-3.5 w-3.5 rounded-full border border-black/15 shrink-0"
                style={{ backgroundColor: activeSampleColor.hex }}
              />
              <span className="font-mono font-black text-accent dark:text-accent-light">
                {activeSampleColor.hex}
              </span>
            </div>
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 shrink-0 hidden sm:inline">
              {lang === "zh" ? "点按「指派」绑定油漆并回跳画布" : "Tap [Assign] to bind & return"}
            </span>
          </div>
        )}

        {/* Top Control Row: [喷涂 vs 手涂 筛选器] + [常用品牌 / 展开不常用品牌 切换开关] */}
        <div className="flex flex-wrap items-center justify-between gap-2 pr-11 lg:pr-0">
          {/* Application Mode Filter: 全部用途 | 💨 喷涂漆 | 🖌️ 手涂漆 */}
          <div className="bp-segmented inline-flex rounded-full bg-slate-200/85 dark:bg-slate-800 p-0.5 border border-slate-200/80 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setApplicationFilter("all")}
              className={`bp-segmented-item rounded-full px-2.5 sm:px-3 py-1 text-[11px] font-extrabold transition cursor-pointer whitespace-nowrap ${
                applicationFilter === "all"
                  ? "bp-segmented-item-active bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
              }`}
            >
              全部用途
            </button>
            <button
              type="button"
              onClick={() => setApplicationFilter("airbrush")}
              className={`bp-segmented-item flex items-center gap-1 rounded-full px-2.5 sm:px-3 py-1 text-[11px] font-extrabold transition cursor-pointer whitespace-nowrap ${
                applicationFilter === "airbrush"
                  ? "bp-segmented-item-active bg-sky-600 text-white shadow-2xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-sky-600"
              }`}
              title="筛选适合高达/GK喷笔喷涂的硝基漆、预调喷涂漆与喷涂专用水性漆"
            >
              <span>💨</span>
              <span>喷涂漆</span>
            </button>
            <button
              type="button"
              onClick={() => setApplicationFilter("brush")}
              className={`bp-segmented-item flex items-center gap-1 rounded-full px-2.5 sm:px-3 py-1 text-[11px] font-extrabold transition cursor-pointer whitespace-nowrap ${
                applicationFilter === "brush"
                  ? "bp-segmented-item-active bg-amber-600 text-white shadow-2xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-amber-600"
              }`}
              title="筛选适合手涂/笔涂的战棋水性漆、薄涂漆、对比漆与渍洗漆"
            >
              <span>🖌️</span>
              <span>手涂/笔涂漆</span>
            </button>
          </div>

          {/* Toggle Switch: Default Common Brands Only vs Include Uncommon Brands */}
          <button
            type="button"
            onClick={() => {
              const next = !showUncommonBrands;
              setShowUncommonBrands(next);
              if (!next && brand !== "ALL" && !commonBrandsSet.has(brand)) {
                setBrand("ALL");
              }
            }}
            className={`bp-pill inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-extrabold transition cursor-pointer whitespace-nowrap ${
              showUncommonBrands
                ? "bp-pill-active border-amber-400 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200"
                : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-accent"
            }`}
            title={
              showUncommonBrands
                ? "当前已开启全部生僻/海外小众品牌，点击恢复默认仅显示主流常用品牌"
                : "默认隐藏不常用的海外小众品牌，点击可展开并允许搜索全部品牌"
            }
          >
            <span>{showUncommonBrands ? "🌐 已含生僻品牌 (点击收起)" : `🌟 默认仅常用品牌 (展开 +${uncommonBrandCount} 个不常用品牌)`}</span>
          </button>
        </div>

        {/* Horizontal Scrollable Brand Rail (ALL + Brands in Liquid Glass Capsules) */}
        <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pt-0.5 pb-1.5 pr-1.5 no-scrollbar scroll-smooth">
          <button
            type="button"
            onClick={() => {
              setBrand("ALL");
              setPrefix(null);
            }}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-full text-xs font-black transition shrink-0 cursor-pointer whitespace-nowrap ${
              brand === "ALL"
                ? "bp-pill-active bg-coral text-white shadow-sm"
                : "bp-pill bg-white/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700/70 hover:bg-white"
            }`}
          >
            {showUncommonBrands ? `全部品牌 (${scopedPaintsCount})` : `常用全部 (${scopedPaintsCount})`}
          </button>
          {brands.map((item) => {
            const active = item === brand;
            return (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setBrand(item);
                  setPrefix(null);
                  setCollapsed(new Set());
                }}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-full text-xs font-bold transition shrink-0 cursor-pointer whitespace-nowrap ${
                  active
                    ? "bp-pill-active bg-coral text-white shadow-sm"
                    : "bp-pill bg-white/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700/70 hover:bg-white"
                }`}
              >
                {localizedBrand(item, lang)}
              </button>
            );
          })}
        </div>

        {/* Multi-Keyword Search Bar */}
        <div className="flex items-center gap-2 pr-1.5 pb-0.5">
          <div className="flex-1 min-w-0">
            <IOSSearchBar
              value={search}
              onChange={setSearch}
              placeholder={
                lang === "zh"
                  ? "多关键词空格组合搜索：如「盖亚 黑」「匠域 金属」「002」"
                  : "Multi-keyword search: e.g. Gaia black 002"
              }
            />
          </div>
        </div>

        {/* Notion-Style Filter Pills + Quick Chips + View Mode Switcher */}
        <div className="space-y-2">
          {/* Quick Filter Chips Row */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5 pb-1.5 pr-1.5">
            {QUICK_CHIPS.map((chip) => {
              const active = activeQuickChip === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setActiveQuickChip(active ? null : chip.id)}
                  className={`h-7 px-2.5 rounded-full text-[11px] font-bold shrink-0 transition cursor-pointer ${
                    active
                      ? "bp-pill-active bg-coral text-white shadow-2xs"
                      : "bp-pill bg-white/75 dark:bg-slate-800/75 border border-slate-200/70 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-coral/50"
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>

          {/* Notion-Style Filter Pills & Dual View Mode Toggle */}
          <div className="relative flex flex-wrap items-center justify-between gap-2 pr-1.5 pb-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {/* [+ 系列 ⌄] Pill */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setOpenFilterMenu(openFilterMenu === "series" ? null : "series")
                  }
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold transition cursor-pointer whitespace-nowrap ${
                    prefix
                      ? "bp-pill-active border-accent bg-accent/10 text-accent dark:bg-accent/20 dark:text-accent-light"
                      : "bp-pill border-slate-200/90 dark:border-slate-700 bg-white/85 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  <FunnelSimpleIcon className="h-3 w-3 shrink-0" weight="bold" />
                  <span>{prefix ? `系列: ${prefix}` : "+ 系列"}</span>
                  {prefix ? (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        setPrefix(null);
                      }}
                      className="ml-0.5 rounded-full hover:bg-accent/20 p-0.5"
                    >
                      <XIcon className="h-2.5 w-2.5" weight="bold" />
                    </span>
                  ) : (
                    <CaretDownIcon className="h-2.5 w-2.5 opacity-60" />
                  )}
                </button>

                {openFilterMenu === "series" && (
                  <div className="bp-subcard-lg absolute left-0 top-full mt-1.5 z-40 w-56 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-1.5 shadow-xl grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setPrefix(null);
                        setOpenFilterMenu(null);
                      }}
                      className="col-span-2 rounded-xl px-2.5 py-1.5 text-left text-xs font-bold text-accent hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      全部系列
                    </button>
                    {availablePrefixes.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => {
                          setPrefix(item);
                          setOpenFilterMenu(null);
                        }}
                        className={`truncate rounded-xl px-2.5 py-1.5 text-left text-xs font-bold ${
                          prefix === item
                            ? "bp-pill-active bg-accent text-white"
                            : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* [+ 光泽/属性 ⌄] Pill */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setOpenFilterMenu(openFilterMenu === "finish" ? null : "finish")
                  }
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold transition cursor-pointer whitespace-nowrap ${
                    finishFilter
                      ? "bp-pill-active border-accent bg-accent/10 text-accent dark:bg-accent/20 dark:text-accent-light"
                      : "bp-pill border-slate-200/90 dark:border-slate-700 bg-white/85 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  <span>
                    {finishFilter
                      ? `属性: ${FINISH_LABELS[finishFilter]?.zh || finishFilter}`
                      : "+ 光泽/类型"}
                  </span>
                  {finishFilter ? (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        setFinishFilter(null);
                      }}
                      className="ml-0.5 rounded-full hover:bg-accent/20 p-0.5"
                    >
                      <XIcon className="h-2.5 w-2.5" weight="bold" />
                    </span>
                  ) : (
                    <CaretDownIcon className="h-2.5 w-2.5 opacity-60" />
                  )}
                </button>

                {openFilterMenu === "finish" && (
                  <div className="bp-subcard-lg absolute left-0 top-full mt-1.5 z-40 w-44 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-1.5 shadow-xl space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setFinishFilter(null);
                        setOpenFilterMenu(null);
                      }}
                      className="w-full rounded-xl px-2.5 py-1.5 text-left text-xs font-bold text-accent hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      全部类型
                    </button>
                    {Object.entries(FINISH_LABELS).map(([k, val]) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => {
                          setFinishFilter(k);
                          setOpenFilterMenu(null);
                        }}
                        className={`w-full rounded-xl px-2.5 py-1.5 text-left text-xs font-bold ${
                          finishFilter === k
                            ? "bp-pill-active bg-accent text-white"
                            : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        {val.zh}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* [仅实色] Pill */}
              <button
                type="button"
                onClick={() => setSolidsOnly(!solidsOnly)}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold transition cursor-pointer whitespace-nowrap ${
                  solidsOnly
                    ? "bp-pill-active border-accent bg-accent text-white"
                    : "bp-pill border-slate-200/90 dark:border-slate-700 bg-white/85 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                }`}
              >
                {solidsOnly && <CheckIcon className="h-3 w-3 shrink-0" weight="bold" />}
                <span>仅实色</span>
              </button>
            </div>

            {/* Right: Count + [画廊网格 | 紧凑列表] Switcher */}
            <div className="flex items-center gap-2 ml-auto">
              <span className="font-mono text-[11px] font-bold text-slate-400 whitespace-nowrap">
                {filteredPaints.length} 款
              </span>
              <div className="bp-segmented inline-flex rounded-full bg-slate-200/80 dark:bg-slate-800 p-0.5 border border-slate-200/80 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setViewMode("gallery")}
                  className={`bp-segmented-item flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition cursor-pointer whitespace-nowrap ${
                    viewMode === "gallery"
                      ? "bp-segmented-item-active bg-white dark:bg-slate-900 text-accent dark:text-white shadow-2xs"
                      : "text-slate-500 dark:text-slate-400"
                  }`}
                  title="画廊网格视图"
                >
                  <SquaresFourIcon className="h-3.5 w-3.5 shrink-0" />
                  <span>画廊</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("compact")}
                  className={`bp-segmented-item flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition cursor-pointer whitespace-nowrap ${
                    viewMode === "compact"
                      ? "bp-segmented-item-active bg-white dark:bg-slate-900 text-accent dark:text-white shadow-2xs"
                      : "text-slate-500 dark:text-slate-400"
                  }`}
                  title="Notion 紧凑列表视图"
                >
                  <ListIcon className="h-3.5 w-3.5 shrink-0" />
                  <span>列表</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Catalog Results: Gallery Grid vs Notion Compact List (with instant non-blocking loading animation + progressive batching) */}
      {!isReady || paints.length === 0 ? (
        <div className="space-y-3 pr-1.5 pb-4 pt-2 animate-fadeIn">
          <div className="bp-subcard-lg flex items-center justify-center gap-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/85 dark:bg-slate-900/75 py-8 px-4 shadow-2xs">
            <span className="h-5 w-5 rounded-full border-2 border-accent border-t-transparent animate-spin shrink-0" />
            <span className="text-xs font-extrabold text-slate-600 dark:text-slate-300">
              {lang === "zh" ? "正在加载模型漆数据库..." : "Loading paint database..."}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((idx) => (
              <div
                key={idx}
                className="bp-subcard flex items-center gap-3 rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 p-3 animate-pulse"
              >
                <div className="bp-swatch h-11 w-11 rounded-xl bg-slate-200 dark:bg-slate-800 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-2/3 rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="h-2.5 w-1/2 rounded bg-slate-100 dark:bg-slate-800/70" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
      <div className="space-y-2.5 pr-1.5 pb-1.5">
        {visibleGroups.map((group) => {
          const isCollapsed = collapsed.has(group.prefix);
          return (
            <div
              key={group.prefix}
              className="bp-subcard-lg rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 overflow-hidden shadow-2xs"
            >
              <button
                type="button"
                onClick={() => toggleCollapse(group.prefix)}
                className="bp-dashed-header flex w-full items-center justify-between px-3.5 py-2.5 text-left text-xs font-extrabold text-slate-700 dark:text-slate-200 bg-slate-50/70 dark:bg-slate-800/40"
              >
                <span className="flex items-center gap-2 font-mono">
                  <span>{group.prefix}</span>
                  <span className="bp-badge rounded-full bg-slate-200/80 dark:bg-slate-700 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-600 dark:text-slate-300">
                    {group.paints.length}
                  </span>
                </span>
                <span className="text-slate-400">
                  {isCollapsed ? (
                    <PlusIcon className="w-3.5 h-3.5" weight="bold" />
                  ) : (
                    <MinusIcon className="w-3.5 h-3.5" weight="bold" />
                  )}
                </span>
              </button>

              {!isCollapsed &&
                (viewMode === "gallery" ? (
                  /* Mode A: Gallery Swatch Cards Grid (Pure Color Swatch, Bottle Thumbnail on Hover) */
                  <div className="grid grid-cols-1 gap-2.5 px-3 pb-3.5 pt-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {group.paints.map((paint) => {
                      const isAssigned = activeSampleColor?.assignedPaint?.id === paint.id;
                      const appType =
                        searchMetaMap.get(paint.id)?.appType ?? getPaintApplicationType(paint);
                      return (
                        <PaintBottleHover
                          key={paint.id}
                          brand={paint.brand}
                          code={paint.code}
                          name={paint.name}
                          hex={paint.hex}
                        >
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              if (onAssignCatalog && activeSampleColor) {
                                onAssignCatalog(paint);
                              } else {
                                onPickHex?.(paint.hex);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                if (onAssignCatalog && activeSampleColor) {
                                  onAssignCatalog(paint);
                                } else {
                                  onPickHex?.(paint.hex);
                                }
                              }
                            }}
                            className={`bp-subcard bp-subcard-interactive group flex w-full items-center gap-3 rounded-2xl border p-2.5 sm:p-3 text-left transition active:scale-[0.99] cursor-pointer ${
                              isAssigned
                                ? "bp-subcard-active border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/35 ring-1 ring-emerald-500/30"
                                : "border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-accent hover:shadow-xs"
                            }`}
                          >
                            {/* Pure Color Swatch Block (No thumbnail directly on card) */}
                            <div
                              className="bp-swatch relative h-11 w-11 flex-shrink-0 rounded-xl border border-black/10 dark:border-white/10 shadow-2xs overflow-hidden"
                              style={{ backgroundColor: paint.hex }}
                              title={`${paint.code} ${paint.name}`}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="truncate font-mono text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-100 group-hover:text-accent transition-colors">
                                  {paint.code} {paint.name}
                                </span>
                                <span
                                  className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-extrabold ${
                                    appType === "airbrush"
                                      ? "bg-sky-500/12 text-sky-700 dark:text-sky-300"
                                      : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                  }`}
                                >
                                  {appType === "airbrush" ? "💨喷涂" : "🖌️手涂"}
                                </span>
                              </div>
                              <div className="truncate font-mono text-[10px] sm:text-[11px] text-slate-400 mt-0.5">
                                {paint.hex.toUpperCase()}
                                {paint.brand ? ` · ${localizedBrand(paint.brand, lang)}` : ""}
                                {paint.set ? ` · ${paint.set}` : ""}
                              </div>
                            </div>
                            {onAssignCatalog && activeSampleColor ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAssignCatalog(paint);
                                }}
                                className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-bold shrink-0 transition whitespace-nowrap cursor-pointer ${
                                  isAssigned
                                    ? "bp-use-btn-used bg-emerald-600 text-white"
                                    : "bp-use-btn bg-accent/10 text-accent hover:bg-accent hover:text-white border border-accent/25 dark:bg-accent/20 dark:text-accent-light dark:hover:bg-accent dark:hover:text-white"
                                }`}
                              >
                                {isAssigned && <CheckIcon className="w-3 h-3" weight="bold" />}
                                <span>{isAssigned ? (lang === "zh" ? "已绑定" : "Bound") : (lang === "zh" ? "指派" : "Assign")}</span>
                              </button>
                            ) : onPickHex ? (
                              <span className="text-slate-300 dark:text-slate-600 group-hover:text-accent transition-colors flex-shrink-0">
                                <ArrowUpRightIcon className="w-4 h-4" weight="bold" />
                              </span>
                            ) : null}
                          </div>
                        </PaintBottleHover>
                      );
                    })}
                  </div>
                ) : (
                  /* Mode B: Notion-Style High-Density 54px Compact List with Colored Attribute Tags */
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {group.paints.map((paint) => {
                      const finishMeta =
                        FINISH_LABELS[paint.finish] || FINISH_LABELS.standard;
                      const isAssigned = activeSampleColor?.assignedPaint?.id === paint.id;
                      const appType =
                        searchMetaMap.get(paint.id)?.appType ?? getPaintApplicationType(paint);
                      return (
                        <PaintBottleHover
                          key={paint.id}
                          brand={paint.brand}
                          code={paint.code}
                          name={paint.name}
                          hex={paint.hex}
                        >
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              if (onAssignCatalog && activeSampleColor) {
                                onAssignCatalog(paint);
                              } else {
                                onPickHex?.(paint.hex);
                              }
                            }}
                            className={`group flex w-full h-[54px] items-center justify-between gap-2.5 px-3.5 text-left transition cursor-pointer ${
                              isAssigned
                                ? "bg-emerald-50/70 dark:bg-emerald-950/35"
                                : "hover:bg-slate-50/90 dark:hover:bg-slate-800/50"
                            }`}
                          >
                            {/* Left: Pure Color Swatch + Code + Name + Hex */}
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div
                                className="bp-swatch relative h-9 w-9 rounded-xl border border-black/10 dark:border-white/10 shrink-0 overflow-hidden shadow-2xs"
                                style={{ backgroundColor: paint.hex }}
                                title={`${paint.code} ${paint.name}`}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="font-mono text-xs font-black text-slate-900 dark:text-white shrink-0 group-hover:text-accent transition-colors">
                                    {paint.code}
                                  </span>
                                  <span className="truncate text-xs font-bold text-slate-700 dark:text-slate-200">
                                    {paint.name}
                                  </span>
                                </div>
                                <div className="font-mono text-[10px] text-slate-400">
                                  {paint.hex.toUpperCase()}
                                </div>
                              </div>
                            </div>

                            {/* Right: Notion-Style Colored Attribute Tags ([喷涂/手涂], [品牌], [光泽], [系列]) + Assign Button */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span
                                className={`bp-badge rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                                  appType === "airbrush"
                                    ? "bg-sky-500/12 text-sky-700 dark:text-sky-300"
                                    : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                }`}
                              >
                                {appType === "airbrush" ? "💨喷涂" : "🖌️手涂"}
                              </span>
                              <span className="bp-badge rounded-md bg-accent/10 dark:bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent dark:text-accent-light">
                                {localizedBrand(paint.brand, lang)}
                              </span>
                              <span
                                className={`bp-badge rounded-md px-2 py-0.5 text-[10px] font-bold ${finishMeta.colorClass}`}
                              >
                                {finishMeta.zh}
                              </span>
                              {paint.set && (
                                <span className="bp-badge hidden sm:inline-block rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400 max-w-[110px] truncate">
                                  {paint.set}
                                </span>
                              )}
                              {onAssignCatalog && activeSampleColor && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onAssignCatalog(paint);
                                  }}
                                  className={`rounded-lg px-2 py-1 text-[10px] font-bold transition whitespace-nowrap cursor-pointer ${
                                    isAssigned
                                      ? "bp-use-btn-used bg-emerald-600 text-white"
                                      : "bp-use-btn bg-accent/10 text-accent hover:bg-accent hover:text-white border border-accent/25 dark:bg-accent/20 dark:text-accent-light"
                                  }`}
                                >
                                  {isAssigned ? (lang === "zh" ? "已绑定" : "Bound") : (lang === "zh" ? "指派" : "Assign")}
                                </button>
                              )}
                            </div>
                          </div>
                        </PaintBottleHover>
                      );
                    })}
                  </div>
                ))}
            </div>
          );
        })}

        {hasMoreGroups && (
          <div
            ref={loadMoreSentinelRef}
            className="flex flex-wrap items-center justify-center gap-2.5 py-4 text-xs"
          >
            <button
              type="button"
              onClick={() =>
                setVisibleGroupLimit((prev) => Math.min(groups.length, prev + GROUP_BATCH_STEP))
              }
              className="bp-pill inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-accent hover:text-accent transition cursor-pointer"
            >
              <span className="h-3.5 w-3.5 rounded-full border-2 border-accent border-t-transparent animate-spin shrink-0" />
              <span>
                {lang === "zh"
                  ? `向下滚动自动加载更多 (${visibleGroups.length}/${groups.length} 组)`
                  : `Scroll to load more (${visibleGroups.length}/${groups.length})`}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setVisibleGroupLimit(groups.length)}
              className="bp-pill inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-accent transition cursor-pointer"
            >
              <span>{lang === "zh" ? "展开全部" : "Show All"}</span>
            </button>
          </div>
        )}

        {groups.length === 0 && (
          <div className="py-12 text-center text-xs text-slate-400 space-y-3">
            <div>{lang === "zh" ? "在当前常用品牌或筛选条件下没有找到匹配的模型漆" : "No matching paints found"}</div>
            {!showUncommonBrands && (
              <button
                type="button"
                onClick={() => setShowUncommonBrands(true)}
                className="bp-pill inline-flex items-center gap-1.5 rounded-full border border-amber-400 bg-amber-50 dark:bg-amber-950/60 px-3.5 py-1.5 text-xs font-extrabold text-amber-800 dark:text-amber-200 cursor-pointer"
              >
                <span>🌐 展开 +{uncommonBrandCount} 个不常用品牌并重新搜索</span>
              </button>
            )}
          </div>
        )}
      </div>
      )}
    </div>
  );
};

export default PaintCatalogBrowser;
