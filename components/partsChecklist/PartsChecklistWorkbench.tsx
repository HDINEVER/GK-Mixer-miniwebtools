import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type {
  ChecklistBadge,
  ChecklistGroupBy,
  ChecklistPart,
  ChecklistRegion,
  ChecklistRegionCategory,
  ChecklistRunner,
  Language,
  PaintProject,
  PartsChecklist,
} from "../../types";
import { localizedBrand } from "../../utils/paintCatalog";
import {
  addPartsToRegion,
  BADGE_CYCLE,
  BADGE_META,
  checklistUid,
  clampMaxNumber,
  collectProjectPaints,
  computeChecklistStats,
  createEmptyChecklist,
  createRegion,
  createRunner,
  DEFAULT_RUNNER_COLOR,
  ensureRunnersFor,
  formatSegment,
  generateRunners,
  getRunnerColorBands,
  getRunnerPartColorHex,
  getRunnerPartPaintInfo,
  GRADE_META,
  groupRegionParts,
  MECHA_REGION_TEMPLATE,
  MIRROR_PAIRS,
  mirrorRegion,
  nextBadge,
  normalizeRunnerHex,
  parseQuickSyntax,
  PartInput,
  PartRef,
  PartSegment,
  pivotByRunner,
  readableTextColor,
  REGION_CATEGORY_META,
  REGION_CATEGORY_ORDER,
  regionCutCount,
  regionPartCount,
  regionToSyntax,
  setPartsCut,
  setRunnerCut,
  shadeHex,
  sortParts,
  sortRunners,
} from "../../utils/partsChecklist";
import {
  applyDammizImport,
  DammizApplyOptions,
  DammizImportPreview,
} from "../../utils/dammizImport";
import { DammizImportDialog } from "./DammizImportDialog";
import { getEffectiveProjectCover } from "../../utils/projectSharing";
import { resolvePartImageSrc } from "../../utils/studioSession";
import { downloadChecklistPoster } from "../../utils/partsChecklistExport";
import { ChecklistPoster, RunnerGroupCapsule } from "./ChecklistParts";
import { RegionIcon } from "./RegionIcon";
import {
  ArrowCounterClockwiseIcon,
  ArrowDownIcon,
  ArrowsLeftRightIcon,
  ArrowsOutSimpleIcon,
  ArrowsInSimpleIcon,
  ArrowUpIcon,
  CheckIcon,
  CrosshairIcon,
  DownloadSimpleIcon,
  EyeIcon,
  ImageSquareIcon,
  KeyboardIcon,
  LightningIcon,
  LinkSimpleIcon,
  ListIcon,
  PaletteIcon,
  PencilSimpleIcon,
  PlusIcon,
  PuzzlePieceIcon,
  ScissorsIcon,
  SlidersHorizontalIcon,
  SparkleIcon,
  SquaresFour as SquaresFourIcon,
  StackIcon,
  TrashIcon,
  XIcon,
} from "@phosphor-icons/react";

type ChecklistSubMode = "edit" | "check" | "poster";
type RegionViewMode = "list" | "gallery";
type GalleryCardSize = "sm" | "md" | "lg";

const VIEW_MODE_STORAGE_KEY = "gk_checklist_region_view_mode_v1";
const GALLERY_SIZE_STORAGE_KEY = "gk_checklist_gallery_size_v1";

interface DragStackState {
  runnerId: string;
  numbers: number[];
  colorHex: string;
  x: number;
  y: number;
}

interface FlyingTileItem {
  id: string;
  label: string;
  colorHex: string;
  textColor: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

interface ActiveSegmentSelection {
  regionId: string;
  segment: PartSegment;
}

interface PartsChecklistWorkbenchProps {
  project: PaintProject;
  onUpdateChecklist: (updater: (prev: PartsChecklist) => PartsChecklist) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  topLeftStage?: React.ReactNode;
  topTabBar?: React.ReactNode;
  isWideMode?: boolean;
  onNavigateToPaintTab?: () => void;
  onNavigateToColoringStudio?: () => void;
  lang?: Language;
}

// ------------------------------------------------------------------
// 抛物线飞入粒子（Web Animations API + reduced-motion 兼容）
// ------------------------------------------------------------------

const FlyingTileParticle: React.FC<{
  item: FlyingTileItem;
  onDone: (id: string) => void;
}> = ({ item, onDone }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      onDone(item.id);
      return;
    }
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced || typeof el.animate !== "function") {
      onDone(item.id);
      return;
    }
    const midX = (item.fromX + item.toX) / 2;
    const midY = Math.min(item.fromY, item.toY) - 42;
    const anim = el.animate(
      [
        {
          transform: `translate3d(${item.fromX}px, ${item.fromY}px, 0) translate(-50%, -50%) scale(1.08)`,
          opacity: 1,
        },
        {
          transform: `translate3d(${midX}px, ${midY}px, 0) translate(-50%, -50%) scale(1.18) rotate(-5deg)`,
          opacity: 1,
          offset: 0.45,
        },
        {
          transform: `translate3d(${item.toX}px, ${item.toY}px, 0) translate(-50%, -50%) scale(0.7)`,
          opacity: 0.15,
        },
      ],
      {
        duration: 340,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "forwards",
      }
    );
    anim.onfinish = () => onDone(item.id);
    const fallback = window.setTimeout(() => onDone(item.id), 420);
    return () => {
      window.clearTimeout(fallback);
      anim.cancel();
    };
  }, [item, onDone]);

  return (
    <div
      ref={ref}
      className="bp-flying-tile fixed left-0 top-0 z-[9998] pointer-events-none grid h-9 min-w-[36px] place-items-center px-2 font-mono text-xs font-black"
      style={{
        backgroundColor: item.colorHex,
        color: item.textColor,
      }}
    >
      {item.label}
    </div>
  );
};

// ------------------------------------------------------------------
// 堆叠预览格式化（22,23,24 → 22-24）
// ------------------------------------------------------------------

function summarizeSelectedNumbers(nums: number[]): string {
  if (nums.length === 0) return "";
  const sorted = [...nums].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let end = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      ranges.push(start === end ? String(start) : `${start}-${end}`);
      start = sorted[i];
      end = sorted[i];
    }
  }
  ranges.push(start === end ? String(start) : `${start}-${end}`);
  return ranges.join(", ");
}

// ------------------------------------------------------------------
// 主工作台组件
// ------------------------------------------------------------------

