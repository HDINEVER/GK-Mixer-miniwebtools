import React, { useState, useRef, useEffect, useCallback, useMemo, startTransition } from 'react';
import { App as KonstaApp } from 'konsta/react';
import {
  SunIcon,
  MoonIcon,
  GearIcon,
  ListIcon,
  PaletteIcon,
  CrosshairIcon,
  SparkleIcon,
  SlidersHorizontalIcon,
  DropIcon,
  SwatchesIcon,
  DatabaseIcon,
  FlaskIcon,
  TrashIcon,
  DownloadSimpleIcon,
  XIcon,
  SquaresFour as SquaresFourIcon,
  Stack as StackIcon,
  DotsThree as DotsThreeIcon,
  FolderPlus as FolderPlusIcon,
  Tag as TagIcon,
  CheckCircle as CheckCircleIcon,
} from '@phosphor-icons/react';
import SettingsModal from './components/SettingsModal';
import DropZone from './components/DropZone';
import ColorPalette from './components/ColorPalette';
import MixerResult from './components/MixerResult';
import ChromaStudioPanel from './components/ChromaStudioPanel';
import PaletteVisualizer from './components/PaletteVisualizer';
import RadialPaletteMixer from './components/RadialPaletteMixer';
import BasicColorMixer from './components/BasicColorMixer';
import PaintCatalogBrowser from './components/PaintCatalogBrowser';
import BrandMatchPanel from './components/BrandMatchPanel';
import { ProjectLibraryView } from './components/ProjectLibraryView';
import { SwatchEditorModal } from './components/SwatchEditorModal';
import { SaveToProjectModal } from './components/SaveToProjectModal';
import QuickPaintAssignSheet from './components/QuickPaintAssignSheet';
import ColoringSandboxLab, { SandboxSyncPayload } from './components/ColoringSandboxLab';
import DualBrandPaintMixerCard from './components/DualBrandPaintMixerCard';
import WorkflowGuideModal from './components/WorkflowGuideModal';
import ColorLoupe, { ColorLoupeHandle, resolveTouchSamplePoint, sampleCanvasAtClient } from './components/ColorLoupe';
import ExtractMarkerOverlay from './components/ExtractMarkerOverlay';
import SwatchStudioControls from './components/SwatchStudioControls';
import Loader from './components/Loader';
import KeepAlivePanel from './components/KeepAlivePanel';
import ErrorBoundary from './components/ErrorBoundary';
import {
  ColorData,
  AppMode,
  RGB,
  Language,
  Theme,
  ColorSpace,
  MixerResultCache,
  RadialMixerCache,
  SliderState,
  BasicMixerCache,
  BaseColor,
  CatalogPaint,
  PaintProject,
  PaletteCategory,
  SavedColor,
  PartCanvas,
  TonalStep,
} from './types';
import { generateId, rgbToCmyk, rgbToHex, hexToRgb, rgbToHsb, rgbToLab } from './utils/colorUtils';
import { convertToWorkingSpace } from './utils/colorSpaceConverter';
import { translations } from './utils/translations';
import { colorsToMarkers, exportAnnotatedImage, ExportResult } from './utils/exportAnnotatedImage';
import { ExportSuccessModal } from './components/ExportSuccessModal';
import { loadPaintCatalog, localizedBrand } from './utils/paintCatalog';
import {
  loadStudioData,
  saveProjectsToDB,
  saveCategoriesToDB,
  saveColorsToDB,
  colorsToFloatingNodes,
} from './utils/projectStore';
import { inferStepsFromNodes } from './utils/projectSharing';
import {
  SwatchSettings,
  DEFAULT_SWATCH_SETTINGS,
  autoArrangeLeftRight,
  autoArrangeTopBottom,
  alignMarkers,
  resetMarkerPositions,
  getCanvasMarginRecord,
} from './utils/swatchLayout';
import {
  UIStyle,
  WorkflowMode,
  THEME_SYNC_EVENT,
  loadUIStyle,
  saveUIStyle,
  loadWorkflowMode,
  saveWorkflowMode,
  loadHideTopBar,
} from './utils/accentTheme';

