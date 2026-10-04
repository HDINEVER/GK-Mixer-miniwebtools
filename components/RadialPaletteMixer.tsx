import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  SlidersHorizontalIcon,
  CircleNotchIcon,
  TargetIcon,
  FlaskIcon,
  ClipboardTextIcon,
  CheckIcon,
  ArrowCounterClockwiseIcon,
  ChartBarIcon,
  PaletteIcon,
  PlusIcon,
  EyedropperIcon,
} from '@phosphor-icons/react';
import { CatalogPaint, ColorData, Language, RadialMixerCache, SliderState } from '../types';
import { hexToRgb, mixboxMultiBlend, hexToRAL, findNearestPaints } from '../utils/colorUtils';
import { translations } from '../utils/translations';
import { toDropRatio } from '../utils/dropRatio';
import DropRatioBar from './DropRatioBar';
import BrandMatchPanel from './BrandMatchPanel';
import IOSColorSlider from './IOSColorSlider';
import * as mixbox from '../utils/mixbox';

declare var anime: any;

interface RadialPaletteMixerProps {
  targetColor: ColorData | null;
  availableColors: ColorData[];
  lang: Language;
  onAddColors?: (colors: string[]) => void;
  cache?: RadialMixerCache;
  onCacheUpdate?: (cache: RadialMixerCache) => void;
  onAssignCatalogPaint?: (paint: CatalogPaint) => void;
}

// Canvas 基础常量 (标准逻辑坐标空间 450x450)
const BASE_WIDTH = 450;
const BASE_HEIGHT = 450;
const WIDTH = BASE_WIDTH;
const HEIGHT = BASE_HEIGHT;
const CENTER_X = WIDTH / 2; // 225
const CENTER_Y = HEIGHT / 2; // 225

// 精确计算的安全几何半径：
// 外轨半径设为 182，最大滑块半径为 26，最大边缘距离为 225 + 182 + 26 = 433px < 450px
// 留出 17px 全局缓冲，保证任何角度的滑块与外圈阴影绝不被画布边缘裁切
const OUTER_RADIUS = 182;
const INNER_RADIUS = 60;
const CENTER_RADIUS = 54;
const BASE_KNOB_RADIUS = 18;
const ACTIVE_KNOB_RADIUS = 26;