export const PartsChecklistWorkbench: React.FC<PartsChecklistWorkbenchProps> = ({
  project,
  onUpdateChecklist,
  isExpanded = false,
  onToggleExpand,
  topLeftStage,
  topTabBar,
  isWideMode = true,
  onNavigateToPaintTab,
  onNavigateToColoringStudio,
  lang = "zh" as Language,
}) => {
  const checklist: PartsChecklist = useMemo(
    () => project.partsChecklist ?? createEmptyChecklist(project.title),
    [project.partsChecklist, project.title]
  );

  const [subMode, setSubMode] = useState<ChecklistSubMode>("edit");
  const [regionViewMode, setRegionViewMode] = useState<RegionViewMode>(() => {
    try {
      const saved = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
      if (saved === "list" || saved === "gallery") return saved;
    } catch {
      /* ignore storage errors */
    }
    return "list";
  });
  const [gallerySize, setGallerySize] = useState<GalleryCardSize>(() => {
    try {
      const saved = window.localStorage.getItem(GALLERY_SIZE_STORAGE_KEY);
      if (saved === "sm" || saved === "md" || saved === "lg") return saved;
    } catch {
      /* ignore storage errors */
    }
    return "md";
  });
  const [activeRunnerId, setActiveRunnerId] = useState<string | null>(
    checklist.runners[0]?.id ?? null
  );
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [lockedRegionId, setLockedRegionId] = useState<string | null>(null);
  const [lassoSwipeMode, setLassoSwipeMode] = useState<boolean>(false);

  // Batch runner creation inputs
  const [batchFrom, setBatchFrom] = useState<string>("A");
  const [batchTo, setBatchTo] = useState<string>("N");
  const [batchMax, setBatchMax] = useState<number>(40);
  const [customRunnerName, setCustomRunnerName] = useState<string>("");
  const [customRunnerMax, setCustomRunnerMax] = useState<number>(20);
  const [showBatchPanel, setShowBatchPanel] = useState<boolean>(
    checklist.runners.length === 0
  );

  // Assigned paint binding panel (always targets activeRunner for stable continuous coloring)
  const [isColorPickerOpen, setIsColorPickerOpen] = useState<boolean>(false);
  const [paintAssignScope, setPaintAssignScope] = useState<"selected" | "runner">("selected");

  // Add region popover
  const [showAddRegionMenu, setShowAddRegionMenu] = useState<boolean>(false);
  const [newRegionTitle, setNewRegionTitle] = useState<string>("");

  // Region editing states
  const [editingRegionId, setEditingRegionId] = useState<string | null>(null);
  const [editingRegionTitle, setEditingRegionTitle] = useState<string>("");
  const [activeSegment, setActiveSegment] = useState<ActiveSegmentSelection | null>(null);
  const [syntaxDrafts, setSyntaxDrafts] = useState<Record<string, string>>({});
  const [syntaxReplaceMode, setSyntaxReplaceMode] = useState<Record<string, boolean>>({});

  // Drag-and-drop & flying tile animations
  const [dragStack, setDragStack] = useState<DragStackState | null>(null);
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);
  const [justLandedRegionId, setJustLandedRegionId] = useState<string | null>(null);
  const [flyingTiles, setFlyingTiles] = useState<FlyingTileItem[]>([]);

  // Poster export & check command dock states
  const [isExportingPoster, setIsExportingPoster] = useState<boolean>(false);
  const [posterCompactHeader, setPosterCompactHeader] = useState<boolean>(true);
  const [posterTwoCol, setPosterTwoCol] = useState<boolean>(true);
  const [onlyUncut, setOnlyUncut] = useState<boolean>(false);
  const [checkSearch, setCheckSearch] = useState<string>("");
  const [focusRunnerId, setFocusRunnerId] = useState<string | null>(null);
  const [exportColumns, setExportColumns] = useState<1 | 2>(2);
  const [toast, setToast] = useState<string | null>(null);
  const [undoSnapshot, setUndoSnapshot] = useState<{
    regions: ChecklistRegion[];
    label: string;
    /** 整表快照（链接导入等会同时改动板件的操作） */
    checklist?: PartsChecklist;
  } | null>(null);

  // 达米兹链接导入
  const [importOpen, setImportOpen] = useState<boolean>(false);
  const [importInitialInput, setImportInitialInput] = useState<string>("");

  const gridRef = useRef<HTMLDivElement>(null);
  const regionsContainerRef = useRef<HTMLDivElement>(null);
  const coverUploadRef = useRef<HTMLInputElement>(null);
  const longPressSegTimerRef = useRef<number | null>(null);
  const longPressSegOriginRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickUntilRef = useRef<number>(0);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const lastWheelCycleRef = useRef<number>(0);
  const activeSegmentRef = useRef<ActiveSegmentSelection | null>(null);
  activeSegmentRef.current = activeSegment;
  const cycleSegmentBadgeRef = useRef<
    ((regionId: string, seg: PartSegment, dir?: 1 | -1) => void) | null
  >(null);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
      dragCleanupRef.current = null;
      if (longPressSegTimerRef.current) {
        window.clearTimeout(longPressSegTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (isColorPickerOpen) {
        setIsColorPickerOpen(false);
      } else if (showAddRegionMenu) {
        setShowAddRegionMenu(false);
      } else if (activeSegment) {
        setActiveSegment(null);
      } else if (selectedNumbers.length > 0) {
        setSelectedNumbers([]);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isColorPickerOpen, showAddRegionMenu, activeSegment, selectedNumbers.length]);

  const useSplitTopLayout = subMode === "edit" && !isExpanded && Boolean(topLeftStage);

  useEffect(() => {
    try {
      window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, regionViewMode);
    } catch {
      /* ignore storage errors */
    }
  }, [regionViewMode]);

  useEffect(() => {
    try {
      window.localStorage.setItem(GALLERY_SIZE_STORAGE_KEY, gallerySize);
    } catch {
      /* ignore storage errors */
    }
  }, [gallerySize]);

  useEffect(() => {
    const el = regionsContainerRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      const target = e.target as Element | null;
      const segBtn = target?.closest?.('[data-active-segment="true"]');
      const current = activeSegmentRef.current;
      if (!segBtn || !current) return;
      e.preventDefault();
      const now = Date.now();
      if (now - lastWheelCycleRef.current < 140) return;
      lastWheelCycleRef.current = now;
      cycleSegmentBadgeRef.current?.(
        current.regionId,
        current.segment,
        e.deltaY >= 0 ? 1 : -1
      );
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [subMode, isExpanded, useSplitTopLayout]);

  // Sync activeRunnerId when runners list changes
  useEffect(() => {
    if (
      activeRunnerId &&
      checklist.runners.some((r) => r.id === activeRunnerId)
    ) {
      return;
    }
    setActiveRunnerId(checklist.runners[0]?.id ?? null);
    setSelectedNumbers([]);
  }, [checklist.runners, activeRunnerId]);

  // Clear lockedRegionId if region deleted
  useEffect(() => {
    if (
      lockedRegionId &&
      !checklist.regions.some((r) => r.id === lockedRegionId)
    ) {
      setLockedRegionId(null);
    }
  }, [checklist.regions, lockedRegionId]);

  /** keepUndo=true：保留刚设置的撤销快照（覆盖 / 导入类操作），否则清掉过期的撤销按钮 */
  const showToast = useCallback((msg: string, keepUndo = false) => {
    if (!keepUndo) setUndoSnapshot(null);
    setToast(msg);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => {
      setToast(null);
      setUndoSnapshot(null);
    }, undoSnapshot ? 6000 : 2600);
    return () => window.clearTimeout(t);
  }, [toast, undoSnapshot]);

  const flashRegionLanding = useCallback((regionId: string) => {
    setJustLandedRegionId(regionId);
    window.setTimeout(() => {
      setJustLandedRegionId((cur) => (cur === regionId ? null : cur));
    }, 380);
  }, []);

  const stats = useMemo(() => computeChecklistStats(checklist), [checklist]);
  const projectPaints = useMemo(() => collectProjectPaints(project), [project]);
  const runnerMap = useMemo(
    () => new Map(checklist.runners.map((r) => [r.id, r])),
    [checklist.runners]
  );
  const activeRunner = activeRunnerId ? runnerMap.get(activeRunnerId) ?? null : null;
  const lockedRegion = lockedRegionId
    ? checklist.regions.find((r) => r.id === lockedRegionId) ?? null
    : null;
  const effectiveTitle = checklist.modelTitle?.trim() || project.title || "未命名机体";
  const effectiveCoverSrc =
    checklist.coverImageDataUrl || getEffectiveProjectCover(project);
  const partImagesWithSrc = useMemo(
    () =>
      project.parts
        .map((part) => ({ part, src: resolvePartImageSrc(part) }))
        .filter((x) => Boolean(x.src)),
    [project.parts]
  );

  // ------------------------------------------------------------------
  // 数据变更工具函数
  // ------------------------------------------------------------------

  const mutateChecklist = useCallback(
    (fn: (prev: PartsChecklist) => PartsChecklist) => {
      onUpdateChecklist((prev) => ({
        ...fn(prev),
        updatedAt: Date.now(),
      }));
    },
    [onUpdateChecklist]
  );

  const handleQuickInitAll = () => {
    mutateChecklist((prev) => {
      const runners =
        prev.runners.length > 0
          ? prev.runners
          : generateRunners([], "A", "N", 40);
      const haveCats = new Set(prev.regions.map((r) => r.category));
      const newRegions = MECHA_REGION_TEMPLATE.filter(
        (tpl) => !haveCats.has(tpl.category)
      ).map((tpl) => createRegion(tpl.category, tpl.title));
      return {
        ...prev,
        runners,
        regions: [...prev.regions, ...newRegions],
      };
    });
    setShowBatchPanel(false);
    showToast("已生成 A~N 板件母池与机甲标准部位模板");
  };

  const handleBatchGenerateRunners = (e: React.FormEvent) => {
    e.preventDefault();
    const nextRunners = generateRunners(
      checklist.runners,
      batchFrom,
      batchTo,
      batchMax
    );
    const addedCount = nextRunners.length - checklist.runners.length;
    mutateChecklist((prev) => ({
      ...prev,
      runners: generateRunners(prev.runners, batchFrom, batchTo, batchMax),
    }));
    if (!activeRunnerId && nextRunners[0]) {
      setActiveRunnerId(nextRunners[0].id);
    }
    setShowBatchPanel(false);
    showToast(
      addedCount > 0
        ? `已生成 ${addedCount} 块板件（每板 ${clampMaxNumber(batchMax)} 件）`
        : "范围内板件已存在"
    );
  };

  const handleAddCustomRunner = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = customRunnerName.trim().toUpperCase();
    if (!cleanId) return;
    if (checklist.runners.some((r) => r.id === cleanId)) {
      setActiveRunnerId(cleanId);
      setCustomRunnerName("");
      showToast(`已切换至 ${cleanId} 板`);
      return;
    }
    const created = createRunner(cleanId, customRunnerMax);
    mutateChecklist((prev) => ({
      ...prev,
      runners: sortRunners([...prev.runners, created]),
    }));
    setActiveRunnerId(created.id);
    setSelectedNumbers([]);
    setCustomRunnerName("");
    showToast(`已新增板件 ${created.id}`);
  };

  const handleBindRunnerColor = (
    runnerId: string,
    colorHex: string,
    paint?: { brand?: string; code?: string; name?: string },
    targetNumbers?: number[]
  ) => {
    const hex = normalizeRunnerHex(colorHex);
    const cleanNums =
      targetNumbers && targetNumbers.length > 0
        ? Array.from(new Set(targetNumbers)).sort((a, b) => a - b)
        : [];

    if (cleanNums.length > 0) {
      mutateChecklist((prev) => ({
        ...prev,
        runners: prev.runners.map((r) => {
          if (r.id !== runnerId) return r;
          const nextPartColors = { ...(r.partColors ?? {}) };
          for (const n of cleanNums) {
            if (
              normalizeRunnerHex(r.colorHex) === hex &&
              (r.paintCode ?? "") === (paint?.code ?? "") &&
              (r.paintName ?? "") === (paint?.name ?? "")
            ) {
              // Matches runner base color — remove redundant override
              delete nextPartColors[n];
            } else {
              nextPartColors[n] = {
                colorHex: hex,
                paintBrand: paint?.brand,
                paintCode: paint?.code,
                paintName: paint?.name,
              };
            }
          }
          return {
            ...r,
            partColors:
              Object.keys(nextPartColors).length > 0 ? nextPartColors : undefined,
          };
        }),
      }));
      const rangeStr = summarizeSelectedNumbers(cleanNums);
      showToast(
        paint?.name
          ? `${runnerId} 板 [${rangeStr}] (${cleanNums.length}件) 已分色指派为 ${paint.code ?? ""} ${paint.name}`
          : `${runnerId} 板 [${rangeStr}] 局部色彩已更新`
      );
      return;
    }

    mutateChecklist((prev) => ({
      ...prev,
      runners: prev.runners.map((r) => {
        if (r.id !== runnerId) return r;
        // Clean up any part overrides that are now identical to the new base color
        let nextPartColors: typeof r.partColors = undefined;
        if (r.partColors) {
          const filtered: typeof r.partColors = {};
          for (const k of Object.keys(r.partColors)) {
            const ov = r.partColors[Number(k)];
            if (
              ov &&
              (normalizeRunnerHex(ov.colorHex) !== hex ||
                (ov.paintCode ?? "") !== (paint?.code ?? "") ||
                (ov.paintName ?? "") !== (paint?.name ?? ""))
            ) {
              filtered[Number(k)] = ov;
            }
          }
          if (Object.keys(filtered).length > 0) {
            nextPartColors = filtered;
          }
        }
        return {
          ...r,
          colorHex: hex,
          paintBrand: paint?.brand,
          paintCode: paint?.code,
          paintName: paint?.name,
          partColors: nextPartColors,
        };
      }),
    }));
    showToast(
      paint?.name
        ? `${runnerId} 板整板主色已指派 ${paint.code ?? ""} ${paint.name}（可框选号码继续做同板分色）`
        : `${runnerId} 板色彩已更新`
    );
  };

  const handleClearRunnerPartColors = (runnerId: string, numbers?: number[]) => {
    mutateChecklist((prev) => ({
      ...prev,
      runners: prev.runners.map((r) => {
        if (r.id !== runnerId) return r;
        if (!numbers || numbers.length === 0) {
          return { ...r, partColors: undefined };
        }
        const nextPartColors = { ...(r.partColors ?? {}) };
        for (const n of numbers) {
          delete nextPartColors[n];
        }
        return {
          ...r,
          partColors:
            Object.keys(nextPartColors).length > 0 ? nextPartColors : undefined,
        };
      }),
    }));
    showToast(
      numbers && numbers.length > 0
        ? `已恢复 ${runnerId} 板 [${summarizeSelectedNumbers(numbers)}] 为本板主底色`
        : `已清空 ${runnerId} 板所有局部零件分色`
    );
  };

  const handleResetRunnerColor = (runnerId: string) => {
    mutateChecklist((prev) => ({
      ...prev,
      runners: prev.runners.map((r) =>
        r.id === runnerId
          ? {
              ...r,
              colorHex: DEFAULT_RUNNER_COLOR,
              paintBrand: undefined,
              paintCode: undefined,
              paintName: undefined,
              partColors: undefined,
            }
          : r
      ),
    }));
    showToast(`${runnerId} 板已恢复默认未上色状态`);
  };

  const handleUpdateRunnerMax = (runnerId: string, maxNumber: number) => {
    const clamped = clampMaxNumber(maxNumber);
    mutateChecklist((prev) => ({
      ...prev,
      runners: prev.runners.map((r) =>
        r.id === runnerId ? { ...r, maxNumber: clamped } : r
      ),
    }));
  };

  const handleDeleteRunner = (runnerId: string) => {
    mutateChecklist((prev) => ({
      ...prev,
      runners: prev.runners.filter((r) => r.id !== runnerId),
    }));
    if (activeRunnerId === runnerId) {
      setSelectedNumbers([]);
    }
    showToast(`已移除板件 ${runnerId}`);
  };

  const handleAddRegion = (category: ChecklistRegionCategory, customTitle?: string) => {
    const region = createRegion(category, customTitle);
    mutateChecklist((prev) => ({
      ...prev,
      regions: [...prev.regions, region],
    }));
    setShowAddRegionMenu(false);
    setNewRegionTitle("");
    setLockedRegionId(region.id);
    showToast(`已新增部位「${region.title}」并设为当前装填目标`);
  };

  const handleAddMechaTemplate = () => {
    mutateChecklist((prev) => {
      const haveCats = new Set(prev.regions.map((r) => r.category));
      const added = MECHA_REGION_TEMPLATE.filter(
        (t) => !haveCats.has(t.category)
      ).map((t) => createRegion(t.category, t.title));
      return {
        ...prev,
        regions: [...prev.regions, ...added],
      };
    });
    showToast("已补齐机甲常用身体部位");
  };

  const handleMoveRegion = (idx: number, delta: -1 | 1) => {
    const target = idx + delta;
    mutateChecklist((prev) => {
      if (target < 0 || target >= prev.regions.length) return prev;
      const next = [...prev.regions];
      const [item] = next.splice(idx, 1);
      next.splice(target, 0, item);
      return { ...prev, regions: next };
    });
  };

  const handleDeleteRegion = (regionId: string) => {
    mutateChecklist((prev) => ({
      ...prev,
      regions: prev.regions.filter((r) => r.id !== regionId),
    }));
    if (activeSegment?.regionId === regionId) setActiveSegment(null);
  };

  const handleSaveRegionTitle = (regionId: string) => {
    setEditingRegionId(null);
    const clean = editingRegionTitle.trim();
    if (!clean) return;
    mutateChecklist((prev) => ({
      ...prev,
      regions: prev.regions.map((r) =>
        r.id === regionId ? { ...r, title: clean } : r
      ),
    }));
  };

  const assignNumbersToRegion = useCallback(
    (regionId: string, runnerId: string, numbers: number[]) => {
      if (numbers.length === 0) return;
      const inputs: PartInput[] = numbers.map((num) => ({
        runnerId,
        number: num,
      }));
      mutateChecklist((prev) => {
        const nextRunners = ensureRunnersFor(prev.runners, inputs);
        const nextRegions = prev.regions.map((r) =>
          r.id === regionId
            ? addPartsToRegion(r, inputs, nextRunners).region
            : r
        );
        return { ...prev, runners: nextRunners, regions: nextRegions };
      });
      flashRegionLanding(regionId);
    },
    [mutateChecklist, flashRegionLanding]
  );

  // ------------------------------------------------------------------
  // 抛物线飞入逻辑 (Target Lock & Tap-to-Send)
  // ------------------------------------------------------------------

  const spawnFlyingTiles = useCallback(
    (
      regionId: string,
      runner: ChecklistRunner,
      items: Array<{ num: number; fromEl: HTMLElement | null }>
    ) => {
      const targetEl = document.querySelector<HTMLElement>(
        `[data-region-drop-id="${regionId}"]`
      );
      if (!targetEl) return;
      const toRect = targetEl.getBoundingClientRect();
      const toX = toRect.left + Math.min(toRect.width * 0.35, 140);
      const toY = toRect.top + 24;
      const textColor = readableTextColor(runner.colorHex);

      const newParticles: FlyingTileItem[] = items
        .map(({ num, fromEl }) => {
          const fromRect = fromEl?.getBoundingClientRect();
          if (!fromRect) return null;
          return {
            id: checklistUid("fly"),
            label: `${runner.id}${num}`,
            colorHex: runner.colorHex,
            textColor,
            fromX: fromRect.left + fromRect.width / 2,
            fromY: fromRect.top + fromRect.height / 2,
            toX,
            toY,
          };
        })
        .filter((x): x is FlyingTileItem => x !== null);

      if (newParticles.length > 0) {
        setFlyingTiles((prev) => [...prev, ...newParticles.slice(0, 12)]);
      }
    },
    []
  );

  const removeFlyingTile = useCallback((id: string) => {
    setFlyingTiles((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleSendStackToLocked = () => {
    if (!activeRunner || !lockedRegion || selectedNumbers.length === 0) return;
    const nums = [...selectedNumbers].sort((a, b) => a - b);
    const items = nums.map((num) => ({
      num,
      fromEl:
        gridRef.current?.querySelector<HTMLElement>(`[data-part-num="${num}"]`) ??
        null,
    }));
    spawnFlyingTiles(lockedRegion.id, activeRunner, items);
    assignNumbersToRegion(lockedRegion.id, activeRunner.id, nums);
    setSelectedNumbers([]);
    showToast(
      `已装填 ${activeRunner.id} ${summarizeSelectedNumbers(nums)} ➔ 「${lockedRegion.title}」`
    );
  };

  // ------------------------------------------------------------------
  // 滑动框选 + 弹簧磁吸拖拽 (Lasso Stack & Drag)
  // ------------------------------------------------------------------

  const lassoRef = useRef<{
    active: boolean;
    pointerId: number;
    pointerType: string;
    startNum: number;
    currentNum: number;
    startX: number;
    startY: number;
    moved: boolean;
    additive: boolean;
    baseSelected: number[];
    runnerId: string;
    colorHex: string;
    draggingOut: boolean;
    dragNums: number[];
    lassoNums: number[];
  } | null>(null);

  const startStackDragOnly = useCallback(
    (
      runner: ChecklistRunner,
      numbers: number[],
      startX: number,
      startY: number
    ) => {
      if (numbers.length === 0) return;
      dragCleanupRef.current?.();
      const sorted = [...numbers].sort((a, b) => a - b);
      setDragStack({
        runnerId: runner.id,
        numbers: sorted,
        colorHex: runner.colorHex,
        x: startX,
        y: startY,
      });

      const onMove = (ev: PointerEvent) => {
        setDragStack((prev) =>
          prev ? { ...prev, x: ev.clientX, y: ev.clientY } : null
        );
        const under = document
          .elementFromPoint(ev.clientX, ev.clientY)
          ?.closest<HTMLElement>("[data-region-drop-id]");
        setHoveredRegionId(under?.dataset.regionDropId ?? null);
      };

      const cleanup = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        if (dragCleanupRef.current === cleanup) {
          dragCleanupRef.current = null;
        }
      };

      const onUp = (ev: PointerEvent) => {
        cleanup();
        const under = document
          .elementFromPoint(ev.clientX, ev.clientY)
          ?.closest<HTMLElement>("[data-region-drop-id]");
        const dropRegionId = under?.dataset.regionDropId;
        setDragStack(null);
        setHoveredRegionId(null);
        if (dropRegionId) {
          assignNumbersToRegion(dropRegionId, runner.id, sorted);
          setSelectedNumbers([]);
          const regionTitle =
            checklist.regions.find((r) => r.id === dropRegionId)?.title ?? "部位";
          showToast(
            `已放入 ${runner.id} ${summarizeSelectedNumbers(sorted)} ➔ 「${regionTitle}」`
          );
        }
      };

      dragCleanupRef.current = cleanup;
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [assignNumbersToRegion, checklist.regions, showToast]
  );

  const handleTilePointerDown = (
    num: number,
    e: React.PointerEvent<HTMLButtonElement>
  ) => {
    if (!activeRunner || e.button !== 0) return;
    // Touch without lassoSwipeMode: let tap/scroll work natively via onClick
    if (e.pointerType === "touch" && !lassoSwipeMode) return;
    dragCleanupRef.current?.();

    lassoRef.current = {
      active: true,
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      startNum: num,
      currentNum: num,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      additive: e.shiftKey || e.metaKey || e.ctrlKey,
      baseSelected: selectedNumbers,
      runnerId: activeRunner.id,
      colorHex: activeRunner.colorHex,
      draggingOut: false,
      dragNums: [],
      lassoNums: [num],
    };

    const handleMove = (ev: PointerEvent) => {
      const state = lassoRef.current;
      if (!state || ev.pointerId !== state.pointerId) return;

      const dist = Math.hypot(ev.clientX - state.startX, ev.clientY - state.startY);
      if (dist > 6) {
        state.moved = true;
      }

      if (state.draggingOut) {
        setDragStack((prev) =>
          prev ? { ...prev, x: ev.clientX, y: ev.clientY } : null
        );
        const dropEl = document
          .elementFromPoint(ev.clientX, ev.clientY)
          ?.closest<HTMLElement>("[data-region-drop-id]");
        setHoveredRegionId(dropEl?.dataset.regionDropId ?? null);
        return;
      }

      const gridRect = gridRef.current?.getBoundingClientRect();
      const isOutsideGrid =
        gridRect &&
        (ev.clientX < gridRect.left - 8 ||
          ev.clientX > gridRect.right + 8 ||
          ev.clientY < gridRect.top - 8 ||
          ev.clientY > gridRect.bottom + 8);

      // If pointer left the grid while dragging, morph into Stack Drag Ghost
      if (state.moved && isOutsideGrid && checklist.regions.length > 0) {
        const isStartAlreadySelected = state.baseSelected.includes(state.startNum);
        const dragNums =
          state.currentNum !== state.startNum
            ? (() => {
                const lo = Math.min(state.startNum, state.currentNum);
                const hi = Math.max(state.startNum, state.currentNum);
                const range = Array.from(
                  { length: hi - lo + 1 },
                  (_, i) => lo + i
                );
                return state.additive
                  ? Array.from(new Set([...state.baseSelected, ...range]))
                  : range;
              })()
            : isStartAlreadySelected && state.baseSelected.length > 0
            ? state.baseSelected
            : [state.startNum];

        state.draggingOut = true;
        state.dragNums = [...dragNums].sort((a, b) => a - b);
        state.lassoNums = state.dragNums;
        setSelectedNumbers(state.dragNums);
        setDragStack({
          runnerId: state.runnerId,
          numbers: state.dragNums,
          colorHex: state.colorHex,
          x: ev.clientX,
          y: ev.clientY,
        });
        const dropEl = document
          .elementFromPoint(ev.clientX, ev.clientY)
          ?.closest<HTMLElement>("[data-region-drop-id]");
        setHoveredRegionId(dropEl?.dataset.regionDropId ?? null);
        return;
      }

      // Inside grid: swipe-lasso numeric range
      if (state.moved) {
        const el = document
          .elementFromPoint(ev.clientX, ev.clientY)
          ?.closest<HTMLElement>("[data-part-num]");
        const hoverNum = el?.dataset.partNum ? Number(el.dataset.partNum) : null;
        if (hoverNum && Number.isFinite(hoverNum)) {
          state.currentNum = hoverNum;
          const lo = Math.min(state.startNum, hoverNum);
          const hi = Math.max(state.startNum, hoverNum);
          const range = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
          const nextNums = state.additive
            ? Array.from(new Set([...state.baseSelected, ...range]))
            : range;
          state.lassoNums = nextNums;
          setSelectedNumbers(nextNums);
        }
      }
    };

    const cleanup = () => {
      lassoRef.current = null;
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
      if (dragCleanupRef.current === cleanup) {
        dragCleanupRef.current = null;
      }
    };

    const handleUp = (ev: PointerEvent) => {
      const state = lassoRef.current;
      if (!state || ev.pointerId !== state.pointerId) return;
      cleanup();

      if (state.draggingOut) {
        suppressClickUntilRef.current = Date.now() + 180;
        const dropEl = document
          .elementFromPoint(ev.clientX, ev.clientY)
          ?.closest<HTMLElement>("[data-region-drop-id]");
        const dropId = dropEl?.dataset.regionDropId;
        setDragStack(null);
        setHoveredRegionId(null);
        if (dropId) {
          const nums = state.dragNums.length > 0 ? state.dragNums : [state.startNum];
          assignNumbersToRegion(dropId, state.runnerId, nums);
          setSelectedNumbers([]);
          const regionTitle =
            checklist.regions.find((r) => r.id === dropId)?.title ?? "部位";
          showToast(
            `已放入 ${state.runnerId} ${summarizeSelectedNumbers(nums)} ➔ 「${regionTitle}」`
          );
        }
        return;
      }

      if (state.moved) {
        suppressClickUntilRef.current = Date.now() + 180;
        // Target Lock ON: swiping across contiguous numbers inside the grid flies them straight into the locked region
        if (lockedRegion && !state.additive && state.lassoNums.length > 0) {
          const nums = [...state.lassoNums].sort((a, b) => a - b);
          const items = nums.map((n) => ({
            num: n,
            fromEl:
              gridRef.current?.querySelector<HTMLElement>(`[data-part-num="${n}"]`) ??
              null,
          }));
          spawnFlyingTiles(lockedRegion.id, activeRunner, items);
          assignNumbersToRegion(lockedRegion.id, state.runnerId, nums);
          setSelectedNumbers([]);
          showToast(
            `已装填 ${state.runnerId} ${summarizeSelectedNumbers(nums)} ➔ 「${lockedRegion.title}」`
          );
        }
      }
    };

    dragCleanupRef.current = cleanup;
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
  };

  const handleTileClick = (
    num: number,
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    if (!activeRunner) return;
    if (Date.now() < suppressClickUntilRef.current) return;

    // Target Lock ON + normal click -> Tap-to-Send with parabolic flight!
    if (lockedRegion && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      spawnFlyingTiles(lockedRegion.id, activeRunner, [
        { num, fromEl: e.currentTarget },
      ]);
      assignNumbersToRegion(lockedRegion.id, activeRunner.id, [num]);
      return;
    }

    // Multi-select scattered numbers into Stack Badge
    setSelectedNumbers((prev) =>
      prev.includes(num) ? prev.filter((x) => x !== num) : [...prev, num]
    );
  };

  // ------------------------------------------------------------------
  // 角标切换 / 删除 / 镜像 / 极速语法
  // ------------------------------------------------------------------

  const setSegmentBadge = (
    regionId: string,
    partIds: string[],
    badge: ChecklistBadge | undefined
  ) => {
    const idSet = new Set(partIds);
    mutateChecklist((prev) => ({
      ...prev,
      regions: prev.regions.map((r) =>
        r.id !== regionId
          ? r
          : {
              ...r,
              parts: r.parts.map((p) =>
                idSet.has(p.id) ? { ...p, badge } : p
              ),
            }
      ),
    }));
  };

  const cycleSegmentBadge = (
    regionId: string,
    seg: PartSegment,
    dir: 1 | -1 = 1
  ) => {
    const next = nextBadge(seg.badge, dir);
    setSegmentBadge(regionId, seg.partIds, next);
    setActiveSegment((cur) =>
      cur && cur.regionId === regionId && cur.segment.key === seg.key
        ? { regionId, segment: { ...seg, badge: next } }
        : cur
    );
    showToast(
      next
        ? `${seg.runnerId}${formatSegment(seg)} 标记为 ${next}（${BADGE_META[next].hint}）`
        : `${seg.runnerId}${formatSegment(seg)} 已清除角标`
    );
  };
  cycleSegmentBadgeRef.current = cycleSegmentBadge;

  const removeSegmentParts = (regionId: string, partIds: string[]) => {
    const idSet = new Set(partIds);
    mutateChecklist((prev) => ({
      ...prev,
      regions: prev.regions.map((r) =>
        r.id !== regionId
          ? r
          : { ...r, parts: r.parts.filter((p) => !idSet.has(p.id)) }
      ),
    }));
    setActiveSegment(null);
  };

  const handleMirrorRegion = (sourceRegion: ChecklistRegion) => {
    const snapshot = checklist.regions;
    const result = mirrorRegion(snapshot, sourceRegion.id);
    if (!result.targetId) return;
    mutateChecklist((prev) => ({
      ...prev,
      regions: result.regions,
    }));
    if (result.replaced) {
      setUndoSnapshot({
        regions: snapshot,
        label: `已覆盖对侧部位`,
      });
    } else {
      setUndoSnapshot(null);
    }
    const targetRegion = result.regions.find((r) => r.id === result.targetId);
    showToast(
      `已镜像克隆至「${targetRegion?.title ?? "对侧部位"}」，可点击「回填」微调差异件`,
      true
    );
    window.setTimeout(() => {
      const el = document.querySelector<HTMLElement>(
        `[data-region-drop-id="${result.targetId}"]`
      );
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 60);
  };

  const handleApplySyntax = (region: ChecklistRegion) => {
    const raw = (syntaxDrafts[region.id] ?? "").trim();
    if (!raw) return;
    const { items, errors } = parseQuickSyntax(raw);
    if (items.length === 0) {
      showToast(errors[0] || "未识别有效零件语法，示例：A5,9,26 K4-5*2");
      return;
    }
    const isReplace = Boolean(syntaxReplaceMode[region.id]);
    mutateChecklist((prev) => {
      const nextRunners = ensureRunnersFor(prev.runners, items);
      const nextRegions = prev.regions.map((r) => {
        if (r.id !== region.id) return r;
        if (isReplace) {
          const freshParts: ChecklistPart[] = [];
          const seen = new Set<string>();
          for (const it of items) {
            const k = `${it.runnerId}:${it.number}`;
            if (seen.has(k)) continue;
            seen.add(k);
            freshParts.push({
              id: checklistUid("pt"),
              runnerId: it.runnerId,
              number: it.number,
              badge: it.badge,
            });
          }
          return { ...r, parts: sortParts(freshParts, nextRunners) };
        }
        return addPartsToRegion(r, items, nextRunners).region;
      });
      return { ...prev, runners: nextRunners, regions: nextRegions };
    });
    setSyntaxDrafts((prev) => ({ ...prev, [region.id]: "" }));
    setSyntaxReplaceMode((prev) => ({ ...prev, [region.id]: false }));
    flashRegionLanding(region.id);
    showToast(
      errors.length > 0
        ? `已解析 ${items.length} 个零件号（忽略 ${errors.length} 处无效片段）`
        : `${isReplace ? "已更新" : "已添加"} ${items.length} 个零件号至「${region.title}」`
    );
  };

  const handleToggleCut = (
    regionId: string,
    partIds: string[],
    nextCut: boolean
  ) => {
    const idSet = new Set(partIds);
    mutateChecklist((prev) => ({
      ...prev,
      regions: prev.regions.map((r) =>
        r.id !== regionId
          ? r
          : {
              ...r,
              parts: r.parts.map((p) =>
                idSet.has(p.id) ? { ...p, isCut: nextCut } : p
              ),
            }
      ),
    }));
  };

  const handleResetAllCut = () => {
    mutateChecklist((prev) => ({
      ...prev,
      regions: prev.regions.map((r) => ({
        ...r,
        parts: r.parts.map((p) => ({ ...p, isCut: false })),
      })),
    }));
    showToast("已重置全部剪件打勾状态");
  };

  // ------------------------------------------------------------------
  // 按板件取件：同号跨部位批量剪下 / 整板一键剪完
  // ------------------------------------------------------------------

  const groupBy: ChecklistGroupBy = checklist.groupBy ?? "region";

  const handleSetGroupBy = (next: ChecklistGroupBy) => {
    if (next === groupBy) return;
    mutateChecklist((prev) => ({ ...prev, groupBy: next }));
  };

  const handleSetPartsCut = (refs: PartRef[], nextCut: boolean) => {
    mutateChecklist((prev) => ({
      ...prev,
      regions: setPartsCut(prev.regions, refs, nextCut),
    }));
  };

  const handleSetRunnerCut = (runnerId: string, nextCut: boolean) => {
    mutateChecklist((prev) => ({
      ...prev,
      regions: setRunnerCut(prev.regions, runnerId, nextCut),
    }));
    showToast(nextCut ? `${runnerId} 板已清板` : `已撤销 ${runnerId} 板的剪件记录`);
  };

  const handleSetRegionCut = (regionId: string, nextCut: boolean) => {
    const target = checklist.regions.find((r) => r.id === regionId);
    mutateChecklist((prev) => ({
      ...prev,
      regions: prev.regions.map((r) =>
        r.id !== regionId
          ? r
          : {
              ...r,
              parts: r.parts.map((p) => ({ ...p, isCut: nextCut })),
            }
      ),
    }));
    if (target) {
      showToast(
        nextCut
          ? `「${target.title}」已整部位标记剪完`
          : `已撤销「${target.title}」的剪件打勾`
      );
    }
  };

  const runnerSummary = useMemo(() => pivotByRunner(checklist), [checklist]);

  // ------------------------------------------------------------------
  // 达米兹分享链接导入（仅文本数据）
  // ------------------------------------------------------------------

  const openImportDialog = (prefill?: string) => {
    setImportInitialInput(prefill ?? "");
    setImportOpen(true);
  };

  const handleImportDammiz = (preview: DammizImportPreview, opts: DammizApplyOptions) => {
    const before = checklist;
    const result = applyDammizImport(before, preview, opts);
    mutateChecklist(() => result.checklist);
    setUndoSnapshot({
      regions: before.regions,
      label: "导入",
      checklist: before,
    });
    setImportOpen(false);
    setShowBatchPanel(false);
    setSelectedNumbers([]);
    setLockedRegionId(null);
    setActiveRunnerId(result.checklist.runners[0]?.id ?? null);
    showToast(
      `已导入「${preview.scheme.title}」：${result.addedRegions} 个部位 · ${result.addedParts} 个零件号`,
      true
    );
  };

  const existingSummary = useMemo(
    () => ({
      runners: checklist.runners.length,
      regions: checklist.regions.length,
      parts: checklist.regions.reduce((s, r) => s + r.parts.length, 0),
    }),
    [checklist.runners, checklist.regions]
  );

  const handleUploadCover = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        mutateChecklist((prev) => ({
          ...prev,
          coverImageDataUrl: reader.result as string,
        }));
        showToast("已更新取件表实拍封面");
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleDownloadPoster = async () => {
    if (isExportingPoster) return;
    setIsExportingPoster(true);
    try {
      await downloadChecklistPoster(
        {
          checklist,
          title: effectiveTitle,
          subtitle: checklist.subtitle?.trim() || undefined,
          coverSrc: effectiveCoverSrc,
          groupBy,
          columns: exportColumns,
        },
        `GKMixer-取件表-${effectiveTitle}-${groupBy === "runner" ? "按板件" : "按部位"}-${
          exportColumns === 2 ? "双栏海报" : "单栏长图"
        }.png`
      );
      showToast(
        exportColumns === 2
          ? "高清双栏宽幅取件表海报已导出"
          : "高清单栏竖版取件表长图已导出"
      );
    } catch (err: any) {
      showToast(`导出失败：${err?.message || "请稍后重试"}`);
    } finally {
      setIsExportingPoster(false);
    }
  };

  const gradeInfo = stats.grade ? GRADE_META[stats.grade] : null;
  const activeRunnerUsage = activeRunner
    ? stats.usage.get(activeRunner.id)
    : undefined;

  const isGallery = regionViewMode === "gallery";
  const isGallerySm = isGallery && gallerySize === "sm";
  const isGalleryLg = isGallery && gallerySize === "lg";

  const regionGridClassName = useMemo(() => {
    if (regionViewMode === "list") {
      // 列表模式：正常页面全宽 Row 2 下左右各两栏 (md:grid-cols-2)；在「全宽工作台」左池右槽较窄侧于 xl+ 分两栏
      return isExpanded
        ? "grid grid-cols-1 xl:grid-cols-2 gap-3 items-stretch"
        : "grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch";
    }
    // 画廊模式：根据小/中/大画框尺寸动态调节列数与展示空间
    if (isExpanded) {
      if (gallerySize === "lg") return "grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch";
      if (gallerySize === "sm") return "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5 items-stretch";
      return "grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3 items-stretch";
    }
    if (!isWideMode) {
      if (gallerySize === "lg") return "grid grid-cols-1 gap-4 items-stretch";
      if (gallerySize === "sm") return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 items-stretch";
      return "grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-stretch";
    }
    if (gallerySize === "lg") return "grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch";
    if (gallerySize === "sm") return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 items-stretch";
    return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 items-stretch";
  }, [regionViewMode, gallerySize, isExpanded, isWideMode]);

  // ------------------------------------------------------------------
  // 模块化渲染片段（支持 Row 1 实拍对照 + Row 2 全宽两栏列表/画廊布局）
  // ------------------------------------------------------------------

  const checklistHeaderNode = (
    <div className="bp-subcard-lg flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/85 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5 shadow-sm">
      <div className="bp-segmented inline-flex rounded-full bg-slate-100 dark:bg-slate-800 p-1">
        {(
          [
            { id: "edit", label: "制作编辑", Icon: SlidersHorizontalIcon },
            { id: "check", label: "剪件打勾", Icon: ScissorsIcon },
            { id: "poster", label: "海报导出", Icon: EyeIcon },
          ] as const
        ).map(({ id, label, Icon }) => {
          const active = subMode === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setSubMode(id)}
              className={`bp-segmented-item inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black transition cursor-pointer whitespace-nowrap ${
                active
                  ? "bp-segmented-item-active bg-coral text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" weight="bold" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* 达米兹链接导入 / 来源 */}
        {checklist.source?.provider === "dammiz" ? (
          <button
            type="button"
            onClick={() => openImportDialog(checklist.source?.url)}
            title={`来源：达米兹方案 #${checklist.source.schemeId}「${checklist.source.title}」，点击重新同步`}
            className="bp-pill inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:border-accent transition cursor-pointer whitespace-nowrap"
          >
            <LinkSimpleIcon className="h-3.5 w-3.5 text-accent" weight="bold" />
            <span>达米兹 #{checklist.source.schemeId}</span>
            <span className="text-slate-400">· 重新同步</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => openImportDialog()}
            className="bp-pill inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:border-accent transition cursor-pointer whitespace-nowrap"
          >
            <LinkSimpleIcon className="h-3.5 w-3.5 text-accent" weight="bold" />
            <span>链接导入</span>
          </button>
        )}

        {/* 实时统计 & CLEAN SCORE */}
        <div className="bp-badge flex items-center gap-1.5 rounded-full border border-slate-200/80 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1 text-[11px] font-bold tabular-nums whitespace-nowrap">
          <span className="text-slate-500 dark:text-slate-400">
            {stats.partsCount}件 · {stats.runnersCount}板 · {stats.regionsCount}部位
          </span>
          <span className="text-slate-300 dark:text-slate-600">|</span>
          <span
            className="font-mono font-black"
            style={{ color: gradeInfo?.color ?? "#94A3B8" }}
            title="清板评分：基于平均每个部位横跨的板件数量计算"
          >
            {stats.grade
              ? `[${stats.grade}] ${stats.cleanScore}分 ${gradeInfo?.label}`
              : "待评分"}
          </span>
        </div>

        {onToggleExpand && (
          <button
            type="button"
            onClick={onToggleExpand}
            className={`hidden lg:inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold transition cursor-pointer whitespace-nowrap ${
              isExpanded
                ? "bp-pill-active border-accent bg-accent text-white"
                : "bp-pill border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-accent"
            }`}
            title={
              isExpanded
                ? "恢复左侧实拍图对照"
                : "全宽展开取件表工作台（左池右槽）"
            }
          >
            {isExpanded ? (
              <>
                <ArrowsInSimpleIcon className="h-3.5 w-3.5" weight="bold" />
                <span>对照实拍图</span>
              </>
            ) : (
              <>
                <ArrowsOutSimpleIcon className="h-3.5 w-3.5 text-accent" weight="bold" />
                <span>全宽工作台</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );

  const emptyInitCard =
    checklist.runners.length === 0 && checklist.regions.length === 0 ? (
      <div className="bp-dashed-box rounded-2xl border border-dashed border-coral/45 bg-gradient-to-br from-coral/5 via-white to-accent/5 dark:from-coral/10 dark:via-slate-900 dark:to-accent/10 p-5 text-center space-y-3">
        <div className="bp-pool-icon mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-coral/15 text-coral">
          <PuzzlePieceIcon className="h-6 w-6" weight="bold" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-black text-slate-900 dark:text-white">
            零版权 · 交互式取件表工作台
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
            板件颜色直接绑定本项目指派油漆；支持划选堆叠拖拽、锁定部位连点飞入、左右镜像克隆与极速语法录入，并自动计算清板评分。
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={handleQuickInitAll}
            className="bp-pill-active inline-flex items-center gap-1.5 rounded-full bg-coral hover:bg-coral/90 px-4 py-2 text-xs font-black text-white shadow-sm transition cursor-pointer"
          >
            <SparkleIcon className="h-3.5 w-3.5" weight="fill" />
            <span>一键初始化 A~N 板件 + 标准机甲部位</span>
          </button>
          <button
            type="button"
            onClick={() => setShowBatchPanel(true)}
            className="bp-pill inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <PlusIcon className="h-3.5 w-3.5" weight="bold" />
            <span>自定义生成板件</span>
          </button>
          <button
            type="button"
            onClick={() => openImportDialog()}
            className="bp-pill inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-accent cursor-pointer"
          >
            <LinkSimpleIcon className="h-3.5 w-3.5 text-accent" weight="bold" />
            <span>粘贴达米兹链接导入</span>
          </button>
        </div>
      </div>
    ) : null;

  const runnerPoolNode = (
    <div className="bp-subcard-lg rounded-2xl border border-slate-200/85 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-sm space-y-3">
      {/* 母池标题栏 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="bp-pool-icon flex h-7 w-7 items-center justify-center rounded-lg bg-coral/15 text-coral shrink-0">
            <StackIcon className="h-4 w-4" weight="bold" />
          </span>
          <div>
            <h3 className="text-xs font-black text-slate-900 dark:text-white leading-tight">
              板件母池（Runner Pool）
            </h3>
            <p className="text-[10px] text-slate-400">
              {projectPaints.length > 0
                ? `已同步本项目 ${projectPaints.length} 款指派油漆 · 点选板件后点击「指派油漆上色」即可绑定`
                : "当前暂未指派项目油漆 · 点击右侧「指派油漆上色」可前往颜色指派页面"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {checklist.runners.length > 0 && (
            <button
              type="button"
              onClick={() => setIsColorPickerOpen((v) => !v)}
              aria-expanded={isColorPickerOpen}
              className={`bp-pill inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
                isColorPickerOpen
                  ? "bp-pill-active border-coral bg-coral text-white shadow-xs"
                  : "border-coral/40 bg-coral/10 text-coral hover:border-coral hover:bg-coral/15"
              }`}
              title="打开或收起板件指派油漆上色面板"
            >
              <PaletteIcon className="h-3.5 w-3.5 shrink-0" weight="bold" />
              <span>
                {isColorPickerOpen
                  ? "收起指派上色"
                  : `指派油漆上色 (${projectPaints.length})`}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowBatchPanel((v) => !v)}
            className={`bp-pill inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
              showBatchPanel
                ? "border-coral bg-coral/10 text-coral"
                : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-coral"
            }`}
          >
            <PlusIcon className="h-3 w-3" weight="bold" />
            <span>快建板件</span>
          </button>
        </div>
      </div>

      {/* 批量建板 + 自定义板件面板 (外 18px - 内距 10px = 8px 同心输入与按钮) */}
      {showBatchPanel && (
        <div className="bp-subcard rounded-[18px] border border-slate-200/90 dark:border-slate-700/80 bg-slate-50/90 dark:bg-slate-800/60 p-2.5 space-y-2.5">
          <form
            onSubmit={handleBatchGenerateRunners}
            className="flex flex-wrap items-end gap-2"
          >
            <label className="space-y-1">
              <span className="block text-[10px] font-bold text-slate-500">
                起始字母
              </span>
              <input
                type="text"
                maxLength={1}
                value={batchFrom}
                onChange={(e) => setBatchFrom(e.target.value.toUpperCase())}
                className="bp-input h-8 w-12 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-center font-mono text-xs font-black uppercase text-slate-900 dark:text-white"
              />
            </label>
            <span className="pb-1.5 text-xs font-bold text-slate-400">~</span>
            <label className="space-y-1">
              <span className="block text-[10px] font-bold text-slate-500">
                结束字母
              </span>
              <input
                type="text"
                maxLength={1}
                value={batchTo}
                onChange={(e) => setBatchTo(e.target.value.toUpperCase())}
                className="bp-input h-8 w-12 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-center font-mono text-xs font-black uppercase text-slate-900 dark:text-white"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-[10px] font-bold text-slate-500">
                每板最大件号
              </span>
              <input
                type="number"
                min={1}
                max={200}
                value={batchMax}
                onChange={(e) => setBatchMax(Number(e.target.value))}
                className="bp-input h-8 w-16 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-center font-mono text-xs font-bold text-slate-900 dark:text-white tabular-nums"
              />
            </label>
            <button
              type="submit"
              className="bp-pill-active h-8 rounded-lg bg-coral px-3 text-xs font-black text-white shadow-sm hover:brightness-110 transition cursor-pointer"
            >
              批量生成
            </button>
          </form>

          <form
            onSubmit={handleAddCustomRunner}
            className="flex flex-wrap items-center gap-2 border-t border-slate-200/70 dark:border-slate-700/70 pt-2"
          >
            <input
              type="text"
              value={customRunnerName}
              onChange={(e) => setCustomRunnerName(e.target.value)}
              placeholder="特殊板件名 (如 PC / Iron Chain)"
              className="bp-input h-8 flex-1 min-w-[140px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs font-bold text-slate-900 dark:text-white"
            />
            <input
              type="number"
              min={1}
              max={200}
              value={customRunnerMax}
              onChange={(e) => setCustomRunnerMax(Number(e.target.value))}
              className="bp-input h-8 w-16 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-center font-mono text-xs font-bold text-slate-900 dark:text-white tabular-nums"
              title="最大零件号"
            />
            <button
              type="submit"
              className="bp-pill h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-coral hover:text-coral transition cursor-pointer"
            >
              + 新增板件
            </button>
          </form>
        </div>
      )}

      {/* 板件标签列 (整枚板件标签统一为单一可点按钮：点选未激活板件切换目标，再次点击当前板件展开/收起指派油漆上色) */}
      {checklist.runners.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {checklist.runners.map((runner) => {
            const isActive = runner.id === activeRunner?.id;
            const usedCount = stats.usedPerRunner.get(runner.id) ?? 0;
            const fg = readableTextColor(runner.colorHex);
            return (
              <button
                key={runner.id}
                type="button"
                onClick={() => {
                  if (isActive) {
                    setIsColorPickerOpen((v) => !v);
                  } else {
                    setActiveRunnerId(runner.id);
                    setSelectedNumbers([]);
                  }
                }}
                className={`bp-runner-chip group relative inline-flex items-center border transition cursor-pointer ${
                  isActive
                    ? "bp-runner-chip-active border-coral bg-coral/10 ring-1 ring-coral/35 shadow-sm"
                    : "border-slate-200/90 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/70 hover:border-slate-300"
                }`}
                title={
                  isActive
                    ? `当前选中 ${runner.id} 板 · 再次点击可展开/收起指派油漆上色`
                    : `点击切换至 ${runner.id} 板${
                        isColorPickerOpen ? "（保持上色面板开启并切换目标）" : ""
                      }`
                }
              >
                <span
                  className="bp-runner-chip-badge flex h-6 min-w-[24px] items-center justify-center px-1.5 font-mono text-xs font-black ring-1 ring-black/15 dark:ring-white/15 shadow-2xs transition group-hover:brightness-110"
                  style={{
                    backgroundColor: runner.colorHex,
                    color: fg,
                  }}
                >
                  {runner.id}
                </span>
                <span className="bp-runner-chip-label flex h-6 items-center gap-1 px-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                  {runner.paintCode && (
                    <span className="max-w-[56px] truncate text-coral font-extrabold">
                      {runner.paintCode}
                    </span>
                  )}
                  <span className="font-mono tabular-nums opacity-75">
                    {usedCount}/{runner.maxNumber}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* 当前锁定装填部位提示条 (外 16px - 内距 8px = 8px 同心取消按钮) */}
      {lockedRegion && (
        <div className="bp-subcard flex items-center justify-between gap-2 rounded-2xl border border-accent/45 bg-accent/10 p-2">
          <div className="flex items-center gap-2 min-w-0">
            <CrosshairIcon
              className="h-4 w-4 text-accent animate-pulse shrink-0"
              weight="bold"
            />
            <div className="min-w-0">
              <div className="truncate text-xs font-black text-slate-900 dark:text-white">
                当前装填：{lockedRegion.title}
              </div>
              <div className="text-[10px] font-semibold text-accent">
                点按下方任意数字，方块直接飞入该部位
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setLockedRegionId(null)}
            className="bp-pill shrink-0 rounded-lg bg-white dark:bg-slate-800 px-2.5 py-1 text-[10px] font-extrabold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:text-coral cursor-pointer"
          >
            取消锁定
          </button>
        </div>
      )}

      {/* 激活板件的数字矩阵池 (1 .. maxNumber) */}
      {activeRunner && (
        <div className="space-y-2.5 border-t border-slate-100 dark:border-slate-800 pt-2.5">
          {/* 激活板件操作栏：左侧板件徽章+色卡名，中部「🎨 指派油漆上色」显式按钮（截图3空白区），右侧件数/划选/删除 */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <span
                className="bp-runner-chip-badge grid h-6 min-w-[26px] place-items-center px-1.5 font-mono text-xs font-black ring-1 ring-black/15 dark:ring-white/15 shrink-0"
                style={{
                  backgroundColor: activeRunner.colorHex,
                  color: readableTextColor(activeRunner.colorHex),
                }}
              >
                {activeRunner.id}
              </span>
              <span className="truncate text-[11px] font-bold text-slate-700 dark:text-slate-200">
                {activeRunner.paintName
                  ? `${activeRunner.paintCode ?? ""} ${activeRunner.paintName}`.trim()
                  : "未绑定指派色卡"}
              </span>

              {/* 截图3中部空白区固定入口按钮：一键展开/收起本项目指派油漆上色 */}
              <button
                type="button"
                onClick={() => setIsColorPickerOpen((v) => !v)}
                aria-expanded={isColorPickerOpen}
                className={`bp-pill bp-runner-paint-trigger inline-flex h-6 items-center gap-1 rounded-md border px-2 text-[10px] font-extrabold transition cursor-pointer shrink-0 ${
                  isColorPickerOpen
                    ? "bp-pill-active border-coral bg-coral text-white shadow-xs"
                    : "border-coral/45 bg-coral/10 text-coral hover:bg-coral/20 hover:border-coral"
                }`}
                title="使用本项目已指派的油漆色卡为当前板件（或已选局部零件）上色"
              >
                <PaletteIcon className="h-3.5 w-3.5 shrink-0" weight="bold" />
                <span>
                  {isColorPickerOpen
                    ? "收起指派色卡"
                    : selectedNumbers.length > 0
                    ? `为已选 ${selectedNumbers.length} 件分色上色`
                    : activeRunner.paintName || activeRunner.paintCode
                    ? "更换/同板分色上色"
                    : "指派油漆上色"}
                </span>
              </button>

              {(activeRunner.paintName ||
                activeRunner.paintCode ||
                (activeRunner.partColors &&
                  Object.keys(activeRunner.partColors).length > 0) ||
                normalizeRunnerHex(activeRunner.colorHex) !==
                  DEFAULT_RUNNER_COLOR) && (
                <button
                  type="button"
                  onClick={() => handleResetRunnerColor(activeRunner.id)}
                  className="bp-pill inline-flex h-6 items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:border-coral hover:text-coral transition cursor-pointer shrink-0"
                  title="清除当前板件绑定的全部色卡（含同板多色分色）并恢复默认状态"
                >
                  <ArrowCounterClockwiseIcon className="h-3 w-3 shrink-0" weight="bold" />
                  <span>清除色卡</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <label className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400">
                <span>件数</span>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={activeRunner.maxNumber}
                  onChange={(e) =>
                    handleUpdateRunnerMax(
                      activeRunner.id,
                      Number(e.target.value)
                    )
                  }
                  className="bp-input h-6 w-12 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-center font-mono text-[11px] font-bold text-slate-700 dark:text-slate-200 tabular-nums"
                />
              </label>
              <button
                type="button"
                onClick={() => setLassoSwipeMode((v) => !v)}
                aria-pressed={lassoSwipeMode}
                className={`inline-flex h-6 items-center gap-1 rounded-md border px-2 text-[10px] font-bold transition cursor-pointer ${
                  lassoSwipeMode
                    ? "bp-pill-active border-coral bg-coral text-white"
                    : "bp-pill border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                }`}
                title="触屏可开启滑动连选：手指直接从 22 划到 24"
              >
                <span>划选</span>
              </button>
              <button
                type="button"
                onClick={() => handleDeleteRunner(activeRunner.id)}
                className="bp-icon-btn bp-icon-btn-danger inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-500 transition cursor-pointer"
                title={`删除板件 ${activeRunner.id}`}
              >
                <TrashIcon className="h-3.5 w-3.5" weight="bold" />
              </button>
            </div>
          </div>

          {/* 同板多色分色条带概览（当万代多色成型板存在局部零件分色时直接展示各色区，点击可框选该色区号码，点击 × 可撤销该分色） */}
          {(() => {
            const activeBands = getRunnerColorBands(activeRunner);
            if (activeBands.length <= 1) return null;
            return (
              <div className="bp-subcard bp-paint-scope-bar flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/50 px-2.5 py-1.5 text-[10px]">
                <span className="font-extrabold text-slate-500 dark:text-slate-400">
                  {activeRunner.id} 板多色分区 ({activeBands.length}色):
                </span>
                {activeBands.map((band) => {
                  const paintText = [band.paintCode, band.paintName]
                    .filter(Boolean)
                    .join(" ");
                  const rangeLabel = band.isBase
                    ? `主底色 (${band.numbers.length}件)`
                    : `#${summarizeSelectedNumbers(band.numbers)} (${band.numbers.length}件)`;
                  return (
                    <span
                      key={band.key}
                      className="bp-pill bp-paint-band-chip inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 py-0.5 font-bold text-slate-700 dark:text-slate-200"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedNumbers(band.numbers);
                          setPaintAssignScope("selected");
                        }}
                        className="inline-flex items-center gap-1 hover:text-coral transition cursor-pointer"
                        title={`点击选中该色区的 ${band.numbers.length} 个零件号`}
                      >
                        <span
                          className="bp-mini-swatch h-2.5 w-2.5 rounded-xs border border-black/15 dark:border-white/15 shrink-0"
                          style={{ backgroundColor: band.colorHex }}
                        />
                        <span className="font-mono">{rangeLabel}</span>
                        {paintText && (
                          <span className="max-w-[96px] truncate text-coral font-extrabold">
                            {paintText}
                          </span>
                        )}
                      </button>
                      {!band.isBase && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleClearRunnerPartColors(
                              activeRunner.id,
                              band.numbers
                            );
                          }}
                          className="ml-0.5 rounded-xs p-0.5 text-slate-400 hover:bg-rose-500/15 hover:text-rose-500 transition cursor-pointer"
                          title={`清除 #${summarizeSelectedNumbers(band.numbers)} 的局部分色，恢复为主底色`}
                        >
                          <XIcon className="h-2.5 w-2.5" weight="bold" />
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>
            );
          })()}

          {/* 板件指派油漆上色面板（仅展示本项目已指派油漆；支持整板上色与万代多色成型板局部零件分色） */}
          {isColorPickerOpen && (
            <div className="bp-subcard-lg bp-paint-assign-panel rounded-2xl border border-coral/40 bg-slate-50/90 dark:bg-slate-800/70 p-3 shadow-sm space-y-2.5 animate-fadeIn">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                  <PaletteIcon className="h-4 w-4 text-coral shrink-0" weight="bold" />
                  <span className="text-xs font-black text-slate-900 dark:text-white">
                    {selectedNumbers.length > 0 && paintAssignScope === "selected"
                      ? `为「${activeRunner.id} 板 · 已选 #${summarizeSelectedNumbers(selectedNumbers)} (${selectedNumbers.length}件)」局部多色上色`
                      : `为「${activeRunner.id} 板」指派项目油漆上色`}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400">
                    （可框选号码做万代多色成型板同板分色，或点选上方其他板件切换目标）
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {projectPaints.length > 0 &&
                    (onNavigateToPaintTab || onNavigateToColoringStudio) && (
                      <button
                        type="button"
                        onClick={() => {
                          if (onNavigateToPaintTab) {
                            onNavigateToPaintTab();
                          } else if (onNavigateToColoringStudio) {
                            onNavigateToColoringStudio();
                          }
                        }}
                        className="bp-pill inline-flex h-6 items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:border-coral hover:text-coral transition cursor-pointer"
                        title="前往指派油漆详情页查看或添加更多色卡"
                      >
                        <PlusIcon className="h-3 w-3" weight="bold" />
                        <span>去指派更多颜色</span>
                      </button>
                    )}
                  <button
                    type="button"
                    onClick={() => setIsColorPickerOpen(false)}
                    className="bp-icon-btn grid h-6 w-6 place-items-center rounded-lg text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-700 cursor-pointer"
                    title="收起指派油漆面板"
                  >
                    <XIcon className="h-3.5 w-3.5" weight="bold" />
                  </button>
                </div>
              </div>

              {/* 多色成型板 / 局部零件分色作用域切换条 */}
              {selectedNumbers.length > 0 ? (
                <div className="bp-subcard bp-paint-scope-bar flex flex-wrap items-center justify-between gap-2 rounded-xl border border-coral/30 bg-white/85 dark:bg-slate-900/75 px-2.5 py-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400">
                      上色范围：
                    </span>
                    <button
                      type="button"
                      onClick={() => setPaintAssignScope("selected")}
                      className={`bp-pill inline-flex h-6 items-center gap-1 rounded-md border px-2 text-[10px] font-extrabold transition cursor-pointer ${
                        paintAssignScope === "selected"
                          ? "bp-pill-active border-coral bg-coral text-white"
                          : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      <span>
                        🎯 仅已选零件 #{summarizeSelectedNumbers(selectedNumbers)} ({selectedNumbers.length}件)
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaintAssignScope("runner")}
                      className={`bp-pill inline-flex h-6 items-center gap-1 rounded-md border px-2 text-[10px] font-extrabold transition cursor-pointer ${
                        paintAssignScope === "runner"
                          ? "bp-pill-active border-coral bg-coral text-white"
                          : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      <span>整板主底色（{activeRunner.id} 全板）</span>
                    </button>
                  </div>

                  {activeRunner.partColors &&
                    selectedNumbers.some((n) => Boolean(activeRunner.partColors?.[n])) && (
                      <button
                        type="button"
                        onClick={() =>
                          handleClearRunnerPartColors(
                            activeRunner.id,
                            selectedNumbers
                          )
                        }
                        className="bp-pill inline-flex h-6 items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 text-[10px] font-bold text-slate-500 hover:border-coral hover:text-coral transition cursor-pointer"
                      >
                        <ArrowCounterClockwiseIcon className="h-3 w-3" weight="bold" />
                        <span>恢复所选为主底色</span>
                      </button>
                    )}
                </div>
              ) : (
                <div className="bp-subcard bp-paint-scope-bar flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/75 dark:border-slate-700/75 bg-white/70 dark:bg-slate-900/50 px-2.5 py-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                  <span>
                    💡 <strong>万代多色成型板 / 同板分色：</strong>先在下方数字矩阵点选或滑动框选零件号（如 7~12），再点按色卡即可只为选中号码赋色。
                  </span>
                </div>
              )}

              {projectPaints.length === 0 ? (
                <div className="bp-dashed-box rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 p-3.5 text-center space-y-2.5">
                  <div className="space-y-0.5">
                    <p className="text-xs font-black text-slate-700 dark:text-slate-200">
                      当前工程尚未指派任何油漆色卡
                    </p>
                    <p className="text-[11px] text-slate-400">
                      先在工程中指派好油漆色卡后，即可在此处一键为各块板件绑定对应颜色。
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {onNavigateToPaintTab && (
                      <button
                        type="button"
                        onClick={onNavigateToPaintTab}
                        className="bp-pill-active inline-flex items-center gap-1.5 rounded-xl bg-coral px-3 py-1.5 text-xs font-black text-white shadow-xs hover:brightness-110 transition cursor-pointer"
                      >
                        <PaletteIcon className="h-3.5 w-3.5" weight="bold" />
                        <span>前往「指派油漆详情」添加色卡 →</span>
                      </button>
                    )}
                    {onNavigateToColoringStudio && (
                      <button
                        type="button"
                        onClick={onNavigateToColoringStudio}
                        className="bp-pill inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-coral hover:text-coral transition cursor-pointer"
                      >
                        <SparkleIcon className="h-3.5 w-3.5 text-coral" weight="fill" />
                        <span>前往「试色改色」拾色指派 →</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5">
                  {projectPaints.map((sw) => {
                    const isTargetingSelection =
                      selectedNumbers.length > 0 && paintAssignScope === "selected";
                    const isCurrentBound = isTargetingSelection
                      ? selectedNumbers.every((n) => {
                          const pInfo = getRunnerPartPaintInfo(activeRunner, n);
                          return (
                            pInfo.paintCode === sw.code &&
                            pInfo.paintName === sw.name &&
                            normalizeRunnerHex(pInfo.colorHex) ===
                              normalizeRunnerHex(sw.hex)
                          );
                        })
                      : activeRunner.paintCode === sw.code &&
                        activeRunner.paintName === sw.name &&
                        normalizeRunnerHex(activeRunner.colorHex) ===
                          normalizeRunnerHex(sw.hex);
                    const usedByRunners = checklist.runners
                      .filter(
                        (r) =>
                          (r.paintCode === sw.code && r.paintName === sw.name) ||
                          (r.partColors &&
                            Object.keys(r.partColors).some((k) => {
                              const ov = r.partColors?.[Number(k)];
                              return (
                                ov?.paintCode === sw.code && ov?.paintName === sw.name
                              );
                            }))
                      )
                      .map((r) => r.id);

                    return (
                      <button
                        key={sw.key}
                        type="button"
                        onClick={() =>
                          handleBindRunnerColor(
                            activeRunner.id,
                            sw.hex,
                            {
                              brand: sw.brand,
                              code: sw.code,
                              name: sw.name,
                            },
                            isTargetingSelection ? selectedNumbers : undefined
                          )
                        }
                        className={`bp-subcard bp-paint-assign-card flex items-center justify-between gap-2 rounded-xl border px-2.5 py-2 text-left transition cursor-pointer ${
                          isCurrentBound
                            ? "bp-subcard-active bp-paint-assign-card-active border-coral bg-coral/15 text-slate-900 dark:text-white ring-1 ring-coral/40"
                            : "border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-coral"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="bp-mini-swatch h-6 w-6 rounded-lg border border-black/15 dark:border-white/15 shrink-0 shadow-2xs"
                            style={{ backgroundColor: sw.hex }}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1 text-[11px] font-black text-slate-900 dark:text-white truncate">
                              <span>{localizedBrand(sw.brand, lang)}</span>
                              <span className="font-mono text-coral">
                                {sw.code}
                              </span>
                            </div>
                            <div className="truncate text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                              {sw.name}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          {isCurrentBound ? (
                            <span className="bp-paint-bound-badge inline-flex items-center gap-0.5 rounded-md bg-coral px-1.5 py-0.5 text-[10px] font-black text-white">
                              <CheckIcon className="h-2.5 w-2.5" weight="bold" />
                              <span>{isTargetingSelection ? "所选已用" : "当前主色"}</span>
                            </span>
                          ) : usedByRunners.length > 0 ? (
                            <span className="font-mono text-[10px] font-bold text-slate-400">
                              已绑: {usedByRunners.join(",")}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-coral opacity-80">
                              {isTargetingSelection ? "分色上色" : "点按上色"}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 堆叠移动方块包 (Stack Badge — 外层 p-2 + 内层同心嵌合) */}
          {selectedNumbers.length > 0 && (
            <div className="bp-subcard flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-coral/35 bg-coral/10 p-2 animate-fadeIn">
              {/* 可拖拽的扑克牌叠影堆叠包 */}
              <div
                onPointerDown={(e) => {
                  e.preventDefault();
                  startStackDragOnly(
                    activeRunner,
                    selectedNumbers,
                    e.clientX,
                    e.clientY
                  );
                }}
                style={{ touchAction: "none" }}
                className="relative inline-flex items-center gap-2 cursor-grab active:cursor-grabbing select-none"
                title="按住拖入下方任意身体部位栏位"
              >
                <div className="relative flex items-center">
                  {selectedNumbers.length > 1 && (
                    <span
                      className="bp-stack-shadow absolute -right-1 -bottom-1 h-full w-full opacity-50"
                      style={{
                        backgroundColor: shadeHex(
                          getRunnerPartColorHex(activeRunner, selectedNumbers[0]),
                          0.15
                        ),
                      }}
                    />
                  )}
                  <span
                    className="bp-stack-card relative inline-flex items-center gap-1.5 p-1 pl-2 font-mono text-xs font-black"
                    style={{
                      backgroundColor: getRunnerPartColorHex(
                        activeRunner,
                        selectedNumbers[0]
                      ),
                      color: readableTextColor(
                        getRunnerPartColorHex(activeRunner, selectedNumbers[0])
                      ),
                    }}
                  >
                    <span>{activeRunner.id}</span>
                    <span className="bp-stack-count px-1.5 py-0.5 text-[10px] font-black tabular-nums">
                      {selectedNumbers.length}件
                    </span>
                  </span>
                </div>
                <span className="max-w-[140px] truncate font-mono text-[11px] font-bold text-slate-700 dark:text-slate-200">
                  {summarizeSelectedNumbers(selectedNumbers)}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setPaintAssignScope("selected");
                    setIsColorPickerOpen(true);
                  }}
                  className="bp-pill inline-flex items-center gap-1 rounded-lg border border-coral/50 bg-white dark:bg-slate-900 px-2.5 py-1 text-[10px] font-extrabold text-coral hover:bg-coral hover:text-white transition cursor-pointer"
                  title="为当前框选的零件号单独指派颜色（适用万代多色成型板 / 同板分色）"
                >
                  <PaletteIcon className="h-3 w-3" weight="bold" />
                  <span>为选中 {selectedNumbers.length} 件分色上色</span>
                </button>
                {lockedRegion ? (
                  <button
                    type="button"
                    onClick={handleSendStackToLocked}
                    className="bp-pill-active inline-flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1 text-[11px] font-black text-white shadow-sm cursor-pointer"
                  >
                    <LightningIcon className="h-3 w-3" weight="fill" />
                    <span>飞入「{lockedRegion.title}」</span>
                  </button>
                ) : (
                  <span className="text-[10px] font-bold text-coral">
                    或拖至下方部位
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedNumbers([])}
                  className="bp-pill rounded-lg bg-white/80 dark:bg-slate-800 px-2 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                >
                  清空
                </button>
              </div>
            </div>
          )}

          {/* 数字矩阵网格 */}
          <div
            ref={gridRef}
            style={{
              touchAction: lassoSwipeMode ? "none" : "pan-y",
            }}
            className="grid grid-cols-[repeat(auto-fill,minmax(36px,1fr))] gap-1.5 select-none"
          >
            {Array.from(
              { length: activeRunner.maxNumber },
              (_, i) => i + 1
            ).map((num) => {
              const isSelected = selectedNumbers.includes(num);
              const assignedTo = activeRunnerUsage?.get(num);
              const isUsed = Boolean(assignedTo && assignedTo.length > 0);
              const tileHex = getRunnerPartColorHex(activeRunner, num);
              const tilePaint = getRunnerPartPaintInfo(activeRunner, num);
              const tilePaintLabel = [tilePaint.paintCode, tilePaint.paintName]
                .filter(Boolean)
                .join(" ");
              const fg = readableTextColor(tileHex);
              return (
                <button
                  key={num}
                  type="button"
                  data-part-num={num}
                  onDragStart={(e) => e.preventDefault()}
                  onPointerDown={(e) => handleTilePointerDown(num, e)}
                  onClick={(e) => handleTileClick(num, e)}
                  style={{
                    backgroundColor: tileHex,
                    color: fg,
                    WebkitTouchCallout: "none",
                  }}
                  title={
                    isUsed
                      ? `${activeRunner.id}${num}${
                          tilePaintLabel ? ` (${tilePaintLabel})` : ""
                        } · ✓ 已分配至：${assignedTo!.join("、")}`
                      : `${activeRunner.id}${num}${
                          tilePaintLabel ? ` (${tilePaintLabel})` : ""
                        } · ${
                          lockedRegion
                            ? `点按飞入「${lockedRegion.title}」`
                            : "点选或划选可拖入部位，或单独分色上色"
                        }`
                  }
                  className={`bp-matrix-cell bp-matrix-tile relative grid h-9 place-items-center font-mono text-xs font-extrabold tabular-nums transition cursor-pointer ${
                    isSelected
                      ? "bp-matrix-cell-active z-10"
                      : isUsed
                      ? "bp-matrix-tile-used opacity-55 hover:opacity-95"
                      : "bp-matrix-tile-idle"
                  }`}
                >
                  <span>{num}</span>
                  {isUsed && (
                    <span
                      aria-hidden
                      className="bp-used-dot absolute right-0.5 top-0.5 inline-flex h-3 w-3 items-center justify-center rounded-[3px] bg-emerald-500 text-[8px] font-black leading-none text-white shadow-2xs ring-1 ring-black/20"
                    >
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* 矩阵角标图例说明 + 操作提示 */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400 leading-relaxed">
            <div className="inline-flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1 font-semibold text-slate-500 dark:text-slate-400">
                <span className="bp-used-dot inline-flex h-3 w-3 items-center justify-center rounded-[3px] bg-emerald-500 text-[8px] font-black leading-none text-white ring-1 ring-black/20">
                  ✓
                </span>
                <span>右上角绿标 = 该零件已分配至下方身体部位（悬停可看具体部位）</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="bp-legend-swatch inline-block h-2.5 w-2.5 rounded-xs border-2 border-coral bg-coral/20" />
                <span>外框高亮 = 当前框选（可拖入部位，或点「分色上色」做万代多色成型板局部上色）</span>
              </span>
            </div>
            <span>
              提示：按住数字可滑动连选；先点亮部位「🎯 装填」再点数字可连发飞入。
            </span>
          </div>
        </div>
      )}
    </div>
  );

  const bodyRegionsNode = (
    <div ref={regionsContainerRef} className="space-y-3 min-w-0">
      {/* 分拣槽顶部操作条：添加部位 + 显示模式（列表两栏 / 画廊小中大框） + 连号自动合并 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowAddRegionMenu((v) => !v)}
              className="bp-pill-active inline-flex items-center gap-1 rounded-full bg-slate-900 dark:bg-white px-3 py-1.5 text-xs font-black text-white dark:text-slate-900 shadow-sm transition cursor-pointer whitespace-nowrap"
            >
              <PlusIcon className="h-3.5 w-3.5" weight="bold" />
              <span>添加身体部位</span>
            </button>

            {showAddRegionMenu && (
              <>
                <div
                  className="fixed inset-0 z-[80]"
                  onClick={() => setShowAddRegionMenu(false)}
                />
                <div className="bp-subcard-lg absolute left-0 top-full mt-2 z-[90] w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 shadow-2xl space-y-2">
                  <input
                    type="text"
                    value={newRegionTitle}
                    onChange={(e) => setNewRegionTitle(e.target.value)}
                    placeholder="可选自定义部位名（如 武器/浮游炮）"
                    className="bp-input h-8 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 text-xs font-bold text-slate-900 dark:text-white"
                  />
                  <div className="grid grid-cols-2 gap-1 max-h-60 overflow-y-auto pr-0.5">
                    {REGION_CATEGORY_ORDER.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() =>
                          handleAddRegion(cat, newRegionTitle.trim() || undefined)
                        }
                        className="bp-menu-item flex items-center gap-2 rounded-xl px-2 py-1.5 text-left text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-coral/10 hover:text-coral transition cursor-pointer"
                      >
                        <RegionIcon category={cat} className="h-4 w-4 shrink-0" />
                        <span className="truncate">
                          {REGION_CATEGORY_META[cat].label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={handleAddMechaTemplate}
            className="bp-pill inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-coral hover:text-coral transition cursor-pointer whitespace-nowrap"
          >
            <SparkleIcon className="h-3.5 w-3.5 text-coral" weight="fill" />
            <span>补齐机甲部位</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* 显示模式切换：列表 (左右两栏) vs 画廊 (小/中/大框) */}
          <div
            className="bp-segmented inline-flex rounded-full border border-slate-200/80 dark:border-slate-700 bg-slate-100/90 dark:bg-slate-800/90 p-0.5"
            aria-label="身体部位显示模式"
          >
            <button
              type="button"
              onClick={() => setRegionViewMode("list")}
              aria-pressed={regionViewMode === "list"}
              className={`bp-segmented-item inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition cursor-pointer whitespace-nowrap ${
                regionViewMode === "list"
                  ? "bp-segmented-item-active bg-coral text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
              title="双栏列表显示（左右各两栏分拣）"
            >
              <ListIcon className="h-3.5 w-3.5 shrink-0" weight="bold" />
              <span>列表</span>
            </button>
            <button
              type="button"
              onClick={() => setRegionViewMode("gallery")}
              aria-pressed={regionViewMode === "gallery"}
              className={`bp-segmented-item inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition cursor-pointer whitespace-nowrap ${
                regionViewMode === "gallery"
                  ? "bp-segmented-item-active bg-coral text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
              title="画廊相框显示（每个画框展示部位与板件胶囊，支持小/中/大尺寸）"
            >
              <SquaresFourIcon className="h-3.5 w-3.5 shrink-0" weight="bold" />
              <span>画廊</span>
            </button>
          </div>

          {regionViewMode === "gallery" && (
            <div
              className="bp-segmented inline-flex rounded-full border border-slate-200/80 dark:border-slate-700 bg-slate-100/90 dark:bg-slate-800/90 p-0.5"
              aria-label="画廊画框尺寸"
            >
              {(
                [
                  { id: "sm", label: "小" },
                  { id: "md", label: "中" },
                  { id: "lg", label: "大" },
                ] as const
              ).map((sz) => {
                const active = gallerySize === sz.id;
                return (
                  <button
                    key={sz.id}
                    type="button"
                    onClick={() => setGallerySize(sz.id)}
                    aria-pressed={active}
                    className={`bp-segmented-item rounded-full px-2 py-1 text-[11px] font-bold transition cursor-pointer whitespace-nowrap ${
                      active
                        ? "bp-segmented-item-active bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                    }`}
                    title={`画廊${sz.label}框模式`}
                  >
                    {sz.label}
                  </button>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={() =>
              mutateChecklist((prev) => ({
                ...prev,
                mergeConsecutive: !prev.mergeConsecutive,
              }))
            }
            className={`bp-pill inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition cursor-pointer whitespace-nowrap ${
              checklist.mergeConsecutive
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500"
            }`}
            title="将同一板件的连续号码（如 22, 23, 24）自动折叠为 22-24"
          >
            <span
              className={`bp-dot h-2 w-2 rounded-full ${
                checklist.mergeConsecutive ? "bg-emerald-500" : "bg-slate-400"
              }`}
            />
            <span>连号自动合并</span>
          </button>
        </div>
      </div>

      {/* 部位卡片网格：列表模式（左右两栏） / 画廊模式（小・中・大画框） */}
      {checklist.regions.length === 0 ? (
        <div className="bp-dashed-box rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 p-6 text-center space-y-2">
          <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
            尚未添加任何身体部位分拣槽
          </p>
          <p className="text-[11px] text-slate-400">
            点击上方「添加身体部位」或「补齐机甲部位」，即可开始分拣零件。
          </p>
        </div>
      ) : (
        <div className={regionGridClassName}>
          {checklist.regions.map((region, idx) => {
            const isLocked = lockedRegionId === region.id;
            const isDropHover = hoveredRegionId === region.id;
            const isJustLanded = justLandedRegionId === region.id;
            const mirrorTargetCat = MIRROR_PAIRS[region.category];
            const groups = groupRegionParts(
              region.parts,
              checklist.runners,
              checklist.mergeConsecutive
            );
            const count = regionPartCount(region);
            const isReplace = Boolean(syntaxReplaceMode[region.id]);
            const selectedSegInRegion =
              activeSegment?.regionId === region.id
                ? activeSegment.segment
                : null;

            // 同心圆角公式 R_inner = R_outer - p：与底部 rounded-xl(12px) 控件及画廊展垫严格同心
            const cardFrameClasses = isGallery
              ? isGallerySm
                ? "rounded-[20px] p-2 gap-2"
                : isGalleryLg
                ? "rounded-[28px] p-4 sm:p-4 gap-3.5"
                : "rounded-3xl p-3 gap-2.5"
              : "rounded-3xl p-3 gap-2.5";

            const borderStateClasses = isDropHover
              ? "bp-region-hover border-coral ring-2 ring-coral/45 bg-coral/5 scale-[1.01] shadow-lg"
              : isLocked
              ? "bp-region-locked border-accent ring-2 ring-accent/35 shadow-md"
              : isJustLanded
              ? "bp-region-landed border-emerald-500 ring-2 ring-emerald-400/40"
              : "border-slate-200/85 dark:border-slate-800";

            const capsulesMarkup =
              groups.length === 0 ? (
                <div
                  className={`bp-dashed-box rounded-xl border border-dashed px-3 py-3 text-center text-[11px] transition ${
                    isDropHover
                      ? "bp-dashed-box-hover border-coral bg-coral/10 font-bold text-coral"
                      : "border-slate-200 dark:border-slate-800 text-slate-400"
                  }`}
                >
                  {isDropHover
                    ? "松手即可放入当前部位"
                    : isGallerySm
                    ? "拖入堆叠包或点亮装填"
                    : "拖入上方堆叠包、点亮「装填」后点按数字，或在下方输入语法"}
                </div>
              ) : (
                <div
                  className={`flex flex-wrap ${
                    isGallerySm ? "gap-1" : "gap-1.5"
                  }`}
                >
                  {groups.map((g) => (
                    <RunnerGroupCapsule
                      key={g.runnerId}
                      group={g}
                      runner={runnerMap.get(g.runnerId)}
                      size={isGallerySm ? "sm" : "md"}
                      interactive
                      activeSegmentKey={selectedSegInRegion?.key ?? null}
                      onClick={(seg) => {
                        if (Date.now() < suppressClickUntilRef.current) {
                          return;
                        }
                        setActiveSegment((cur) =>
                          cur &&
                          cur.regionId === region.id &&
                          cur.segment.key === seg.key
                            ? null
                            : { regionId: region.id, segment: seg }
                        );
                      }}
                      onDoubleClick={(seg) =>
                        cycleSegmentBadge(region.id, seg)
                      }
                      onContextMenu={(seg) => cycleSegmentBadge(region.id, seg)}
                      onPointerDown={(seg, e) => {
                        if (longPressSegTimerRef.current) {
                          window.clearTimeout(longPressSegTimerRef.current);
                        }
                        longPressSegOriginRef.current = {
                          x: e.clientX,
                          y: e.clientY,
                        };
                        longPressSegTimerRef.current = window.setTimeout(() => {
                          longPressSegTimerRef.current = null;
                          suppressClickUntilRef.current = Date.now() + 260;
                          cycleSegmentBadge(region.id, seg);
                        }, 480);
                      }}
                      onPointerMove={(_seg, e) => {
                        const origin = longPressSegOriginRef.current;
                        if (!origin || !longPressSegTimerRef.current) {
                          return;
                        }
                        if (
                          Math.hypot(
                            e.clientX - origin.x,
                            e.clientY - origin.y
                          ) > 6
                        ) {
                          window.clearTimeout(longPressSegTimerRef.current);
                          longPressSegTimerRef.current = null;
                        }
                      }}
                      onPointerUp={() => {
                        longPressSegOriginRef.current = null;
                        if (longPressSegTimerRef.current) {
                          window.clearTimeout(longPressSegTimerRef.current);
                          longPressSegTimerRef.current = null;
                        }
                      }}
                    />
                  ))}
                </div>
              );

            return (
              <div
                key={region.id}
                data-region-drop-id={region.id}
                className={`bp-subcard flex h-full min-w-0 flex-col justify-between border bg-white dark:bg-slate-900 transition-all duration-150 ${cardFrameClasses} ${borderStateClasses}`}
              >
                {/* 部位头：Icon + 标题 + 件数 + 装填锁定 + 镜像 + 排序删除 */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`bp-region-icon grid shrink-0 place-items-center rounded-xl transition ${
                        isGallerySm
                          ? "h-7 w-7"
                          : isGalleryLg
                          ? "h-9 w-9"
                          : "h-8 w-8"
                      } ${
                        isLocked
                          ? "bp-region-icon-active bg-accent text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                      }`}
                    >
                      <RegionIcon
                        category={region.category}
                        className={
                          isGallerySm
                            ? "h-4 w-4"
                            : isGalleryLg
                            ? "h-5 w-5"
                            : "h-[18px] w-[18px]"
                        }
                      />
                    </span>

                    {editingRegionId === region.id ? (
                      <input
                        type="text"
                        value={editingRegionTitle}
                        onChange={(e) => setEditingRegionTitle(e.target.value)}
                        onBlur={() => handleSaveRegionTitle(region.id)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && handleSaveRegionTitle(region.id)
                        }
                        autoFocus
                        className="bp-input h-7 rounded-lg border border-coral bg-white dark:bg-slate-800 px-2 text-xs font-black text-slate-900 dark:text-white"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRegionId(region.id);
                          setEditingRegionTitle(region.title);
                        }}
                        className="group flex items-center gap-1 min-w-0 text-left cursor-pointer"
                        title="点击修改部位名称"
                      >
                        <h4
                          className={`truncate font-black text-slate-900 dark:text-white ${
                            isGallerySm
                              ? "text-xs"
                              : isGalleryLg
                              ? "text-sm sm:text-[15px]"
                              : "text-xs sm:text-sm"
                          }`}
                        >
                          {region.title}
                        </h4>
                        <PencilSimpleIcon className="h-3 w-3 text-slate-400 opacity-0 group-hover:opacity-100 transition shrink-0" />
                      </button>
                    )}

                    <span className="bp-badge rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                      {count}件
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1">
                    {/* 目标锁定按钮 */}
                    <button
                      type="button"
                      aria-pressed={isLocked}
                      onClick={() =>
                        setLockedRegionId((cur) =>
                          cur === region.id ? null : region.id
                        )
                      }
                      className={`inline-flex items-center gap-1 rounded-full font-extrabold transition cursor-pointer whitespace-nowrap ${
                        isGallerySm
                          ? "h-6 px-2 text-[10px]"
                          : "h-7 px-2.5 text-[11px]"
                      } ${
                        isLocked
                          ? "bp-pill-active bg-accent text-white shadow-sm"
                          : "bp-pill border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-accent hover:text-accent"
                      }`}
                      title="点亮后，点击上方任意数字直接飞入此部位"
                    >
                      <CrosshairIcon className="h-3.5 w-3.5 shrink-0" weight="bold" />
                      <span>{isLocked ? "装填中" : "装填"}</span>
                    </button>

                    {/* 左右手/左右腿一键镜像克隆 */}
                    {mirrorTargetCat && (
                      <button
                        type="button"
                        onClick={() => handleMirrorRegion(region)}
                        className={`bp-pill inline-flex items-center gap-1 rounded-full border border-coral/35 bg-coral/10 font-extrabold text-coral hover:bg-coral hover:text-white transition cursor-pointer whitespace-nowrap ${
                          isGallerySm
                            ? "h-6 px-2 text-[10px]"
                            : "h-7 px-2.5 text-[11px]"
                        }`}
                        title={`将当前整组零件一键克隆至「${REGION_CATEGORY_META[mirrorTargetCat].label}」`}
                      >
                        <ArrowsLeftRightIcon
                          className="h-3.5 w-3.5 shrink-0"
                          weight="bold"
                        />
                        <span>
                          {isGallerySm
                            ? "镜像"
                            : `克隆至${
                                mirrorTargetCat.endsWith("_l") ? "左侧" : "右侧"
                              }`}
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveRegion(idx, -1)}
                      className={`bp-icon-btn grid place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 disabled:opacity-30 cursor-pointer ${
                        isGallerySm ? "h-6 w-6" : "h-7 w-7"
                      }`}
                      title="上移"
                    >
                      <ArrowUpIcon className="h-3.5 w-3.5" weight="bold" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === checklist.regions.length - 1}
                      onClick={() => handleMoveRegion(idx, 1)}
                      className={`bp-icon-btn grid place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 disabled:opacity-30 cursor-pointer ${
                        isGallerySm ? "h-6 w-6" : "h-7 w-7"
                      }`}
                      title="下移"
                    >
                      <ArrowDownIcon className="h-3.5 w-3.5" weight="bold" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteRegion(region.id)}
                      className={`bp-icon-btn bp-icon-btn-danger grid place-items-center rounded-lg text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-500 cursor-pointer ${
                        isGallerySm ? "h-6 w-6" : "h-7 w-7"
                      }`}
                      title="删除该部位"
                    >
                      <TrashIcon className="h-3.5 w-3.5" weight="bold" />
                    </button>
                  </div>
                </div>

                {/* 零件展示主体（画廊模式采用 .bp-gallery-mat 画框展垫，列表模式直接流式排列） */}
                {isGallery ? (
                  <div
                    className={`bp-gallery-mat flex flex-1 flex-col ${
                      groups.length === 0 ? "justify-center" : "justify-start"
                    } border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/75 dark:bg-slate-800/45 rounded-xl ${
                      isGallerySm
                        ? "p-2 min-h-[58px]"
                        : isGalleryLg
                        ? "p-3.5 min-h-[120px]"
                        : "p-2.5 min-h-[84px]"
                    }`}
                  >
                    {capsulesMarkup}
                  </div>
                ) : (
                  <div className="flex-1">{capsulesMarkup}</div>
                )}

                {/* 选中片段角标操作栏 */}
                {selectedSegInRegion && (
                  <div className="bp-subcard flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1.5 text-[11px] animate-fadeIn">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="font-mono font-black text-slate-700 dark:text-slate-200 mr-1">
                        {selectedSegInRegion.runnerId}{" "}
                        {formatSegment(selectedSegInRegion)}：
                      </span>
                      {BADGE_CYCLE.map((b) => {
                        const active = selectedSegInRegion.badge === b;
                        return (
                          <button
                            key={b ?? "none"}
                            type="button"
                            aria-pressed={active}
                            onClick={() => {
                              setSegmentBadge(
                                region.id,
                                selectedSegInRegion.partIds,
                                b
                              );
                              setActiveSegment({
                                regionId: region.id,
                                segment: { ...selectedSegInRegion, badge: b },
                              });
                            }}
                            className={`bp-badge-opt px-2 py-0.5 font-mono text-[11px] font-bold transition cursor-pointer ${
                              active ? "bp-badge-opt-active" : ""
                            }`}
                            title={b ? BADGE_META[b].hint : "无角标"}
                          >
                            {b ?? "无"}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          removeSegmentParts(
                            region.id,
                            selectedSegInRegion.partIds
                          )
                        }
                        className="bp-pill bp-danger-pill inline-flex items-center gap-1 rounded-md bg-rose-500/15 px-2 py-0.5 text-[11px] font-bold text-rose-600 hover:bg-rose-500 hover:text-white transition cursor-pointer"
                      >
                        <TrashIcon className="h-3 w-3" weight="bold" />
                        <span>移除</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveSegment(null)}
                        className="bp-icon-btn grid h-6 w-6 place-items-center rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                      >
                        <XIcon className="h-3 w-3" weight="bold" />
                      </button>
                    </div>
                  </div>
                )}

                {/* 极速语法指令条 */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleApplySyntax(region);
                  }}
                  className="mt-auto flex flex-wrap items-center gap-1.5 pt-0.5"
                >
                  <div
                    className={`relative flex-1 ${
                      isGallerySm ? "min-w-[110px]" : "min-w-[150px]"
                    }`}
                  >
                    <KeyboardIcon
                      className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400"
                      weight="bold"
                    />
                    <input
                      type="text"
                      value={syntaxDrafts[region.id] ?? ""}
                      onChange={(e) => {
                        const nextVal = e.target.value;
                        setSyntaxDrafts((prev) => ({
                          ...prev,
                          [region.id]: nextVal,
                        }));
                        if (!nextVal.trim()) {
                          setSyntaxReplaceMode((prev) => ({
                            ...prev,
                            [region.id]: false,
                          }));
                        }
                      }}
                      placeholder={
                        isGallerySm
                          ? "语法：A5,9 K4-5*2"
                          : "极速语法：A5,9,26 H6,10 K4-5*2 回车"
                      }
                      className={`bp-input w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/70 pl-8 pr-2.5 font-mono text-[11px] font-bold text-slate-800 dark:text-slate-100 placeholder:font-sans placeholder:font-medium placeholder:text-slate-400 focus:border-coral focus:outline-none ${
                        isGallerySm ? "h-7" : "h-8"
                      }`}
                    />
                  </div>
                  {region.parts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSyntaxDrafts((prev) => ({
                          ...prev,
                          [region.id]: regionToSyntax(
                            region,
                            checklist.runners
                          ),
                        }));
                        setSyntaxReplaceMode((prev) => ({
                          ...prev,
                          [region.id]: true,
                        }));
                      }}
                      className={`bp-pill rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:border-coral hover:text-coral transition cursor-pointer whitespace-nowrap shrink-0 ${
                        isGallerySm ? "h-7 px-2" : "h-8 px-2.5"
                      }`}
                      title="回填当前零件语法以便直接修改个别差异号"
                    >
                      {isGallerySm ? "回填" : "回填修改"}
                    </button>
                  )}
                  <button
                    type="submit"
                    className={`bp-pill rounded-xl text-[11px] font-black transition cursor-pointer whitespace-nowrap shrink-0 ${
                      isGallerySm ? "h-7 px-2.5" : "h-8 px-3"
                    } ${
                      isReplace
                        ? "bp-pill-active bg-amber-500 text-white"
                        : "bg-slate-900 dark:bg-slate-700 text-white hover:bg-coral"
                    }`}
                  >
                    {isReplace
                      ? "覆盖更新"
                      : isGallerySm
                      ? "添加"
                      : "解析添加"}
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const groupByToggle = (
    <div
      role="radiogroup"
      aria-label="取件表分组方式"
      className="bp-segmented inline-flex rounded-full bg-slate-100 dark:bg-slate-800 p-1"
    >
      {(
        [
          { id: "region", label: "按部位", Icon: ListIcon, hint: "假组 / 分色喷涂时按部位核对" },
          { id: "runner", label: "按板件", Icon: StackIcon, hint: "开盒剪件时拿起一块板一次剪完" },
        ] as const
      ).map(({ id, label, Icon, hint }) => {
        const active = groupBy === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            title={hint}
            onClick={() => handleSetGroupBy(id)}
            className={`bp-segmented-item inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black transition cursor-pointer whitespace-nowrap ${
              active
                ? "bp-segmented-item-active bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" weight="bold" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );

  const scrollToPosterRegion = (regionId: string) => {
    const el = document.querySelector<HTMLElement>(
      `[data-poster-region-id="${regionId}"]`
    );
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      el.classList.add("ring-2", "ring-coral");
      window.setTimeout(() => {
        el.classList.remove("ring-2", "ring-coral");
      }, 900);
    }
  };

  const scrollToPosterRunner = (runnerId: string) => {
    if (groupBy === "runner") {
      setFocusRunnerId((prev) => (prev === runnerId ? null : runnerId));
      const el = document.querySelector<HTMLElement>(
        `[data-runner-card="${runnerId}"]`
      );
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    } else {
      setFocusRunnerId((prev) => (prev === runnerId ? null : runnerId));
    }
  };

  const filledRegions = useMemo(
    () => checklist.regions.filter((r) => r.parts.length > 0),
    [checklist.regions]
  );

  const completedRegionsCount = useMemo(
    () =>
      filledRegions.filter((r) => {
        const total = regionPartCount(r);
        return total > 0 && regionCutCount(r) >= total;
      }).length,
    [filledRegions]
  );

  const overallCutPct = stats.partsCount
    ? Math.round((stats.cutCount / stats.partsCount) * 100)
    : 0;

  const priorityClearRunners = useMemo(() => {
    return runnerSummary.cards
      .filter((c) => !c.isCleared && c.partCount > 0)
      .map((c) => ({
        ...c,
        remaining: Math.max(0, c.partCount - c.cutCount),
      }))
      .sort((a, b) => a.remaining - b.remaining || a.partCount - b.partCount)
      .slice(0, 4);
  }, [runnerSummary.cards]);

  const focusedRunnerCard = useMemo(
    () =>
      focusRunnerId
        ? runnerSummary.cards.find((c) => c.runnerId === focusRunnerId) ?? null
        : null,
    [runnerSummary.cards, focusRunnerId]
  );

  const topComplexRegions = useMemo(() => {
    return [...filledRegions]
      .map((r) => {
        const runnerCount = new Set(r.parts.map((p) => p.runnerId)).size;
        return {
          region: r,
          runnerCount,
          partCount: regionPartCount(r),
        };
      })
      .sort((a, b) => b.runnerCount - a.runnerCount || b.partCount - a.partCount)
      .slice(0, 4);
  }, [filledRegions]);

  const boundPaintRunnersCount = useMemo(
    () => checklist.runners.filter((r) => Boolean(r.paintCode || r.paintName)).length,
    [checklist.runners]
  );

  const posterLayoutControls = (
    <div className="flex flex-wrap items-center gap-1.5">
      {groupByToggle}
      <div className="bp-segmented inline-flex rounded-full bg-slate-100 dark:bg-slate-800 p-1">
        <button
          type="button"
          onClick={() => setPosterTwoCol(true)}
          className={`bp-segmented-item inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black transition cursor-pointer ${
            posterTwoCol
              ? "bp-segmented-item-active bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
              : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          }`}
          title="双栏一屏高密度排布：无需滚动即可一屏看全整页零件按钮"
        >
          <SquaresFourIcon className="h-3.5 w-3.5" weight="bold" />
          <span>双栏一屏</span>
        </button>
        <button
          type="button"
          onClick={() => setPosterTwoCol(false)}
          className={`bp-segmented-item inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black transition cursor-pointer ${
            !posterTwoCol
              ? "bp-segmented-item-active bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
              : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          }`}
          title="单栏竖版长图排布"
        >
          <ListIcon className="h-3.5 w-3.5" weight="bold" />
          <span>单栏长图</span>
        </button>
      </div>
      <button
        type="button"
        onClick={() => setPosterCompactHeader((v) => !v)}
        className={`bp-pill inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
          posterCompactHeader
            ? "bp-pill-active border-accent/50 bg-accent/10 text-accent"
            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300"
        }`}
        title="切换紧凑顶栏或展开完整实拍封面"
      >
        <ImageSquareIcon className="h-3.5 w-3.5" weight="bold" />
        <span>{posterCompactHeader ? "紧凑顶栏" : "完整封面"}</span>
      </button>
    </div>
  );

  const checkPosterNode = (
    <ChecklistPoster
      checklist={checklist}
      stats={stats}
      title={effectiveTitle}
      subtitle={checklist.subtitle}
      coverSrc={effectiveCoverSrc}
      checkMode
      interactive
      onToggleCut={handleToggleCut}
      groupBy={groupBy}
      onSetPartsCut={handleSetPartsCut}
      onSetRunnerCut={handleSetRunnerCut}
      onSetRegionCut={handleSetRegionCut}
      compactHeader={posterCompactHeader}
      onToggleCompactHeader={() => setPosterCompactHeader((v) => !v)}
      twoColumnBody={posterTwoCol}
      onToggleTwoColumnBody={() => setPosterTwoCol((v) => !v)}
      onlyUncut={onlyUncut}
      highlightRunnerId={focusRunnerId}
      onSelectHighlightRunner={setFocusRunnerId}
      searchQuery={checkSearch}
    />
  );

  const checkRightSidebarNode = (
    <div className="space-y-3">
      {/* 1. 视图控制与快速寻件舱 */}
      <div className="bp-subcard-lg rounded-2xl border border-slate-200/85 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="bp-pool-icon flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-coral/15 text-coral">
              <ScissorsIcon className="h-4 w-4" weight="bold" />
            </span>
            <div className="min-w-0">
              <h4 className="truncate text-xs font-black text-slate-900 dark:text-white">
                剪件指挥台 · 视图与寻件
              </h4>
              <p className="truncate text-[10px] font-semibold text-slate-400">
                左侧一屏点按打勾 · 右侧清板雷达与部位速跳
              </p>
            </div>
          </div>
          <span className="bp-badge shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[11px] font-black tabular-nums text-emerald-600 dark:text-emerald-300">
            {stats.cutCount}/{stats.partsCount} ({overallCutPct}%)
          </span>
        </div>

        {posterLayoutControls}

        {/* 快速寻件搜索 + 仅看未剪开关 */}
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <input
              type="text"
              value={checkSearch}
              onChange={(e) => setCheckSearch(e.target.value)}
              placeholder="搜板件 / 零件号 / 部位（如 A1、B2 14、胸部）"
              className="bp-input h-8 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-3 pr-7 text-xs font-bold text-slate-900 dark:text-white placeholder:font-normal placeholder:text-slate-400 focus:border-coral focus:outline-none"
            />
            {checkSearch && (
              <button
                type="button"
                onClick={() => setCheckSearch("")}
                className="bp-icon-btn absolute right-1.5 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                title="清空搜索"
              >
                <XIcon className="h-3.5 w-3.5" weight="bold" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setOnlyUncut((v) => !v)}
            className={`bp-pill shrink-0 rounded-xl border px-2.5 h-8 text-[11px] font-bold transition cursor-pointer ${
              onlyUncut
                ? "bp-pill-active border-emerald-500 bg-emerald-500 text-white"
                : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300"
            }`}
          >
            {onlyUncut ? "✓ 仅看未剪" : "仅看未剪"}
          </button>
        </div>
      </div>

      {/* 2. 板件清板雷达（解决多板件铺满桌面的痛点） */}
      {runnerSummary.usedRunners > 0 && (
        <div className="bp-subcard-lg rounded-2xl border border-slate-200/85 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-sm space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <LightningIcon className="h-4 w-4 text-amber-500 shrink-0" weight="fill" />
              <h4 className="text-xs font-black text-slate-900 dark:text-white">
                板件清板雷达
              </h4>
              <span className="text-[10px] font-bold text-slate-400">
                （点选板件高亮左侧对应零件）
              </span>
            </div>
            <span className="font-mono text-[11px] font-black tabular-nums text-emerald-600 dark:text-emerald-400">
              已清 {runnerSummary.clearedRunners}/{runnerSummary.usedRunners} 板
            </span>
          </div>

          {/* 优先清板收盒推荐（剩余件数最少的 4 块板） */}
          {priorityClearRunners.length > 0 && (
            <div className="bp-subcard rounded-xl border border-amber-500/25 bg-amber-500/5 dark:bg-amber-500/10 p-2.5 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-bold">
                <span className="text-amber-700 dark:text-amber-300">
                  {stats.cutCount > 0
                    ? "🔥 差几件即可清板收盒（优先剪完腾出桌面）："
                    : "💡 最易清板 Top 4（总件数最少，可优先剪完收盒）："}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {priorityClearRunners.map((c) => {
                  const base = c.runner?.colorHex ?? "#C9CED6";
                  const isFocused = focusRunnerId === c.runnerId;
                  return (
                    <div
                      key={c.runnerId}
                      className={`bp-subcard flex items-center justify-between gap-1.5 rounded-lg border px-2 py-1 text-[11px] ${
                        isFocused
                          ? "border-amber-500 bg-amber-500/15"
                          : "border-slate-200/80 dark:border-slate-700/80 bg-white/90 dark:bg-slate-900/90"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => scrollToPosterRunner(c.runnerId)}
                        className="flex min-w-0 flex-1 items-center gap-1.5 text-left cursor-pointer"
                        title={`点击在左侧高亮 ${c.runnerId} 板全部零件`}
                      >
                        <span
                          className="bp-capsule-tile grid h-5 min-w-[24px] shrink-0 place-items-center rounded px-1 font-mono text-[10px] font-black"
                          style={{
                            backgroundColor: base,
                            color: readableTextColor(base),
                          }}
                        >
                          {c.runnerId}
                        </span>
                        <span className="truncate font-mono text-[10px] font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                          剩 <strong className="text-amber-600 dark:text-amber-400">{c.remaining}</strong> 件
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetRunnerCut(c.runnerId, true)}
                        className="bp-pill shrink-0 rounded-md bg-emerald-500/15 hover:bg-emerald-500 hover:text-white px-1.5 py-0.5 text-[10px] font-black text-emerald-600 dark:text-emerald-300 transition cursor-pointer"
                        title={`将 ${c.runnerId} 板全部零件标记为已剪完`}
                      >
                        清板
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 全部板件实时矩阵 */}
          <div className="flex flex-wrap gap-1.5">
            {runnerSummary.cards.map((c) => {
              const base = c.runner?.colorHex ?? "#C9CED6";
              const pct = Math.round(c.progress * 100);
              const isFocused = focusRunnerId === c.runnerId;
              return (
                <button
                  key={c.runnerId}
                  type="button"
                  onClick={() => scrollToPosterRunner(c.runnerId)}
                  title={`${c.runnerId} 板 · 已剪 ${c.cutCount}/${c.partCount} 件 · 点击高亮筛选`}
                  className={`bp-capsule-shell relative inline-flex items-stretch cursor-pointer transition ${
                    isFocused ? "ring-2 ring-amber-500 scale-105 z-10" : ""
                  } ${c.isCleared ? "opacity-45" : ""}`}
                >
                  <span
                    className="bp-capsule-tile relative grid h-7 min-w-[30px] place-items-center overflow-hidden px-1.5 font-mono text-xs font-black"
                    style={{
                      backgroundColor: base,
                      color: readableTextColor(base),
                    }}
                  >
                    <span>{c.runnerId}</span>
                    <span
                      aria-hidden
                      className="absolute bottom-0 left-0 h-[3px] bg-emerald-400"
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                  <span className="bp-capsule-sub grid place-items-center bg-slate-900 text-slate-200 px-1.5 font-mono text-[10px] font-bold tabular-nums">
                    {c.isCleared ? "✓" : `${c.cutCount}/${c.partCount}`}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 当前聚焦板件快捷操作条 */}
          {focusedRunnerCard && (
            <div className="bp-subcard flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-2.5 py-2">
              <div className="text-[11px] font-bold text-slate-800 dark:text-slate-100">
                已筛选 <strong className="font-mono">{focusedRunnerCard.runnerId}</strong> 板：
                <span className="ml-1 font-mono text-slate-500 dark:text-slate-300">
                  {focusedRunnerCard.cutCount}/{focusedRunnerCard.partCount} 件（跨{" "}
                  {focusedRunnerCard.rows.length} 部位）
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    handleSetRunnerCut(
                      focusedRunnerCard.runnerId,
                      !focusedRunnerCard.isCleared
                    )
                  }
                  className="bp-pill-active rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-black text-white cursor-pointer"
                >
                  {focusedRunnerCard.isCleared ? "撤销整板" : "✓ 整板剪完"}
                </button>
                <button
                  type="button"
                  onClick={() => setFocusRunnerId(null)}
                  className="bp-pill rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  取消筛选
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. 部位进度导航与整部位一键打勾 */}
      {filledRegions.length > 0 && (
        <div className="bp-subcard-lg rounded-2xl border border-slate-200/85 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-sm space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-black text-slate-900 dark:text-white">
              部位速跳与整部位打勾
            </h4>
            <span className="font-mono text-[11px] font-bold tabular-nums text-slate-400">
              已完成 {completedRegionsCount}/{filledRegions.length} 部位
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-1.5 max-h-[290px] overflow-y-auto pr-0.5">
            {filledRegions.map((region) => {
              const total = regionPartCount(region);
              const cut = regionCutCount(region);
              const isDone = total > 0 && cut >= total;
              const pct = total ? Math.round((cut / total) * 100) : 0;
              return (
                <div
                  key={region.id}
                  className={`bp-subcard flex items-center justify-between gap-1.5 rounded-xl border px-2.5 py-1.5 transition ${
                    isDone
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-slate-200/75 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => scrollToPosterRegion(region.id)}
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-left cursor-pointer"
                    title={`点击定位到左侧「${region.title}」`}
                  >
                    <span className="bp-poster-icon grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                      <RegionIcon category={region.category} className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11px] font-black text-slate-800 dark:text-slate-100">
                        {region.title}
                      </div>
                      <div className="font-mono text-[10px] font-semibold text-slate-400 tabular-nums">
                        {cut}/{total}件 · {pct}%
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetRegionCut(region.id, !isDone)}
                    className={`bp-pill shrink-0 rounded-lg px-2 py-1 text-[10px] font-black transition cursor-pointer ${
                      isDone
                        ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/30"
                        : "bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-coral hover:text-white"
                    }`}
                    title={isDone ? "撤销本部位打勾" : "一键标记本部位全部剪完"}
                  >
                    {isDone ? "✓ 完成" : "剪完"}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800 pt-2.5">
            <button
              type="button"
              onClick={handleResetAllCut}
              className="bp-pill inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:border-coral hover:text-coral cursor-pointer"
            >
              <ArrowCounterClockwiseIcon className="h-3.5 w-3.5" weight="bold" />
              <span>重置剪件进度</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadPoster}
              disabled={isExportingPoster}
              className="bp-pill-active inline-flex items-center gap-1 rounded-full bg-coral px-3.5 py-1.5 text-[11px] font-black text-white shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <DownloadSimpleIcon className="h-3.5 w-3.5" weight="bold" />
              <span>{isExportingPoster ? "导出中…" : "导出当前长图"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const posterRightSidebarNode = (
    <div className="space-y-3">
      {/* 1. 导出与版式控制主卡 */}
      <div className="bp-subcard-lg rounded-2xl border border-slate-200/85 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-sm space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="text-xs font-black text-slate-900 dark:text-white">
              海报排版与高清导出工作台
            </h4>
            <p className="mt-0.5 text-[11px] text-slate-400">
              左侧支持一屏直接点按任意零件号打勾；右侧调节标题、实拍封面与导出规格
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDownloadPoster}
          disabled={isExportingPoster}
          className="bp-pill-active flex w-full items-center justify-center gap-2 rounded-xl bg-coral hover:bg-coral/90 py-2.5 px-4 text-xs font-black text-white shadow-sm disabled:opacity-50 cursor-pointer"
        >
          <DownloadSimpleIcon className="h-4 w-4" weight="bold" />
          <span>
            {isExportingPoster
              ? "正在绘制高清海报…"
              : exportColumns === 2
              ? "导出双栏宽幅取件表海报 (1600px .png)"
              : "导出单栏竖版取件表长图 (1080px .png)"}
          </span>
        </button>

        <div className="space-y-1.5">
          <span className="block text-[10px] font-bold text-slate-500">
            导出 PNG 图片版式：
          </span>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                {
                  cols: 2 as const,
                  title: "双栏宽幅海报",
                  sub: "1600px · 一屏高密度总览",
                },
                {
                  cols: 1 as const,
                  title: "单栏竖版长图",
                  sub: "1080px · 适合手机长图分享",
                },
              ] as const
            ).map((opt) => {
              const active = exportColumns === opt.cols;
              return (
                <button
                  key={opt.cols}
                  type="button"
                  onClick={() => setExportColumns(opt.cols)}
                  className={`bp-subcard rounded-xl border p-2 text-left transition cursor-pointer ${
                    active
                      ? "border-coral bg-coral/10 text-coral"
                      : "border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200"
                  }`}
                >
                  <div className="text-xs font-black">{opt.title}</div>
                  <div className="text-[10px] font-semibold opacity-75">{opt.sub}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5 pt-0.5">
          <span className="block text-[10px] font-bold text-slate-500">
            左侧网页预览与分组版式：
          </span>
          {posterLayoutControls}
        </div>
      </div>

      {/* 2. 海报标题与实拍作品封面设置 */}
      <div className="bp-subcard-lg rounded-2xl border border-slate-200/85 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-sm space-y-3">
        <h4 className="text-xs font-black text-slate-900 dark:text-white">
          海报文案与实拍封面
        </h4>
        <div className="grid grid-cols-1 gap-2.5">
          <label className="space-y-1">
            <span className="block text-[10px] font-bold text-slate-500">
              机型大标题
            </span>
            <input
              type="text"
              value={checklist.modelTitle ?? ""}
              onChange={(e) =>
                mutateChecklist((prev) => ({
                  ...prev,
                  modelTitle: e.target.value,
                }))
              }
              placeholder={project.title}
              className="bp-input h-8 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs font-bold text-slate-900 dark:text-white"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-[10px] font-bold text-slate-500">
              比例 / 版本副标题（可选）
            </span>
            <input
              type="text"
              value={checklist.subtitle ?? ""}
              onChange={(e) =>
                mutateChecklist((prev) => ({
                  ...prev,
                  subtitle: e.target.value,
                }))
              }
              placeholder="例如：万代 · MGSD / 1/100 实拍涂装版"
              className="bp-input h-8 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs font-bold text-slate-900 dark:text-white"
            />
          </label>
        </div>

        {/* 封面来源选择 */}
        <div className="space-y-1.5 pt-0.5">
          <span className="block text-[10px] font-bold text-slate-500">
            海报实拍封面（点击切换，展开封面可见完整大图）：
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                mutateChecklist((prev) => ({
                  ...prev,
                  coverImageDataUrl: undefined,
                }))
              }
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold cursor-pointer ${
                !checklist.coverImageDataUrl
                  ? "bp-pill-active bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                  : "bp-pill border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
              }`}
            >
              默认项目封面
            </button>
            {partImagesWithSrc.map(({ part: pt, src }, pIdx) => (
              <button
                key={pt.id}
                type="button"
                onClick={() =>
                  mutateChecklist((prev) => ({
                    ...prev,
                    coverImageDataUrl: src,
                  }))
                }
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold cursor-pointer ${
                  checklist.coverImageDataUrl === src
                    ? "bp-pill-active border-coral bg-coral/10 text-coral"
                    : "bp-pill border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                }`}
              >
                <img src={src} alt="" className="bp-mini-swatch h-4 w-4 rounded object-cover" />
                <span>
                  #{pIdx + 1} {pt.partName.slice(0, 6)}
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => coverUploadRef.current?.click()}
              className="bp-pill inline-flex items-center gap-1 rounded-full border border-dashed border-coral/50 px-2.5 py-1 text-[11px] font-bold text-coral hover:bg-coral/10 cursor-pointer"
            >
              <ImageSquareIcon className="h-3.5 w-3.5" weight="bold" />
              <span>上传实拍封面</span>
            </button>
            <input
              ref={coverUploadRef}
              type="file"
              accept="image/*"
              onChange={handleUploadCover}
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* 3. 清板难度诊断与板件色卡概览 */}
      <div className="bp-subcard-lg rounded-2xl border border-slate-200/85 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-sm space-y-2.5">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-black text-slate-900 dark:text-white">
            清板难度诊断与色卡统计
          </h4>
          {stats.grade && (
            <span
              className="font-mono text-xs font-black"
              style={{ color: gradeInfo?.color ?? "#94A3B8" }}
            >
              [{stats.grade}] {stats.cleanScore}分 · {gradeInfo?.label}
            </span>
          )}
        </div>

        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
          平均每个部位需横跨 <strong className="font-mono text-slate-800 dark:text-white">{stats.avgSpread.toFixed(1)}</strong> 块板件寻件；共{" "}
          <strong className="font-mono text-slate-800 dark:text-white">{checklist.runners.length}</strong> 块板件（其中{" "}
          <strong className="font-mono text-slate-800 dark:text-white">{boundPaintRunnersCount}</strong> 块已绑定色卡名称）。
        </p>

        {topComplexRegions.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-slate-400">
              跨板数最多的部位（点击可在左侧定位）：
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {topComplexRegions.map(({ region, runnerCount, partCount }) => (
                <button
                  key={region.id}
                  type="button"
                  onClick={() => scrollToPosterRegion(region.id)}
                  className="bp-subcard flex items-center justify-between rounded-xl border border-slate-200/75 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 px-2.5 py-1.5 text-left hover:border-coral transition cursor-pointer"
                >
                  <span className="truncate text-[11px] font-black text-slate-800 dark:text-slate-100">
                    {region.title}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                    跨{runnerCount}板·{partCount}件
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {stats.cutCount > 0 && (
          <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-2">
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              当前已标记剪下 {stats.cutCount}/{stats.partsCount} 件
            </span>
            <button
              type="button"
              onClick={handleResetAllCut}
              className="bp-pill inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:border-coral hover:text-coral cursor-pointer"
            >
              <ArrowCounterClockwiseIcon className="h-3 w-3" weight="bold" />
              <span>重置打勾</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const posterPreviewNode = (
    <ChecklistPoster
      checklist={checklist}
      stats={stats}
      title={effectiveTitle}
      subtitle={checklist.subtitle}
      coverSrc={effectiveCoverSrc}
      groupBy={groupBy}
      interactive
      onToggleCut={handleToggleCut}
      onSetPartsCut={handleSetPartsCut}
      onSetRunnerCut={handleSetRunnerCut}
      onSetRegionCut={handleSetRegionCut}
      compactHeader={posterCompactHeader}
      onToggleCompactHeader={() => setPosterCompactHeader((v) => !v)}
      twoColumnBody={posterTwoCol}
      onToggleTwoColumnBody={() => setPosterTwoCol((v) => !v)}
      onlyUncut={onlyUncut}
      highlightRunnerId={focusRunnerId}
      onSelectHighlightRunner={setFocusRunnerId}
      searchQuery={checkSearch}
    />
  );

  // ------------------------------------------------------------------
  // 渲染
  // ------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Toast 提示 + 可选撤销 */}
      {toast && (
        <div className="bp-toast fixed top-5 left-1/2 -translate-x-1/2 z-[120] flex items-center gap-2 rounded-full border border-coral/50 bg-slate-900/95 px-4 py-2 text-xs font-bold text-white shadow-xl backdrop-blur-md">
          <CheckIcon className="h-3.5 w-3.5 text-coral shrink-0" weight="bold" />
          <span>{toast}</span>
          {undoSnapshot && (
            <button
              type="button"
              onClick={() => {
                const snap = undoSnapshot;
                mutateChecklist((prev) =>
                  snap.checklist
                    ? { ...snap.checklist }
                    : { ...prev, regions: snap.regions }
                );
                setUndoSnapshot(null);
                setToast(null);
              }}
              className="bp-pill ml-1 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-black text-amber-300 hover:bg-white/25 cursor-pointer"
            >
              {undoSnapshot.checklist ? "撤销导入" : "撤销覆盖"}
            </button>
          )}
        </div>
      )}

      {useSplitTopLayout ? (
        /* 制作编辑模式（Row 1: 左侧实拍零件舞台 + 右侧子页签/模式栏/板件母池；Row 2: 身体部位分拣槽占满 12 栏消除左侧大块留白） */
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6 lg:items-start">
          <div className="lg:col-span-6 xl:col-span-5 min-w-0">
            {topLeftStage}
          </div>

          <div className="lg:col-span-6 xl:col-span-7 min-w-0 space-y-3.5">
            {topTabBar}
            {checklistHeaderNode}

            {subMode === "edit" && (
              <div className="space-y-3.5">
                {emptyInitCard}
                {runnerPoolNode}
              </div>
            )}
          </div>

          {subMode === "edit" && (
            <div className="lg:col-span-12 min-w-0">{bodyRegionsNode}</div>
          )}
        </div>
      ) : (
        /* 剪件打勾 / 海报导出（全宽左右分栏：左高密度一屏可点海报 + 右指挥台/导出工作台），以及全宽制作编辑模式 */
        <div className="space-y-4">
          {topTabBar}
          {checklistHeaderNode}

          {subMode === "edit" && (
            <div
              className={`grid grid-cols-1 gap-4 items-start ${
                isExpanded ? "lg:grid-cols-12" : ""
              }`}
            >
              {emptyInitCard && (
                <div className={isExpanded ? "lg:col-span-12" : ""}>
                  {emptyInitCard}
                </div>
              )}

              <div
                className={
                  isExpanded
                    ? "lg:col-span-5 lg:sticky lg:top-4 min-w-0"
                    : "min-w-0"
                }
              >
                {runnerPoolNode}
              </div>

              <div className={isExpanded ? "lg:col-span-7 min-w-0" : "min-w-0"}>
                {bodyRegionsNode}
              </div>
            </div>
          )}

          {subMode === "check" && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5 items-start">
              <div className="lg:col-span-7 xl:col-span-8 min-w-0">
                {checkPosterNode}
              </div>
              <div className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-4 min-w-0">
                {checkRightSidebarNode}
              </div>
            </div>
          )}

          {subMode === "poster" && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5 items-start">
              <div className="lg:col-span-7 xl:col-span-8 min-w-0">
                {posterPreviewNode}
              </div>
              <div className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-4 min-w-0">
                {posterRightSidebarNode}
              </div>
            </div>
          )}
        </div>
      )}

      <DammizImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        initialInput={importInitialInput}
        existing={existingSummary}
        onImport={handleImportDammiz}
      />

      {/* 堆叠移动方块包拖拽悬浮层 (Portal) */}
      {dragStack &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed left-0 top-0 z-[9999] pointer-events-none select-none"
            style={{
              transform: `translate3d(${dragStack.x}px, ${dragStack.y}px, 0) translate(-50%, -85%)`,
            }}
          >
            <div className="relative">
              {dragStack.numbers.length > 2 && (
                <div
                  className="bp-stack-shadow bp-stack-shadow-drag absolute inset-0 translate-x-1.5 translate-y-1.5 opacity-50"
                  style={{ backgroundColor: shadeHex(dragStack.colorHex, 0.25) }}
                />
              )}
              {dragStack.numbers.length > 1 && (
                <div
                  className="bp-stack-shadow bp-stack-shadow-drag absolute inset-0 translate-x-0.5 translate-y-0.5 opacity-75"
                  style={{ backgroundColor: shadeHex(dragStack.colorHex, 0.12) }}
                />
              )}
              <div
                className="bp-stack-card bp-stack-card-drag relative flex items-center gap-2 px-3 py-2"
                style={{
                  backgroundColor: dragStack.colorHex,
                  color: readableTextColor(dragStack.colorHex),
                }}
              >
                <span className="font-mono text-sm font-black">
                  {dragStack.runnerId}
                </span>
                <span className="bp-stack-count px-1.5 py-0.5 font-mono text-[11px] font-black">
                  {dragStack.numbers.length}件
                </span>
                <span className="max-w-[140px] truncate font-mono text-xs font-bold opacity-85">
                  {summarizeSelectedNumbers(dragStack.numbers)}
                </span>
              </div>
              {hoveredRegionId && (
                <div className="bp-stack-hint mt-1.5 px-2.5 py-0.5 text-center text-[10px] font-black">
                  松手放入「
                  {checklist.regions.find((r) => r.id === hoveredRegionId)?.title}
                  」
                </div>
              )}
            </div>
          </div>,
          document.body
        )}

      {/* 抛物线飞入粒子层 (Portal) */}
      {flyingTiles.length > 0 &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            {flyingTiles.map((item) => (
              <FlyingTileParticle
                key={item.id}
                item={item}
                onDone={removeFlyingTile}
              />
            ))}
          </>,
          document.body
        )}
    </div>
  );
};

export default PartsChecklistWorkbench;