// Default base colors for BasicColorMixer
const DEFAULT_BASE_COLORS: BaseColor[] = [
  { id: 'gaia-001', brand: 'Gaia', code: '001', name: '光泽白', hex: '#FFFFFF' },
  { id: 'gaia-002', brand: 'Gaia', code: '002', name: '光泽黑', hex: '#000000' },
  { id: 'gaia-003', brand: 'Gaia', code: '003', name: '光泽红', hex: '#E60012' },
  { id: 'gaia-004', brand: 'Gaia', code: '004', name: '光泽蓝', hex: '#004098' },
  { id: 'gaia-005', brand: 'Gaia', code: '005', name: '光泽黄', hex: '#FFD900' },
  { id: 'process-cyan', brand: 'Process', code: 'C', name: '印刷青', hex: '#00B7EB' },
  { id: 'process-magenta', brand: 'Process', code: 'M', name: '印刷品红', hex: '#FF0090' },
  { id: 'process-yellow', brand: 'Process', code: 'Y', name: '印刷黄', hex: '#FFEF00' },
];

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.ANALYZE);
  const [lang, setLang] = useState<Language>('zh');
  const [theme, setTheme] = useState<Theme>('light');
  const [uiStyle, setUiStyle] = useState<UIStyle>(() => loadUIStyle());
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>(() => loadWorkflowMode());
  const [hideTopBar, setHideTopBar] = useState<boolean>(() => loadHideTopBar());
  const [showAdvancedNavMenu, setShowAdvancedNavMenu] = useState(false);
  const [colorSpace, setColorSpace] = useState<ColorSpace>('srgb');

  useEffect(() => {
    const syncStyle = () => {
      setUiStyle(loadUIStyle());
      setHideTopBar(loadHideTopBar());
      const nextWf = loadWorkflowMode();
      setWorkflowMode((prev) => {
        if (prev !== nextWf && nextWf === 'beginner') {
          setDesktopTabUI('coloring');
          setDesktopTab('coloring');
          setMobileMainTab('coloring');
        }
        return nextWf;
      });
    };
    window.addEventListener(THEME_SYNC_EVENT, syncStyle);
    return () => window.removeEventListener(THEME_SYNC_EVENT, syncStyle);
  }, []);
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [colors, setColors] = useState<ColorData[]>([]);
  const [selectedColorId, setSelectedColorId] = useState<string | null>(null);

  // === Studio IndexedDB Persistence (Projects, Categories, Saved Single-Color Swatches) ===
  const [catalogPaints, setCatalogPaints] = useState<CatalogPaint[]>([]);
  const [projects, setProjects] = useState<PaintProject[]>([]);
  const [categories, setCategories] = useState<PaletteCategory[]>([]);
  const [savedColors, setSavedColors] = useState<SavedColor[]>([]);
  const [studioLoaded, setStudioLoaded] = useState(false);

  // Modals & Tonal Redirection State
  const [isSwatchEditorOpen, setIsSwatchEditorOpen] = useState(false);
  const [isSaveToProjectOpen, setIsSaveToProjectOpen] = useState(false);
  const [isSourceActionMenuOpen, setIsSourceActionMenuOpen] = useState(false);
  const [quickAssignColorId, setQuickAssignColorId] = useState<string | null>(null);
  const [pendingTonalSampleId, setPendingTonalSampleId] = useState<string | null>(null);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const sourceActionMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    loadPaintCatalog().then((paints) => {
      if (active) setCatalogPaints(paints);
    });
    loadStudioData().then((data) => {
      if (!active) return;
      setProjects(data.projects);
      setCategories(data.categories);
      setSavedColors(data.savedColors);
      setStudioLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!studioLoaded) return;
    const timer = window.setTimeout(() => {
      saveProjectsToDB(projects);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [projects, studioLoaded]);

  useEffect(() => {
    if (!studioLoaded) return;
    const timer = window.setTimeout(() => {
      saveCategoriesToDB(categories);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [categories, studioLoaded]);

  useEffect(() => {
    if (!studioLoaded) return;
    const timer = window.setTimeout(() => {
      saveColorsToDB(savedColors);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [savedColors, studioLoaded]);

  useEffect(() => {
    const noopTouch = () => {};
    document.addEventListener('touchstart', noopTouch, { passive: true });

    const BP_INTERACTIVE_SELECTOR = [
      '.bp-btn:not(:disabled)',
      '.bp-pill:not(:disabled)',
      '.bp-pill-active:not(:disabled)',
      '.bp-use-btn:not(:disabled)',
      '.bp-use-btn-used:not(:disabled)',
      '.bp-fab:not(:disabled)',
      '.bp-segmented-item:not(:disabled)',
      '.bp-segmented-item-active:not(:disabled)',
      '.gk-mech-btn:not(:disabled)',
      '.gk-mech-primary:not(:disabled)',
      '.gk-btn-primary:not(:disabled)',
      '.gk-btn-secondary:not(:disabled)',
      '.gk-tab-pill:not(:disabled)',
      '.gk-tab-pill-active:not(:disabled)',
      '.bp-delete-btn:not(:disabled)',
      '.bp-matrix-cell:not(:disabled)',
      '.bp-matrix-cell-active:not(:disabled)',
      '.bp-gray-step-btn:not(:disabled)',
      'button.bp-subcard:not(:disabled)',
      'button.bp-subcard-active:not(:disabled)',
      'label.bp-subcard',
      '.bp-subcard-interactive',
      '.bp-project-card',
      '.bp-extracted-card',
      'button[class*="shadow-["]:not(:disabled)',
      'label[class*="shadow-["]',
      'button[class*="rounded-"][class*="border"]:not([class*="border-b"]):not([class*="border-t"]):not([class*="border-0"]):not([class*="border-transparent"]):not(:disabled)',
    ].join(', ');

    const MIN_PRESS_HOLD_MS = 95;
    const MAX_PRESS_SAFETY_MS = 650;
    const activePresses = new Map<
      HTMLElement,
      { downAt: number; releaseTimer: number; safetyTimer: number }
    >();

    const clearPressedElement = (el: HTMLElement) => {
      const entry = activePresses.get(el);
      if (entry) {
        if (entry.releaseTimer) window.clearTimeout(entry.releaseTimer);
        if (entry.safetyTimer) window.clearTimeout(entry.safetyTimer);
        activePresses.delete(el);
      }
      el.removeAttribute('data-bp-pressed');
    };

    const handlePointerDownCapture = (e: PointerEvent) => {
      if (document.documentElement.getAttribute('data-ui-style') !== 'blueprint') return;
      if (!(e.target instanceof Element)) return;
      const target = e.target.closest(BP_INTERACTIVE_SELECTOR) as HTMLElement | null;
      if (!target) return;

      const existing = activePresses.get(target);
      if (existing) {
        if (existing.releaseTimer) window.clearTimeout(existing.releaseTimer);
        if (existing.safetyTimer) window.clearTimeout(existing.safetyTimer);
      }

      target.setAttribute('data-bp-pressed', 'true');
      const downAt = performance.now();
      const safetyTimer = window.setTimeout(() => {
        clearPressedElement(target);
      }, MAX_PRESS_SAFETY_MS);

      activePresses.set(target, { downAt, releaseTimer: 0, safetyTimer });
    };

    const handlePointerReleaseCapture = () => {
      if (activePresses.size === 0) return;
      const now = performance.now();
      activePresses.forEach((entry, el) => {
        if (entry.releaseTimer) return;
        const elapsed = now - entry.downAt;
        const remaining = Math.max(0, MIN_PRESS_HOLD_MS - elapsed);
        if (remaining === 0) {
          clearPressedElement(el);
        } else {
          entry.releaseTimer = window.setTimeout(() => {
            clearPressedElement(el);
          }, remaining);
        }
      });
    };

    document.addEventListener('pointerdown', handlePointerDownCapture, {
      capture: true,
      passive: true,
    });
    window.addEventListener('pointerup', handlePointerReleaseCapture, {
      capture: true,
      passive: true,
    });
    window.addEventListener('pointercancel', handlePointerReleaseCapture, {
      capture: true,
      passive: true,
    });

    return () => {
      document.removeEventListener('touchstart', noopTouch);
      document.removeEventListener('pointerdown', handlePointerDownCapture, {
        capture: true,
      });
      window.removeEventListener('pointerup', handlePointerReleaseCapture, {
        capture: true,
      });
      window.removeEventListener('pointercancel', handlePointerReleaseCapture, {
        capture: true,
      });
      activePresses.forEach((_entry, el) => clearPressedElement(el));
    };
  }, []);

  useEffect(() => {
    if (!isSourceActionMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (sourceActionMenuRef.current && !sourceActionMenuRef.current.contains(e.target as Node)) {
        setIsSourceActionMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isSourceActionMenuOpen]);

  const showToast = useCallback((msg: string) => {
    setActionToast(msg);
    setTimeout(() => {
      setActionToast((prev) => (prev === msg ? null : prev));
    }, 2600);
  }, []);

  // === iOS-style Navigation State ===
  // Mobile/Portrait: 5 core bottom dock tabs
  type MobileMainTab = 'workbench' | 'tuning' | 'coloring' | 'studio' | 'catalog';
  type WorkbenchSubpage = 'extract' | 'mixer' | 'chroma';
  type TuningSubpage = 'custom' | 'basic' | 'brands';
  type DesktopPanelTab = 'mixer' | 'chroma' | 'custom' | 'basic' | 'brands' | 'coloring' | 'studio' | 'catalog';

  const [mobileMainTab, setMobileMainTab] = useState<MobileMainTab>(() =>
    loadWorkflowMode() === 'beginner' ? 'coloring' : 'workbench'
  );
  const [workbenchSubpage, setWorkbenchSubpage] = useState<WorkbenchSubpage>('extract');
  const [tuningSubpage, setTuningSubpage] = useState<TuningSubpage>('custom');
  const [desktopTab, setDesktopTab] = useState<DesktopPanelTab>(() =>
    loadWorkflowMode() === 'beginner' ? 'coloring' : 'mixer'
  );
  const [coloringIncomingImage, setColoringIncomingImage] = useState<{
    url: string;
    label?: string;
    token: number;
  } | null>(null);
  const [focusProjectId, setFocusProjectId] = useState<string | null>(null);
  // Beginner Mode Sandbox -> Brand & Tint synced state
  const [sandboxSyncState, setSandboxSyncState] = useState<SandboxSyncPayload | null>(null);
  const [sandboxColors, setSandboxColors] = useState<ColorData[]>([]);
  const [selectedSandboxColorId, setSelectedSandboxColorId] = useState<string | null>(null);
  const [externalSandboxAssign, setExternalSandboxAssign] = useState<{
    targetHex: string;
    paint: CatalogPaint;
    token: number;
  } | null>(null);
  const [swatchEditorMode, setSwatchEditorMode] = useState<'pro' | 'sandbox'>('pro');
  const [beginnerOverrideHex, setBeginnerOverrideHex] = useState<string | null>(null);
  const [isWorkflowGuideOpen, setIsWorkflowGuideOpen] = useState<boolean>(false);
  // Urgent UI state for the desktop tab pill: updates synchronously on click so the
  // highlight responds instantly, while the heavy panel swap runs in a transition.
  const [desktopTabUI, setDesktopTabUI] = useState<DesktopPanelTab>(() =>
    loadWorkflowMode() === 'beginner' ? 'coloring' : 'mixer'
  );
  const [tabTransitionDir, setTabTransitionDir] = useState<'forward' | 'backward' | 'up'>('up');
  useEffect(() => {
    setDesktopTabUI(desktopTab);
  }, [desktopTab]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const DESKTOP_TAB_ORDER: DesktopPanelTab[] = ['mixer', 'chroma', 'custom', 'basic', 'brands', 'coloring', 'studio', 'catalog'];
  const MOBILE_TAB_ORDER: MobileMainTab[] = ['workbench', 'tuning', 'coloring', 'studio', 'catalog'];

  const resetPageScrollInstant = useCallback(() => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    } catch {
      window.scrollTo(0, 0);
    }
  }, []);

  const handleSwitchMobileTab = useCallback((tab: MobileMainTab) => {
    resetPageScrollInstant();
    // If re-tapping the active workbench tab while on mixer/chroma, cycle back to extract (iOS UX pattern)
    if (tab === mobileMainTab && tab === 'workbench' && workbenchSubpage !== 'extract') {
      setTabTransitionDir('backward');
      setWorkbenchSubpage('extract');
      return;
    }
    const prevIdx = MOBILE_TAB_ORDER.indexOf(mobileMainTab);
    const nextIdx = MOBILE_TAB_ORDER.indexOf(tab);
    setTabTransitionDir(nextIdx >= prevIdx ? 'forward' : 'backward');
    setMobileMainTab(tab);
    const nextDesktop: DesktopPanelTab =
      tab === 'workbench'
        ? workbenchSubpage === 'extract'
          ? 'mixer'
          : workbenchSubpage
        : tab === 'tuning'
        ? tuningSubpage
        : tab === 'coloring'
        ? 'coloring'
        : tab === 'studio'
        ? 'studio'
        : 'catalog';
    setDesktopTabUI(nextDesktop);
    setDesktopTab(nextDesktop);
  }, [mobileMainTab, workbenchSubpage, tuningSubpage, resetPageScrollInstant]);

  const handleSwitchWorkbenchSubpage = useCallback((sub: WorkbenchSubpage) => {
    resetPageScrollInstant();
    const order: WorkbenchSubpage[] = ['extract', 'mixer', 'chroma'];
    setTabTransitionDir(order.indexOf(sub) >= order.indexOf(workbenchSubpage) ? 'forward' : 'backward');
    setMobileMainTab('workbench');
    setWorkbenchSubpage(sub);
    if (sub !== 'extract') {
      setDesktopTabUI(sub);
      setDesktopTab(sub);
    }
  }, [workbenchSubpage, resetPageScrollInstant]);

  const handleSwitchTuningSubpage = useCallback((sub: TuningSubpage) => {
    resetPageScrollInstant();
    const order: TuningSubpage[] = ['custom', 'basic', 'brands'];
    setTabTransitionDir(order.indexOf(sub) >= order.indexOf(tuningSubpage) ? 'forward' : 'backward');
    setMobileMainTab('tuning');
    setTuningSubpage(sub);
    setDesktopTabUI(sub);
    setDesktopTab(sub);
  }, [tuningSubpage, resetPageScrollInstant]);

  const handleSwitchDesktopTab = useCallback((tab: DesktopPanelTab) => {
    resetPageScrollInstant();
    setShowAdvancedNavMenu(false);
    const prevIdx = DESKTOP_TAB_ORDER.indexOf(desktopTabUI);
    const nextIdx = DESKTOP_TAB_ORDER.indexOf(tab);
    setTabTransitionDir(nextIdx >= prevIdx ? 'forward' : 'backward');
    setDesktopTabUI(tab);
    setDesktopTab(tab);
    if (tab === 'mixer' || tab === 'chroma') {
      setMobileMainTab('workbench');
      setWorkbenchSubpage(tab);
    } else if (tab === 'custom' || tab === 'basic' || tab === 'brands') {
      setMobileMainTab('tuning');
      setTuningSubpage(tab);
    } else if (tab === 'coloring') {
      setMobileMainTab('coloring');
    } else if (tab === 'studio') {
      setMobileMainTab('studio');
    } else if (tab === 'catalog') {
      setMobileMainTab('catalog');
    }
  }, [desktopTabUI, resetPageScrollInstant]);

  const handleSelectWorkflowMode = useCallback(
    (nextMode: WorkflowMode) => {
      saveWorkflowMode(nextMode);
      setWorkflowMode(nextMode);
      setShowAdvancedNavMenu(false);
      if (nextMode === 'beginner') {
        handleSwitchDesktopTab('coloring');
        showToast(
          lang === 'zh'
            ? '🌱 已切换至「新手引导模式」：① 模拟试色 ➔ ② 选现成漆/微调 ➔ ③ 涂装库归档'
            : '🌱 Switched to Beginner Guided Workflow'
        );
      } else {
        showToast(
          lang === 'zh'
            ? '🛠️ 已切换至「专业喷涂模式」：完整 8 步硬核工作流已展开'
            : '🛠️ Switched to Pro Airbrush Workflow'
        );
      }
    },
    [handleSwitchDesktopTab, lang, showToast]
  );

  const handleSendImageToColoring = useCallback(
    (url: string, label?: string) => {
      if (!url) return;
      setColoringIncomingImage({ url, label, token: Date.now() });
      handleSwitchDesktopTab('coloring');
      showToast(
        lang === 'zh'
          ? '✨ 已载入模型图像，请在右侧明度色板选色试涂'
          : '✨ Loaded model image into Color Studio'
      );
    },
    [handleSwitchDesktopTab, lang, showToast]
  );

  // Swatch card display and leader line settings
  const [swatchSettings, setSwatchSettings] = useState<SwatchSettings>(() => {
    try {
      const saved = localStorage.getItem('gkmixer_swatch_settings');
      if (saved) return { ...DEFAULT_SWATCH_SETTINGS, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_SWATCH_SETTINGS;
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem('gkmixer_swatch_settings', JSON.stringify(swatchSettings));
      } catch {}
    }, 250);
    return () => window.clearTimeout(timer);
  }, [swatchSettings]);
  
  // === Cache states for preserving component states across tab switches ===
  // MixerResult cache
  const [mixerResultCache, setMixerResultCache] = useState<MixerResultCache>({
    mixingMode: 'mixbox',
    bottleVolume: 20
  });
  
  // RadialPaletteMixer cache
  const [radialMixerCache, setRadialMixerCache] = useState<RadialMixerCache>({
    sliders: [],
    cmyAdded: false,
    bwAdded: false,
    targetVolume: 20
  });
  
  // BasicColorMixer cache
  const [basicMixerCache, setBasicMixerCache] = useState<BasicMixerCache>({
    baseColors: DEFAULT_BASE_COLORS,
    mixRatios: DEFAULT_BASE_COLORS.map(() => 0),
    totalVolume: 20
  });
  
  // Ref for manual picker canvas
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loupeHandleRef = useRef<ColorLoupeHandle | null>(null);
  const [isPicking, setIsPicking] = useState(false);
  const [isContinuousPicking, setIsContinuousPicking] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);

  const hideLoupe = useCallback(() => {
    loupeHandleRef.current?.hide();
  }, []);

  // Zoom & Pan State
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const startPos = useRef({ x: 0, y: 0 });
  const currentOffset = useRef({ x: 0, y: 0 });
  const currentScale = useRef(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const changeImageInputRef = useRef<HTMLInputElement>(null);
  const [canvasBox, setCanvasBox] = useState({ left: 0, top: 0, width: 0, height: 0 });
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isWideVisualizer, setIsWideVisualizer] = useState(false);

  // Two-finger gesture tracking for zoom and drag/pan
  const twoFingerRef = useRef<{
    initialDist: number;
    initialScale: number;
    initialCenter: { x: number; y: number };
    initialOffset: { x: number; y: number };
  } | null>(null);
  const isSingleDragging = useRef(false);
  const touchPickRef = useRef<{
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    startTime: number;
  } | null>(null);
  const lastTouchCommitTimeRef = useRef<number>(0);

  useEffect(() => {
    currentScale.current = scale;
  }, [scale]);

  useEffect(() => {
    currentOffset.current = offset;
  }, [offset]);

  const selectedColor = colors.find(c => c.id === selectedColorId) || null;
  const t = translations[lang];
  const extractMarkers = useMemo(() => colorsToMarkers(colors), [colors]);

  const syncCanvasBox = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setCanvasBox({
      left: canvas.offsetLeft,
      top: canvas.offsetTop,
      width: canvas.offsetWidth,
      height: canvas.offsetHeight,
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sourceImage) return;
    syncCanvasBox();
    const observer = new ResizeObserver(syncCanvasBox);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [sourceImage, scale, syncCanvasBox]);

  // Dark Mode Effect
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const handleImageLoaded = (_file: File, img: HTMLImageElement) => {
    setSourceImage(img.src);
    // Reset zoom & automatically enable picking so touching the uploaded image immediately shows the thumb-front crosshair + magnifier
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setColors([]);
    setSelectedColorId(null);
    setIsPicking(true);
  };

  const handleManualAdd = () => {
    if (!sourceImage) return;
    setIsPicking(!isPicking);
    if (isPicking) {
      // 如果关闭取色模式,也关闭连续取色
      setIsContinuousPicking(false);
    }
  };

  const handleContinuousPick = () => {
    if (!sourceImage) return;
    const newContinuousState = !isContinuousPicking;
    setIsContinuousPicking(newContinuousState);
    if (newContinuousState) {
      // 开启连续取色时,自动开启取色模式
      setIsPicking(true);
    } else {
      // 关闭连续取色时,也关闭取色模式
      setIsPicking(false);
    }
  };

  const handleDeleteColor = (colorId: string) => {
    setColors(prev => prev.filter(c => c.id !== colorId));
    // If deleted color was selected, select the first remaining color or null
    if (selectedColorId === colorId) {
      const remaining = colors.filter(c => c.id !== colorId);
      setSelectedColorId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const buildSafeColorData = (
    rgbInput: RGB,
    opts?: { hex?: string; nx?: number; ny?: number }
  ): ColorData => {
    const safeR = Number.isFinite(rgbInput?.r) ? Math.max(0, Math.min(255, Math.round(rgbInput.r))) : 128;
    const safeG = Number.isFinite(rgbInput?.g) ? Math.max(0, Math.min(255, Math.round(rgbInput.g))) : 128;
    const safeB = Number.isFinite(rgbInput?.b) ? Math.max(0, Math.min(255, Math.round(rgbInput.b))) : 128;
    const rgb: RGB = { r: safeR, g: safeG, b: safeB };
    const computedHex = rgbToHex(safeR, safeG, safeB) || '#808080';
    const hex =
      typeof opts?.hex === 'string' && /^#[0-9a-fA-F]{6}$/.test(opts.hex)
        ? opts.hex.toUpperCase()
        : computedHex.toUpperCase();
    const id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : generateId() || `swatch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    return {
      id,
      hex,
      rgb,
      cmyk: rgbToCmyk(safeR, safeG, safeB) ?? { c: 0, m: 0, y: 0, k: 0 },
      hsb: rgbToHsb(safeR, safeG, safeB) ?? { h: 0, s: 0, b: 50 },
      lab: rgbToLab(safeR, safeG, safeB) ?? { l: 50, a: 0, b: 0 },
      source: 'manual',
      colorSpace: colorSpace,
      sampleX: Number.isFinite(opts?.nx) ? opts!.nx : 0.5,
      sampleY: Number.isFinite(opts?.ny) ? opts!.ny : 0.5,
      assignedPaint: undefined,
    };
  };

  const handleAddColor = (hex: string) => {
    const rgb = hexToRgb(hex);
    if (!rgb) return;
    const newColor = buildSafeColorData(rgb, { hex });
    setColors(prev => [newColor, ...prev]);
    setSelectedColorId(newColor.id);
  };

  const handleAddColors = (hexColors: string[]) => {
    if (!Array.isArray(hexColors)) return;
    const newColors = hexColors
      .map(hex => {
        const rgb = hexToRgb(hex);
        if (!rgb) return null;
        return buildSafeColorData(rgb, { hex });
      })
      .filter(Boolean) as ColorData[];

    setColors(prev => [...newColors, ...prev]);
    if (newColors.length > 0) {
      setSelectedColorId(newColors[0].id);
    }
  };

  const commitSampledRgb = (rgbInput: RGB, sample?: { nx: number; ny: number }) => {
    if (!rgbInput) return;
    let rgb = rgbInput;
    if (colorSpace === 'adobe-rgb') {
      rgb = convertToWorkingSpace(rgb, 'adobe-rgb');
    }
    const newColor = buildSafeColorData(rgb, {
      nx: sample?.nx ?? 0.5,
      ny: sample?.ny ?? 0.5,
    });
    setColors(prev => [newColor, ...prev]);
    setSelectedColorId(newColor.id);
    setDesktopTab('mixer');
    if (!isContinuousPicking) {
      setIsPicking(false);
      hideLoupe();
    }
  };

  const previewAtClient = useCallback(
    (clientX: number, clientY: number, rawTouchX?: number, rawTouchY?: number) => {
      loupeHandleRef.current?.updateAtClient(clientX, clientY, rawTouchX, rawTouchY);
    },
    []
  );

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPicking || !canvasRef.current) return;
    if (Date.now() - lastTouchCommitTimeRef.current < 500) return;
    const rgb = sampleCanvasAtClient(canvasRef.current, e.clientX, e.clientY);
    if (!rgb) return;
    commitSampledRgb(rgb, { nx: rgb.nx, ny: rgb.ny });
  };

  const handleCanvasPointerMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPicking) return;
    previewAtClient(e.clientX, e.clientY);
  };

  // Safe symmetric viewport clamping for source image canvas
  const clampSourceViewport = useCallback((panX: number, panY: number, s: number, vw: number, vh: number) => {
    if (!vw || !vh || isNaN(panX) || isNaN(panY)) {
      return { x: 0, y: 0 };
    }
    const iw = vw * s;
    const ih = vh * s;
    const boundX1 = vw * 0.7 - iw;
    const boundX2 = vw * 0.3;
    const minX = Math.min(boundX1, boundX2);
    const maxX = Math.max(boundX1, boundX2);

    const boundY1 = vh * 0.7 - ih;
    const boundY2 = vh * 0.3;
    const minY = Math.min(boundY1, boundY2);
    const maxY = Math.max(boundY1, boundY2);

    return {
      x: Math.min(Math.max(panX, minX), maxX),
      y: Math.min(Math.max(panY, minY), maxY),
    };
  }, []);

  // Prevent browser window zoom on trackpad pinch / Ctrl+wheel over canvas container, and support 2-finger trackpad pan when zoomed
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onNativeWheel = (e: WheelEvent) => {
      const rect = el.getBoundingClientRect();
      const vw = rect.width || 600;
      const vh = rect.height || 400;

      // Case A: Trackpad pinch zoom (ctrlKey / metaKey)
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = Math.exp(-Math.max(-60, Math.min(60, e.deltaY)) * 0.008);
        const prevScale = currentScale.current;
        const nextScale = Math.min(Math.max(1, prevScale * factor), 8);
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        const ratio = nextScale / prevScale;
        const rawX = px - (px - currentOffset.current.x) * ratio;
        const rawY = py - (py - currentOffset.current.y) * ratio;
        const clamped = nextScale <= 1.02 ? { x: 0, y: 0 } : clampSourceViewport(rawX, rawY, nextScale, vw, vh);
        currentScale.current = nextScale;
        currentOffset.current = clamped;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          applyTransform(clamped.x, clamped.y, nextScale);
          setScale(nextScale);
          setOffset(clamped);
        });
        return;
      }

      // Case B: Mac trackpad 2-finger scroll -> pan when zoomed in, otherwise let page scroll naturally
      if (currentScale.current > 1.05 && (Math.abs(e.deltaX) > 0 || Math.abs(e.deltaY) > 0)) {
        e.preventDefault();
        const rawX = currentOffset.current.x - e.deltaX;
        const rawY = currentOffset.current.y - e.deltaY;
        const clamped = clampSourceViewport(rawX, rawY, currentScale.current, vw, vh);
        currentOffset.current = clamped;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          applyTransform(clamped.x, clamped.y, currentScale.current);
          setOffset(clamped);
        });
      }
    };
    el.addEventListener('wheel', onNativeWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onNativeWheel);
    };
  }, [sourceImage, clampSourceViewport]);

  const hasSamplePoint = (color: ColorData) =>
    Number.isFinite(color.sampleX) && Number.isFinite(color.sampleY);

  const defaultCardPos = (nx: number, ny: number) => ({
    labelNx: nx > 0.55 ? Math.max(0.02, nx - 0.22) : Math.min(0.78, nx + 0.05),
    labelNy: Math.min(0.88, Math.max(0.02, ny - 0.06)),
  });

  const handleUnassignPaint = (colorId: string) => {
    setColors((prev) =>
      prev.map((color) =>
        color.id === colorId
          ? { ...color, assignedPaint: undefined, labelNx: undefined, labelNy: undefined }
          : color
      )
    );
  };

  const handleAssignCatalogPaint = useCallback((paint: CatalogPaint, explicitColorId?: string) => {
    let targetId: string | null = null;
    setColors((prev) => {
      if (prev.length === 0) {
        const rgb = hexToRgb(paint.hex) || { r: 128, g: 128, b: 128 };
        const newId = generateId();
        targetId = newId;
        const pos = defaultCardPos(0.5, 0.5);
        const created: ColorData = {
          id: newId,
          hex: paint.hex.toUpperCase(),
          rgb,
          cmyk: rgbToCmyk(rgb.r, rgb.g, rgb.b),
          hsb: rgbToHsb(rgb.r, rgb.g, rgb.b),
          lab: rgbToLab(rgb.r, rgb.g, rgb.b),
          source: 'manual',
          colorSpace,
          sampleX: 0.5,
          sampleY: 0.5,
          assignedPaint: paint,
          ...pos,
        };
        return [created];
      }

      const preferredId = explicitColorId ?? selectedColorId;
      const selected = prev.find((color) => color.id === preferredId);
      const target = selected ?? prev.find(hasSamplePoint) ?? prev[0];
      if (!target) return prev;
      targetId = target.id;

      const targetIndex = prev.findIndex((c) => c.id === target.id);
      const hasCoords = hasSamplePoint(target);
      const nx = hasCoords ? target.sampleX! : Math.min(0.82, 0.28 + (targetIndex % 3) * 0.2);
      const ny = hasCoords ? target.sampleY! : Math.min(0.82, 0.28 + Math.floor(targetIndex / 3) * 0.2);
      const place =
        target.labelNx == null && target.labelNy == null
          ? defaultCardPos(nx, ny)
          : {};

      return prev.map((color) =>
        color.id === target.id
          ? {
              ...color,
              sampleX: nx,
              sampleY: ny,
              assignedPaint: paint,
              ...place,
            }
          : color
      );
    });

    if (targetId) {
      setSelectedColorId(targetId);
    }

    // Reverse-jump closed loop: return to source canvas on mobile/portrait and ensure canvas is visible
    if (desktopTab !== 'studio' && mobileMainTab !== 'studio') {
      setMobileMainTab('workbench');
      setWorkbenchSubpage('extract');
      if (desktopTab === 'brands' || desktopTab === 'catalog') {
        setDesktopTabUI('mixer');
        startTransition(() => {
          setDesktopTab('mixer');
        });
      }
      window.setTimeout(() => {
        containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 80);
    }

    const brandLabel = localizedBrand(paint.brand, lang);
    showToast(
      lang === 'zh'
        ? `✅ 已将 ${brandLabel} ${paint.code} 指派给当前色卡`
        : `✅ Assigned ${brandLabel} ${paint.code} to current swatch`
    );
  }, [selectedColorId, colorSpace, desktopTab, mobileMainTab, lang, showToast]);

  const handleUpdateTonalGradient = useCallback((colorId: string, tonalGradient: TonalStep[] | undefined) => {
    setColors((prev) =>
      prev.map((color) =>
        color.id === colorId ? { ...color, tonalGradient } : color
      )
    );
  }, []);

  const handleStartTonalReplace = useCallback((colorId: string) => {
    setSelectedColorId(colorId);
    setPendingTonalSampleId(colorId);
    handleSwitchWorkbenchSubpage('chroma');
  }, [handleSwitchWorkbenchSubpage]);

  const handleConfirmTonalReplace = useCallback((sampleId: string, newHex: string) => {
    const rgb = hexToRgb(newHex);
    if (!rgb) return;
    const hsb = rgbToHsb(rgb.r, rgb.g, rgb.b);
    const lab = rgbToLab(rgb.r, rgb.g, rgb.b);
    setColors((prev) =>
      prev.map((color) =>
        color.id === sampleId
          ? {
              ...color,
              hex: newHex.toUpperCase(),
              rgb,
              cmyk: rgbToCmyk(rgb.r, rgb.g, rgb.b),
              hsb,
              lab,
              assignedPaint: undefined,
            }
          : color
      )
    );
    setPendingTonalSampleId(null);
    setSelectedColorId(sampleId);
    handleSwitchWorkbenchSubpage('extract');
    showToast(lang === 'zh' ? '已替换取色点颜色，请重新指派匹配油漆' : 'Replaced sample color');
  }, [handleSwitchWorkbenchSubpage, lang, showToast]);

  const handleSaveCurrentColorToPalette = useCallback(() => {
    const target = selectedColor || colors[0];
    if (!target) return;
    const newSaved: SavedColor = {
      id: generateId(),
      name: target.assignedPaint
        ? `${target.assignedPaint.brand} ${target.assignedPaint.code} ${target.assignedPaint.name}`
        : `取色 ${target.hex}`,
      hex: target.hex.toUpperCase(),
      categoryId: categories[0]?.id ?? null,
      brand: target.assignedPaint?.brand,
      code: target.assignedPaint?.code,
      createdAt: Date.now(),
    };
    setSavedColors((prev) => [newSaved, ...prev]);
    // Also add to RadialPaletteMixer custom palette if not already present
    setRadialMixerCache((prev) => {
      if (prev.sliders.some((s) => s.hex.toUpperCase() === target.hex.toUpperCase())) return prev;
      return {
        ...prev,
        sliders: [
          ...prev.sliders,
          {
            id: generateId(),
            name: target.assignedPaint ? `${target.assignedPaint.brand} ${target.assignedPaint.code}` : target.hex,
            brand: target.assignedPaint?.brand,
            code: target.assignedPaint?.code,
            hex: target.hex,
            rgb: target.rgb,
            lab: target.lab,
            weight: 0,
            assignedPaint: target.assignedPaint,
          },
        ],
      };
    });
    showToast(lang === 'zh' ? `已收藏 ${target.hex} 到涂装库单色色卡与自选调色盘` : `Saved ${target.hex} to palette`);
  }, [selectedColor, colors, categories, lang, showToast]);

  const handleMoveLabel = useCallback((id: string, labelNx: number, labelNy: number) => {
    setColors((prev) =>
      prev.map((color) =>
        color.id === id ? { ...color, labelNx, labelNy } : color
      )
    );
  }, []);

  const handleBatchMoveLabels = useCallback((positions: { [id: string]: { nx: number; ny: number } }) => {
    setColors((prev) =>
      prev.map((color) => {
        const pos = positions[color.id];
        return pos ? { ...color, labelNx: pos.nx, labelNy: pos.ny } : color;
      })
    );
  }, []);

  const handleAutoArrangeLR = useCallback(() => {
    const w = canvasBox.width || 800;
    const h = canvasBox.height || 600;
    const newPositions = autoArrangeLeftRight(extractMarkers, w, h, swatchSettings.cardScale, swatchSettings.cardBaseWidth);
    handleBatchMoveLabels(newPositions);
  }, [canvasBox.width, canvasBox.height, extractMarkers, swatchSettings.cardScale, swatchSettings.cardBaseWidth, handleBatchMoveLabels]);

  const handleAutoArrangeTB = useCallback(() => {
    const w = canvasBox.width || 800;
    const h = canvasBox.height || 600;
    const newPositions = autoArrangeTopBottom(extractMarkers, w, h, swatchSettings.cardScale, swatchSettings.cardBaseWidth);
    handleBatchMoveLabels(newPositions);
  }, [canvasBox.width, canvasBox.height, extractMarkers, swatchSettings.cardScale, swatchSettings.cardBaseWidth, handleBatchMoveLabels]);

  const handleAlign = useCallback((alignment: 'left' | 'right' | 'top' | 'bottom' | 'autoH' | 'autoV') => {
    const w = canvasBox.width || 800;
    const h = canvasBox.height || 600;
    const newPositions = alignMarkers(extractMarkers, alignment, w, h, swatchSettings.cardScale, selectedColorId ?? undefined, swatchSettings.cardBaseWidth);
    handleBatchMoveLabels(newPositions);
  }, [canvasBox.width, canvasBox.height, extractMarkers, swatchSettings.cardScale, swatchSettings.cardBaseWidth, selectedColorId, handleBatchMoveLabels]);

  const handleResetPositions = useCallback(() => {
    const w = canvasBox.width || 800;
    const h = canvasBox.height || 600;
    const newPositions = resetMarkerPositions(extractMarkers, w, h, swatchSettings.cardScale, selectedColorId ?? undefined, swatchSettings.cardBaseWidth);
    handleBatchMoveLabels(newPositions);
  }, [canvasBox.width, canvasBox.height, extractMarkers, swatchSettings.cardScale, swatchSettings.cardBaseWidth, selectedColorId, handleBatchMoveLabels]);

  const handleExportAnnotated = async () => {
    const canvas = canvasRef.current;
    const assigned = extractMarkers.filter((marker) => marker.paint);
    if (!canvas || !assigned.length) return;
    setIsExporting(true);
    try {
      const res = await exportAnnotatedImage(canvas, extractMarkers, swatchSettings);
      if (res) {
        setExportResult(res);
        setIsExportModalOpen(true);
      }
    } catch (err) {
      console.error('[Export] Failed to export annotated image from workbench:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const selectedSandboxColor = useMemo(
    () =>
      sandboxColors.find((c) => c.id === selectedSandboxColorId) ||
      sandboxColors[0] ||
      null,
    [sandboxColors, selectedSandboxColorId]
  );

  const handleSyncSandboxState = useCallback(
    (payload: SandboxSyncPayload) => {
      let activeMarginRec: ReturnType<typeof getCanvasMarginRecord> = undefined;
      setSandboxSyncState((prev) => {
        const rec = prev?.compositeDataUrl ? getCanvasMarginRecord(prev.compositeDataUrl) : undefined;
        if (rec && rec.mode !== 'none' && rec.originalImageSrc === payload.compositeDataUrl) {
          activeMarginRec = rec;
          return {
            ...payload,
            compositeDataUrl: prev!.compositeDataUrl,
          };
        }
        return payload;
      });
      setSandboxColors((prev) => {
        const next: ColorData[] = payload.syncedSwatches.map((sw) => {
          const existing = prev.find(
            (c) => c.id === sw.id || c.hex.toUpperCase() === sw.hex.toUpperCase()
          );
          const rgb = hexToRgb(sw.hex) || { r: 128, g: 128, b: 128 };
          const sampleX = activeMarginRec
            ? activeMarginRec.innerLeftNx + sw.anchorX * activeMarginRec.innerWidthNw
            : existing?.sampleX ?? sw.anchorX;
          const sampleY = activeMarginRec
            ? activeMarginRec.innerTopNy + sw.anchorY * activeMarginRec.innerHeightNh
            : existing?.sampleY ?? sw.anchorY;
          return {
            id: sw.id,
            hex: sw.hex.toUpperCase(),
            rgb,
            cmyk: rgbToCmyk(rgb.r, rgb.g, rgb.b),
            hsb: rgbToHsb(rgb.r, rgb.g, rgb.b),
            lab: rgbToLab(rgb.r, rgb.g, rgb.b),
            source: 'manual',
            colorSpace,
            sampleX,
            sampleY,
            labelNx: existing?.labelNx ?? sw.offsetX,
            labelNy: existing?.labelNy ?? sw.offsetY,
            labelScale: existing?.labelScale,
            assignedPaint: sw.assignedPaint || existing?.assignedPaint,
            tonalGradient: existing?.tonalGradient ?? [
              { id: `hl-${sw.hex}`, hex: sw.highlightHex, label: '高光', role: 'highlight' },
              { id: `base-${sw.hex}`, hex: sw.hex, label: '主色', role: 'base' },
              { id: `sh-${sw.hex}`, hex: sw.shadeHex, label: '阴影', role: 'shadow' },
            ],
          };
        });
        return next;
      });
      setSelectedSandboxColorId((prevId) => {
        if (prevId && payload.syncedSwatches.some((sw) => sw.id === prevId)) {
          return prevId;
        }
        const byActive = payload.syncedSwatches.find(
          (sw) => sw.hex.toUpperCase() === payload.activeHex.toUpperCase()
        );
        return byActive?.id || payload.syncedSwatches[0]?.id || null;
      });
    },
    [colorSpace]
  );

  const handleAssignSandboxCatalogPaint = useCallback(
    (paint: CatalogPaint) => {
      const target = selectedSandboxColor || sandboxColors[0];
      const brandLabel = localizedBrand(paint.brand, lang);
      if (!target) {
        handleAssignCatalogPaint(paint);
        return;
      }
      const localizedPaint: CatalogPaint = {
        ...paint,
        brand: brandLabel,
      };
      setSandboxColors((prev) =>
        prev.map((c) =>
          c.id === target.id
            ? {
                ...c,
                assignedPaint: localizedPaint,
              }
            : c
        )
      );
      setExternalSandboxAssign({
        targetHex: target.hex,
        paint,
        token: Date.now(),
      });
      showToast(
        lang === 'zh'
          ? `✅ 已将 ${brandLabel} ${paint.code} 锁定至试色台色卡 (${target.hex})`
          : `✅ Assigned ${brandLabel} ${paint.code} to sandbox swatch`
      );
    },
    [selectedSandboxColor, sandboxColors, lang, handleAssignCatalogPaint, showToast]
  );

  const handleExportSandboxAnnotated = async () => {
    const dataUrl = sandboxSyncState?.compositeDataUrl;
    if (!dataUrl || sandboxColors.length === 0) return;
    setIsExporting(true);
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load sandbox composite image'));
        img.src = dataUrl;
      });
      const markers = colorsToMarkers(sandboxColors);
      const res = await exportAnnotatedImage(img, markers, swatchSettings);
      if (res) {
        setExportResult(res);
        setIsExportModalOpen(true);
      }
    } catch (err) {
      console.error('[Export] Failed to export sandbox annotated image:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveSandboxToProject = useCallback(() => {
    const dataUrl = sandboxSyncState?.compositeDataUrl;
    if (!dataUrl || sandboxColors.length === 0) return;
    const nodes = colorsToFloatingNodes(sandboxColors).map((node) => {
      const swMeta = sandboxSyncState?.syncedSwatches.find(
        (s) => s.id === node.id || s.hex.toUpperCase() === node.hex.toUpperCase()
      );
      return {
        ...node,
        basePaintHex: swMeta?.basePaintHex,
        tintBadgeText: swMeta?.tintBadgeText,
        recipeSummary: swMeta?.recipeSummary,
      };
    });
    const steps = inferStepsFromNodes(nodes);
    const now = Date.now();
    const part: PartCanvas = {
      id: `part-${now}`,
      partName: '试色与微调总成',
      sourceImageDataUrl: dataUrl,
      nodes,
      steps,
      createdAt: now,
    };
    const newProj: PaintProject = {
      id: `proj-sandbox-${now}`,
      title: '试色与选漆微调方案',
      coverImageDataUrl: dataUrl,
      createdAt: now,
      updatedAt: now,
      parts: [part],
    };
    setProjects((prev) => [newProj, ...prev]);
    setFocusProjectId(newProj.id);
    handleSwitchDesktopTab('studio');
    showToast(
      lang === 'zh'
        ? `✅ 已存入涂装库「${newProj.title}」(${nodes.length}个色卡)，可继续添加涂装工序、生成扫码名片或打包工程！`
        : `Saved project ${newProj.title}`
    );
  }, [sandboxSyncState, sandboxColors, handleSwitchDesktopTab, lang, showToast]);

  const assignedMarkers = extractMarkers.filter((marker) => marker.paint);

  const handleCopyAssignments = async () => {
    const text = assignedMarkers
      .map((marker) => {
        const paint = marker.paint!;
        return `${paint.brand} ${paint.code} ${paint.name} ${paint.hex}`;
      })
      .join("\n");
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  const handleClearAssignments = () => {
    setColors((prev) =>
      prev.map((color) =>
        color.assignedPaint
          ? { ...color, assignedPaint: undefined, labelNx: undefined, labelNy: undefined }
          : color
      )
    );
  };

  const applyTransform = useCallback((x: number, y: number, s: number) => {
    if (transformRef.current) {
      transformRef.current.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
    }
  }, []);

  const handleZoomIn = () => {
    const next = Math.min(currentScale.current + 0.5, 8);
    currentScale.current = next;
    setScale(next);
    applyTransform(currentOffset.current.x, currentOffset.current.y, next);
  };
  const handleZoomOut = () => {
    const next = Math.max(1, currentScale.current - 0.5);
    currentScale.current = next;
    if (next <= 1) {
      currentOffset.current = { x: 0, y: 0 };
      setOffset({ x: 0, y: 0 });
    }
    setScale(next);
    applyTransform(currentOffset.current.x, currentOffset.current.y, next);
  };
  const handleReset = () => {
    currentScale.current = 1;
    currentOffset.current = { x: 0, y: 0 };
    setScale(1);
    setOffset({ x: 0, y: 0 });
    applyTransform(0, 0, 1);
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isPicking && currentScale.current > 1) {
      setIsDragging(true);
      isSingleDragging.current = true;
      startPos.current = {
        x: e.clientX - currentOffset.current.x,
        y: e.clientY - currentOffset.current.y,
      };
    }
  }, [isPicking]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isSingleDragging.current) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const nextX = e.clientX - startPos.current.x;
        const nextY = e.clientY - startPos.current.y;
        currentOffset.current = { x: nextX, y: nextY };
        applyTransform(nextX, nextY, currentScale.current);
      });
    }
  }, [applyTransform]);

  const handleMouseUp = useCallback(() => {
    if (isSingleDragging.current) {
      setOffset({ ...currentOffset.current });
      isSingleDragging.current = false;
    }
    setIsDragging(false);
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // Touch Handlers for Mobile - 2-finger Pan & Zoom, 1-finger Color Pick or Screen Scroll
  const handleTouchStart = useCallback((e: TouchEvent) => {
    // 2 Fingers: Combined Pinch-to-Zoom + Two-Finger Pan/Drag image position
    if (e.touches.length === 2) {
      touchPickRef.current = null;
      if (e.cancelable) e.preventDefault();
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const dist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
      const center = {
        x: (t0.clientX + t1.clientX) / 2,
        y: (t0.clientY + t1.clientY) / 2,
      };

      twoFingerRef.current = {
        initialDist: dist > 0 ? dist : 1,
        initialScale: currentScale.current,
        initialCenter: center,
        initialOffset: { ...currentOffset.current },
      };

      isSingleDragging.current = false;
      setIsDragging(true);
      hideLoupe();
      return;
    }

    // 1 Finger:
    if (e.touches.length === 1) {
      twoFingerRef.current = null;
      if (Date.now() - lastTouchCommitTimeRef.current < 160) {
        return;
      }
      const touch = e.touches[0];

      // If in color picking mode and touched on the image canvas (use thumb-front offset target so thumb never blocks target)
      if (isPicking && canvasRef.current) {
        const { targetX, targetY, isInsideTouch } = resolveTouchSamplePoint(
          canvasRef.current,
          touch.clientX,
          touch.clientY
        );
        const rgb = isInsideTouch
          ? sampleCanvasAtClient(canvasRef.current, targetX, targetY)
          : null;
        if (rgb) {
          if (e.cancelable) e.preventDefault();
          touchPickRef.current = {
            startX: touch.clientX,
            startY: touch.clientY,
            lastX: targetX,
            lastY: targetY,
            startTime: Date.now(),
          };
          previewAtClient(targetX, targetY, touch.clientX, touch.clientY);
        } else {
          // Touch outside canvas pixels while in picking mode -> exit picking mode so single finger can scroll
          touchPickRef.current = null;
          hideLoupe();
          setIsPicking(false);
          setIsContinuousPicking(false);
        }
        return;
      }

      // Single finger when NOT picking:
      // Never intercept single-finger touch! The entire page is recognized as scrolling the screen.
      isSingleDragging.current = false;
      return;
    }
  }, [isPicking, hideLoupe, previewAtClient]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    // 2 Fingers: Combined Pinch-to-Zoom + Two-Finger Drag/Pan
    if (e.touches.length === 2 && twoFingerRef.current) {
      if (e.cancelable) e.preventDefault();

      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const dist = Math.max(1, Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY));
      const center = {
        x: (t0.clientX + t1.clientX) / 2,
        y: (t0.clientY + t1.clientY) / 2,
      };

      const { initialDist, initialScale, initialCenter, initialOffset } = twoFingerRef.current;
      const ratio = dist / Math.max(1, initialDist);
      const newScale = Math.min(Math.max(1, initialScale * ratio), 8);

      const containerRect = containerRef.current?.getBoundingClientRect();
      const rectLeft = containerRect?.left ?? 0;
      const rectTop = containerRect?.top ?? 0;
      const vw = containerRect?.width || 600;
      const vh = containerRect?.height || 400;

      // Focal points relative to viewport top-left
      const p0x = initialCenter.x - rectLeft;
      const p0y = initialCenter.y - rectTop;
      const px = center.x - rectLeft;
      const py = center.y - rectTop;

      const scaleFactor = newScale / initialScale;

      // Keep the point under initial focal point anchored under current center (simultaneous pinch + 2-finger pan)
      const rawOffsetX = px - scaleFactor * (p0x - initialOffset.x);
      const rawOffsetY = py - scaleFactor * (p0y - initialOffset.y);
      const clamped = clampSourceViewport(rawOffsetX, rawOffsetY, newScale, vw, vh);

      currentScale.current = newScale;
      currentOffset.current = clamped;

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        applyTransform(clamped.x, clamped.y, newScale);
      });
      return;
    }

    // 1 Finger Color Picker preview (ONLY when a valid picking touch is active on canvas; uses thumb-front offset target)
    if (e.touches.length === 1 && isPicking && touchPickRef.current && canvasRef.current) {
      if (e.cancelable) e.preventDefault();
      const touch = e.touches[0];
      const { targetX, targetY } = resolveTouchSamplePoint(
        canvasRef.current,
        touch.clientX,
        touch.clientY
      );
      touchPickRef.current.lastX = targetX;
      touchPickRef.current.lastY = targetY;
      previewAtClient(targetX, targetY, touch.clientX, touch.clientY);
      return;
    }
  }, [applyTransform, isPicking, clampSourceViewport]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    // If fewer than 2 fingers remain after a 2-finger gesture, immediately release 2-finger state & set 150ms cooldown
    if (e.touches.length < 2 && twoFingerRef.current) {
      twoFingerRef.current = null;
      touchPickRef.current = null;
      isSingleDragging.current = false;
      setIsDragging(false);
      lastTouchCommitTimeRef.current = Date.now();
      setScale(currentScale.current);
      setOffset({ ...currentOffset.current });
      if (e.touches.length === 1) return;
    }

    // All fingers lifted
    if (e.touches.length === 0) {
      // 1. Commit touch color pick if active
      if (isPicking && touchPickRef.current && canvasRef.current) {
        const { lastX, lastY } = touchPickRef.current;
        const rgb = sampleCanvasAtClient(canvasRef.current, lastX, lastY);
        if (rgb) {
          lastTouchCommitTimeRef.current = Date.now();
          commitSampledRgb(rgb, { nx: rgb.nx, ny: rgb.ny });
        } else {
          hideLoupe();
        }
        touchPickRef.current = null;
      }

      twoFingerRef.current = null;
      isSingleDragging.current = false;
      setIsDragging(false);

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      setScale(currentScale.current);
      setOffset({ ...currentOffset.current });
    }
  }, [isPicking, commitSampledRgb, hideLoupe]);

  // Attach native touch event listeners strictly to the canvas container (NEVER window)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => handleTouchStart(e);
    const onTouchMove = (e: TouchEvent) => handleTouchMove(e);
    const onTouchEnd = (e: TouchEvent) => handleTouchEnd(e);
    const onWindowBlur = () => {
      twoFingerRef.current = null;
      touchPickRef.current = null;
      isSingleDragging.current = false;
      setIsDragging(false);
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: false });
    el.addEventListener('touchcancel', onTouchEnd, { passive: false });
    window.addEventListener('blur', onWindowBlur);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, sourceImage]);

  // Exit picking mode when tapping / clicking outside the image frame
  useEffect(() => {
    if (!isPicking) return;

    const handlePointerDownOutside = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Inside image container -> handled by container
      if (containerRef.current && containerRef.current.contains(target)) {
        return;
      }

      // Inside toolbar or pick buttons -> don't auto-cancel
      if (target.closest('[data-pick-control]') || target.closest('[data-image-toolbar]')) {
        return;
      }

      // Tapped outside the image frame -> exit picking mode cleanly
      setIsPicking(false);
      setIsContinuousPicking(false);
      hideLoupe();
    };

    document.addEventListener('pointerdown', handlePointerDownOutside, { passive: true });
    return () => {
      document.removeEventListener('pointerdown', handlePointerDownOutside);
    };
  }, [isPicking, hideLoupe]);

  React.useEffect(() => {
    if (sourceImage && canvasRef.current && imageRef.current) {
        const canvas = canvasRef.current;
        // Use user-selected colorspace for accurate color display
        const canvasColorSpace = colorSpace === 'adobe-rgb' ? 'srgb' : colorSpace;
        const ctx = canvas.getContext('2d', { 
          colorSpace: canvasColorSpace,
          willReadFrequently: true 
        });
        const img = imageRef.current;
        
        if (ctx && img) {
             ctx.clearRect(0, 0, canvas.width, canvas.height);
             canvas.width = img.naturalWidth;
             canvas.height = img.naturalHeight;
             ctx.drawImage(img, 0, 0);
             requestAnimationFrame(syncCanvasBox);
        }
    }
  }, [sourceImage, colorSpace, syncCanvasBox]);

  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const syncLabHash = () => {
      if (window.location.hash === '#coloring-lab') {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        handleSwitchDesktopTab('coloring');
      }
    };
    syncLabHash();
    window.addEventListener('hashchange', syncLabHash);
    return () => window.removeEventListener('hashchange', syncLabHash);
  }, [handleSwitchDesktopTab]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 8);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <KonstaApp
      theme="material"
      dark={theme === 'dark'}
      safeAreas={false}
      className="min-h-screen bg-slate-50 dark:bg-slate-950 gk-page-bg transition-colors duration-300 flex flex-col overflow-x-hidden font-mono"
    >
      {/* Header with iOS 26/27 Soft Progressive Blur Edge Effect (or Floating 3-Bar Square Button when Top Bar is Hidden) */}
      {hideTopBar ? (
        <button
          type="button"
          onClick={() => setIsSettingsOpen(true)}
          className={`fixed top-3 right-3 z-[45] flex h-10 w-10 items-center justify-center transition-all active:scale-95 cursor-pointer ${
            uiStyle === 'blueprint'
              ? 'rounded-[6px] border-[1.5px] border-slate-900 dark:border-slate-400 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-[3px_3px_0px_#0F172A] dark:shadow-[3px_3px_0px_#020617]'
              : 'rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl text-slate-700 dark:text-slate-200 shadow-lg hover:bg-white dark:hover:bg-slate-800'
          }`}
          title={lang === 'zh' ? '打开软件设置 (当前已隐藏顶部栏)' : 'Open Settings'}
          aria-label="Open Settings"
        >
          <ListIcon className="w-5 h-5" weight="bold" />
        </button>
      ) : (
        <header className="gk-app-header gk-header sticky top-0 z-40 pt-[env(safe-area-inset-top,0px)] transition-all duration-300 bg-gradient-to-b from-white/90 via-white/65 to-transparent dark:from-slate-950/90 dark:via-slate-950/65 dark:to-transparent backdrop-blur-xl">
          <div className="max-w-[1920px] mx-auto px-4 md:px-6 h-14 flex justify-between items-center gap-3">
            <div className="flex items-center gap-2.5">
              <img
                src="/app-logo.png"
                alt="GK-Mixer"
                className="w-7 h-7 rounded-lg object-cover shadow-xs border border-slate-200/60 dark:border-slate-700/60"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-macaron-pink"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-macaron-blue"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-macaron-green"></div>
              </div>
              <h1 className="ml-0.5 font-bold text-slate-800 dark:text-slate-100 tracking-tight text-base sm:text-lg">
                GK-Mixer
              </h1>
            </div>
            
            {/* Desktop Controls (hidden on mobile): Theme + Settings (Workflow / Color Space / Language integrated inside SettingsModal) */}
            <div className="hidden lg:flex gap-2.5 items-center">
               <button 
                  onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                  className="gk-mech-btn p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-yellow-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-[0.95] cursor-pointer"
                  title="Toggle Theme"
               >
                  {theme === 'light' ? <MoonIcon className="w-4 h-4" /> : <SunIcon className="w-4 h-4" />}
               </button>

               <button
                  type="button"
                  onClick={() => setIsSettingsOpen(true)}
                  className="gk-mech-btn p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-[0.95] cursor-pointer"
                  title={lang === 'zh' ? '设置与关于' : 'Settings & About'}
                  aria-label="Settings & About"
               >
                  <GearIcon className="w-4 h-4" />
               </button>
            </div>

            {/* Mobile Hamburger Settings Button */}
            <div className="flex lg:hidden items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="gk-mech-btn p-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all"
                aria-label="Settings"
                title="Settings"
              >
                <ListIcon className="w-6 h-6" />
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Color Space Info Banner */}
      {colorSpace !== 'srgb' && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-b border-purple-100 dark:border-purple-800">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-2">
            <div className="flex items-center gap-2 text-xs text-purple-700 dark:text-purple-300">
              <span className="font-bold flex items-center gap-1"><PaletteIcon className="w-3.5 h-3.5" /> {t.colorSpace}:</span>
              <span>{colorSpace === 'display-p3' ? t.colorSpaceP3 : t.colorSpaceAdobe}</span>
              <span className="text-purple-500 dark:text-purple-400">•</span>
              <span className="text-purple-600 dark:text-purple-400 italic">{t.outOfGamutHint}</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-[1920px] mx-auto w-full p-2.5 sm:p-4 md:p-6 pb-28 lg:pb-6 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 xl:gap-8 overflow-x-hidden min-w-0">
        
        {/* Left Column: Image & Palette */}
        {/* Left column stays mounted in wide mode (hidden via class) to avoid costly canvas/image remounts */}
        {(
          <div className={`flex flex-col gap-6 lg:col-span-5 xl:col-span-4 min-w-0 pr-1.5 pb-1.5 ${mobileMainTab === 'workbench' && workbenchSubpage === 'extract' ? 'block' : 'hidden'} ${(isWideVisualizer && desktopTab === 'studio') || desktopTab === 'coloring' || (workflowMode === 'beginner' && (desktopTab === 'brands' || desktopTab === 'studio' || desktopTab === 'catalog')) ? 'lg:hidden' : 'lg:block'}`}>
            <div className="gk-panel-card gk-card bg-white dark:bg-slate-900 p-2.5 sm:p-4 md:p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm transition-colors duration-300">
              {/* Mobile Top Segmented Control for Workbench (拾色 | 调色分解 | 明度色卡) */}
              <div className={`lg:hidden mb-4 ${hideTopBar ? 'pr-11' : ''}`}>
                <div className="gk-tab-bar flex bg-slate-100 dark:bg-slate-800 p-1 rounded-full border border-slate-200/60 dark:border-slate-700/60 shadow-xs">
                  <button
                    type="button"
                    onClick={() => handleSwitchWorkbenchSubpage('extract')}
                    className={`gk-tab-pill flex-1 py-1.5 text-xs font-bold rounded-full transition-all duration-150 flex items-center justify-center gap-1 whitespace-nowrap ${
                      workbenchSubpage === 'extract'
                        ? 'gk-tab-pill-active bg-white dark:bg-slate-700 text-accent dark:text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                    }`}
                  >
                    <CrosshairIcon className="w-3.5 h-3.5 shrink-0" />
                    <span>{lang === 'zh' ? '拾色' : lang === 'ja' ? '抽出' : 'Extract'}</span>
                    {colors.length > 0 && (
                      <span className="ml-0.5 px-1 min-w-[14px] h-3.5 bg-accent text-white rounded-full text-[9px] font-bold flex items-center justify-center leading-none tabular-nums">
                        {colors.length}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchWorkbenchSubpage('mixer')}
                    className={`gk-tab-pill flex-1 py-1.5 text-xs font-bold rounded-full transition-all duration-150 flex items-center justify-center gap-1 whitespace-nowrap ${
                      workbenchSubpage === 'mixer'
                        ? 'gk-tab-pill-active bg-white dark:bg-slate-700 text-accent dark:text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                    }`}
                  >
                    <FlaskIcon className="w-3.5 h-3.5 shrink-0" />
                    <span>{lang === 'zh' ? '调色分解' : lang === 'ja' ? '混色' : 'Mixer'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchWorkbenchSubpage('chroma')}
                    className={`gk-tab-pill flex-1 py-1.5 text-xs font-bold rounded-full transition-all duration-150 flex items-center justify-center gap-1 whitespace-nowrap ${
                      workbenchSubpage === 'chroma'
                        ? 'gk-tab-pill-active bg-white dark:bg-slate-700 text-accent dark:text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                    }`}
                  >
                    <SquaresFourIcon className="w-3.5 h-3.5 shrink-0" />
                    <span>{lang === 'zh' ? '明度色卡' : lang === 'ja' ? '色階' : 'Chroma'}</span>
                  </button>
                </div>
              </div>

              <h2 className="text-xs font-bold text-slate-400 mb-4 tracking-widest">
                <span className="tech-prefix">[CANVAS]</span>
                {t.sourceInput}
              </h2>
            
            {!sourceImage ? (
                <div className="relative">
                  <DropZone onImageLoaded={handleImageLoaded} label={t.dragDrop} />
                  {isExtracting && (
                    <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center z-10">
                      <Loader size="md" />
                      <p className="mt-4 text-sm text-slate-500 dark:text-slate-400 font-medium">
                        {lang === 'zh' ? '正在分析颜色...' : lang === 'ja' ? '色を分析中...' : 'Analyzing colors...'}
                      </p>
                    </div>
                  )}
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {/* Toolbar */}
                    <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800 p-2 rounded-lg" data-image-toolbar="true">
                        <div className="flex flex-wrap gap-2">
                            <button onClick={handleZoomIn} className="gk-btn-secondary px-2 py-1 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-200 text-xs rounded border border-slate-200 dark:border-slate-600 hover:border-coral whitespace-nowrap">{t.zoomIn}</button>
                            <button onClick={handleZoomOut} className="gk-btn-secondary px-2 py-1 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-200 text-xs rounded border border-slate-200 dark:border-slate-600 hover:border-coral whitespace-nowrap">{t.zoomOut}</button>
                            <button onClick={handleReset} className="gk-btn-secondary px-2 py-1 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-200 text-xs rounded border border-slate-200 dark:border-slate-600 hover:border-coral whitespace-nowrap">{t.reset}</button>
                            <button
                                onClick={() => changeImageInputRef.current?.click()}
                                className="gk-btn-secondary px-2 py-1 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-200 text-xs rounded border border-slate-200 dark:border-slate-600 hover:border-coral whitespace-nowrap"
                            >
                                {t.changeImage}
                            </button>
                            <button
                                type="button"
                                onClick={() => sourceImage && handleSendImageToColoring(sourceImage, '取色画布源图')}
                                className="gk-btn-primary px-2.5 py-1 bg-[var(--accent-color)] text-white text-xs font-extrabold rounded border border-transparent hover:opacity-95 whitespace-nowrap cursor-pointer"
                                title="将当前源图像一键发送至 AI 试色台进行分件改色与光影预览"
                            >
                                🎨 {lang === 'zh' ? '试色改色' : 'Color Studio'}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                  setSwatchEditorMode('pro');
                                  setIsSwatchEditorOpen(true);
                                }}
                                className="gk-btn-secondary px-2.5 py-1 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-100 text-xs font-extrabold rounded border border-slate-200 dark:border-slate-600 hover:border-coral whitespace-nowrap cursor-pointer"
                                title="拓展图片外部留白尺寸（支持白/黑/原图色）并编辑悬浮色卡排版"
                            >
                                ✂️ {lang === 'zh' ? '扩边/色卡排版' : 'Expand & Swatches'}
                            </button>
                            <input
                                ref={changeImageInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="hidden"
                                onChange={(event) => {
                                  const file = event.target.files?.[0];
                                  if (!file) return;
                                  const img = new Image();
                                  img.onload = () => handleImageLoaded(file, img);
                                  img.src = URL.createObjectURL(file);
                                  event.target.value = '';
                                }}
                            />
                        </div>
                        <button 
                            onClick={() => {
                              setSourceImage(null);
                              setIsPicking(false); // Stop picking mode
                              // Keep colors data - don't clear setColors([])
                            }}
                            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500 rounded transition-colors"
                            title={lang === 'zh' ? '关闭图片 (保留颜色)' : lang === 'ja' ? '画像を閉じる (色を保持)' : 'Close image (keep colors)'}
                        >
                            <XIcon className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Viewport */}
                    <div 
                        ref={containerRef}
                        className={`relative h-[28rem] w-full overflow-hidden rounded-xl border-2 border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 select-none ${
                          isPicking ? 'touch-none cursor-crosshair' : 'touch-pan-y'
                        }`}
                        style={{ 
                          touchAction: isPicking ? 'none' : 'pan-y'
                        }}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onClick={(e) => {
                          // If clicked inside container on empty space outside canvas, exit picking
                          if (isPicking && canvasRef.current) {
                            const rgb = sampleCanvasAtClient(canvasRef.current, e.clientX, e.clientY);
                            if (!rgb) {
                              setIsPicking(false);
                              setIsContinuousPicking(false);
                              hideLoupe();
                            }
                          }
                        }}
                        onMouseLeave={() => {
                          handleMouseUp();
                          hideLoupe();
                        }}
                    >
                            {/* Hidden source image for reference */}
                        <img ref={imageRef} src={sourceImage} className="hidden" alt="source ref" onLoad={() => {
                            // Trigger re-render to draw canvas with willReadFrequently enabled from creation
                            const canvas = canvasRef.current;
                            const canvasColorSpace = colorSpace === 'adobe-rgb' ? 'srgb' : colorSpace;
                            const ctx = canvas?.getContext('2d', {
                              colorSpace: canvasColorSpace,
                              willReadFrequently: true,
                            });
                            const img = imageRef.current;
                            if(canvas && ctx && img) {
                                canvas.width = img.naturalWidth;
                                canvas.height = img.naturalHeight;
                                ctx.drawImage(img, 0, 0);
                                requestAnimationFrame(syncCanvasBox);
                                window.setTimeout(syncCanvasBox, 60);
                            }
                        }}/>

                        {/* Canvas for display and picking */}
                        <div 
                            ref={transformRef}
                            style={{ 
                                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                                transformOrigin: '0 0',
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                willChange: isDragging ? 'transform' : 'auto'
                            }}
                        >
                            <div className="relative flex h-full w-full items-center justify-center">
                            <canvas 
                                ref={canvasRef}
                                onClick={handleCanvasClick}
                                onMouseMove={handleCanvasPointerMove}
                                onMouseLeave={hideLoupe}
                                className={`block max-h-full max-w-full shadow-lg ${isPicking ? 'cursor-crosshair ring-2 ring-macaron-green' : ''}`}
                                style={{
                                    maxWidth: '100%',
                                    maxHeight: '100%',
                                    width: 'auto',
                                    height: 'auto',
                                    objectFit: 'contain'
                                }}
                            />
                            {canvasBox.width > 0 && (
                              <div
                                className="pointer-events-none absolute overflow-visible"
                                style={{
                                  left: canvasBox.left,
                                  top: canvasBox.top,
                                  width: canvasBox.width,
                                  height: canvasBox.height,
                                  zIndex: 5,
                                }}
                              >
                                <ExtractMarkerOverlay
                                    markers={extractMarkers}
                                    selectedId={selectedColorId}
                                    viewScale={scale}
                                    settings={swatchSettings}
                                    onSelect={setSelectedColorId}
                                    onRemove={handleUnassignPaint}
                                    onRequestAssign={(id) => {
                                      setSelectedColorId(id);
                                      setQuickAssignColorId(id);
                                    }}
                                    onMoveLabel={handleMoveLabel}
                                />
                              </div>
                            )}
                            </div>
                        </div>

                        {isPicking ? (
                            <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsPicking(false);
                                  setIsContinuousPicking(false);
                                  hideLoupe();
                                }}
                                className="bp-pill-active absolute top-3 left-3 z-20 flex items-center gap-1.5 rounded-full bg-emerald-600/90 hover:bg-emerald-600 text-white text-xs px-3 py-1 font-medium shadow-md backdrop-blur-sm transition-colors active:scale-95 cursor-pointer max-w-[calc(100%-1.5rem)]"
                                title={lang === 'zh' ? '点击退出取色模式' : lang === 'ja' ? 'クリックして終了' : 'Click to exit pick mode'}
                            >
                                <span className="bp-dot w-1.5 h-1.5 rounded-full bg-white animate-pulse shrink-0" />
                                <span className="truncate">{t.clickToPick}</span>
                                <span className="ml-1 text-[11px] opacity-75 hover:opacity-100 font-bold shrink-0">✕</span>
                            </button>
                        ) : (
                            <div className="absolute top-3 right-3 z-20 flex gap-2">
                              <button
                                type="button"
                                onClick={() => setIsSaveToProjectOpen(true)}
                                disabled={!extractMarkers.some((marker) => marker.paint)}
                                className="bp-btn flex items-center gap-1.5 rounded-lg bg-slate-900/85 px-3 py-1.5 text-[10px] font-bold text-white shadow-lg backdrop-blur-sm hover:bg-slate-900 disabled:opacity-40 cursor-pointer"
                              >
                                <FolderPlusIcon className="h-3.5 w-3.5 text-accent" />
                                <span>{lang === 'zh' ? '存入涂装库' : 'Save to Library'}</span>
                              </button>
                            </div>
                        )}
                    </div>

                    {/* Source Image Bottom Helper Caption & Apple Music-style ••• Secondary Action Menu */}
                    <div className="flex items-center justify-between gap-2 px-1 pt-0.5">
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-snug">
                        {lang === 'zh'
                          ? '按住「准星选取器」底部边缘拖动，圆环中心十字准星即为取色点；放大请用双指捏合。点按右侧菜单可存入涂装库。'
                          : 'Drag the bottom edge of the crosshair ring; the center crosshair samples the color. Pinch with 2 fingers to zoom.'}
                      </p>

                      {/* Plain ••• Button (44x44px hit area, no outer circle border, coral accent) */}
                      <div className="relative flex-shrink-0" ref={sourceActionMenuRef}>
                        <button
                          type="button"
                          onClick={() => setIsSourceActionMenuOpen((v) => !v)}
                          className="w-11 h-11 flex items-center justify-center text-accent hover:opacity-80 active:scale-95 transition-opacity cursor-pointer"
                          title={lang === 'zh' ? '更多操作' : 'More Actions'}
                          aria-label="More Actions"
                        >
                          <DotsThreeIcon className="w-6 h-6" weight="bold" />
                        </button>

                        {isSourceActionMenuOpen && (
                          <div className="bp-subcard-lg absolute right-0 bottom-11 w-56 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xl py-1.5 z-30 animate-in fade-in zoom-in-95 duration-150">
                            <button
                              type="button"
                              onClick={() => {
                                setIsSourceActionMenuOpen(false);
                                setIsSaveToProjectOpen(true);
                              }}
                              className="w-full px-3.5 py-2.5 text-left text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between gap-2"
                            >
                              <span>{lang === 'zh' ? '存入涂装项目库...' : 'Save to Project...'}</span>
                              <FolderPlusIcon className="w-4 h-4 text-accent" />
                            </button>
                            <div className="h-[1px] bg-slate-100 dark:bg-slate-800 my-0.5" />
                            <button
                              type="button"
                              disabled={!selectedColor && colors.length === 0}
                              onClick={() => {
                                setIsSourceActionMenuOpen(false);
                                handleSaveCurrentColorToPalette();
                              }}
                              className="w-full px-3.5 py-2.5 text-left text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 flex items-center justify-between gap-2"
                            >
                              <span>{lang === 'zh' ? '添加当前颜色到自选调色盘' : 'Save Color to Custom Palette'}</span>
                              <PaletteIcon className="w-4 h-4 text-accent" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                </div>
            )}

            {/* 1. Always keep Extracted Color Palette FIXED directly below the Source Image so assigning paints never pushes the palette down! */}
            {(colors.length > 0 || sourceImage) && (
                <div className="mt-4">
                    {colors.length > 0 && (
                        <div className="flex justify-between items-center mb-2 sm:mb-3">
                            <span className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400">
                                <span className="tech-prefix">[PALETTE]</span>
                                {t.extractedColors || (lang === 'zh' ? '已提取颜色' : lang === 'ja' ? '抽出された色' : 'Extracted Colors')}
                            </span>
                            <div className="flex items-center gap-3">
                              {selectedColor && (
                                <button
                                  type="button"
                                  onClick={() => handleStartTonalReplace(selectedColor.id)}
                                  className="flex items-center gap-1 text-[10px] sm:text-xs font-bold text-accent hover:underline"
                                >
                                  <SquaresFourIcon className="w-3.5 h-3.5" />
                                  <span>{lang === 'zh' ? '明度色卡微调选中色' : 'Fine-tune Tone'}</span>
                                </button>
                              )}
                              <button
                                  onClick={() => {
                                      setColors([]);
                                      setSelectedColorId(null);
                                  }}
                                  className="flex items-center gap-1 text-[10px] sm:text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                                  title={lang === 'zh' ? '清空所有颜色' : lang === 'ja' ? 'すべての色をクリア' : 'Clear all colors'}
                              >
                                  <TrashIcon className="w-3.5 h-3.5" />
                                  <span>{lang === 'zh' ? '清空' : lang === 'ja' ? 'クリア' : 'Clear'}</span>
                              </button>
                            </div>
                        </div>
                    )}
                    <ColorPalette 
                        colors={colors} 
                        onColorSelect={(c) => setSelectedColorId(c.id)}
                        selectedColorId={selectedColorId || undefined}
                        onAddManual={handleManualAdd}
                        onContinuousPick={handleContinuousPick}
                        onDeleteColor={handleDeleteColor}
                        onAddColorByHex={handleAddColor}
                        onOpenQuickAssign={(c) => {
                          setSelectedColorId(c.id);
                          setQuickAssignColorId(c.id);
                        }}
                        onUnassignPaint={handleUnassignPaint}
                        onNavigateToMixer={(c) => {
                          setSelectedColorId(c.id);
                          handleSwitchWorkbenchSubpage('mixer');
                        }}
                        hasImage={!!sourceImage}
                        isPicking={isPicking}
                        isContinuousPicking={isContinuousPicking}
                        lang={lang}
                    />
                </div>
            )}

            {/* 2. Assigned Swatch List + Prominent Button to Open Swatch Studio Workbench Modal (Screenshot 2) */}
            {assignedMarkers.length > 0 && (
                <div className="bp-subcard mt-4 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                            <span className="tech-prefix">[WORKFLOW]</span>
                            {lang === "zh" ? "色卡制作与油漆标注" : lang === "ja" ? "塗料割り当て" : "Paint Assignments"}
                            <span className="ml-1 font-normal text-slate-400">
                                · {assignedMarkers.length} {lang === "zh" ? "个色卡" : "markers"}
                            </span>
                        </span>
                        <div className="flex items-center gap-2.5 text-[11px] font-bold shrink-0">
                            <button
                              type="button"
                              onClick={() => setIsSaveToProjectOpen(true)}
                              className="text-accent hover:underline whitespace-nowrap cursor-pointer"
                            >
                              {lang === "zh" ? "存入涂装库" : "Save to Library"}
                            </button>
                            <button type="button" onClick={handleCopyAssignments} className="text-accent hover:underline whitespace-nowrap cursor-pointer">
                                {lang === "zh" ? "复制清单" : "Copy"}
                            </button>
                            <button type="button" onClick={handleClearAssignments} className="text-red-500 hover:underline whitespace-nowrap cursor-pointer">
                                {lang === "zh" ? "全部清除" : "Clear all"}
                            </button>
                        </div>
                    </div>

                    {/* Prominent UI Button to open SwatchEditorModal (Screenshot 2) */}
                    <button
                      type="button"
                      onClick={() => {
                        setSwatchEditorMode('pro');
                        setIsSwatchEditorOpen(true);
                      }}
                      className="bp-pill-active gk-btn-primary w-full flex items-center justify-center gap-2 rounded-xl bg-accent hover:bg-accent-hover px-3.5 py-2.5 text-xs font-extrabold text-white shadow-sm transition-all active:scale-[0.98] cursor-pointer"
                    >
                      <SlidersHorizontalIcon className="w-4 h-4 shrink-0" weight="bold" />
                      <span>
                        {lang === "zh"
                          ? `进入排版工作台 (${assignedMarkers.length} 个色卡) →`
                          : `Open Swatch Layout Studio (${assignedMarkers.length}) →`}
                      </span>
                    </button>

                    <div className="space-y-1.5">
                        {assignedMarkers.map((marker) => {
                            const paint = marker.paint!;
                            return (
                                <div
                                    key={marker.id}
                                    className={`bp-subcard flex items-center gap-2 rounded-lg border px-2 py-1.5 ${
                                        marker.id === selectedColorId
                                            ? "bp-subcard-active border-accent/40 bg-accent/8 dark:border-accent/50 dark:bg-accent/15"
                                            : "border-slate-100 dark:border-slate-800"
                                    }`}
                                >
                                    <button
                                        type="button"
                                        className="bp-swatch h-7 w-7 flex-shrink-0 rounded-md border border-slate-200"
                                        style={{ backgroundColor: paint.hex }}
                                        onClick={() => setSelectedColorId(marker.id)}
                                    />
                                    <button
                                        type="button"
                                        className="min-w-0 flex-1 text-left"
                                        onClick={() => {
                                            setSelectedColorId(marker.id);
                                            handleSwitchWorkbenchSubpage('mixer');
                                        }}
                                    >
                                        <div className="truncate text-[11px] font-bold text-slate-700 dark:text-slate-200">
                                            {paint.brand} {paint.code} {paint.name}
                                        </div>
                                        <div className="font-mono text-[10px] text-slate-400">{paint.hex}</div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleStartTonalReplace(marker.id)}
                                        className="bp-pill flex-shrink-0 rounded-full bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 flex items-center gap-0.5 whitespace-nowrap"
                                        title={lang === "zh" ? "通过明度色卡微调取色点颜色" : "Adjust tone in Chroma Matrix"}
                                    >
                                        <SquaresFourIcon className="w-3 h-3 shrink-0" />
                                        <span>{lang === "zh" ? "明暗微调" : "Tone"}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedColorId(marker.id);
                                            handleSwitchWorkbenchSubpage('mixer');
                                        }}
                                        className="bp-pill flex-shrink-0 rounded-full bg-accent/10 dark:bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent dark:text-accent-light whitespace-nowrap"
                                    >
                                        {lang === "zh" ? "混色" : "Mix"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleUnassignPaint(marker.id)}
                                        className="bp-badge flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-slate-800 text-[10px] text-white"
                                        aria-label="Remove"
                                    >
                                        ×
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
          </div>
        </div>
        )}

        {/* Right Column: Tools & Output */}
        <div className={`${(isWideVisualizer && desktopTab === 'studio') || desktopTab === 'coloring' || (workflowMode === 'beginner' && (desktopTab === 'brands' || desktopTab === 'studio' || desktopTab === 'catalog')) ? "col-span-12" : "lg:col-span-7 xl:col-span-8"} ${!(mobileMainTab === 'workbench' && workbenchSubpage === 'extract') ? 'block' : 'hidden lg:block'} w-full max-w-full min-w-0 pr-1.5 pb-1.5`}>
           <div className="gk-panel-card gk-card bg-white dark:bg-slate-900 p-2.5 sm:p-4 md:p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm h-full flex flex-col w-full max-w-full min-w-0">
                
                {/* Mobile Top Segmented Control for Workbench (when on mobile in workbench: mixer or chroma) */}
                {mobileMainTab === 'workbench' && (
                  <div className={`lg:hidden mb-4 ${hideTopBar ? 'pr-11' : ''}`}>
                    <div className="gk-tab-bar flex bg-slate-100/90 dark:bg-slate-800/90 backdrop-blur-xl p-1 rounded-full border border-slate-200/60 dark:border-slate-700/60 shadow-xs">
                      <button
                        type="button"
                        onClick={() => handleSwitchWorkbenchSubpage('extract')}
                        className={`gk-tab-pill flex-1 py-1.5 text-xs font-bold rounded-full transition-all duration-150 flex items-center justify-center gap-1 whitespace-nowrap ${
                          workbenchSubpage === 'extract'
                            ? 'gk-tab-pill-active bg-white dark:bg-slate-700 text-accent dark:text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                        }`}
                      >
                        <CrosshairIcon className="w-3.5 h-3.5 shrink-0" />
                        <span>{lang === 'zh' ? '拾色' : lang === 'ja' ? '抽出' : 'Extract'}</span>
                        {colors.length > 0 && (
                          <span className="ml-0.5 px-1 min-w-[14px] h-3.5 bg-accent text-white rounded-full text-[9px] font-bold flex items-center justify-center leading-none tabular-nums">
                            {colors.length}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSwitchWorkbenchSubpage('mixer')}
                        className={`gk-tab-pill flex-1 py-1.5 text-xs font-bold rounded-full transition-all duration-150 flex items-center justify-center gap-1 whitespace-nowrap ${
                          workbenchSubpage === 'mixer'
                            ? 'gk-tab-pill-active bg-white dark:bg-slate-700 text-accent dark:text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                        }`}
                      >
                        <FlaskIcon className="w-3.5 h-3.5 shrink-0" />
                        <span>{lang === 'zh' ? '调色分解' : lang === 'ja' ? '混色' : 'Mixer'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSwitchWorkbenchSubpage('chroma')}
                        className={`gk-tab-pill flex-1 py-1.5 text-xs font-bold rounded-full transition-all duration-150 flex items-center justify-center gap-1 whitespace-nowrap ${
                          workbenchSubpage === 'chroma'
                            ? 'gk-tab-pill-active bg-white dark:bg-slate-700 text-accent dark:text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                        }`}
                      >
                        <SquaresFourIcon className="w-3.5 h-3.5 shrink-0" />
                        <span>{lang === 'zh' ? '明度色卡' : lang === 'ja' ? '色階' : 'Chroma'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Mobile Top Segmented Control for Tuning (自选 | 基础 | 近邻) */}
                {mobileMainTab === 'tuning' && (
                  <div className={`lg:hidden mb-4 ${hideTopBar ? 'pr-11' : ''}`}>
                    <div className="gk-tab-bar flex bg-slate-100/90 dark:bg-slate-800/90 backdrop-blur-xl p-1 rounded-full border border-slate-200/60 dark:border-slate-700/60 shadow-xs">
                      <button
                        type="button"
                        onClick={() => handleSwitchTuningSubpage('custom')}
                        className={`gk-tab-pill flex-1 py-1.5 text-xs font-bold rounded-full transition-all duration-150 flex items-center justify-center gap-1 whitespace-nowrap ${
                          tuningSubpage === 'custom'
                            ? 'gk-tab-pill-active bg-white dark:bg-slate-700 text-accent dark:text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                        }`}
                      >
                        <SlidersHorizontalIcon className="w-3.5 h-3.5 shrink-0" />
                        <span>{lang === 'zh' ? '自选' : lang === 'ja' ? '自選' : 'Custom'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSwitchTuningSubpage('basic')}
                        className={`gk-tab-pill flex-1 py-1.5 text-xs font-bold rounded-full transition-all duration-150 flex items-center justify-center gap-1 whitespace-nowrap ${
                          tuningSubpage === 'basic'
                            ? 'gk-tab-pill-active bg-white dark:bg-slate-700 text-accent dark:text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                        }`}
                      >
                        <DropIcon className="w-3.5 h-3.5 shrink-0" />
                        <span>{lang === 'zh' ? '基础' : lang === 'ja' ? '基本' : 'Basic'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSwitchTuningSubpage('brands')}
                        className={`gk-tab-pill flex-1 py-1.5 text-xs font-bold rounded-full transition-all duration-150 flex items-center justify-center gap-1 whitespace-nowrap ${
                          tuningSubpage === 'brands'
                            ? 'gk-tab-pill-active bg-white dark:bg-slate-700 text-accent dark:text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                        }`}
                      >
                        <TagIcon className="w-3.5 h-3.5 shrink-0" />
                        <span>{lang === 'zh' ? '近邻' : lang === 'ja' ? '近似色' : 'Matches'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Mobile Quick Color Switcher (hidden in coloring/studio/catalog/brands standalone where dedicated headers exist) */}
                {colors.length > 0 && mobileMainTab !== 'coloring' && mobileMainTab !== 'studio' && mobileMainTab !== 'catalog' && !(mobileMainTab === 'tuning' && tuningSubpage === 'brands') && (
                  <div className="gk-dashed-divider-b lg:hidden mt-1 mb-5 pt-1.5 pb-3 border-b border-slate-200/80 dark:border-slate-700/80 flex items-center gap-2.5 overflow-x-auto no-scrollbar">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex-shrink-0 pl-0.5 whitespace-nowrap">
                      {lang === 'zh' ? '当前色:' : lang === 'ja' ? '対象色:' : 'Target:'}
                    </span>
                    <div className="flex items-center gap-2 py-1.5 overflow-x-auto no-scrollbar">
                      {colors.map((c) => {
                        const isSel = c.id === selectedColorId;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setSelectedColorId(c.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all flex-shrink-0 whitespace-nowrap ${
                              isSel
                                ? 'bg-accent/10 dark:bg-accent/20 border-2 border-accent text-accent dark:text-accent-light font-bold shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/70 text-slate-600 dark:text-slate-400 hover:bg-slate-200/60'
                            }`}
                          >
                            <span className="w-3 h-3 rounded-full border border-black/15 flex-shrink-0 shadow-xs" style={{ backgroundColor: c.hex }} />
                            <span className="font-mono text-xs font-semibold">{c.hex}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Desktop Tabs Bar: Dual Workflow Support (Beginner 4-Step Guided vs Pro 8-Tab Full) */}
                <div className="hidden lg:flex w-full items-center mb-6 relative z-40" translate="no">
                  {workflowMode === 'beginner' ? (
                    <div className="gk-tab-bar w-full flex items-center flex-nowrap bg-slate-100/90 dark:bg-slate-800/90 backdrop-blur-xl rounded-full p-1 gap-1.5 border border-slate-200/60 dark:border-slate-700/60">
                      <button
                        type="button"
                        onClick={() => handleSwitchDesktopTab('coloring')}
                        className={`gk-tab-pill flex-1 justify-center px-3 py-1.5 text-xs font-black rounded-full transition-all duration-200 ease-out flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                          desktopTabUI === 'coloring'
                            ? 'gk-tab-pill-active bg-white dark:bg-slate-600 shadow text-accent dark:text-white'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                        }`}
                        title="第1步：在模型/线稿图上自由换色，自动推导四层光影"
                      >
                        <PaletteIcon className="w-4 h-4 shrink-0" />
                        <span>{lang === 'zh' ? '模拟试色台' : 'Color Studio'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSwitchDesktopTab('brands')}
                        className={`gk-tab-pill flex-1 justify-center px-3 py-1.5 text-xs font-black rounded-full transition-all duration-200 ease-out flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                          desktopTabUI === 'brands'
                            ? 'gk-tab-pill-active bg-white dark:bg-slate-600 shadow text-accent dark:text-white'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                        }`}
                        title="第2步：查找最接近的现成品牌油漆，或获取『现成品牌漆 + 几滴白/黑微调』补正方案"
                      >
                        <TagIcon className="w-4 h-4 shrink-0" />
                        <span>{lang === 'zh' ? '选漆与微调' : 'Brand & Tint'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSwitchDesktopTab('studio')}
                        className={`gk-tab-pill flex-1 justify-center px-3 py-1.5 text-xs font-black rounded-full transition-all duration-200 ease-out flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                          desktopTabUI === 'studio'
                            ? 'gk-tab-pill-active bg-white dark:bg-slate-600 shadow text-accent dark:text-white'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                        }`}
                        title="第3步：查看涂装库工程、导出带微调色卡的分享海报与二维码名片"
                      >
                        <StackIcon className="w-4 h-4 shrink-0" />
                        <span>{lang === 'zh' ? '涂装库与色卡' : 'Paint Library'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSwitchDesktopTab('catalog')}
                        className={`gk-tab-pill flex-1 justify-center px-3 py-1.5 text-xs font-black rounded-full transition-all duration-200 ease-out flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                          desktopTabUI === 'catalog'
                            ? 'gk-tab-pill-active bg-white dark:bg-slate-600 shadow text-accent dark:text-white'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                        }`}
                        title="第4步：检索 10,999+ 款全球模型油漆完整数据库"
                      >
                        <DatabaseIcon className="w-4 h-4 shrink-0" />
                        <span>{lang === 'zh' ? '油漆数据库' : 'Catalog'}</span>
                      </button>

                      <div className="w-[1px] h-5 bg-slate-200 dark:bg-slate-700 my-auto mx-0.5 shrink-0" />

                      {/* Collapsible Advanced Mixing Dropdown for Beginners */}
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={() => setShowAdvancedNavMenu((v) => !v)}
                          className={`gk-tab-pill px-3 py-1.5 text-xs font-extrabold rounded-full transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                            desktopTabUI === 'mixer' ||
                            desktopTabUI === 'chroma' ||
                            desktopTabUI === 'custom' ||
                            desktopTabUI === 'basic'
                              ? 'gk-tab-pill-active bg-white dark:bg-slate-600 shadow text-accent dark:text-white'
                              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                          }`}
                          title="展开专业进阶调色工具（调色分解 / 明度色卡 / 自选调色 / 基础色母）"
                        >
                          <FlaskIcon className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            {lang === 'zh' ? '进阶调色' : 'Advanced'}{' '}
                            {desktopTabUI === 'mixer'
                              ? '· 调色分解'
                              : desktopTabUI === 'chroma'
                              ? '· 明度色卡'
                              : desktopTabUI === 'custom'
                              ? '· 自选调色'
                              : desktopTabUI === 'basic'
                              ? '· 基础色'
                              : '▾'}
                          </span>
                        </button>

                        {showAdvancedNavMenu && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setShowAdvancedNavMenu(false)}
                            />
                            <div className="bp-subcard-lg absolute right-0 top-full mt-2 z-50 w-64 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1.5 shadow-2xl space-y-1">
                              <div className="px-2.5 py-1 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                🛠️ 进阶调色与取色工具
                              </div>
                              <button
                                type="button"
                                onClick={() => handleSwitchDesktopTab('chroma')}
                                className={`w-full rounded-xl px-3 py-2 text-left text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                                  desktopTabUI === 'chroma'
                                    ? 'bg-accent text-white'
                                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                              >
                                <SquaresFourIcon className="w-4 h-4 shrink-0" />
                                <div>
                                  <div>明度色卡与滴数微调</div>
                                  <div className="text-[10px] opacity-75 font-normal">照片取色 + 品牌漆滴数微调</div>
                                </div>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSwitchDesktopTab('mixer')}
                                className={`w-full rounded-xl px-3 py-2 text-left text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                                  desktopTabUI === 'mixer'
                                    ? 'bg-accent text-white'
                                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                              >
                                <FlaskIcon className="w-4 h-4 shrink-0" />
                                <div>
                                  <div>调色分解 (CMYK/色母反推)</div>
                                  <div className="text-[10px] opacity-75 font-normal">从零计算多瓶色母混色比例</div>
                                </div>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSwitchDesktopTab('custom')}
                                className={`w-full rounded-xl px-3 py-2 text-left text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                                  desktopTabUI === 'custom'
                                    ? 'bg-accent text-white'
                                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                              >
                                <SlidersHorizontalIcon className="w-4 h-4 shrink-0" />
                                <div>
                                  <div>自选调色 (环形混色盘)</div>
                                  <div className="text-[10px] opacity-75 font-normal">自由组合手头已有的油漆混色</div>
                                </div>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSwitchDesktopTab('basic')}
                                className={`w-full rounded-xl px-3 py-2 text-left text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                                  desktopTabUI === 'basic'
                                    ? 'bg-accent text-white'
                                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                              >
                                <DropIcon className="w-4 h-4 shrink-0" />
                                <div>
                                  <div>基础色母调配</div>
                                  <div className="text-[10px] opacity-75 font-normal">使用红黄蓝黑白基础色母实验</div>
                                </div>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="gk-tab-bar w-full flex items-center flex-nowrap overflow-x-auto no-scrollbar bg-slate-100/90 dark:bg-slate-800/90 backdrop-blur-xl rounded-full p-1 gap-1 border border-slate-200/60 dark:border-slate-700/60">
                        {/* 混色台组 */}
                        <button 
                            onClick={() => handleSwitchDesktopTab('mixer')}
                            className={`gk-tab-pill flex-1 justify-center px-2 xl:px-3 py-1.5 text-xs font-bold rounded-full transition-all duration-200 ease-out flex items-center gap-1.5 whitespace-nowrap shrink-0 ${desktopTabUI === 'mixer' ? 'gk-tab-pill-active bg-white dark:bg-slate-600 shadow text-accent dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <FlaskIcon className="w-3.5 h-3.5 shrink-0" />
                            <span>{lang === 'zh' ? '调色分解' : 'Mixer'}</span>
                        </button>
                        <button 
                            onClick={() => handleSwitchDesktopTab('chroma')}
                            className={`gk-tab-pill flex-1 justify-center px-2 xl:px-3 py-1.5 text-xs font-bold rounded-full transition-all duration-200 ease-out flex items-center gap-1.5 whitespace-nowrap shrink-0 ${desktopTabUI === 'chroma' ? 'gk-tab-pill-active bg-white dark:bg-slate-600 shadow text-accent dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <SquaresFourIcon className="w-3.5 h-3.5 shrink-0" />
                            <span>{lang === 'zh' ? '明度色卡' : 'Chroma Matrix'}</span>
                        </button>
                        
                        <div className="w-[1px] h-5 bg-slate-200 dark:bg-slate-700 my-auto mx-0.5 shrink-0" />

                        {/* 调色台组 */}
                        <button 
                            onClick={() => handleSwitchDesktopTab('custom')}
                            className={`gk-tab-pill flex-1 justify-center px-2 xl:px-3 py-1.5 text-xs font-bold rounded-full transition-all duration-200 ease-out flex items-center gap-1.5 whitespace-nowrap shrink-0 ${desktopTabUI === 'custom' ? 'gk-tab-pill-active bg-white dark:bg-slate-600 shadow text-accent dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <SlidersHorizontalIcon className="w-3.5 h-3.5 shrink-0" />
                            <span>{lang === 'zh' ? '自选调色' : 'Custom'}</span>
                        </button>
                        <button 
                            onClick={() => handleSwitchDesktopTab('basic')}
                            className={`gk-tab-pill flex-1 justify-center px-2 xl:px-2.5 py-1.5 text-xs font-bold rounded-full transition-all duration-200 ease-out flex items-center gap-1.5 whitespace-nowrap shrink-0 ${desktopTabUI === 'basic' ? 'gk-tab-pill-active bg-white dark:bg-slate-600 shadow text-accent dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <DropIcon className="w-3.5 h-3.5 shrink-0" />
                            <span>{lang === 'zh' ? '基础色' : 'Basic'}</span>
                        </button>
                        <button 
                            onClick={() => handleSwitchDesktopTab('brands')}
                            className={`gk-tab-pill flex-1 justify-center px-2 xl:px-2.5 py-1.5 text-xs font-bold rounded-full transition-all duration-200 ease-out flex items-center gap-1.5 whitespace-nowrap shrink-0 ${desktopTabUI === 'brands' ? 'gk-tab-pill-active bg-white dark:bg-slate-600 shadow text-accent dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <TagIcon className="w-3.5 h-3.5 shrink-0" />
                            <span>{lang === 'zh' ? '品牌近邻' : 'Brand Matches'}</span>
                        </button>

                        <div className="w-[1px] h-5 bg-slate-200 dark:bg-slate-700 my-auto mx-0.5 shrink-0" />

                        {/* 试色台、涂装库与数据库 */}
                        <button 
                            onClick={() => handleSwitchDesktopTab('coloring')}
                            className={`gk-tab-pill flex-1 justify-center px-2 xl:px-3 py-1.5 text-xs font-bold rounded-full transition-all duration-200 ease-out flex items-center gap-1.5 whitespace-nowrap shrink-0 ${desktopTabUI === 'coloring' ? 'gk-tab-pill-active bg-white dark:bg-slate-600 shadow text-accent dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}
                            title="GKMixer STUDIO · AI 智能分件试色台 (COLOR STUDIO)"
                        >
                            <PaletteIcon className="w-3.5 h-3.5 shrink-0" />
                            <span>{lang === 'zh' ? '试色台' : 'Color Studio'}</span>
                        </button>
                        <button 
                            onClick={() => handleSwitchDesktopTab('studio')}
                            className={`gk-tab-pill flex-1 justify-center px-2 xl:px-3 py-1.5 text-xs font-bold rounded-full transition-all duration-200 ease-out flex items-center gap-1.5 whitespace-nowrap shrink-0 ${desktopTabUI === 'studio' ? 'gk-tab-pill-active bg-white dark:bg-slate-600 shadow text-accent dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <StackIcon className="w-3.5 h-3.5 shrink-0" />
                            <span>{lang === 'zh' ? '涂装库' : 'Paint Library'}</span>
                        </button>
                        <button 
                            onClick={() => handleSwitchDesktopTab('catalog')}
                            className={`gk-tab-pill flex-1 justify-center px-2 xl:px-3 py-1.5 text-xs font-bold rounded-full transition-all duration-200 ease-out flex items-center gap-1.5 whitespace-nowrap shrink-0 ${desktopTabUI === 'catalog' ? 'gk-tab-pill-active bg-white dark:bg-slate-600 shadow text-accent dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <DatabaseIcon className="w-3.5 h-3.5 shrink-0" />
                            <span>{lang === 'zh' ? '数据库' : 'Catalog'}</span>
                        </button>
                    </div>
                  )}
                </div>

                {/* Active Content Panel - Kept persistently mounted to eliminate unmount/remount lag during tab switching */}
                <KeepAlivePanel active={desktopTab === 'mixer'} direction={tabTransitionDir}>
                  <ErrorBoundary fallbackTitle="调色分解视图遇到渲染异常">
                    <MixerResult 
                        color={selectedColor} 
                        lang={lang} 
                        colorSpace={colorSpace} 
                        onAddColor={handleAddColor}
                        cache={mixerResultCache}
                        onCacheUpdate={setMixerResultCache}
                        onAssignCatalogPaint={handleAssignCatalogPaint}
                        onNavigateToExtract={() => handleSwitchWorkbenchSubpage('extract')}
                    />
                  </ErrorBoundary>
                </KeepAlivePanel>

                <KeepAlivePanel active={desktopTab === 'chroma'} direction={tabTransitionDir}>
                  <ErrorBoundary fallbackTitle="明度色卡视图遇到渲染异常">
                    <ChromaStudioPanel 
                        color={selectedColor}
                        availableColors={colors}
                        selectedColorId={selectedColorId}
                        onSelectColorId={setSelectedColorId}
                        onSelectColor={(c) => setSelectedColorId(c.id)}
                        lang={lang}
                        onAddColor={handleAddColor}
                        onNavigateToExtract={() => handleSwitchWorkbenchSubpage('extract')}
                        pendingTonalSample={colors.find((c) => c.id === pendingTonalSampleId) || null}
                        onConfirmTonalReplace={handleConfirmTonalReplace}
                        onCancelTonalReplace={() => setPendingTonalSampleId(null)}
                    />
                  </ErrorBoundary>
                </KeepAlivePanel>

                <KeepAlivePanel active={desktopTab === 'custom'} direction={tabTransitionDir}>
                  <ErrorBoundary fallbackTitle="自选调色视图遇到渲染异常">
                    <RadialPaletteMixer
                        targetColor={selectedColor}
                        availableColors={colors}
                        lang={lang}
                        onAddColors={handleAddColors}
                        cache={radialMixerCache}
                        onCacheUpdate={setRadialMixerCache}
                        onAssignCatalogPaint={handleAssignCatalogPaint}
                        onNavigateToBrands={(hex) => {
                          handleAddColor(hex);
                          handleSwitchDesktopTab('brands');
                        }}
                    />
                  </ErrorBoundary>
                </KeepAlivePanel>

                <KeepAlivePanel active={desktopTab === 'basic'} direction={tabTransitionDir}>
                  <ErrorBoundary fallbackTitle="基础调色视图遇到渲染异常">
                    <BasicColorMixer 
                        lang={lang}
                        cache={basicMixerCache}
                        onCacheUpdate={setBasicMixerCache}
                        onNavigateToBrands={(hex) => {
                          handleAddColor(hex);
                          handleSwitchDesktopTab('brands');
                        }}
                        onSaveToCustomPalette={(hex) => {
                          setRadialMixerCache((prev) => {
                            const exists = prev.sliders.some((s) => s.color.toUpperCase() === hex.toUpperCase());
                            if (exists) return prev;
                            const newSlider: SliderState = {
                              id: `custom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                              color: hex.toUpperCase(),
                              weight: 0.2,
                              position: 0.2,
                              angle: 0,
                              scale: 1.0,
                            };
                            return {
                              ...prev,
                              sliders: [...prev.sliders, newSlider],
                            };
                          });
                          handleSwitchDesktopTab('custom');
                        }}
                    />
                  </ErrorBoundary>
                </KeepAlivePanel>

                <KeepAlivePanel active={desktopTab === 'brands'} direction={tabTransitionDir}>
                  <ErrorBoundary fallbackTitle="品牌近邻视图遇到渲染异常">
                    {workflowMode === 'beginner' ? (
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                        {/* Left Column: 色卡预览图 (色卡编辑导出预览图) + 双品牌漆 Mixbox 混色试验台 (Screenshot 3) */}
                        <div className="lg:col-span-5 xl:col-span-5 lg:sticky lg:top-4 min-w-0 space-y-4">
                          <div className="bp-subcard-lg rounded-2xl border border-slate-200/85 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 p-3 sm:p-3.5 shadow-xs space-y-3">
                            {/* Header Bar */}
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">
                                  <span className="tech-prefix">[PREVIEW]</span>
                                  色卡编辑预览图
                                </span>
                                <span className="bp-badge px-2 py-0.5 rounded-full bg-accent/12 text-accent dark:text-white text-[10px] font-extrabold font-mono shrink-0">
                                  {sandboxColors.length} 色
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  disabled={!sandboxSyncState?.compositeDataUrl || sandboxColors.length === 0}
                                  onClick={handleSaveSandboxToProject}
                                  className="bp-btn flex items-center gap-1.5 rounded-lg bg-accent hover:bg-accent-hover px-3 py-1.5 text-[11px] font-extrabold text-white shadow-xs disabled:opacity-40 cursor-pointer"
                                  title="存入涂装项目库，可继续添加涂装工序、制作项目二维码名片及导出 .gkmix 工程文件"
                                >
                                  <FolderPlusIcon className="h-3.5 w-3.5" weight="bold" />
                                  <span>存入涂装库</span>
                                </button>
                              </div>
                            </div>

                            {/* Side-by-Side Stage: Left = 色卡编辑导出预览图, Right = 竖置摆放的模拟试色台已上色备选色 */}
                            <div className="flex flex-col sm:flex-row gap-2.5 items-stretch">
                              {/* Left: 色卡编辑导出的预览图 */}
                              <div className="bp-canvas-stage flex-1 min-w-0 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-950 p-2 flex items-center justify-center relative overflow-hidden min-h-[260px] sm:min-h-[340px]">
                                {sandboxSyncState?.compositeDataUrl ? (
                                  <div className="relative inline-block max-w-full">
                                    <img
                                      src={sandboxSyncState.compositeDataUrl}
                                      alt="色卡编辑预览图"
                                      className="bp-swatch block max-h-[42dvh] lg:max-h-[48dvh] w-auto max-w-full rounded-xl object-contain select-none"
                                      draggable={false}
                                    />
                                    {sandboxColors.length > 0 && (
                                      <ExtractMarkerOverlay
                                        colors={sandboxColors}
                                        selectedId={selectedSandboxColor?.id || null}
                                        onSelect={(cOrId) => {
                                          const id = typeof cOrId === 'string' ? cOrId : cOrId?.id;
                                          if (id) {
                                            setBeginnerOverrideHex(null);
                                            setSelectedSandboxColorId(id);
                                          }
                                        }}
                                        onUpdatePosition={(id, nx, ny) => {
                                          setSandboxColors((prev) =>
                                            prev.map((c) => (c.id === id ? { ...c, labelNx: nx, labelNy: ny } : c))
                                          );
                                        }}
                                        settings={swatchSettings}
                                        interactive={true}
                                        allowDrag={true}
                                      />
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center justify-center text-center p-6 space-y-2.5">
                                    <PaletteIcon className="w-8 h-8 text-slate-500" />
                                    <div className="text-xs font-bold text-slate-300">
                                      请先在「模拟试色台」上传模型图并涂抹备选色
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleSwitchDesktopTab('coloring')}
                                      className="bp-pill-active gk-btn-primary rounded-full bg-accent px-3.5 py-1.5 text-xs font-extrabold text-white shadow-sm cursor-pointer"
                                    >
                                      前往模拟试色台涂色 →
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Right of Preview Image: 竖置摆放的试色台已上色备选色列 */}
                              <div className="w-full sm:w-[136px] xl:w-[148px] shrink-0 flex flex-col gap-1.5">
                                <div className="flex items-center justify-between px-1">
                                  <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    📌 试色台用色
                                  </span>
                                  <span className="text-[10px] font-mono font-bold text-slate-400">
                                    {sandboxColors.length} 项
                                  </span>
                                </div>

                                <div className="flex sm:flex-col gap-2 overflow-x-auto sm:overflow-y-auto sm:max-h-[42dvh] lg:max-h-[48dvh] p-0.5 pr-1.5 pb-1.5">
                                  {sandboxColors.length > 0 ? (
                                    sandboxColors.map((sc) => {
                                      const isSelected = selectedSandboxColor?.id === sc.id;
                                      const swMeta = sandboxSyncState?.syncedSwatches.find(
                                        (s) => s.id === sc.id || s.hex.toUpperCase() === sc.hex.toUpperCase()
                                      );
                                      const paint = sc.assignedPaint;
                                      const labelText = paint
                                        ? `${paint.brand} ${paint.code}`
                                        : swMeta
                                        ? `${swMeta.brand} ${swMeta.code}`
                                        : sc.hex;
                                      const subName = paint?.name || swMeta?.name || sc.hex;
                                      return (
                                        <button
                                          key={sc.id}
                                          type="button"
                                          onClick={() => {
                                            setBeginnerOverrideHex(null);
                                            setSelectedSandboxColorId(sc.id);
                                          }}
                                          className={`bp-subcard group shrink-0 w-36 sm:w-full flex flex-col gap-1 rounded-xl border p-2 text-left transition cursor-pointer ${
                                            isSelected
                                              ? 'bp-subcard-active border-accent bg-accent/10 dark:bg-accent/20 shadow-xs'
                                              : 'border-slate-200 dark:border-slate-700/80 bg-slate-50/90 dark:bg-slate-800/80 hover:border-accent/60'
                                          }`}
                                          title="点击在右侧匹配品牌油漆或微调滴数，指派后实时更新左侧色卡预览图"
                                        >
                                          <div className="flex items-center gap-1.5">
                                            <span
                                              className="bp-swatch h-5 flex-1 rounded-md border border-black/15 relative overflow-hidden"
                                              style={{ backgroundColor: sc.hex }}
                                            />
                                            {swMeta && (
                                              <span className="px-1 py-0.5 rounded bg-slate-200/80 dark:bg-slate-700 text-[9px] font-mono font-bold text-slate-600 dark:text-slate-300 shrink-0">
                                                {swMeta.regionCount}处
                                              </span>
                                            )}
                                          </div>
                                          <div className="truncate text-[11px] font-black text-slate-800 dark:text-slate-100 leading-tight">
                                            {labelText}
                                          </div>
                                          <div className="flex items-center justify-between gap-1 text-[9px] font-mono text-slate-400">
                                            <span className="truncate">{subName}</span>
                                            <span>{sc.hex}</span>
                                          </div>
                                        </button>
                                      );
                                    })
                                  ) : (
                                    <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-3 text-center text-[11px] text-slate-400 space-y-1.5">
                                      <div>暂无已上色备选色</div>
                                      <div className="text-[10px]">
                                        在「模拟试色台」选好备选色并涂抹到模型上后，会自动同步至此列表
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Prominent UI Button to open SwatchEditorModal (进入排版工作台) */}
                            <button
                              type="button"
                              disabled={!sandboxSyncState?.compositeDataUrl || sandboxColors.length === 0}
                              onClick={() => {
                                setSwatchEditorMode('sandbox');
                                setIsSwatchEditorOpen(true);
                              }}
                              className="bp-pill-active gk-btn-primary w-full flex items-center justify-center gap-2 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-40 px-3.5 py-2.5 text-xs font-extrabold text-white shadow-sm transition-all active:scale-[0.98] cursor-pointer"
                            >
                              <SlidersHorizontalIcon className="w-4 h-4 shrink-0" weight="bold" />
                              <span>
                                {lang === 'zh'
                                  ? `进入排版工作台 (${sandboxColors.length} 个色卡) →`
                                  : `Open Swatch Layout Studio (${sandboxColors.length}) →`}
                              </span>
                            </button>
                          </div>

                          {/* Below Preview Image (Screenshot 3): Dual-Brand Paint Mixbox Trial Mixer + Fast Same-Color Paint Matcher */}
                          <DualBrandPaintMixerCard
                            lang={lang}
                            sandboxColors={sandboxColors}
                            selectedSandboxColor={selectedSandboxColor}
                            onSendHexToBrandMatcher={(mixedHex) => {
                              setBeginnerOverrideHex(mixedHex.toUpperCase());
                              showToast(
                                lang === 'zh'
                                  ? `🧪 已将混合色 ${mixedHex} 发送至右侧匹配同色现成油漆`
                                  : `Sent mixed color ${mixedHex} to Brand Matcher`
                              );
                            }}
                            onAssignCatalogPaint={(paint) => {
                              handleAssignSandboxCatalogPaint(paint);
                            }}
                          />
                        </div>

                        {/* Right Column: 选漆与微调 (BrandMatchPanel) */}
                        <div className="lg:col-span-7 xl:col-span-7 min-w-0">
                          <BrandMatchPanel
                            hex={
                              beginnerOverrideHex ||
                              selectedSandboxColor?.hex ||
                              sandboxSyncState?.activeHex ||
                              selectedColor?.hex ||
                              colors[0]?.hex ||
                              '#4A7BD0'
                            }
                            lang={lang}
                            standaloneMode={true}
                            beginnerSandboxMode={true}
                            sandboxSwatches={sandboxSyncState?.syncedSwatches || []}
                            onSelectSandboxSwatch={(_hex, id) => {
                              setBeginnerOverrideHex(null);
                              setSelectedSandboxColorId(id);
                            }}
                            onNavigateToSandbox={() => handleSwitchDesktopTab('coloring')}
                            hasSamplePoint={!!selectedSandboxColor}
                            assignedId={selectedSandboxColor?.assignedPaint?.id || null}
                            assignedPaint={selectedSandboxColor?.assignedPaint || null}
                            onAssignCatalog={handleAssignSandboxCatalogPaint}
                            onChangeHex={(newHex) => {
                              setBeginnerOverrideHex(newHex.toUpperCase());
                              if (selectedSandboxColor) {
                                setSandboxColors((prev) =>
                                  prev.map((c) =>
                                    c.id === selectedSandboxColor.id
                                      ? { ...c, hex: newHex.toUpperCase() }
                                      : c
                                  )
                                );
                              } else {
                                handleAddColor(newHex);
                              }
                            }}
                            sourceOptions={{
                              workbenchHex: selectedSandboxColor?.hex || sandboxSyncState?.activeHex || null,
                              libraryHex: savedColors[0]?.hex || null,
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <BrandMatchPanel
                        hex={selectedColor?.hex || colors[0]?.hex || '#4A7BD0'}
                        lang={lang}
                        standaloneMode={true}
                        hasSamplePoint={!!selectedColor && hasSamplePoint(selectedColor)}
                        assignedId={selectedColor?.assignedPaint?.id || null}
                        assignedPaint={selectedColor?.assignedPaint || null}
                        onAssignCatalog={handleAssignCatalogPaint}
                        onChangeHex={handleAddColor}
                        onSyncToWorkbench={(hex) => {
                          handleAddColor(hex);
                          handleSwitchWorkbenchSubpage('mixer');
                        }}
                        sourceOptions={{
                          workbenchHex: selectedColor?.hex || colors[0]?.hex || null,
                          customMixHex: radialMixerCache.sliders[0]?.hex || null,
                          basicMixHex: basicMixerCache.baseColors[0]?.hex || null,
                          libraryHex: savedColors[0]?.hex || null,
                        }}
                      />
                    )}
                  </ErrorBoundary>
                </KeepAlivePanel>

                <KeepAlivePanel active={desktopTab === 'coloring'} direction={tabTransitionDir}>
                  <ErrorBoundary fallbackTitle="AI 试色台视图遇到渲染异常">
                    <ColoringSandboxLab
                        lang={lang}
                        theme={theme}
                        setTheme={setTheme}
                        incomingImage={coloringIncomingImage}
                        externalCatalogPaints={catalogPaints}
                        isActiveTab={desktopTab === 'coloring'}
                        onSyncSandboxState={handleSyncSandboxState}
                        externalBrandAssignment={externalSandboxAssign}
                        onSendColorToMixer={(hex) => {
                          handleAddColor(hex);
                          handleSwitchWorkbenchSubpage('mixer');
                          showToast(lang === 'zh' ? `已将试色油漆 ${hex} 发送至「调色分解」反推配方` : `Sent ${hex} to Mixer`);
                        }}
                        onNavigateToBrandTint={(hex) => {
                          handleAddColor(hex);
                          setSelectedSandboxColorId(`sandbox-swatch-${hex.toUpperCase()}`);
                          handleSwitchDesktopTab('brands');
                          showToast(lang === 'zh' ? `已将试色 ${hex} 载入「选漆与微调」，可匹配现成品牌漆或查看几滴白/黑微调方案` : `Loaded ${hex} into Brand & Tint`);
                        }}
                        onCreatePaintProject={(newProj) => {
                          setProjects((prev) => [newProj, ...prev]);
                          setFocusProjectId(newProj.id);
                          handleSwitchDesktopTab('studio');
                          showToast(
                            lang === 'zh'
                              ? `已创建涂装工程「${newProj.title}」并自动生成色卡与工序`
                              : `Created project ${newProj.title}`
                          );
                        }}
                    />
                  </ErrorBoundary>
                </KeepAlivePanel>

                {desktopTab === 'catalog' ? (
                  <div key="tab-catalog" translate="no" className="notranslate gk-tab-transition">
                    <ErrorBoundary fallbackTitle="数据库视图遇到渲染异常">
                      <PaintCatalogBrowser
                          lang={lang}
                          initialPaints={catalogPaints}
                          onPickHex={handleAddColor}
                          onAssignCatalog={handleAssignCatalogPaint}
                          activeSampleColor={selectedColor || colors[0] || null}
                      />
                    </ErrorBoundary>
                  </div>
                ) : desktopTab === 'studio' ? (
                  <div key="tab-studio" translate="no" className="notranslate gk-tab-transition">
                    <ErrorBoundary fallbackTitle="涂装库视图遇到渲染异常">
                      <ProjectLibraryView
                          projects={projects}
                          onChangeProjects={setProjects}
                          categories={categories}
                          onChangeCategories={setCategories}
                          savedColors={savedColors}
                          onChangeSavedColors={setSavedColors}
                          catalogPaints={catalogPaints}
                          swatchSettings={swatchSettings}
                          onUpdateSwatchSettings={setSwatchSettings}
                          lang={lang}
                          isWideMode={isWideVisualizer}
                          onToggleWideMode={() => setIsWideVisualizer((v) => !v)}
                          focusProjectId={focusProjectId}
                          onClearFocusProject={() => setFocusProjectId(null)}
                          onSendImageToColoring={handleSendImageToColoring}
                          onSendColorToWorkbench={(hex) => {
                            handleAddColor(hex);
                            handleSwitchWorkbenchSubpage('mixer');
                          }}
                      />
                    </ErrorBoundary>
                  </div>
                ) : null}
           </div>
        </div>

      </main>

      {/* Shared Swatch Editor Modal (callable from Tab 1 Extract Workbench OR Beginner Mode Brand & Tint Preview) */}
      <SwatchEditorModal
        isOpen={isSwatchEditorOpen}
        onClose={() => setIsSwatchEditorOpen(false)}
        imageSrc={
          swatchEditorMode === 'sandbox'
            ? sandboxSyncState?.compositeDataUrl || ''
            : sourceImage || ''
        }
        colors={swatchEditorMode === 'sandbox' ? sandboxColors : colors}
        selectedColor={swatchEditorMode === 'sandbox' ? selectedSandboxColor : selectedColor}
        onSelectColor={(c) => {
          if (swatchEditorMode === 'sandbox') {
            setSelectedSandboxColorId(c.id);
          } else {
            setSelectedColorId(c.id);
          }
        }}
        onUpdateColors={swatchEditorMode === 'sandbox' ? setSandboxColors : setColors}
        onUpdateImageAndColors={(newImageSrc, nextColors) => {
          if (swatchEditorMode === 'sandbox') {
            setSandboxSyncState((prev) =>
              prev ? { ...prev, compositeDataUrl: newImageSrc } : prev
            );
            setSandboxColors(nextColors);
          } else {
            setSourceImage(newImageSrc);
            setColors(nextColors);
          }
        }}
        settings={swatchSettings}
        onUpdateSettings={setSwatchSettings}
        lang={lang}
        onExportImage={
          swatchEditorMode === 'sandbox'
            ? handleExportSandboxAnnotated
            : handleExportAnnotated
        }
        isExporting={isExporting}
        onSaveToProject={() => {
          if (swatchEditorMode === 'sandbox' && sandboxSyncState?.compositeDataUrl) {
            handleSaveSandboxToProject();
          } else {
            setIsSaveToProjectOpen(true);
          }
        }}
      />

      {/* Save Current Swatch Canvas to Tab 3 PaintProject Modal */}
      <SaveToProjectModal
        isOpen={isSaveToProjectOpen}
        onClose={() => setIsSaveToProjectOpen(false)}
        imageSrc={sourceImage}
        colors={colors}
        projects={projects}
        categories={categories}
        onSaveToProject={(updatedOrNewProject, isNew) => {
          if (isNew) {
            setProjects((prev) => [updatedOrNewProject, ...prev]);
          } else {
            setProjects((prev) =>
              prev.map((p) => (p.id === updatedOrNewProject.id ? updatedOrNewProject : p))
            );
          }
          setFocusProjectId(updatedOrNewProject.id);
          handleSwitchDesktopTab('studio');
          showToast(
            lang === 'zh'
              ? `✅ 已存入涂装库「${updatedOrNewProject.title || '涂装工程'}」，可继续添加工序、制作二维码名片或打包工程！`
              : 'Saved part canvas to project'
          );
        }}
        onCreateCategory={(name) => {
          const newCat: PaletteCategory = { id: generateId(), name, createdAt: Date.now() };
          setCategories((prev) => [...prev, newCat]);
          return newCat;
        }}
        lang={lang}
      />

      {/* Settings Modal Drawer (iOS-style floating sheet containing all consolidated developer info) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        lang={lang}
        setLang={setLang}
        colorSpace={colorSpace}
        setColorSpace={setColorSpace}
        theme={theme}
        setTheme={setTheme}
        t={t}
      />

      {/* Export Annotated Image Success & Preview Modal */}
      <ExportSuccessModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        result={exportResult}
        lang={lang}
        onSaveToProject={() => {
          if (workflowMode === 'beginner' && sandboxSyncState?.compositeDataUrl) {
            handleSaveSandboxToProject();
          } else {
            setIsSaveToProjectOpen(true);
          }
        }}
      />

      {/* Contextual Workflow & Project Sharing Guide Modal */}
      <WorkflowGuideModal
        isOpen={isWorkflowGuideOpen}
        onClose={() => setIsWorkflowGuideOpen(false)}
        onSaveToProject={
          workflowMode === 'beginner' && sandboxSyncState?.compositeDataUrl && sandboxColors.length > 0
            ? handleSaveSandboxToProject
            : sourceImage && assignedMarkers.length > 0
            ? () => setIsSaveToProjectOpen(true)
            : undefined
        }
        onExportPng={
          workflowMode === 'beginner' && sandboxSyncState?.compositeDataUrl && sandboxColors.length > 0
            ? handleExportSandboxAnnotated
            : sourceImage && assignedMarkers.length > 0
            ? handleExportAnnotated
            : undefined
        }
        onNavigateToStudio={() => handleSwitchDesktopTab('studio')}
      />

      {/* Quick Paint Assign Bottom Sheet (Vertical-Friendly Closed Loop) */}
      <QuickPaintAssignSheet
        isOpen={!!quickAssignColorId}
        onClose={() => setQuickAssignColorId(null)}
        targetColor={
          quickAssignColorId
            ? colors.find((c) => c.id === quickAssignColorId) || selectedColor
            : null
        }
        sampleIndex={
          quickAssignColorId
            ? Math.max(0, colors.findIndex((c) => c.id === quickAssignColorId))
            : 0
        }
        catalogPaints={catalogPaints}
        lang={lang}
        onAssignPaint={(paint) => {
          handleAssignCatalogPaint(paint, quickAssignColorId ?? undefined);
          setQuickAssignColorId(null);
        }}
        onUnassignPaint={() => {
          const id = quickAssignColorId ?? selectedColorId;
          if (id) handleUnassignPaint(id);
          setQuickAssignColorId(null);
        }}
        onNavigateToBrandMatches={() => {
          if (quickAssignColorId) setSelectedColorId(quickAssignColorId);
          setQuickAssignColorId(null);
          handleSwitchTuningSubpage('brands');
        }}
        onNavigateToBrands={() => {
          if (quickAssignColorId) setSelectedColorId(quickAssignColorId);
          setQuickAssignColorId(null);
          handleSwitchTuningSubpage('brands');
        }}
        onNavigateToMixer={() => {
          if (quickAssignColorId) setSelectedColorId(quickAssignColorId);
          setQuickAssignColorId(null);
          handleSwitchWorkbenchSubpage('mixer');
        }}
      />

      {/* Floating Action Toast */}
      {actionToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full border-2 border-accent bg-slate-900/95 dark:bg-white/95 text-white dark:text-slate-900 text-xs font-bold shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CheckCircleIcon className="w-4 h-4 text-accent flex-shrink-0" weight="fill" />
          <span>{actionToast}</span>
        </div>
      )}

      {/* 底部悬浮快捷 Dock (Mobile Floating Dock: 5 Core Tabs) */}
      <nav
        aria-label="Mobile Navigation Dock"
        className="gk-mobile-dock lg:hidden fixed left-3 right-3 max-w-md mx-auto z-40 bg-white/94 dark:bg-[#1c1c1e]/94 backdrop-blur-2xl rounded-full border border-slate-200/80 dark:border-slate-700/80 shadow-[0_12px_36px_rgba(0,0,0,0.14),0_1px_3px_rgba(0,0,0,0.06)] select-none px-1.5 py-1"
        style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom, 0.75rem))' }}
      >
        <div className="grid grid-cols-5 w-full items-center gap-0.5">
          {/* 1. 混色台 (Workbench: 拾色 | 调色分解 | 明度色卡) */}
          <button
            type="button"
            onClick={() => handleSwitchMobileTab('workbench')}
            className={`min-w-0 relative flex flex-col items-center justify-center py-1.5 px-1 rounded-full transition-all duration-200 active:scale-95 whitespace-nowrap ${
              mobileMainTab === 'workbench'
                ? 'bg-accent/12 dark:bg-accent/22 text-accent dark:text-accent-light font-bold shadow-xs ring-1 ring-accent/25 dark:ring-accent/35'
                : 'text-slate-700 dark:text-slate-300 font-medium hover:text-accent dark:hover:text-accent-light'
            }`}
          >
            <div className="relative flex items-center justify-center mb-0.5">
              <FlaskIcon className="w-5 h-5 flex-shrink-0" />
              {selectedColor ? (
                <span 
                  className="absolute -top-0.5 -right-1.5 w-2.5 h-2.5 rounded-full border border-white dark:border-slate-900 shadow-sm"
                  style={{ backgroundColor: selectedColor.hex }}
                />
              ) : colors.length > 0 ? (
                <span className="absolute -top-1 -right-2 px-1 min-w-[14px] h-3.5 bg-accent text-white rounded-full text-[9px] font-bold flex items-center justify-center leading-none shadow-sm tabular-nums">
                  {colors.length}
                </span>
              ) : null}
            </div>
            <span className="text-[10px] tracking-tight whitespace-nowrap text-center leading-none">
              {t.dockWorkbench || (lang === 'zh' ? '混色台' : lang === 'ja' ? '混色台' : 'Workbench')}
            </span>
          </button>

          {/* 2. 调色 (Tuning: 自选 | 基础 | 近邻) */}
          <button
            type="button"
            onClick={() => handleSwitchMobileTab('tuning')}
            className={`min-w-0 relative flex flex-col items-center justify-center py-1.5 px-1 rounded-full transition-all duration-200 active:scale-95 whitespace-nowrap ${
              mobileMainTab === 'tuning'
                ? 'bg-accent/12 dark:bg-accent/22 text-accent dark:text-accent-light font-bold shadow-xs ring-1 ring-accent/25 dark:ring-accent/35'
                : 'text-slate-700 dark:text-slate-300 font-medium hover:text-accent dark:hover:text-accent-light'
            }`}
          >
            <div className="relative flex items-center justify-center mb-0.5">
              <SlidersHorizontalIcon className="w-5 h-5 flex-shrink-0" />
            </div>
            <span className="text-[10px] tracking-tight whitespace-nowrap text-center leading-none">
              {t.dockTuning || (lang === 'zh' ? '调色' : lang === 'ja' ? '調色' : 'Tuning')}
            </span>
          </button>

          {/* 3. 试色台 (Color Studio: AI 分件试色台) */}
          <button
            type="button"
            onClick={() => handleSwitchMobileTab('coloring')}
            className={`min-w-0 relative flex flex-col items-center justify-center py-1.5 px-1 rounded-full transition-all duration-200 active:scale-95 whitespace-nowrap ${
              mobileMainTab === 'coloring'
                ? 'bg-accent/12 dark:bg-accent/22 text-accent dark:text-accent-light font-bold shadow-xs ring-1 ring-accent/25 dark:ring-accent/35'
                : 'text-slate-700 dark:text-slate-300 font-medium hover:text-accent dark:hover:text-accent-light'
            }`}
          >
            <div className="relative flex items-center justify-center mb-0.5">
              <PaletteIcon className="w-5 h-5 flex-shrink-0" />
            </div>
            <span className="text-[10px] tracking-tight whitespace-nowrap text-center leading-none">
              {lang === 'zh' ? '试色台' : lang === 'ja' ? '試色台' : 'Studio'}
            </span>
          </button>

          {/* 4. 涂装库 (Paint Library: 涂装工程 | 单色色卡) */}
          <button
            type="button"
            onClick={() => handleSwitchMobileTab('studio')}
            className={`min-w-0 relative flex flex-col items-center justify-center py-1.5 px-1 rounded-full transition-all duration-200 active:scale-95 whitespace-nowrap ${
              mobileMainTab === 'studio'
                ? 'bg-accent/12 dark:bg-accent/22 text-accent dark:text-accent-light font-bold shadow-xs ring-1 ring-accent/25 dark:ring-accent/35'
                : 'text-slate-700 dark:text-slate-300 font-medium hover:text-accent dark:hover:text-accent-light'
            }`}
          >
            <div className="relative flex items-center justify-center mb-0.5">
              <StackIcon className="w-5 h-5 flex-shrink-0" />
            </div>
            <span className="text-[10px] tracking-tight whitespace-nowrap text-center leading-none">
              {lang === 'zh' ? '涂装库' : lang === 'ja' ? '塗装庫' : 'Library'}
            </span>
          </button>

          {/* 5. 数据库 (Catalog) */}
          <button
            type="button"
            onClick={() => handleSwitchMobileTab('catalog')}
            className={`min-w-0 relative flex flex-col items-center justify-center py-1.5 px-1 rounded-full transition-all duration-200 active:scale-95 whitespace-nowrap ${
              mobileMainTab === 'catalog'
                ? 'bg-accent/12 dark:bg-accent/22 text-accent dark:text-accent-light font-bold shadow-xs ring-1 ring-accent/25 dark:ring-accent/35'
                : 'text-slate-700 dark:text-slate-300 font-medium hover:text-accent dark:hover:text-accent-light'
            }`}
          >
            <div className="relative flex items-center justify-center mb-0.5">
              <DatabaseIcon className="w-5 h-5 flex-shrink-0" />
            </div>
            <span className="text-[10px] tracking-tight whitespace-nowrap text-center leading-none">
              {t.dockCatalog || (lang === 'zh' ? '数据库' : lang === 'ja' ? '色庫' : 'Catalog')}
            </span>
          </button>
        </div>
      </nav>

      <ColorLoupe
        ref={loupeHandleRef}
        active={isPicking}
        canvas={canvasRef.current}
      />
    </KonstaApp>
  );
};

export default App;