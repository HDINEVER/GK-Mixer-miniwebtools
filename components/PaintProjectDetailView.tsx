import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  CatalogPaint,
  ColorData,
  FloatingSwatchNode,
  Language,
  PaintingStep,
  PaintProject,
  PaletteCategory,
  PartCanvas,
} from "../types";
import { ExtractMarkerOverlay } from "./ExtractMarkerOverlay";
import { SwatchEditorModal } from "./SwatchEditorModal";
import { PaintingStepBuilderView } from "./PaintingStepBuilderView";
import { ProjectSharePosterModal } from "./ProjectSharePosterModal";
import { LightnessAndChromaModule } from "./ChromaStudioPanel";
import { NearestMatchesModule } from "./BrandMatchPanel";
import { PaintBottleImg } from "./PaintBottleHover";
import { colorsToFloatingNodes, floatingNodesToColors } from "../utils/projectStore";
import {
  createCoverThumbnail,
  exportGKMixArchive,
  inferStepsFromNodes,
} from "../utils/projectSharing";
import { localizedBrand } from "../utils/paintCatalog";
import { computeBrandTintRecipe } from "../utils/brandTintRecipe";
import { exportAnnotatedImage } from "../utils/exportAnnotatedImage";
import { SwatchSettings } from "../utils/swatchLayout";
import {
  ArrowLeftIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CaretDownIcon,
  DotsThreeIcon,
  FolderIcon,
  SlidersHorizontalIcon,
  QrCodeIcon,
  DownloadSimpleIcon,
  PlusIcon,
  TrashIcon,
  PencilSimpleIcon,
  PaletteIcon,
  ListChecksIcon,
  ImageSquareIcon,
  CheckIcon,
  ArrowsOutSimpleIcon,
  ArrowsInSimpleIcon,
  ExportIcon,
} from "@phosphor-icons/react";

interface PaintProjectDetailViewProps {
  project: PaintProject;
  categories: PaletteCategory[];
  catalogPaints: CatalogPaint[];
  swatchSettings: SwatchSettings;
  onUpdateSwatchSettings: (updater: (prev: SwatchSettings) => SwatchSettings) => void;
  onUpdateProject: (updated: PaintProject) => void;
  onDeleteProject: (projectId: string) => void;
  onBack: () => void;
  onSendImageToColoring?: (imageUrl: string, label?: string) => void;
  isWideMode?: boolean;
  onToggleWideMode?: () => void;
  lang: Language;
}