const RadialPaletteMixer: React.FC<RadialPaletteMixerProps> = ({ 
  targetColor, 
  availableColors,
  lang,
  onAddColors,
  cache,
  onCacheUpdate,
  onAssignCatalogPaint,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  // Use cache values if available, otherwise use defaults
  const [sliders, setSliders] = useState<SliderState[]>(cache?.sliders ?? []);
  const [cmyAdded, setCmyAdded] = useState(cache?.cmyAdded ?? false);
  const [bwAdded, setBwAdded] = useState(cache?.bwAdded ?? false);
  const [draggingIndex, setDraggingIndex] = useState<number>(-1);
  const [hoverIndex, setHoverIndex] = useState<number>(-1);

  // 同步即时计算混合结果，0ms延迟
  const mixedColor = useMemo(() => {
    const activeSliders = sliders.filter((s) => s.weight > 0.0001);
    if (activeSliders.length === 0) return '';
    const colorWeights = activeSliders.map((s) => ({
      hex: s.color,
      weight: s.weight,
    }));
    return mixboxMultiBlend(colorWeights);
  }, [sliders]);

  const [targetVolume, setTargetVolume] = useState<number>(cache?.targetVolume ?? 20);
  const [canvasSize, setCanvasSize] = useState(() => {
    if (typeof window === 'undefined') return { width: BASE_WIDTH, height: BASE_HEIGHT, scale: 1 };
    const initialAvailable = Math.max(220, Math.min(window.innerWidth - 32, BASE_WIDTH));
    return {
      width: initialAvailable,
      height: initialAvailable,
      scale: initialAvailable / BASE_WIDTH
    };
  });
  const [dropMultiplier, setDropMultiplier] = useState(1);
  const knobSizes = useRef<number[]>(cache?.sliders ? new Array(cache.sliders.length).fill(BASE_KNOB_RADIUS) : []); // For anime.js dynamic sizing
  const requestRef = useRef<number>(0); // For animation loop
  const animatingSliders = useRef<boolean>(false);
  const lastMoveTimeRef = useRef<number>(0); // 触控节流
  const cacheTimerRef = useRef<any>(null); // 防抖更新父级缓存
  // Track if sliders were initialized from colors
  const slidersInitializedRef = useRef<boolean>(cache?.sliders && cache.sliders.length > 0 ? true : false);

  // Check if screen is vertical / portrait
  const [isPortrait, setIsPortrait] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth < 768 || window.innerHeight > window.innerWidth;
  });

  useEffect(() => {
    const handleResize = () => {
      const portrait = window.innerWidth < 768 || window.innerHeight > window.innerWidth;
      setIsPortrait(portrait);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // View mode: 'ios' (色板滑块) or 'radial' (轮盘模式). Default 'ios' on mobile/portrait
  const [viewMode, setViewMode] = useState<'ios' | 'radial'>('ios');

  // Copied hex tooltip state
  const [copiedHex, setCopiedHex] = useState(false);
  const handleCopyHex = (hex: string) => {
    if (!hex) return;
    navigator.clipboard?.writeText(hex);
    setCopiedHex(true);
    setTimeout(() => setCopiedHex(false), 1500);
  };

  // RAL match calculation
  const ralMatch = useMemo(() => (mixedColor ? hexToRAL(mixedColor) : null), [mixedColor]);

  // Volume presets matching iOS
  const volumePresets = [10, 20, 30, 40, 50, 60];

  // Hidden native color input ref
  const colorInputRef = useRef<HTMLInputElement>(null);
  const [pickerColor, setPickerColor] = useState<string>('#FF5500');

  // 油漆名称缓存表，避免在滑块拖动的高频帧中重复执行高开销的 Delta-E 全库检索
  const paintNameCache = useRef<Map<string, { name: string; hex: string; primary: string; sub: string }>>(new Map());

  // Name helper for colors (memoized and cached)
  const getPaintDisplayName = useCallback((hex: string): { name: string; hex: string; primary: string; sub: string } => {
    const upper = hex.toUpperCase();
    const cached = paintNameCache.current.get(upper);
    if (cached) return cached;

    let name = '';
    if (upper === '#FFFFFF') name = '白';
    else if (upper === '#000000') name = '黑';
    else if (upper === '#E60012') name = '红';
    else if (upper === '#004098') name = '蓝';
    else if (upper === '#FFD900') name = '黄';
    else if (upper === '#00B7EB') name = '色源青';
    else if (upper === '#FF0090') name = '色源品红';
    else if (upper === '#FFEF00') name = '色源黄';
    else if (targetColor && targetColor.hex.toUpperCase() === upper && targetColor.assignedPaint) {
      name = targetColor.assignedPaint.name;
    } else {
      const nearest = findNearestPaints(hex, 1);
      if (nearest && nearest.length > 0) {
        name = nearest[0].name.replace(/^光泽/, '');
      } else {
        name = lang === 'zh' ? '自选色' : lang === 'ja' ? 'カスタム' : 'Custom';
      }
    }

    // 分割中英双语名称（如 "沙白 / Sand White" -> primary: "沙白", sub: "Sand White"）
    let primary = name;
    let sub = hex;
    if (name.includes(' / ')) {
      const parts = name.split(' / ');
      primary = parts[0].trim();
      sub = parts.slice(1).join(' / ').trim();
    } else if (name !== '白' && name !== '黑') {
      sub = hex;
    }

    const item = { name, hex, primary, sub };
    paintNameCache.current.set(upper, item);
    return item;
  }, [targetColor, lang]);

  // Add custom color from picker
  const handleAddCustomColor = (hex: string) => {
    if (!hex) return;
    const normalized = hex.toUpperCase();
    if (sliders.some((s) => s.color.toUpperCase() === normalized)) {
      return;
    }
    const newSlider: SliderState = {
      id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      color: normalized,
      angle: 0,
      position: 0.2, // 20% default weight
      weight: 0.2,
      scale: 1.0,
    };
    const nextSliders = [...sliders, newSlider];
    const step = (2 * Math.PI) / (nextSliders.length || 1);
    nextSliders.forEach((s, idx) => {
      s.angle = idx * step;
    });
    knobSizes.current = new Array(nextSliders.length).fill(BASE_KNOB_RADIUS);
    setSliders(nextSliders);
  };

  // Remove a color from palette
  const handleRemoveSlider = (id: string) => {
    const nextSliders = sliders.filter((s) => s.id !== id);
    const step = (2 * Math.PI) / (nextSliders.length || 1);
    nextSliders.forEach((s, idx) => {
      s.angle = idx * step;
    });
    knobSizes.current = new Array(nextSliders.length).fill(BASE_KNOB_RADIUS);
    setSliders(nextSliders);
  };

  // Handle slider weight changes in iOS mode
  const handleSliderWeightChange = (index: number, val: number) => {
    const nextSliders = [...sliders];
    const weight = Math.max(0, Math.min(100, val)) / 100;
    nextSliders[index] = {
      ...nextSliders[index],
      position: weight,
      weight: weight,
    };
    setSliders(nextSliders);
  };

  // Add CMY primaries
  const handleAddCMY = () => {
    const cmyColors = ['#00B7EB', '#FF0090', '#FFEF00'];
    const toAdd = cmyColors.filter(
      (c) => !sliders.some((s) => s.color.toUpperCase() === c)
    );
    if (toAdd.length > 0) {
      const newSliders: SliderState[] = toAdd.map((c, i) => ({
        id: `cmy-${Date.now()}-${i}`,
        color: c,
        angle: 0,
        position: 0,
        weight: 0,
        scale: 1.0,
      }));
      const nextSliders = [...sliders, ...newSliders];
      const step = (2 * Math.PI) / (nextSliders.length || 1);
      nextSliders.forEach((s, idx) => {
        s.angle = idx * step;
      });
      knobSizes.current = new Array(nextSliders.length).fill(BASE_KNOB_RADIUS);
      setSliders(nextSliders);
    }
    setCmyAdded(true);
    setTimeout(() => setCmyAdded(false), 2000);
    if (onAddColors) onAddColors(cmyColors);
  };

  // Add Black and White
  const handleAddBW = () => {
    const bwColors = ['#000000', '#FFFFFF'];
    const toAdd = bwColors.filter(
      (c) => !sliders.some((s) => s.color.toUpperCase() === c)
    );
    if (toAdd.length > 0) {
      const newSliders: SliderState[] = toAdd.map((c, i) => ({
        id: `bw-${Date.now()}-${i}`,
        color: c,
        angle: 0,
        position: 0,
        weight: 0,
        scale: 1.0,
      }));
      const nextSliders = [...sliders, ...newSliders];
      const step = (2 * Math.PI) / (nextSliders.length || 1);
      nextSliders.forEach((s, idx) => {
        s.angle = idx * step;
      });
      knobSizes.current = new Array(nextSliders.length).fill(BASE_KNOB_RADIUS);
      setSliders(nextSliders);
    }
    setBwAdded(true);
    setTimeout(() => setBwAdded(false), 2000);
    if (onAddColors) onAddColors(bwColors);
  };

  // Clear all custom colors
  const handleClearAll = () => {
    setSliders([]);
    setCmyAdded(false);
    setBwAdded(false);
  };
  
  const t = translations[lang];
  
  // Initialize knobSizes if restored from cache
  useEffect(() => {
    if (sliders.length > 0 && knobSizes.current.length !== sliders.length) {
      knobSizes.current = new Array(sliders.length).fill(BASE_KNOB_RADIUS);
    }
  }, [sliders.length]);
  
  // 严格基于容器实际可用宽度的响应式尺寸计算，避免任何横向滚动与截断
  const updateCanvasSize = useCallback(() => {
    const container = canvasContainerRef.current;
    if (!container) return;
    
    // 获取容器当前的真实渲染宽度（已扣除外层所有 padding）
    const containerWidth = container.clientWidth;
    if (containerWidth <= 0) return;
    
    // 留出 2px 微小边距，确保即使在极窄屏幕上也不会产生 1px 的多余滚动
    const availableWidth = Math.max(220, Math.min(containerWidth - 2, BASE_WIDTH));
    const scale = availableWidth / BASE_WIDTH;
    
    setCanvasSize(prev => {
      if (Math.abs(prev.width - availableWidth) < 0.5) return prev;
      return {
        width: availableWidth,
        height: availableWidth,
        scale: scale
      };
    });
  }, []);

  // 使用 ResizeObserver 实时监听容器宽度变化（旋转屏幕、侧边栏切换、窗口缩放）
  useEffect(() => {
    updateCanvasSize();
    const container = canvasContainerRef.current;
    if (!container) return;

    const ro = new ResizeObserver(() => {
      updateCanvasSize();
    });
    ro.observe(container);

    window.addEventListener('resize', updateCanvasSize);
    window.addEventListener('orientationchange', updateCanvasSize);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateCanvasSize);
      window.removeEventListener('orientationchange', updateCanvasSize);
    };
  }, [updateCanvasSize]);
  
  // 移动端: 在拖动时阻止页面滚动
  useEffect(() => {
    if (draggingIndex !== -1) {
      // 阻止页面滚动
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      // 恢复页面滚动
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    }
    
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [draggingIndex]);
  
  // Track available colors IDs for change detection
  const prevAvailableColorsRef = useRef<string>('');
  
  // Initialize sliders when available colors change (only if not restored from cache)
  useEffect(() => {
    if (availableColors.length === 0) {
      // If no colors available, reset
      if (sliders.length > 0) {
        setSliders([]);
        setCmyAdded(false);
        setBwAdded(false);
        slidersInitializedRef.current = false;
      }
      return;
    }
    
    // Build a signature from available colors
    const newColorSignature = availableColors.slice(0, 19).map(c => c.id).sort().join(',');
    
    // If we have cached sliders, check if the base palette colors have changed
    if (slidersInitializedRef.current && sliders.length > 0) {
      // Get only the palette color IDs (not CMY/BW additions)
      const currentPaletteIds = sliders
        .filter(s => !s.id.startsWith('cmy-') && !s.id.startsWith('bw-'))
        .map(s => s.id)
        .sort()
        .join(',');
      
      // If palette colors haven't changed, keep current state
      if (currentPaletteIds === newColorSignature || prevAvailableColorsRef.current === newColorSignature) {
        knobSizes.current = new Array(sliders.length).fill(BASE_KNOB_RADIUS);
        prevAvailableColorsRef.current = newColorSignature;
        return;
      }
    }
    
    // Colors have changed - reinitialize
    prevAvailableColorsRef.current = newColorSignature;
    
    const numColors = Math.min(availableColors.length, 19); // Max 19 like RadialMixer
    const step = (2 * Math.PI) / numColors;
    
    const initialSliders: SliderState[] = availableColors.slice(0, numColors).map((color, i) => ({
      id: color.id,
      color: color.hex,
      angle: i * step,
      position: 0.0, // All at outer edge (0% weight)
      weight: 0.0,
      scale: 1.0
    }));
    
    setSliders(initialSliders);
    setCmyAdded(false);
    setBwAdded(false);
    knobSizes.current = new Array(numColors).fill(BASE_KNOB_RADIUS);
    slidersInitializedRef.current = true;
  }, [availableColors]);
  
  // Update cache when state changes (防抖 250ms，避免滑块拖拽时高频触发整个应用大树重新渲染)
  useEffect(() => {
    if (!onCacheUpdate || !slidersInitializedRef.current) return;
    if (cacheTimerRef.current) clearTimeout(cacheTimerRef.current);
    cacheTimerRef.current = setTimeout(() => {
      onCacheUpdate({
        sliders,
        cmyAdded,
        bwAdded,
        targetVolume
      });
    }, 250);
    return () => {
      if (cacheTimerRef.current) clearTimeout(cacheTimerRef.current);
    };
  }, [sliders, cmyAdded, bwAdded, targetVolume, onCacheUpdate]);
  
  // Helper: Adjust color brightness
  const shadeColor = (color: string, percent: number): string => {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, Math.min(255, (num >> 16) + amt));
    const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amt));
    const B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1).toUpperCase();
  };
  
  // Helper: Draw Mosaic Pattern
  const drawMosaic = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number) => {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    
    // 渐变背景
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, '#f8fafc');
    gradient.addColorStop(1, '#e2e8f0');
    ctx.fillStyle = gradient;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    
    // 精致的棋盘格图案
    const size = 8; // 更小的格子
    const cornerRadius = 1.5;
    const colors = ['#cbd5e1', '#94a3b8'];
    
    for (let i = x - r; i < x + r; i += size) {
      for (let j = y - r; j < y + r; j += size) {
        const dx = i + size/2 - x;
        const dy = j + size/2 - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < r - size/2) {
          const gridX = Math.floor(i / size);
          const gridY = Math.floor(j / size);
          
          if ((gridX + gridY) % 2 === 0) {
            // 根据距离中心的远近调整透明度
            const alpha = 0.3 + (1 - dist / r) * 0.4;
            const colorIndex = Math.floor(dist / (r / 2)) % colors.length;
            ctx.fillStyle = colors[colorIndex] + Math.round(alpha * 255).toString(16).padStart(2, '0');
            
            // 绘制圆角矩形
            ctx.beginPath();
            ctx.roundRect(i, j, size - 1, size - 1, cornerRadius);
            ctx.fill();
          }
        }
      }
    }
    ctx.restore();
  };
  
  // Main Draw Function (like RadialMixer)
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // 支持高DPI屏幕
    const dpr = window.devicePixelRatio || 1;
    // 使用响应式缩放后的实际显示尺寸
    const displayWidth = canvasSize.width;
    const displayHeight = canvasSize.height;
    
    // 设置Canvas实际像素尺寸(高DPI)
    if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
      canvas.width = displayWidth * dpr;
      canvas.height = displayHeight * dpr;
      // CSS显示尺寸与canvas内部尺寸匹配
      canvas.style.width = displayWidth + 'px';
      canvas.style.height = displayHeight + 'px';
    }
    
    // 每次绘制前都重置变换并应用缩放
    // 需要同时应用DPI缩放和响应式缩放,以便在逻辑坐标系(450×450)上绘制
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr * canvasSize.scale, dpr * canvasSize.scale);
    
    // Clear canvas
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    
    const numSliders = sliders.length;
    if (numSliders === 0) return;
    
    // 1. Draw Rails (simple gray lines like RadialMixer)
    sliders.forEach((slider) => {
      const innerX = CENTER_X + Math.sin(slider.angle) * INNER_RADIUS;
      const innerY = CENTER_Y + Math.cos(slider.angle) * INNER_RADIUS;
      const outerX = CENTER_X + Math.sin(slider.angle) * OUTER_RADIUS;
      const outerY = CENTER_Y + Math.cos(slider.angle) * OUTER_RADIUS;
      
      ctx.beginPath();
      ctx.moveTo(innerX, innerY);
      ctx.lineTo(outerX, outerY);
      ctx.strokeStyle = '#e2e8f0'; // slate-200
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.stroke();
    });
    
    // 2. Draw Knobs
    sliders.forEach((slider, i) => {
      const t = slider.position;
      const angle = slider.angle;
      const sinA = Math.sin(angle);
      const cosA = Math.cos(angle);
      
      const outerX = CENTER_X + sinA * OUTER_RADIUS;
      const outerY = CENTER_Y + cosA * OUTER_RADIUS;
      
      // Position: 0% at Outer, 100% at Inner
      const kx = outerX - sinA * t * (OUTER_RADIUS - INNER_RADIUS);
      const ky = outerY - cosA * t * (OUTER_RADIUS - INNER_RADIUS);
      const currentRadius = knobSizes.current[i] || BASE_KNOB_RADIUS;
      
      // Draw Knob Shadow
      ctx.beginPath();
      ctx.arc(kx, ky + 4, currentRadius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      ctx.fill();
      
      // Draw Knob Body
      ctx.beginPath();
      ctx.arc(kx, ky, currentRadius, 0, Math.PI * 2);
      ctx.fillStyle = slider.color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.stroke();
    });
    
    // 3. Draw Center Circle Shadow
    ctx.beginPath();
    ctx.arc(CENTER_X, CENTER_Y + 5, CENTER_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fill();
    
    // 4. Draw Center (Mixed Result or Mosaic)
    if (mixedColor === '') {
      drawMosaic(ctx, CENTER_X, CENTER_Y, CENTER_RADIUS);
      
      ctx.beginPath();
      ctx.arc(CENTER_X, CENTER_Y, CENTER_RADIUS, 0, Math.PI * 2);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(CENTER_X, CENTER_Y, CENTER_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = mixedColor;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 4;
      ctx.stroke();
    }
    
    // 5. Target Inner Circle
    if (targetColor) {
      ctx.beginPath();
      ctx.arc(CENTER_X, CENTER_Y, CENTER_RADIUS * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = targetColor.hex;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    
    // 6. Draw Data Labels (最后绘制，确保在最上层)
    sliders.forEach((slider, i) => {
      const t = slider.position;
      
      // Draw Info Label if Active
      if (t > 0 || draggingIndex === i) {
        const angle = slider.angle;
        const sinA = Math.sin(angle);
        const cosA = Math.cos(angle);
        
        const outerX = CENTER_X + sinA * OUTER_RADIUS;
        const outerY = CENTER_Y + cosA * OUTER_RADIUS;
        
        const kx = outerX - sinA * t * (OUTER_RADIUS - INNER_RADIUS);
        const ky = outerY - cosA * t * (OUTER_RADIUS - INNER_RADIUS);
        
        const pct = Math.round(t * 100);
        const totalW = sliders.reduce((sum, s) => sum + s.weight, 0);
        const ml = totalW > 0 ? ((slider.weight / totalW) * targetVolume).toFixed(1) : '0.0';
        
        ctx.save();
        ctx.font = 'bold 12px "JetBrains Mono", monospace';
        ctx.fillStyle = '#475569';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // 智能定位：滑块靠外(t < 0.35)向内偏移(-38)，靠内(t >= 0.35)向外偏移(+38)，
        // 无论滑块在哪个位置，标签绝不超出 450x450 画布边缘，也绝不遮挡中心混合色
        const textDist = t < 0.35 ? -38 : 38;
        const tx = kx + sinA * textDist;
        const ty = ky + cosA * textDist;
        
        // Background label
        const metrics = ctx.measureText(`${ml}ml`);
        const w = Math.max(metrics.width, 38) + 10;
        const h = 28;
        
        // 绘制阴影
        ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 2;
        
        ctx.beginPath();
        ctx.roundRect(tx - w/2, ty - h/2, w, h, 6);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
        ctx.fill();
        
        // 清除阴影设置以免影响文字
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        
        ctx.fillStyle = '#0f172a';
        ctx.fillText(`${ml}ml`, tx, ty - 5);
        
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillStyle = '#64748b';
        ctx.fillText(`${pct}%`, tx, ty + 6);
        
        ctx.restore();
      }
    });
  };
  
  // Animation Loop (like RadialMixer, only active in radial mode for optimal performance)
  useEffect(() => {
    if (viewMode !== 'radial') return;
    const loop = () => {
      draw();
      requestRef.current = requestAnimationFrame(loop);
    };
    requestRef.current = requestAnimationFrame(loop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [sliders, mixedColor, targetColor, draggingIndex, knobSizes, viewMode]);

  // Window listeners for dragging so if cursor leaves canvas it doesn't get stuck
  useEffect(() => {
    if (draggingIndex === -1) return;

    const onWindowMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left) * (WIDTH / rect.width);
      const mouseY = (e.clientY - rect.top) * (HEIGHT / rect.height);
      const slider = sliders[draggingIndex];
      if (!slider) return;
      const t = getProjectionT(mouseX, mouseY, slider.angle);
      setSliders((prev) => {
        const updated = [...prev];
        const totalWeight = prev.reduce((sum, s, i) => sum + (i === draggingIndex ? t : s.position), 0);
        const normalizedWeight = totalWeight > 0 ? t / totalWeight : 0;
        updated[draggingIndex] = {
          ...updated[draggingIndex],
          position: t,
          weight: normalizedWeight,
        };
        const newTotal = updated.reduce((sum, s) => sum + s.position, 0);
        if (newTotal > 0) {
          updated.forEach((s) => {
            s.weight = s.position / newTotal;
          });
        }
        return updated;
      });
    };

    const onWindowMouseUp = () => {
      handleMouseUp();
    };

    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
    };
  }, [draggingIndex, sliders]);
  
  // Helper: Draw mosaic/checkerboard pattern
  const drawMosaicPattern = (ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number) => {
    ctx.save();
    
    // Clip to circle
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.clip();
    
    // Draw checkerboard
    const squareSize = 15;
    for (let x = cx - radius; x < cx + radius; x += squareSize) {
      for (let y = cy - radius; y < cy + radius; y += squareSize) {
        const isEven = (Math.floor(x / squareSize) + Math.floor(y / squareSize)) % 2 === 0;
        ctx.fillStyle = isEven ? '#E0E0E0' : '#FFFFFF';
        ctx.fillRect(x, y, squareSize, squareSize);
      }
    }
    
    ctx.restore();
    
    // Border
    ctx.strokeStyle = '#999999';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.stroke();
  };
  
  // Mouse event handlers with smooth animation
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (WIDTH / rect.width);
    const mouseY = (e.clientY - rect.top) * (HEIGHT / rect.height);
    
    // Check if clicking on any slider (寻找最近的滑块)
    let closestIndex = -1;
    let closestDist = Infinity;
    const HIT_RADIUS = 55;

    for (let i = 0; i < sliders.length; i++) {
      const slider = sliders[i];
      const t = slider.position;
      const angle = slider.angle;
      const sinA = Math.sin(angle);
      const cosA = Math.cos(angle);
      
      const outerX = CENTER_X + sinA * OUTER_RADIUS;
      const outerY = CENTER_Y + cosA * OUTER_RADIUS;
      
      const kx = outerX - sinA * t * (OUTER_RADIUS - INNER_RADIUS);
      const ky = outerY - cosA * t * (OUTER_RADIUS - INNER_RADIUS);
      
      const dist = Math.sqrt(Math.pow(mouseX - kx, 2) + Math.pow(mouseY - ky, 2));
      
      if (dist < HIT_RADIUS && dist < closestDist) {
        closestDist = dist;
        closestIndex = i;
      }
    }

    if (closestIndex !== -1) {
      setDraggingIndex(closestIndex);
      
      // Animate slider scale up with bounce
      if (typeof anime !== 'undefined') {
        anime({
          targets: { radius: knobSizes.current[closestIndex] },
          radius: ACTIVE_KNOB_RADIUS,
          duration: 400,
          easing: 'easeOutElastic(1, .6)',
          update: (anim: any) => {
            knobSizes.current[closestIndex] = anim.animatables[0].target.radius;
          }
        });
      }
    }
  };
  
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (WIDTH / rect.width);
    const mouseY = (e.clientY - rect.top) * (HEIGHT / rect.height);
    
    // Update hover state (direct calculation)
    if (draggingIndex === -1) {
      let foundHover = -1;
      for (let i = 0; i < sliders.length; i++) {
        const slider = sliders[i];
        const t = slider.position;
        const angle = slider.angle;
        const sinA = Math.sin(angle);
        const cosA = Math.cos(angle);
        
        const outerX = CENTER_X + sinA * OUTER_RADIUS;
        const outerY = CENTER_Y + cosA * OUTER_RADIUS;
        
        const kx = outerX - sinA * t * (OUTER_RADIUS - INNER_RADIUS);
        const ky = outerY - cosA * t * (OUTER_RADIUS - INNER_RADIUS);
        const currentRadius = knobSizes.current[i] || BASE_KNOB_RADIUS;
        
        const dist = Math.sqrt(Math.pow(mouseX - kx, 2) + Math.pow(mouseY - ky, 2));
        
        if (dist <= currentRadius + 10) {
          foundHover = i;
          break;
        }
      }
      
      if (foundHover !== hoverIndex) {
        setHoverIndex(foundHover);
        
        // Subtle scale animation on hover
        if (foundHover !== -1 && typeof anime !== 'undefined') {
          const slider = sliders[foundHover];
          anime({
            targets: slider,
            scale: (1.0 + slider.weight * 0.3) * 1.1,
            duration: 200,
            easing: 'easeOutQuad',
            update: () => {
              setSliders([...sliders]);
            }
          });
        }
        
        // Reset previous hover
        if (hoverIndex !== -1 && hoverIndex !== foundHover && typeof anime !== 'undefined') {
          const prevSlider = sliders[hoverIndex];
          anime({
            targets: prevSlider,
            scale: 1.0 + prevSlider.weight * 0.3,
            duration: 200,
            easing: 'easeOutQuad',
            update: () => {
              setSliders([...sliders]);
            }
          });
        }
      }
      return;
    }
    
    // Calculate position along the radial line (reversed: 0=outer, 1=inner)
    const slider = sliders[draggingIndex];
    const t = getProjectionT(mouseX, mouseY, slider.angle);
    
    // Update slider immediately with smooth size transition
    setSliders(prev => {
      const updated = [...prev];
      const totalWeight = prev.reduce((sum, s, i) => sum + (i === draggingIndex ? t : s.position), 0);
      
      // Normalize weights so they sum to 1.0
      const normalizedWeight = totalWeight > 0 ? t / totalWeight : 0;
      
      updated[draggingIndex] = {
        ...updated[draggingIndex],
        position: t,
        weight: normalizedWeight
      };
      
      // Recalculate all weights
      const newTotal = updated.reduce((sum, s) => sum + s.position, 0);
      if (newTotal > 0) {
        updated.forEach((s, idx) => {
          s.weight = s.position / newTotal;
          
          // Animate size change for non-dragging sliders
          if (idx !== draggingIndex && typeof anime !== 'undefined') {
            anime({
              targets: s,
              scale: 1.0 + s.weight * 0.3, // Subtle size increase based on weight
              duration: 300,
              easing: 'easeOutQuad'
            });
          }
        });
      }
      
      return updated;
    });
  };
  
  const handleMouseUp = () => {
    if (draggingIndex !== -1) {
      // Animate knob scale down (like RadialMixer)
      if (typeof anime !== 'undefined') {
        anime({
          targets: { radius: knobSizes.current[draggingIndex] },
          radius: BASE_KNOB_RADIUS,
          duration: 300,
          easing: 'easeOutQuad',
          update: (anim: any) => {
            knobSizes.current[draggingIndex] = anim.animatables[0].target.radius;
          }
        });
      }
    }
    setDraggingIndex(-1);
  };
  
  const handleMouseLeave = () => {
    setHoverIndex(-1);
    if (draggingIndex !== -1) {
      handleMouseUp();
    }
  };
  
  // Helper: Project mouse position onto radial line and get t (0 to 1, reversed)
  const getProjectionT = (mx: number, my: number, angle: number): number => {
    // Line from outer to inner (reversed)
    const x0 = CENTER_X + Math.sin(angle) * OUTER_RADIUS;
    const y0 = CENTER_Y + Math.cos(angle) * OUTER_RADIUS;
    const x1 = CENTER_X + Math.sin(angle) * INNER_RADIUS;
    const y1 = CENTER_Y + Math.cos(angle) * INNER_RADIUS;
    
    // Vector from outer to inner
    const ux = x1 - x0;
    const uy = y1 - y0;
    
    // Vector from outer to mouse
    const vx = mx - x0;
    const vy = my - y0;
    
    // Project
    const uLen = Math.sqrt(ux * ux + uy * uy);
    const dot = ux * vx + uy * vy;
    const t = dot / (uLen * uLen);
    
    return Math.max(0.0, Math.min(1.0, t));
  };
  
  // Reset all sliders with staggered animation
  const handleReset = () => {
    if (typeof anime !== 'undefined' && sliders.length > 0) {
      // Animate all sliders back to outer edge with stagger
      anime({
        targets: sliders,
        position: 0.0,
        weight: 0.0,
        scale: 1.0,
        duration: 1200,
        easing: 'easeOutElastic(1, .8)',
        delay: anime.stagger(80, { from: 'center' }), // Stagger from center outward
        update: () => {
          setSliders([...sliders]);
        },
        complete: () => {
          // Ensure all values are exactly 0 after animation
          setSliders(prev => prev.map(s => ({
            ...s,
            position: 0.0,
            weight: 0.0,
            scale: 1.0
          })));
        }
      });
    } else {
      setSliders(prev => prev.map(s => ({
        ...s,
        position: 0.0,
        weight: 0.0,
        scale: 1.0
      })));
    }
  };
  
  // Calculate volume for each color based on target volume
  const calculateVolumes = (): { color: string; hex: string; percentage: number; volume: number }[] => {
    return sliders
      .filter(s => s.weight > 0.0001)
      .map(s => ({
        color: availableColors.find(c => c.id === s.id)?.hex || s.color,
        hex: s.color,
        percentage: s.weight * 100,
        volume: s.weight * targetVolume
      }))
      .sort((a, b) => b.percentage - a.percentage);
  };
  
  const volumes = calculateVolumes();
  const dropCounts = toDropRatio(volumes.map(vol => vol.volume || vol.percentage));
  const dropParts = volumes.map((vol, index) => ({
    color: vol.hex,
    name: availableColors.find(color => color.hex.toUpperCase() === vol.hex.toUpperCase())?.hex.replace('#', '') ?? vol.hex.replace('#', ''),
    drops: dropCounts[index] ?? 0,
  }));
  
  return (
    <div className="w-full max-w-full h-full flex flex-col items-center justify-start px-1 sm:px-3 py-2 space-y-3 overflow-x-hidden overflow-y-auto">
      {/* Hidden native color picker input */}
      <input
        ref={colorInputRef}
        type="color"
        value={pickerColor}
        onChange={(e) => {
          setPickerColor(e.target.value);
          handleAddCustomColor(e.target.value);
        }}
        className="sr-only"
        aria-label="拾色器"
      />

      {/* Top Header with Title and Mode Switcher */}
      <div className="flex items-center justify-between gap-2 flex-wrap w-full pb-2 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
            <PaletteIcon className="w-5 h-5 text-amber-500 shrink-0" />
            <span>{lang === 'zh' ? '自选调色盘' : lang === 'ja' ? 'カスタム調色盤' : 'Custom Color Mixer'}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {lang === 'zh'
              ? '参考 iOS 色板调节模式，自由拾色并滑动配比'
              : lang === 'ja'
              ? 'iOSスタイルのスライダーで自由調色'
              : 'iOS-style custom palette slider mixer'}
          </p>
        </div>

        {/* View Mode Toggle: [ 色板模式 ] / [ 轮盘模式 ] */}
        <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200/60 dark:border-slate-700 text-xs shadow-xs">
          <button
            type="button"
            onClick={() => setViewMode('ios')}
            className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
              viewMode === 'ios'
                ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <SlidersHorizontalIcon className="w-3.5 h-3.5" />
            <span>{lang === 'zh' ? '色板模式' : lang === 'ja' ? 'スライダー' : 'Sliders'}</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('radial')}
            className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
              viewMode === 'radial'
                ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <CircleNotchIcon className="w-3.5 h-3.5" />
            <span>{lang === 'zh' ? '轮盘模式' : lang === 'ja' ? 'ホイール' : 'Wheel'}</span>
          </button>
        </div>
      </div>

      {viewMode === 'ios' ? (
        /* ==================== iOS 色板调节模式 (Matching raw_04) ==================== */
        <div className="flex flex-col gap-3.5 w-full">
          {/* 1. 混合结果卡片 */}
          <div className="bg-slate-50/80 dark:bg-slate-800/60 rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
            <div className="flex items-center justify-between mb-2.5">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <FlaskIcon className="w-4 h-4 text-purple-500" />
                <span>{lang === 'zh' ? '混合结果' : lang === 'ja' ? 'ミックス結果' : 'Mixed Result'}</span>
              </div>
              <div className="flex items-center gap-2">
                {sliders.length > 0 && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                  >
                    {lang === 'zh' ? '归零' : lang === 'ja' ? 'ゼロ' : 'Zero'}
                  </button>
                )}
                {sliders.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="text-xs text-rose-500 hover:text-rose-700 transition-colors"
                  >
                    {lang === 'zh' ? '清空' : lang === 'ja' ? 'クリア' : 'Clear'}
                  </button>
                )}
              </div>
            </div>

            {mixedColor ? (
              <div className="space-y-3">
                {/* 大色块展示 - 移除延时 transition 保证拖拽零延迟响应 */}
                <div
                  className="w-full h-24 sm:h-28 rounded-2xl relative shadow-inner border border-black/10 dark:border-white/10 overflow-hidden"
                  style={{ backgroundColor: mixedColor }}
                >
                  {/* 可复制 Hex 标签 */}
                  <div className="absolute bottom-2.5 left-2.5">
                    <button
                      type="button"
                      onClick={() => handleCopyHex(mixedColor)}
                      className="bg-white/85 dark:bg-black/70 backdrop-blur-md px-3 py-1 rounded-full text-xs font-mono font-bold text-slate-800 dark:text-slate-100 border border-black/10 dark:border-white/15 shadow-sm hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5"
                      title="点击复制 Hex 色号"
                    >
                      <span>{mixedColor.toUpperCase()}</span>
                      <span className="text-[10px] text-slate-400">
                        {copiedHex ? (
                          <span className="inline-flex items-center gap-0.5 text-emerald-500">
                            <CheckIcon className="w-3 h-3" />已复制
                          </span>
                        ) : (
                          <ClipboardTextIcon className="w-3.5 h-3.5 inline-block" />
                        )}
                      </span>
                    </button>
                  </div>
                </div>

                {/* RAL 近似色与目标色对比 */}
                <div className="flex flex-col gap-1.5 pt-1 px-1 border-t border-slate-200/60 dark:border-slate-700/60">
                  {ralMatch && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">
                        {lang === 'zh' ? 'RAL 近似色' : lang === 'ja' ? 'RAL 近似色' : 'RAL Match'}
                      </span>
                      <div className="text-right">
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          RAL {ralMatch.ral} {ralMatch.name}
                        </div>
                        <div className="font-mono text-[10px] text-slate-400">
                          {ralMatch.hex.toUpperCase()} · LRV {ralMatch.lrv}
                        </div>
                      </div>
                    </div>
                  )}

                  {targetColor && (
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-slate-700/40">
                      <span className="text-slate-400 font-medium">
                        {lang === 'zh' ? '比对目标' : lang === 'ja' ? '目標色' : 'Target'}:
                      </span>
                      <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                        <span
                          className="w-3 h-3 rounded-full border border-black/15 shadow-sm"
                          style={{ backgroundColor: targetColor.hex }}
                        />
                        <span>{targetColor.hex}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="w-full h-24 sm:h-28 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-1.5 text-slate-400">
                <PaletteIcon className="w-8 h-8 opacity-60 text-slate-400" />
                <span className="text-xs">
                  {sliders.length === 0
                    ? lang === 'zh'
                      ? '点击下方「＋ 添加」或「+ CMY」添加颜色'
                      : 'Add colors below to start'
                    : lang === 'zh'
                    ? '拖动滑块设置各色用量开始混色'
                    : 'Adjust sliders to mix'}
                </span>
              </div>
            )}
          </div>

          {/* 2. 自选颜色卡片 (Matching raw_04 action bar & slider rows) */}
          <div className="bg-slate-50/80 dark:bg-slate-800/60 rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-3">
            {/* 标题与拾色工具栏 */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <PaletteIcon className="w-4 h-4 text-amber-500" />
                <span>{lang === 'zh' ? '自选颜色' : lang === 'ja' ? '選択色' : 'Custom Colors'}</span>
              </div>

              {/* 拾色与添加按钮 */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => colorInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all text-xs font-medium text-slate-700 dark:text-slate-200 shadow-sm active:scale-95"
                >
                  <EyedropperIcon className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400 flex-shrink-0" weight="bold" />
                  <span>{lang === 'zh' ? '拾色' : lang === 'ja' ? '色選択' : 'Pick'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => colorInputRef.current?.click()}
                  className="flex items-center gap-1 px-3.5 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-xs shadow-sm hover:brightness-105 active:scale-95 transition-all"
                >
                  <PlusIcon className="w-3.5 h-3.5" weight="bold" />
                  <span>{lang === 'zh' ? '添加' : lang === 'ja' ? '追加' : 'Add'}</span>
                </button>
              </div>
            </div>

            {/* 预设快捷添加按钮 (CMY 三原色 / 黑白) */}
            <div className="flex items-center gap-2 flex-wrap py-1 my-0.5">
              <button
                type="button"
                onClick={handleAddCMY}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all flex items-center gap-1 active:scale-95 shadow-xs"
              >
                <PlusIcon className="w-3.5 h-3.5" weight="bold" />
                <span>{lang === 'zh' ? 'CMY 三原色' : lang === 'ja' ? 'CMY 三原色' : 'CMY Primaries'}</span>
              </button>

              <button
                type="button"
                onClick={handleAddBW}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all flex items-center gap-1 active:scale-95 shadow-xs"
              >
                <PlusIcon className="w-3.5 h-3.5" weight="bold" />
                <span>{lang === 'zh' ? '黑白' : lang === 'ja' ? '白黒' : 'Black & White'}</span>
              </button>

              {/* 从图片取色点快捷添加 */}
              {availableColors && availableColors.length > 0 && (
                <div className="flex items-center gap-1.5 ml-auto overflow-x-auto no-scrollbar py-1">
                  <span className="text-[10px] text-slate-400 whitespace-nowrap">
                    {lang === 'zh' ? '取色点:' : 'Extracted:'}
                  </span>
                  {availableColors.slice(0, 6).map((c) => {
                    const exists = sliders.some((s) => s.color.toUpperCase() === c.hex.toUpperCase());
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleAddCustomColor(c.hex)}
                        disabled={exists}
                        className={`w-5 h-5 rounded-full border border-black/15 shadow-sm flex items-center justify-center transition-all ${
                          exists ? 'opacity-40 cursor-default' : 'hover:scale-110 active:scale-95'
                        }`}
                        style={{ backgroundColor: c.hex }}
                        title={exists ? '已添加' : `点击添加 ${c.hex}`}
                      >
                        {!exists && <PlusIcon className="w-2.5 h-2.5 text-white" weight="bold" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 颜色列表 */}
            {sliders.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-700/60 pt-1">
                {sliders.map((s, index) => {
                  const info = getPaintDisplayName(s.color);
                  return (
                    <IOSColorSlider
                      key={s.id}
                      color={s.color}
                      label={info.primary || info.name}
                      subLabel={info.sub || s.color}
                      value={Math.round((s.weight ?? 0) * 100)}
                      onChange={(val) => handleSliderWeightChange(index, val)}
                      onRemove={() => handleRemoveSlider(s.id)}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">
                {lang === 'zh'
                  ? '已选颜色会出现在这里。可点击「+ CMY 三原色」或使用上方拾色器添加颜色。'
                  : lang === 'ja'
                  ? '選択した色がここに表示されます。「+ CMY」または上の色選択から追加してください。'
                  : 'Selected colors will appear here. Tap + CMY or use the picker to add colors.'}
              </div>
            )}
          </div>

          {/* 3. 混合配方卡片 */}
          <div className="bg-slate-50/80 dark:bg-slate-800/60 rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <ClipboardTextIcon className="w-4 h-4 text-indigo-500" />
                  <span>{lang === 'zh' ? '混合配方' : lang === 'ja' ? '配合比' : 'Mixing Recipe'}</span>
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  {targetVolume} ml
                </div>
              </div>

              {/* 快速容量预设 - iOS/Konsta Segmented Pill Bar */}
              <div className="p-1 bg-slate-200/60 dark:bg-slate-800/80 rounded-2xl flex items-center gap-1 shadow-inner overflow-x-auto no-scrollbar">
                {volumePresets.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setTargetVolume(v)}
                    className={`min-h-[38px] px-3 py-1 rounded-xl text-xs font-mono font-bold transition-all duration-150 active:scale-[0.95] flex items-center justify-center flex-1 shrink-0 cursor-pointer ${
                      targetVolume === v
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-orange-500/25 ring-1 ring-white/20'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    {v}ml
                  </button>
                ))}
              </div>
            </div>

            {/* 容量输入 */}
            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
              <label className="text-slate-500 dark:text-slate-400 font-medium">
                {lang === 'zh' ? '目标总量' : lang === 'ja' ? '目標量' : 'Target Volume'}:
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={targetVolume}
                  onChange={(e) => setTargetVolume(Math.max(1, parseInt(e.target.value) || 20))}
                  className="w-16 px-2.5 py-1 text-xs text-right font-mono font-bold border border-slate-300/80 dark:border-slate-600/80 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-amber-500/30 outline-none"
                  min="1"
                  max="100"
                />
                <span className="text-xs text-slate-500">ml</span>
              </div>
            </div>

            {/* 比例与详细明细 */}
            {volumes.length > 0 && mixedColor ? (
              <div className="space-y-2 pt-1">
                <DropRatioBar
                  parts={dropParts}
                  lang={lang}
                  multiplier={dropMultiplier}
                  onMultiplierChange={setDropMultiplier}
                />
                <div className="space-y-1 pt-1">
                  {volumes.map((vol, index) => {
                    const info = getPaintDisplayName(vol.hex);
                    return (
                      <div
                        key={index}
                        className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-white/70 dark:bg-slate-800/80 border border-slate-200/50 dark:border-slate-700/50"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full border border-black/15 shadow-sm"
                            style={{ backgroundColor: vol.hex }}
                          />
                          <span className="font-medium text-slate-700 dark:text-slate-200">
                            {info.name}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">{vol.hex}</span>
                        </div>
                        <div className="flex items-center gap-2 font-mono">
                          {dropCounts[index] ? (
                            <span className="font-bold text-amber-600 dark:text-amber-400 text-[11px]">
                              {dropCounts[index] * dropMultiplier}
                              {t.dropUnit} ·{' '}
                            </span>
                          ) : null}
                          <span className="font-bold text-slate-800 dark:text-slate-100">
                            {vol.volume.toFixed(1)}ml
                          </span>
                          <span className="text-slate-400 text-[10px]">
                            ({vol.percentage.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2">
                  <BrandMatchPanel
                    hex={mixedColor}
                    lang={lang}
                    compact
                    assignedId={targetColor?.assignedPaint?.id}
                    hasSamplePoint={
                      typeof targetColor?.sampleX === 'number' &&
                      typeof targetColor?.sampleY === 'number'
                    }
                    onAssignCatalog={onAssignCatalogPaint}
                  />
                </div>
              </div>
            ) : (
              <div className="py-4 text-center text-xs text-slate-400 dark:text-slate-500">
                {lang === 'zh' ? '暂无混合配方' : 'No active formula'}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ==================== 经典 Canvas 轮盘模式 ==================== */
        <div className="flex flex-col gap-3">
          {/* 轮盘模式提示标头 */}
          <div className="text-center my-0.5">
            <h3 className="text-sm font-bold text-sky-600 dark:text-sky-400 mb-0.5">
              {lang === 'zh' ? '径向调色轮盘' : lang === 'ja' ? 'ラジアルミキサー' : 'Radial Mixer'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {lang === 'zh' 
                ? '从外向内拖动滑块增加混合比例 · 使用 Mixbox 物理混色引擎' 
                : lang === 'ja'
                ? '外から内にドラッグして混合比率を増やす · Mixbox 物理ベース'
                : 'Drag sliders from outer to inner to increase mixing ratio · Physical Mixbox'
              }
            </p>
            {targetColor && (
              <p className="text-xs text-rose-500 dark:text-rose-400 mt-0.5 flex items-center justify-center gap-1">
                <TargetIcon className="w-3.5 h-3.5 text-rose-500" />
                <span>{lang === 'zh' ? '目标: ' : lang === 'ja' ? 'ターゲット: ' : 'Target: '}</span>
                <span className="font-mono font-bold">{targetColor.hex}</span>
              </p>
            )}
          </div>

          {/* Readout Panel */}
          <div className="w-full flex flex-wrap items-center justify-between gap-2 p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-bold text-slate-400 uppercase">
                  {lang === 'zh' ? '混合结果' : lang === 'ja' ? 'ミックス結果' : 'Mixed Result'}
                </span>
                <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                  {mixedColor === ''
                    ? lang === 'zh'
                      ? '透明'
                      : lang === 'ja'
                      ? '透明'
                      : 'TRANSPARENT'
                    : mixedColor}
                </span>
              </div>
              <div
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg border-2 border-slate-100 dark:border-slate-600 shadow-inner flex-shrink-0"
                style={{
                  backgroundColor: mixedColor || 'transparent',
                  backgroundImage:
                    mixedColor === ''
                      ? 'repeating-conic-gradient(#E0E0E0 0% 25%, #FFFFFF 0% 50%)'
                      : 'none',
                  backgroundSize: '15px 15px',
                }}
              />
            </div>

            <div className="hidden sm:block w-px h-8 bg-slate-200 dark:bg-slate-700" />

            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg border-2 border-slate-100 dark:border-slate-600 shadow-inner flex-shrink-0"
                style={{ backgroundColor: targetColor?.hex || 'transparent' }}
              />
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-slate-400 uppercase">
                  {lang === 'zh' ? '目标颜色' : lang === 'ja' ? 'ターゲット' : 'Target Color'}
                </span>
                <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                  {targetColor?.hex || (lang === 'zh' ? '无' : lang === 'ja' ? 'なし' : 'NONE')}
                </span>
              </div>
            </div>

            <div className="hidden sm:block w-px h-8 bg-slate-200 dark:bg-slate-700" />

            <div className="flex items-center gap-2">
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-slate-400 uppercase">
                  {lang === 'zh' ? '目标总量' : lang === 'ja' ? '目標量' : 'Target Vol'}
                </span>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={targetVolume}
                  onChange={(e) => setTargetVolume(Math.max(1, parseInt(e.target.value) || 20))}
                  className="w-14 sm:w-16 px-1.5 py-0.5 text-center font-mono text-xs font-bold border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                />
              </div>
              <button
                onClick={handleReset}
                className="px-2.5 py-1 bg-macaron-blue hover:bg-blue-600 text-white rounded-md text-xs font-medium transition-colors shadow-sm flex items-center gap-1"
              >
                <ArrowCounterClockwiseIcon className="w-3.5 h-3.5" />
                <span>{lang === 'zh' ? '重置' : lang === 'ja' ? 'リセット' : 'Reset'}</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleAddCMY}
                disabled={cmyAdded}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all shadow-sm flex items-center gap-1 ${
                  cmyAdded
                    ? 'bg-green-500 text-white cursor-default'
                    : 'bg-purple-500 text-white hover:bg-purple-600 active:scale-95'
                }`}
              >
                {cmyAdded ? (
                  <>
                    <CheckIcon className="w-3.5 h-3.5" weight="bold" />
                    <span>{t.cmyColorsAdded}</span>
                  </>
                ) : (
                  <>
                    <PlusIcon className="w-3.5 h-3.5" weight="bold" />
                    <span>{t.addCmyColors}</span>
                  </>
                )}
              </button>

              <button
                onClick={handleAddBW}
                disabled={bwAdded}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all shadow-sm flex items-center gap-1 ${
                  bwAdded
                    ? 'bg-green-500 text-white cursor-default'
                    : 'bg-slate-600 hover:bg-slate-700 text-white active:scale-95'
                }`}
              >
                {bwAdded ? (
                  <>
                    <CheckIcon className="w-3.5 h-3.5" weight="bold" />
                    <span>{t.bwColorsAdded}</span>
                  </>
                ) : (
                  <>
                    <PlusIcon className="w-3.5 h-3.5" weight="bold" />
                    <span>{t.addBwColors}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Canvas */}
          <div 
            ref={canvasContainerRef}
            className="w-full max-w-[450px] flex items-center justify-center overflow-hidden my-1 select-none mx-auto"
            style={{ touchAction: 'none' }}
          >
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              onTouchStart={(e) => {
                if (e.touches.length > 0) {
                  const touch = e.touches[0];
                  const canvas = canvasRef.current;
                  if (!canvas) return;
                  
                  const rect = canvas.getBoundingClientRect();
                  const mouseX = (touch.clientX - rect.left) * (WIDTH / rect.width);
                  const mouseY = (touch.clientY - rect.top) * (HEIGHT / rect.height);
                  
                  // 检查是否点击在滑块上
                  let touchingSlider = false;
                  for (let i = 0; i < sliders.length; i++) {
                    const slider = sliders[i];
                    const t = slider.position;
                    const angle = slider.angle;
                    const sinA = Math.sin(angle);
                    const cosA = Math.cos(angle);
                    
                    const outerX = CENTER_X + sinA * OUTER_RADIUS;
                    const outerY = CENTER_Y + cosA * OUTER_RADIUS;
                    
                    const kx = outerX - sinA * t * (OUTER_RADIUS - INNER_RADIUS);
                    const ky = outerY - cosA * t * (OUTER_RADIUS - INNER_RADIUS);
                    
                    const dist = Math.sqrt(Math.pow(mouseX - kx, 2) + Math.pow(mouseY - ky, 2));
                    
                    if (dist < 50) {
                      touchingSlider = true;
                      break;
                    }
                  }
                  
                  if (touchingSlider && e.cancelable) {
                    e.preventDefault();
                  }
                  
                  handleMouseDown({ clientX: touch.clientX, clientY: touch.clientY } as any);
                }
              }}
              onTouchMove={(e) => {
                if (e.cancelable && draggingIndex !== -1) {
                  e.preventDefault();
                }
                const now = Date.now();
                if (now - lastMoveTimeRef.current < 16) return;
                lastMoveTimeRef.current = now;
                if (e.touches.length > 0) {
                  handleMouseMove({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY } as any);
                }
              }}
              onTouchEnd={handleMouseUp}
              className="rounded-xl cursor-crosshair shadow-sm"
              style={{
                touchAction: 'none',
                display: 'block',
                margin: '0 auto',
                width: `${canvasSize.width}px`,
                height: `${canvasSize.height}px`,
                maxWidth: '100%',
                aspectRatio: '1 / 1',
              }}
            />
          </div>

          {/* Recipe Display */}
          {volumes.length > 0 && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <h4 className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                <ChartBarIcon className="w-3.5 h-3.5 text-indigo-500" />
                <span>{lang === 'zh' ? '混合配方' : lang === 'ja' ? 'レシピ' : 'RECIPE'}</span>
              </h4>
              <DropRatioBar
                parts={dropParts}
                lang={lang}
                multiplier={dropMultiplier}
                onMultiplierChange={setDropMultiplier}
              />
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {volumes.map((vol, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-[10px] bg-white dark:bg-slate-700 p-1.5 rounded border border-slate-200 dark:border-slate-600"
                  >
                    <div className="flex items-center space-x-1.5">
                      <div
                        className="w-5 h-5 rounded border border-slate-300 dark:border-slate-500"
                        style={{ backgroundColor: vol.hex }}
                      />
                      <span className="font-mono text-slate-700 dark:text-slate-300">{vol.hex}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      {dropCounts[i] ? (
                        <span className="font-bold text-slate-700 dark:text-slate-200">
                          {dropCounts[i] * dropMultiplier}
                          {t.dropUnit}
                        </span>
                      ) : null}
                      <span className="font-bold text-macaron-blue dark:text-macaron-pink">
                        {vol.percentage.toFixed(1)}%
                      </span>
                      <span className="font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                        {vol.volume.toFixed(2)} ml
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {mixedColor && (
            <div className="mt-2 w-full">
              <BrandMatchPanel
                hex={mixedColor}
                lang={lang}
                compact
                assignedId={targetColor?.assignedPaint?.id}
                hasSamplePoint={
                  typeof targetColor?.sampleX === 'number' &&
                  typeof targetColor?.sampleY === 'number'
                }
                onAssignCatalog={onAssignCatalogPaint}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RadialPaletteMixer;
