import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CatalogPaint, ColorData, Language } from "../types";
import { PaintBottleImg } from "./PaintBottleHover";
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
  GAIA_CATEGORY_ORDER,
  NIGHTWORKS_CATEGORY_ORDER,
  PaintApplicationType,
  PaintSolventType,
  getPaintApplicationType,
  getPaintSolventType,
  loadPaintCatalog,
  localizedBrand,
  paintPrefix,
} from "../utils/paintCatalog";

interface PaintCatalogBrowserProps {
  lang: Language;
  initialPaints?: CatalogPaint[];
  onPickHex?: (hex: string) => void;
  onAssignCatalog?: (paint: CatalogPaint) => void;
  activeSampleColor?: ColorData | null;
}

const INITIAL_ITEM_BATCH = 60;
const ITEM_BATCH_STEP = 90;

const BRAND_PRIORITY_MAP = new Map<string, number>(
  FEATURED_BRANDS.map((b, idx) => [b, idx])
);

const preSortCatalogPaints = (raw: CatalogPaint[]): CatalogPaint[] => {
  if (!raw || raw.length === 0) return [];
  return [...raw].sort((a, b) => {
    if (a.brand !== b.brand) {
      const pa = BRAND_PRIORITY_MAP.get(a.brand) ?? Number.MAX_SAFE_INTEGER;
      const pb = BRAND_PRIORITY_MAP.get(b.brand) ?? Number.MAX_SAFE_INTEGER;
      if (pa !== pb) return pa - pb;
      return a.brand.localeCompare(b.brand);
    }
    const codeCmp = a.code.localeCompare(b.code, undefined, { numeric: true });
    if (codeCmp !== 0) return codeCmp;
    return a.name.localeCompare(b.name);
  });
};

