import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  DropIcon,
  SlidersHorizontalIcon,
  CircleNotchIcon,
  FlaskIcon,
  ClipboardTextIcon,
  CheckIcon,
} from '@phosphor-icons/react';
import { Language, BasicMixerCache, BaseColor } from '../types';
import { lerp, rgbToLatent, latentToRgb } from '../utils/mixbox';
import { toDropRatio } from '../utils/dropRatio';
import { hexToRAL } from '../utils/colorUtils';
import DropRatioBar from './DropRatioBar';
import BrandMatchPanel from './BrandMatchPanel';
import IOSColorSlider from './IOSColorSlider';
import { translations as uiText } from '../utils/translations';

// 声明 anime
declare var anime: any;

interface BasicColorMixerProps {
  lang: Language;
  cache?: BasicMixerCache;
  onCacheUpdate?: (cache: BasicMixerCache) => void;
}

// 8 base colors: 5 Gaia + 3 Process colors
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

// Gaia 扩展颜色 (006品红、007青、008橙)
const GAIA_EXTENDED_COLORS: BaseColor[] = [
  { id: 'gaia-006', brand: 'Gaia', code: '006', name: '品红', hex: '#FF00FF' },
  { id: 'gaia-007', brand: 'Gaia', code: '007', name: '青', hex: '#00FFFF' },
  { id: 'gaia-008', brand: 'Gaia', code: '008', name: '橙', hex: '#FF8000' },
];

// Canvas 基础常量
const BASE_WIDTH = 500;
const BASE_HEIGHT = 500;

// 计算响应式尺寸 - 基于容器宽度的流式缩放
const getCanvasSize = (containerWidth?: number) => {
  const fallbackWidth = typeof window !== 'undefined' ? window.innerWidth : BASE_WIDTH;
  const rawWidth = containerWidth ?? fallbackWidth;
  const paddedWidth = Math.max(0, rawWidth - 32); // 留出内边距
  const availableWidth = Math.min(Math.max(paddedWidth, 240), BASE_WIDTH); // 保持最小宽度,但不超过基础宽度
  const scale = availableWidth / BASE_WIDTH;
  return {
    width: BASE_WIDTH * scale,
    height: BASE_HEIGHT * scale,
    scale: scale
  };
};

