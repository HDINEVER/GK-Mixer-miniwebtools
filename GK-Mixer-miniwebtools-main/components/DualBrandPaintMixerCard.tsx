import React, { useEffect, useMemo, useState } from "react";
import { CatalogPaint, ColorData, Language } from "../types";
import { lerp } from "../utils/mixbox";
import { rgbToHex } from "../utils/colorUtils";
import {
  FEATURED_BRANDS,
  PaintMatchEngine,
  getPaintSolventType,
  loadPaintCatalog,
  localizedBrand,
  matchQuality,
  matchQualityLabel,
} from "../utils/paintCatalog";
import { PaintBottleImg } from "./PaintBottleHover";
import {
  FlaskIcon,
  ArrowsLeftRightIcon,
  MagnifyingGlassIcon,
  CheckIcon,
  CaretDownIcon,
  SparkleIcon,
  ArrowRightIcon,
  LockKeyIcon,
  LockKeyOpenIcon,
  WarningIcon,
} from "@phosphor-icons/react";

interface DualBrandPaintMixerCardProps {
  lang: Language;
  sandboxColors?: ColorData[];
  selectedSandboxColor?: ColorData | null;
  onSendHexToBrandMatcher: (hex: string) => void;
  onAssignCatalogPaint?: (paint: CatalogPaint) => void;
}

const RATIO_PRESETS: { label: string; ratioB: number; dropsA: number; dropsB: number }[] = [
  { label: "4 : 1", ratioB: 0.2, dropsA: 8, dropsB: 2 },
  { label: "3 : 1", ratioB: 0.25, dropsA: 6, dropsB: 2 },
  { label: "2 : 1", ratioB: 0.33, dropsA: 6, dropsB: 3 },
  { label: "1 : 1", ratioB: 0.5, dropsA: 5, dropsB: 5 },
  { label: "1 : 2", ratioB: 0.67, dropsA: 3, dropsB: 6 },
  { label: "1 : 3", ratioB: 0.75, dropsA: 2, dropsB: 6 },
  { label: "1 : 4", ratioB: 0.8, dropsA: 2, dropsB: 8 },
];

