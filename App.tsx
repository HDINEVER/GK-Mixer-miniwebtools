import React, { useState, useRef, useEffect } from 'react';
import DropZone from './components/DropZone';
import ColorPalette from './components/ColorPalette';
import MixerResult from './components/MixerResult';
import PaletteVisualizer from './components/PaletteVisualizer';
import RadialPaletteMixer from './components/RadialPaletteMixer';
import BasicColorMixer from './components/BasicColorMixer';
import { ColorData, AppMode, RGB, Language, Theme, ColorSpace } from './types';
import { extractProminentColors, generateId, rgbToCmyk, rgbToHex } from './utils/colorUtils';
import { convertToWorkingSpace, isInGamut } from './utils/colorSpaceConverter';
import { translations } from './utils/translations';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.ANALYZE);
  const [lang, setLang] = useState<Language>('zh');
  const [theme, setTheme] = useState<Theme>('light');
  const [colorSpace, setColorSpace] = useState<ColorSpace>('srgb');
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [colors, setColors] = useState<ColorData[]>([]);
  const [selectedColorId, setSelectedColorId] = useState<string | null>(null);
  const [rightPanelTab, setRightPanelTab] = useState<'mixer' | 'visualizer' | 'radial' | 'basic'>('mixer');
  
  // Ref for manual picker canvas
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPicking, setIsPicking] = useState(false);

  // Zoom State
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

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
    
    const extracted = await extractProminentColors(img, 5, colorSpace);
    setColors(extracted);
    if (extracted.length > 0) {
      setSelectedColorId(extracted[0].id);
    }
  };

  const handleManualAdd = () => {
    if (!sourceImage) return;
    setIsPicking(!isPicking);
  };

  const handleDeleteColor = (colorId: string) => {
    setColors(prev => prev.filter(c => c.id !== colorId));
    // If deleted color was selected, select the first remaining color or null
    if (selectedColorId === colorId) {
      const remaining = colors.filter(c => c.id !== colorId);
      setSelectedColorId(remaining.length > 0 ? remaining[0].id : null);
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
        
        const newColor: ColorData = {
            id: generateId(),
            hex,
            rgb,
            cmyk: rgbToCmyk(rgb.r, rgb.g, rgb.b),
            source: 'manual',
            colorSpace: colorSpace
        };

        setColors(prev => [newColor, ...prev]);
        setSelectedColorId(newColor.id);
        setIsPicking(false);
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

  // Pan Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
     if (!isPicking && scale > 1) {
         setIsDragging(true);
         setStartPos({ x: e.clientX - offset.x, y: e.clientY - offset.y });
     }
  };
  
  const handleMouseMove = (e: React.MouseEvent) => {
      if (isDragging) {
          setOffset({
              x: e.clientX - startPos.x,
              y: e.clientY - startPos.y
          });
      }
  };

  const handleMouseUp = () => setIsDragging(false);

  // Touch Handlers for Mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isPicking && scale > 1 && e.touches.length === 1) {
      setIsDragging(true);
      const touch = e.touches[0];
      setStartPos({ x: touch.clientX - offset.x, y: touch.clientY - offset.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging && e.touches.length === 1) {
      const touch = e.touches[0];
      setOffset({
        x: touch.clientX - startPos.x,
        y: touch.clientY - startPos.y
      });
    }
  };

  const handleTouchEnd = () => setIsDragging(false);

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
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Image & Palette */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm transition-colors duration-300">
            <h2 className="text-xs font-bold text-slate-400 mb-4 tracking-widest">{t.sourceInput}</h2>
            
            {!sourceImage ? (
                <DropZone onImageLoaded={handleImageLoaded} label={t.dragDrop} />
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
                            style={{ 
                                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                                transformOrigin: '0 0',
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center'
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
                        onDeleteColor={handleDeleteColor}
                        hasImage={!!sourceImage}
                    />
                </div>
            )}
          </div>
        </div>

        {/* Right Column: Mixer & Output */}
        <div className="lg:col-span-7">
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
                    <>
                        <MixerResult color={selectedColor} lang={lang} />
                        <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">
                            <h3 className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">{t.howItWorks}</h3>
                            <ul className="list-disc list-inside text-xs text-slate-400 dark:text-slate-500 font-mono space-y-1">
                                {t.howItWorksList.map((item, i) => (
                                    <li key={i}>{item}</li>
                                ))}
                            </ul>
                        </div>
                    </>
                ) : rightPanelTab === 'radial' ? (
                    <RadialPaletteMixer
                        targetColor={selectedColor}
                        availableColors={colors}
                        lang={lang}
                    />
                ) : rightPanelTab === 'basic' ? (
                    <BasicColorMixer lang={lang} />
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
    </div>
  );
};

export default App;