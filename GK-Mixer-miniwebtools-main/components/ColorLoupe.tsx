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

const SIZE = 96;
const MAG = 2.4;
export const TOUCH_FRONT_OFFSET_PX = 48;

/**
 * Resolves a mobile touch coordinate so the user's finger holds the BOTTOM EDGE (rim handle)
 * of the 96px Crosshair Selector Ring (radius = 48px), while the sampled pixel is at the
 * exact CENTER CROSSHAIR point of the ring (48px above the finger).
 */
export const resolveTouchSamplePoint = (
  canvas: HTMLCanvasElement,
  touchClientX: number,
  touchClientY: number,
  frontOffsetPx: number = TOUCH_FRONT_OFFSET_PX
): { targetX: number; targetY: number; isInsideTouch: boolean } => {
  const rect = canvas.getBoundingClientRect();
  // Allow touching up to frontOffsetPx below the canvas bottom edge so the center crosshair
  // can still reach the very bottom pixel of the image while dragging the bottom rim!
  const isInsideTouch =
    rect.width > 0 &&
    rect.height > 0 &&
    touchClientX >= rect.left - 12 &&
    touchClientX <= rect.right + 12 &&
    touchClientY >= rect.top - 8 &&
    touchClientY <= rect.bottom + frontOffsetPx + 12;

  if (!isInsideTouch) {
    return { targetX: touchClientX, targetY: touchClientY, isInsideTouch: false };
  }

  const targetX = Math.max(rect.left + 1, Math.min(rect.right - 1, touchClientX));
  const targetY = Math.max(
    rect.top + 1,
    Math.min(rect.bottom - 1, touchClientY - frontOffsetPx)
  );

  return { targetX, targetY, isInsideTouch: true };
};

const ColorLoupe = forwardRef<ColorLoupeHandle, ColorLoupeProps>(({ active, canvas }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const loupeCanvasRef = useRef<HTMLCanvasElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const hexTextRef = useRef<HTMLSpanElement>(null);
  const edgeHandleRef = useRef<HTMLDivElement>(null);

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

    const { x: clientX, y: clientY, touchX } = pt;
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

    // Draw low-zoom (~2.4x) neighborhood into the Crosshair Selector Ring so surrounding part contours are clear
    const loupe = loupeCanvasRef.current;
    const ctx =
      loupe.getContext("2d", { willReadFrequently: true }) ?? loupe.getContext("2d");
    if (ctx) {
      // Sample a 40x40 screen-space equivalent region around (srcX, srcY) for ~2.4x magnification
      const screenSpanPx = SIZE / MAG;
      const srcSpanX = Math.max(12, Math.round(screenSpanPx * scaleX));
      const srcSpanY = Math.max(12, Math.round(screenSpanPx * scaleY));
      const halfX = Math.floor(srcSpanX / 2);
      const halfY = Math.floor(srcSpanY / 2);

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, SIZE, SIZE);
      try {
        ctx.drawImage(
          canvas,
          srcX - halfX,
          srcY - halfY,
          srcSpanX,
          srcSpanY,
          0,
          0,
          SIZE,
          SIZE
        );
      } catch {
        // ignore edge draw errors
      }

      // Draw crisp tactical Crosshair Reticle (+) centered at (SIZE/2, SIZE/2)
      const mid = SIZE / 2;
      const gap = 5;

      // Dark outer halo for contrast on bright/white armor
      ctx.strokeStyle = "rgba(15, 23, 42, 0.78)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(mid, 6);
      ctx.lineTo(mid, mid - gap);
      ctx.moveTo(mid, mid + gap);
      ctx.lineTo(mid, SIZE - 6);
      ctx.moveTo(6, mid);
      ctx.lineTo(mid - gap, mid);
      ctx.moveTo(mid + gap, mid);
      ctx.lineTo(SIZE - 6, mid);
      ctx.stroke();

      // Crisp white inner crosshair lines
      ctx.strokeStyle = "rgba(255, 255, 255, 0.96)";
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(mid, 6);
      ctx.lineTo(mid, mid - gap);
      ctx.moveTo(mid, mid + gap);
      ctx.lineTo(mid, SIZE - 6);
      ctx.moveTo(6, mid);
      ctx.lineTo(mid - gap, mid);
      ctx.moveTo(mid + gap, mid);
      ctx.lineTo(SIZE - 6, mid);
      ctx.stroke();

      // Center sampling reticle ring + exact center pixel dot
      ctx.beginPath();
      ctx.arc(mid, mid, gap, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(15, 23, 42, 0.85)";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(mid, mid, 2, 0, Math.PI * 2);
      ctx.fillStyle = hex;
      ctx.fill();
    }

    // Center the Crosshair Selector Ring directly on the sampled point (clientX, clientY)!
    // The user's finger at (touchX, touchY = clientY + 48) rests right on the bottom rim handle of this ring.
    const left = clientX - SIZE / 2;
    const top = clientY - SIZE / 2;

    const container = containerRef.current;
    container.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
    if (!isVisibleRef.current) {
      container.style.opacity = "1";
      isVisibleRef.current = true;
    }

    if (edgeHandleRef.current) {
      edgeHandleRef.current.style.display = typeof touchX === "number" ? "flex" : "none";
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
    <div
      ref={containerRef}
      className="pointer-events-none fixed top-0 left-0 z-[80] flex flex-col items-center transition-opacity duration-75"
      style={{
        opacity: 0,
        transform: "translate3d(-9999px, -9999px, 0)",
        willChange: "transform, opacity",
      }}
    >
      {/* Top Rim HEX Readout Pill (stays above the ring, never blocked by the finger on the bottom edge) */}
      <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-slate-950/92 px-2.5 py-0.5 font-mono text-[10px] font-bold text-white shadow-md border border-white/25 backdrop-blur-xs whitespace-nowrap">
        <span
          ref={dotRef}
          className="inline-block h-2.5 w-2.5 rounded-full border border-white/75 shrink-0"
          style={{ backgroundColor: "#000000" }}
        />
        <span ref={hexTextRef}>#000000</span>
      </div>

      {/* Unified Low-Zoom (~2.4x) Crosshair Selector Ring centered directly at the sampled point */}
      <div className="relative flex items-center justify-center h-24 w-24">
        <canvas
          ref={loupeCanvasRef}
          width={SIZE}
          height={SIZE}
          className="h-24 w-24 rounded-full border-[2.5px] border-white shadow-[0_4px_18px_rgba(0,0,0,0.45)] ring-2 ring-slate-950/60"
        />
        {/* Outer Rim Crosshair Alignment Notches */}
        <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-[2px] h-2 bg-amber-400 rounded-full shadow-[0_0_2px_#000]" />
        <span className="absolute -left-1 top-1/2 -translate-y-1/2 h-[2px] w-2 bg-amber-400 rounded-full shadow-[0_0_2px_#000]" />
        <span className="absolute -right-1 top-1/2 -translate-y-1/2 h-[2px] w-2 bg-amber-400 rounded-full shadow-[0_0_2px_#000]" />

        {/* Bottom Edge Finger Grip Handle (手指触控拖拽边缘握柄) right at (touchX, touchY) */}
        <div
          ref={edgeHandleRef}
          className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-amber-400 text-slate-950 px-2 py-0.5 text-[9px] font-extrabold shadow-[0_2px_6px_rgba(0,0,0,0.45)] border border-slate-950/40 whitespace-nowrap"
          style={{ display: "none" }}
        >
          <span>⠿</span>
          <span>拖边缘移动</span>
        </div>
      </div>
    </div>
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
