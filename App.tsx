import React, { useState, useRef, useEffect, useCallback } from 'react';
import DropZone from './components/DropZone';
import ColorPalette from './components/ColorPalette';
import MixerResult from './components/MixerResult';
import PaletteVisualizer from './components/PaletteVisualizer';
import RadialPaletteMixer from './components/RadialPaletteMixer';
import BasicColorMixer from './components/BasicColorMixer';
import Loader from './components/Loader';
import { ColorData, AppMode, RGB, Language, Theme, ColorSpace, MixerResultCache, RadialMixerCache, BasicMixerCache, MixingMode, SliderState, BaseColor } from './types';
import { extractProminentColors, generateId, rgbToCmyk, rgbToHex, hexToRgb, rgbToHsb, rgbToLab } from './utils/colorUtils';
import { convertToWorkingSpace, isInGamut } from './utils/colorSpaceConverter';
import { translations } from './utils/translations';

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
  const [rightPanelTab, setRightPanelTab] = useState<'mixer' | 'visualizer' | 'radial' | 'basic'>('mixer');
  
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

  // Zoom State
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const startPos = useRef({ x: 0, y: 0 });
  const currentOffset = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  const selectedColor = colors.find(c => c.id === selectedColorId) || null;
  const t = translations[lang];

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

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPicking || !canvasRef.current) return;
    
    const x = e.nativeEvent.offsetX;
    const y = e.nativeEvent.offsetY;

    // Use user-selected colorspace for color extraction
    const ctx = canvasRef.current.getContext('2d', { 
      colorSpace: colorSpace === 'adobe-rgb' ? 'srgb' : colorSpace, // Adobe RGB fallback to sRGB in canvas
      willReadFrequently: true 
    });
    if (ctx) {
        const scaleX = canvasRef.current.width / canvasRef.current.offsetWidth;
        const scaleY = canvasRef.current.height / canvasRef.current.offsetHeight;
        
        const pixelX = Math.floor(x * scaleX);
        const pixelY = Math.floor(y * scaleY);

        const pixel = ctx.getImageData(pixelX, pixelY, 1, 1).data;
        let rgb: RGB = { r: pixel[0], g: pixel[1], b: pixel[2] };
        
        // 如果是Adobe RGB模式,需要转换到工作空间(sRGB)
        if (colorSpace === 'adobe-rgb') {
          rgb = convertToWorkingSpace(rgb, 'adobe-rgb');
        }
        
        const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
        
        // 计算 HSB 和 LAB 色彩空间
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
        // 如果不是连续取色模式,点击后关闭取色
        if (!isContinuousPicking) {
          setIsPicking(false);
        }
    }
  };

  // Zoom Handlers
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = -e.deltaY * 0.001;
        setScale(s => Math.min(Math.max(1, s + delta), 5));
    }
  };

  const handleZoomIn = () => setScale(s => Math.min(s + 0.5, 5));
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
    if (!isPicking && scale > 1 && e.touches.length === 1) {
      setIsDragging(true);
      const touch = e.touches[0];
      currentOffset.current = { x: offset.x, y: offset.y };
      startPos.current = { x: touch.clientX - offset.x, y: touch.clientY - offset.y };
    }
  }, [isPicking, scale, offset]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
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
    }
  }, [isDragging, updateTransform]);

  const handleTouchEnd = useCallback(() => {
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
        }
    }
  }, [sourceImage, colorSpace]); // Re-render canvas when colorSpace changes

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-macaron-gray dark:border-slate-700 sticky top-0 z-50 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-macaron-pink"></div>
            <div className="w-4 h-4 rounded-full bg-macaron-blue"></div>
            <div className="w-4 h-4 rounded-full bg-macaron-green"></div>
            <h1 className="ml-3 font-bold text-slate-700 dark:text-slate-200 tracking-tight text-lg">
                {t.title}
            </h1>
          </div>
          
          <div className="flex flex-wrap gap-4 items-center">
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
      <main className="flex-1 max-w-[1920px] mx-auto w-full p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8">
        
        {/* Left Column: Image & Palette */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-6">
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
                        <div className="flex gap-2">
                            <button onClick={handleZoomIn} className="px-2 py-1 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-200 text-xs rounded border border-slate-200 dark:border-slate-600 hover:border-macaron-blue">{t.zoomIn}</button>
                            <button onClick={handleZoomOut} className="px-2 py-1 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-200 text-xs rounded border border-slate-200 dark:border-slate-600 hover:border-macaron-blue">{t.zoomOut}</button>
                            <button onClick={handleReset} className="px-2 py-1 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-200 text-xs rounded border border-slate-200 dark:border-slate-600 hover:border-macaron-blue">{t.reset}</button>
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
                        className="relative h-80 w-full overflow-hidden rounded-xl border-2 border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 cursor-move touch-none"
                        onWheel={handleWheel}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
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
                            <canvas 
                                ref={canvasRef}
                                onClick={handleCanvasClick}
                                className={`max-w-none max-h-full shadow-lg ${isPicking ? 'cursor-crosshair ring-2 ring-macaron-green' : ''}`}
                                style={{
                                    // Prevent canvas from stretching, keep native aspect ratio if possible or fit contain
                                    maxWidth: '100%',
                                    maxHeight: '100%',
                                    objectFit: 'contain'
                                }}
                            />
                        </div>

                        {isPicking && (
                            <div className="absolute top-4 left-4 bg-black/70 text-white text-xs px-3 py-1 rounded-full backdrop-blur-sm animate-pulse pointer-events-none z-10">
                                {t.clickToPick}
                            </div>
                        )}
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
          </div>
        </div>

        {/* Right Column: Mixer & Output */}
        <div className="lg:col-span-7 xl:col-span-8">
           <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm h-full transition-colors duration-300 flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                        <button 
                            onClick={() => setRightPanelTab('mixer')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${rightPanelTab === 'mixer' ? 'bg-white dark:bg-slate-600 shadow text-slate-800 dark:text-white' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            {t.tabMixer}
                        </button>
                        <button 
                            onClick={() => setRightPanelTab('radial')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${rightPanelTab === 'radial' ? 'bg-white dark:bg-slate-600 shadow text-slate-800 dark:text-white' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            {lang === 'zh' ? '自选颜色混合' : lang === 'ja' ? 'カスタム混合' : 'CUSTOM MIX'}
                        </button>
                        <button 
                            onClick={() => setRightPanelTab('basic')}
                            className={`px-2 py-1.5 text-xs font-bold rounded-md transition-all ${rightPanelTab === 'basic' ? 'bg-white dark:bg-slate-600 shadow text-slate-800 dark:text-white' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            {lang === 'zh' ? '基础色' : lang === 'ja' ? 'ベース' : 'BASIC'}
                        </button>
                        <button 
                            onClick={() => setRightPanelTab('visualizer')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${rightPanelTab === 'visualizer' ? 'bg-white dark:bg-slate-600 shadow text-slate-800 dark:text-white' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            {t.tabVisualizer}
                        </button>
                    </div>
                    
                    {rightPanelTab === 'mixer' && (
                        <div className="hidden md:flex gap-2">
                            <div className="px-2 py-1 bg-macaron-blue/20 text-macaron-blue text-[10px] rounded font-mono font-bold">CMYK</div>
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
                    />
                ) : rightPanelTab === 'radial' ? (
                    <RadialPaletteMixer
                        targetColor={selectedColor}
                        availableColors={colors}
                        lang={lang}
                        onAddColors={handleAddColors}
                        cache={radialMixerCache}
                        onCacheUpdate={setRadialMixerCache}
                    />
                ) : rightPanelTab === 'basic' ? (
                    <BasicColorMixer 
                        lang={lang}
                        cache={basicMixerCache}
                        onCacheUpdate={setBasicMixerCache}
                    />
                ) : (
                    <PaletteVisualizer 
                        sourceImage={sourceImage}
                        colors={colors}
                        lang={lang}
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
                {lang === 'zh' ? '引用: Mixbox 2.0 · RAL 色库' : lang === 'ja' ? '引用: Mixbox 2.0 · RAL カラーライブラリ' : 'Powered by: Mixbox 2.0 · RAL Color Library'}
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;