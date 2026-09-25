import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ExtractMarker } from "../utils/exportAnnotatedImage";
import {
  BASE_CARD_H,
  BASE_CARD_W,
  calculateLeaderLine,
  DEFAULT_SWATCH_SETTINGS,
  getCanvasScale,
  SwatchSettings,
} from "../utils/swatchLayout";
import { PaintBottleImg } from "./PaintBottleHover";

interface ExtractMarkerOverlayProps {
  markers: ExtractMarker[];
  selectedId: string | null;
  viewScale: number;
  settings?: SwatchSettings;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onMoveLabel?: (id: string, labelNx: number, labelNy: number) => void;
  showRemove?: boolean;
}

const defaultLabel = (
  nx: number,
  ny: number,
  overlayW: number,
  overlayH: number,
  cardW: number,
  cardH: number
) => {
  const w = cardW / Math.max(overlayW, 1);
  const h = cardH / Math.max(overlayH, 1);
  const gap = Math.max(8, overlayW * 0.02) / Math.max(overlayW, 1);
  const left = nx > 0.55 ? Math.max(0.01, nx - w - gap) : Math.min(Math.max(0, 1 - w), nx + gap);
  const top = Math.min(Math.max(0, 1 - h), Math.max(0.01, ny - h / 2));
  return { left, top };
};

