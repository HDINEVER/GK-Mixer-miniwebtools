import React, { useRef, useEffect, useState } from 'react';
import { Language } from '../types';
import { lerp, rgbToLatent, latentToRgb } from '../utils/mixbox';

// 声明 anime
declare var anime: any;

interface BasicColorMixerProps {
  lang: Language;
}

// 8 base colors: 5 Gaia + 3 Process colors
const BASE_COLORS = [
  { id: 'gaia-001', brand: 'Gaia', code: '001', name: '光泽白', hex: '#FFFFFF' },
  { id: 'gaia-002', brand: 'Gaia', code: '002', name: '光泽黑', hex: '#000000' },
  { id: 'gaia-003', brand: 'Gaia', code: '003', name: '光泽红', hex: '#E60012' },
  { id: 'gaia-004', brand: 'Gaia', code: '004', name: '光泽蓝', hex: '#004098' },
  { id: 'gaia-005', brand: 'Gaia', code: '005', name: '光泽黄', hex: '#FFD900' },
  { id: 'process-cyan', brand: 'Process', code: 'C', name: '印刷青', hex: '#00B7EB' },
  { id: 'process-magenta', brand: 'Process', code: 'M', name: '印刷品红', hex: '#FF0090' },
  { id: 'process-yellow', brand: 'Process', code: 'Y', name: '印刷黄', hex: '#FFEF00' },
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

const BasicColorMixer: React.FC<BasicColorMixerProps> = ({ lang }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const [mixRatios, setMixRatios] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0]);
  const [finalColor, setFinalColor] = useState<string>('');
  const [totalVolume, setTotalVolume] = useState<number>(20);
  const [canvasSize, setCanvasSize] = useState(getCanvasSize());
  
  // 拖动状态
  const draggedIndexRef = useRef<number>(-1);
  const lastMoveTimeRef = useRef<number>(0); // 触控节流
  const knobSizesRef = useRef<number[]>([22, 22, 22, 22, 22, 22, 22, 22]);
  
  // 位置缓存
  const centersOutside = useRef<Array<{x: number, y: number}>>([]);
  const centersInside = useRef<Array<{x: number, y: number}>>([]);
  const slidersPos = useRef<Array<{x: number, y: number}>>([]);

  // 响应式调整画布尺寸
  useEffect(() => {
    const updateSize = () => {
      const width = containerRef.current?.offsetWidth;
      const newSize = getCanvasSize(width);
      setCanvasSize(newSize);
      initializePositions(newSize.scale);
    };

    updateSize();
    const resizeObserver = new ResizeObserver(() => updateSize());
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    const handleWindowResize = () => updateSize();
    window.addEventListener('resize', handleWindowResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
    };
  }, []);

  // 根据mixRatios更新滑块位置
  const updateSliderPositions = () => {
    const WIDTH = BASE_WIDTH;
    const HEIGHT = BASE_HEIGHT;
    const CENTER_X = WIDTH / 2;
    const CENTER_Y = HEIGHT / 2;
    const OUTER_RADIUS = 215;
    const INNER_RADIUS = 70;
    
    const numColors = BASE_COLORS.length;
    const step = (Math.PI * 2) / numColors;

    for (let i = 0; i < numColors; i++) {
      const angle = i * step;
      // t值就是mixRatios[i]，从0(外圈)到1(内圈)
      const t = mixRatios[i];
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
    
    const numColors = BASE_COLORS.length;
    const step = (Math.PI * 2) / numColors;

    centersOutside.current = [];
    centersInside.current = [];
    slidersPos.current = [];
    knobSizesRef.current = [BASE_KNOB_RADIUS, BASE_KNOB_RADIUS, BASE_KNOB_RADIUS, BASE_KNOB_RADIUS, BASE_KNOB_RADIUS, BASE_KNOB_RADIUS, BASE_KNOB_RADIUS, BASE_KNOB_RADIUS];

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
    for (let i = 0; i < BASE_COLORS.length; i++) {
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
    for (let i = 0; i < BASE_COLORS.length; i++) {
      const pos = slidersPos.current[i];
      const currentRadius = knobSizesRef.current[i];
      const hex = BASE_COLORS[i].hex;

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
    for (let i = 0; i < BASE_COLORS.length; i++) {
      // 如果有配比，显示数据标签
      if (mixRatios[i] > 0.001 || draggedIndexRef.current === i) {
        const pos = slidersPos.current[i];
        const currentRadius = knobSizesRef.current[i];
        const hex = BASE_COLORS[i].hex;
        const totalRatio = mixRatios.reduce((a, b) => a + b, 0);
        const percentage = totalRatio > 0 ? (mixRatios[i] / totalRatio * 100).toFixed(1) : '0.0';
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

    animationFrameRef.current = requestAnimationFrame(draw);
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
    // 使用逻辑坐标系统 - 基于BASE_WIDTH/HEIGHT而非显示尺寸
    // 关键修复: 使用canvasSize.width/height作为转换基准
    const x = (clientX - rect.left) * (WIDTH / canvasSize.width);
    const y = (clientY - rect.top) * (HEIGHT / canvasSize.height);

    // 检测点击了哪个旋钮
    for (let i = 0; i < BASE_COLORS.length; i++) {
      const pos = slidersPos.current[i];
      const radius = knobSizesRef.current[i];
      const dx = x - pos.x;
      const dy = y - pos.y;
      
      if (Math.sqrt(dx * dx + dy * dy) < radius) {
        draggedIndexRef.current = i;
        
        // 放大动画
        anime({
          targets: { radius: knobSizesRef.current[i] },
          radius: ACTIVE_KNOB_RADIUS,
          duration: 400,
          easing: 'easeOutElastic(1, .6)',
          update: (anim: any) => {
            knobSizesRef.current[i] = anim.animatables[0].target.radius;
          }
        });
        break;
      }
    }
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (draggedIndexRef.current === -1) return;

    // 移动端触控节流优化 - 限制更新频率
    const now = Date.now();
    if (now - lastMoveTimeRef.current < 16) return; // ~60fps
    lastMoveTimeRef.current = now;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const WIDTH = BASE_WIDTH;
    const HEIGHT = BASE_HEIGHT;
    const CENTER_X = WIDTH / 2;
    const CENTER_Y = HEIGHT / 2;
    const OUTER_RADIUS = 215;
    const INNER_RADIUS = 70;
    // 使用逻辑坐标系统 - 修复移动设备模式下的坐标转换
    const x = (clientX - rect.left) * (WIDTH / canvasSize.width);
    const y = (clientY - rect.top) * (HEIGHT / canvasSize.height);

    const i = draggedIndexRef.current;
    const outerPos = centersOutside.current[i];
    const innerPos = centersInside.current[i];

    // 计算t值：从外圈(t=0)到内圈(t=1)
    const t = getT(outerPos.x, outerPos.y, innerPos.x, innerPos.y, x, y);

    // 只更新配比，滑块位置会通过useEffect自动同步
    const newRatios = [...mixRatios];
    newRatios[i] = t;
    setMixRatios(newRatios);

    // 计算混合颜色
    const totalWeight = newRatios.reduce((a, b) => a + b, 0);
    if (totalWeight > 0.001) {
      // 使用 mixbox 算法混合颜色
      let latentMix = [0, 0, 0, 0, 0, 0, 0];
      
      for (let j = 0; j < BASE_COLORS.length; j++) {
        if (newRatios[j] > 0.001) {
          const latent = rgbToLatent(BASE_COLORS[j].hex);
          if (latent) {
            const weight = newRatios[j] / totalWeight;
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
        setFinalColor(`#${r}${g}${b}`);
      }
    } else {
      setFinalColor('');
    }
  };

  const handleEnd = () => {
    if (draggedIndexRef.current === -1) return;

    const i = draggedIndexRef.current;
    const BASE_KNOB_RADIUS = 22;
    
    // 恢复大小动画
    anime({
      targets: { radius: knobSizesRef.current[i] },
      radius: BASE_KNOB_RADIUS,
      duration: 300,
      easing: 'easeOutQuad',
      update: (anim: any) => {
        knobSizesRef.current[i] = anim.animatables[0].target.radius;
      }
    });

    draggedIndexRef.current = -1;
  };

  // 事件绑定
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
        // 设备模拟模式需要 preventDefault 才能正确触发
        e.preventDefault();
        handleStart(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const handleTouchMove = (e: TouchEvent) => {
      // 只在拖动时阻止滚动
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
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, [mixRatios, canvasSize]);

  // 同步滑块位置到mixRatios
  useEffect(() => {
    updateSliderPositions();
  }, [mixRatios]);

  // 启动绘制循环
  useEffect(() => {
    draw();
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [mixRatios, finalColor, canvasSize]);

  // 重置功能
  const handleReset = () => {
    setMixRatios([0, 0, 0, 0, 0, 0, 0, 0]);
    setFinalColor('');
    // 滑块位置会通过useEffect自动重置到外圈
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

  return (
    <div ref={containerRef} className="grid gap-2 h-full">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">{t.title}</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.subtitle}</p>
      </div>

      {/* 控制栏 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{t.volume}:</label>
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

      {/* Canvas - Fixed height to prevent shifting */}
      <div className="flex items-center justify-center">
        <canvas
          ref={canvasRef}
          style={{ 
            touchAction: 'none',
            display: 'block',
            margin: '0 auto'
          }}
        />
      </div>

      {/* 配方显示 - 始终显示 */}
      <div>
        <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
          <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{t.formula}</h3>
          <div className="space-y-1 min-h-[60px]">
            {finalColor ? (
              BASE_COLORS.map((color, i) => {
                const totalRatio = mixRatios.reduce((a, b) => a + b, 0);
                const percentage = totalRatio > 0 ? (mixRatios[i] / totalRatio * 100) : 0;
                const ml = (percentage * totalVolume / 100).toFixed(1);
                
                if (percentage < 0.1) return null;
                
                return (
                  <div key={color.id} className="flex items-center gap-1.5 text-xs">
                    <div
                      className="w-3.5 h-3.5 rounded border-2 border-white dark:border-slate-600"
                      style={{ backgroundColor: color.hex }}
                    />
                    <span className="font-mono text-slate-600 dark:text-slate-400">
                      {color.brand} {color.code}
                    </span>
                    <span className="flex-1 text-slate-500 dark:text-slate-500">{color.name}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{ml}ml</span>
                    <span className="text-slate-500 dark:text-slate-500">({percentage.toFixed(1)}%)</span>
                  </div>
                );
              })
            ) : (
              <div className="flex items-center justify-center h-[60px]">
                <p className="text-xs text-slate-400 dark:text-slate-500">{t.noMix}</p>
              </div>
            )}
          </div>
          
          {finalColor && (
            <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center gap-2">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{t.result}:</span>
              <div
                className="w-6 h-6 rounded border-2 border-white dark:border-slate-600 shadow-md"
                style={{ backgroundColor: finalColor }}
              />
              <span className="font-mono text-xs text-slate-600 dark:text-slate-400">{finalColor.toUpperCase()}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BasicColorMixer;
