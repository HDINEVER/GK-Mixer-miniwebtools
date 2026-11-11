import React, { useMemo, useRef, useState } from "react";
import type { ChecklistGroupBy, ChecklistRunner, PartsChecklist } from "../../types";
import {
  ChecklistStats,
  compressNumbers,
  formatSegment,
  getRunnerColorBands,
  getRunnerPartColorHex,
  GRADE_META,
  groupRegionParts,
  PartRef,
  PartSegment,
  pivotByRunner,
  readableTextColor,
  regionCutCount,
  regionPartCount,
  RunnerGroup,
  RunnerPickCard,
  segmentBadgeLabel,
} from "../../utils/partsChecklist";
import { RegionIcon } from "./RegionIcon";

// ------------------------------------------------------------------
// 板件胶囊：[A | 5 | 9 | 22-24*2]
// ------------------------------------------------------------------

export interface SegmentHandlers {
  onClick?: (seg: PartSegment, e: React.MouseEvent<HTMLButtonElement>) => void;
  onDoubleClick?: (seg: PartSegment, e: React.MouseEvent<HTMLButtonElement>) => void;
  onContextMenu?: (seg: PartSegment, e: React.MouseEvent<HTMLButtonElement>) => void;
  onPointerDown?: (seg: PartSegment, e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerMove?: (seg: PartSegment, e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerUp?: (seg: PartSegment, e: React.PointerEvent<HTMLButtonElement>) => void;
}

interface RunnerGroupCapsuleProps extends SegmentHandlers {
  group: RunnerGroup;
  runner?: ChecklistRunner;
  size?: "sm" | "md";
  showCut?: boolean;
  interactive?: boolean;
  activeSegmentKey?: string | null;
  /** 按板件视图：隐藏板件字母头，只渲染号码方块 */
  hideHead?: boolean;
  /** 筛选其他板件时弱化当前胶囊 */
  dimmed?: boolean;
  /** 高亮当前板件胶囊 */
  highlighted?: boolean;
  /** 高亮命中的具体号码段 */
  highlightSegmentFn?: (seg: PartSegment) => boolean;
}

const CUT_SLASH =
  "linear-gradient(to top right, transparent calc(50% - 1px), currentColor calc(50% - 0.5px), currentColor calc(50% + 0.5px), transparent calc(50% + 1px))";

export const RunnerGroupCapsule: React.FC<RunnerGroupCapsuleProps> = ({
  group,
  runner,
  size = "md",
  showCut = false,
  interactive = false,
  activeSegmentKey,
  hideHead = false,
  dimmed = false,
  highlighted = false,
  highlightSegmentFn,
  onClick,
  onDoubleClick,
  onContextMenu,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}) => {
  const base = runner?.colorHex ?? "#C9CED6";
  const fg = readableTextColor(base);
  const isDarkRunner = fg === "#FFFFFF";
  const colorBands = getRunnerColorBands(runner);
  // Inverted high-contrast keycap for runner prefix (A/B/C...) paired with a left paint ribbon,
  // guaranteeing instant separation between the runner letter and numeric part tiles across all colors.
  const headBg = isDarkRunner ? "#F8FAFC" : "#1E293B";
  const headFg = isDarkRunner ? "#0F172A" : "#F8FAFC";
  const h = size === "sm" ? "h-6" : "h-7 sm:h-8";
  const text = size === "sm" ? "text-[11px]" : "text-xs sm:text-[13px]";

  return (
    <span
      className={`bp-capsule-shell inline-flex max-w-full flex-wrap items-stretch align-top transition-opacity ${
        dimmed ? "opacity-25 hover:opacity-90" : ""
      } ${highlighted ? "ring-2 ring-amber-400/90" : ""}`}
      data-runner-group={group.runnerId}
    >
      {!hideHead && (
      <span
        className={`bp-capsule-head ${h} ${text} inline-flex min-w-[28px] items-center justify-center overflow-hidden pr-1.5 font-mono font-black tracking-tight leading-none select-none`}
        style={{ backgroundColor: headBg, color: headFg }}
        title={
          colorBands.length > 1
            ? `${group.runnerId} 多色板 (${colorBands.length} 色)`
            : runner?.paintName
            ? `${group.runnerId} 板 · ${runner.paintCode ?? ""} ${runner.paintName}`
            : `${group.runnerId} 板`
        }
      >
        <span
          aria-hidden
          className="bp-capsule-ribbon mr-1.5 flex h-full w-1 shrink-0 flex-col overflow-hidden"
          style={colorBands.length <= 1 ? { backgroundColor: base } : undefined}
        >
          {colorBands.length > 1 &&
            colorBands.slice(0, 4).map((band) => (
              <span key={band.key} className="w-full flex-1" style={{ backgroundColor: band.colorHex }} />
            ))}
        </span>
        <span>{group.runnerId}</span>
      </span>
      )}
      {group.segments.map((seg) => {
        const segBg = seg.colorHex ?? base;
        const segFg = readableTextColor(segBg);
        const segPaintTitle = [seg.paintCode, seg.paintName].filter(Boolean).join(" ");
        const cut = showCut && seg.isCut;
        const isActive = activeSegmentKey === seg.key;
        const isSearchHit = highlightSegmentFn ? highlightSegmentFn(seg) : false;
        const badgeLabel = segmentBadgeLabel(seg);
        const content = (
          <>
            <span className="relative">{formatSegment(seg)}</span>
            {badgeLabel && (
              <sup className="relative -top-[0.45em] ml-[1px] text-[0.68em] font-black opacity-85">{badgeLabel}</sup>
            )}
            {cut && (
              <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: CUT_SLASH }} />
            )}
          </>
        );
        const cls = `bp-capsule-tile ${h} ${text} relative inline-flex min-w-[28px] items-center justify-center px-1.5 font-mono font-bold leading-none tabular-nums transition ${
          cut ? "opacity-35" : ""
        } ${isActive ? "bp-capsule-tile-active z-10" : ""} ${
          isSearchHit ? "ring-2 ring-amber-300 z-10" : ""
        }`;
        if (!interactive) {
          return (
            <span
              key={seg.key}
              className={cls}
              style={{ backgroundColor: segBg, color: segFg }}
              title={segPaintTitle || undefined}
            >
              {content}
            </span>
          );
        }
        return (
          <button
            key={seg.key}
            type="button"
            data-active-segment={isActive ? "true" : undefined}
            className={`${cls} cursor-pointer select-none`}
            style={{ backgroundColor: segBg, color: segFg, WebkitTouchCallout: "none" }}
            title={segPaintTitle || undefined}
            onClick={(e) => {
              e.stopPropagation();
              onClick?.(seg, e);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onDoubleClick?.(seg, e);
            }}
            onContextMenu={(e) => {
              if (!onContextMenu) return;
              e.preventDefault();
              e.stopPropagation();
              onContextMenu(seg, e);
            }}
            onPointerDown={(e) => onPointerDown?.(seg, e)}
            onPointerMove={(e) => onPointerMove?.(seg, e)}
            onPointerUp={(e) => onPointerUp?.(seg, e)}
            onPointerCancel={(e) => onPointerUp?.(seg, e)}
          >
            {content}
          </button>
        );
      })}
    </span>
  );
};