const FINISH_LABELS: Record<string, { zh: string; colorClass: string }> = {
  standard: { zh: "标准实色", colorClass: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  metallic: { zh: "金属漆", colorClass: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" },
  extraMetal: { zh: "极光/特调金属", colorClass: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" },
  primeMetal: { zh: "超级金属漆", colorClass: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" },
  pearl: { zh: "珍珠/偏光", colorClass: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950/60 dark:text-fuchsia-300" },
  clear: { zh: "透明漆", colorClass: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300" },
  fluorescent: { zh: "荧光色", colorClass: "bg-lime-100 text-lime-800 dark:bg-lime-950/60 dark:text-lime-300" },
  hyper: { zh: "高遮盖实色", colorClass: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300" },
  wash: { zh: "渍洗/阴影", colorClass: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300" },
  ink: { zh: "透明/滤镜", colorClass: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300" },
  other: { zh: "特殊/底漆", colorClass: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300" },
};

const QUICK_CHIPS = [
  { id: "primer", label: "🔥 常用底漆", keyword: "补土 底漆 primer" },
  { id: "metallic", label: "✨ 金属漆", finish: "metallic", keyword: "金 银 铁 铜 金属" },
  { id: "matte", label: "🌫️ 消光/半光", keyword: "消光 半光 哑光" },
  { id: "fluorescent", label: "🎨 荧光色", keyword: "荧光" },
  { id: "pearl", label: "🫧 珍珠/魔幻", keyword: "珍珠 偏光 魔幻 棱镜" },
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
    initialPaints && initialPaints.length > 0 ? preSortCatalogPaints(initialPaints) : []
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
  const [solventFilter, setSolventFilter] = useState<"all" | PaintSolventType>("all");
  const [viewMode, setViewMode] = useState<"gallery" | "compact">("gallery");
  const [viewModeUI, setViewModeUI] = useState<"gallery" | "compact">("gallery");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [openFilterMenu, setOpenFilterMenu] = useState<"series" | "finish" | null>(null);
  const [visibleItemLimit, setVisibleItemLimit] = useState<number>(INITIAL_ITEM_BATCH);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

  // Single event-delegated hover preview state (replaces 1,000+ per-card PaintBottleHover instances)
  const [hoveredBottle, setHoveredBottle] = useState<{
    brand: string;
    code: string;
    name: string;
    hex: string;
    x: number;
    y: number;
  } | null>(null);
  const hoveredCardElRef = useRef<HTMLElement | null>(null);

  const handleSwitchViewMode = useCallback((nextMode: "gallery" | "compact") => {
    setViewModeUI(nextMode);
    setHoveredBottle(null);
    hoveredCardElRef.current = null;
    startTransition(() => {
      setVisibleItemLimit(INITIAL_ITEM_BATCH);
      setViewMode(nextMode);
    });
  }, []);

  const commonBrandsSet = useMemo(() => new Set<string>(COMMON_MODEL_BRANDS), []);

  useEffect(() => {
    if (initialPaints && initialPaints.length > 0) {
      setPaints(preSortCatalogPaints(initialPaints));
    } else {
      loadPaintCatalog().then((loaded) => {
        setPaints(preSortCatalogPaints(loaded));
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

  // Reset progressive item window when filters change
  useEffect(() => {
    setVisibleItemLimit(INITIAL_ITEM_BATCH);
  }, [
    brand,
    solidsOnly,
    finishFilter,
    prefix,
    search,
    activeQuickChip,
    showUncommonBrands,
    applicationFilter,
    solventFilter,
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

  // Pre-build search haystack, application mode (喷涂 vs 手涂), and chemistry (油性 vs 水性) once per catalog load
  const searchMetaMap = useMemo(() => {
    const map = new Map<
      string,
      { pfx: string; hay: string; appType: PaintApplicationType; solventType: PaintSolventType }
    >();
    for (const paint of paints) {
      const pfx = paintPrefix(paint);
      const appType = getPaintApplicationType(paint);
      const solventType = getPaintSolventType(paint);
      const appLabel = appType === "airbrush" ? "喷涂 喷笔" : "手涂 笔涂";
      const solventLabel = solventType === "oil" ? "油性 硝基 珐琅" : "水性 丙烯";
      const localizedB = localizedBrand(paint.brand, "zh").toLowerCase();
      const hay = `${paint.brand} ${localizedB} ${paint.code} ${paint.name} ${paint.hex} ${paint.set} ${paint.finish} ${appLabel} ${solventLabel}`.toLowerCase();
      map.set(paint.id, { pfx, hay, appType, solventType });
    }
    return map;
  }, [paints]);

  // Brands that actually contain at least 1 paint for the active applicationFilter
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

  // If the active brand has no paints under the newly switched applicationFilter, reset to ALL
  useEffect(() => {
    if (brand !== "ALL" && !brands.includes(brand)) {
      setBrand("ALL");
      setPrefix(null);
    }
  }, [brands, brand]);

  // Live Oil vs Water counts inside the currently selected brand (or all brands when brand === "ALL")
  const brandSolventCounts = useMemo(() => {
    let oil = 0;
    let water = 0;
    for (const paint of paints) {
      if (!showUncommonBrands && !commonBrandsSet.has(paint.brand)) continue;
      if (brand !== "ALL" && paint.brand !== brand) continue;
      const meta = searchMetaMap.get(paint.id);
      const appType = meta ? meta.appType : getPaintApplicationType(paint);
      if (applicationFilter !== "all" && appType !== applicationFilter) continue;
      const st = meta ? meta.solventType : getPaintSolventType(paint);
      if (st === "oil") oil += 1;
      else water += 1;
    }
    return { all: oil + water, oil, water };
  }, [paints, showUncommonBrands, commonBrandsSet, brand, applicationFilter, searchMetaMap]);

  // Auto-reset solventFilter to "all" if switching to a brand that only has the other chemistry (e.g. switching from Night Works water to Gaia oil while water is selected)
  useEffect(() => {
    if (solventFilter === "oil" && brandSolventCounts.oil === 0 && brandSolventCounts.water > 0) {
      setSolventFilter("all");
    } else if (solventFilter === "water" && brandSolventCounts.water === 0 && brandSolventCounts.oil > 0) {
      setSolventFilter("all");
    }
  }, [brand, brandSolventCounts, solventFilter]);

  const uncommonBrandCount = Math.max(0, allUniqueBrands.length - commonBrandsSet.size);

  // Space-separated multi-keyword matching + Common/Uncommon Brand Scope + Spray/Brush Filter + Oil/Water Filter
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

      const solventType = meta ? meta.solventType : getPaintSolventType(paint);
      if (solventFilter !== "all" && solventType !== solventFilter) return false;

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
    solventFilter,
    prefix,
    search,
    activeQuickChip,
  ]);

  const scopedPaintsCount = useMemo(() => {
    return paints.filter((p) => {
      if (!showUncommonBrands && !commonBrandsSet.has(p.brand)) return false;
      const meta = searchMetaMap.get(p.id);
      if (applicationFilter !== "all") {
        const appType = meta?.appType ?? getPaintApplicationType(p);
        if (appType !== applicationFilter) return false;
      }
      if (solventFilter !== "all") {
        const st = meta?.solventType ?? getPaintSolventType(p);
        if (st !== solventFilter) return false;
      }
      return true;
    }).length;
  }, [paints, showUncommonBrands, commonBrandsSet, applicationFilter, solventFilter, searchMetaMap]);

  const availablePrefixes = useMemo(() => {
    const scope = paints.filter((p) => {
      if (!showUncommonBrands && !commonBrandsSet.has(p.brand)) return false;
      if (brand !== "ALL" && p.brand !== brand) return false;
      if (solventFilter !== "all") {
        const st = searchMetaMap.get(p.id)?.solventType ?? getPaintSolventType(p);
        if (st !== solventFilter) return false;
      }
      return true;
    });
    const set = new Set<string>();
    for (const p of scope) {
      set.add(searchMetaMap.get(p.id)?.pfx ?? paintPrefix(p));
    }
    return Array.from(set).sort((a, b) => {
      if (brand === "Gaia") {
        const li = GAIA_CATEGORY_ORDER.indexOf(a);
        const ri = GAIA_CATEGORY_ORDER.indexOf(b);
        const left = li === -1 ? Number.MAX_SAFE_INTEGER : li;
        const right = ri === -1 ? Number.MAX_SAFE_INTEGER : ri;
        if (left !== right) return left - right;
      } else if (brand === "Night Works") {
        const li = NIGHTWORKS_CATEGORY_ORDER.indexOf(a);
        const ri = NIGHTWORKS_CATEGORY_ORDER.indexOf(b);
        const left = li === -1 ? Number.MAX_SAFE_INTEGER : li;
        const right = ri === -1 ? Number.MAX_SAFE_INTEGER : ri;
        if (left !== right) return left - right;
      }
      return a.localeCompare(b, undefined, { numeric: true });
    });
  }, [paints, searchMetaMap, showUncommonBrands, commonBrandsSet, brand, solventFilter]);

  const groups = useMemo(() => {
    const bucket = new Map<string, CatalogPaint[]>();
    for (const paint of filteredPaints) {
      const pfx = searchMetaMap.get(paint.id)?.pfx ?? paintPrefix(paint);
      const key =
        brand === "ALL"
          ? `${localizedBrand(paint.brand, lang)} · ${pfx}`
          : pfx;
      let list = bucket.get(key);
      if (!list) {
        list = [];
        bucket.set(key, list);
      }
      list.push(paint);
    }
    const entries = Array.from(bucket.entries()).map(([grpKey, list]) => ({
      prefix: grpKey,
      paints: list,
    }));
    if (brand === "Gaia") {
      entries.sort((a, b) => {
        const li = GAIA_CATEGORY_ORDER.indexOf(a.prefix);
        const ri = GAIA_CATEGORY_ORDER.indexOf(b.prefix);
        const left = li === -1 ? Number.MAX_SAFE_INTEGER : li;
        const right = ri === -1 ? Number.MAX_SAFE_INTEGER : ri;
        if (left !== right) return left - right;
        return a.prefix.localeCompare(b.prefix, undefined, { numeric: true });
      });
    } else if (brand === "Night Works") {
      entries.sort((a, b) => {
        const li = NIGHTWORKS_CATEGORY_ORDER.indexOf(a.prefix);
        const ri = NIGHTWORKS_CATEGORY_ORDER.indexOf(b.prefix);
        const left = li === -1 ? Number.MAX_SAFE_INTEGER : li;
        const right = ri === -1 ? Number.MAX_SAFE_INTEGER : ri;
        if (left !== right) return left - right;
        return a.prefix.localeCompare(b.prefix, undefined, { numeric: true });
      });
    }
    return entries;
  }, [filteredPaints, searchMetaMap, brand, lang]);

  // Slice by total rendered paint items (INITIAL_ITEM_BATCH = 60) so even groups with 300+ paints never block the main thread on view switch
  const { visibleGroups, renderedPaintCount, hasMoreItems } = useMemo(() => {
    const result: Array<{
      prefix: string;
      paints: CatalogPaint[];
      totalCount: number;
    }> = [];
    let count = 0;
    let more = false;

    for (const grp of groups) {
      const totalCount = grp.paints.length;
      if (collapsed.has(grp.prefix)) {
        result.push({ prefix: grp.prefix, paints: [], totalCount });
        continue;
      }
      if (count >= visibleItemLimit) {
        more = true;
        break;
      }
      const remaining = visibleItemLimit - count;
      if (totalCount <= remaining) {
        result.push({ prefix: grp.prefix, paints: grp.paints, totalCount });
        count += totalCount;
      } else {
        result.push({
          prefix: grp.prefix,
          paints: grp.paints.slice(0, remaining),
          totalCount,
        });
        count += remaining;
        more = true;
        break;
      }
    }
    return { visibleGroups: result, renderedPaintCount: count, hasMoreItems: more };
  }, [groups, visibleItemLimit, collapsed]);

  // Automatically expand visible items when scrolling near the sentinel
  useEffect(() => {
    if (!isReady || !hasMoreItems) return;
    const node = loadMoreSentinelRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          startTransition(() => {
            setVisibleItemLimit((prev) =>
              Math.min(filteredPaints.length, prev + ITEM_BATCH_STEP)
            );
          });
        }
      },
      { rootMargin: "420px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [isReady, hasMoreItems, filteredPaints.length]);

  const handleCatalogMouseOver = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (typeof window !== "undefined" && !window.matchMedia("(hover: hover)").matches) {
      return;
    }
    const target = (e.target as Element | null)?.closest?.(
      "[data-bottle-code]"
    ) as HTMLElement | null;
    if (!target) {
      if (hoveredCardElRef.current) {
        hoveredCardElRef.current = null;
        setHoveredBottle(null);
      }
      return;
    }
    if (hoveredCardElRef.current === target) return;
    hoveredCardElRef.current = target;

    const b = target.getAttribute("data-bottle-brand") || "";
    const c = target.getAttribute("data-bottle-code") || "";
    const n = target.getAttribute("data-bottle-name") || "";
    const h = target.getAttribute("data-bottle-hex") || "#808080";
    if (!b || !c) return;

    const rect = target.getBoundingClientRect();
    const width = 160;
    const height = 220;
    const gap = 12;
    const pad = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const leftX = rect.left - gap - width;
    const rightX = rect.right + gap;
    const canLeft = leftX >= pad;
    const canRight = rightX + width <= vw - pad;

    let x: number;
    if (canLeft) x = leftX;
    else if (canRight) x = rightX;
    else x = rect.left >= vw - rect.right ? pad : vw - width - pad;

    let y = rect.top;
    if (y + height > vh - pad) y = vh - height - pad;
    if (y < pad) y = pad;

    const overlapsRow =
      x < rect.right && x + width > rect.left && y < rect.bottom && y + height > rect.top;
    if (overlapsRow) {
      const aboveY = rect.top - gap - height;
      if (aboveY >= pad) y = aboveY;
      else y = Math.min(vh - height - pad, rect.bottom + gap);
    }

    setHoveredBottle({ brand: b, code: c, name: n, hex: h, x, y });
  }, []);

  const handleCatalogMouseLeave = useCallback(() => {
    hoveredCardElRef.current = null;
    setHoveredBottle(null);
  }, []);

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

        {/* Brand-Internal Oil vs Water Chemistry Filter Bar (品牌内部油性/水性筛选器) */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/85 dark:bg-slate-900/80 px-2.5 py-1.5 mr-1.5 shadow-2xs">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 whitespace-nowrap">
              {brand === "ALL"
                ? "🧪 漆性筛选 (油性 / 水性):"
                : `🧪 「${localizedBrand(brand, lang)}」内部漆性筛选:`}
            </span>
          </div>
          <div className="bp-segmented inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200/80 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setSolventFilter("all")}
              className={`bp-segmented-item rounded-full px-2.5 py-1 text-[11px] font-extrabold transition cursor-pointer whitespace-nowrap ${
                solventFilter === "all"
                  ? "bp-segmented-item-active bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
              }`}
            >
              全部性质 ({brandSolventCounts.all})
            </button>
            <button
              type="button"
              onClick={() => setSolventFilter("oil")}
              disabled={brandSolventCounts.oil === 0}
              className={`bp-segmented-item flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold transition whitespace-nowrap ${
                brandSolventCounts.oil === 0
                  ? "opacity-40 cursor-not-allowed text-slate-400"
                  : solventFilter === "oil"
                  ? "bp-segmented-item-active bg-rose-600 text-white shadow-2xs cursor-pointer"
                  : "text-slate-600 dark:text-slate-300 hover:text-rose-600 cursor-pointer"
              }`}
              title="筛选硝基漆、珐琅漆等油性模型漆"
            >
              <span>🧪</span>
              <span>油性漆 ({brandSolventCounts.oil})</span>
            </button>
            <button
              type="button"
              onClick={() => setSolventFilter("water")}
              disabled={brandSolventCounts.water === 0}
              className={`bp-segmented-item flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold transition whitespace-nowrap ${
                brandSolventCounts.water === 0
                  ? "opacity-40 cursor-not-allowed text-slate-400"
                  : solventFilter === "water"
                  ? "bp-segmented-item-active bg-emerald-600 text-white shadow-2xs cursor-pointer"
                  : "text-slate-600 dark:text-slate-300 hover:text-emerald-600 cursor-pointer"
              }`}
              title="筛选水性丙烯漆、战棋水性漆与水性喷涂漆 (如匠域JW-A、郡士H/N、田宫X/XF)"
            >
              <span>💧</span>
              <span>水性漆 ({brandSolventCounts.water})</span>
            </button>
          </div>
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
                  onClick={() => handleSwitchViewMode("gallery")}
                  className={`bp-segmented-item flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition cursor-pointer whitespace-nowrap ${
                    viewModeUI === "gallery"
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
                  onClick={() => handleSwitchViewMode("compact")}
                  className={`bp-segmented-item flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition cursor-pointer whitespace-nowrap ${
                    viewModeUI === "compact"
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
      <div
        className="space-y-2.5 pr-1.5 pb-1.5"
        onMouseOver={handleCatalogMouseOver}
        onMouseLeave={handleCatalogMouseLeave}
      >
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
                    {group.totalCount}
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
                  /* Mode A: Gallery Swatch Cards Grid (Pure Color Swatch, Delegated Bottle Thumbnail on Hover) */
                  <div className="grid grid-cols-1 gap-2.5 px-3 pb-3.5 pt-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {group.paints.map((paint) => {
                      const isAssigned = activeSampleColor?.assignedPaint?.id === paint.id;
                      const meta = searchMetaMap.get(paint.id);
                      const appType = meta?.appType ?? getPaintApplicationType(paint);
                      const solventType = meta?.solventType ?? getPaintSolventType(paint);
                      return (
                        <div
                          key={paint.id}
                          role="button"
                          tabIndex={0}
                          data-bottle-brand={paint.brand}
                          data-bottle-code={paint.code}
                          data-bottle-name={paint.name}
                          data-bottle-hex={paint.hex}
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
                          className={`bp-subcard bp-subcard-interactive group flex w-full items-center gap-3 rounded-2xl border p-2.5 sm:p-3 text-left transition cursor-pointer ${
                            isAssigned
                              ? "bp-subcard-active border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/35 ring-1 ring-emerald-500/30"
                              : "border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-accent hover:shadow-xs"
                          }`}
                        >
                          {/* Pure Color Swatch Block */}
                          <div
                            className="bp-swatch relative h-11 w-11 flex-shrink-0 rounded-xl border border-black/10 dark:border-white/10 shadow-2xs overflow-hidden"
                            style={{ backgroundColor: paint.hex }}
                            title={`${paint.code} ${paint.name}`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1 min-w-0">
                              <span className="truncate font-mono text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-100 group-hover:text-accent transition-colors">
                                {paint.code} {paint.name}
                              </span>
                              <span
                                className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-extrabold ${
                                  solventType === "oil"
                                    ? "bg-rose-500/12 text-rose-700 dark:text-rose-300"
                                    : "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                                }`}
                              >
                                {solventType === "oil" ? "🧪油性" : "💧水性"}
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
                      const meta = searchMetaMap.get(paint.id);
                      const appType = meta?.appType ?? getPaintApplicationType(paint);
                      const solventType = meta?.solventType ?? getPaintSolventType(paint);
                      return (
                        <div
                          key={paint.id}
                          role="button"
                          tabIndex={0}
                          data-bottle-brand={paint.brand}
                          data-bottle-code={paint.code}
                          data-bottle-name={paint.name}
                          data-bottle-hex={paint.hex}
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

                          {/* Right: Notion-Style Colored Attribute Tags ([油性/水性], [喷涂/手涂], [品牌], [光泽], [系列]) + Assign Button */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className={`bp-badge rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                                solventType === "oil"
                                  ? "bg-rose-500/12 text-rose-700 dark:text-rose-300"
                                  : "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                              }`}
                            >
                              {solventType === "oil" ? "🧪油性" : "💧水性"}
                            </span>
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
                      );
                    })}
                  </div>
                ))}
            </div>
          );
        })}

        {hasMoreItems && (
          <div
            ref={loadMoreSentinelRef}
            className="flex flex-wrap items-center justify-center gap-2.5 py-4 text-xs"
          >
            <button
              type="button"
              onClick={() =>
                startTransition(() => {
                  setVisibleItemLimit((prev) =>
                    Math.min(filteredPaints.length, prev + ITEM_BATCH_STEP)
                  );
                })
              }
              className="bp-pill inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-accent hover:text-accent transition cursor-pointer"
            >
              <span className="h-3.5 w-3.5 rounded-full border-2 border-accent border-t-transparent animate-spin shrink-0" />
              <span>
                {lang === "zh"
                  ? `向下滚动自动加载更多 (${renderedPaintCount}/${filteredPaints.length} 款)`
                  : `Scroll to load more (${renderedPaintCount}/${filteredPaints.length})`}
              </span>
            </button>
            <button
              type="button"
              onClick={() =>
                startTransition(() => {
                  setVisibleItemLimit(filteredPaints.length);
                })
              }
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

        {hoveredBottle &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              className="pointer-events-none fixed z-[90] w-44 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 transition-opacity duration-150 animate-in fade-in"
              style={{ left: hoveredBottle.x, top: hoveredBottle.y }}
              role="tooltip"
            >
              <div className="relative flex h-36 items-center justify-center bg-slate-50/90 dark:bg-slate-800/80 p-2">
                <div
                  className="absolute h-16 w-16 rounded-xl border border-black/10 shadow-inner dark:border-white/15"
                  style={{ backgroundColor: hoveredBottle.hex }}
                />
                <PaintBottleImg
                  brand={hoveredBottle.brand}
                  code={hoveredBottle.code}
                  hex={hoveredBottle.hex}
                  className="relative z-[1] max-h-28 max-w-28 object-contain drop-shadow-md"
                />
              </div>
              <div className="border-t border-slate-100 px-3 py-2.5 dark:border-slate-800">
                <div className="truncate font-mono text-xs font-bold text-slate-800 dark:text-slate-100">
                  {hoveredBottle.brand} {hoveredBottle.code}
                </div>
                {hoveredBottle.name && (
                  <div className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                    {hoveredBottle.name}
                  </div>
                )}
                <div
                  className="mt-1.5 inline-block rounded-md px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums shadow-2xs"
                  style={{
                    backgroundColor: hoveredBottle.hex,
                    color:
                      parseInt(hoveredBottle.hex.slice(1, 3), 16) * 0.299 +
                        parseInt(hoveredBottle.hex.slice(3, 5), 16) * 0.587 +
                        parseInt(hoveredBottle.hex.slice(5, 7), 16) * 0.114 >
                      128
                        ? "#000"
                        : "#fff",
                  }}
                >
                  {hoveredBottle.hex.toUpperCase()}
                </div>
              </div>
            </div>,
            document.body
          )}
      </div>
      )}
    </div>
  );
};

export default PaintCatalogBrowser;
