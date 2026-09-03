import React, { useEffect, useRef, useState } from 'react';
import { CatalogPaint, ColorData, Language, RadialMixerCache, SliderState } from '../types';
import { hexToRgb, mixboxMultiBlend } from '../utils/colorUtils';
import { translations } from '../utils/translations';
import { toDropRatio } from '../utils/dropRatio';
import DropRatioBar from './DropRatioBar';
import BrandMatchPanel from './BrandMatchPanel';
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

// Canvas 基础常量
const BASE_WIDTH = 450;
const BASE_HEIGHT = 450;

// 计算响应式尺寸 - 纯粹基于可用宽度,不区分设备类型
const getCanvasSize = () => {
  // 根据视口宽度自动计算可用空间
  // 窄屏(如手机):留40px边距
  // 宽屏(如PC):使用基础宽度或留40px边距,取较小值
  const viewportWidth = window.innerWidth;
  const availableWidth = Math.min(viewportWidth - 40, BASE_WIDTH);
  const scale = availableWidth / BASE_WIDTH;
  return {
    width: BASE_WIDTH * scale,
    height: BASE_HEIGHT * scale,
    scale: scale
  };
};

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
  // Use cache values if available, otherwise use defaults
  const [sliders, setSliders] = useState<SliderState[]>(cache?.sliders ?? []);
  const [cmyAdded, setCmyAdded] = useState(cache?.cmyAdded ?? false);
  const [bwAdded, setBwAdded] = useState(cache?.bwAdded ?? false);
  const [draggingIndex, setDraggingIndex] = useState<number>(-1);
  const [hoverIndex, setHoverIndex] = useState<number>(-1);
  const [mixedColor, setMixedColor] = useState<string>('');
  const [targetVolume, setTargetVolume] = useState<number>(cache?.targetVolume ?? 20);
  const [canvasSize, setCanvasSize] = useState(getCanvasSize());
  const [dropMultiplier, setDropMultiplier] = useState(1);
  const knobSizes = useRef<number[]>(cache?.sliders ? new Array(cache.sliders.length).fill(20) : []); // For anime.js dynamic sizing
  const requestRef = useRef<number>(0); // For animation loop
  const animatingSliders = useRef<boolean>(false);
  const lastMoveTimeRef = useRef<number>(0); // 触控节流
  // Track if sliders were initialized from colors
  const slidersInitializedRef = useRef<boolean>(cache?.sliders && cache.sliders.length > 0 ? true : false);
  
  const t = translations[lang];
  
  // Canvas dimensions
  const WIDTH = BASE_WIDTH;
  const HEIGHT = BASE_HEIGHT;
  const CENTER_X = WIDTH / 2;
  const CENTER_Y = HEIGHT / 2;
  const OUTER_RADIUS = 200;
  const INNER_RADIUS = 65;
  const BASE_KNOB_RADIUS = 20;
  const ACTIVE_KNOB_RADIUS = 30;
  const CENTER_RADIUS = INNER_RADIUS - 5;
  
  // Initialize knobSizes if restored from cache
  useEffect(() => {
    if (sliders.length > 0 && knobSizes.current.length !== sliders.length) {
      knobSizes.current = new Array(sliders.length).fill(BASE_KNOB_RADIUS);
    }
  }, [sliders.length]);
  
  // 响应式调整画布尺寸
  useEffect(() => {
    const handleResize = () => {
      const newSize = getCanvasSize();
      setCanvasSize(newSize);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
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
    setMixedColor('');
    slidersInitializedRef.current = true;
  }, [availableColors]);
  
  // Update cache when state changes
  useEffect(() => {
    if (onCacheUpdate && slidersInitializedRef.current) {
      onCacheUpdate({
        sliders,
        cmyAdded,
        bwAdded,
        targetVolume
      });
    }
  }, [sliders, cmyAdded, bwAdded, targetVolume, onCacheUpdate]);
  
  // Calculate mixed color and volumes whenever sliders change
  useEffect(() => {
    const activeSliders = sliders.filter(s => s.weight > 0.0001);
    
    if (activeSliders.length === 0) {
      // Show mosaic/empty when all at 0%
      setMixedColor('');
      return;
    }
    
    // Use mixbox to blend all active colors
    const colorWeights = activeSliders.map(s => ({
      hex: s.color,
      weight: s.weight
    }));
    
    const result = mixboxMultiBlend(colorWeights);
    setMixedColor(result);
  }, [sliders]);
  
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
        
        // Position text - always outward to avoid overlapping with center
        const textDist = t > 0.6 ? 60 : 50;
        const tx = kx + sinA * textDist;
        const ty = ky + cosA * textDist;
        
        // Background label
        const metrics = ctx.measureText(`${ml}ml`);
        const w = Math.max(metrics.width, 40) + 10;
        const h = 30;
        
        // 绘制阴影
        ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 2;
        
        ctx.beginPath();
        ctx.roundRect(tx - w/2, ty - h/2, w, h, 6);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.98)';
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
        ctx.fillText(`${pct}%`, tx, ty + 7);
        
        ctx.restore();
      }
    });
  };
  
  // Animation Loop (like RadialMixer)
  useEffect(() => {
    const loop = () => {
      draw();
      requestRef.current = requestAnimationFrame(loop);
    };
    requestRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(requestRef.current!);
  }, [sliders, mixedColor, targetColor, draggingIndex, knobSizes]);
  
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
    
    // Check if clicking on any slider (direct calculation like RadialMixer)
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
      
      if (dist < 40) {
        setDraggingIndex(i);
        
        // Animate slider scale up with bounce
        if (typeof anime !== 'undefined') {
          anime({
            targets: { radius: knobSizes.current[i] },
            radius: ACTIVE_KNOB_RADIUS,
            duration: 400,
            easing: 'easeOutElastic(1, .6)',
            update: (anim: any) => {
              knobSizes.current[i] = anim.animatables[0].target.radius;
            }
          });
        }
        return;
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
    <div className="w-full h-full flex flex-col items-center justify-start p-3 space-y-2 overflow-y-auto">
      <div className="text-center">
        <h2 className="text-lg font-bold text-macaron-blue dark:text-macaron-pink mb-1">
          {lang === 'zh' ? '径向调色盘' : lang === 'ja' ? 'ラジアルミキサー' : 'Radial Mixer'}
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          {lang === 'zh' 
            ? '从外向内拖动滑块增加混合比例 · 使用 Mixbox 物理混色引擎' 
            : lang === 'ja'
            ? '外から内にドラッグして混合比率を増やす · Mixbox 物理ベース'
            : 'Drag sliders from outer to inner to increase mixing ratio · Physical Mixbox'
          }
        </p>
        {targetColor && (
          <p className="text-xs text-macaron-pink dark:text-macaron-blue mt-0.5">
            {lang === 'zh' ? '🎯 目标: ' : lang === 'ja' ? '🎯 ターゲット: ' : '🎯 Target: '}
            <span className="font-mono font-bold">{targetColor.hex}</span>
          </p>
        )}
      </div>
      
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
              
              if (dist < 40) {
                touchingSlider = true;
                break;
              }
            }
            
            // 如果触摸到滑块,阻止默认行为(防止滚动)
            if (touchingSlider) {
              e.preventDefault();
            }
            
            handleMouseDown({ clientX: touch.clientX, clientY: touch.clientY } as any);
          }
        }}
        onTouchMove={(e) => {
          // 在canvas区域内触摸移动时,总是阻止默认行为以防止滚动
          e.preventDefault();
          
          // 节流优化
          const now = Date.now();
          if (now - lastMoveTimeRef.current < 16) return; // ~60fps
          lastMoveTimeRef.current = now;
          
          if (e.touches.length > 0) {
            handleMouseMove({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY } as any);
          }
        }}
        onTouchEnd={(e) => {
          handleMouseUp();
        }}
        className="rounded-lg cursor-crosshair"
        style={{ 
          touchAction: 'none', // 完全禁止默认触摸行为(防止滚动/缩放)
          display: 'block',
          margin: '0 auto'
        }}
      />
      
      {/* Readout Panel (like RadialMixer) */}
      <div className="mt-2 flex flex-wrap gap-3 p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-bold text-slate-400 uppercase">
              {lang === 'zh' ? '混合结果' : lang === 'ja' ? 'ミックス結果' : 'Mixed Result'}
            </span>
            <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
              {mixedColor === '' ? (lang === 'zh' ? '透明' : lang === 'ja' ? '透明' : 'TRANSPARENT') : mixedColor}
            </span>
          </div>
          <div 
            className="w-9 h-9 rounded-lg border-2 border-slate-100 dark:border-slate-600 shadow-inner" 
            style={{
              backgroundColor: mixedColor || 'transparent',
              backgroundImage: mixedColor === '' ? 'repeating-conic-gradient(#E0E0E0 0% 25%, #FFFFFF 0% 50%)' : 'none',
              backgroundSize: '15px 15px'
            }}
          />
        </div>
        
        <div className="w-px bg-slate-200 dark:bg-slate-700"></div>
        
        <div className="flex items-center gap-2">
          <div 
            className="w-9 h-9 rounded-lg border-2 border-slate-100 dark:border-slate-600 shadow-inner" 
            style={{backgroundColor: targetColor?.hex || 'transparent'}}
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
        
        <div className="w-px bg-slate-200 dark:bg-slate-700"></div>
        
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
              className="w-16 px-1.5 py-0.5 text-center font-mono text-xs font-bold border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
            />
          </div>
          <button
            onClick={handleReset}
            className="px-2.5 py-1 bg-macaron-blue hover:bg-blue-600 text-white rounded-md text-xs font-medium transition-colors shadow-sm"
          >
            {lang === 'zh' ? '🔄 重置' : lang === 'ja' ? '🔄 リセット' : '🔄 Reset'}
          </button>
        </div>
        
        {onAddColors && (
          <>
            <div className="w-px bg-slate-200 dark:bg-slate-700"></div>
            
            <button
              onClick={() => {
                onAddColors(['#00B7EB', '#FF0090', '#FFEF00']);
                setCmyAdded(true);
                setTimeout(() => setCmyAdded(false), 2000);
              }}
              disabled={cmyAdded}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-500 shadow-sm relative overflow-hidden ${
                cmyAdded
                  ? 'bg-green-500 text-white cursor-default'
                  : 'bg-purple-500 text-white before:absolute before:w-8 before:h-8 before:content-[\'\'] before:right-0 before:top-0 before:z-0 before:bg-[#00B7EB] before:rounded-full before:blur-md before:transition-all before:duration-500 after:absolute after:w-10 after:h-10 after:content-[\'\'] after:bg-[#FF0090] after:right-4 after:top-1 after:z-0 after:rounded-full after:blur-md after:transition-all after:duration-500 hover:before:right-8 hover:before:-bottom-4 hover:before:blur-lg hover:after:-right-6 hover:after:blur-lg'
              }`}
            >
              <span className="relative z-10">{cmyAdded ? t.cmyColorsAdded : t.addCmyColors}</span>
            </button>
            
            <button
              onClick={() => {
                onAddColors(['#FFFFFF', '#000000']);
                setBwAdded(true);
                setTimeout(() => setBwAdded(false), 2000);
              }}
              disabled={bwAdded}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all shadow-sm ${
                bwAdded
                  ? 'bg-green-500 text-white cursor-default'
                  : 'bg-slate-600 hover:bg-slate-700 text-white'
              }`}
            >
              {bwAdded ? t.bwColorsAdded : t.addBwColors}
            </button>
          </>
        )}
      </div>
      
      {/* Control Panel */}
      <div className="w-full max-w-xl bg-slate-50 dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 mt-2">
        
        {/* Volume Recipe Display */}
        {volumes.length > 0 && (
          <div className="border-t border-slate-200 dark:border-slate-600 pt-2 mt-2">
            <h4 className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">
              {lang === 'zh' ? '📊 混合配方' : lang === 'ja' ? '📊 レシピ' : '📊 RECIPE'}
            </h4>
            <DropRatioBar
              parts={dropParts}
              lang={lang}
              multiplier={dropMultiplier}
              onMultiplierChange={setDropMultiplier}
            />
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {volumes.map((vol, i) => (
                <div key={i} className="flex items-center justify-between text-[10px] bg-white dark:bg-slate-700 p-1.5 rounded border border-slate-200 dark:border-slate-600">
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
                        {dropCounts[i] * dropMultiplier}{t.dropUnit}
                      </span>
                    ) : null}
                    <span className="font-bold text-macaron-blue dark:text-macaron-pink">
                      {vol.percentage.toFixed(1)}%
                    </span>
                    <span className="font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                      {vol.volume.toFixed(2)} ml
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-1.5 pt-1.5 border-t border-slate-200 dark:border-slate-600 flex justify-between text-[10px] font-bold">
              <span className="text-slate-600 dark:text-slate-400">
                {lang === 'zh' ? '总计' : lang === 'ja' ? '合計' : 'TOTAL'}
              </span>
              <span className="text-macaron-purple dark:text-macaron-pink">
                {targetVolume.toFixed(2)} ml
              </span>
            </div>
          </div>
        )}
      </div>
      
      {mixedColor && (
        <div className="mt-4 w-full max-w-md">
          <BrandMatchPanel
            hex={mixedColor}
            lang={lang}
            compact
            assignedId={targetColor?.assignedPaint?.id}
            hasSamplePoint={typeof targetColor?.sampleX === "number" && typeof targetColor?.sampleY === "number"}
            onAssignCatalog={onAssignCatalogPaint}
          />
        </div>
      )}

      <div className="text-[10px] text-slate-500 dark:text-slate-400 text-center max-w-md leading-tight">
        {lang === 'zh' 
          ? '💡 提示: 外围=0%, 中心=100%。拖动时实时计算混合比例和所需体积。' 
          : lang === 'ja'
          ? '💡 ヒント: 外側=0%, 中心=100%。ドラッグ時にリアルタイム計算。'
          : '💡 Tip: Outer=0%, Inner=100%. Real-time calculation while dragging.'
        }
      </div>
    </div>
  );
};

export default RadialPaletteMixer;
