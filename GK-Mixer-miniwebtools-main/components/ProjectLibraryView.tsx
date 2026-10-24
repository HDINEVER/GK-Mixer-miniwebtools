import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CatalogPaint,
  Language,
  PaintProject,
  PaletteCategory,
  PartCanvas,
  SavedColor,
} from "../types";
import { PaintProjectDetailView } from "./PaintProjectDetailView";
import { ResponsiveSheet } from "./ResponsiveSheet";
import {
  createCoverThumbnail,
  exportGKMixArchive,
  getEffectiveProjectCover,
  importGKMixArchive,
  inferStepsFromNodes,
  restoreProjectFromPoster,
} from "../utils/projectSharing";
import { SwatchSettings } from "../utils/swatchLayout";
import {
  PlusIcon,
  FolderPlusIcon,
  QrCodeIcon,
  DownloadSimpleIcon,
  TagIcon,
  TrashIcon,
  PencilSimpleIcon,
  StackIcon,
  PaletteIcon,
  DotsThreeIcon,
  CheckIcon,
  CopyIcon,
  FlaskIcon,
  XIcon,
  UploadSimpleIcon,
  ImageSquareIcon,
  ArrowCounterClockwiseIcon,
  ArrowsOutSimpleIcon,
  ArrowsInSimpleIcon,
} from "@phosphor-icons/react";

interface ProjectLibraryViewProps {
  projects: PaintProject[];
  categories: PaletteCategory[];
  savedColors: SavedColor[];
  catalogPaints: CatalogPaint[];
  swatchSettings: SwatchSettings;
  onUpdateSwatchSettings: (updater: (prev: SwatchSettings) => SwatchSettings) => void;
  onChangeProjects: (next: PaintProject[]) => void;
  onChangeCategories: (next: PaletteCategory[]) => void;
  onChangeSavedColors: (next: SavedColor[]) => void;
  onSendColorToWorkbench?: (hex: string) => void;
  onSendImageToColoring?: (imageUrl: string, label?: string) => void;
  focusProjectId?: string | null;
  onClearFocusProject?: () => void;
  isWideMode?: boolean;
  onToggleWideMode?: () => void;
  lang: Language;
}

