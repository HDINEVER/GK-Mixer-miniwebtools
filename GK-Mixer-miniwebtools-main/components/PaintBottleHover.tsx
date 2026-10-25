import React, { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { paintBottleUrls } from "../utils/paintBottle";

export const PaintBottleImg: React.FC<{
  brand: string;
  code: string;
  hex?: string;
  className?: string;
  alt?: string;
}> = ({ brand, code, hex, className, alt = "" }) => {
  const urls = paintBottleUrls(brand, code);
  const [urlIndex, setUrlIndex] = useState(0);
  useEffect(() => setUrlIndex(0), [brand, code]);
  const src = urls[urlIndex];
  if (!src) {
    if (!hex) return null;
    const shortCode = String(code || "").trim().slice(0, 6);
    return (
      <svg
        viewBox="0 0 64 64"
        className={className}
        role="img"
        aria-label={alt || `${brand} ${code}`}
      >
        {/* Bottle Cap (Black/Silver Model Paint Cap) */}
        <rect x="20" y="6" width="24" height="11" rx="3" fill="#1E293B" stroke="#0F172A" strokeWidth="1.5" />
        <line x1="24" y1="8" x2="24" y2="15" stroke="#475569" strokeWidth="1.2" />
        <line x1="28" y1="8" x2="28" y2="15" stroke="#475569" strokeWidth="1.2" />
        <line x1="36" y1="8" x2="36" y2="15" stroke="#475569" strokeWidth="1.2" />
        <line x1="40" y1="8" x2="40" y2="15" stroke="#475569" strokeWidth="1.2" />
        {/* Bottle Neck */}
        <rect x="23" y="17" width="18" height="4" fill="#CBD5E1" stroke="#334155" strokeWidth="1.2" />
        {/* Glass Bottle Body Filled with Paint Hex */}
        <rect x="13" y="21" width="38" height="36" rx="6" fill={hex} stroke="#1E293B" strokeWidth="2" />
        {/* Specular Glass Highlight */}
        <rect x="16" y="24" width="5" height="30" rx="2.5" fill="#FFFFFF" fillOpacity="0.32" />
        {/* Bottle Label Strip */}
        <rect x="14" y="31" width="36" height="15" fill="#FFFFFF" fillOpacity="0.92" />
        <text
          x="32"
          y="41.5"
          textAnchor="middle"
          fontSize="9.5"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fontWeight="900"
          fill="#0F172A"
        >
          {shortCode}
        </text>
      </svg>
    );
  }
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
            className="pointer-events-none fixed z-[90] w-44 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 transition-opacity duration-150 animate-in fade-in"
            style={{ left: pos.x, top: pos.y }}
            role="tooltip"
          >
            <div className="relative flex h-36 items-center justify-center bg-slate-50/90 dark:bg-slate-800/80 p-2">
              <div
                className="absolute h-16 w-16 rounded-xl border border-black/10 shadow-inner dark:border-white/15"
                style={{ backgroundColor: hex }}
              />
              <PaintBottleImg
                brand={brand}
                code={code}
                hex={hex}
                className="relative z-[1] max-h-28 max-w-28 object-contain drop-shadow-md"
              />
            </div>
            <div className="border-t border-slate-100 px-3 py-2.5 dark:border-slate-800">
              <div className="truncate font-mono text-xs font-bold text-slate-800 dark:text-slate-100">
                {brand} {code}
              </div>
              {name && (
                <div className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">{name}</div>
              )}
              <div
                className="mt-1.5 inline-block rounded-md px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums shadow-2xs"
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
                {hex.toUpperCase()}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default PaintBottleHover;
