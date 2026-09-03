import React, { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { paintBottleUrls } from "../utils/paintBottle";

export const PaintBottleImg: React.FC<{
  brand: string;
  code: string;
  className?: string;
  alt?: string;
}> = ({ brand, code, className, alt = "" }) => {
  const urls = paintBottleUrls(brand, code);
  const [urlIndex, setUrlIndex] = useState(0);
  useEffect(() => setUrlIndex(0), [brand, code]);
  const src = urls[urlIndex];
  if (!src) return null;
  return (
    <img
      src={src}
      alt={alt}
      crossOrigin="anonymous"
      className={className}
      onError={() => setUrlIndex((index) => index + 1)}
    />
  );
};

interface PaintBottleHoverProps {
  brand: string;
  code: string;
  name?: string;
  hex: string;
  children: React.ReactNode;
  className?: string;
}

const PaintBottleHover: React.FC<PaintBottleHoverProps> = ({
  brand,
  code,
  name,
  hex,
  children,
  className,
}) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const labelId = useId();

  const showAt = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const width = 160;
    const height = 220;
    const gap = 12;
    const pad = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const leftX = rect.left - gap - width;
    const rightX = rect.right + gap;
    const canLeft = leftX >= pad;
    const canRight = rightX + width <= vw - pad;

    // Prefer the left so the card never sits on the row's Use button.
    let x: number;
    if (canLeft) x = leftX;
    else if (canRight) x = rightX;
    else x = rect.left >= vw - rect.right ? pad : vw - width - pad;

    let y = rect.top;
    if (y + height > vh - pad) y = vh - height - pad;
    if (y < pad) y = pad;

    const overlapsRow =
      x < rect.right && x + width > rect.left && y < rect.bottom && y + height > rect.top;
    if (overlapsRow) {
      const aboveY = rect.top - gap - height;
      if (aboveY >= pad) y = aboveY;
      else y = Math.min(vh - height - pad, rect.bottom + gap);
    }

    setPos({ x, y });
    setOpen(true);
  };

  return (
    <div
      className={className}
      onMouseEnter={(event) => showAt(event.currentTarget)}
      onMouseLeave={() => setOpen(false)}
      onFocus={(event) => showAt(event.currentTarget)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open &&
        createPortal(
          <div
            id={labelId}
            className="pointer-events-none fixed z-[90] w-40 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-900"
            style={{ left: pos.x, top: pos.y }}
            role="tooltip"
          >
            <div className="relative flex h-36 items-center justify-center bg-slate-50 dark:bg-slate-800">
              <div
                className="absolute h-16 w-16 rounded-lg border border-slate-200 shadow-inner dark:border-slate-600"
                style={{ backgroundColor: hex }}
              />
              <PaintBottleImg
                brand={brand}
                code={code}
                className="relative z-[1] max-h-full max-w-full object-contain outline outline-1 outline-black/10 dark:outline-white/10"
              />
            </div>
            <div className="border-t border-slate-100 px-2.5 py-2 dark:border-slate-700">
              <div className="truncate font-mono text-[10px] font-bold text-slate-700 dark:text-slate-200">
                {brand} {code}
              </div>
              {name && (
                <div className="truncate text-[10px] text-slate-500">{name}</div>
              )}
              <div
                className="mt-1 inline-block rounded px-1.5 py-0.5 font-mono text-[9px] font-bold tabular-nums"
                style={{
                  backgroundColor: hex,
                  color:
                    parseInt(hex.slice(1, 3), 16) * 0.299 +
                      parseInt(hex.slice(3, 5), 16) * 0.587 +
                      parseInt(hex.slice(5, 7), 16) * 0.114 >
                    128
                      ? "#000"
                      : "#fff",
                }}
              >
                {hex}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default PaintBottleHover;