export const DualBrandPaintMixerCard: React.FC<DualBrandPaintMixerCardProps> = ({
  lang,
  sandboxColors = [],
  selectedSandboxColor,
  onSendHexToBrandMatcher,
  onAssignCatalogPaint,
}) => {
  const [catalog, setCatalog] = useState<CatalogPaint[]>([]);
  const [paintA, setPaintA] = useState<CatalogPaint | null>(null);
  const [paintB, setPaintB] = useState<CatalogPaint | null>(null);
  // ratioB = proportion of Paint B in [0.05, 0.95]
  const [ratioBPct, setRatioBPct] = useState<number>(50);
  const [activePickerSlot, setActivePickerSlot] = useState<"A" | "B" | null>(null);
  const [pickerBrand, setPickerBrand] = useState<string>("COMMON");
  const [pickerQuery, setPickerQuery] = useState<string>("");
  // Default to same-brand mixing only; user can manually toggle cross-brand mixing on (with warning)
  const [allowCrossBrand, setAllowCrossBrand] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    loadPaintCatalog().then((paints) => {
      if (cancelled || !paints.length) return;
      setCatalog(paints);
      // Default to two classic model paints (e.g. Cobalt Blue + Bright Yellow or Red + White)
      const defA =
        paints.find((p) => p.brand === "Gaia" && p.code === "004") ||
        paints.find((p) => p.brand === "Gaia" && p.code === "003") ||
        paints[0];
      const defB =
        paints.find((p) => p.brand === "Gaia" && p.code === "005") ||
        paints.find((p) => p.brand === "Gaia" && p.code === "001") ||
        paints[Math.min(1, paints.length - 1)];
      setPaintA((prev) => prev || defA || null);
      setPaintB((prev) => prev || defB || null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const engine = useMemo(
    () => (catalog.length > 0 ? new PaintMatchEngine(catalog) : null),
    [catalog]
  );

  // Compute physical pigment mix via Mixbox 2.0
  const mixedHex = useMemo(() => {
    if (!paintA && !paintB) return "#64748B";
    if (!paintA) return (paintB?.hex || "#64748B").toUpperCase();
    if (!paintB) return (paintA?.hex || "#64748B").toUpperCase();
    try {
      const t = Math.max(0.05, Math.min(0.95, ratioBPct / 100));
      const rgb = lerp(paintA.hex, paintB.hex, t);
      if (!rgb || rgb.length < 3) return paintA.hex.toUpperCase();
      return rgbToHex(
        Math.round(rgb[0]),
        Math.round(rgb[1]),
        Math.round(rgb[2])
      ).toUpperCase();
    } catch {
      return paintA.hex.toUpperCase();
    }
  }, [paintA, paintB, ratioBPct]);

  // Live gradient bar across Mixbox steps (0% -> 25% -> 50% -> 75% -> 100%)
  const mixGradientCss = useMemo(() => {
    if (!paintA || !paintB) return "linear-gradient(to right, #3b82f6, #eab308)";
    try {
      const stops = [0, 0.25, 0.5, 0.75, 1].map((t) => {
        const c = lerp(paintA.hex, paintB.hex, t);
        const hx =
          c && c.length >= 3
            ? rgbToHex(Math.round(c[0]), Math.round(c[1]), Math.round(c[2]))
            : t < 0.5
            ? paintA.hex
            : paintB.hex;
        return `${hx} ${Math.round(t * 100)}%`;
      });
      return `linear-gradient(to right, ${stops.join(", ")})`;
    } catch {
      return `linear-gradient(to right, ${paintA.hex}, ${paintB.hex})`;
    }
  }, [paintA, paintB]);

  // Top 4 closest single-bottle brand paints to the Mixbox mixed result
  const topSameColorPaints = useMemo(() => {
    if (!engine || !mixedHex) return [];
    const featured = engine.findClosestByBrands(mixedHex, [...FEATURED_BRANDS], 6);
    if (featured.length >= 4) return featured.slice(0, 4);
    return engine.findClosest(mixedHex, 4);
  }, [engine, mixedHex]);

  // Helper: find a companion paint of the same brand & same solvent type when locking to same brand
  const findCompanionPaintOfBrand = (
    targetBrand: string,
    targetSolvent: "oil" | "water",
    excludeId?: string
  ): CatalogPaint | null => {
    const candidates = catalog.filter(
      (p) =>
        p.brand === targetBrand &&
        p.id !== excludeId &&
        getPaintSolventType(p) === targetSolvent
    );
    if (candidates.length === 0) {
      return catalog.find((p) => p.brand === targetBrand && p.id !== excludeId) || null;
    }
    return (
      candidates.find((p) => p.finish === "standard" && /^(001|005|C1|H1|X-2|1|JW001)/i.test(p.code)) ||
      candidates.find((p) => p.finish === "standard") ||
      candidates[0]
    );
  };

  // Filtered catalog for the slot picker popover
  const pickerResults = useMemo(() => {
    if (!activePickerSlot || catalog.length === 0) return [];
    const q = pickerQuery.trim().toLowerCase();
    const featuredSet = new Set<string>(FEATURED_BRANDS);
    const lockedToBrandA =
      !allowCrossBrand && activePickerSlot === "B" && paintA ? paintA.brand : null;
    const lockedSolventA =
      !allowCrossBrand && activePickerSlot === "B" && paintA
        ? getPaintSolventType(paintA)
        : null;

    return catalog
      .filter((p) => {
        if (lockedToBrandA) {
          if (p.brand !== lockedToBrandA) return false;
          if (lockedSolventA && getPaintSolventType(p) !== lockedSolventA) return false;
        } else if (pickerBrand === "COMMON") {
          if (!featuredSet.has(p.brand)) return false;
        } else if (pickerBrand !== "ALL") {
          if (p.brand !== pickerBrand) return false;
        }
        if (!q) return true;
        const brandZh = localizedBrand(p.brand, lang).toLowerCase();
        return (
          p.code.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          brandZh.includes(q) ||
          p.hex.toLowerCase().includes(q)
        );
      })
      .slice(0, 60);
  }, [activePickerSlot, catalog, pickerBrand, pickerQuery, lang, allowCrossBrand, paintA]);

  const pctA = 100 - ratioBPct;
  const pctB = ratioBPct;
  const dropsA = Math.max(1, Math.round(pctA / 10));
  const dropsB = Math.max(1, Math.round(pctB / 10));

  const isDifferentBrand = Boolean(paintA && paintB && paintA.brand !== paintB.brand);
  const solventA = paintA ? getPaintSolventType(paintA) : "oil";
  const solventB = paintB ? getPaintSolventType(paintB) : "oil";
  const isDifferentSolvent = Boolean(paintA && paintB && solventA !== solventB);

  const handleToggleCrossBrand = () => {
    const next = !allowCrossBrand;
    setAllowCrossBrand(next);
    if (!next && paintA && paintB) {
      // Locking back to same-brand mode: sync B to A's brand & solvent type if mismatched
      if (paintB.brand !== paintA.brand || getPaintSolventType(paintB) !== getPaintSolventType(paintA)) {
        const companion = findCompanionPaintOfBrand(
          paintA.brand,
          getPaintSolventType(paintA),
          paintA.id
        );
        if (companion) setPaintB(companion);
      }
      if (activePickerSlot === "B") {
        setPickerBrand(paintA.brand);
      }
    }
  };

  const handleSwap = () => {
    setPaintA(paintB);
    setPaintB(paintA);
    setRatioBPct(100 - ratioBPct);
  };

  const handleSelectPaintForSlot = (paint: CatalogPaint) => {
    if (activePickerSlot === "A") {
      setPaintA(paint);
      if (!allowCrossBrand) {
        const targetSolvent = getPaintSolventType(paint);
        if (
          !paintB ||
          paintB.brand !== paint.brand ||
          getPaintSolventType(paintB) !== targetSolvent
        ) {
          const companion = findCompanionPaintOfBrand(paint.brand, targetSolvent, paint.id);
          if (companion) setPaintB(companion);
        }
      }
    } else if (activePickerSlot === "B") {
      if (!allowCrossBrand && paintA && paint.brand !== paintA.brand) {
        // If user clicked a quick-pick chip from another brand while locked, auto-sync A to match or keep same brand
        setPaintB(paint);
        const companionA = findCompanionPaintOfBrand(
          paint.brand,
          getPaintSolventType(paint),
          paint.id
        );
        if (companionA) setPaintA(companionA);
      } else {
        setPaintB(paint);
      }
    }
    setActivePickerSlot(null);
  };

  return (
    <div className="bp-subcard-lg rounded-2xl border border-slate-200/85 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 p-3 sm:p-3.5 shadow-xs space-y-3">
      {/* Header + Same-Brand / Cross-Brand Mode Switch */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <FlaskIcon className="h-4 w-4 text-accent shrink-0" weight="fill" />
          <span className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">
            <span className="tech-prefix">[MIXBOX_LAB]</span>
            品牌漆 Mixbox 混色试验台
          </span>
        </div>

        {/* Toggle Button: Default Same-Brand Only vs Manual Cross-Brand with Warning */}
        <button
          type="button"
          onClick={handleToggleCrossBrand}
          className={`bp-pill inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-extrabold transition cursor-pointer shrink-0 ${
            allowCrossBrand
              ? "bp-pill-active border-amber-500 bg-amber-500/15 text-amber-800 dark:text-amber-200"
              : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:border-amber-400"
          }`}
          title={
            allowCrossBrand
              ? "当前已手动开启跨品牌混合，点击恢复默认仅限同品牌混合"
              : "默认锁定同一品牌油漆混合以保证相容性，点击可手动开启跨品牌混色"
          }
        >
          {allowCrossBrand ? (
            <>
              <LockKeyOpenIcon className="h-3 w-3 text-amber-600 dark:text-amber-300 shrink-0" weight="bold" />
              <span>已开启跨品牌混合 (点击锁定同品牌)</span>
            </>
          ) : (
            <>
              <LockKeyIcon className="h-3 w-3 text-emerald-600 dark:text-emerald-300 shrink-0" weight="bold" />
              <span>默认仅同品牌混合 (点击允许跨品牌)</span>
            </>
          )}
        </button>
      </div>

      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
        {allowCrossBrand
          ? "已手动开启跨品牌混色模式：可自由选择不同品牌油漆预览 Mixbox 混色与同色快匹。"
          : `当前默认锁定同一品牌（${paintA ? localizedBrand(paintA.brand, lang) : "同品牌"}）内部混色，确保溶剂与树脂体系一致；如需不同品牌混色可点击右上角手动开启。`}
      </p>

      {/* Warning Banner when Cross-Brand Mixing is Enabled or Different Brands are Selected */}
      {(allowCrossBrand || isDifferentBrand) && (
        <div className="rounded-xl border border-amber-400/80 dark:border-amber-500/60 bg-amber-50/90 dark:bg-amber-950/45 px-2.5 py-2 text-[11px] text-amber-900 dark:text-amber-200 space-y-1 animate-in fade-in duration-150">
          <div className="flex items-start gap-1.5 font-extrabold leading-snug">
            <WarningIcon className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" weight="fill" />
            <span>
              跨品牌混色提示：不同品牌油漆的树脂体系、溶剂挥发速率与色浆浓度不同，直接混合效果可能不好（易出现发灰、光泽不均、分层沉淀或实喷色差偏大），实喷前请务必先做小样测试。
            </span>
          </div>
          {isDifferentSolvent && (
            <div className="rounded-lg bg-rose-600/15 dark:bg-rose-950/80 border border-rose-500/50 px-2 py-1 text-[10px] font-black text-rose-700 dark:text-rose-300">
              🚫 水油不相溶警告：当前 A 槽为「{solventA === "oil" ? "🧪油性漆" : "💧水性漆"}」、B 槽为「{solventB === "oil" ? "🧪油性漆" : "💧水性漆"}」，油性与水性直接混合会发生絮凝结块导致油漆报废，严禁直接混调！
            </div>
          )}
        </div>
      )}

      {/* Two Paint Slots: Paint A + Swap + Paint B */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 sm:gap-2">
        {/* Slot A */}
        <button
          type="button"
          onClick={() => {
            const nextSlot = activePickerSlot === "A" ? null : "A";
            setActivePickerSlot(nextSlot);
            if (nextSlot === "A" && paintA) {
              setPickerBrand(paintA.brand);
            }
            setPickerQuery("");
          }}
          className={`bp-subcard group flex items-center gap-2 rounded-xl border p-2 text-left transition cursor-pointer min-w-0 ${
            activePickerSlot === "A"
              ? "border-accent ring-2 ring-accent/30 bg-accent/5 dark:bg-accent/15"
              : "border-slate-200 dark:border-slate-700/80 bg-slate-50/90 dark:bg-slate-800/80 hover:border-accent/60"
          }`}
        >
          <div
            className="bp-swatch relative h-10 w-10 rounded-lg border border-black/15 shrink-0 overflow-hidden flex items-center justify-center"
            style={{ backgroundColor: paintA?.hex || "#3B82F6" }}
          >
            {paintA && (
              <PaintBottleImg
                brand={paintA.brand}
                code={paintA.code}
                hex={paintA.hex}
                className="h-full w-full object-contain p-0.5 bg-white/85"
              />
            )}
            <span className="absolute left-0.5 top-0.5 rounded bg-slate-900/85 px-1 text-[8px] font-mono font-black text-white">
              A·{pctA}%
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <span className="truncate text-[10px] font-extrabold text-accent">
                {paintA ? `${localizedBrand(paintA.brand, lang)} ${paintA.code}` : "选择油漆 A"}
              </span>
              <CaretDownIcon className="h-3 w-3 text-slate-400 shrink-0" />
            </div>
            <div className="truncate text-xs font-black text-slate-800 dark:text-slate-100">
              {paintA?.name || "点击选漆"}
            </div>
            <div className="font-mono text-[9px] text-slate-400">
              {paintA?.hex || "#----"} · {solventA === "oil" ? "🧪油性" : "💧水性"}
            </div>
          </div>
        </button>

        {/* Swap Button */}
        <button
          type="button"
          onClick={handleSwap}
          title="互换 A / B 油漆"
          className="bp-btn flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-accent hover:text-accent transition cursor-pointer shrink-0"
        >
          <ArrowsLeftRightIcon className="h-3.5 w-3.5" weight="bold" />
        </button>

        {/* Slot B */}
        <button
          type="button"
          onClick={() => {
            const nextSlot = activePickerSlot === "B" ? null : "B";
            setActivePickerSlot(nextSlot);
            if (nextSlot === "B" && paintA && !allowCrossBrand) {
              setPickerBrand(paintA.brand);
            } else if (nextSlot === "B" && paintB) {
              setPickerBrand(paintB.brand);
            }
            setPickerQuery("");
          }}
          className={`bp-subcard group flex items-center gap-2 rounded-xl border p-2 text-left transition cursor-pointer min-w-0 ${
            activePickerSlot === "B"
              ? "border-accent ring-2 ring-accent/30 bg-accent/5 dark:bg-accent/15"
              : "border-slate-200 dark:border-slate-700/80 bg-slate-50/90 dark:bg-slate-800/80 hover:border-accent/60"
          }`}
        >
          <div
            className="bp-swatch relative h-10 w-10 rounded-lg border border-black/15 shrink-0 overflow-hidden flex items-center justify-center"
            style={{ backgroundColor: paintB?.hex || "#EAB308" }}
          >
            {paintB && (
              <PaintBottleImg
                brand={paintB.brand}
                code={paintB.code}
                hex={paintB.hex}
                className="h-full w-full object-contain p-0.5 bg-white/85"
              />
            )}
            <span className="absolute left-0.5 top-0.5 rounded bg-slate-900/85 px-1 text-[8px] font-mono font-black text-white">
              B·{pctB}%
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <span className="truncate text-[10px] font-extrabold text-accent">
                {paintB ? `${localizedBrand(paintB.brand, lang)} ${paintB.code}` : "选择油漆 B"}
              </span>
              <CaretDownIcon className="h-3 w-3 text-slate-400 shrink-0" />
            </div>
            <div className="truncate text-xs font-black text-slate-800 dark:text-slate-100">
              {paintB?.name || "点击选漆"}
            </div>
            <div className="font-mono text-[9px] text-slate-400">
              {paintB?.hex || "#----"} · {solventB === "oil" ? "🧪油性" : "💧水性"}
            </div>
          </div>
        </button>
      </div>

      {/* Inline Searchable Brand Paint Selector Drawer (when Slot A or Slot B is active) */}
      {activePickerSlot && (
        <div className="rounded-xl border border-accent/40 bg-slate-50/95 dark:bg-slate-950/90 p-2.5 space-y-2 animate-in fade-in duration-150">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-black text-slate-800 dark:text-slate-100">
              正在选择「油漆 {activePickerSlot}」
              {!allowCrossBrand && activePickerSlot === "B" && paintA && (
                <span className="ml-1.5 text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400">
                  (🔒 已锁定同品牌：{localizedBrand(paintA.brand, lang)} · {solventA === "oil" ? "油性漆" : "水性漆"})
                </span>
              )}
              {!allowCrossBrand && activePickerSlot === "A" && (
                <span className="ml-1.5 text-[10px] font-bold text-slate-400">
                  (切换 A 槽品牌将同步 B 槽为同品牌)
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={() => setActivePickerSlot(null)}
              className="text-[11px] font-bold text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
            >
              收起 ✕
            </button>
          </div>

          {/* Quick Pick from Sandbox Colors if available */}
          {sandboxColors.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-slate-400">
                📌 从当前试色台已指派/备选色快速载入：
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                {sandboxColors.map((sc) => {
                  const ap = sc.assignedPaint;
                  const closest = ap || (engine ? engine.findClosest(sc.hex, 1)[0]?.paint : null);
                  if (!closest) return null;
                  return (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => handleSelectPaintForSlot(closest)}
                      className="bp-pill shrink-0 flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-[10px] font-bold text-slate-700 dark:text-slate-200 hover:border-accent cursor-pointer"
                    >
                      <span
                        className="h-3 w-3 rounded-full border border-black/20 shrink-0"
                        style={{ backgroundColor: closest.hex }}
                      />
                      <span>
                        {localizedBrand(closest.brand, lang)} {closest.code} {closest.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Brand Pills (Locked to paintA.brand when selecting Slot B in default same-brand mode) */}
          {!allowCrossBrand && activePickerSlot === "B" && paintA ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[10px]">
              <span className="font-extrabold text-emerald-800 dark:text-emerald-200">
                🔒 默认仅允许同一品牌「{localizedBrand(paintA.brand, lang)}」内部混色
              </span>
              <button
                type="button"
                onClick={() => setAllowCrossBrand(true)}
                className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black text-white hover:bg-amber-600 transition cursor-pointer"
              >
                🔓 手动开启跨品牌混合
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
              {[
                { id: "COMMON", label: "🌟 常用品牌" },
                { id: "Gaia", label: "盖亚" },
                { id: "Jumpwind", label: "匠域" },
                { id: "Hobby Mio", label: "喵匠" },
                { id: "Night Works", label: "夜之工坊" },
                { id: "Gunze", label: "郡士水性" },
                { id: "Mr.Hobby", label: "郡士" },
                { id: "Tamiya", label: "田宫" },
                { id: "Vallejo", label: "AV水性" },
                { id: "ALL", label: "全部" },
              ].map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setPickerBrand(b.id)}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold whitespace-nowrap shrink-0 cursor-pointer transition ${
                    pickerBrand === b.id
                      ? "bg-accent text-white"
                      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          )}

          {/* Search Input */}
          <div className="relative">
            <MagnifyingGlassIcon className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={pickerQuery}
              onChange={(e) => setPickerQuery(e.target.value)}
              placeholder="搜索色号或名称 (如 004 / 钴蓝 / EX01 / GP-01)…"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-8 pr-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-accent"
            />
          </div>

          {/* Compact Grid of Catalog Paints */}
          <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto pr-0.5">
            {pickerResults.map((p) => {
              const st = getPaintSolventType(p);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPaintForSlot(p)}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 text-left hover:border-accent transition cursor-pointer min-w-0"
                >
                  <span
                    className="h-5 w-5 rounded border border-black/15 shrink-0"
                    style={{ backgroundColor: p.hex }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="truncate text-[10px] font-extrabold text-slate-800 dark:text-slate-100">
                        {localizedBrand(p.brand, lang)} {p.code}
                      </span>
                      <span className="shrink-0 text-[8px] font-bold text-slate-400">
                        {st === "oil" ? "油" : "水"}
                      </span>
                    </div>
                    <div className="truncate text-[9px] text-slate-500 dark:text-slate-400">
                      {p.name}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Mixbox Ratio Slider + Quick Ratio Presets */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px] font-extrabold text-slate-600 dark:text-slate-300">
          <span>
            A 占 {pctA}% ({dropsA}滴)
          </span>
          <span className="font-mono text-accent">Mixbox 混合比</span>
          <span>
            B 占 {pctB}% ({dropsB}滴)
          </span>
        </div>

        {/* Live Mixbox Gradient Slider */}
        <div className="relative flex items-center h-5 w-full select-none">
          <div
            className="w-full h-3 rounded-full border border-black/20 dark:border-white/20 shadow-inner"
            style={{ background: mixGradientCss }}
          />
          <div
            className="pointer-events-none absolute top-1/2 w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white ring-1 ring-black/40 shadow-md"
            style={{
              left: `${ratioBPct}%`,
              backgroundColor: mixedHex,
            }}
          />
          <input
            type="range"
            min={10}
            max={90}
            step={5}
            value={ratioBPct}
            onChange={(e) => setRatioBPct(Number(e.target.value))}
            aria-label="双漆混合比例"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer m-0"
          />
        </div>

        {/* Quick Ratio Pills */}
        <div className="flex items-center justify-between gap-1">
          {RATIO_PRESETS.map((preset) => {
            const pval = Math.round(preset.ratioB * 100);
            const active = Math.abs(ratioBPct - pval) <= 2;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => setRatioBPct(pval)}
                className={`flex-1 py-1 rounded-lg font-mono text-[10px] font-extrabold transition cursor-pointer ${
                  active
                    ? "bg-accent text-white shadow-2xs"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mixed Result Banner + 1-Click Send to Right BrandMatcher */}
      <div className="rounded-xl border border-slate-200/90 dark:border-slate-700/80 bg-slate-50/90 dark:bg-slate-800/60 p-2.5 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* Visual A + B -> Mix Swatch Strip */}
            <div className="flex items-center h-9 rounded-lg overflow-hidden border border-black/15 dark:border-white/15 shrink-0 shadow-2xs">
              <span
                className="w-4 h-full"
                style={{ backgroundColor: paintA?.hex || "#3B82F6" }}
                title={`A: ${paintA?.name || ""}`}
              />
              <span
                className="w-10 h-full flex items-center justify-center font-mono text-[9px] font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]"
                style={{ backgroundColor: mixedHex }}
              >
                混
              </span>
              <span
                className="w-4 h-full"
                style={{ backgroundColor: paintB?.hex || "#EAB308" }}
                title={`B: ${paintB?.name || ""}`}
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-slate-900 dark:text-white">
                  混合结果
                </span>
                <span className="font-mono text-[11px] font-bold text-accent">
                  {mixedHex}
                </span>
              </div>
              <div className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                {paintA ? `${localizedBrand(paintA.brand, lang)}${paintA.code}` : "A"} ({dropsA}滴) +{" "}
                {paintB ? `${localizedBrand(paintB.brand, lang)}${paintB.code}` : "B"} ({dropsB}滴)
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSendHexToBrandMatcher(mixedHex)}
            className="bp-pill-active gk-btn-primary shrink-0 flex items-center gap-1 rounded-xl bg-accent hover:bg-accent-hover px-2.5 py-1.5 text-[10px] font-extrabold text-white shadow-2xs transition cursor-pointer"
            title="将此混合结果颜色设为右侧匹配面板的目标色，查看全品牌同色油漆与微调方案"
          >
            <span>右侧完整匹配</span>
            <ArrowRightIcon className="h-3 w-3" weight="bold" />
          </button>
        </div>

        {/* Fast Same-Color Paint Matches (同色现成油漆快速匹配) */}
        {topSameColorPaints.length > 0 && (
          <div className="space-y-1.5 pt-1.5 border-t border-slate-200/70 dark:border-slate-700/70">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 flex items-center gap-1">
                <SparkleIcon className="h-3 w-3 text-amber-500" weight="fill" />
                <span>免调替用 · 同色现成单瓶漆快匹：</span>
              </span>
              <span className="text-[9px] text-slate-400">
                {selectedSandboxColor ? "点按「指派」绑定当前色卡" : "点按可在右侧查看"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {topSameColorPaints.map((m) => {
                const p = m.paint;
                const qText = matchQualityLabel(m.deltaE, lang);
                const isAssigned = selectedSandboxColor?.assignedPaint?.id === p.id;
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-1.5 rounded-lg border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-1.5 min-w-0"
                  >
                    <button
                      type="button"
                      onClick={() => onSendHexToBrandMatcher(p.hex)}
                      className="flex items-center gap-1.5 min-w-0 flex-1 text-left cursor-pointer"
                      title="点击在右侧查看该油漆详情"
                    >
                      <span
                        className="h-6 w-6 rounded-md border border-black/15 shrink-0 overflow-hidden flex items-center justify-center"
                        style={{ backgroundColor: p.hex }}
                      >
                        <PaintBottleImg
                          brand={p.brand}
                          code={p.code}
                          hex={p.hex}
                          className="h-full w-full object-contain p-0.5 bg-white/85"
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[10px] font-black text-slate-800 dark:text-slate-100">
                          {localizedBrand(p.brand, lang)} {p.code}
                        </div>
                        <div className="truncate text-[9px] text-slate-500 dark:text-slate-400">
                          {p.name} · <span className="font-mono">ΔE {m.deltaE.toFixed(1)}</span> ({qText})
                        </div>
                      </div>
                    </button>

                    {onAssignCatalogPaint && (
                      <button
                        type="button"
                        onClick={() => onAssignCatalogPaint(p)}
                        className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-extrabold transition cursor-pointer flex items-center gap-0.5 ${
                          isAssigned
                            ? "bg-emerald-600 text-white"
                            : "bg-accent/12 text-accent hover:bg-accent hover:text-white"
                        }`}
                      >
                        {isAssigned ? (
                          <>
                            <CheckIcon className="h-2.5 w-2.5" weight="bold" />
                            <span>已指派</span>
                          </>
                        ) : (
                          <span>指派</span>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DualBrandPaintMixerCard;