const BasicColorMixer: React.FC<BasicColorMixerProps> = ({ lang, cache, onCacheUpdate }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Use cache values if available, otherwise use defaults
  const [baseColors, setBaseColors] = useState<BaseColor[]>(cache?.baseColors ?? DEFAULT_BASE_COLORS);
  const [mixRatios, setMixRatios] = useState<number[]>(cache?.mixRatios ?? DEFAULT_BASE_COLORS.map(() => 0));
  const [finalColor, setFinalColor] = useState<string>('');
  const [totalVolume, setTotalVolume] = useState<number>(cache?.totalVolume ?? 20);
  const [canvasSize, setCanvasSize] = useState(getCanvasSize());
  const [dropMultiplier, setDropMultiplier] = useState(1);

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
  const ralMatch = useMemo(() => (finalColor ? hexToRAL(finalColor) : null), [finalColor]);

  // Volume presets matching iOS
  const volumePresets = [10, 20, 30, 40, 50, 60];

  // Handler for iOS slider changes
  const cacheTimerRef = useRef<any>(null);
  const handleSliderAmountChange = (index: number, val: number) => {
    const newRatios = [...mixRatios];
    newRatios[index] = Math.max(0, Math.min(100, val)) / 100;
    mixRatiosRef.current = newRatios;
    setMixRatios(newRatios);

    const color = calculateMixedColor(newRatios);
    setFinalColor(color);
    finalColorRef.current = color;
    updateSliderPositions(newRatios);

    if (onCacheUpdate) {
      if (cacheTimerRef.current) clearTimeout(cacheTimerRef.current);
      cacheTimerRef.current = setTimeout(() => {
        onCacheUpdate({
          baseColors,
          mixRatios: newRatios,
          totalVolume,
        });
      }, 250);
    }
  };
  
  // Refs to prevent closure lag and frame drops during dragging
  const mixRatiosRef = useRef<number[]>(cache?.mixRatios ?? DEFAULT_BASE_COLORS.map(() => 0));
  mixRatiosRef.current = mixRatios;
  const finalColorRef = useRef<string>('');
  finalColorRef.current = finalColor;

  // 拖动状态
  const draggedIndexRef = useRef<number>(-1);
  const lastMoveTimeRef = useRef<number>(0); // 触控节流
  const knobSizesRef = useRef<number[]>(baseColors.map(() => 22));
  
  // 位置缓存
  const centersOutside = useRef<Array<{x: number, y: number}>>([]);
  const centersInside = useRef<Array<{x: number, y: number}>>([]);
  const slidersPos = useRef<Array<{x: number, y: number}>>([]);
  
  // Update cache when state changes outside of active dragging
  useEffect(() => {
    if (onCacheUpdate && draggedIndexRef.current === -1) {
      onCacheUpdate({
        baseColors,
        mixRatios,
        totalVolume
      });
    }
  }, [baseColors, totalVolume, onCacheUpdate]);
  
  // 计算混合颜色的辅助函数
  const calculateMixedColor = (ratios: number[]): string => {
    const totalWeight = ratios.reduce((a, b) => a + b, 0);
    if (totalWeight > 0.001) {
      // 使用 mixbox 算法混合颜色
      let latentMix = [0, 0, 0, 0, 0, 0, 0];
      
      for (let j = 0; j < baseColors.length; j++) {
        if (ratios[j] > 0.001) {
          const latent = rgbToLatent(baseColors[j].hex);
          if (latent) {
            const weight = ratios[j] / totalWeight;
            for (let k = 0; k < latent.length; k++) {
              latentMix[k] += latent[k] * weight;
            }
          }
        }
      }
      
      const mixedRgb = latentToRgb(latentMix);
      if (mixedRgb) {
        const r = mixedRgb[0].toString(16).padStart(2, '0');
        const g = mixedRgb[1].toString(16).padStart(2, '0');
        const b = mixedRgb[2].toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
      }
    }
    return '';
  };
  
  // 从缓存恢复时重新计算混合颜色
  useEffect(() => {
    if (cache?.mixRatios && cache.mixRatios.some(r => r > 0.001)) {
      const color = calculateMixedColor(cache.mixRatios);
      if (color) {
        setFinalColor(color);
        finalColorRef.current = color;
      }
    }
  }, []); // 只在组件挂载时执行一次

  // 响应式调整画布尺寸 - 监听 window resize，避免 ResizeObserver 产生布局抖动循环
  useEffect(() => {
    const updateSize = () => {
      const width = containerRef.current?.offsetWidth;
      const newSize = getCanvasSize(width);
      setCanvasSize(newSize);
      initializePositions(newSize.scale);
      updateSliderPositions(mixRatiosRef.current);
    };

    updateSize();
    window.addEventListener('resize', updateSize);

    return () => {
      window.removeEventListener('resize', updateSize);
    };
  }, []);
  
  // 当baseColors改变时重新初始化位置
  useEffect(() => {
    initializePositions(canvasSize.scale);
    updateSliderPositions(mixRatiosRef.current);
  }, [baseColors.length, canvasSize.scale]);
  
  // 根据 mixRatios 更新滑块位置
  const updateSliderPositions = (ratios: number[] = mixRatiosRef.current) => {
    const WIDTH = BASE_WIDTH;
    const HEIGHT = BASE_HEIGHT;
    const CENTER_X = WIDTH / 2;
    const CENTER_Y = HEIGHT / 2;
    const OUTER_RADIUS = 215;
    const INNER_RADIUS = 70;
    
    const numColors = baseColors.length;
    const step = (Math.PI * 2) / numColors;

    for (let i = 0; i < numColors; i++) {
      const angle = i * step;
      const t = ratios[i] ?? 0;
      const distance = OUTER_RADIUS - t * (OUTER_RADIUS - INNER_RADIUS);
      slidersPos.current[i] = {
        x: CENTER_X + Math.sin(angle) * distance,
        y: CENTER_Y - Math.cos(angle) * distance
      };
    }
  };

  // 初始化位置
  const initializePositions = (scale: number) => {
    const WIDTH = BASE_WIDTH;
    const HEIGHT = BASE_HEIGHT;
    const CENTER_X = WIDTH / 2;
    const CENTER_Y = HEIGHT / 2;
    const OUTER_RADIUS = 215;
    const INNER_RADIUS = 70;
    const BASE_KNOB_RADIUS = 22;
    
    const numColors = baseColors.length;
    const step = (Math.PI * 2) / numColors;

    centersOutside.current = [];
    centersInside.current = [];
    slidersPos.current = [];
    if (draggedIndexRef.current === -1) {
      knobSizesRef.current = new Array(numColors).fill(BASE_KNOB_RADIUS);
    }

    for (let i = 0; i < numColors; i++) {
      const angle = i * step;
      const x0 = CENTER_X + Math.sin(angle) * INNER_RADIUS;
      const y0 = CENTER_Y - Math.cos(angle) * INNER_RADIUS;
      const x1 = CENTER_X + Math.sin(angle) * OUTER_RADIUS;
      const y1 = CENTER_Y - Math.cos(angle) * OUTER_RADIUS;

      centersInside.current.push({ x: x0, y: y0 });
      centersOutside.current.push({ x: x1, y: y1 });
      slidersPos.current.push({ x: x1, y: y1 });
    }
  };

  // 绘制循环
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 使用逻辑坐标系统(总是BASE_WIDTH),与实际显示尺寸分离
    const WIDTH = BASE_WIDTH;
    const HEIGHT = BASE_HEIGHT;
    const CENTER_X = WIDTH / 2;
    const CENTER_Y = HEIGHT / 2;
    const OUTER_RADIUS = 215;
    const INNER_RADIUS = 70;
    const BASE_KNOB_RADIUS = 22;
    const ACTIVE_KNOB_RADIUS = 32;

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
    // 需要同时应用DPI缩放和响应式缩放,以便在逻辑坐标系(500×500)上绘制
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr * canvasSize.scale, dpr * canvasSize.scale);

    // 清空
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // 1. 绘制轨道（连线）
    for (let i = 0; i < baseColors.length; i++) {
      const innerPos = centersInside.current[i];
      const outerPos = centersOutside.current[i];

      ctx.beginPath();
      ctx.moveTo(innerPos.x, innerPos.y);
      ctx.lineTo(outerPos.x, outerPos.y);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // 2. 绘制旋钮
    for (let i = 0; i < baseColors.length; i++) {
      const pos = slidersPos.current[i];
      const currentRadius = knobSizesRef.current[i];
      const hex = baseColors[i].hex;

      // 阴影
      ctx.beginPath();
      ctx.arc(pos.x, pos.y + 4, currentRadius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      ctx.fill();

      // 旋钮本体
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, currentRadius, 0, Math.PI * 2);
      ctx.fillStyle = hex;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // 3. 绘制中心混合区域
    // 阴影
    ctx.beginPath();
    ctx.arc(CENTER_X, CENTER_Y + 5, INNER_RADIUS - 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fill();

    // 中心圆
    ctx.beginPath();
    ctx.arc(CENTER_X, CENTER_Y, INNER_RADIUS - 5, 0, Math.PI * 2);
    
    if (!finalColor) {
      // 空状态 - 显示浅灰色背景
      ctx.fillStyle = '#f1f5f9';
      ctx.fill();
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 4;
      ctx.stroke();
    } else {
      // 有混合结果
      ctx.fillStyle = finalColor;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 4;
      ctx.stroke();
    }

    // 4. 绘制数据标签（最后绘制，确保在最上层）
    for (let i = 0; i < baseColors.length; i++) {
      const r = mixRatiosRef.current[i] ?? 0;
      if (r > 0.001 || draggedIndexRef.current === i) {
        const pos = slidersPos.current[i];
        if (!pos) continue;
        const currentRadius = knobSizesRef.current[i] ?? BASE_KNOB_RADIUS;
        const hex = baseColors[i].hex;
        const totalRatio = mixRatiosRef.current.reduce((a, b) => a + b, 0);
        const percentage = totalRatio > 0 ? (r / totalRatio * 100).toFixed(1) : '0.0';
        const ml = (parseFloat(percentage) * totalVolume / 100).toFixed(1);

        // 标签位置（旋钮外侧）
        const angle = Math.atan2(pos.y - CENTER_Y, pos.x - CENTER_X);
        const labelDist = currentRadius + 35;
        const tx = pos.x + Math.cos(angle) * labelDist;
        const ty = pos.y + Math.sin(angle) * labelDist;

        // 绘制标签背景
        ctx.font = 'bold 12px "JetBrains Mono", monospace';
        const text1 = `${ml}ml`;
        const text2 = `${percentage}%`;
        const w1 = ctx.measureText(text1).width;
        const w2 = ctx.measureText(text2).width;
        const maxW = Math.max(w1, w2);
        const padding = 8;
        const boxW = maxW + padding * 2;
        const boxH = 36;

        // 绘制阴影
        ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 2;
        
        ctx.beginPath();
        ctx.roundRect(tx - boxW/2, ty - boxH/2, boxW, boxH, 6);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.98)';
        ctx.fill();
        
        // 清除阴影设置以免影响边框
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        
        ctx.strokeStyle = hex;
        ctx.lineWidth = 2;
        ctx.stroke();

        // 绘制文字
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#0f172a';
        ctx.fillText(text1, tx, ty - 7);
        
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillStyle = '#64748b';
        ctx.fillText(text2, tx, ty + 7);
      }
    }
  };

  // 绘制马赛克（空状态）
  const drawMosaic = (ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number) => {
    const colors = [
      { base: '#f1f5f9', alpha: 0.95 },
      { base: '#e2e8f0', alpha: 0.85 },
      { base: '#cbd5e1', alpha: 0.75 },
      { base: '#94a3b8', alpha: 0.65 }
    ];
    const gridSize = 8; // 更小的格子
    const steps = Math.ceil(radius * 2 / gridSize);
    const cornerRadius = 2;

    ctx.save();
    // 设置裁剪区域
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    for (let i = -steps; i <= steps; i++) {
      for (let j = -steps; j <= steps; j++) {
        const x = cx + i * gridSize - radius;
        const y = cy + j * gridSize - radius;
        const dx = x + gridSize/2 - cx;
        const dy = y + gridSize/2 - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < radius - gridSize/2) {
          const colorIndex = (i + j + 100) % colors.length;
          const color = colors[colorIndex];
          
          // 根据距离调整透明度
          const alpha = color.alpha * (1 - dist / radius * 0.3);
          ctx.fillStyle = color.base + Math.round(alpha * 255).toString(16).padStart(2, '0');
          
          // 绘制圆角矩形
          ctx.beginPath();
          ctx.roundRect(x, y, gridSize - 1, gridSize - 1, cornerRadius);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  };

  // 计算投影点t值
  const getT = (ax: number, ay: number, bx: number, by: number, qx: number, qy: number): number => {
    const ux = bx - ax;
    const uy = by - ay;
    const vx = qx - ax;
    const vy = qy - ay;

    const uMag = Math.sqrt(ux * ux + uy * uy);
    const d = (ux * vx + uy * vy) / uMag;
    const t = d / uMag;

    return Math.max(0, Math.min(1, t));
  };

  // 鼠标/触摸事件处理
  const handleStart = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const WIDTH = BASE_WIDTH;
    const HEIGHT = BASE_HEIGHT;
    const ACTIVE_KNOB_RADIUS = 32;
    const x = (clientX - rect.left) * (WIDTH / rect.width);
    const y = (clientY - rect.top) * (HEIGHT / rect.height);

    // 检测点击了哪个旋钮（寻找距离点击点最近且在感应范围内的旋钮）
    let closestIndex = -1;
    let closestDist = Infinity;
    const HIT_RADIUS = 55;

    for (let i = 0; i < baseColors.length; i++) {
      const pos = slidersPos.current[i];
      if (!pos) continue;
      const dx = x - pos.x;
      const dy = y - pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < HIT_RADIUS && dist < closestDist) {
        closestDist = dist;
        closestIndex = i;
      }
    }

    if (closestIndex !== -1) {
      draggedIndexRef.current = closestIndex;
      
      // 放大动画
      if (typeof anime !== 'undefined') {
        anime({
          targets: { radius: knobSizesRef.current[closestIndex] },
          radius: ACTIVE_KNOB_RADIUS,
          duration: 400,
          easing: 'easeOutElastic(1, .6)',
          update: (anim: any) => {
            knobSizesRef.current[closestIndex] = anim.animatables[0].target.radius;
          }
        });
      }
    }
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (draggedIndexRef.current === -1) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const WIDTH = BASE_WIDTH;
    const HEIGHT = BASE_HEIGHT;
    const CENTER_X = WIDTH / 2;
    const CENTER_Y = HEIGHT / 2;
    const OUTER_RADIUS = 215;
    const INNER_RADIUS = 70;

    const x = (clientX - rect.left) * (WIDTH / rect.width);
    const y = (clientY - rect.top) * (HEIGHT / rect.height);

    const i = draggedIndexRef.current;
    const outerPos = centersOutside.current[i];
    const innerPos = centersInside.current[i];
    if (!outerPos || !innerPos) return;

    // 计算t值：从外圈(t=0)到内圈(t=1)
    const t = getT(outerPos.x, outerPos.y, innerPos.x, innerPos.y, x, y);

    // 1. 立即计算并写入滑块位置，保证 Canvas 无延迟渲染，彻底杜绝闪烁和抽搐
    const step = (Math.PI * 2) / baseColors.length;
    const angle = i * step;
    const distance = OUTER_RADIUS - t * (OUTER_RADIUS - INNER_RADIUS);
    slidersPos.current[i] = {
      x: CENTER_X + Math.sin(angle) * distance,
      y: CENTER_Y - Math.cos(angle) * distance
    };

    // 2. 更新 Ref 中的数据
    const newRatios = [...mixRatiosRef.current];
    newRatios[i] = t;
    mixRatiosRef.current = newRatios;

    // 3. 计算混合颜色
    const color = calculateMixedColor(newRatios);
    finalColorRef.current = color;

    // 4. 节流同步到 React 状态更新配方和 UI（~60fps）
    const now = Date.now();
    if (now - lastMoveTimeRef.current >= 16) {
      lastMoveTimeRef.current = now;
      setMixRatios(newRatios);
      setFinalColor(color);
    }
  };

  const handleEnd = () => {
    if (draggedIndexRef.current === -1) return;

    const i = draggedIndexRef.current;
    const BASE_KNOB_RADIUS = 22;
    
    // 恢复大小动画
    if (typeof anime !== 'undefined') {
      anime({
        targets: { radius: knobSizesRef.current[i] },
        radius: BASE_KNOB_RADIUS,
        duration: 300,
        easing: 'easeOutQuad',
        update: (anim: any) => {
          knobSizesRef.current[i] = anim.animatables[0].target.radius;
        }
      });
    } else {
      knobSizesRef.current[i] = BASE_KNOB_RADIUS;
    }

    draggedIndexRef.current = -1;

    // 拖拽结束时提交最终状态
    const finalRatios = [...mixRatiosRef.current];
    setMixRatios(finalRatios);
    const color = calculateMixedColor(finalRatios);
    setFinalColor(color);
    finalColorRef.current = color;

    // 仅在拖拽完成时更新父级缓存，避免高频触发整个应用大树重新渲染
    if (onCacheUpdate) {
      onCacheUpdate({
        baseColors,
        mixRatios: finalRatios,
        totalVolume
      });
    }
  };

  // 事件绑定 - 仅在画布尺寸更新时绑定一次，避免在拖动过程中销毁和重复注册
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      handleStart(e.clientX, e.clientY);
    };
    const handleMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const handleMouseUp = () => handleEnd();

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        e.preventDefault();
        handleStart(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (draggedIndexRef.current !== -1) {
        e.preventDefault();
      }
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const handleTouchEnd = () => {
      handleEnd();
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [canvasSize, viewMode]);

  // 当切换到轮盘模式时，立即初始化位置与滑块
  useEffect(() => {
    if (viewMode === 'radial') {
      initializePositions(canvasSize.scale);
      updateSliderPositions(mixRatiosRef.current);
    }
  }, [viewMode, canvasSize.scale]);

  // 持续流畅的绘制循环 (60fps)
  useEffect(() => {
    if (viewMode !== 'radial') return;
    let animId: number;
    const loop = () => {
      draw();
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animId);
    };
  }, [canvasSize, viewMode]);

  // 重置功能
  const handleReset = () => {
    const zeroRatios = baseColors.map(() => 0);
    mixRatiosRef.current = zeroRatios;
    setMixRatios(zeroRatios);
    setFinalColor('');
    finalColorRef.current = '';
    updateSliderPositions(zeroRatios);
    if (onCacheUpdate) {
      onCacheUpdate({
        baseColors,
        mixRatios: zeroRatios,
        totalVolume
      });
    }
  };

  const translations = {
    zh: {
      title: '基础色自由混',
      subtitle: '拖动色块调整配比',
      volume: '总量',
      reset: '重置',
      result: '混合结果',
      noMix: '拖动色块开始混色',
      formula: '配方'
    },
    en: {
      title: 'Basic Color Free Mixer',
      subtitle: 'Drag knobs to adjust ratios',
      volume: 'Total Volume',
      reset: 'Reset',
      result: 'Mixed Result',
      noMix: 'Drag knobs to start mixing',
      formula: 'Formula'
    },
    ja: {
      title: 'ベース色フリーミックス',
      subtitle: 'ノブをドラッグして調整',
      volume: '総量',
      reset: 'リセット',
      result: 'ミックス結果',
      noMix: 'ノブをドラッグして開始',
      formula: '配合'
    }
  };

  const t = translations[lang];

  // Computed recipe items
  const totalRatio = mixRatios.reduce((a, b) => a + b, 0);
  const activeItems = baseColors
    .map((color, i) => {
      const percentage = totalRatio > 0 ? (mixRatios[i] / totalRatio) * 100 : 0;
      return { color, percentage, ml: (percentage * totalVolume) / 100 };
    })
    .filter((item) => item.percentage >= 0.1);

  const dropCounts = toDropRatio(activeItems.map((item) => item.percentage));
  const dropParts = activeItems.map((item, index) => ({
    color: item.color.hex,
    name: item.color.name.replace(/^光泽/, ''),
    drops: dropCounts[index] ?? 0,
  }));

  return (
    <div ref={containerRef} className="flex flex-col gap-3.5 w-full">
      {/* Header with Title and Mode Switcher */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
            <DropIcon className="w-5 h-5 text-sky-500 shrink-0" />
            <span>{lang === 'zh' ? '基础混色台' : lang === 'ja' ? '基本色調色台' : 'Basic Color Mixer'}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {lang === 'zh'
              ? '参考 iOS 色板调节模式，滑动基础颜料配比'
              : lang === 'ja'
              ? 'iOSスタイルのスライダーで配合調整'
              : 'iOS-style pigment slider adjustment'}
          </p>
        </div>

        {/* View Mode Toggle: [ 色板模式 ] / [ 轮盘模式 ] */}
        <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200/60 dark:border-slate-700 text-xs">
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
        /* ==================== iOS 色板调节模式 (Matching raw_03) ==================== */
        <div className="flex flex-col gap-3.5 w-full">
          {/* 1. 混合结果卡片 */}
          <div className="bg-slate-50/80 dark:bg-slate-800/60 rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
            <div className="flex items-center justify-between mb-2.5">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <FlaskIcon className="w-4 h-4 text-purple-500" />
                <span>{lang === 'zh' ? '混合结果' : lang === 'ja' ? 'ミックス結果' : 'Mixed Result'}</span>
              </div>
              {finalColor && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs text-slate-400 hover:text-rose-500 transition-colors"
                >
                  {lang === 'zh' ? '重置' : lang === 'ja' ? 'リセット' : 'Reset'}
                </button>
              )}
            </div>

            {finalColor ? (
              <div className="space-y-3">
                {/* 大色块展示 (即时响应，零延迟) */}
                <div
                  className="w-full h-24 sm:h-28 rounded-2xl relative shadow-inner border border-black/10 dark:border-white/10 overflow-hidden"
                  style={{ backgroundColor: finalColor }}
                >
                  {/* 可复制 Hex 标签 */}
                  <div className="absolute bottom-2.5 left-2.5">
                    <button
                      type="button"
                      onClick={() => handleCopyHex(finalColor)}
                      className="bg-white/85 dark:bg-black/70 backdrop-blur-md px-3 py-1 rounded-full text-xs font-mono font-bold text-slate-800 dark:text-slate-100 border border-black/10 dark:border-white/15 shadow-sm hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5"
                      title="点击复制 Hex 色号"
                    >
                      <span>{finalColor.toUpperCase()}</span>
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

                {/* RAL 近似色 */}
                {ralMatch && (
                  <div className="flex items-center justify-between text-xs pt-1 px-1 border-t border-slate-200/60 dark:border-slate-700/60">
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
              </div>
            ) : (
              <div className="w-full h-24 sm:h-28 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-1.5 text-slate-400">
                <DropIcon className="w-8 h-8 opacity-60 text-slate-400" />
                <span className="text-xs">
                  {lang === 'zh' ? '调整下方滑块开始混色' : lang === 'ja' ? 'スライダーを調整して混色' : 'Adjust sliders below to mix'}
                </span>
              </div>
            )}
          </div>

          {/* 2. 基础颜料卡片 */}
          <div className="bg-slate-50/80 dark:bg-slate-800/60 rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <DropIcon className="w-4 h-4 text-amber-500" />
                <span>{lang === 'zh' ? '基础颜料' : lang === 'ja' ? '基本顔料' : 'Basic Pigments'}</span>
              </div>
              <span className="text-[10px] text-slate-400">
                {lang === 'zh' ? '8色基础系统' : lang === 'ja' ? '8色ベース' : '8-Color System'}
              </span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {baseColors.map((paint, index) => (
                <IOSColorSlider
                  key={paint.id}
                  color={paint.hex}
                  label={paint.name.replace(/^光泽/, '')}
                  subLabel={`${paint.brand} ${paint.code}`}
                  value={Math.round((mixRatios[index] ?? 0) * 100)}
                  onChange={(val) => handleSliderAmountChange(index, val)}
                />
              ))}
            </div>
          </div>

          {/* 3. 配方输出卡片 */}
          <div className="bg-slate-50/80 dark:bg-slate-800/60 rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <ClipboardTextIcon className="w-4 h-4 text-indigo-500" />
                  <span>{lang === 'zh' ? '配方输出' : lang === 'ja' ? '配合比' : 'Formula Output'}</span>
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  {totalVolume} ml
                </div>
              </div>

              {/* 快速容量预设 - iOS/Konsta Segmented Pill Bar */}
              <div className="p-1 bg-slate-200/60 dark:bg-slate-800/80 rounded-2xl flex items-center gap-1 shadow-inner overflow-x-auto no-scrollbar">
                {volumePresets.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setTotalVolume(v)}
                    className={`min-h-[38px] px-3 py-1 rounded-xl text-xs font-mono font-bold transition-all duration-150 active:scale-[0.95] flex items-center justify-center flex-1 shrink-0 cursor-pointer ${
                      totalVolume === v
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
              <label className="text-slate-500 dark:text-slate-400 font-medium">{t.volume}:</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={totalVolume}
                  onChange={(e) => setTotalVolume(Math.max(1, parseInt(e.target.value) || 20))}
                  className="w-16 px-2.5 py-1 text-xs text-right font-mono font-bold border border-slate-300/80 dark:border-slate-600/80 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-amber-500/30 outline-none"
                  min="1"
                  max="100"
                />
                <span className="text-xs text-slate-500">ml</span>
              </div>
            </div>

            {/* 比例与详细明细 */}
            {finalColor && activeItems.length > 0 ? (
              <div className="space-y-2 pt-1">
                <DropRatioBar
                  parts={dropParts}
                  lang={lang}
                  multiplier={dropMultiplier}
                  onMultiplierChange={setDropMultiplier}
                />
                <div className="space-y-1 pt-1">
                  {activeItems.map((item, index) => (
                    <div
                      key={item.color.id}
                      className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-white/70 dark:bg-slate-800/80 border border-slate-200/50 dark:border-slate-700/50"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full border border-black/15 shadow-sm"
                          style={{ backgroundColor: item.color.hex }}
                        />
                        <span className="font-medium text-slate-700 dark:text-slate-200">
                          {item.color.name.replace(/^光泽/, '')}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400">
                          {item.color.brand} {item.color.code}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-mono">
                        {dropCounts[index] ? (
                          <span className="font-bold text-amber-600 dark:text-amber-400 text-[11px]">
                            {dropCounts[index] * dropMultiplier}
                            {uiText[lang].dropUnit} ·{' '}
                          </span>
                        ) : null}
                        <span className="font-bold text-slate-800 dark:text-slate-100">
                          {item.ml.toFixed(1)}ml
                        </span>
                        <span className="text-slate-400 text-[10px]">
                          ({item.percentage.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2">
                  <BrandMatchPanel hex={finalColor} lang={lang} compact />
                </div>
              </div>
            ) : (
              <div className="py-4 text-center text-xs text-slate-400 dark:text-slate-500">
                {t.noMix}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ==================== 经典 Canvas 轮盘模式 ==================== */
        <div className="flex flex-col gap-3">
          {/* 控制栏 */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                {t.volume}:
              </label>
              <input
                type="number"
                value={totalVolume}
                onChange={(e) => setTotalVolume(Math.max(1, parseInt(e.target.value) || 20))}
                className="w-16 px-1.5 py-0.5 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                min="1"
                max="100"
              />
              <span className="text-xs text-slate-600 dark:text-slate-400">ml</span>
            </div>

            <button
              onClick={handleReset}
              className="px-2.5 py-0.5 text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              {t.reset}
            </button>
          </div>

          {/* Canvas */}
          <div className="flex items-center justify-center">
            <canvas
              ref={canvasRef}
              style={{
                touchAction: 'none',
                display: 'block',
                margin: '0 auto',
              }}
            />
          </div>

          {/* 配方显示 */}
          <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {t.formula}
            </h3>
            <div className="space-y-1 min-h-[60px]">
              {finalColor && activeItems.length > 0 ? (
                <>
                  <DropRatioBar
                    parts={dropParts}
                    lang={lang}
                    multiplier={dropMultiplier}
                    onMultiplierChange={setDropMultiplier}
                  />
                  {activeItems.map((item, index) => (
                    <div key={item.color.id} className="flex items-center gap-1.5 text-xs">
                      <div
                        className="w-3.5 h-3.5 rounded border-2 border-white dark:border-slate-600"
                        style={{ backgroundColor: item.color.hex }}
                      />
                      <span className="font-mono text-slate-600 dark:text-slate-400">
                        {item.color.brand} {item.color.code}
                      </span>
                      <span className="flex-1 text-slate-500 dark:text-slate-500">
                        {item.color.name}
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {dropCounts[index]
                          ? `${dropCounts[index] * dropMultiplier}${uiText[lang].dropUnit} · `
                          : ''}
                        {item.ml.toFixed(1)}ml
                      </span>
                      <span className="text-slate-500 dark:text-slate-500">
                        ({item.percentage.toFixed(1)}%)
                      </span>
                    </div>
                  ))}
                </>
              ) : (
                <div className="flex items-center justify-center h-[60px]">
                  <p className="text-xs text-slate-400 dark:text-slate-500">{t.noMix}</p>
                </div>
              )}
            </div>

            {finalColor && (
              <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center gap-2">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {t.result}:
                </span>
                <div
                  className="w-6 h-6 rounded border-2 border-white dark:border-slate-600 shadow-md"
                  style={{ backgroundColor: finalColor }}
                />
                <span className="font-mono text-xs text-slate-600 dark:text-slate-400">
                  {finalColor.toUpperCase()}
                </span>
              </div>
            )}
            {finalColor && (
              <div className="mt-3">
                <BrandMatchPanel hex={finalColor} lang={lang} compact />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BasicColorMixer;
