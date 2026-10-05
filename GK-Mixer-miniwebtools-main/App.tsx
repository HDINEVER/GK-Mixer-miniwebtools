import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
} from '@phosphor-icons/react';
import SettingsModal from './components/SettingsModal';
import DropZone from './components/DropZone';
import ColorPalette from './components/ColorPalette';
import MixerResult from './components/MixerResult';
import PaletteVisualizer from './components/PaletteVisualizer';
import RadialPaletteMixer from './components/RadialPaletteMixer';
import BasicColorMixer from './components/BasicColorMixer';
import PaintCatalogBrowser from './components/PaintCatalogBrowser';
import ColorLoupe, { sampleCanvasAtClient } from './components/ColorLoupe';
import ExtractMarkerOverlay from './components/ExtractMarkerOverlay';
import SwatchStudioControls from './components/SwatchStudioControls';
import Loader from './components/Loader';
import { ColorData, AppMode, RGB, Language, Theme, ColorSpace, MixerResultCache, RadialMixerCache, BasicMixerCache, MixingMode, SliderState, BaseColor, CatalogPaint } from './types';
import { extractProminentColors, generateId, rgbToCmyk, rgbToHex, hexToRgb, rgbToHsb, rgbToLab } from './utils/colorUtils';
import { convertToWorkingSpace, isInGamut } from './utils/colorSpaceConverter';
import { translations } from './utils/translations';
import { colorsToMarkers, exportAnnotatedImage } from './utils/exportAnnotatedImage';
import {
  SwatchSettings,
  DEFAULT_SWATCH_SETTINGS,
  autoArrangeLeftRight,
  autoArrangeTopBottom,
  alignMarkers,
  resetMarkerPositions,
} from './utils/swatchLayout';

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
  const [colorSpace, setColorSpace] = useState<ColorSpace>('srgb');
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [colors, setColors] = useState<ColorData[]>([]);
  const [selectedColorId, setSelectedColorId] = useState<string | null>(null);

  // === iOS-style Navigation State ===
  // Mobile/Portrait: 4 core bottom dock tabs
  type MobileMainTab = 'workbench' | 'tuning' | 'studio' | 'catalog';
  type WorkbenchSubpage = 'extract' | 'pro' | 'mixbox';
  type TuningSubpage = 'custom' | 'basic';
  type DesktopPanelTab = 'pro' | 'mixbox' | 'custom' | 'basic' | 'studio' | 'catalog';

  const [mobileMainTab, setMobileMainTab] = useState<MobileMainTab>('workbench');
  const [workbenchSubpage, setWorkbenchSubpage] = useState<WorkbenchSubpage>('extract');
  const [tuningSubpage, setTuningSubpage] = useState<TuningSubpage>('custom');
  const [desktopTab, setDesktopTab] = useState<DesktopPanelTab>('pro');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleSwitchMobileTab = useCallback((tab: MobileMainTab) => {
    // If re-tapping the active workbench tab while on pro/mixbox, cycle back to extract (iOS UX pattern)
    if (tab === mobileMainTab && tab === 'workbench' && workbenchSubpage !== 'extract') {
      setWorkbenchSubpage('extract');
      return;
    }
    setMobileMainTab(tab);
    if (tab === 'workbench') {
      setDesktopTab(workbenchSubpage === 'extract' ? 'pro' : workbenchSubpage);
    } else if (tab === 'tuning') {
      setDesktopTab(tuningSubpage);
    } else if (tab === 'studio') {
      setDesktopTab('studio');
    } else if (tab === 'catalog') {
      setDesktopTab('catalog');
    }
  }, [mobileMainTab, workbenchSubpage, tuningSubpage]);

  const handleSwitchWorkbenchSubpage = useCallback((sub: WorkbenchSubpage) => {
    setMobileMainTab('workbench');
    setWorkbenchSubpage(sub);
    setDesktopTab(sub === 'extract' ? 'pro' : sub);
  }, []);

  const handleSwitchTuningSubpage = useCallback((sub: TuningSubpage) => {
    setMobileMainTab('tuning');
    setTuningSubpage(sub);
    setDesktopTab(sub);
  }, []);

  const handleSwitchDesktopTab = useCallback((tab: DesktopPanelTab) => {
    setDesktopTab(tab);
    if (tab === 'pro' || tab === 'mixbox') {
      setMobileMainTab('workbench');
      setWorkbenchSubpage(tab);
    } else if (tab === 'custom' || tab === 'basic') {
      setMobileMainTab('tuning');
      setTuningSubpage(tab);
    } else if (tab === 'studio') {
      setMobileMainTab('studio');
    } else if (tab === 'catalog') {
      setMobileMainTab('catalog');
    }
  }, []);

  // Swatch card display and leader line settings
  const [swatchSettings, setSwatchSettings] = useState<SwatchSettings>(() => {
    try {
      const saved = localStorage.getItem('gkmixer_swatch_settings');
      if (saved) return { ...DEFAULT_SWATCH_SETTINGS, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_SWATCH_SETTINGS;
  });

  useEffect(() => {
    try {
      localStorage.setItem('gkmixer_swatch_settings', JSON.stringify(swatchSettings));
    } catch {}
  }, [swatchSettings]);
  
  // === Cache states for preserving component states across tab switches ===
  // MixerResult cache
  const [mixerResultCache, setMixerResultCache] = useState<MixerResultCache>({
    mixingMode: 'professional',
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
  const [isPicking, setIsPicking] = useState(false);
  const [isContinuousPicking, setIsContinuousPicking] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [loupe, setLoupe] = useState<{ x: number; y: number; hex: string } | null>(null);

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

  const handleImageLoaded = async (_file: File, img: HTMLImageElement) => {
    setSourceImage(img.src);
    // Reset zoom
    setScale(1);
    setOffset({ x: 0, y: 0 });
    
    // Show loading animation
    setIsExtracting(true);
    try {
      const extracted = await extractProminentColors(img, 3, colorSpace);
      setColors(extracted);
      if (extracted.length > 0) {
        setSelectedColorId(extracted[0].id);
      }
      setIsPicking(true);
      setIsContinuousPicking(true);
    } finally {
      setIsExtracting(false);
    }
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

  const handleAddColor = (hex: string) => {
    const rgb = hexToRgb(hex);
    if (!rgb) return;
    
    const hsb = rgbToHsb(rgb.r, rgb.g, rgb.b);
    const lab = rgbToLab(rgb.r, rgb.g, rgb.b);
    
    const newColor: ColorData = {
      id: generateId(),
      hex,
      rgb,
      cmyk: rgbToCmyk(rgb.r, rgb.g, rgb.b),
      hsb,
      lab,
      source: 'manual',
      colorSpace: colorSpace
    };
    
    setColors(prev => [newColor, ...prev]);
    setSelectedColorId(newColor.id);
  };

  const handleAddColors = (hexColors: string[]) => {
    const newColors = hexColors.map(hex => {
      const rgb = hexToRgb(hex);
      if (!rgb) return null;
      
      const hsb = rgbToHsb(rgb.r, rgb.g, rgb.b);
      const lab = rgbToLab(rgb.r, rgb.g, rgb.b);
      
      return {
        id: generateId(),
        hex,
        rgb,
        cmyk: rgbToCmyk(rgb.r, rgb.g, rgb.b),
        hsb,
        lab,
        source: 'manual' as const,
        colorSpace: colorSpace
      };
    }).filter(Boolean) as ColorData[];
    
    setColors(prev => [...newColors, ...prev]);
    if (newColors.length > 0) {
      setSelectedColorId(newColors[0].id);
    }
  };

  const commitSampledRgb = (rgbInput: RGB, sample?: { nx: number; ny: number }) => {
    let rgb = rgbInput;
    if (colorSpace === 'adobe-rgb') {
      rgb = convertToWorkingSpace(rgb, 'adobe-rgb');
    }
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
    const hsb = rgbToHsb(rgb.r, rgb.g, rgb.b);
    const lab = rgbToLab(rgb.r, rgb.g, rgb.b);
    const newColor: ColorData = {
      id: generateId(),
      hex,
      rgb,
      cmyk: rgbToCmyk(rgb.r, rgb.g, rgb.b),
      hsb,
      lab,
      source: 'manual',
      colorSpace: colorSpace,
      sampleX: sample?.nx,
      sampleY: sample?.ny,
    };
    setColors(prev => [newColor, ...prev]);
    setSelectedColorId(newColor.id);
    setDesktopTab('pro');
    if (!isContinuousPicking) {
      setIsPicking(false);
      setLoupe(null);
    }
  };

  const previewAtClient = (clientX: number, clientY: number) => {
    if (!canvasRef.current) return;
    const rgb = sampleCanvasAtClient(canvasRef.current, clientX, clientY);
    if (!rgb) {
      setLoupe(null);
      return;
    }
    setLoupe({ x: clientX, y: clientY, hex: rgbToHex(rgb.r, rgb.g, rgb.b) });
  };

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

  // Zoom Handlers
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = -e.deltaY * 0.001;
        setScale(s => Math.min(Math.max(1, s + delta), 8));
    }
  };

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

  const handleAssignCatalogPaint = (paint: CatalogPaint) => {
    let targetId: string | null = null;
    setColors((prev) => {
      const selected = prev.find((color) => color.id === selectedColorId);
      const target =
        selected && hasSamplePoint(selected)
          ? selected
          : prev.find(hasSamplePoint) ?? selected;
      if (!target) return prev;
      targetId = target.id;
      const place =
        hasSamplePoint(target) && target.labelNx == null && target.labelNy == null
          ? defaultCardPos(target.sampleX!, target.sampleY!)
          : {};
      return prev.map((color) =>
        color.id === target.id ? { ...color, assignedPaint: paint, ...place } : color
      );
    });
    if (targetId) {
      setSelectedColorId(targetId);
      if (desktopTab !== "studio" && mobileMainTab !== "studio") {
        setDesktopTab("pro");
      }
    }
  };

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
    const newPositions = autoArrangeLeftRight(extractMarkers, w, h, swatchSettings.cardScale);
    handleBatchMoveLabels(newPositions);
  }, [canvasBox.width, canvasBox.height, extractMarkers, swatchSettings.cardScale, handleBatchMoveLabels]);

  const handleAutoArrangeTB = useCallback(() => {
    const w = canvasBox.width || 800;
    const h = canvasBox.height || 600;
    const newPositions = autoArrangeTopBottom(extractMarkers, w, h, swatchSettings.cardScale);
    handleBatchMoveLabels(newPositions);
  }, [canvasBox.width, canvasBox.height, extractMarkers, swatchSettings.cardScale, handleBatchMoveLabels]);

  const handleAlign = useCallback((alignment: 'left' | 'right' | 'top' | 'bottom' | 'autoH' | 'autoV') => {
    const w = canvasBox.width || 800;
    const h = canvasBox.height || 600;
    const newPositions = alignMarkers(extractMarkers, alignment, w, h, swatchSettings.cardScale, selectedColorId ?? undefined);
    handleBatchMoveLabels(newPositions);
  }, [canvasBox.width, canvasBox.height, extractMarkers, swatchSettings.cardScale, selectedColorId, handleBatchMoveLabels]);

  const handleResetPositions = useCallback(() => {
    const w = canvasBox.width || 800;
    const h = canvasBox.height || 600;
    const newPositions = resetMarkerPositions(extractMarkers, w, h, swatchSettings.cardScale, selectedColorId ?? undefined);
    handleBatchMoveLabels(newPositions);
  }, [canvasBox.width, canvasBox.height, extractMarkers, swatchSettings.cardScale, selectedColorId, handleBatchMoveLabels]);

  const handleExportAnnotated = async () => {
    const canvas = canvasRef.current;
    const assigned = extractMarkers.filter((marker) => marker.paint);
    if (!canvas || !assigned.length) return;
    setIsExporting(true);
    try {
      await exportAnnotatedImage(canvas, extractMarkers, swatchSettings);
    } finally {
      setIsExporting(false);
    }
  };

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

  // Touch Handlers for Mobile - Optimized with 2-finger Pan & Zoom and 1-finger Color Pick
  const handleTouchStart = useCallback((e: TouchEvent) => {
    // 2 Fingers: Pinch-Zoom + Two-Finger Pan
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
      setLoupe(null);
      return;
    }

    // 1 Finger:
    if (e.touches.length === 1) {
      twoFingerRef.current = null;
      const touch = e.touches[0];

      // If in color picking mode and touched on the image canvas
      if (isPicking && canvasRef.current) {
        const rgb = sampleCanvasAtClient(canvasRef.current, touch.clientX, touch.clientY);
        if (rgb) {
          if (e.cancelable) e.preventDefault();
          touchPickRef.current = {
            startX: touch.clientX,
            startY: touch.clientY,
            lastX: touch.clientX,
            lastY: touch.clientY,
            startTime: Date.now(),
          };
          previewAtClient(touch.clientX, touch.clientY);
        } else {
          touchPickRef.current = null;
          setLoupe(null);
        }
        return;
      }

      // Pan when zoomed in (and not picking)
      if (!isPicking && currentScale.current > 1) {
        if (e.cancelable) e.preventDefault();
        startPos.current = {
          x: touch.clientX - currentOffset.current.x,
          y: touch.clientY - currentOffset.current.y,
        };
        isSingleDragging.current = true;
        setIsDragging(true);
      }
    }
  }, [isPicking]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    // 2 Fingers: Combined Pinch-to-Zoom + Two-Finger Drag/Pan
    if (e.touches.length === 2 && twoFingerRef.current) {
      if (e.cancelable) e.preventDefault();

      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const dist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
      const center = {
        x: (t0.clientX + t1.clientX) / 2,
        y: (t0.clientY + t1.clientY) / 2,
      };

      const { initialDist, initialScale, initialCenter, initialOffset } = twoFingerRef.current;
      const ratio = dist / initialDist;
      const newScale = Math.min(Math.max(1, initialScale * ratio), 8);

      const containerRect = containerRef.current?.getBoundingClientRect();
      const rectLeft = containerRect?.left ?? 0;
      const rectTop = containerRect?.top ?? 0;

      // Focal points relative to viewport top-left
      const p0x = initialCenter.x - rectLeft;
      const p0y = initialCenter.y - rectTop;
      const px = center.x - rectLeft;
      const py = center.y - rectTop;

      const scaleFactor = newScale / initialScale;

      // Formula: keep the point under initial focal point anchored under current center
      let nextOffsetX = px - scaleFactor * (p0x - initialOffset.x);
      let nextOffsetY = py - scaleFactor * (p0y - initialOffset.y);

      if (newScale <= 1.01) {
        nextOffsetX = 0;
        nextOffsetY = 0;
      }

      currentScale.current = newScale;
      currentOffset.current = { x: nextOffsetX, y: nextOffsetY };

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        applyTransform(nextOffsetX, nextOffsetY, newScale);
      });
      return;
    }

    // 1 Finger Drag (when zoomed in)
    if (e.touches.length === 1 && isSingleDragging.current) {
      if (e.cancelable) e.preventDefault();
      const touch = e.touches[0];
      const nextX = touch.clientX - startPos.current.x;
      const nextY = touch.clientY - startPos.current.y;
      currentOffset.current = { x: nextX, y: nextY };

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        applyTransform(nextX, nextY, currentScale.current);
      });
      return;
    }

    // 1 Finger Color Picker preview (ONLY when a valid picking touch is active on canvas)
    if (e.touches.length === 1 && isPicking && touchPickRef.current && canvasRef.current) {
      if (e.cancelable) e.preventDefault();
      const touch = e.touches[0];
      touchPickRef.current.lastX = touch.clientX;
      touchPickRef.current.lastY = touch.clientY;
      previewAtClient(touch.clientX, touch.clientY);
      return;
    }
  }, [applyTransform, isPicking]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    // If one finger remains on screen after 2-finger gesture:
    if (e.touches.length === 1) {
      twoFingerRef.current = null;
      const remainingTouch = e.touches[0];
      if (!isPicking && currentScale.current > 1) {
        startPos.current = {
          x: remainingTouch.clientX - currentOffset.current.x,
          y: remainingTouch.clientY - currentOffset.current.y,
        };
        isSingleDragging.current = true;
      }
      return;
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
          setLoupe(null);
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
  }, [isPicking, commitSampledRgb]);

  // Attach non-passive native touch event listeners to container and window
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => handleTouchStart(e);
    const onTouchMove = (e: TouchEvent) => handleTouchMove(e);
    const onTouchEnd = (e: TouchEvent) => handleTouchEnd(e);

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: false });
    window.addEventListener('touchcancel', onTouchEnd, { passive: false });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

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
      setLoupe(null);
    };

    document.addEventListener('pointerdown', handlePointerDownOutside, { passive: true });
    return () => {
      document.removeEventListener('pointerdown', handlePointerDownOutside);
    };
  }, [isPicking]);

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
      className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300 flex flex-col overflow-x-hidden font-mono"
    >
      {/* Header with seamless translucent iOS blur on scroll */}
      <header className={`sticky top-0 z-40 pt-[env(safe-area-inset-top,0px)] transition-all duration-300 ${
        isScrolled
          ? 'bg-white/75 dark:bg-slate-950/75 backdrop-blur-xl shadow-xs'
          : 'bg-white/50 dark:bg-slate-950/50 backdrop-blur-md'
      }`}>
        <div className="max-w-[1920px] mx-auto px-4 md:px-6 h-14 flex justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-macaron-pink"></div>
            <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-macaron-blue"></div>
            <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-macaron-green"></div>
            <h1 className="ml-1 sm:ml-2 font-bold text-slate-800 dark:text-slate-100 tracking-tight text-base sm:text-lg">
              <span className="lg:hidden">Gk-mixer</span>
              <span className="hidden lg:inline">{t.title}</span>
            </h1>
          </div>
          
          {/* Desktop Controls (hidden on mobile) */}
          <div className="hidden lg:flex gap-4 items-center">
             {/* Color Space Selector */}
             <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 gap-1">
                <button 
                  onClick={() => setColorSpace('srgb')} 
                  className={`px-2 py-1 text-xs rounded transition-all active:scale-[0.97] ${colorSpace === 'srgb' ? 'bg-white dark:bg-slate-600 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-700'}`}
                  title={t.colorSpaceSrgb}
                >
                  sRGB
                </button>
                <button 
                  onClick={() => setColorSpace('display-p3')} 
                  className={`px-2 py-1 text-xs rounded transition-all active:scale-[0.97] ${colorSpace === 'display-p3' ? 'bg-white dark:bg-slate-600 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-700'}`}
                  title={t.colorSpaceP3}
                >
                  P3
                </button>
                <button 
                  onClick={() => setColorSpace('adobe-rgb')} 
                  className={`px-2 py-1 text-xs rounded transition-all active:scale-[0.97] ${colorSpace === 'adobe-rgb' ? 'bg-white dark:bg-slate-600 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-700'}`}
                  title={t.colorSpaceAdobe}
                >
                  Adobe
                </button>
             </div>

             {/* Language Selector */}
             <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 gap-1">
                <button onClick={() => setLang('en')} className={`px-2 py-1 text-xs rounded transition-all active:scale-[0.97] ${lang === 'en' ? 'bg-white dark:bg-slate-600 shadow-sm font-bold' : 'text-slate-500'}`}>EN</button>
                <button onClick={() => setLang('zh')} className={`px-2 py-1 text-xs rounded transition-all active:scale-[0.97] ${lang === 'zh' ? 'bg-white dark:bg-slate-600 shadow-sm font-bold' : 'text-slate-500'}`}>中文</button>
                <button onClick={() => setLang('ja')} className={`px-2 py-1 text-xs rounded transition-all active:scale-[0.97] ${lang === 'ja' ? 'bg-white dark:bg-slate-600 shadow-sm font-bold' : 'text-slate-500'}`}>日文</button>
             </div>

             <button 
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-yellow-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-[0.95]"
                title="Toggle Theme"
             >
                {theme === 'light' ? <MoonIcon className="w-4 h-4" /> : <SunIcon className="w-4 h-4" />}
             </button>

             <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-[0.95]"
                title={lang === 'zh' ? '设置与关于' : 'Settings & About'}
                aria-label="Settings & About"
             >
                <GearIcon className="w-4 h-4" />
             </button>
          </div>

          {/* Mobile Hamburger Settings Button */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="lg:hidden p-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all"
            aria-label="Settings"
            title="Settings"
          >
            <ListIcon className="w-6 h-6" />
          </button>
        </div>
      </header>

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
      <main className="flex-1 max-w-[1920px] mx-auto w-full p-2.5 sm:p-4 md:p-6 pb-28 lg:pb-6 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 xl:gap-8 overflow-x-hidden">
        
        {/* Left Column: Image & Palette */}
        {(!isWideVisualizer || desktopTab !== 'studio') && (
          <div className={`flex flex-col gap-6 lg:col-span-5 xl:col-span-4 ${mobileMainTab === 'workbench' && workbenchSubpage === 'extract' ? 'block' : 'hidden lg:block'}`}>
            <div className="bg-white dark:bg-slate-900 p-2.5 sm:p-4 md:p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm transition-colors duration-300">
              {/* Mobile Top Segmented Control for Workbench (拾色 | 专业分解 | Mixbox分解) */}
              <div className="lg:hidden mb-4">
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-xs">
                  <button
                    type="button"
                    onClick={() => handleSwitchWorkbenchSubpage('extract')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all duration-150 flex items-center justify-center gap-1 ${
                      workbenchSubpage === 'extract'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                    }`}
                  >
                    <CrosshairIcon className="w-3.5 h-3.5" />
                    <span>{lang === 'zh' ? '拾色' : lang === 'ja' ? '抽出' : 'Extract'}</span>
                    {colors.length > 0 && (
                      <span className="ml-0.5 px-1 min-w-[14px] h-3.5 bg-sky-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center leading-none">
                        {colors.length}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchWorkbenchSubpage('pro')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all duration-150 flex items-center justify-center gap-1 ${
                      workbenchSubpage === 'pro'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                    }`}
                  >
                    <SparkleIcon className="w-3.5 h-3.5" />
                    <span>{lang === 'zh' ? '专业分解' : lang === 'ja' ? 'プロ' : 'Pro'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchWorkbenchSubpage('mixbox')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all duration-150 flex items-center justify-center gap-1 ${
                      workbenchSubpage === 'mixbox'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                    }`}
                  >
                    <PaletteIcon className="w-3.5 h-3.5" />
                    <span>{lang === 'zh' ? 'Mixbox分解' : lang === 'ja' ? 'Mixbox' : 'Mixbox'}</span>
                  </button>
                </div>
              </div>

              <h2 className="text-xs font-bold text-slate-400 mb-4 tracking-widest">{t.sourceInput}</h2>
            
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
                            <button onClick={handleZoomIn} className="px-2 py-1 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-200 text-xs rounded border border-slate-200 dark:border-slate-600 hover:border-macaron-blue">{t.zoomIn}</button>
                            <button onClick={handleZoomOut} className="px-2 py-1 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-200 text-xs rounded border border-slate-200 dark:border-slate-600 hover:border-macaron-blue">{t.zoomOut}</button>
                            <button onClick={handleReset} className="px-2 py-1 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-200 text-xs rounded border border-slate-200 dark:border-slate-600 hover:border-macaron-blue">{t.reset}</button>
                            <button
                                onClick={() => changeImageInputRef.current?.click()}
                                className="px-2 py-1 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-200 text-xs rounded border border-slate-200 dark:border-slate-600 hover:border-macaron-blue"
                            >
                                {t.changeImage}
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
                        className="relative h-[28rem] w-full overflow-hidden rounded-xl border-2 border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 cursor-move touch-none select-none overscroll-none"
                        style={{ touchAction: 'none' }}
                        onWheel={handleWheel}
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
                              setLoupe(null);
                            }
                          }
                        }}
                        onMouseLeave={() => {
                          handleMouseUp();
                          setLoupe(null);
                        }}
                    >
                            {/* Hidden source image for reference */}
                        <img ref={imageRef} src={sourceImage} className="hidden" alt="source ref" onLoad={() => {
                            // Trigger re-render to draw canvas
                            const canvas = canvasRef.current;
                            const ctx = canvas?.getContext('2d');
                            const img = imageRef.current;
                            if(canvas && ctx && img) {
                                canvas.width = img.naturalWidth;
                                canvas.height = img.naturalHeight;
                                ctx.drawImage(img, 0, 0);
                                requestAnimationFrame(syncCanvasBox);
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
                                onMouseLeave={() => setLoupe(null)}
                                className={`block max-h-full max-w-full shadow-lg ${isPicking ? 'cursor-crosshair ring-2 ring-macaron-green' : ''}`}
                                style={{
                                    maxWidth: '100%',
                                    maxHeight: '100%',
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
                                    onMoveLabel={handleMoveLabel}
                                />
                              </div>
                            )}
                            </div>
                        </div>

                        {isPicking && (
                            <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsPicking(false);
                                  setIsContinuousPicking(false);
                                  setLoupe(null);
                                }}
                                className="absolute top-4 left-4 z-20 flex items-center gap-1.5 rounded-full bg-emerald-600/90 hover:bg-emerald-600 text-white text-xs px-3 py-1 font-medium shadow-md backdrop-blur-sm transition-all active:scale-95 cursor-pointer"
                                title={lang === 'zh' ? '点击退出取色模式' : lang === 'ja' ? 'クリックして終了' : 'Click to exit pick mode'}
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                <span>{t.clickToPick}</span>
                                <span className="ml-1 text-[11px] opacity-75 hover:opacity-100 font-bold">✕</span>
                            </button>
                        )}
                        <div className="absolute top-3 right-3 z-20 flex gap-2">
                          <button
                            type="button"
                            onClick={handleExportAnnotated}
                            disabled={!extractMarkers.some((marker) => marker.paint) || isExporting}
                            className="flex items-center gap-1.5 rounded-lg bg-slate-900/80 px-3 py-1.5 text-[10px] font-bold text-white shadow-lg backdrop-blur-sm hover:bg-slate-900 disabled:opacity-40"
                          >
                            <DownloadSimpleIcon className="h-3.5 w-3.5" />
                            {isExporting ? t.exporting : t.exportAnnotated}
                          </button>
                        </div>
                    </div>
                </div>
            )}

            {assignedMarkers.length > 0 && desktopTab !== 'studio' && (
                <SwatchStudioControls
                  settings={swatchSettings}
                  onChangeSettings={setSwatchSettings}
                  onAutoArrangeLR={handleAutoArrangeLR}
                  onAutoArrangeTB={handleAutoArrangeTB}
                  onAlign={handleAlign}
                  onResetPositions={handleResetPositions}
                  lang={lang}
                  assignedCount={assignedMarkers.length}
                  className="mt-3"
                />
            )}

            {assignedMarkers.length > 0 && (
                <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                    <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                            {lang === "zh" ? "油漆标注" : lang === "ja" ? "塗料割り当て" : "Paint Assignments"}
                            <span className="ml-1 font-normal text-slate-400">
                                · {assignedMarkers.length} {lang === "zh" ? "个色卡" : "markers"}
                            </span>
                        </span>
                        <div className="flex gap-3 text-[11px] font-bold">
                            <button type="button" onClick={handleCopyAssignments} className="text-sky-600 hover:underline">
                                {lang === "zh" ? "复制" : "Copy"}
                            </button>
                            <button type="button" onClick={handleClearAssignments} className="text-red-500 hover:underline">
                                {lang === "zh" ? "全部清除" : "Clear all"}
                            </button>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        {assignedMarkers.map((marker) => {
                            const paint = marker.paint!;
                            return (
                                <div
                                    key={marker.id}
                                    className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${
                                        marker.id === selectedColorId
                                            ? "border-sky-300 bg-sky-50 dark:border-sky-700 dark:bg-sky-950/40"
                                            : "border-slate-100 dark:border-slate-800"
                                    }`}
                                >
                                    <button
                                        type="button"
                                        className="h-7 w-7 flex-shrink-0 rounded-md border border-slate-200"
                                        style={{ backgroundColor: paint.hex }}
                                        onClick={() => setSelectedColorId(marker.id)}
                                    />
                                    <button
                                        type="button"
                                        className="min-w-0 flex-1 text-left"
                                        onClick={() => {
                                            setSelectedColorId(marker.id);
                                            handleSwitchWorkbenchSubpage('pro');
                                        }}
                                    >
                                        <div className="truncate text-[11px] font-bold text-slate-700 dark:text-slate-200">
                                            {paint.brand} {paint.code} {paint.name}
                                        </div>
                                        <div className="font-mono text-[10px] text-slate-400">{paint.hex}</div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedColorId(marker.id);
                                            handleSwitchWorkbenchSubpage('pro');
                                        }}
                                        className="flex-shrink-0 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700"
                                    >
                                        {lang === "zh" ? "混色" : "Mix"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleUnassignPaint(marker.id)}
                                        className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-slate-800 text-[10px] text-white"
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
            
            {/* Show color palette if colors exist OR if image is loaded (to allow manual picking) */}
            {(colors.length > 0 || sourceImage) && (
                <div className="mt-4 sm:mt-6">
                    {colors.length > 0 && (
                        <div className="flex justify-between items-center mb-2 sm:mb-3">
                            <span className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400">
                                {t.extractedColors || (lang === 'zh' ? '已提取颜色' : lang === 'ja' ? '抽出された色' : 'Extracted Colors')}
                            </span>
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
                    )}
                    <ColorPalette 
                        colors={colors} 
                        onColorSelect={(c) => setSelectedColorId(c.id)}
                        selectedColorId={selectedColorId || undefined}
                        onAddManual={handleManualAdd}
                        onContinuousPick={handleContinuousPick}
                        onDeleteColor={handleDeleteColor}
                        onAddColorByHex={handleAddColor}
                        hasImage={!!sourceImage}
                        isPicking={isPicking}
                        isContinuousPicking={isContinuousPicking}
                        lang={lang}
                    />
                </div>
            )}
          </div>
        </div>
        )}

        {/* Right Column: Tools & Output */}
        <div className={`${isWideVisualizer && desktopTab === 'studio' ? "col-span-12" : "lg:col-span-7 xl:col-span-8"} ${!(mobileMainTab === 'workbench' && workbenchSubpage === 'extract') ? 'block' : 'hidden lg:block'} w-full max-w-full overflow-x-hidden`}>
           <div className="bg-white dark:bg-slate-900 p-2.5 sm:p-4 md:p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm h-full transition-colors duration-300 flex flex-col w-full max-w-full overflow-x-hidden">
                
                {/* Mobile Top Segmented Control for Workbench (when on mobile in workbench: pro or mixbox) */}
                {mobileMainTab === 'workbench' && (
                  <div className="lg:hidden mb-4">
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-xs">
                      <button
                        type="button"
                        onClick={() => handleSwitchWorkbenchSubpage('extract')}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all duration-150 flex items-center justify-center gap-1 ${
                          workbenchSubpage === 'extract'
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                        }`}
                      >
                        <CrosshairIcon className="w-3.5 h-3.5" />
                        <span>{lang === 'zh' ? '拾色' : lang === 'ja' ? '抽出' : 'Extract'}</span>
                        {colors.length > 0 && (
                          <span className="ml-0.5 px-1 min-w-[14px] h-3.5 bg-sky-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center leading-none">
                            {colors.length}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSwitchWorkbenchSubpage('pro')}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all duration-150 flex items-center justify-center gap-1 ${
                          workbenchSubpage === 'pro'
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                        }`}
                      >
                        <SparkleIcon className="w-3.5 h-3.5" />
                        <span>{lang === 'zh' ? '专业分解' : lang === 'ja' ? 'プロ' : 'Pro'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSwitchWorkbenchSubpage('mixbox')}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all duration-150 flex items-center justify-center gap-1 ${
                          workbenchSubpage === 'mixbox'
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                        }`}
                      >
                        <PaletteIcon className="w-3.5 h-3.5" />
                        <span>{lang === 'zh' ? 'Mixbox分解' : lang === 'ja' ? 'Mixbox' : 'Mixbox'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Mobile Top Segmented Control for Tuning (自选 | 基础) */}
                {mobileMainTab === 'tuning' && (
                  <div className="lg:hidden mb-4">
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-xs">
                      <button
                        type="button"
                        onClick={() => handleSwitchTuningSubpage('custom')}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all duration-150 flex items-center justify-center gap-1 ${
                          tuningSubpage === 'custom'
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                        }`}
                      >
                        <SlidersHorizontalIcon className="w-3.5 h-3.5" />
                        <span>{lang === 'zh' ? '自选' : lang === 'ja' ? '自選' : 'Custom'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSwitchTuningSubpage('basic')}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all duration-150 flex items-center justify-center gap-1 ${
                          tuningSubpage === 'basic'
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                        }`}
                      >
                        <DropIcon className="w-3.5 h-3.5" />
                        <span>{lang === 'zh' ? '基础' : lang === 'ja' ? '基本' : 'Basic'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Mobile Quick Color Switcher (switch active color directly inside tools without leaving view) */}
                {colors.length > 0 && (
                  <div className="lg:hidden mt-1 mb-5 pt-1.5 pb-3 border-b border-slate-200/80 dark:border-slate-700/80 flex items-center gap-2.5 overflow-x-auto no-scrollbar">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex-shrink-0 pl-0.5">
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
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all flex-shrink-0 ${
                              isSel
                                ? 'bg-sky-50 dark:bg-sky-950/80 border-2 border-sky-500 text-sky-800 dark:text-sky-200 font-bold shadow-xs'
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

                {/* Desktop Tabs Bar */}
                <div className="hidden lg:flex justify-between items-center mb-6">
                    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1 flex-wrap">
                        {/* 混色台组 */}
                        <button 
                            onClick={() => handleSwitchDesktopTab('pro')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${desktopTab === 'pro' ? 'bg-white dark:bg-slate-600 shadow text-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <SparkleIcon className="w-3.5 h-3.5" />
                            <span>{lang === 'zh' ? '专业分解' : 'Pro Mixer'}</span>
                        </button>
                        <button 
                            onClick={() => handleSwitchDesktopTab('mixbox')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${desktopTab === 'mixbox' ? 'bg-white dark:bg-slate-600 shadow text-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <PaletteIcon className="w-3.5 h-3.5" />
                            <span>{lang === 'zh' ? 'Mixbox分解' : 'Mixbox 2.0'}</span>
                        </button>
                        
                        <div className="w-[1px] h-5 bg-slate-200 dark:bg-slate-700 my-auto mx-0.5" />

                        {/* 调色台组 */}
                        <button 
                            onClick={() => handleSwitchDesktopTab('custom')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${desktopTab === 'custom' ? 'bg-white dark:bg-slate-600 shadow text-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <SlidersHorizontalIcon className="w-3.5 h-3.5" />
                            <span>{lang === 'zh' ? '自选调色' : 'Custom'}</span>
                        </button>
                        <button 
                            onClick={() => handleSwitchDesktopTab('basic')}
                            className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${desktopTab === 'basic' ? 'bg-white dark:bg-slate-600 shadow text-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <DropIcon className="w-3.5 h-3.5" />
                            <span>{lang === 'zh' ? '基础色' : 'Basic'}</span>
                        </button>

                        <div className="w-[1px] h-5 bg-slate-200 dark:bg-slate-700 my-auto mx-0.5" />

                        {/* 色卡与数据库 */}
                        <button 
                            onClick={() => handleSwitchDesktopTab('studio')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${desktopTab === 'studio' ? 'bg-white dark:bg-slate-600 shadow text-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <SwatchesIcon className="w-3.5 h-3.5" />
                            <span>{lang === 'zh' ? '色卡制作' : 'Swatch Studio'}</span>
                        </button>
                        <button 
                            onClick={() => handleSwitchDesktopTab('catalog')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${desktopTab === 'catalog' ? 'bg-white dark:bg-slate-600 shadow text-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <DatabaseIcon className="w-3.5 h-3.5" />
                            <span>{lang === 'zh' ? '数据库' : 'Catalog'}</span>
                        </button>
                    </div>
                </div>

                {/* Active Content Panel */}
                {desktopTab === 'pro' ? (
                    <MixerResult 
                        color={selectedColor} 
                        lang={lang} 
                        colorSpace={colorSpace} 
                        onAddColor={handleAddColor}
                        cache={mixerResultCache}
                        onCacheUpdate={setMixerResultCache}
                        onAssignCatalogPaint={handleAssignCatalogPaint}
                        onNavigateToExtract={() => handleSwitchWorkbenchSubpage('extract')}
                        forcedMode="professional"
                    />
                ) : desktopTab === 'mixbox' ? (
                    <MixerResult 
                        color={selectedColor} 
                        lang={lang} 
                        colorSpace={colorSpace} 
                        onAddColor={handleAddColor}
                        cache={mixerResultCache}
                        onCacheUpdate={setMixerResultCache}
                        onAssignCatalogPaint={handleAssignCatalogPaint}
                        onNavigateToExtract={() => handleSwitchWorkbenchSubpage('extract')}
                        forcedMode="mixbox"
                    />
                ) : desktopTab === 'custom' ? (
                    <RadialPaletteMixer
                        targetColor={selectedColor}
                        availableColors={colors}
                        lang={lang}
                        onAddColors={handleAddColors}
                        cache={radialMixerCache}
                        onCacheUpdate={setRadialMixerCache}
                        onAssignCatalogPaint={handleAssignCatalogPaint}
                    />
                ) : desktopTab === 'basic' ? (
                    <BasicColorMixer 
                        lang={lang}
                        cache={basicMixerCache}
                        onCacheUpdate={setBasicMixerCache}
                    />
                ) : desktopTab === 'catalog' ? (
                    <PaintCatalogBrowser
                        lang={lang}
                        onPickHex={handleAddColor}
                    />
                ) : (
                    <PaletteVisualizer 
                        sourceImage={sourceImage}
                        colors={colors}
                        lang={lang}
                        selectedColorId={selectedColorId}
                        swatchSettings={swatchSettings}
                        onChangeSwatchSettings={setSwatchSettings}
                        onAutoArrangeLR={handleAutoArrangeLR}
                        onAutoArrangeTB={handleAutoArrangeTB}
                        onAlign={handleAlign}
                        onResetPositions={handleResetPositions}
                        onSelectColor={setSelectedColorId}
                        onAssignCatalogPaint={handleAssignCatalogPaint}
                        onUnassignPaint={handleUnassignPaint}
                        onMoveLabel={handleMoveLabel}
                        isWideMode={isWideVisualizer}
                        onToggleWideMode={() => setIsWideVisualizer((prev) => !prev)}
                        onNavigateToExtract={() => handleSwitchWorkbenchSubpage('extract')}
                    />
                )}
           </div>
        </div>

      </main>

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

      {/* 底部悬浮快捷 Dock (Mobile Floating Dock) */}
      <nav
        aria-label="Mobile Navigation Dock"
        className="lg:hidden fixed left-3 right-3 max-w-md mx-auto z-40 bg-white/94 dark:bg-[#1c1c1e]/94 backdrop-blur-2xl rounded-full border border-sky-500/15 dark:border-sky-400/20 shadow-[0_12px_36px_rgba(0,0,0,0.14),0_1px_3px_rgba(0,0,0,0.06)] select-none px-1.5 py-1"
        style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom, 0.75rem))' }}
      >
        <div className="grid grid-cols-4 w-full items-center gap-1">
          {/* 1. 混色台 (Workbench: 拾色 | 专业分解 | Mixbox分解) */}
          <button
            type="button"
            onClick={() => handleSwitchMobileTab('workbench')}
            className={`min-w-0 relative flex flex-col items-center justify-center py-1.5 px-1 rounded-full transition-all duration-200 active:scale-95 whitespace-nowrap ${
              mobileMainTab === 'workbench'
                ? 'bg-sky-500/15 dark:bg-sky-400/20 text-sky-600 dark:text-sky-300 font-bold shadow-xs ring-1 ring-sky-500/25 dark:ring-sky-400/30'
                : 'text-slate-700 dark:text-slate-300 font-medium hover:text-sky-600 dark:hover:text-sky-400'
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
                <span className="absolute -top-1 -right-2 px-1 min-w-[14px] h-3.5 bg-sky-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center leading-none shadow-sm">
                  {colors.length}
                </span>
              ) : null}
            </div>
            <span className="text-[11px] tracking-tight whitespace-nowrap text-center leading-none">
              {t.dockWorkbench || (lang === 'zh' ? '混色台' : lang === 'ja' ? '混色台' : 'Workbench')}
            </span>
          </button>

          {/* 2. 调色 (Tuning: 自选 | 基础 | 近邻) */}
          <button
            type="button"
            onClick={() => handleSwitchMobileTab('tuning')}
            className={`min-w-0 relative flex flex-col items-center justify-center py-1.5 px-1 rounded-full transition-all duration-200 active:scale-95 whitespace-nowrap ${
              mobileMainTab === 'tuning'
                ? 'bg-sky-500/15 dark:bg-sky-400/20 text-sky-600 dark:text-sky-300 font-bold shadow-xs ring-1 ring-sky-500/25 dark:ring-sky-400/30'
                : 'text-slate-700 dark:text-slate-300 font-medium hover:text-sky-600 dark:hover:text-sky-400'
            }`}
          >
            <div className="relative flex items-center justify-center mb-0.5">
              <SlidersHorizontalIcon className="w-5 h-5 flex-shrink-0" />
            </div>
            <span className="text-[11px] tracking-tight whitespace-nowrap text-center leading-none">
              {t.dockTuning || (lang === 'zh' ? '调色' : lang === 'ja' ? '調色' : 'Tuning')}
            </span>
          </button>

          {/* 3. 色卡制作 (Swatch Studio / Visualizer: 特色独立Tab) */}
          <button
            type="button"
            onClick={() => handleSwitchMobileTab('studio')}
            className={`min-w-0 relative flex flex-col items-center justify-center py-1.5 px-1 rounded-full transition-all duration-200 active:scale-95 whitespace-nowrap ${
              mobileMainTab === 'studio'
                ? 'bg-sky-500/15 dark:bg-sky-400/20 text-sky-600 dark:text-sky-300 font-bold shadow-xs ring-1 ring-sky-500/25 dark:ring-sky-400/30'
                : 'text-slate-700 dark:text-slate-300 font-medium hover:text-sky-600 dark:hover:text-sky-400'
            }`}
          >
            <div className="relative flex items-center justify-center mb-0.5">
              <SwatchesIcon className="w-5 h-5 flex-shrink-0" />
              {assignedMarkers.length > 0 && (
                <span className="absolute -top-1 -right-2 px-1 min-w-[14px] h-3.5 bg-emerald-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center leading-none shadow-sm">
                  {assignedMarkers.length}
                </span>
              )}
            </div>
            <span className="text-[11px] tracking-tight whitespace-nowrap text-center leading-none">
              {t.dockStudio || (lang === 'zh' ? '色卡制作' : lang === 'ja' ? '色見本' : 'Swatches')}
            </span>
          </button>

          {/* 4. 数据库 (Catalog) */}
          <button
            type="button"
            onClick={() => handleSwitchMobileTab('catalog')}
            className={`min-w-0 relative flex flex-col items-center justify-center py-1.5 px-1 rounded-full transition-all duration-200 active:scale-95 whitespace-nowrap ${
              mobileMainTab === 'catalog'
                ? 'bg-sky-500/15 dark:bg-sky-400/20 text-sky-600 dark:text-sky-300 font-bold shadow-xs ring-1 ring-sky-500/25 dark:ring-sky-400/30'
                : 'text-slate-700 dark:text-slate-300 font-medium hover:text-sky-600 dark:hover:text-sky-400'
            }`}
          >
            <div className="relative flex items-center justify-center mb-0.5">
              <DatabaseIcon className="w-5 h-5 flex-shrink-0" />
            </div>
            <span className="text-[11px] tracking-tight whitespace-nowrap text-center leading-none">
              {t.dockCatalog || (lang === 'zh' ? '数据库' : lang === 'ja' ? '色庫' : 'Catalog')}
            </span>
          </button>
        </div>
      </nav>

      <ColorLoupe
        visible={!!loupe && isPicking}
        clientX={loupe?.x ?? 0}
        clientY={loupe?.y ?? 0}
        hex={loupe?.hex ?? '#000000'}
        canvas={canvasRef.current}
      />
    </KonstaApp>
  );
};

export default App;