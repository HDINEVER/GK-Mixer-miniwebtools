import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { rgbToHex } from "../utils/colorUtils";

export interface ColorLoupeHandle {
  updateAtClient: (
    clientX: number,
    clientY: number,
    rawTouchX?: number,
    rawTouchY?: number
  ) => void;
  hide: () => void;
}

interface ColorLoupeProps {
  active: boolean;
  canvas: HTMLCanvasElement | null;
}

const SIZE = 112;
const MAG = 9;
export const TOUCH_FRONT_OFFSET_PX = 52;

/**
 * Resolves a mobile touch coordinate to an offset sample point in front of (above) the user's thumb,
 * inspired by WeChat / iOS text selection cursor & magnifier so the thumb never blocks the target pixel.
 * Smoothly ramps near the top edge of the canvas so top-row pixels remain 100% reachable.
 */
export const resolveTouchSamplePoint = (
  canvas: HTMLCanvasElement,
  touchClientX: number,
  touchClientY: number,
  frontOffsetPx: number = TOUCH_FRONT_OFFSET_PX
): { targetX: number; targetY: number; isInsideTouch: boolean } => {
  const rect = canvas.getBoundingClientRect();
  const isInsideTouch =
    rect.width > 0 &&
    rect.height > 0 &&
    touchClientX >= rect.left - 8 &&
    touchClientX <= rect.right + 8 &&
    touchClientY >= rect.top - 8 &&
    touchClientY <= rect.bottom + 24;

  if (!isInsideTouch) {
    return { targetX: touchClientX, targetY: touchClientY, isInsideTouch: false };
  }

  const distFromTop = Math.max(0, touchClientY - rect.top);
  const rampZone = frontOffsetPx * 1.35;
  const effectiveOffset =
    distFromTop < rampZone
      ? distFromTop * (frontOffsetPx / rampZone)
      : frontOffsetPx;

  const targetX = Math.max(rect.left + 1, Math.min(rect.right - 1, touchClientX));
  const targetY = Math.max(
    rect.top + 1,
    Math.min(rect.bottom - 1, touchClientY - effectiveOffset)
  );

  return { targetX, targetY, isInsideTouch: true };
};