export const ProjectLibraryView: React.FC<ProjectLibraryViewProps> = ({
  projects,
  categories,
  savedColors,
  catalogPaints,
  swatchSettings,
  onUpdateSwatchSettings,
  onChangeProjects,
  onChangeCategories,
  onChangeSavedColors,
  onSendColorToWorkbench,
  onSendImageToColoring,
  focusProjectId,
  onClearFocusProject,
  isWideMode = false,
  onToggleWideMode,
  lang,
}) => {
  const [libraryMode, setLibraryMode] = useState<"projects" | "colors">("projects");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (focusProjectId) {
      setLibraryMode("projects");
      setActiveProjectId(focusProjectId);
      onClearFocusProject?.();
    }
  }, [focusProjectId, onClearFocusProject]);
  const [isCategoryBarCollapsed, setIsCategoryBarCollapsed] = useState<boolean>(false);
  const [showFabMenu, setShowFabMenu] = useState<boolean>(false);

  // Modals state
  const [showNewProjectModal, setShowNewProjectModal] = useState<boolean>(false);
  const [newProjectTitle, setNewProjectTitle] = useState<string>("");
  const [newProjectCatId, setNewProjectCatId] = useState<string | null>(null);
  const [newProjectCover, setNewProjectCover] = useState<string>("");

  const [showCategoryManager, setShowCategoryManager] = useState<boolean>(false);
  const [newCatInput, setNewCatInput] = useState<string>("");
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState<string>("");

  const [showScanPosterModal, setShowScanPosterModal] = useState<boolean>(false);
  const [scanPosterFile, setScanPosterFile] = useState<File | null>(null);
  const [manualGkmCode, setManualGkmCode] = useState<string>("");
  const [scanError, setScanError] = useState<string>("");
  const [isScanning, setIsScanning] = useState<boolean>(false);

  const [showAddColorModal, setShowAddColorModal] = useState<boolean>(false);
  const [newColorHex, setNewColorHex] = useState<string>("#3B6EE4");
  const [newColorName, setNewColorName] = useState<string>("");
  const [copiedHex, setCopiedHex] = useState<string>("");
  const [cardMenuId, setCardMenuId] = useState<string | null>(null);
  const [cardMenuAnchor, setCardMenuAnchor] = useState<{
    top: number;
    bottom: number;
    left: number;
    right: number;
    isMobile: boolean;
  } | null>(null);

  const [customCoverTargetProj, setCustomCoverTargetProj] = useState<PaintProject | null>(null);
  const [partCoverPickerProject, setPartCoverPickerProject] = useState<PaintProject | null>(null);

  const gkmixInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const customCoverInputRef = useRef<HTMLInputElement>(null);

  const activeProject = projects.find((p) => p.id === activeProjectId) || null;

  if (activeProject) {
    return (
      <PaintProjectDetailView
        project={activeProject}
        categories={categories}
        catalogPaints={catalogPaints}
        swatchSettings={swatchSettings}
        onUpdateSwatchSettings={onUpdateSwatchSettings}
        onUpdateProject={(updated) => {
          onChangeProjects(
            projects.map((p) => (p.id === updated.id ? updated : p))
          );
        }}
        onDeleteProject={(id) => {
          onChangeProjects(projects.filter((p) => p.id !== id));
          setActiveProjectId(null);
        }}
        onBack={() => setActiveProjectId(null)}
        onSendImageToColoring={onSendImageToColoring}
        isWideMode={isWideMode}
        onToggleWideMode={onToggleWideMode}
        lang={lang}
      />
    );
  }

  const filteredProjects = projects.filter((p) => {
    if (selectedCategoryId === "all") return true;
    if (selectedCategoryId === "uncategorized") return !p.categoryId;
    return p.categoryId === selectedCategoryId;
  });

  const filteredColors = savedColors.filter((c) => {
    if (selectedCategoryId === "all") return true;
    if (selectedCategoryId === "uncategorized") return !c.categoryId;
    return c.categoryId === selectedCategoryId;
  });

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = Date.now();
    const coverThumb = newProjectCover ? await createCoverThumbnail(newProjectCover) : undefined;
    const defaultPart: PartCanvas = {
      id: `part-${now}`,
      partName: "主外甲零件 1",
      sourceImageDataUrl: newProjectCover || "",
      nodes: [],
      steps: inferStepsFromNodes([]),
      createdAt: now,
    };
    const created: PaintProject = {
      id: `proj-${now}`,
      title: newProjectTitle.trim() || `涂装工程 ${projects.length + 1}`,
      coverImageDataUrl: coverThumb,
      createdAt: now,
      updatedAt: now,
      categoryId: newProjectCatId,
      parts: newProjectCover ? [defaultPart] : [],
    };
    onChangeProjects([created, ...projects]);
    setNewProjectTitle("");
    setNewProjectCover("");
    setShowNewProjectModal(false);
    setActiveProjectId(created.id);
  };

  const handleCustomCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !customCoverTargetProj) return;
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === "string") {
        const thumb = await createCoverThumbnail(reader.result);
        const updated = projects.map((p) =>
          p.id === customCoverTargetProj.id
            ? {
                ...p,
                customCoverImageDataUrl: thumb,
                coverImageDataUrl: thumb,
                updatedAt: Date.now(),
              }
            : p
        );
        onChangeProjects(updated);
        setCustomCoverTargetProj(null);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleResetCoverToDefault = (proj: PaintProject) => {
    const firstWithImage = proj.parts.find((p) => Boolean(p.sourceImageDataUrl));
    const updated = projects.map((p) =>
      p.id === proj.id
        ? {
            ...p,
            customCoverImageDataUrl: undefined,
            coverImageDataUrl: firstWithImage?.sourceImageDataUrl,
            updatedAt: Date.now(),
          }
        : p
    );
    onChangeProjects(updated);
    setCardMenuId(null);
  };

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setNewProjectCover(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleImportGKMixFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await importGKMixArchive(file, catalogPaints);
      onChangeProjects([imported, ...projects]);
      setActiveProjectId(imported.id);
    } catch (err: any) {
      alert(`导入 .gkmix 失败：${err?.message || "文件格式有误"}`);
    } finally {
      e.target.value = "";
    }
  };

  const handleRestorePoster = async (e: React.FormEvent) => {
    e.preventDefault();
    setScanError("");
    setIsScanning(true);
    try {
      const restored = await restoreProjectFromPoster(
        scanPosterFile,
        manualGkmCode,
        catalogPaints
      );
      onChangeProjects([restored, ...projects]);
      setShowScanPosterModal(false);
      setScanPosterFile(null);
      setManualGkmCode("");
      setActiveProjectId(restored.id);
    } catch (err: any) {
      setScanError(err?.message || "未能识别有效工程二维码");
    } finally {
      setIsScanning(false);
    }
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatInput.trim()) return;
    const cat: PaletteCategory = {
      id: `cat-${Date.now()}`,
      name: newCatInput.trim(),
      createdAt: Date.now(),
    };
    onChangeCategories([...categories, cat]);
    setNewCatInput("");
  };

  const handleRenameCategory = (id: string, name: string) => {
    if (!name.trim()) return;
    onChangeCategories(
      categories.map((c) => (c.id === id ? { ...c, name: name.trim() } : c))
    );
    setEditingCatId(null);
  };

  const handleDeleteCategory = (id: string) => {
    onChangeCategories(categories.filter((c) => c.id !== id));
    onChangeProjects(
      projects.map((p) => (p.categoryId === id ? { ...p, categoryId: null } : p))
    );
    onChangeSavedColors(
      savedColors.map((c) => (c.categoryId === id ? { ...c, categoryId: null } : c))
    );
    if (selectedCategoryId === id) {
      setSelectedCategoryId("all");
    }
  };

  const handleAddSavedColor = (e: React.FormEvent) => {
    e.preventDefault();
    const now = Date.now();
    const created: SavedColor = {
      id: `sc-${now}`,
      hex: newColorHex.toUpperCase(),
      name: newColorName.trim() || `自选色 ${savedColors.length + 1}`,
      categoryId:
        selectedCategoryId !== "all" && selectedCategoryId !== "uncategorized"
          ? selectedCategoryId
          : null,
      createdAt: now,
    };
    onChangeSavedColors([created, ...savedColors]);
    setNewColorName("");
    setShowAddColorModal(false);
  };

  return (
    <div className="relative min-h-[70dvh] space-y-3.5 pb-20 select-none">
      {/* 1. Top Segmented Switcher & Category Bar — clean, no backdrop band / blur / heavy shadow */}
      <div className="relative z-20 pt-1 pb-1 space-y-2.5 pr-11 lg:pr-1.5">
        <div className="flex items-center justify-between gap-4 w-full">
          {/* Segmented Control: [涂装工程 | 单色色卡] */}
          <div className="bp-segmented inline-flex items-center rounded-full bg-[#EEF1F5] dark:bg-slate-800 p-1 min-w-0 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setLibraryMode("projects")}
              className={`bp-segmented-item flex items-center gap-1 sm:gap-1.5 rounded-full px-2.5 sm:px-4 py-1.5 text-[11px] sm:text-xs font-black transition cursor-pointer whitespace-nowrap shrink-0 tabular-nums ${
                libraryMode === "projects"
                  ? "bp-segmented-item-active bg-accent text-white shadow-sm"
                  : "text-[#334155] dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <StackIcon className="h-3.5 w-3.5 shrink-0" weight="bold" />
              <span>涂装工程 ({projects.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setLibraryMode("colors")}
              className={`bp-segmented-item flex items-center gap-1 sm:gap-1.5 rounded-full px-2.5 sm:px-4 py-1.5 text-[11px] sm:text-xs font-black transition cursor-pointer whitespace-nowrap shrink-0 tabular-nums ${
                libraryMode === "colors"
                  ? "bp-segmented-item-active bg-accent text-white shadow-sm"
                  : "text-[#334155] dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <PaletteIcon className="h-3.5 w-3.5 shrink-0" weight="bold" />
              <span>单色色卡 ({savedColors.length})</span>
            </button>
          </div>

          {/* Right Action Group: [🏷️ 管理分类] + [⤢ 宽屏模式 / ⤡ 恢复双栏] */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowCategoryManager(true)}
              className="bp-pill inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold text-[#334155] dark:text-slate-300 hover:text-accent hover:border-accent/40 transition cursor-pointer whitespace-nowrap shrink-0"
            >
              <TagIcon className="h-3.5 w-3.5 text-accent shrink-0" weight="bold" />
              <span>管理分类</span>
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
          </div>
        </div>

        {/* Lightweight Category Pill Bar (~29px) */}
        <div
          className={`transition-all duration-200 overflow-hidden ${
            isCategoryBarCollapsed ? "max-h-0 opacity-0 pointer-events-none" : "max-h-14 opacity-100"
          }`}
        >
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5 pb-1.5 pr-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedCategoryId("all");
              }}
              className={`h-[29px] px-3 rounded-full text-xs font-bold shrink-0 whitespace-nowrap transition cursor-pointer ${
                selectedCategoryId === "all"
                  ? "bp-pill-active bg-accent text-white"
                  : "bp-pill bg-[#EEF1F5] dark:bg-slate-800 text-[#334155] dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              全部
            </button>
            {categories.map((cat) => {
              const active = selectedCategoryId === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedCategoryId(cat.id);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setShowCategoryManager(true);
                  }}
                  className={`h-[29px] px-3 rounded-full text-xs font-bold shrink-0 whitespace-nowrap transition cursor-pointer ${
                    active
                      ? "bp-pill-active bg-accent text-white"
                      : "bp-pill bg-[#EEF1F5] dark:bg-slate-800 text-[#334155] dark:text-slate-300 hover:bg-slate-200"
                  }`}
                >
                  {cat.name}
                </button>
              );
            })}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedCategoryId("uncategorized");
              }}
              className={`h-[29px] px-3 rounded-full text-xs font-bold shrink-0 whitespace-nowrap transition cursor-pointer ${
                selectedCategoryId === "uncategorized"
                  ? "bp-pill-active bg-accent text-white"
                  : "bp-pill bg-[#EEF1F5] dark:bg-slate-800 text-[#334155] dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              未分类
            </button>
          </div>
        </div>

        {/* Contextual Workflow Guide Banner */}
        <div className="rounded-2xl border border-amber-300/75 dark:border-amber-700/65 bg-amber-50/85 dark:bg-amber-950/30 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <div className="text-amber-900 dark:text-amber-200 leading-snug">
            <span className="font-black">🧭 操作提示：</span>
            {libraryMode === "projects"
              ? "点开任意涂装工程文件夹，即可继续添加「涂装工序」、生成模友可扫码导入的「二维码名片」，或在右上角菜单打包导出「.gkmix 工程文件」。"
              : "「单色色卡」仅保存纯单色块；若需保存零件色卡图、添加喷涂工序、生成二维码名片或打包项目文件，请存入「涂装工程」！"}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowScanPosterModal(true)}
              className="bp-pill inline-flex items-center gap-1 rounded-full border border-amber-400/80 bg-white dark:bg-slate-900 px-2.5 py-1 text-[10px] font-extrabold text-amber-800 dark:text-amber-200 hover:border-accent cursor-pointer"
            >
              <QrCodeIcon className="h-3 w-3 text-accent shrink-0" weight="bold" />
              <span>扫码导入名片</span>
            </button>
            <button
              type="button"
              onClick={() => gkmixInputRef.current?.click()}
              className="bp-pill inline-flex items-center gap-1 rounded-full border border-amber-400/80 bg-white dark:bg-slate-900 px-2.5 py-1 text-[10px] font-extrabold text-amber-800 dark:text-amber-200 hover:border-accent cursor-pointer"
            >
              <DownloadSimpleIcon className="h-3 w-3 text-accent shrink-0" weight="bold" />
              <span>导入 .gkmix</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Main Content Area: Projects Grid vs Single Color Swatches Grid */}
      {libraryMode === "projects" ? (
        filteredProjects.length === 0 ? (
          <div className="bp-dashed-box rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 p-8 sm:p-10 text-center space-y-3">
            <div className="bp-badge mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <StackIcon className="h-6 w-6" weight="bold" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                当前分类暂无涂装工程
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                可在「混色台 - 拾色」制作色卡后保存至工程，或点击右下角「+」新建工程、扫码还原海报、导入 .gkmix 工程文件。
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowNewProjectModal(true)}
                className="bp-pill-active rounded-full bg-accent hover:bg-accent-hover px-4 py-2 text-xs font-black text-white shadow-sm whitespace-nowrap cursor-pointer"
              >
                + 新建涂装工程
              </button>
              <button
                type="button"
                onClick={() => setShowScanPosterModal(true)}
                className="bp-pill rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap cursor-pointer"
              >
                海报扫码还原
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-[repeat(auto-fill,minmax(230px,270px))] md:gap-5 pr-2 pb-2">
            {filteredProjects.map((proj) => {
              const cat = categories.find((c) => c.id === proj.categoryId);
              const allNodes = proj.parts.flatMap((pt) => pt.nodes);
              const coverUrl = getEffectiveProjectCover(proj);
              const isMenuOpen = cardMenuId === proj.id;

              return (
                <div
                  key={proj.id}
                  onClick={() => setActiveProjectId(proj.id)}
                  className={`bp-project-card group relative ${
                    isMenuOpen ? "z-50" : "z-10"
                  } flex flex-col rounded-2xl sm:rounded-3xl border border-slate-200/85 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:shadow-lg hover:border-accent/50 transition cursor-pointer`}
                >
                  {/* Top-Level Quick Card Menu Trigger (outside cover overflow-hidden) */}
                  <div
                    className="absolute right-2 top-2 sm:right-2.5 sm:top-2.5 z-30"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (cardMenuId === proj.id) {
                          setCardMenuId(null);
                          setCardMenuAnchor(null);
                        } else {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setCardMenuAnchor({
                            top: rect.top,
                            bottom: rect.bottom,
                            left: rect.left,
                            right: rect.right,
                            isMobile: window.innerWidth < 768,
                          });
                          setCardMenuId(proj.id);
                        }
                      }}
                      className="bp-badge flex h-7 w-7 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-slate-900/80 text-white backdrop-blur-md hover:bg-slate-900 shadow-sm cursor-pointer"
                      aria-label="更多操作"
                    >
                      <DotsThreeIcon className="h-4 w-4" weight="bold" />
                    </button>
                  </div>

                  {/* Cover Preview (4:3 on mobile 2-col grid, h-40 on sm+ desktop) */}
                  <div className="bp-cover-top relative aspect-[4/3] sm:aspect-auto sm:h-40 w-full rounded-t-2xl sm:rounded-t-3xl bg-slate-950 overflow-hidden">
                    {coverUrl ? (
                      <img
                        src={coverUrl}
                        alt={proj.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-600">
                        <StackIcon className="h-8 w-8 sm:h-10 sm:w-10 opacity-40" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/15 to-transparent" />

                    {/* Top badges */}
                    <div className="absolute left-2 top-2 sm:left-3 sm:top-3 flex items-center gap-1 max-w-[calc(100%-44px)] overflow-hidden">
                      <span className="bp-badge rounded-full bg-slate-900/75 backdrop-blur-md border border-white/15 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold text-white whitespace-nowrap shrink-0 tabular-nums">
                        {proj.parts.length} 个零件
                      </span>
                      {cat && (
                        <span className="bp-badge hidden sm:inline-block rounded-full bg-accent/90 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold text-white truncate">
                          {cat.name}
                        </span>
                      )}
                    </div>

                    {/* Bottom Swatch Dots Strip */}
                    {allNodes.length > 0 && (
                      <div className="absolute bottom-2 left-2 right-2 sm:bottom-2.5 sm:left-3 sm:right-3 flex items-center justify-between gap-1">
                        <div className="flex -space-x-1 sm:-space-x-1.5 overflow-hidden">
                          {allNodes.slice(0, 5).map((n) => (
                            <span
                              key={n.id}
                              className="bp-dot inline-block h-3.5 w-3.5 sm:h-5 sm:w-5 rounded-full border border-white sm:border-2 shadow-xs shrink-0"
                              style={{ backgroundColor: n.hex }}
                              title={`${n.paintBrand} ${n.paintCode} ${n.paintName}`}
                            />
                          ))}
                        </div>
                        <span className="font-mono text-[9px] sm:text-[10px] font-bold text-white/95 whitespace-nowrap shrink-0 tabular-nums">
                          {allNodes.length}款油漆
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card Info Footer */}
                  <div className="bp-top-divider bp-card-bottom rounded-b-2xl sm:rounded-b-3xl bg-white dark:bg-slate-900 p-2.5 sm:p-3.5 flex flex-col justify-between gap-0.5">
                    <div className="flex items-center justify-between gap-1.5 min-w-0">
                      <h4 className="truncate text-xs sm:text-sm font-black text-slate-900 dark:text-white group-hover:text-accent transition">
                        {proj.title}
                      </h4>
                      {cat && (
                        <span className="bp-badge sm:hidden shrink-0 rounded-md bg-accent/10 px-1.5 py-0.5 text-[9px] font-bold text-accent whitespace-nowrap">
                          {cat.name}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                      {proj.parts.map((pt) => pt.partName).join(" · ") || "点击添加零件图"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Single Color Swatches View (单色色卡) */
        <div className="space-y-3 pr-2 pb-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              共收藏 {filteredColors.length} 个单色色卡
            </span>
            <button
              type="button"
              onClick={() => setShowAddColorModal(true)}
              className="bp-pill-active inline-flex items-center gap-1 rounded-full bg-coral px-3.5 py-1.5 text-xs font-extrabold text-white shadow-xs cursor-pointer"
            >
              <PlusIcon className="h-3.5 w-3.5" weight="bold" />
              <span>新增单色色卡</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:grid-cols-[repeat(auto-fill,minmax(200px,230px))] md:gap-4">
            {filteredColors.map((item) => {
              const cat = categories.find((c) => c.id === item.categoryId);
              return (
                <div
                  key={item.id}
                  className="bp-project-card w-full md:max-w-[240px] rounded-2xl border border-slate-200/85 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs flex flex-col justify-between"
                >
                  <div
                    className="bp-bottom-divider h-20 md:h-24 w-full relative p-2 flex items-start justify-between"
                    style={{ backgroundColor: item.hex }}
                  >
                    {cat && (
                      <span className="bp-badge rounded-md bg-black/35 backdrop-blur-xs px-1.5 py-0.5 text-[9px] font-bold text-white">
                        {cat.name}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        onChangeSavedColors(savedColors.filter((c) => c.id !== item.id))
                      }
                      className="bp-badge ml-auto flex h-6 w-6 items-center justify-center rounded-full bg-black/30 text-white hover:bg-rose-600 transition"
                      title="删除色卡"
                    >
                      <TrashIcon className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="p-2.5 space-y-2">
                    <div>
                      <div className="truncate text-xs font-extrabold text-slate-900 dark:text-white">
                        {item.name}
                      </div>
                      <div className="font-mono text-[11px] font-bold text-slate-400">
                        {item.hex}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(item.hex);
                          setCopiedHex(item.hex);
                          setTimeout(() => setCopiedHex(""), 1500);
                        }}
                        className="bp-btn flex-1 flex items-center justify-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 py-1 md:h-8 md:py-0 text-[10px] md:text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200"
                      >
                        {copiedHex === item.hex ? (
                          <>
                            <CheckIcon className="h-3 w-3 text-emerald-500" />
                            <span>已复制</span>
                          </>
                        ) : (
                          <>
                            <CopyIcon className="h-3 w-3" />
                            <span>复制</span>
                          </>
                        )}
                      </button>
                      {onSendColorToWorkbench && (
                        <button
                          type="button"
                          onClick={() => onSendColorToWorkbench(item.hex)}
                          className="bp-use-btn shrink-0 flex items-center justify-center gap-1 rounded-lg md:rounded-full bg-coral/10 px-2 md:px-3 py-1 md:h-8 md:py-0 text-[10px] md:text-xs font-bold text-coral hover:bg-coral hover:text-white transition"
                          title="发送至混色台"
                        >
                          <FlaskIcon className="h-3 w-3" weight="bold" />
                          <span>调配</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Bottom-Right Floating Circular + Button (52x52 clean white FAB) */}
      <div className="fixed bottom-24 lg:bottom-8 right-5 z-30 overflow-visible">
        {showFabMenu && (
          <div className="bp-subcard-lg absolute bottom-[64px] right-0 w-56 rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 p-1.5 shadow-[0_12px_32px_rgba(15,23,42,0.14)] space-y-0.5 animate-fadeIn">
            <button
              type="button"
              onClick={() => {
                setShowFabMenu(false);
                setShowNewProjectModal(true);
              }}
              className="w-full flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-left text-xs font-extrabold text-slate-800 dark:text-slate-100 hover:bg-accent/10 hover:text-accent transition whitespace-nowrap"
            >
              <FolderPlusIcon className="h-4 w-4 text-accent shrink-0" weight="bold" />
              <span>新建涂装工程</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowFabMenu(false);
                setShowScanPosterModal(true);
              }}
              className="w-full flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-left text-xs font-extrabold text-slate-800 dark:text-slate-100 hover:bg-accent/10 hover:text-accent transition whitespace-nowrap"
            >
              <QrCodeIcon className="h-4 w-4 text-accent shrink-0" weight="bold" />
              <span>海报扫码还原</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowFabMenu(false);
                gkmixInputRef.current?.click();
              }}
              className="w-full flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-left text-xs font-extrabold text-slate-800 dark:text-slate-100 hover:bg-accent/10 hover:text-accent transition whitespace-nowrap"
            >
              <DownloadSimpleIcon className="h-4 w-4 text-accent shrink-0" weight="bold" />
              <span>导入 .gkmix 工程</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowFabMenu(false);
                setShowCategoryManager(true);
              }}
              className="w-full flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-left text-xs font-extrabold text-slate-800 dark:text-slate-100 hover:bg-accent/10 hover:text-accent transition whitespace-nowrap"
            >
              <TagIcon className="h-4 w-4 text-accent shrink-0" weight="bold" />
              <span>新建/管理分类...</span>
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowFabMenu((v) => !v)}
          style={{ width: "52px", height: "52px" }}
          className="bp-fab flex items-center justify-center rounded-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 text-accent shadow-[0_4px_16px_rgba(15,23,42,0.10)] hover:scale-105 active:scale-95 transition cursor-pointer"
          title="新建或导入涂装工程"
        >
          <PlusIcon
            className={`h-6 w-6 transition-transform duration-200 ${
              showFabMenu ? "rotate-45" : ""
            }`}
            weight="bold"
          />
        </button>

        <input
          ref={gkmixInputRef}
          type="file"
          accept=".gkmix,application/octet-stream,application/json"
          onChange={handleImportGKMixFile}
          className="hidden"
        />
      </div>

      {/* Modal 1: 新建涂装工程 — Mobile Bottom Sheet / Desktop FAB Popover */}
      <ResponsiveSheet
        open={showNewProjectModal}
        onClose={() => setShowNewProjectModal(false)}
        title="新建涂装工程"
        desktopPlacement="fab"
      >
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#334155] dark:text-slate-300">
                  工程名称
                </label>
                <input
                  type="text"
                  value={newProjectTitle}
                  onChange={(e) => setNewProjectTitle(e.target.value)}
                  placeholder="例如：MG 卡牛 Ver.Ka 外甲涂装"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#334155] dark:text-slate-300">
                  所属分类
                </label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setNewProjectCatId(null)}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                      newProjectCatId === null
                        ? "bg-accent text-white"
                        : "bg-[#EEF1F5] dark:bg-slate-800 text-[#334155] dark:text-slate-300 hover:bg-slate-200"
                    }`}
                  >
                    未分类
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setNewProjectCatId(c.id)}
                      className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                        newProjectCatId === c.id
                          ? "bg-accent text-white"
                          : "bg-[#EEF1F5] dark:bg-slate-800 text-[#334155] dark:text-slate-300 hover:bg-slate-200"
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-[#334155] dark:text-slate-300">
                  首张零件参考图 (可选)
                </label>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCoverUpload}
                  className="hidden"
                />
                {newProjectCover ? (
                  <div className="mt-1.5 flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5">
                    <img
                      src={newProjectCover}
                      alt="零件图预览"
                      className="h-16 w-16 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0 shadow-xs"
                    />
                    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        已选择参考底图
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => coverInputRef.current?.click()}
                          className="rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-2.5 py-1 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-accent transition"
                        >
                          重新选择
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewProjectCover("")}
                          className="rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 px-2.5 py-1 text-xs font-bold hover:bg-rose-100 transition"
                        >
                          删除底图
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    className="mt-1.5 w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 py-4 text-xs font-bold text-slate-500 hover:border-accent hover:text-accent transition cursor-pointer"
                  >
                    <UploadSimpleIcon className="h-4 w-4" />
                    <span>点击上传零件参考图（自动设为工程封面与首个零件底图）</span>
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="w-full rounded-2xl bg-accent hover:bg-accent-hover active:scale-[0.98] py-3 text-sm font-semibold text-white shadow-sm transition"
              >
                创建工程
              </button>
            </form>
      </ResponsiveSheet>

      {/* Modal 2: 海报扫码还原 (支持图片上传解码 + gkm1 工程码直接粘贴) */}
      <ResponsiveSheet
        open={showScanPosterModal}
        onClose={() => setShowScanPosterModal(false)}
        title="海报扫码还原涂装工程"
        icon={<QrCodeIcon className="h-5 w-5 text-accent" weight="bold" />}
        desktopPlacement="fab"
      >
            <form onSubmit={handleRestorePoster} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-[#334155] dark:text-slate-300">
                  方式一：上传 GKMixer 分享名片海报图片
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setScanPosterFile(e.target.files?.[0] || null)}
                  className="mt-1.5 block w-full text-xs text-slate-500 file:mr-3 file:rounded-full file:border-0 file:bg-accent/15 file:px-3.5 file:py-1.5 file:text-xs file:font-bold file:text-accent"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#334155] dark:text-slate-300">
                  方式二：或直接粘贴 gkm1: 工程码字符串
                </label>
                <textarea
                  rows={3}
                  value={manualGkmCode}
                  onChange={(e) => setManualGkmCode(e.target.value)}
                  placeholder="gkm1:eJx..."
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 font-mono text-xs outline-none focus:border-accent"
                />
              </div>
              {scanError && (
                <p className="text-xs font-bold text-rose-500">{scanError}</p>
              )}
              <button
                type="submit"
                disabled={isScanning}
                className="w-full rounded-2xl bg-accent hover:bg-accent-hover py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-50 transition"
              >
                {isScanning ? "正在解析还原工程…" : "立即还原为可编辑工程"}
              </button>
            </form>
      </ResponsiveSheet>

      {/* Modal 3: 分类管理 (新建 / 重命名 / 删除分类) */}
      <ResponsiveSheet
        open={showCategoryManager}
        onClose={() => setShowCategoryManager(false)}
        title="管理分类标签"
        desktopPlacement="fab"
      >
          <div className="space-y-4">
            <form onSubmit={handleAddCategory} className="flex gap-2">
              <input
                type="text"
                value={newCatInput}
                onChange={(e) => setNewCatInput(e.target.value)}
                placeholder="输入新分类名称…"
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold outline-none focus:border-accent"
              />
              <button
                type="submit"
                className="rounded-xl bg-accent hover:bg-accent-hover px-4 py-2 text-xs font-semibold text-white transition"
              >
                新建
              </button>
            </form>

            <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between gap-2 py-2.5"
                >
                  {editingCatId === cat.id ? (
                    <input
                      type="text"
                      value={editingCatName}
                      onChange={(e) => setEditingCatName(e.target.value)}
                      onBlur={() => handleRenameCategory(cat.id, editingCatName)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleRenameCategory(cat.id, editingCatName)
                      }
                      autoFocus
                      className="flex-1 rounded-lg border border-accent px-2.5 py-1 text-xs font-bold outline-none"
                    />
                  ) : (
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      {cat.name}
                    </span>
                  )}

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCatId(cat.id);
                        setEditingCatName(cat.name);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-accent"
                    >
                      <PencilSimpleIcon className="h-3 w-3" />
                      <span>重命名</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="inline-flex items-center gap-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-100"
                    >
                      <TrashIcon className="h-3 w-3" />
                      <span>删除</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
      </ResponsiveSheet>

      {/* Modal 4: 新增单色色卡 */}
      <ResponsiveSheet
        open={showAddColorModal}
        onClose={() => setShowAddColorModal(false)}
        title="新增单色色卡"
        desktopPlacement="center"
        desktopWidth={380}
      >
            <form onSubmit={handleAddSavedColor} className="space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={newColorHex}
                  onChange={(e) => setNewColorHex(e.target.value.toUpperCase())}
                  className="h-12 w-12 rounded-xl cursor-pointer border-0"
                />
                <input
                  type="text"
                  value={newColorHex}
                  onChange={(e) => setNewColorHex(e.target.value.toUpperCase())}
                  className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono text-xs font-bold outline-none focus:border-accent"
                />
              </div>
              <input
                type="text"
                value={newColorName}
                onChange={(e) => setNewColorName(e.target.value)}
                placeholder="色卡备注名称 (如：卡牛外甲深蓝)"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold outline-none focus:border-accent"
              />
              <button
                type="submit"
                className="w-full rounded-2xl bg-accent hover:bg-accent-hover py-3 text-sm font-semibold text-white shadow-sm transition"
              >
                保存单色色卡
              </button>
            </form>
      </ResponsiveSheet>

      {/* Modal 5: 从项目零件中选择封面 */}
      <ResponsiveSheet
        open={Boolean(partCoverPickerProject)}
        onClose={() => setPartCoverPickerProject(null)}
        title="选择零件设为项目封面"
        icon={<ImageSquareIcon className="h-5 w-5 text-accent" weight="bold" />}
        desktopPlacement="center"
        desktopWidth={480}
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            点选下方任一零件图，将其设为工程在外层列表展示的卡片封面：
          </p>
          <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto p-1">
            {partCoverPickerProject?.parts
              .filter((p) => Boolean(p.sourceImageDataUrl))
              .map((pt, idx) => (
                <button
                  key={pt.id}
                  type="button"
                  onClick={async () => {
                    if (!partCoverPickerProject) return;
                    const thumb = await createCoverThumbnail(pt.sourceImageDataUrl);
                    const updated = projects.map((p) =>
                      p.id === partCoverPickerProject.id
                        ? {
                            ...p,
                            customCoverImageDataUrl: thumb,
                            coverImageDataUrl: thumb,
                            updatedAt: Date.now(),
                          }
                        : p
                    );
                    onChangeProjects(updated);
                    setPartCoverPickerProject(null);
                  }}
                  className="group relative flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 p-2 text-left hover:border-accent hover:shadow-md transition cursor-pointer"
                >
                  <img
                    src={pt.sourceImageDataUrl}
                    alt={pt.partName}
                    className="aspect-[4/3] w-full rounded-xl object-cover border border-slate-200/60 dark:border-slate-700/60"
                  />
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                      {pt.partName || `零件 ${idx + 1}`}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {pt.nodes.length}标色
                    </span>
                  </div>
                </button>
              ))}
          </div>
        </div>
      </ResponsiveSheet>

      {/* Portal Card Quick Menu (Mobile Action Sheet + Desktop Unclipped Fixed Popover) */}
      {(() => {
        const menuProject = cardMenuId ? projects.find((p) => p.id === cardMenuId) : null;
        if (!menuProject || typeof document === "undefined") return null;
        const closeMenu = () => {
          setCardMenuId(null);
          setCardMenuAnchor(null);
        };
        const isMobileSheet = cardMenuAnchor ? cardMenuAnchor.isMobile : window.innerWidth < 768;

        if (isMobileSheet) {
          return createPortal(
            <div
              translate="no"
              className="notranslate fixed inset-0 z-[999] flex items-end justify-center bg-slate-950/45 backdrop-blur-[2px] p-3 pb-[max(0.85rem,env(safe-area-inset-bottom,0.85rem))]"
              onClick={closeMenu}
            >
              <div
                className="bp-subcard-lg w-full max-w-sm rounded-3xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-2xl space-y-1.5 animate-fadeIn"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bp-dashed-header flex items-center justify-between px-2.5 pt-1 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      工程快捷操作
                    </div>
                    <div className="truncate text-sm font-black text-slate-900 dark:text-white">
                      {menuProject.title}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={closeMenu}
                    className="bp-badge flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white"
                  >
                    <XIcon className="h-3.5 w-3.5" weight="bold" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    closeMenu();
                    setCustomCoverTargetProj(menuProject);
                    customCoverInputRef.current?.click();
                  }}
                  className="w-full flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-left text-xs font-extrabold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
                >
                  <ImageSquareIcon className="h-4 w-4 text-accent shrink-0" weight="bold" />
                  <span>上传成品封面...</span>
                </button>

                {menuProject.parts.some((p) => Boolean(p.sourceImageDataUrl)) && (
                  <button
                    type="button"
                    onClick={() => {
                      closeMenu();
                      setPartCoverPickerProject(menuProject);
                    }}
                    className="w-full flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-left text-xs font-extrabold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
                  >
                    <StackIcon className="h-4 w-4 text-accent shrink-0" weight="bold" />
                    <span>从零件图中选择封面...</span>
                  </button>
                )}

                {menuProject.customCoverImageDataUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      closeMenu();
                      handleResetCoverToDefault(menuProject);
                    }}
                    className="w-full flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-left text-xs font-extrabold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
                  >
                    <ArrowCounterClockwiseIcon className="h-4 w-4 text-slate-400 shrink-0" weight="bold" />
                    <span>恢复默认零件封面</span>
                  </button>
                )}

                <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />

                <button
                  type="button"
                  onClick={() => {
                    closeMenu();
                    exportGKMixArchive(menuProject);
                  }}
                  className="w-full flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-left text-xs font-extrabold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
                >
                  <DownloadSimpleIcon className="h-4 w-4 text-accent shrink-0" weight="bold" />
                  <span>导出 .gkmix 工程文件</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    closeMenu();
                    onChangeProjects(projects.filter((p) => p.id !== menuProject.id));
                  }}
                  className="w-full flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-left text-xs font-extrabold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 whitespace-nowrap"
                >
                  <TrashIcon className="h-4 w-4 shrink-0" weight="bold" />
                  <span>删除工程</span>
                </button>

                <button
                  type="button"
                  onClick={closeMenu}
                  className="bp-btn mt-1 w-full rounded-2xl bg-slate-100 dark:bg-slate-800 py-2.5 text-center text-xs font-extrabold text-slate-600 dark:text-slate-300"
                >
                  取消
                </button>
              </div>
            </div>,
            document.body
          );
        }

        const popTop = Math.min(
          window.innerHeight - 230,
          Math.max(12, (cardMenuAnchor?.bottom ?? 120) + 6)
        );
        const popLeft = Math.min(
          window.innerWidth - 220,
          Math.max(12, (cardMenuAnchor?.right ?? 240) - 208)
        );

        return createPortal(
          <div
            translate="no"
            className="notranslate fixed inset-0 z-[999]"
            onClick={closeMenu}
          >
            <div
              style={{ top: `${popTop}px`, left: `${popLeft}px` }}
              className="bp-subcard-lg fixed w-52 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1.5 shadow-2xl space-y-0.5 animate-fadeIn"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  closeMenu();
                  setCustomCoverTargetProj(menuProject);
                  customCoverInputRef.current?.click();
                }}
                className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
              >
                <ImageSquareIcon className="h-3.5 w-3.5 text-accent shrink-0" weight="bold" />
                <span>上传成品封面...</span>
              </button>

              {menuProject.parts.some((p) => Boolean(p.sourceImageDataUrl)) && (
                <button
                  type="button"
                  onClick={() => {
                    closeMenu();
                    setPartCoverPickerProject(menuProject);
                  }}
                  className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
                >
                  <StackIcon className="h-3.5 w-3.5 text-accent shrink-0" weight="bold" />
                  <span>从零件图中选择...</span>
                </button>
              )}

              {menuProject.customCoverImageDataUrl && (
                <button
                  type="button"
                  onClick={() => {
                    closeMenu();
                    handleResetCoverToDefault(menuProject);
                  }}
                  className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
                >
                  <ArrowCounterClockwiseIcon className="h-3.5 w-3.5 text-slate-400 shrink-0" weight="bold" />
                  <span>恢复默认零件封面</span>
                </button>
              )}

              <div className="h-px bg-slate-100 dark:bg-slate-800 my-0.5" />

              <button
                type="button"
                onClick={() => {
                  closeMenu();
                  exportGKMixArchive(menuProject);
                }}
                className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
              >
                <DownloadSimpleIcon className="h-3.5 w-3.5 text-accent shrink-0" weight="bold" />
                <span>导出 .gkmix</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  closeMenu();
                  onChangeProjects(projects.filter((p) => p.id !== menuProject.id));
                }}
                className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 whitespace-nowrap cursor-pointer"
              >
                <TrashIcon className="h-3.5 w-3.5 shrink-0" weight="bold" />
                <span>删除工程</span>
              </button>
            </div>
          </div>,
          document.body
        );
      })()}

      <input
        ref={customCoverInputRef}
        type="file"
        accept="image/*"
        onChange={handleCustomCoverUpload}
        className="hidden"
      />
    </div>
  );
};

export default ProjectLibraryView;