// ------------------------------------------------------------------
// 暗黑海报（剪件打勾模式 + 导出预览共用）
// ------------------------------------------------------------------

const segmentMatchesQuery = (runnerId: string, seg: PartSegment, q: string): boolean => {
  if (!q) return false;
  const rUpper = runnerId.toUpperCase();
  const segText = formatSegment(seg).toUpperCase();
  if (`${rUpper}${segText}` === q || `${rUpper}-${segText}` === q || `${rUpper} ${segText}` === q) {
    return true;
  }
  const numMatch = q.match(/^([A-Z0-9]+?)[\s\-_]*(\d+)$/);
  if (numMatch) {
    const [, qRunner, qNumStr] = numMatch;
    const qNum = Number(qNumStr);
    if (rUpper === qRunner && qNum >= seg.start && qNum <= seg.end) return true;
  }
  const pureNum = Number(q);
  if (Number.isFinite(pureNum) && String(pureNum) === q && pureNum >= seg.start && pureNum <= seg.end) {
    return true;
  }
  return rUpper === q || segText.includes(q);
};

interface ChecklistPosterProps {
  checklist: PartsChecklist;
  stats: ChecklistStats;
  title: string;
  subtitle?: string;
  coverSrc?: string;
  /** 剪件打勾模式：号码可点击划掉并显示进度 */
  checkMode?: boolean;
  /** 是否允许直接点击零件胶囊切换打勾（海报导出页也可开启直接点击） */
  interactive?: boolean;
  onToggleCut?: (regionId: string, partIds: string[], nextCut: boolean) => void;
  /** 列表分组：按部位（默认） / 按板件 */
  groupBy?: ChecklistGroupBy;
  /** 按板件视图：号码图点击同号跨部位批量剪下 */
  onSetPartsCut?: (refs: PartRef[], nextCut: boolean) => void;
  /** 按板件视图：整板一键剪完 / 撤销 */
  onSetRunnerCut?: (runnerId: string, nextCut: boolean) => void;
  /** 按部位视图：整部位一键剪完 / 撤销 */
  onSetRegionCut?: (regionId: string, nextCut: boolean) => void;
  /** 网页端紧凑顶栏模式：收起巨幅封面与统计卡，首屏直接展示全部可点零件按钮 */
  compactHeader?: boolean;
  onToggleCompactHeader?: () => void;
  /** 网页端双栏一屏模式：部位或板件以双栏网格高密度排布，一屏看全整页按钮 */
  twoColumnBody?: boolean;
  onToggleTwoColumnBody?: () => void;
  /** 仅显示尚未剪完的部位/板件 */
  onlyUncut?: boolean;
  /** 右侧雷达或图例选中的高亮板件 ID（高亮该板零件并弱化其余板件） */
  highlightRunnerId?: string | null;
  onSelectHighlightRunner?: (runnerId: string | null) => void;
  /** 快速寻件搜索词（匹配板件号、零件号、部位名） */
  searchQuery?: string;
}