const ExtractMarkerOverlay: React.FC<ExtractMarkerOverlayProps> = ({
  markers,
  selectedId,
  viewScale,
  settings = DEFAULT_SWATCH_SETTINGS,
  onSelect,
  onRemove,
  onMoveLabel,
  showRemove = true,
}) => {
  const ui = 1 / Math.max(viewScale, 0.01);
  const rootRef = useRef<HTMLDivElement>(null);
  const onMoveLabelRef = useRef(onMoveLabel);
  onMoveLabelRef.current = onMoveLabel;
  const [overlayBox, setOverlayBox] = useState({ w: 0, h: 0 });
  const dragRef = useRef<{
    id: string;
    grabX: number;
    grabY: number;
  } | null>(null);

  const boxW = overlayBox.w || 1;
  const boxH = overlayBox.h || 1;
  const canvasScale = getCanvasScale(boxW, boxH);
  const cardScale = settings.cardScale ?? 1.0;
  const visualScale = canvasScale * cardScale * ui;
  const effectiveCardW = BASE_CARD_W * visualScale;
  const effectiveCardH = BASE_CARD_H * visualScale;

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let frame = 0;
    const applySize = (w: number, h: number) => {
      if (!w || !h) return;
      setOverlayBox((prev) =>
        Math.abs(prev.w - w) < 0.5 && Math.abs(prev.h - h) < 0.5 ? prev : { w, h }
      );
    };
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => applySize(rect.width, rect.height));
    });
    observer.observe(el);
    applySize(el.clientWidth, el.clientHeight);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const move = onMoveLabelRef.current;
    if (!move || overlayBox.w < 2 || overlayBox.h < 2) return;
    for (const marker of markers) {
      if (!marker.paint || marker.labelNx != null) continue;
      const fallback = defaultLabel(
        marker.nx,
        marker.ny,
        overlayBox.w,
        overlayBox.h,
        effectiveCardW,
        effectiveCardH
      );
      move(marker.id, fallback.left, fallback.top);
    }
  }, [markers, overlayBox.w, overlayBox.h, effectiveCardW, effectiveCardH]);

  const overlaySize = () => {
    const rect = rootRef.current?.getBoundingClientRect();
    const w = rect?.width || overlayBox.w;
    const h = rect?.height || overlayBox.h;
    return { w, h, rect };
  };

  const positions = useMemo(() => {
    const w = overlayBox.w || 1;
    const h = overlayBox.h || 1;
    return markers
      .filter((marker) => Number.isFinite(marker.nx) && Number.isFinite(marker.ny))
      .map((marker) => {
        const fallback = defaultLabel(
          marker.nx,
          marker.ny,
          w,
          h,
          effectiveCardW,
          effectiveCardH
        );
        return {
          marker,
          left: marker.labelNx ?? fallback.left,
          top: marker.labelNy ?? fallback.top,
        };
      });
  }, [markers, overlayBox.w, overlayBox.h, effectiveCardW, effectiveCardH]);

  const clientToNorm = (clientX: number, clientY: number) => {
    const { rect, w, h } = overlaySize();
    if (!rect || w < 1 || h < 1) return { nx: 0, ny: 0 };
    return {
      nx: (clientX - rect.left) / w,
      ny: (clientY - rect.top) / h,
    };
  };

  const onCardPointerDown = (
    event: React.PointerEvent,
    id: string,
    left: number,
    top: number
  ) => {
    event.preventDefault();
    event.stopPropagation();
    onSelect(id);
    const point = clientToNorm(event.clientX, event.clientY);
    dragRef.current = {
      id,
      grabX: point.nx - left,
      grabY: point.ny - top,
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const onCardPointerMove = (event: React.PointerEvent) => {
    if (!dragRef.current || !onMoveLabel) return;
    const { w, h } = overlaySize();
    const point = clientToNorm(event.clientX, event.clientY);
    const cardWn = effectiveCardW / Math.max(w, 1);
    const cardHn = effectiveCardH / Math.max(h, 1);
    const nx = Math.min(1 - cardWn, Math.max(0, point.nx - dragRef.current.grabX));
    const ny = Math.min(1 - cardHn, Math.max(0, point.ny - dragRef.current.grabY));
    onMoveLabel(dragRef.current.id, nx, ny);
  };

  const onCardPointerUp = () => {
    dragRef.current = null;
  };

  const pinSize = Math.max(10, Math.round(14 * visualScale));

  return (
    <div ref={rootRef} className="pointer-events-none relative z-10 h-full w-full">
      <svg className="absolute inset-0 h-full w-full overflow-visible pointer-events-none">
        {positions.map(({ marker, left, top }) => {
          if (!marker.paint || overlayBox.w < 2 || overlayBox.h < 2) return null;
          const cardX = left * boxW;
          const cardY = top * boxH;
          const pinX = marker.nx * boxW;
          const pinY = marker.ny * boxH;

          const line = calculateLeaderLine(
            { x: cardX, y: cardY, w: effectiveCardW, h: effectiveCardH },
            { x: pinX, y: pinY },
            settings.lineStyle,
            Math.max(4, 6 * visualScale),
            visualScale
          );

          const paintHex = marker.paint.hex.toUpperCase();
          const matchColor = settings.lineMatchPaintColor;
          const strokeWidth = Math.max(1.2, (settings.lineWidth ?? 2.5) * visualScale);
          const outerWidth = strokeWidth * 1.8;

          return (
            <g key={`line-${marker.id}`}>
              {/* Outer shadow / high-contrast stroke */}
              <path
                d={line.svgPath}
                fill="none"
                stroke={matchColor ? "rgba(0,0,0,0.65)" : "rgba(0,0,0,0.45)"}
                strokeWidth={outerWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Inner stroke */}
              <path
                d={line.svgPath}
                fill="none"
                stroke={matchColor ? paintHex : "rgba(255,255,255,0.96)"}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          );
        })}
      </svg>

      {positions.map(({ marker, left, top }) => {
        const paint = marker.paint;
        const active = marker.id === selectedId;
        const paintHex = paint?.hex.toUpperCase();
        const matchColor = settings.lineMatchPaintColor;

        return (
          <div key={marker.id}>
            {/* Sample point pin */}
            <button
              type="button"
              className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform hover:scale-125"
              style={{
                left: `${marker.nx * 100}%`,
                top: `${marker.ny * 100}%`,
                width: pinSize,
                height: pinSize,
                transform: 'translate(-50%, -50%)',
                backgroundColor: matchColor && paintHex ? paintHex : "transparent",
                border: "2px solid #ffffff",
                boxShadow: matchColor
                  ? "0 0 0 1.5px rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.35)"
                  : "0 0 0 1.5px rgba(0,0,0,0.35)",
              }}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(marker.id);
              }}
              title={paint ? `${paint.brand} ${paint.code} (${marker.hex})` : marker.hex}
            />

            {/* Draggable Swatch Card */}
            {paint && (
              <div
                className="pointer-events-auto absolute cursor-grab active:cursor-grabbing select-none"
                style={{
                  left: `${left * 100}%`,
                  top: `${top * 100}%`,
                  width: effectiveCardW,
                  height: effectiveCardH,
                }}
                onPointerDown={(event) => onCardPointerDown(event, marker.id, left, top)}
                onPointerMove={onCardPointerMove}
                onPointerUp={onCardPointerUp}
                onPointerCancel={onCardPointerUp}
              >
                <div
                  style={{
                    width: BASE_CARD_W,
                    height: BASE_CARD_H,
                    transform: `scale(${visualScale})`,
                    transformOrigin: "top left",
                  }}
                >
                  <SwatchCard
                    marker={marker}
                    active={active}
                    glassEffect={settings.cardGlassEffect}
                    showRemove={showRemove}
                    onRemove={() => onRemove(marker.id)}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const SwatchCard: React.FC<{
  marker: ExtractMarker;
  active: boolean;
  glassEffect: boolean;
  showRemove: boolean;
  onRemove: () => void;
}> = ({ marker, active, glassEffect, showRemove, onRemove }) => {
  const paint = marker.paint!;
  const paintHex = paint.hex.toUpperCase();
  const sampleHex = marker.hex.toUpperCase();
  const showSample = sampleHex !== paintHex;

  const isLightHex = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16) * 0.299;
    const g = parseInt(hex.slice(3, 5), 16) * 0.587;
    const b = parseInt(hex.slice(5, 7), 16) * 0.114;
    return r + g + b > 128;
  };

  return (
    <div
      className={`group relative flex w-[160px] h-[72px] items-stretch overflow-visible rounded-xl transition-all ${
        glassEffect
          ? "bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/50 dark:border-white/20 shadow-xl"
          : "bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700 shadow-lg"
      } ${active ? "ring-2 ring-sky-400 border-sky-400" : ""}`}
    >
      {/* Left thumbnail / bottle */}
      <div
        className={`flex h-[72px] w-[52px] flex-shrink-0 items-center justify-center overflow-hidden rounded-l-[11px] px-0.5 ${
          glassEffect
            ? "bg-white/40 dark:bg-slate-800/40 border-r border-white/30 dark:border-white/10"
            : "bg-slate-50 dark:bg-slate-800 border-r border-slate-100 dark:border-slate-800"
        }`}
      >
        <div className="relative flex h-full w-full items-center justify-center">
          <svg viewBox="0 0 40 44" className="h-11 w-9">
            <polygon
              points="20,2 38,12 38,32 20,42 2,32 2,12"
              fill={paintHex}
              stroke="rgba(0,0,0,0.18)"
              strokeWidth="1"
            />
          </svg>
          <span
            className="absolute max-w-[40px] truncate text-center font-mono text-[7px] font-bold leading-none"
            style={{
              color: isLightHex(paintHex) ? "#000" : "#fff",
            }}
          >
            {paint.code}
          </span>
          <PaintBottleImg
            brand={paint.brand}
            code={paint.code}
            className="absolute inset-0 h-full w-full object-contain p-0.5"
          />
        </div>
      </div>

      {/* Right text info */}
      <div className="min-w-0 flex-1 flex flex-col justify-center rounded-r-xl px-2 py-1.5">
        <div className="truncate text-[11px] font-bold leading-tight text-slate-800 dark:text-slate-100">
          {paint.brand} {paint.code}
        </div>
        <div className="truncate text-[10px] leading-tight text-slate-500 dark:text-slate-400 mt-0.5">
          {paint.name}
        </div>
        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
          <span
            className="inline-block rounded px-1.5 py-px font-mono text-[9px] font-bold tabular-nums"
            style={{
              backgroundColor: paintHex,
              color: isLightHex(paintHex) ? "#000" : "#fff",
            }}
          >
            {paintHex}
          </span>
        </div>
      </div>

      {/* Sample hex badge if different */}
      {showSample && (
        <span
          className="absolute -right-1 -top-4 z-20 rounded-full px-1.5 py-px font-mono text-[8px] font-bold text-white shadow"
          style={{ backgroundColor: sampleHex }}
          title={`采样色: ${sampleHex}`}
        >
          {sampleHex}
        </span>
      )}

      {/* Remove button */}
      {showRemove && (
        <button
          type="button"
          className="absolute -right-2 -top-2 z-30 flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[11px] leading-none text-white opacity-0 shadow-md pointer-events-none hover:bg-red-500 group-hover:pointer-events-auto group-hover:opacity-100 transition-opacity"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          aria-label="Remove"
          title="移除此色卡标注"
        >
          ×
        </button>
      )}
    </div>
  );
};

export default ExtractMarkerOverlay;