const ColorLoupe = forwardRef<ColorLoupeHandle, ColorLoupeProps>(({ active, canvas }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const targetSightRef = useRef<HTMLDivElement>(null);
  const targetDotRef = useRef<HTMLSpanElement>(null);
  const stemRef = useRef<HTMLDivElement>(null);
  const loupeCanvasRef = useRef<HTMLCanvasElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const hexTextRef = useRef<HTMLSpanElement>(null);

  const rafIdRef = useRef<number | null>(null);
  const pendingPointRef = useRef<{
    x: number;
    y: number;
    touchX?: number;
    touchY?: number;
  } | null>(null);
  const isVisibleRef = useRef(false);

  const hideNow = () => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    pendingPointRef.current = null;
    isVisibleRef.current = false;
    if (containerRef.current) {
      containerRef.current.style.opacity = "0";
      containerRef.current.style.transform = "translate3d(-9999px, -9999px, 0)";
    }
    if (targetSightRef.current) {
      targetSightRef.current.style.opacity = "0";
      targetSightRef.current.style.transform = "translate3d(-9999px, -9999px, 0)";
    }
  };

  const renderFrame = () => {
    rafIdRef.current = null;
    const pt = pendingPointRef.current;
    if (!active || !canvas || !pt || !containerRef.current || !loupeCanvasRef.current) {
      hideNow();
      return;
    }

    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      hideNow();
      return;
    }

    const { x: clientX, y: clientY, touchX, touchY } = pt;
    const relX = (clientX - rect.left) / rect.width;
    const relY = (clientY - rect.top) / rect.height;

    if (relX < 0 || relY < 0 || relX > 1 || relY > 1 || canvas.width <= 0 || canvas.height <= 0) {
      hideNow();
      return;
    }

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const srcX = Math.max(0, Math.min(Math.round((clientX - rect.left) * scaleX), canvas.width - 1));
    const srcY = Math.max(0, Math.min(Math.round((clientY - rect.top) * scaleY), canvas.height - 1));

    // Read pixel from source canvas (with willReadFrequently context)
    const srcCtx =
      canvas.getContext("2d", { willReadFrequently: true }) ?? canvas.getContext("2d");
    if (!srcCtx) {
      hideNow();
      return;
    }

    let hex = "#000000";
    try {
      const pixel = srcCtx.getImageData(srcX, srcY, 1, 1).data;
      hex = rgbToHex(pixel[0], pixel[1], pixel[2]);
    } catch (err) {
      console.error(err);
      hideNow();
      return;
    }

    // Draw magnified neighborhood into loupe canvas
    const loupe = loupeCanvasRef.current;
    const ctx =
      loupe.getContext("2d", { willReadFrequently: true }) ?? loupe.getContext("2d");
    if (ctx) {
      const srcSize = Math.max(3, Math.round(SIZE / MAG));
      const half = Math.floor(srcSize / 2);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, SIZE, SIZE);
      try {
        ctx.drawImage(
          canvas,
          srcX - half,
          srcY - half,
          srcSize,
          srcSize,
          0,
          0,
          SIZE,
          SIZE
        );
      } catch {
        // ignore edge draw errors
      }

      // Draw subtle crosshair lines + crisp center pixel reticle inside magnifier
      const cellPx = SIZE / srcSize;
      const centerOffset = half * cellPx;
      const midPx = centerOffset + cellPx / 2;

      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(midPx, 0);
      ctx.lineTo(midPx, centerOffset - 2);
      ctx.moveTo(midPx, centerOffset + cellPx + 2);
      ctx.lineTo(midPx, SIZE);
      ctx.moveTo(0, midPx);
      ctx.lineTo(centerOffset - 2, midPx);
      ctx.moveTo(centerOffset + cellPx + 2, midPx);
      ctx.lineTo(SIZE, midPx);
      ctx.stroke();

      ctx.strokeStyle = "rgba(0,0,0,0.65)";
      ctx.lineWidth = 2;
      ctx.strokeRect(centerOffset - 0.5, centerOffset - 0.5, cellPx + 1, cellPx + 1);
      ctx.strokeStyle = "rgba(255,255,255,0.98)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(centerOffset, centerOffset, cellPx, cellPx);
    }

    // Position the Magnifier Loupe above the target point (or to the side if near top of viewport so it never covers targetSight)
    const vw = window.innerWidth || 390;
    let left = clientX - SIZE / 2;
    let top = clientY - SIZE - 44;
    if (top < 10) {
      top = Math.max(10, clientY - SIZE / 2);
      if (clientX > vw / 2) {
        left = Math.max(8, clientX - SIZE - 28);
      } else {
        left = Math.min(vw - SIZE - 8, clientX + 28);
      }
    } else {
      left = Math.max(8, Math.min(vw - SIZE - 8, left));
    }

    const container = containerRef.current;
    container.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
    if (!isVisibleRef.current) {
      container.style.opacity = "1";
      isVisibleRef.current = true;
    }

    // Position the on-canvas Precision Crosshair Star + Pointer Arrow right at (clientX, clientY)
    if (targetSightRef.current) {
      targetSightRef.current.style.transform = `translate3d(${Math.round(clientX)}px, ${Math.round(clientY)}px, 0)`;
      targetSightRef.current.style.opacity = "1";
      if (targetDotRef.current) {
        targetDotRef.current.style.backgroundColor = hex;
      }
      if (stemRef.current) {
        const stemLen =
          typeof touchY === "number" ? Math.max(0, Math.round(touchY - clientY - 14)) : 0;
        stemRef.current.style.height = `${stemLen}px`;
        stemRef.current.style.display = typeof touchX === "number" && stemLen > 6 ? "flex" : "none";
      }
    }

    if (dotRef.current) {
      dotRef.current.style.backgroundColor = hex;
    }
    if (hexTextRef.current) {
      hexTextRef.current.textContent = hex;
    }
  };

  useImperativeHandle(ref, () => ({
    updateAtClient(
      clientX: number,
      clientY: number,
      rawTouchX?: number,
      rawTouchY?: number
    ) {
      pendingPointRef.current = {
        x: clientX,
        y: clientY,
        touchX: rawTouchX,
        touchY: rawTouchY,
      };
      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(renderFrame);
      }
    },
    hide() {
      hideNow();
    },
  }));

  useEffect(() => {
    if (!active) {
      hideNow();
    }
  }, [active]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  return (
    <>
      {/* 1. On-Canvas Thumb-Front Precision Crosshair Star (十字星) + Pointer Arrow (指示箭头) + Thumb Stem */}
      <div
        ref={targetSightRef}
        className="pointer-events-none fixed top-0 left-0 z-[79] transition-opacity duration-75"
        style={{
          opacity: 0,
          transform: "translate3d(-9999px, -9999px, 0)",
          willChange: "transform, opacity",
        }}
      >
        {/* Crosshair Star centered exactly at (0, 0) = (targetX, targetY) */}
        <div className="relative -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-7 h-7">
          {/* Outer High-Contrast Ring */}
          <span className="absolute inset-0 rounded-full border-2 border-white shadow-[0_0_0_1.5px_rgba(15,23,42,0.85),0_2px_8px_rgba(0,0,0,0.45)]" />
          {/* 4-Way Crosshair Star Ticks (十字星) */}
          <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-[2px] h-2.5 bg-white shadow-[0_0_2px_#000]" />
          <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-[2px] h-2.5 bg-white shadow-[0_0_2px_#000]" />
          <span className="absolute -left-1.5 top-1/2 -translate-y-1/2 h-[2px] w-2.5 bg-white shadow-[0_0_2px_#000]" />
          <span className="absolute -right-1.5 top-1/2 -translate-y-1/2 h-[2px] w-2.5 bg-white shadow-[0_0_2px_#000]" />
          {/* Live Sampled Color Center Dot */}
          <span
            ref={targetDotRef}
            className="w-2 h-2 rounded-full border border-white shadow-[0_0_0_1px_rgba(0,0,0,0.8)]"
            style={{ backgroundColor: "#000000" }}
          />
        </div>

        {/* Upward Pointer Arrow + Guide Stem down to Thumb Contact Point */}
        <div
          ref={stemRef}
          className="absolute left-0 top-[14px] -translate-x-1/2 flex flex-col items-center justify-between"
          style={{ height: 0, display: "none" }}
        >
          {/* Upward Arrowhead pointing directly at the Crosshair Star */}
          <span className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[7px] border-b-amber-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]" />
          {/* Dashed Guide Line from Thumb to Target */}
          <span className="flex-1 w-[1.5px] border-l-2 border-dashed border-amber-400/90 drop-shadow-[0_0_2px_rgba(0,0,0,0.8)]" />
          {/* Subtle Thumb Contact Anchor Ring */}
          <span className="w-3.5 h-3.5 rounded-full border-2 border-amber-400/85 bg-amber-400/20 shadow-[0_0_4px_rgba(0,0,0,0.6)] shrink-0" />
        </div>
      </div>

      {/* 2. Floating 9x Magnifier Loupe (放大镜) */}
      <div
        ref={containerRef}
        className="pointer-events-none fixed top-0 left-0 z-[80] flex flex-col items-center transition-opacity duration-75"
        style={{
          opacity: 0,
          transform: "translate3d(-9999px, -9999px, 0)",
          willChange: "transform, opacity",
        }}
      >
        <div className="relative flex items-center justify-center">
          <canvas
            ref={loupeCanvasRef}
            width={SIZE}
            height={SIZE}
            className="h-24 w-24 rounded-full border-2 border-white shadow-xl ring-2 ring-black/35"
          />
          <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[7px] border-t-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]" />
        </div>
        <div className="mt-1.5 flex items-center gap-1 rounded-full bg-slate-950/90 px-2.5 py-0.5 font-mono text-[10px] font-bold text-white shadow-md border border-white/20 backdrop-blur-xs">
          <span
            ref={dotRef}
            className="inline-block h-2.5 w-2.5 rounded-full border border-white/60"
            style={{ backgroundColor: "#000000" }}
          />
          <span ref={hexTextRef}>#000000</span>
        </div>
      </div>
    </>
  );
});

ColorLoupe.displayName = "ColorLoupe";

export default ColorLoupe;

export const sampleCanvasAtClient = (
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number
): { r: number; g: number; b: number; nx: number; ny: number } | null => {
  if (!canvas || canvas.width <= 0 || canvas.height <= 0) return null;
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  if (
    clientX < rect.left ||
    clientY < rect.top ||
    clientX > rect.right ||
    clientY > rect.bottom
  ) {
    return null;
  }
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = Math.max(0, Math.min(Math.round((clientX - rect.left) * scaleX), canvas.width - 1));
  const y = Math.max(0, Math.min(Math.round((clientY - rect.top) * scaleY), canvas.height - 1));
  const ctx =
    canvas.getContext("2d", { willReadFrequently: true }) ?? canvas.getContext("2d");
  if (!ctx) return null;
  try {
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    return {
      r: pixel[0] ?? 128,
      g: pixel[1] ?? 128,
      b: pixel[2] ?? 128,
      nx: Math.max(0, Math.min(1, x / canvas.width)),
      ny: Math.max(0, Math.min(1, y / canvas.height)),
    };
  } catch (err) {
    console.error(err);
    return null;
  }
};