export const ChecklistPoster: React.FC<ChecklistPosterProps> = ({
  checklist,
  stats,
  title,
  subtitle,
  coverSrc,
  checkMode = false,
  interactive,
  onToggleCut,
  groupBy = "region",
  onSetPartsCut,
  onSetRunnerCut,
  onSetRegionCut,
  compactHeader = false,
  onToggleCompactHeader,
  twoColumnBody = false,
  onToggleTwoColumnBody,
  onlyUncut = false,
  highlightRunnerId = null,
  onSelectHighlightRunner,
  searchQuery = "",
}) => {
  const canClickParts = interactive ?? checkMode;
  const showCutState = checkMode || stats.cutCount > 0;
  const [showCompactLegend, setShowCompactLegend] = useState(false);
  const runnerMap = useMemo(() => new Map(checklist.runners.map((r) => [r.id, r])), [checklist.runners]);
  const totalMax = checklist.runners.reduce((s, r) => s + r.maxNumber, 0) || 1;
  const filled = checklist.regions.filter((r) => r.parts.length > 0);
  const grade = stats.grade ? GRADE_META[stats.grade] : null;
  const overallPct = stats.partsCount ? Math.round((stats.cutCount / stats.partsCount) * 100) : 0;
  const normalizedQuery = searchQuery.trim().toUpperCase();

  const visibleRegions = useMemo(() => {
    return filled.filter((region) => {
      if (onlyUncut && showCutState) {
        const total = regionPartCount(region);
        const cut = regionCutCount(region);
        if (total > 0 && cut >= total) return false;
      }
      if (!normalizedQuery) return true;
      if (region.title.toUpperCase().includes(normalizedQuery)) return true;
      const groups = groupRegionParts(region.parts, checklist.runners, checklist.mergeConsecutive);
      return groups.some(
        (g) =>
          g.runnerId.toUpperCase().includes(normalizedQuery) ||
          g.segments.some((seg) => segmentMatchesQuery(g.runnerId, seg, normalizedQuery))
      );
    });
  }, [filled, onlyUncut, showCutState, normalizedQuery, checklist.runners, checklist.mergeConsecutive]);

  const hiddenCompletedRegionsCount = filled.length - visibleRegions.length;

  const runnerLegendNode = checklist.runners.length > 0 && (
    <>
      <div className="mt-3.5 flex items-center justify-between font-mono text-[10px] font-black">
        <span className="text-[#A3A9B3]">RUNNER LAYOUT</span>
        <span className="font-sans font-semibold text-[#6B717C]">板件零件量分布（点击下方色块可筛选板件）</span>
      </div>
      <div className="bp-poster-bar mt-1.5 flex h-5 overflow-hidden rounded-md">
        {checklist.runners.map((r) => (
          <div
            key={r.id}
            className="grid min-w-0 place-items-center overflow-hidden border-r-2 border-black font-mono text-[9px] font-black last:border-r-0"
            style={{
              width: `${(r.maxNumber / totalMax) * 100}%`,
              backgroundColor: r.colorHex,
              color: readableTextColor(r.colorHex),
            }}
            title={`${r.id} 板 · ${r.maxNumber} 件`}
          >
            <span className="truncate px-0.5">
              {r.id}
              <span className="hidden sm:inline"> {r.maxNumber}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="font-mono text-[10px] font-black text-[#A3A9B3]">RUNNERS</span>
        {highlightRunnerId && onSelectHighlightRunner && (
          <button
            type="button"
            onClick={() => onSelectHighlightRunner(null)}
            className="bp-pill rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-black text-amber-300 hover:bg-amber-400/30 cursor-pointer"
          >
            正在高亮 {highlightRunnerId} 板 · 点击取消
          </button>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {checklist.runners.map((r) => {
          const isSelected = highlightRunnerId === r.id;
          const isDimmed = Boolean(highlightRunnerId && !isSelected);
          const Tag = onSelectHighlightRunner ? "button" : "span";
          return (
            <Tag
              key={r.id}
              {...(onSelectHighlightRunner
                ? {
                    type: "button" as const,
                    onClick: () => onSelectHighlightRunner(isSelected ? null : r.id),
                    title: isSelected ? `取消筛选 ${r.id} 板` : `只看 / 高亮 ${r.id} 板零件`,
                  }
                : {})}
              className={`bp-capsule-shell inline-flex items-stretch transition ${
                onSelectHighlightRunner ? "cursor-pointer" : ""
              } ${isSelected ? "ring-2 ring-amber-400" : ""} ${isDimmed ? "opacity-40 hover:opacity-90" : ""}`}
            >
              <span
                className="bp-capsule-tile grid h-6 min-w-[26px] place-items-center px-1.5 text-[11px] font-black font-mono"
                style={{ backgroundColor: r.colorHex, color: readableTextColor(r.colorHex) }}
              >
                {r.id}
              </span>
              {(r.paintCode || r.paintName) && (
                <span className="bp-capsule-sub grid max-w-[130px] place-items-center truncate bg-[#14161D] px-1.5 text-[10px] font-semibold text-[#C3C8D0]">
                  <span className="truncate">
                    {r.paintCode} {r.paintName}
                  </span>
                </span>
              )}
            </Tag>
          );
        })}
      </div>
    </>
  );

  return (
    <div className="bp-checklist-poster overflow-clip rounded-3xl border border-black/40 bg-[#090A0F] text-white shadow-xl">
      {compactHeader ? (
        /* 紧凑一屏顶栏：省去 340px 封面遮挡，首屏直接展示整页可点击零件按钮 */
        <div className="border-b border-[#1C1F28] bg-gradient-to-r from-[#11141E] via-[#0D0F17] to-[#11141E] px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {coverSrc && (
                <img
                  src={coverSrc}
                  alt=""
                  className="bp-poster-icon h-12 w-12 shrink-0 rounded-xl border border-white/15 object-cover"
                  draggable={false}
                />
              )}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bp-poster-tag rounded-[4px] bg-[#E5322D] px-1.5 py-0.5 text-[10px] font-black leading-none">
                    取件表
                  </span>
                  <h3 className="truncate text-base font-black leading-tight sm:text-xl">{title}</h3>
                  {subtitle && (
                    <span className="truncate text-xs font-bold text-[#A3A9B3]">· {subtitle}</span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[11px] font-bold tabular-nums text-[#8E95A2]">
                  <span>
                    PARTS <strong className="text-white">{stats.partsCount}</strong>
                  </span>
                  <span className="text-[#2D323E]">·</span>
                  <span>
                    RUNNERS <strong className="text-white">{stats.runnersCount}</strong>
                  </span>
                  <span className="text-[#2D323E]">·</span>
                  <span>
                    REGIONS <strong className="text-white">{stats.regionsCount}</strong>
                  </span>
                  {stats.grade && (
                    <>
                      <span className="text-[#2D323E]">·</span>
                      <span
                        className="font-black"
                        style={{ color: grade?.color ?? "#A3A9B3" }}
                        title="根据平均每个部位需要横跨多少块板件寻件计算"
                      >
                        [{stats.grade}] {stats.cleanScore} {grade?.label}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {showCutState && (
                <div className="bp-poster-stat flex items-center gap-2 rounded-lg border border-[#22252E] bg-[#141722] px-2.5 py-1">
                  <span className="text-[10px] font-bold text-[#A3A9B3]">已剪</span>
                  <span className="font-mono text-xs font-black tabular-nums text-emerald-300">
                    {stats.cutCount}/{stats.partsCount} ({overallPct}%)
                  </span>
                  <div className="bp-poster-progress hidden h-1.5 w-14 overflow-hidden rounded-full bg-[#1C1F28] sm:block">
                    <div
                      className="bp-poster-progress-bar h-full rounded-full bg-emerald-400 transition-[width] duration-300"
                      style={{ width: `${overallPct}%` }}
                    />
                  </div>
                </div>
              )}

              {checklist.runners.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowCompactLegend((v) => !v)}
                  className={`bp-pill rounded-lg border px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
                    showCompactLegend || highlightRunnerId
                      ? "border-amber-400/50 bg-amber-400/15 text-amber-200"
                      : "border-[#252934] bg-[#141722] text-[#A3A9B3] hover:text-white"
                  }`}
                >
                  {highlightRunnerId
                    ? `筛选: ${highlightRunnerId} 板`
                    : showCompactLegend
                    ? "收起板件图例"
                    : `板件图例 (${checklist.runners.length})`}
                </button>
              )}

              {onToggleTwoColumnBody && (
                <button
                  type="button"
                  onClick={onToggleTwoColumnBody}
                  className="bp-pill rounded-lg border border-[#252934] bg-[#141722] px-2.5 py-1 text-[11px] font-bold text-[#C3C8D0] hover:border-white/30 hover:text-white transition cursor-pointer"
                  title="切换双栏一屏网格或单栏竖排长图"
                >
                  {twoColumnBody ? "视图: 双栏一屏" : "视图: 单栏长图"}
                </button>
              )}

              {onToggleCompactHeader && (
                <button
                  type="button"
                  onClick={onToggleCompactHeader}
                  className="bp-pill rounded-lg border border-[#252934] bg-[#141722] px-2.5 py-1 text-[11px] font-bold text-[#C3C8D0] hover:border-white/30 hover:text-white transition cursor-pointer"
                  title="展开完整实拍封面与四大统计卡"
                >
                  展开封面
                </button>
              )}
            </div>
          </div>

          {showCompactLegend && <div className="pt-1">{runnerLegendNode}</div>}
        </div>
      ) : (
        /* 完整长图顶栏：玩家实拍作品封面 + 四大统计 + 板件分布 */
        <>
          <div className={`relative ${coverSrc ? "h-[240px] sm:h-[320px]" : "h-20"}`}>
            {coverSrc ? (
              <img src={coverSrc} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[#151823] to-[#090A0F]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-[#090A0F]/50 via-transparent to-[#090A0F]" />
            <div className="absolute right-4 top-4 flex items-center gap-2">
              {onToggleTwoColumnBody && (
                <button
                  type="button"
                  onClick={onToggleTwoColumnBody}
                  className="bp-pill rounded-full border border-white/20 bg-black/55 px-2.5 py-1 text-[10px] font-bold text-white/90 backdrop-blur-md hover:bg-black/75 cursor-pointer"
                >
                  {twoColumnBody ? "双栏一屏" : "单栏长图"}
                </button>
              )}
              {onToggleCompactHeader && (
                <button
                  type="button"
                  onClick={onToggleCompactHeader}
                  className="bp-pill rounded-full border border-white/20 bg-black/55 px-2.5 py-1 text-[10px] font-bold text-white/90 backdrop-blur-md hover:bg-black/75 cursor-pointer"
                >
                  收起封面 · 一屏点按
                </button>
              )}
              <span className="font-mono text-[10px] font-black tracking-[0.2em] text-white/70">
                GK MIXER
              </span>
            </div>
          </div>

          <div className={`relative px-4 sm:px-6 ${coverSrc ? "-mt-24 sm:-mt-28" : "pt-2"}`}>
            <div className="flex items-center gap-2.5">
              <span className="bp-poster-tag rounded-[4px] bg-[#E5322D] px-2 py-1 text-xs font-black leading-none">
                取件表
              </span>
              <span className="font-mono text-[9px] font-bold leading-tight text-[#A3A9B3]">
                PARTS CHECKLIST
                <br />
                <span className="text-[#6B717C]">
                  {groupBy === "runner" ? "PICK BY RUNNER · 按板件取件" : "VERIFY BY REGION · 按部位取件"}
                </span>
              </span>
            </div>
            <h3 className="mt-2.5 text-2xl font-black leading-tight sm:text-4xl [text-wrap:balance]">{title}</h3>
            {subtitle && <p className="mt-1 text-sm font-bold text-[#A3A9B3]">{subtitle}</p>}
            <p className="mt-1.5 text-[11px] font-semibold text-[#6B717C] tabular-nums">
              零件数: {stats.partsCount} · 板件数: {stats.runnersCount} · 部位数: {stats.regionsCount}
            </p>

            {/* 四大统计 */}
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5">
              {[
                { label: "PARTS", value: String(stats.partsCount), sub: "零件总数" },
                { label: "RUNNERS", value: String(stats.runnersCount), sub: "板件数" },
                { label: "REGIONS", value: String(stats.regionsCount), sub: "部位数" },
              ].map((c) => (
                <div key={c.label} className="bp-poster-stat rounded-xl border border-[#22252E] bg-[#11131A] px-3 py-2.5">
                  <div className="font-mono text-[9px] font-black text-[#6B717C]">{c.label}</div>
                  <div className="font-mono text-2xl font-black tabular-nums sm:text-3xl">{c.value}</div>
                  <div className="text-[10px] font-semibold text-[#7C828C]">{c.sub}</div>
                </div>
              ))}
              <div
                className="bp-poster-stat rounded-xl border bg-[#11131A] px-3 py-2.5"
                style={{ borderColor: grade ? `${grade.color}66` : "#22252E" }}
                title="根据平均每个部位需要横跨多少块板件寻件计算：越集中分数越高"
              >
                <div className="font-mono text-[9px] font-black text-[#6B717C]">CLEAN SCORE</div>
                <div
                  className="font-mono text-2xl font-black tabular-nums sm:text-3xl"
                  style={{ color: grade?.color ?? "#6B717C" }}
                >
                  {stats.grade ? `[${stats.grade}] ${stats.cleanScore}` : "--"}
                </div>
                <div className="text-[10px] font-semibold text-[#7C828C]">
                  {grade ? `${grade.label} · 均跨 ${stats.avgSpread.toFixed(1)} 板` : "尚未分配零件"}
                </div>
              </div>
            </div>

            {showCutState && (
              <div className="bp-poster-stat mt-4 rounded-xl border border-[#22252E] bg-[#11131A] p-3">
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className="text-[#A3A9B3]">剪件进度</span>
                  <span className="font-mono tabular-nums text-white">
                    {stats.cutCount}/{stats.partsCount} · {overallPct}%
                  </span>
                </div>
                <div className="bp-poster-progress mt-2 h-1.5 overflow-hidden rounded-full bg-[#1C1F28]">
                  <div
                    className="bp-poster-progress-bar h-full rounded-full bg-emerald-400 transition-[width] duration-300"
                    style={{ width: `${overallPct}%` }}
                  />
                </div>
              </div>
            )}

            {runnerLegendNode}

            <div className="mt-5 h-px bg-[#1C1F28]" />
          </div>
        </>
      )}

      {/* 海报主体：部位列表 / 板件列表 */}
      <div className="px-4 pt-3.5 sm:px-5">
        {groupBy === "runner" && filled.length > 0 ? (
          <RunnerPickSections
            checklist={checklist}
            checkMode={canClickParts}
            showCutState={showCutState}
            twoColumnBody={twoColumnBody}
            onlyUncut={onlyUncut}
            highlightRunnerId={highlightRunnerId}
            onSelectHighlightRunner={onSelectHighlightRunner}
            searchQuery={normalizedQuery}
            onToggleCut={onToggleCut}
            onSetPartsCut={onSetPartsCut}
            onSetRunnerCut={onSetRunnerCut}
          />
        ) : filled.length === 0 ? (
          <p className="pb-8 pt-4 text-center text-xs font-semibold text-[#6B717C]">
            尚未为任何部位分配零件，切换到「制作编辑」开始分拣
          </p>
        ) : visibleRegions.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <p className="text-xs font-bold text-[#A3A9B3]">
              {normalizedQuery
                ? `未找到匹配「${searchQuery}」的部位或零件号`
                : "全部部位零件均已剪完 🎉"}
            </p>
          </div>
        ) : (
          <div
            className={
              twoColumnBody
                ? "grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3 pb-2 items-start"
                : "space-y-4 pb-2"
            }
          >
            {visibleRegions.map((region) => {
              const total = regionPartCount(region);
              const cut = regionCutCount(region);
              const pct = total ? Math.round((cut / total) * 100) : 0;
              const isDone = total > 0 && cut >= total;
              const groups = groupRegionParts(region.parts, checklist.runners, checklist.mergeConsecutive);
              const regionHasHighlightRunner =
                !highlightRunnerId || groups.some((g) => g.runnerId === highlightRunnerId);

              return (
                <section
                  key={region.id}
                  data-poster-region-id={region.id}
                  className={
                    twoColumnBody
                      ? `bp-poster-stat scroll-mt-20 rounded-xl border p-2.5 sm:p-3 transition-all ${
                          highlightRunnerId && regionHasHighlightRunner
                            ? "border-amber-400/45 bg-[#11141E]"
                            : "border-[#1A1D26] bg-[#0D0F16]"
                        } ${highlightRunnerId && !regionHasHighlightRunner ? "opacity-40" : ""}`
                      : `scroll-mt-20 border-b border-[#15171E] pb-4 last:border-b-0 transition-opacity ${
                          highlightRunnerId && !regionHasHighlightRunner ? "opacity-40" : ""
                        }`
                  }
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className={`bp-poster-icon grid shrink-0 place-items-center rounded-lg bg-[#151820] text-[#E8EAEE] ${
                        twoColumnBody ? "h-7 w-7" : "h-8 w-8"
                      }`}
                    >
                      <RegionIcon category={region.category} className={twoColumnBody ? "h-4 w-4" : "h-5 w-5"} />
                    </span>
                    <h4 className={`min-w-0 truncate font-black ${twoColumnBody ? "text-xs sm:text-sm" : "text-sm sm:text-base"}`}>
                      {region.title}
                    </h4>
                    <span className="shrink-0 font-mono text-[10px] font-semibold text-[#6B717C] tabular-nums">
                      {showCutState ? `${cut}/${total}件` : `零件数: ${total}`}
                    </span>
                    {(showCutState || canClickParts) && (
                      onSetRegionCut ? (
                        <button
                          type="button"
                          onClick={() => onSetRegionCut(region.id, !isDone)}
                          title={isDone ? "点击撤销本部位全部打勾" : "点击一键将本部位全部零件标记为已剪完"}
                          className={`bp-poster-pct ml-auto shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-black tabular-nums transition cursor-pointer ${
                            isDone
                              ? "bg-emerald-400/20 text-emerald-300 hover:bg-emerald-400/30"
                              : "bg-white/5 text-[#A3A9B3] hover:bg-emerald-500/20 hover:text-emerald-200"
                          }`}
                        >
                          {isDone ? "✓ 已剪完" : pct > 0 ? `${pct}% · 整部位` : "整部位剪完"}
                        </button>
                      ) : (
                        <span
                          className={`bp-poster-pct ml-auto shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-black tabular-nums ${
                            isDone ? "bg-emerald-400/15 text-emerald-300" : "bg-white/5 text-[#A3A9B3]"
                          }`}
                        >
                          {isDone ? "✓ 完成" : `${pct}%`}
                        </span>
                      )
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {groups.map((g) => {
                      const isRunnerHighlighted = Boolean(highlightRunnerId && g.runnerId === highlightRunnerId);
                      const isRunnerDimmed = Boolean(highlightRunnerId && g.runnerId !== highlightRunnerId);
                      return (
                        <RunnerGroupCapsule
                          key={g.runnerId}
                          group={g}
                          runner={runnerMap.get(g.runnerId)}
                          size={twoColumnBody ? "sm" : "md"}
                          showCut={showCutState}
                          interactive={canClickParts}
                          highlighted={isRunnerHighlighted}
                          dimmed={isRunnerDimmed}
                          highlightSegmentFn={
                            normalizedQuery
                              ? (seg) => segmentMatchesQuery(g.runnerId, seg, normalizedQuery)
                              : undefined
                          }
                          onClick={(seg) => onToggleCut?.(region.id, seg.partIds, !seg.isCut)}
                        />
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {onlyUncut && hiddenCompletedRegionsCount > 0 && (
          <p className="pb-2 text-center text-[11px] font-semibold text-emerald-300/80">
            已隐藏 {hiddenCompletedRegionsCount} 个已剪完的部位
          </p>
        )}

        <div className="flex items-center justify-between border-t border-[#1C1F28] py-3.5 font-mono text-[9px] font-bold text-[#5B616B]">
          <span>玩家自制取件表 · 点按零件号即可直接打勾标记</span>
          <span>POWERED BY GK MIXER</span>
        </div>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------
// 按板件取件视图（Runner-first）：拿起一块板 → 一次剪完它在所有部位的零件
// ------------------------------------------------------------------

interface RunnerPickSectionsProps {
  checklist: PartsChecklist;
  checkMode: boolean;
  showCutState?: boolean;
  twoColumnBody?: boolean;
  onlyUncut?: boolean;
  highlightRunnerId?: string | null;
  onSelectHighlightRunner?: (runnerId: string | null) => void;
  searchQuery?: string;
  onToggleCut?: (regionId: string, partIds: string[], nextCut: boolean) => void;
  onSetPartsCut?: (refs: PartRef[], nextCut: boolean) => void;
  onSetRunnerCut?: (runnerId: string, nextCut: boolean) => void;
}

const RunnerPickSections: React.FC<RunnerPickSectionsProps> = ({
  checklist,
  checkMode,
  showCutState = false,
  twoColumnBody = false,
  onlyUncut = false,
  highlightRunnerId = null,
  onSelectHighlightRunner,
  searchQuery = "",
  onToggleCut,
  onSetPartsCut,
  onSetRunnerCut,
}) => {
  const summary = useMemo(() => pivotByRunner(checklist), [checklist]);
  const [hideCleared, setHideCleared] = useState(false);
  const [showNumberMap, setShowNumberMap] = useState(false);
  const [localFocusRunnerId, setLocalFocusRunnerId] = useState<string | null>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());

  const effectiveFocusRunnerId = highlightRunnerId ?? localFocusRunnerId;
  const effectiveHideCleared = (checkMode && hideCleared) || onlyUncut;

  const visibleCards = useMemo(() => {
    return summary.cards.filter((c) => {
      if (effectiveHideCleared && c.isCleared) return false;
      if (!searchQuery) return true;
      if (c.runnerId.toUpperCase().includes(searchQuery)) return true;
      return c.rows.some(
        (r) =>
          r.regionTitle.toUpperCase().includes(searchQuery) ||
          r.segments.some((seg) => segmentMatchesQuery(c.runnerId, seg, searchQuery))
      );
    });
  }, [summary.cards, effectiveHideCleared, searchQuery]);

  const nextOpen = summary.cards.find((c) => !c.isCleared && c.runnerId !== effectiveFocusRunnerId) ?? null;

  const focusRunner = (runnerId: string) => {
    setLocalFocusRunnerId(runnerId);
    onSelectHighlightRunner?.(runnerId);
    const el = cardRefs.current.get(runnerId);
    if (el) {
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "nearest" });
    }
  };

  return (
    <div className="space-y-3 pb-2">
      {checkMode && (
        <div className="bp-poster-stat space-y-2 rounded-xl border border-[#22252E] bg-[#0D0F15] p-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-[#A3A9B3]">
              拿起哪块板就点哪块 · 已清板{" "}
              <span className="font-mono tabular-nums text-emerald-300">
                {summary.clearedRunners}/{summary.usedRunners}
              </span>
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {nextOpen && (
                <button
                  type="button"
                  onClick={() => focusRunner(nextOpen.runnerId)}
                  className="bp-pill rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-black text-white hover:bg-white/20 cursor-pointer"
                >
                  下一块：{nextOpen.runnerId} →
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowNumberMap((v) => !v)}
                aria-pressed={showNumberMap}
                className={`bp-pill rounded-full px-2.5 py-1 text-[11px] font-bold cursor-pointer ${
                  showNumberMap ? "bg-amber-400/20 text-amber-200" : "bg-white/5 text-[#A3A9B3] hover:text-white"
                }`}
              >
                {showNumberMap ? "收起 1..N 号码图" : "展开 1..N 号码图"}
              </button>
              <button
                type="button"
                onClick={() => setHideCleared((v) => !v)}
                aria-pressed={effectiveHideCleared}
                className={`bp-pill rounded-full px-2.5 py-1 text-[11px] font-bold cursor-pointer ${
                  effectiveHideCleared ? "bg-emerald-400/20 text-emerald-200" : "bg-white/5 text-[#A3A9B3] hover:text-white"
                }`}
              >
                {effectiveHideCleared ? "显示全部板件" : "隐藏已清板"}
              </button>
            </div>
          </div>
          {/* 板件导航条：进度 + 清板状态 */}
          <div className="-mx-0.5 flex gap-1.5 overflow-x-auto px-0.5 pb-0.5 sm:flex-wrap sm:overflow-visible [scrollbar-width:none]">
            {summary.cards.map((c) => {
              const base = c.runner?.colorHex ?? "#C9CED6";
              const pct = Math.round(c.progress * 100);
              const active = effectiveFocusRunnerId === c.runnerId;
              return (
                <button
                  key={c.runnerId}
                  type="button"
                  onClick={() => focusRunner(c.runnerId)}
                  title={`${c.runnerId} 板 · ${c.cutCount}/${c.partCount} 件`}
                  className={`bp-capsule-shell relative inline-flex shrink-0 items-stretch cursor-pointer transition ${
                    active ? "ring-2 ring-amber-400" : ""
                  } ${c.isCleared ? "opacity-45" : ""}`}
                >
                  <span
                    className="bp-capsule-tile relative grid h-6 min-w-[28px] place-items-center overflow-hidden px-1.5 font-mono text-[11px] font-black"
                    style={{ backgroundColor: base, color: readableTextColor(base) }}
                  >
                    <span className="relative">{c.runnerId}</span>
                    <span
                      aria-hidden
                      className="absolute bottom-0 left-0 h-[3px] bg-emerald-400"
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                  {c.isCleared && (
                    <span className="bp-capsule-sub grid place-items-center bg-emerald-500/25 px-1 text-[10px] font-black text-emerald-200">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {visibleCards.length === 0 && (
        <p className="py-6 text-center text-xs font-semibold text-emerald-300">全部板件已清板 🎉</p>
      )}

      <div
        className={
          twoColumnBody
            ? "grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3 items-start"
            : "space-y-3.5"
        }
      >
        {visibleCards.map((card) => (
          <RunnerPickCardView
            key={card.runnerId}
            card={card}
            checkMode={checkMode}
            showCutState={showCutState}
            showNumberMap={showNumberMap}
            focused={effectiveFocusRunnerId === card.runnerId}
            searchQuery={searchQuery}
            registerRef={(el) => {
              if (el) cardRefs.current.set(card.runnerId, el);
              else cardRefs.current.delete(card.runnerId);
            }}
            onToggleCut={onToggleCut}
            onSetPartsCut={onSetPartsCut}
            onSetRunnerCut={onSetRunnerCut}
          />
        ))}
      </div>

      {summary.idleRunnerIds.length > 0 && (
        <p className="text-[11px] font-semibold text-[#5B616B]">
          未引用的板件：{summary.idleRunnerIds.join("、")}（本方案无需剪件）
        </p>
      )}
    </div>
  );
};

interface RunnerPickCardViewProps {
  card: RunnerPickCard;
  checkMode: boolean;
  showCutState: boolean;
  showNumberMap: boolean;
  focused: boolean;
  searchQuery?: string;
  registerRef: (el: HTMLElement | null) => void;
  onToggleCut?: (regionId: string, partIds: string[], nextCut: boolean) => void;
  onSetPartsCut?: (refs: PartRef[], nextCut: boolean) => void;
  onSetRunnerCut?: (runnerId: string, nextCut: boolean) => void;
}

const RunnerPickCardView: React.FC<RunnerPickCardViewProps> = ({
  card,
  checkMode,
  showCutState,
  showNumberMap,
  focused,
  searchQuery = "",
  registerRef,
  onToggleCut,
  onSetPartsCut,
  onSetRunnerCut,
}) => {
  const [localMapOpen, setLocalMapOpen] = useState(false);
  const mapVisible = showNumberMap || localMapOpen;
  const base = card.runner?.colorHex ?? "#C9CED6";
  const fg = readableTextColor(base);
  const paintLabel = card.runner
    ? [card.runner.paintCode, card.runner.paintName].filter(Boolean).join(" ")
    : "";
  const pct = Math.round(card.progress * 100);
  const numberCells = useMemo(
    () => Array.from({ length: card.maxNumber }, (_, i) => i + 1),
    [card.maxNumber]
  );

  return (
    <section
      ref={registerRef}
      data-runner-card={card.runnerId}
      className={`bp-poster-stat scroll-mt-24 rounded-2xl border p-3 transition-colors sm:p-3.5 ${
        focused ? "border-amber-400/60 bg-[#12151D]" : "border-[#1A1D25] bg-[#0D0F15]"
      }`}
    >
      {/* 板件头 */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="bp-poster-icon grid h-9 min-w-[40px] place-items-center rounded-lg px-2 font-mono text-base font-black"
          style={{ backgroundColor: base, color: fg }}
        >
          {card.runnerId}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h4 className="text-xs font-black sm:text-sm">{card.runnerId} 板</h4>
            <span className="text-[10px] font-semibold text-[#6B717C] tabular-nums">
              {card.partCount} 件 · 跨 {card.rows.length} 部位
            </span>
          </div>
          {paintLabel && <p className="truncate text-[10px] font-semibold text-[#A3A9B3]">{paintLabel}</p>}
        </div>
        {checkMode && (
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => setLocalMapOpen((v) => !v)}
              className="bp-pill rounded-full bg-white/5 px-2 py-0.5 font-mono text-[10px] font-bold text-[#A3A9B3] hover:text-white cursor-pointer"
              title="展开/收起本板 1..N 全号矩阵图"
            >
              {mapVisible ? "收起图" : "号码图"}
            </button>
            <span
              className={`bp-poster-pct rounded-full px-2 py-0.5 font-mono text-[10px] font-black tabular-nums ${
                card.isCleared ? "bg-emerald-400/15 text-emerald-300" : "bg-white/5 text-[#A3A9B3]"
              }`}
            >
              {card.isCleared ? "✓ 已清板" : `${card.cutCount}/${card.partCount}`}
            </span>
            <button
              type="button"
              onClick={() => onSetRunnerCut?.(card.runnerId, !card.isCleared)}
              className={`bp-pill rounded-full px-2 py-0.5 text-[10px] font-black cursor-pointer ${
                card.isCleared
                  ? "bg-white/5 text-[#A3A9B3] hover:text-white"
                  : "bg-emerald-500 text-white hover:bg-emerald-400"
              }`}
            >
              {card.isCleared ? "撤销" : "清板"}
            </button>
          </div>
        )}
      </div>

      {/* 板件号码图：1..N，亮 = 需要剪，划线 = 已剪，虚框 = 本方案不用 */}
      {checkMode && mapVisible && (
        <div className="mt-2.5">
          <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold text-[#6B717C]">
            <span className="font-mono">RUNNER MAP · 1..{card.maxNumber}</span>
            <span>点号码 = 该号跨部位全部剪下</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {numberCells.map((n) => {
              const st = card.numbers.get(n);
              if (!st) {
                return (
                  <span
                    key={n}
                    title={`${card.runnerId}-${n} 本方案未使用`}
                    className="bp-matrix-tile bp-matrix-cell grid h-6 min-w-[24px] place-items-center rounded-[5px] border border-dashed border-white/10 px-0.5 font-mono text-[10px] font-bold text-[#3F444D] tabular-nums"
                  >
                    {n}
                  </span>
                );
              }
              const done = st.cut >= st.total;
              const partial = !done && st.cut > 0;
              const cellBg = getRunnerPartColorHex(card.runner, n);
              const cellFg = readableTextColor(cellBg);
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => onSetPartsCut?.(st.refs, !done)}
                  title={`${card.runnerId}-${n} · ${st.regionTitles.join(" / ")} · ${st.cut}/${st.total} 件`}
                  className={`bp-matrix-tile bp-matrix-cell relative inline-flex h-6 min-w-[24px] items-center justify-center overflow-hidden rounded-[5px] px-1 font-mono text-[10px] font-black leading-none tabular-nums transition cursor-pointer ${
                    done ? "opacity-35" : ""
                  } ${partial ? "ring-1 ring-amber-300" : ""}`}
                  style={{ backgroundColor: cellBg, color: cellFg }}
                >
                  <span className="relative">{n}</span>
                  {st.total > 1 && (
                    <sup className="relative -top-[0.45em] ml-px text-[0.75em] opacity-80">{st.total}</sup>
                  )}
                  {done && (
                    <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: CUT_SLASH }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 部位行：这块板的零件分别去哪个部位 */}
      <div className="mt-2.5 space-y-1.5">
        {card.rows.map((row) => {
          const rowDone = row.partCount > 0 && row.cutCount >= row.partCount;
          return (
            <div key={row.regionId} className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <div className={`flex shrink-0 items-center gap-1.5 sm:w-28 ${rowDone && showCutState ? "opacity-45" : ""}`}>
                <span className="bp-poster-icon grid h-5 w-5 shrink-0 place-items-center rounded-md bg-[#151820] text-[#E8EAEE]">
                  <RegionIcon category={row.category} className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 truncate text-[11px] font-black">{row.regionTitle}</span>
                <span className="shrink-0 font-mono text-[10px] font-semibold text-[#6B717C] tabular-nums">
                  {showCutState ? `${row.cutCount}/${row.partCount}` : row.partCount}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <RunnerGroupCapsule
                  group={{ runnerId: card.runnerId, segments: row.segments }}
                  runner={card.runner}
                  size="sm"
                  hideHead
                  showCut={showCutState}
                  interactive={checkMode}
                  highlightSegmentFn={
                    searchQuery
                      ? (seg) => segmentMatchesQuery(card.runnerId, seg, searchQuery)
                      : undefined
                  }
                  onClick={(seg) => onToggleCut?.(row.regionId, seg.partIds, !seg.isCut)}
                />
              </div>
            </div>
          );
        })}
      </div>

      {card.unusedNumbers.length > 0 && (
        <p className="mt-2 text-[10px] font-semibold text-[#5B616B]">
          板上未用号：<span className="font-mono">{compressNumbers(card.unusedNumbers)}</span>
        </p>
      )}
    </section>
  );
};
