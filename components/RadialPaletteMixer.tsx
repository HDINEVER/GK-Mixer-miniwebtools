import React, { useEffect, useRef, useState } from 'react';
import { ColorData, Language } from '../types';
import { hexToRgb, mixboxMultiBlend } from '../utils/colorUtils';
import { translations } from '../utils/translations';
import * as mixbox from '../utils/mixbox';

declare var anime: any;

interface RadialPaletteMixerProps {
  targetColor: ColorData | null;
  availableColors: ColorData[];
  lang: Language;
}

interface SliderState {
  id: string;
  color: string;
  angle: number;
  position: number; // 0.0 to 1.0 (outer to inner - reversed!)
  weight: number;   // Calculated from position
  scale: number;    // Dynamic scale based on weight (for animation)
}

const RadialPaletteMixer: React.FC<RadialPaletteMixerProps> = ({ 
  targetColor, 
  availableColors,
  lang 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sliders, setSliders] = useState<SliderState[]>([]);
  const [draggingIndex, setDraggingIndex] = useState<number>(-1);
  const [hoverIndex, setHoverIndex] = useState<number>(-1);
  const [mixedColor, setMixedColor] = useState<string>('');
  const [targetVolume, setTargetVolume] = useState<number>(20);
  const knobSizes = useRef<number[]>([]); // For anime.js dynamic sizing
  const requestRef = useRef<number>(0); // For animation loop
  const animatingSliders = useRef<boolean>(false);
  
  const t = translations[lang];
  
  // Canvas dimensions (matching RadialMixer exactly)
  const WIDTH = 650;
  const HEIGHT = 650;
  const CENTER_X = WIDTH / 2;
  const CENTER_Y = HEIGHT / 2;
  const OUTER_RADIUS = 300;
  const INNER_RADIUS = 100;
  const BASE_KNOB_RADIUS = 20;  // Base radius
  const ACTIVE_KNOB_RADIUS = 30; // Active radius (when dragging)
  const CENTER_RADIUS = INNER_RADIUS - 5; // Center circle size
  
  // Initialize sliders when available colors change
  useEffect(() => {
    if (availableColors.length === 0) return;
    
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
    knobSizes.current = new Array(numColors).fill(BASE_KNOB_RADIUS);
    setMixedColor('');
  }, [availableColors]);
  
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
    
    // Background white
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    
    // Checkerboard pattern
    const size = 15;
    ctx.fillStyle = '#e2e8f0'; // slate-200
    for (let i = x - r; i < x + r; i += size) {
      for (let j = y - r; j < y + r; j += size) {
        const gridX = Math.floor(i / size);
        const gridY = Math.floor(j / size);
        if ((gridX + gridY) % 2 === 0) {
          ctx.fillRect(i, j, size, size);
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
    
    // 2. Draw Knobs & Data Labels
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
      
      // Draw Info Label if Active
      if (t > 0 || draggingIndex === i) {
        const pct = Math.round(t * 100);
        const totalW = sliders.reduce((sum, s) => sum + s.weight, 0);
        const ml = totalW > 0 ? ((slider.weight / totalW) * targetVolume).toFixed(1) : '0.0';
        
        ctx.save();
        ctx.font = 'bold 12px "JetBrains Mono", monospace';
        ctx.fillStyle = '#475569';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Position text - always outward to avoid overlapping with center
        // When slider is close to center (t > 0.6), increase distance
        const textDist = t > 0.6 ? 60 : 50;
        // Always place label on the outer side
        const tx = kx + sinA * textDist;
        const ty = ky + cosA * textDist;
        
        // Background label
        const metrics = ctx.measureText(`${ml}ml`);
        const w = Math.max(metrics.width, 40) + 10;
        const h = 30;
        
        ctx.beginPath();
        ctx.roundRect(tx - w/2, ty - h/2, w, h, 6);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fill();
        
        ctx.fillStyle = '#0f172a';
        ctx.fillText(`${ml}ml`, tx, ty - 5);
        
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillStyle = '#64748b';
        ctx.fillText(`${pct}%`, tx, ty + 7);
        
        ctx.restore();
      }
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
  
  return (
    <div className="w-full h-full flex flex-col items-center justify-start p-6 space-y-4 overflow-y-auto">
      <div className="text-center">
        <h2 className="text-xl font-bold text-macaron-blue dark:text-macaron-pink mb-2">
          {lang === 'zh' ? '径向调色盘' : lang === 'ja' ? 'ラジアルミキサー' : 'Radial Mixer'}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {lang === 'zh' 
            ? '从外向内拖动滑块增加混合比例 · 使用 Mixbox 物理混色引擎' 
            : lang === 'ja'
            ? '外から内にドラッグして混合比率を増やす · Mixbox 物理ベース'
            : 'Drag sliders from outer to inner to increase mixing ratio · Physical Mixbox'
          }
        </p>
        {targetColor && (
          <p className="text-xs text-macaron-pink dark:text-macaron-blue mt-1">
            {lang === 'zh' ? '🎯 目标: ' : lang === 'ja' ? '🎯 ターゲット: ' : '🎯 Target: '}
            <span className="font-mono font-bold">{targetColor.hex}</span>
          </p>
        )}
      </div>
      
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={(e) => {
          e.preventDefault();
          handleMouseDown({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY } as any);
        }}
        onTouchMove={(e) => {
          e.preventDefault();
          handleMouseMove({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY } as any);
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          handleMouseUp();
        }}
        className="border-2 border-slate-200 dark:border-slate-700 rounded-lg shadow-lg cursor-crosshair transition-shadow hover:shadow-xl touch-none"
        style={{ maxWidth: '100%', height: 'auto' }}
      />
      
      {/* Readout Panel (like RadialMixer) */}
      <div className="mt-4 flex flex-wrap gap-6 p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-slate-400 uppercase">
              {lang === 'zh' ? '混合结果' : lang === 'ja' ? 'ミックス結果' : 'Mixed Result'}
            </span>
            <span className="text-sm font-mono font-bold text-slate-700 dark:text-slate-300">
              {mixedColor === '' ? (lang === 'zh' ? '透明' : lang === 'ja' ? '透明' : 'TRANSPARENT') : mixedColor}
            </span>
          </div>
          <div 
            className="w-12 h-12 rounded-lg border-2 border-slate-100 dark:border-slate-600 shadow-inner" 
            style={{
              backgroundColor: mixedColor || 'transparent',
              backgroundImage: mixedColor === '' ? 'repeating-conic-gradient(#E0E0E0 0% 25%, #FFFFFF 0% 50%)' : 'none',
              backgroundSize: '15px 15px'
            }}
          />
        </div>
        
        <div className="w-px bg-slate-200 dark:bg-slate-700"></div>
        
        <div className="flex items-center gap-3">
          <div 
            className="w-12 h-12 rounded-lg border-2 border-slate-100 dark:border-slate-600 shadow-inner" 
            style={{backgroundColor: targetColor?.hex || 'transparent'}}
          />
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase">
              {lang === 'zh' ? '目标颜色' : lang === 'ja' ? 'ターゲット' : 'Target Color'}
            </span>
            <span className="text-sm font-mono font-bold text-slate-700 dark:text-slate-300">
              {targetColor?.hex || (lang === 'zh' ? '无' : lang === 'ja' ? 'なし' : 'NONE')}
            </span>
          </div>
        </div>
        
        <div className="w-px bg-slate-200 dark:bg-slate-700"></div>
        
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase">
              {lang === 'zh' ? '目标总量' : lang === 'ja' ? '目標量' : 'Target Vol'}
            </span>
            <input
              type="number"
              min="1"
              max="100"
              value={targetVolume}
              onChange={(e) => setTargetVolume(Math.max(1, parseInt(e.target.value) || 20))}
              className="w-20 px-2 py-1 text-center font-mono text-sm font-bold border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
            />
          </div>
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-macaron-blue hover:bg-blue-600 text-white rounded-md text-sm font-medium transition-colors shadow-sm"
          >
            {lang === 'zh' ? '🔄 重置' : lang === 'ja' ? '🔄 リセット' : '🔄 Reset'}
          </button>
        </div>
      </div>
      
      {/* Control Panel */}
      <div className="w-full max-w-xl bg-slate-50 dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 mt-4">
        
        {/* Volume Recipe Display */}
        {volumes.length > 0 && (
          <div className="border-t border-slate-200 dark:border-slate-600 pt-3 mt-3">
            <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">
              {lang === 'zh' ? '📊 混合配方' : lang === 'ja' ? '📊 レシピ' : '📊 RECIPE'}
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {volumes.map((vol, i) => (
                <div key={i} className="flex items-center justify-between text-xs bg-white dark:bg-slate-700 p-2 rounded border border-slate-200 dark:border-slate-600">
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-6 h-6 rounded border border-slate-300 dark:border-slate-500"
                      style={{ backgroundColor: vol.hex }}
                    />
                    <span className="font-mono text-slate-700 dark:text-slate-300">{vol.hex}</span>
                  </div>
                  <div className="flex items-center space-x-3">
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
            <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-600 flex justify-between text-xs font-bold">
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
      
      <div className="text-xs text-slate-500 dark:text-slate-400 text-center max-w-md">
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