export const PaintProjectDetailView: React.FC<PaintProjectDetailViewProps> = ({
  project,
  categories,
  catalogPaints,
  swatchSettings,
  onUpdateSwatchSettings,
  onUpdateProject,
  onDeleteProject,
  onBack,
  onSendImageToColoring,
  isWideMode = false,
  onToggleWideMode,
  lang,
}) => {
  const [activePartIndex, setActivePartIndex] = useState<number>(0);
  const [detailSubTab, setDetailSubTab] = useState<"paints" | "steps">("paints");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showCategoryMenu, setShowCategoryMenu] = useState<boolean>(false);
  const [showMoreMenu, setShowMoreMenu] = useState<boolean>(false);
  const [showExportFabMenu, setShowExportFabMenu] = useState<boolean>(false);
  const [isSwatchEditorOpen, setIsSwatchEditorOpen] = useState<boolean>(false);
  const [isPosterModalOpen, setIsPosterModalOpen] = useState<boolean>(false);
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [titleInput, setTitleInput] = useState<string>(project.title);
  const [isEditingPartName, setIsEditingPartName] = useState<boolean>(false);
  const [partNameInput, setPartNameInput] = useState<string>("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const addPartFileRef = useRef<HTMLInputElement>(null);
  const touchStartXRef = useRef<number | null>(null);

  const safePartIdx = Math.min(
    Math.max(0, activePartIndex),
    Math.max(0, project.parts.length - 1)
  );
  const activePart: PartCanvas | undefined = project.parts[safePartIdx];

  useEffect(() => {
    setTitleInput(project.title);
  }, [project.title]);

  useEffect(() => {
    if (activePart) {
      setPartNameInput(activePart.partName);
      if (
        !selectedNodeId ||
        !activePart.nodes.some((n) => n.id === selectedNodeId)
      ) {
        setSelectedNodeId(activePart.nodes[0]?.id || null);
      }
    }
  }, [activePart, selectedNodeId]);

  const partColors: ColorData[] = useMemo(() => {
    if (!activePart) return [];
    return floatingNodesToColors(activePart.nodes, catalogPaints);
  }, [activePart, catalogPaints]);

  const selectedNode: FloatingSwatchNode | null = useMemo(() => {
    if (!activePart || activePart.nodes.length === 0) return null;
    return (
      activePart.nodes.find((n) => n.id === selectedNodeId) ||
      activePart.nodes[0]
    );
  }, [activePart, selectedNodeId]);

  const currentCategory = categories.find((c) => c.id === project.categoryId);

  const updateActivePart = (updater: (part: PartCanvas) => PartCanvas) => {
    if (!activePart) return;
    const nextParts = project.parts.map((p, idx) =>
      idx === safePartIdx ? updater(p) : p
    );
    onUpdateProject({
      ...project,
      updatedAt: Date.now(),
      parts: nextParts,
    });
  };

  const handleUpdateColorsFromEditor = (
    updater: (prev: ColorData[]) => ColorData[]
  ) => {
    const nextColors = updater(partColors);
    const nextNodes = colorsToFloatingNodes(nextColors);
    updateActivePart((part) => ({
      ...part,
      nodes: nextNodes.map((n) => {
        const prevNode = part.nodes.find((pn) => pn.id === n.id);
        return prevNode
          ? {
              ...n,
              basePaintHex: prevNode.basePaintHex,
              tintBadgeText: prevNode.tintBadgeText,
              recipeSummary: prevNode.recipeSummary,
            }
          : n;
      }),
    }));
  };

  const handleReplaceNodePaint = (newPaint: CatalogPaint) => {
    if (!selectedNode) return;
    updateActivePart((part) => ({
      ...part,
      nodes: part.nodes.map((n) =>
        n.id === selectedNode.id
          ? {
              ...n,
              paintBrand: newPaint.brand,
              paintCode: newPaint.code,
              paintName: newPaint.name,
              hex: newPaint.hex.toUpperCase(),
            }
          : n
      ),
    }));
  };

  const handleChangeCategory = (catId: string | null) => {
    setShowCategoryMenu(false);
    onUpdateProject({
      ...project,
      categoryId: catId,
      updatedAt: Date.now(),
    });
  };

  const handleSaveTitle = () => {
    setIsEditingTitle(false);
    if (titleInput.trim() && titleInput.trim() !== project.title) {
      onUpdateProject({
        ...project,
        title: titleInput.trim(),
        updatedAt: Date.now(),
      });
    }
  };

  const handleSavePartName = () => {
    setIsEditingPartName(false);
    if (partNameInput.trim() && activePart && partNameInput.trim() !== activePart.partName) {
      updateActivePart((part) => ({
        ...part,
        partName: partNameInput.trim(),
      }));
    }
  };

  const handleAddNewPartImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      const now = Date.now();
      const newPart: PartCanvas = {
        id: `part-${now}`,
        partName: `零件 ${project.parts.length + 1}`,
        sourceImageDataUrl: reader.result,
        nodes: [],
        steps: inferStepsFromNodes([]),
        createdAt: now,
      };
      const nextParts = [...project.parts, newPart];
      onUpdateProject({
        ...project,
        coverImageDataUrl: project.coverImageDataUrl || reader.result,
        updatedAt: now,
        parts: nextParts,
      });
      setActivePartIndex(nextParts.length - 1);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleDeleteCurrentPart = () => {
    if (project.parts.length <= 1) {
      onDeleteProject(project.id);
      return;
    }
    const nextParts = project.parts.filter((_, idx) => idx !== safePartIdx);
    onUpdateProject({
      ...project,
      updatedAt: Date.now(),
      parts: nextParts,
    });
    setActivePartIndex(Math.max(0, safePartIdx - 1));
    setShowMoreMenu(false);
  };

  const handleExportCurrentPartPng = async () => {
    if (!activePart) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = async () => {
      const markers = partColors.map((c) => ({
        id: c.id,
        nx: c.sampleX ?? 0.5,
        ny: c.sampleY ?? 0.5,
        hex: c.hex,
        paint: c.assignedPaint,
        labelNx: c.labelNx,
        labelNy: c.labelNy,
        labelScale: c.labelScale,
        tonalGradient: c.tonalGradient,
      }));
      await exportAnnotatedImage(img, markers, swatchSettings);
    };
    img.src = activePart.sourceImageDataUrl;
  };

  return (
    <div className="space-y-4 pb-8 animate-fadeIn relative">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full border-2 border-accent bg-slate-900/90 text-white px-4 py-2 text-xs font-bold shadow-lg backdrop-blur-md">
          <CheckIcon className="h-4 w-4 text-accent" weight="bold" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Top Navigation & Project Action Bar (full width card, z-30 so it never overlaps Desktop Nav Dropdown or Mobile Top-Right Settings Button) */}
      <div className="bp-subcard-lg relative z-30 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/85 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 sm:px-3.5 py-2.5 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0 pr-10 lg:pr-0">
          <button
            type="button"
            onClick={onBack}
            className="bp-pill flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 sm:px-3 py-1.5 text-xs font-extrabold text-slate-700 dark:text-slate-200 hover:bg-slate-200 transition cursor-pointer whitespace-nowrap shrink-0"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5 shrink-0" weight="bold" />
            <span>返回</span>
          </button>

          {isEditingTitle ? (
            <input
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={(e) => e.key === "Enter" && handleSaveTitle()}
              autoFocus
              className="bp-input rounded-xl border border-coral bg-white dark:bg-slate-900 px-2.5 py-1 text-sm font-black text-slate-900 dark:text-white focus:outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingTitle(true)}
              className="group flex items-center gap-1.5 text-left min-w-0 cursor-pointer"
              title="点击修改工程名称"
            >
              <h2 className="truncate text-sm sm:text-base font-black text-slate-900 dark:text-white max-w-[160px] sm:max-w-[320px]">
                {project.title}
              </h2>
              <PencilSimpleIcon className="h-3.5 w-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition shrink-0" />
            </button>
          )}

          {/* Category Reassignment Dropdown Pill ([📁 分类：xxx ⌄]) */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => {
                setShowCategoryMenu((v) => !v);
                setShowMoreMenu(false);
              }}
              className="bp-pill inline-flex items-center gap-1 sm:gap-1.5 rounded-full border border-slate-200/90 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:border-coral transition cursor-pointer whitespace-nowrap"
            >
              <FolderIcon className="h-3.5 w-3.5 text-coral shrink-0" weight="fill" />
              <span className="truncate max-w-[110px] sm:max-w-none">分类：{currentCategory ? currentCategory.name : "未分类"}</span>
              <CaretDownIcon className="h-3 w-3 opacity-60 shrink-0" />
            </button>

            {showCategoryMenu && (
              <>
                <div
                  className="fixed inset-0 z-[90]"
                  onClick={() => setShowCategoryMenu(false)}
                />
                <div className="bp-subcard-lg absolute left-0 top-full mt-2 z-[100] min-w-[180px] rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900 p-1.5 shadow-2xl space-y-0.5">
                  <button
                    type="button"
                    onClick={() => handleChangeCategory(null)}
                    className={`w-full rounded-xl px-2.5 py-1.5 text-left text-xs font-bold transition ${
                      !project.categoryId
                        ? "bp-pill-active bg-coral text-white"
                        : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    未分类
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleChangeCategory(cat.id)}
                      className={`w-full rounded-xl px-2.5 py-1.5 text-left text-xs font-bold transition ${
                        project.categoryId === cat.id
                          ? "bp-pill-active bg-coral text-white"
                          : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right: [🎨 试色改色] + [编辑色卡] + [宽屏模式] + [•••] */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {onSendImageToColoring && activePart?.sourceImageDataUrl && (
            <button
              type="button"
              onClick={() =>
                onSendImageToColoring(
                  activePart.sourceImageDataUrl,
                  `${project.title} · ${activePart.partName}`
                )
              }
              className="bp-pill gk-btn-secondary flex items-center gap-1 sm:gap-1.5 rounded-full bg-coral/10 hover:bg-coral/20 border border-coral/30 px-2.5 sm:px-3.5 py-1.5 text-[11px] sm:text-xs font-extrabold text-coral transition cursor-pointer whitespace-nowrap shrink-0"
              title="将当前零件图一键发送至 AI 试色台进行分件改色与光影预览"
            >
              <span>🎨</span>
              <span>试色改色</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsSwatchEditorOpen(true)}
            className="bp-pill gk-btn-secondary flex items-center gap-1 sm:gap-1.5 rounded-full bg-coral/10 hover:bg-coral/20 border border-coral/30 px-2.5 sm:px-3.5 py-1.5 text-[11px] sm:text-xs font-extrabold text-coral transition cursor-pointer whitespace-nowrap shrink-0"
          >
            <SlidersHorizontalIcon className="h-3.5 w-3.5 shrink-0" weight="bold" />
            <span>编辑色卡</span>
          </button>

          {onToggleWideMode && (
            <button
              type="button"
              onClick={onToggleWideMode}
              title={
                isWideMode
                  ? "恢复左侧源图像画布，切换回双栏对照布局"
                  : "隐藏左侧源图像画布，全宽浏览涂装库"
              }
              className={`hidden lg:inline-flex items-center gap-1 rounded-full border px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0 ${
                isWideMode
                  ? "bp-pill-active border-accent bg-accent text-white shadow-xs"
                  : "bp-pill border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[#334155] dark:text-slate-300 hover:text-accent hover:border-accent/40"
              }`}
            >
              {isWideMode ? (
                <>
                  <ArrowsInSimpleIcon className="h-3.5 w-3.5 shrink-0" weight="bold" />
                  <span>{lang === "zh" ? "恢复双栏" : "Dual View"}</span>
                </>
              ) : (
                <>
                  <ArrowsOutSimpleIcon className="h-3.5 w-3.5 text-accent shrink-0" weight="bold" />
                  <span>{lang === "zh" ? "宽屏模式" : "Wide Mode"}</span>
                </>
              )}
            </button>
          )}

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => {
                setShowMoreMenu((v) => !v);
                setShowCategoryMenu(false);
                setShowExportFabMenu(false);
              }}
              className="bp-pill flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full text-coral hover:bg-coral/10 transition cursor-pointer"
              title="更多项目操作"
            >
              <DotsThreeIcon className="h-5 w-5 sm:h-6 sm:w-6" weight="bold" />
            </button>

            {showMoreMenu && (
              <>
                <div
                  className="fixed inset-0 z-[90]"
                  onClick={() => setShowMoreMenu(false)}
                />
                <div className="bp-subcard-lg absolute right-0 top-full mt-2 z-[100] min-w-[220px] rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900 p-1.5 shadow-2xl space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false);
                      addPartFileRef.current?.click();
                    }}
                    className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-bold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
                  >
                    <PlusIcon className="h-4 w-4 text-coral shrink-0" weight="bold" />
                    <span>添加新零件工程图</span>
                  </button>
                  {activePart?.sourceImageDataUrl && (
                    <button
                      type="button"
                      onClick={async () => {
                        setShowMoreMenu(false);
                        const thumb = await createCoverThumbnail(activePart.sourceImageDataUrl);
                        onUpdateProject({
                          ...project,
                          coverImageDataUrl: thumb,
                          customCoverImageDataUrl: thumb,
                          updatedAt: Date.now(),
                        });
                        setToastMessage("已设为项目封面");
                        setTimeout(() => setToastMessage(null), 2000);
                      }}
                      className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-bold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
                    >
                      <ImageSquareIcon className="h-4 w-4 text-accent shrink-0" weight="bold" />
                      <span>📌 将当前零件设为封面</span>
                    </button>
                  )}
                  {project.parts.length > 1 && (
                    <button
                      type="button"
                      onClick={handleDeleteCurrentPart}
                      className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-bold text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 whitespace-nowrap cursor-pointer"
                    >
                      <TrashIcon className="h-4 w-4 shrink-0" weight="bold" />
                      <span>删除当前零件图</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false);
                      onDeleteProject(project.id);
                    }}
                    className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 whitespace-nowrap cursor-pointer"
                  >
                    <TrashIcon className="h-4 w-4 shrink-0" weight="bold" />
                    <span>删除整个工程</span>
                  </button>
                </div>
              </>
            )}
          </div>

          <input
            ref={addPartFileRef}
            type="file"
            accept="image/*"
            onChange={handleAddNewPartImage}
            className="hidden"
          />
        </div>
      </div>

      {/* Workspace: mobile stacked (canvas → tabs → panels); desktop lg+ left canvas / right inspector */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6 lg:items-start">
      {/* 2. Upper Zone: 1:1 Export Aspect Ratio Preview & Multi-Part Horizontal Paging (Drag locked to prevent gesture conflict) */}
      {activePart && (
        <div
          className="bp-canvas-stage lg:col-span-6 xl:col-span-5 lg:sticky lg:top-4 min-w-0 rounded-3xl border border-slate-200/85 dark:border-slate-800 bg-slate-950 p-3 sm:p-4 shadow-lg space-y-3"
          onTouchStart={(e) => {
            touchStartXRef.current = e.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(e) => {
            if (touchStartXRef.current == null) return;
            const endX = e.changedTouches[0]?.clientX ?? touchStartXRef.current;
            const dx = endX - touchStartXRef.current;
            touchStartXRef.current = null;
            if (Math.abs(dx) > 48) {
              if (dx < 0 && safePartIdx < project.parts.length - 1) {
                setActivePartIndex(safePartIdx + 1);
              } else if (dx > 0 && safePartIdx > 0) {
                setActivePartIndex(safePartIdx - 1);
              }
            }
          }}
        >
          {/* Part Switcher Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="bp-badge rounded-full bg-coral/20 border border-coral/40 px-2.5 py-0.5 font-mono text-[11px] font-black text-coral whitespace-nowrap shrink-0 tabular-nums">
                零件 {safePartIdx + 1}/{project.parts.length}
              </span>
              {isEditingPartName ? (
                <input
                  type="text"
                  value={partNameInput}
                  onChange={(e) => setPartNameInput(e.target.value)}
                  onBlur={handleSavePartName}
                  onKeyDown={(e) => e.key === "Enter" && handleSavePartName()}
                  autoFocus
                  className="bp-input rounded-lg border border-coral bg-slate-900 px-2 py-0.5 text-xs font-bold text-white focus:outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingPartName(true)}
                  className="flex items-center gap-1 text-xs sm:text-sm font-extrabold text-white hover:text-coral transition cursor-pointer min-w-0"
                >
                  <span className="truncate">{activePart.partName}</span>
                  <PencilSimpleIcon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                </button>
              )}
            </div>

            {/* Part Paging Controls */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full pb-0.5 pr-0.5">
              {project.parts.map((partItem, pIdx) => (
                <button
                  key={partItem.id}
                  type="button"
                  onClick={() => setActivePartIndex(pIdx)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition cursor-pointer whitespace-nowrap shrink-0 ${
                    pIdx === safePartIdx
                      ? "bp-pill-active bg-white text-slate-950 shadow-xs"
                      : "bp-pill bg-white/10 text-slate-300 hover:bg-white/20"
                  }`}
                >
                  #{pIdx + 1} {partItem.partName.slice(0, 8)}
                </button>
              ))}
              <button
                type="button"
                onClick={() => addPartFileRef.current?.click()}
                className="bp-pill flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white hover:bg-coral transition cursor-pointer shrink-0"
                title="添加新零件图"
              >
                <PlusIcon className="h-3.5 w-3.5" weight="bold" />
              </button>
            </div>
          </div>

          {/* 1:1 Export Aspect Ratio Annotated Preview Stage (allowDrag={false}) */}
          <div className="bp-canvas-stage relative flex items-center justify-center min-h-[280px] sm:min-h-[360px] lg:min-h-[380px] lg:max-h-[calc(100dvh-220px)] rounded-2xl bg-slate-900/90 overflow-hidden p-2">
            {project.parts.length > 1 && safePartIdx > 0 && (
              <button
                type="button"
                onClick={() => setActivePartIndex(safePartIdx - 1)}
                className="bp-btn absolute left-3 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-slate-900/75 text-white border border-white/20 backdrop-blur-md hover:bg-slate-900 transition cursor-pointer"
                title="上一个零件"
              >
                <CaretLeftIcon className="h-4 w-4" weight="bold" />
              </button>
            )}

            <div className="relative inline-block max-w-full">
              <img
                src={activePart.sourceImageDataUrl}
                alt={activePart.partName}
                className="bp-swatch block max-h-[46dvh] sm:max-h-[54dvh] lg:max-h-[calc(100dvh-260px)] w-auto max-w-full rounded-xl object-contain select-none"
                draggable={false}
              />
              <ExtractMarkerOverlay
                colors={partColors}
                selectedId={selectedNode?.id || null}
                onSelect={(cOrId) => {
                  const id = typeof cOrId === "string" ? cOrId : cOrId?.id;
                  if (id) setSelectedNodeId(id);
                }}
                onUpdatePosition={(id, nx, ny) => {
                  updateActivePart((part) => ({
                    ...part,
                    nodes: part.nodes.map((n) =>
                      n.id === id ? { ...n, offsetX: nx, offsetY: ny } : n
                    ),
                  }));
                }}
                settings={swatchSettings}
                interactive={true}
                allowDrag={true}
              />
            </div>

            {project.parts.length > 1 && safePartIdx < project.parts.length - 1 && (
              <button
                type="button"
                onClick={() => setActivePartIndex(safePartIdx + 1)}
                className="bp-btn absolute right-3 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-slate-900/75 text-white border border-white/20 backdrop-blur-md hover:bg-slate-900 transition cursor-pointer"
                title="下一个零件"
              >
                <CaretRightIcon className="h-4 w-4" weight="bold" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-0.5 text-[11px] text-slate-400">
            <span className="truncate">拖拽画面色卡可自由移动 · 点按色卡查看详情</span>
            <button
              type="button"
              onClick={() => setIsSwatchEditorOpen(true)}
              className="bp-pill-active gk-btn-primary inline-flex items-center gap-1.5 rounded-xl bg-accent hover:bg-accent-hover px-3.5 py-2 text-xs font-extrabold text-white shadow-sm transition-all active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
            >
              <SlidersHorizontalIcon className="h-3.5 w-3.5 shrink-0" weight="bold" />
              <span>进入排版工作台 →</span>
            </button>
          </div>
        </div>
      )}

      {/* Right inspector column (desktop) */}
      <div className="lg:col-span-6 xl:col-span-7 min-w-0 flex flex-col gap-4 pr-1.5 pb-1.5">
      {/* 3. Floating Liquid Glass Sub-Tab Switcher: [指派油漆详情 | 涂装工序] */}
      <div className="flex justify-center lg:justify-start">
        <div className="bp-segmented inline-flex rounded-full border border-white/50 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-1 shadow-md max-w-full overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setDetailSubTab("paints")}
            className={`bp-segmented-item flex items-center gap-1.5 rounded-full px-3.5 sm:px-5 py-1.5 sm:py-2 text-xs font-black transition cursor-pointer whitespace-nowrap shrink-0 tabular-nums ${
              detailSubTab === "paints"
                ? "bp-segmented-item-active bg-coral text-white shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <PaletteIcon className="h-4 w-4 shrink-0" weight="bold" />
            <span>指派油漆详情 ({activePart?.nodes.length || 0})</span>
          </button>
          <button
            type="button"
            onClick={() => setDetailSubTab("steps")}
            className={`bp-segmented-item flex items-center gap-1.5 rounded-full px-3.5 sm:px-5 py-1.5 sm:py-2 text-xs font-black transition cursor-pointer whitespace-nowrap shrink-0 tabular-nums ${
              detailSubTab === "steps"
                ? "bp-segmented-item-active bg-coral text-white shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <ListChecksIcon className="h-4 w-4 shrink-0" weight="bold" />
            <span>涂装工序 ({activePart?.steps.length || 0})</span>
          </button>
        </div>
      </div>

      {/* 4. Sub-Tab 1: 指派油漆详情 (Horizontal Paint Carousel + Module A Lightness/Chroma + Module B Nearest Matches) */}
      {detailSubTab === "paints" && activePart && (
        <div className="space-y-4">
          {activePart.nodes.length === 0 ? (
            <div className="bp-dashed-box rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 p-8 text-center space-y-2">
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                当前零件尚未指派悬浮色卡
              </p>
              <p className="text-[11px] text-slate-400">
                可在「混色台 - 拾色」页面取色并指派油漆后，通过右下角菜单「保存至涂装项目」添加零件色卡。
              </p>
            </div>
          ) : (
            <>
              {/* Horizontal Carousel of Assigned Paint Cards with Real Bottle Thumbnails */}
              <div className="flex items-stretch gap-3 overflow-x-auto pb-1.5 pr-1.5 no-scrollbar lg:grid lg:grid-cols-2 2xl:grid-cols-3 lg:overflow-visible">
                {activePart.nodes.map((node, idx) => {
                  const isSelected = selectedNode?.id === node.id;
                  const matchedCatalogPaint = catalogPaints.find(
                    (p) => p.code.trim().toUpperCase() === node.paintCode.trim().toUpperCase()
                  );
                  const liveTintRecipe = matchedCatalogPaint
                    ? computeBrandTintRecipe(node.hex, matchedCatalogPaint, lang)
                    : null;
                  const isFineTuned =
                    Boolean(node.basePaintHex && node.basePaintHex.toUpperCase() !== node.hex.toUpperCase()) ||
                    Boolean(liveTintRecipe && !liveTintRecipe.isDirectSpray);
                  const baseHexForBadge =
                    node.basePaintHex || (liveTintRecipe ? liveTintRecipe.basePaint.hex : undefined);
                  const compactBadge =
                    node.tintBadgeText ||
                    (liveTintRecipe && !liveTintRecipe.isDirectSpray ? liveTintRecipe.compactBadgeText : undefined);

                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => setSelectedNodeId(node.id)}
                      className={`bp-subcard bp-subcard-interactive group flex items-center gap-3 rounded-2xl border p-3 text-left transition shrink-0 min-w-[240px] max-w-[280px] lg:min-w-0 lg:max-w-none cursor-pointer ${
                        isSelected
                          ? "bp-subcard-active border-coral bg-white dark:bg-slate-900 ring-2 ring-coral/35 shadow-md"
                          : "border-slate-200/85 dark:border-slate-800 bg-white/85 dark:bg-slate-900/80 hover:border-slate-300"
                      }`}
                    >
                      {/* Real Bottle Thumbnail / Color Swatch + 16x16px Original Base Paint Corner Dot */}
                      <div
                        className="bp-swatch relative h-14 w-14 rounded-xl border border-black/10 dark:border-white/10 shrink-0 overflow-hidden flex items-center justify-center bg-slate-50 dark:bg-slate-800"
                        style={{ backgroundColor: node.hex }}
                      >
                        <PaintBottleImg
                          brand={node.paintBrand}
                          code={node.paintCode}
                          className="h-full w-full object-contain p-1 bg-white/90"
                        />
                        <span className="bp-badge absolute left-1 top-1 rounded bg-slate-900/80 px-1 py-px font-mono text-[9px] font-black text-white">
                          #{idx + 1}
                        </span>
                        {isFineTuned && baseHexForBadge && (
                          <span
                            title={`基底主漆原瓶色 (${baseHexForBadge})`}
                            className="absolute right-0.5 top-0.5 h-4 w-4 rounded-[3px] border-[1.5px] border-white shadow-sm"
                            style={{ backgroundColor: baseHexForBadge }}
                          />
                        )}
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate text-[11px] font-extrabold text-coral">
                            {localizedBrand(node.paintBrand, lang)} {node.paintCode}
                            {!isFineTuned ? " (直喷)" : ""}
                          </span>
                          <span
                            className="bp-badge rounded px-1.5 py-0.5 font-mono text-[10px] font-bold text-white shadow-2xs"
                            style={{ backgroundColor: node.hex }}
                          >
                            {node.hex}
                          </span>
                        </div>
                        <div className="truncate text-xs font-black text-slate-900 dark:text-white">
                          {node.paintName}
                        </div>
                        {isFineTuned && compactBadge && baseHexForBadge ? (
                          <div
                            title={node.recipeSummary || liveTintRecipe?.spokenInstruction || compactBadge}
                            className="inline-flex items-center gap-1 h-[18px] px-1.5 max-w-full rounded bg-amber-500/15 border border-amber-500/35 text-amber-800 dark:text-amber-200 truncate"
                          >
                            <span className="inline-flex h-2.5 w-4 shrink-0 overflow-hidden rounded-[2px] border border-black/30">
                              <span className="flex-1 h-full" style={{ backgroundColor: baseHexForBadge }} />
                              <span className="flex-1 h-full" style={{ backgroundColor: node.hex }} />
                            </span>
                            <span className="text-[9px] font-mono font-black truncate">{compactBadge}</span>
                          </div>
                        ) : (
                          <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 truncate">
                            ✅ 现成品牌漆直喷 · 点击展开明度与微调
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Dynamic Detail Modules for Selected Paint Card: Module A (Lightness/Chroma) + Module B (Nearest Matches) */}
              {selectedNode && (
                <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4 items-start">
                  <div className="min-w-0">
                    <LightnessAndChromaModule
                      hex={selectedNode.hex}
                      lang={lang}
                    />
                  </div>
                  <div className="min-w-0">
                    <NearestMatchesModule
                      hex={selectedNode.hex}
                      lang={lang}
                      currentBrand={selectedNode.paintBrand}
                      currentCode={selectedNode.paintCode}
                      onReplacePaint={handleReplaceNodePaint}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 5. Sub-Tab 2: 涂装工序 (Apple Shortcuts Vertical Workflow) */}
      {detailSubTab === "steps" && activePart && (
        <PaintingStepBuilderView
          steps={activePart.steps}
          nodes={activePart.nodes}
          onChangeSteps={(nextSteps: PaintingStep[]) =>
            updateActivePart((part) => ({ ...part, steps: nextSteps }))
          }
          lang={lang}
        />
      )}
      </div>
      </div>

      {/* Bottom-Right Floating Export Button (QR Poster Card + .gkmix Archive Export, Screenshot 3) */}
      <div className="fixed bottom-24 lg:bottom-8 right-5 z-40 overflow-visible">
        {showExportFabMenu && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setShowExportFabMenu(false)}
            />
            <div className="bp-subcard-lg absolute bottom-[68px] right-0 z-40 min-w-[225px] rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900 p-1.5 shadow-[0_12px_32px_rgba(15,23,42,0.16)] space-y-0.5 animate-fadeIn">
              <button
                type="button"
                onClick={() => {
                  setShowExportFabMenu(false);
                  setIsPosterModalOpen(true);
                }}
                className="w-full flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-xs font-extrabold text-slate-800 dark:text-slate-100 hover:bg-accent/10 hover:text-accent transition whitespace-nowrap cursor-pointer"
              >
                <QrCodeIcon className="h-4 w-4 text-accent shrink-0" weight="bold" />
                <span>导出涂装方案名片</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowExportFabMenu(false);
                  exportGKMixArchive(project);
                }}
                className="w-full flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-xs font-extrabold text-slate-800 dark:text-slate-100 hover:bg-accent/10 hover:text-accent transition whitespace-nowrap cursor-pointer"
              >
                <DownloadSimpleIcon className="h-4 w-4 text-accent shrink-0" weight="bold" />
                <span>导出 .gkmix 工程文件</span>
              </button>
            </div>
          </>
        )}

        <button
          type="button"
          onClick={() => {
            setShowExportFabMenu((v) => !v);
            setShowMoreMenu(false);
            setShowCategoryMenu(false);
          }}
          style={{ width: "56px", height: "56px" }}
          className="bp-fab flex items-center justify-center rounded-full bg-accent text-white border border-slate-200/80 dark:border-slate-700 shadow-[0_6px_20px_rgba(15,23,42,0.18)] hover:scale-105 active:scale-95 transition cursor-pointer"
          title="导出涂装方案名片或 .gkmix 工程文件"
          aria-label="导出涂装方案名片或 .gkmix 工程文件"
        >
          <ExportIcon className="h-6 w-6" weight="bold" />
        </button>
      </div>

      {/* Shared Swatch Editor Modal */}
      {activePart && (
        <SwatchEditorModal
          isOpen={isSwatchEditorOpen}
          onClose={() => setIsSwatchEditorOpen(false)}
          title={`${project.title} · ${activePart.partName} 色卡排版`}
          imageSrc={activePart.sourceImageDataUrl}
          colors={partColors}
          selectedColor={
            partColors.find((c) => c.id === selectedNode?.id) || partColors[0] || null
          }
          onSelectColor={(c) => setSelectedNodeId(c.id)}
          onUpdateColors={handleUpdateColorsFromEditor}
          onUpdateImageAndColors={(newImageSrc, nextColors) => {
            const nextNodes = colorsToFloatingNodes(nextColors);
            updateActivePart((part) => ({
              ...part,
              sourceImageDataUrl: newImageSrc,
              nodes: nextNodes.map((n) => {
                const prevNode = part.nodes.find((pn) => pn.id === n.id);
                return prevNode
                  ? {
                      ...n,
                      basePaintHex: prevNode.basePaintHex,
                      tintBadgeText: prevNode.tintBadgeText,
                      recipeSummary: prevNode.recipeSummary,
                    }
                  : n;
              }),
            }));
          }}
          settings={swatchSettings}
          onUpdateSettings={onUpdateSwatchSettings}
          lang={lang}
        />
      )}

      {/* Share QR Poster Modal */}
      {activePart && (
        <ProjectSharePosterModal
          isOpen={isPosterModalOpen}
          onClose={() => setIsPosterModalOpen(false)}
          project={project}
          part={activePart}
          catalogPaints={catalogPaints}
          swatchSettings={swatchSettings}
          lang={lang}
        />
      )}
    </div>
  );
};

export default PaintProjectDetailView;
