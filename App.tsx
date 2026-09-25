import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  const [rightPanelTab, setRightPanelTab] = useState<'mixer' | 'visualizer' | 'radial' | 'basic' | 'catalog'>('mixer');
  type MobileDockTab = 'extract' | 'mixer' | 'radial' | 'basic' | 'visualizer' | 'catalog';
  const [mobileTab, setMobileTab] = useState<MobileDockTab>('extract');

  const handleSwitchTab = useCallback((tab: MobileDockTab) => {
    setMobileTab(tab);
    if (tab !== 'extract') {
      setRightPanelTab(tab);
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
  const pinchStart = useRef<{ distance: number; scale: number } | null>(null);

  // Zoom State
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const startPos = useRef({ x: 0, y: 0 });
  const currentOffset = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const changeImageInputRef = useRef<HTMLInputElement>(null);
  const [canvasBox, setCanvasBox] = useState({ left: 0, top: 0, width: 0, height: 0 });
  const [isExporting, setIsExporting] = useState(false);
  const [isWideVisualizer, setIsWideVisualizer] = useState(false);

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
    setRightPanelTab('mixer');
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
      setRightPanelTab("mixer");
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

  const handleZoomIn = () => setScale(s => Math.min(s + 0.5, 8));
  const handleZoomOut = () => setScale(s => Math.max(1, s - 0.5));
  const handleReset = () => { setScale(1); setOffset({x:0, y:0}); };

  // Pan Handlers - Optimized for high-res images
  const updateTransform = useCallback(() => {
    if (transformRef.current) {
      transformRef.current.style.transform = `translate(${currentOffset.current.x}px, ${currentOffset.current.y}px) scale(${scale})`;
    }
  }, [scale]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isPicking && scale > 1) {
      setIsDragging(true);
      currentOffset.current = { x: offset.x, y: offset.y };
      startPos.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
    }
  }, [isPicking, scale, offset]);
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      // Cancel any pending RAF to avoid stacking
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      // Use RAF for smooth 60fps updates
      rafRef.current = requestAnimationFrame(() => {
        currentOffset.current = {
          x: e.clientX - startPos.current.x,
          y: e.clientY - startPos.current.y
        };
        updateTransform();
      });
    }
  }, [isDragging, updateTransform]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      // Sync final position to React state
      setOffset({ ...currentOffset.current });
    }
    setIsDragging(false);
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, [isDragging]);

  // Touch Handlers for Mobile - Optimized
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]];
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      pinchStart.current = { distance, scale };
      setIsDragging(false);
      return;
    }
    if (!isPicking && scale > 1 && e.touches.length === 1) {
      setIsDragging(true);
      const touch = e.touches[0];
      currentOffset.current = { x: offset.x, y: offset.y };
      startPos.current = { x: touch.clientX - offset.x, y: touch.clientY - offset.y };
    }
  }, [isPicking, scale, offset]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStart.current) {
      const [a, b] = [e.touches[0], e.touches[1]];
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const next = pinchStart.current.scale * (distance / pinchStart.current.distance);
      setScale(Math.min(Math.max(1, next), 8));
      return;
    }
    if (isDragging && e.touches.length === 1) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(() => {
        const touch = e.touches[0];
        currentOffset.current = {
          x: touch.clientX - startPos.current.x,
          y: touch.clientY - startPos.current.y
        };
        updateTransform();
      });
    } else if (isPicking && e.touches.length === 1 && canvasRef.current) {
      const touch = e.touches[0];
      previewAtClient(touch.clientX, touch.clientY);
    }
  }, [isDragging, updateTransform, isPicking, scale]);

  const handleTouchEnd = useCallback(() => {
    pinchStart.current = null;
    if (isDragging) {
      setOffset({ ...currentOffset.current });
    }
    setIsDragging(false);
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, [isDragging]);

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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300 flex flex-col overflow-x-hidden">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-macaron-gray dark:border-slate-700 sticky top-0 z-50 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-4 flex flex-wrap justify-between items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-macaron-pink"></div>
            <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-macaron-blue"></div>
            <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-macaron-green"></div>
            <h1 className="ml-1.5 sm:ml-3 font-bold text-slate-700 dark:text-slate-200 tracking-tight text-base sm:text-lg">
                {t.title}
            </h1>
          </div>
          
          <div className="flex flex-wrap gap-2 sm:gap-4 items-center">
             {/* Color Space Selector */}
             <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 gap-1">
                <button 
                  onClick={() => setColorSpace('srgb')} 
                  className={`px-2 py-1 text-xs rounded transition-all ${colorSpace === 'srgb' ? 'bg-white dark:bg-slate-600 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-700'}`}
                  title={t.colorSpaceSrgb}
                >
                  sRGB
                </button>
                <button 
                  onClick={() => setColorSpace('display-p3')} 
                  className={`px-2 py-1 text-xs rounded transition-all ${colorSpace === 'display-p3' ? 'bg-white dark:bg-slate-600 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-700'}`}
                  title={t.colorSpaceP3}
                >
                  P3
                </button>
                <button 
                  onClick={() => setColorSpace('adobe-rgb')} 
                  className={`px-2 py-1 text-xs rounded transition-all ${colorSpace === 'adobe-rgb' ? 'bg-white dark:bg-slate-600 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-700'}`}
                  title={t.colorSpaceAdobe}
                >
                  Adobe
                </button>
             </div>

             {/* Language Selector */}
             <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 gap-1">
                <button onClick={() => setLang('en')} className={`px-2 py-1 text-xs rounded ${lang === 'en' ? 'bg-white dark:bg-slate-600 shadow-sm font-bold' : 'text-slate-500'}`}>EN</button>
                <button onClick={() => setLang('zh')} className={`px-2 py-1 text-xs rounded ${lang === 'zh' ? 'bg-white dark:bg-slate-600 shadow-sm font-bold' : 'text-slate-500'}`}>中文</button>
                <button onClick={() => setLang('ja')} className={`px-2 py-1 text-xs rounded ${lang === 'ja' ? 'bg-white dark:bg-slate-600 shadow-sm font-bold' : 'text-slate-500'}`}>日文</button>
             </div>

             <button 
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-yellow-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
             >
                {theme === 'light' ? '🌙' : '☀️'}
             </button>
          </div>
        </div>
      </header>

      {/* Color Space Info Banner */}
      {colorSpace !== 'srgb' && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-b border-purple-100 dark:border-purple-800">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-2">
            <div className="flex items-center gap-2 text-xs text-purple-700 dark:text-purple-300">
              <span className="font-bold">🎨 {t.colorSpace}:</span>
              <span>{colorSpace === 'display-p3' ? t.colorSpaceP3 : t.colorSpaceAdobe}</span>
              <span className="text-purple-500 dark:text-purple-400">•</span>
              <span className="text-purple-600 dark:text-purple-400 italic">{t.outOfGamutHint}</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-[1920px] mx-auto w-full p-4 md:p-6 pb-28 lg:pb-6 grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8">
        
        {/* Left Column: Image & Palette */}
        {(!isWideVisualizer || rightPanelTab !== 'visualizer') && (
          <div className={`flex flex-col gap-6 lg:col-span-5 xl:col-span-4 ${mobileTab === 'extract' ? 'block' : 'hidden lg:block'}`}>
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm transition-colors duration-300">
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
                    <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800 p-2 rounded-lg">
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
                            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500 rounded"
                            title={lang === 'zh' ? '关闭图片 (保留颜色)' : lang === 'ja' ? '画像を閉じる (色を保持)' : 'Close image (keep colors)'}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Viewport */}
                    <div 
                        ref={containerRef}
                        className="relative h-[28rem] w-full overflow-hidden rounded-xl border-2 border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 cursor-move touch-none"
                        onWheel={handleWheel}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={() => {
                          handleMouseUp();
                          setLoupe(null);
                        }}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
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
                            <div className="absolute top-4 left-4 bg-black/70 text-white text-xs px-3 py-1 rounded-full backdrop-blur-sm pointer-events-none z-10">
                                {t.clickToPick}
                            </div>
                        )}
                        <div className="absolute top-3 right-3 z-20 flex gap-2">
                          <button
                            type="button"
                            onClick={handleExportAnnotated}
                            disabled={!extractMarkers.some((marker) => marker.paint) || isExporting}
                            className="flex items-center gap-1.5 rounded-lg bg-slate-900/80 px-3 py-1.5 text-[10px] font-bold text-white shadow-lg backdrop-blur-sm hover:bg-slate-900 disabled:opacity-40"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3.5 w-3.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                            </svg>
                            {isExporting ? t.exporting : t.exportAnnotated}
                          </button>
                        </div>
                    </div>
                </div>
            )}

            {assignedMarkers.length > 0 && rightPanelTab !== 'visualizer' && (
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
                                            handleSwitchTab("mixer");
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
                                            handleSwitchTab("mixer");
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
                                className="text-[10px] sm:text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                                title={lang === 'zh' ? '清空所有颜色' : lang === 'ja' ? 'すべての色をクリア' : 'Clear all colors'}
                            >
                                🗑️ {lang === 'zh' ? '清空' : lang === 'ja' ? 'クリア' : 'Clear'}
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

            {/* Mobile Floating Action: Go to Mixer when color is selected */}
            {selectedColor && (
              <div className="lg:hidden sticky bottom-20 z-20 mt-4 flex justify-center px-1">
                <button
                  type="button"
                  onClick={() => handleSwitchTab('mixer')}
                  className="w-full max-w-sm flex items-center justify-between gap-2.5 px-4 py-3 rounded-2xl shadow-xl border border-sky-400/40 dark:border-sky-500/40 bg-gradient-to-r from-sky-500 to-indigo-600 text-white text-xs font-bold active:scale-95 transition-all"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span 
                      className="w-4 h-4 rounded-full border border-white/60 shadow-inner flex-shrink-0" 
                      style={{ backgroundColor: selectedColor.hex }} 
                    />
                    <span className="font-mono text-white/95 truncate">{selectedColor.hex}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span>{lang === 'zh' ? '前往混色台查看配方' : lang === 'ja' ? '調色台で配合を見る' : 'View in Mixer'}</span>
                    <span className="text-sm">→</span>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
        )}

        {/* Right Column: Mixer & Output */}
        <div className={`${isWideVisualizer && rightPanelTab === 'visualizer' ? "col-span-12" : "lg:col-span-7 xl:col-span-8"} ${mobileTab !== 'extract' ? 'block' : 'hidden lg:block'}`}>
           <div className="bg-white dark:bg-slate-900 p-4 md:p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm h-full transition-colors duration-300 flex flex-col">
                {/* Mobile Quick Color Switcher (switch active color directly inside tools without leaving view) */}
                {colors.length > 0 && (
                  <div className="lg:hidden mb-4 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 overflow-x-auto no-scrollbar">
                    <span className="text-[10px] font-bold text-slate-400 flex-shrink-0">
                      {lang === 'zh' ? '已提取颜色:' : lang === 'ja' ? '色:' : 'Colors:'}
                    </span>
                    {colors.map((c) => {
                      const isSel = c.id === selectedColorId;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSelectedColorId(c.id)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all flex-shrink-0 ${
                            isSel
                              ? 'bg-sky-100 dark:bg-sky-950/80 border border-sky-400 dark:border-sky-600 text-sky-800 dark:text-sky-200 font-bold shadow-sm'
                              : 'bg-slate-100 dark:bg-slate-800 border border-transparent text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <span className="w-2.5 h-2.5 rounded-full border border-black/10 flex-shrink-0" style={{ backgroundColor: c.hex }} />
                          <span className="font-mono text-[10px]">{c.hex}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="flex justify-between items-center mb-6">
                    <div className="hidden lg:flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                        <button 
                            onClick={() => handleSwitchTab('mixer')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${rightPanelTab === 'mixer' ? 'bg-white dark:bg-slate-600 shadow text-slate-800 dark:text-white' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            {t.tabMixer}
                        </button>
                        <button 
                            onClick={() => handleSwitchTab('radial')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${rightPanelTab === 'radial' ? 'bg-white dark:bg-slate-600 shadow text-slate-800 dark:text-white' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            {lang === 'zh' ? '自选颜色混合' : lang === 'ja' ? 'カスタム混合' : 'CUSTOM MIX'}
                        </button>
                        <button 
                            onClick={() => handleSwitchTab('basic')}
                            className={`px-2 py-1.5 text-xs font-bold rounded-md transition-all ${rightPanelTab === 'basic' ? 'bg-white dark:bg-slate-600 shadow text-slate-800 dark:text-white' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            {lang === 'zh' ? '基础色' : lang === 'ja' ? 'ベース' : 'BASIC'}
                        </button>
                        <button 
                            onClick={() => handleSwitchTab('visualizer')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${rightPanelTab === 'visualizer' ? 'bg-white dark:bg-slate-600 shadow text-slate-800 dark:text-white' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            {t.tabVisualizer}
                        </button>
                        <button 
                            onClick={() => handleSwitchTab('catalog')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${rightPanelTab === 'catalog' ? 'bg-white dark:bg-slate-600 shadow text-slate-800 dark:text-white' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            {lang === 'zh' ? '数据库' : lang === 'ja' ? '色庫' : 'CATALOG'}
                        </button>
                    </div>
                    
                    {rightPanelTab === 'mixer' && (
                        <div className="hidden md:flex gap-2">
                            <div className="px-2 py-1 bg-macaron-pink/20 text-macaron-pink text-[10px] rounded font-mono font-bold">MR.HOBBY</div>
                            <div className="px-2 py-1 bg-macaron-purple/20 text-macaron-purple text-[10px] rounded font-mono font-bold">GAIA</div>
                        </div>
                    )}
                </div>

                {rightPanelTab === 'mixer' ? (
                    <MixerResult 
                        color={selectedColor} 
                        lang={lang} 
                        colorSpace={colorSpace} 
                        onAddColor={handleAddColor}
                        cache={mixerResultCache}
                        onCacheUpdate={setMixerResultCache}
                        onAssignCatalogPaint={handleAssignCatalogPaint}
                        onNavigateToExtract={() => handleSwitchTab('extract')}
                    />
                ) : rightPanelTab === 'radial' ? (
                    <RadialPaletteMixer
                        targetColor={selectedColor}
                        availableColors={colors}
                        lang={lang}
                        onAddColors={handleAddColors}
                        cache={radialMixerCache}
                        onCacheUpdate={setRadialMixerCache}
                        onAssignCatalogPaint={handleAssignCatalogPaint}
                    />
                ) : rightPanelTab === 'basic' ? (
                    <BasicColorMixer 
                        lang={lang}
                        cache={basicMixerCache}
                        onCacheUpdate={setBasicMixerCache}
                    />
                ) : rightPanelTab === 'catalog' ? (
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
                        onUnassignPaint={handleUnassignPaint}
                        onMoveLabel={handleMoveLabel}
                        isWideMode={isWideVisualizer}
                        onToggleWideMode={() => setIsWideVisualizer((prev) => !prev)}
                        onNavigateToExtract={() => handleSwitchTab('extract')}
                    />
                )}
           </div>
        </div>

      </main>

      {/* Footer with Author Info */}
      <footer className="border-t border-slate-200/50 dark:border-slate-700/50 mt-auto">
        <div className="max-w-[1920px] mx-auto px-4 md:px-6 py-2.5">
          <div className="flex flex-col md:flex-row items-center justify-between gap-2">
            
            {/* Author Info */}
            <div className="flex items-center gap-1.5">
              <a 
                href="https://github.com/HDINEVER/GK-Mixer-miniwebtools" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-7 h-7 rounded-full bg-gradient-to-br from-macaron-pink via-macaron-blue to-macaron-purple flex items-center justify-center text-white font-bold text-xs shadow-md hover:scale-110 hover:shadow-lg transition-all duration-200 cursor-pointer"
                title="Visit GitHub Repository"
              >
                HD
              </a>
              <div>
                <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                  {lang === 'zh' ? '开发者' : lang === 'ja' ? '開発者' : 'Developer'}: <span className="text-macaron-blue">@HDIN</span>
                </div>
                <div className="text-[9px] text-slate-500 dark:text-slate-400">
                  {lang === 'zh' ? '模型爱好者的调色工具' : lang === 'ja' ? 'モデラーのための塗装ツール' : 'Paint Mixing Tool for Modelers'}
                </div>
              </div>
            </div>

            {/* Social Links */}
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {/* Bilibili */}
              <a 
                href="https://space.bilibili.com/23848833?spm_id_from=333.1007.0.0"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-1.5 py-1 rounded-md border border-slate-200/60 dark:border-slate-600/60 hover:border-pink-400 dark:hover:border-pink-500 hover:bg-pink-50/50 dark:hover:bg-pink-900/10 transition-all group"
                title="Bilibili"
              >
                <svg className="w-3.5 h-3.5 text-pink-500 group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.813 4.653h.854c1.51.054 2.769.578 3.773 1.574 1.004.995 1.524 2.249 1.56 3.76v7.36c-.036 1.51-.556 2.769-1.56 3.773s-2.262 1.524-3.773 1.56H5.333c-1.51-.036-2.769-.556-3.773-1.56S.036 18.858 0 17.347v-7.36c.036-1.511.556-2.765 1.56-3.76 1.004-.996 2.262-1.52 3.773-1.574h.774l-1.174-1.12a1.234 1.234 0 0 1-.373-.906c0-.356.124-.658.373-.907l.027-.027c.267-.249.573-.373.92-.373.347 0 .653.124.92.373L9.653 4.44c.071.071.134.142.187.213h4.267a.836.836 0 0 1 .16-.213l2.853-2.747c.267-.249.573-.373.92-.373.347 0 .662.151.929.4.267.249.391.551.391.907 0 .355-.124.657-.373.906zM5.333 7.24c-.746.018-1.373.276-1.88.773-.506.498-.769 1.13-.786 1.894v7.52c.017.764.28 1.395.786 1.893.507.498 1.134.756 1.88.773h13.334c.746-.017 1.373-.275 1.88-.773.506-.498.769-1.129.786-1.893v-7.52c-.017-.765-.28-1.396-.786-1.894-.507-.497-1.134-.755-1.88-.773zM8 11.107c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c0-.373.129-.689.386-.947.258-.257.574-.386.947-.386zm8 0c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c.017-.391.15-.711.4-.96.249-.249.56-.373.933-.373Z"/>
                </svg>
                <span className="text-[9px] font-medium text-slate-600 dark:text-slate-300 group-hover:text-pink-500">Bilibili</span>
              </a>

              {/* X (Twitter) */}
              <a 
                href="https://x.com/rfQ4nGLccl4bqCP"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-1.5 py-1 rounded-md border border-slate-200/60 dark:border-slate-600/60 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all group"
                title="X (Twitter)"
              >
                <svg className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300 group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                <span className="text-[9px] font-medium text-slate-600 dark:text-slate-300 group-hover:text-blue-500">X / Twitter</span>
              </a>

              {/* QQ Group */}
              <a 
                href="https://qm.qq.com/q/QtX0ZBOWIe"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-1.5 py-1 rounded-md border border-slate-200/60 dark:border-slate-600/60 hover:border-blue-500 dark:hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all group"
                title="QQ Group"
              >
                <svg className="w-3.5 h-3.5 text-blue-500 group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21.395 15.035a39.548 39.548 0 0 0-.803-2.264l-1.079-2.695c.001-.032.014-.562.014-.836C19.527 4.632 17.081 0 12 0S4.473 4.632 4.473 9.241c0 .274.013.804.014.836l-1.08 2.695a39.548 39.548 0 0 0-.802 2.264c-1.021 3.283-.69 4.643-.438 4.673.54.065 1.187-2.216 1.187-2.216.09.482.255.946.486 1.363 0 0-1.125 2.181-.685 2.433.435.247 1.134-.851 1.134-.851.371.48.84.87 1.361 1.134 0 0-.698 1.262-.228 1.262.47 0 1.273-1.41 1.273-1.41.583.201 1.18.309 1.781.322v.356c0 .309 1.576.373 2.524.373s2.524-.064 2.524-.373v-.356a6.104 6.104 0 0 0 1.781-.322s.803 1.41 1.273 1.41c.47 0-.228-1.262-.228-1.262a4.57 4.57 0 0 0 1.361-1.134s.699 1.098 1.134.851c.44-.252-.685-2.433-.685-2.433.231-.417.396-.881.486-1.363 0 0 .647 2.281 1.187 2.216.252-.03.583-1.39-.438-4.673z"/>
                </svg>
                <span className="text-[9px] font-medium text-slate-600 dark:text-slate-300 group-hover:text-blue-500">
                  {lang === 'zh' ? '功能讨论群' : lang === 'ja' ? 'QQグループ' : 'QQ Group'}
                </span>
              </a>
            </div>

            {/* Copyright & Special Thanks */}
            <div className="text-[9px] text-slate-400 dark:text-slate-500 text-center md:text-right">
              <div>© 2025 GK-Mixer</div>
              <div className="mt-0.5">
                {lang === 'zh' ? '为模型爱好者打造' : lang === 'ja' ? 'モデラーのために' : 'Made for Modelers'}
              </div>
              <div className="mt-0.5 flex items-center justify-center md:justify-end gap-1 text-pink-400 dark:text-pink-300">
                <span>✨</span>
                <span>{lang === 'zh' ? '特别鸣谢' : lang === 'ja' ? '特別感謝' : 'Special Thanks'}: スミレ</span>
              </div>
              <div className="mt-0.5 text-[8px] opacity-60">
                {lang === 'zh'
                  ? '引用: Mixbox 2.0 · RAL · miniature-paints · ModKit Swatch'
                  : lang === 'ja'
                    ? '引用: Mixbox 2.0 · RAL · miniature-paints · ModKit Swatch'
                    : 'Powered by: Mixbox 2.0 · RAL · miniature-paints · ModKit Swatch'}
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Dock Bar (iOS/Mobile App style fixed navigation) */}
      <nav 
        aria-label="Mobile Navigation Dock"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-t border-slate-200/70 dark:border-slate-800/80 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] select-none"
        style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom, 0.375rem))' }}
      >
        <div className="grid grid-cols-6 w-full max-w-lg mx-auto px-0.5 pt-1 pb-0.5">
          {/* 1. 取色 (Extract / Picker) */}
          <button
            type="button"
            onClick={() => handleSwitchTab('extract')}
            className={`min-w-0 relative flex flex-col items-center justify-center py-1 px-0.5 rounded-lg transition-all active:scale-95 ${
              mobileTab === 'extract'
                ? 'text-sky-600 dark:text-sky-400 font-bold bg-sky-50/70 dark:bg-sky-950/40'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <div className="relative flex items-center justify-center">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 4.5l-4-4a2.121 2.121 0 00-3 0L3 10l-1 5 5-1 9.5-9.5a2.121 2.121 0 000-3z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 6l4 4" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 21l3-3" />
              </svg>
              {colors.length > 0 && (
                <span className="absolute -top-1 -right-2 px-1 min-w-[14px] h-3.5 bg-sky-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center leading-none shadow-sm">
                  {colors.length}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight truncate w-full text-center">{t.dockExtract}</span>
          </button>

          {/* 2. 混色台 (Mixer) */}
          <button
            type="button"
            onClick={() => handleSwitchTab('mixer')}
            className={`min-w-0 relative flex flex-col items-center justify-center py-1 px-0.5 rounded-lg transition-all active:scale-95 ${
              mobileTab === 'mixer'
                ? 'text-sky-600 dark:text-sky-400 font-bold bg-sky-50/70 dark:bg-sky-950/40'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <div className="relative flex items-center justify-center">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              {selectedColor && (
                <span 
                  className="absolute -top-0.5 -right-1 w-2.5 h-2.5 rounded-full border border-white dark:border-slate-900 shadow-sm"
                  style={{ backgroundColor: selectedColor.hex }}
                />
              )}
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight truncate w-full text-center">{t.dockMixer}</span>
          </button>

          {/* 3. 自选混合 (Radial Custom Mix) */}
          <button
            type="button"
            onClick={() => handleSwitchTab('radial')}
            className={`min-w-0 relative flex flex-col items-center justify-center py-1 px-0.5 rounded-lg transition-all active:scale-95 ${
              mobileTab === 'radial'
                ? 'text-sky-600 dark:text-sky-400 font-bold bg-sky-50/70 dark:bg-sky-950/40'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <div className="relative flex items-center justify-center">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" />
                <circle cx="12" cy="12" r="4" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v5m0 8v5M3 12h5m8 0h5" />
              </svg>
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight truncate w-full text-center">{t.dockCustom}</span>
          </button>

          {/* 4. 基础色 (Basic) */}
          <button
            type="button"
            onClick={() => handleSwitchTab('basic')}
            className={`min-w-0 relative flex flex-col items-center justify-center py-1 px-0.5 rounded-lg transition-all active:scale-95 ${
              mobileTab === 'basic'
                ? 'text-sky-600 dark:text-sky-400 font-bold bg-sky-50/70 dark:bg-sky-950/40'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <div className="relative flex items-center justify-center">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="7" r="4" />
                <circle cx="7" cy="16" r="4" />
                <circle cx="17" cy="16" r="4" />
              </svg>
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight truncate w-full text-center">{t.dockBasic}</span>
          </button>

          {/* 5. 调色板 (Visualizer Swatches) */}
          <button
            type="button"
            onClick={() => handleSwitchTab('visualizer')}
            className={`min-w-0 relative flex flex-col items-center justify-center py-1 px-0.5 rounded-lg transition-all active:scale-95 ${
              mobileTab === 'visualizer'
                ? 'text-sky-600 dark:text-sky-400 font-bold bg-sky-50/70 dark:bg-sky-950/40'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <div className="relative flex items-center justify-center">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9h18M9 21V9" />
              </svg>
              {assignedMarkers.length > 0 && (
                <span className="absolute -top-1 -right-2 px-1 min-w-[14px] h-3.5 bg-emerald-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center leading-none shadow-sm">
                  {assignedMarkers.length}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight truncate w-full text-center">{t.dockPalette}</span>
          </button>

          {/* 6. 数据库 (Catalog) */}
          <button
            type="button"
            onClick={() => handleSwitchTab('catalog')}
            className={`min-w-0 relative flex flex-col items-center justify-center py-1 px-0.5 rounded-lg transition-all active:scale-95 ${
              mobileTab === 'catalog'
                ? 'text-sky-600 dark:text-sky-400 font-bold bg-sky-50/70 dark:bg-sky-950/40'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <div className="relative flex items-center justify-center">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm0 6a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm0 6a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2z" />
              </svg>
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight truncate w-full text-center">{t.dockCatalog}</span>
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
    </div>
  );
};

export default App;