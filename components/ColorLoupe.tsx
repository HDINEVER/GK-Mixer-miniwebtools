import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { rgbToHex } from "../utils/colorUtils";

export interface ColorLoupeHandle {
  updateAtClient: (clientX: number, clientY: number) => void;
  hide: () => void;
}

interface ColorLoupeProps {
  active: boolean;
  canvas: HTMLCanvasElement | null;
}

const SIZE = 112;
const MAG = 9;

const ColorLoupe = forwardRef<ColorLoupeHandle, ColorLoupeProps>(({ active, canvas }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const loupeCanvasRef = useRef<HTMLCanvasElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const hexTextRef = useRef<HTMLSpanElement>(null);

  const rafIdRef = useRef<number | null>(null);
  const pendingPointRef = useRef<{ x: number; y: number } | null>(null);
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

    const { x: clientX, y: clientY } = pt;
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

      // Draw crisp center crosshair reticle
      const cellPx = SIZE / srcSize;
      const centerOffset = half * cellPx;
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.lineWidth = 2;
      ctx.strokeRect(centerOffset - 0.5, centerOffset - 0.5, cellPx + 1, cellPx + 1);
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = 1.25;
      ctx.strokeRect(centerOffset, centerOffset, cellPx, cellPx);
    }

    // Clamp loupe position within viewport so finger/cursor never hides it off-screen
    const vw = window.innerWidth || 390;
    let left = clientX - SIZE / 2;
    let top = clientY - SIZE - 42;
    if (top < 12) {
      top = clientY + 28;
    }
    left = Math.max(8, Math.min(vw - SIZE - 8, left));

    const container = containerRef.current;
    container.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
    if (!isVisibleRef.current) {
      container.style.opacity = "1";
      isVisibleRef.current = true;
    }

    if (dotRef.current) {
      dotRef.current.style.backgroundColor = hex;
    }
    if (hexTextRef.current) {
      hexTextRef.current.textContent = hex;
    }
  };

  useImperativeHandle(ref, () => ({
    updateAtClient(clientX: number, clientY: number) {
      pendingPointRef.current = { x: clientX, y: clientY };
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
      <canvas
        ref={loupeCanvasRef}
        width={SIZE}
        height={SIZE}
        className="h-24 w-24 rounded-full border-2 border-white shadow-xl ring-1 ring-black/25"
      />
      <div className="mt-1 flex items-center gap-1 rounded-full bg-black/80 px-2.5 py-0.5 font-mono text-[10px] font-bold text-white shadow-md backdrop-blur-xs">
        <span
          ref={dotRef}
          className="inline-block h-2.5 w-2.5 rounded-full border border-white/50"
          style={{ backgroundColor: "#000000" }}
        />
        <span ref={hexTextRef}>#000000</span>
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
