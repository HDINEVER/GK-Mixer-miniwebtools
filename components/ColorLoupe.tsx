import React, { useEffect, useRef } from "react";

interface ColorLoupeProps {
  visible: boolean;
  clientX: number;
  clientY: number;
  hex: string;
  canvas: HTMLCanvasElement | null;
}

const SIZE = 128;
const MAG = 10;

const ColorLoupe: React.FC<ColorLoupeProps> = ({
  visible,
  clientX,
  clientY,
  hex,
  canvas,
}) => {
  const loupeRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!visible || !canvas || !loupeRef.current) return;
    const loupe = loupeRef.current;
    const ctx = loupe.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const srcX = ((clientX - rect.left) / rect.width) * canvas.width;
    const srcY = ((clientY - rect.top) / rect.height) * canvas.height;
    const srcSize = SIZE / MAG;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, SIZE, SIZE);
    try {
      ctx.drawImage(
        canvas,
        srcX - srcSize / 2,
        srcY - srcSize / 2,
        srcSize,
        srcSize,
        0,
        0,
        SIZE,
        SIZE
      );
    } catch {
      return;
    }
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1;
    ctx.strokeRect(SIZE / 2 - 0.5, SIZE / 2 - 0.5, 1, 1);
  }, [visible, clientX, clientY, canvas]);

  if (!visible) return null;

  const left = clientX + 18;
  const top = clientY - SIZE - 12;

  return (
    <div
      className="pointer-events-none fixed z-[80] flex flex-col items-center"
      style={{ left, top }}
    >
      <canvas
        ref={loupeRef}
        width={SIZE}
        height={SIZE}
        className="h-24 w-24 rounded-full border-2 border-white shadow-lg ring-1 ring-black/20"
      />
      <div className="mt-1 rounded-full bg-black/75 px-2 py-0.5 font-mono text-[10px] text-white">
        <span
          className="mr-1 inline-block h-2 w-2 rounded-full border border-white/40"
          style={{ backgroundColor: hex }}
        />
        {hex}
      </div>
    </div>
  );
};

export default ColorLoupe;

export const sampleCanvasAtClient = (
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number
): { r: number; g: number; b: number; nx: number; ny: number } | null => {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  const x = Math.floor(((clientX - rect.left) / rect.width) * canvas.width);
  const y = Math.floor(((clientY - rect.top) / rect.height) * canvas.height);
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return null;
  const ctx =
    canvas.getContext("2d", { willReadFrequently: true }) ?? canvas.getContext("2d");
  if (!ctx) return null;
  try {
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    return {
      r: pixel[0],
      g: pixel[1],
      b: pixel[2],
      nx: x / canvas.width,
      ny: y / canvas.height,
    };
  } catch {
    return null;
  }
};
