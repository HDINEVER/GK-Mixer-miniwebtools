import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ExtractMarker } from "../utils/exportAnnotatedImage";
import { PaintBottleImg } from "./PaintBottleHover";

interface ExtractMarkerOverlayProps {
  markers: ExtractMarker[];
  selectedId: string | null;
  viewScale: number;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onMoveLabel?: (id: string, labelNx: number, labelNy: number) => void;
  showRemove?: boolean;
}

const CARD_W = 160;
const CARD_H = 72;
const defaultLabel = (nx: number, ny: number, overlayW: number, overlayH: number) => {
  const w = CARD_W / Math.max(overlayW, 1);
  const h = CARD_H / Math.max(overlayH, 1);
  const gap = 18 / Math.max(overlayW, 1);
  const left = nx > 0.55 ? Math.max(0.01, nx - w - gap) : Math.min(1 - w, nx + gap);
  const top = Math.min(1 - h, Math.max(0.01, ny - h / 2));
  return { left, top };
};

const ExtractMarkerOverlay: React.FC<ExtractMarkerOverlayProps> = ({
  markers,
  selectedId,
  viewScale,
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
      const fallback = defaultLabel(marker.nx, marker.ny, overlayBox.w, overlayBox.h);
      move(marker.id, fallback.left, fallback.top);
    }
  }, [markers, overlayBox.w, overlayBox.h]);

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
        const fallback = defaultLabel(marker.nx, marker.ny, w, h);
        return {
          marker,
          left: marker.labelNx ?? fallback.left,
          top: marker.labelNy ?? fallback.top,
        };
      });
  }, [markers, overlayBox.w, overlayBox.h]);

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
    const cardWn = CARD_W / Math.max(w, 1);
    const cardHn = CARD_H / Math.max(h, 1);
    const nx = Math.min(1 - cardWn, Math.max(0, point.nx - dragRef.current.grabX));
    const ny = Math.min(1 - cardHn, Math.max(0, point.ny - dragRef.current.grabY));
    onMoveLabel(dragRef.current.id, nx, ny);
  };

  const onCardPointerUp = () => {
    dragRef.current = null;
  };

  return (
    <div ref={rootRef} className="pointer-events-none relative z-10 h-full w-full">
      <svg className="absolute inset-0 h-full w-full overflow-visible">
        {positions.map(({ marker, left, top }) => {
          if (!marker.paint || overlayBox.w < 2 || overlayBox.h < 2) return null;
          const boxW = overlayBox.w || 1;
          const boxH = overlayBox.h || 1;
          const cardWn = (CARD_W / boxW) * 100;
          const cardHn = (CARD_H / boxH) * 100;
          const pinX = marker.nx * 100;
          const pinY = marker.ny * 100;
          const cx = left * 100 + cardWn / 2;
          const cy = top * 100 + cardHn / 2;
          const fromX = pinX > cx ? left * 100 + cardWn : left * 100;
          const fromY = pinY > cy ? top * 100 + cardHn : top * 100;
          return (
            <g key={`line-${marker.id}`}>
              <line
                x1={`${pinX}%`}
                y1={`${pinY}%`}
                x2={`${fromX}%`}
                y2={`${fromY}%`}
                stroke="rgba(0,0,0,0.4)"
                strokeWidth={2.5}
              />
              <line
                x1={`${pinX}%`}
                y1={`${pinY}%`}
                x2={`${fromX}%`}
                y2={`${fromY}%`}
                stroke="rgba(255,255,255,0.95)"
                strokeWidth={1.25}
              />
            </g>
          );
        })}
      </svg>

      {positions.map(({ marker, left, top }) => {
        const paint = marker.paint;
        const active = marker.id === selectedId;
        return (
          <div key={marker.id}>
            <button
              type="button"
              className="pointer-events-auto absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-transparent"
              style={{
                left: `${marker.nx * 100}%`,
                top: `${marker.ny * 100}%`,
                transform: `translate(-50%, -50%) scale(${ui})`,
                boxShadow: "0 0 0 1px rgba(0,0,0,0.35)",
              }}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(marker.id);
              }}
            />
            {paint && (
              <div
                className="pointer-events-auto absolute cursor-grab active:cursor-grabbing"
                style={{
                  left: `${left * 100}%`,
                  top: `${top * 100}%`,
                  width: CARD_W,
                  transform: `scale(${ui})`,
                  transformOrigin: "top left",
                }}
                onPointerDown={(event) => onCardPointerDown(event, marker.id, left, top)}
                onPointerMove={onCardPointerMove}
                onPointerUp={onCardPointerUp}
                onPointerCancel={onCardPointerUp}
              >
                <SwatchCard
                  marker={marker}
                  active={active}
                  showRemove={showRemove}
                  onRemove={() => onRemove(marker.id)}
                />
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
  showRemove: boolean;
  onRemove: () => void;
}> = ({ marker, active, showRemove, onRemove }) => {
  const paint = marker.paint!;
  const paintHex = paint.hex.toUpperCase();
  const sampleHex = marker.hex.toUpperCase();
  const showSample = sampleHex !== paintHex;
  return (
    <div
      className={`group relative flex w-[160px] items-stretch overflow-visible rounded-xl border bg-white shadow-lg ${
        active ? "border-sky-400 ring-2 ring-sky-300/70" : "border-slate-200/80"
      }`}
    >
      <div className="flex h-[72px] w-[52px] flex-shrink-0 items-center justify-center overflow-hidden rounded-l-[11px] bg-slate-50 px-0.5">
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
              color:
                parseInt(paintHex.slice(1, 3), 16) * 0.299 +
                  parseInt(paintHex.slice(3, 5), 16) * 0.587 +
                  parseInt(paintHex.slice(5, 7), 16) * 0.114 >
                128
                  ? "#000"
                  : "#fff",
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
      <div className="min-w-0 flex-1 rounded-r-xl px-2 py-1.5">
        <div className="truncate text-[11px] font-bold leading-tight text-slate-800">
          {paint.brand} {paint.code}
        </div>
        <div className="truncate text-[10px] leading-tight text-slate-500">{paint.name}</div>
        <span
          className="mt-1 inline-block rounded-md px-1.5 py-px font-mono text-[9px] font-bold tabular-nums"
          style={{
            backgroundColor: paintHex,
            color:
              parseInt(paintHex.slice(1, 3), 16) * 0.299 +
                parseInt(paintHex.slice(3, 5), 16) * 0.587 +
                parseInt(paintHex.slice(5, 7), 16) * 0.114 >
              128
                ? "#000"
                : "#fff",
          }}
        >
          {paintHex}
        </span>
      </div>
      {showSample && (
        <span
          className="absolute -right-1 -top-5 z-20 rounded-full px-1.5 py-px font-mono text-[8px] font-bold text-white shadow"
          style={{ backgroundColor: sampleHex }}
        >
          {sampleHex}
        </span>
      )}
      {showRemove && (
        <button
          type="button"
          className="absolute -right-2 -top-2 z-30 flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[11px] leading-none text-white opacity-0 shadow-md pointer-events-none hover:bg-red-500 group-hover:pointer-events-auto group-hover:opacity-100"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          aria-label="Remove"
        >
          ×
        </button>
      )}
    </div>
  );
};

export default ExtractMarkerOverlay;
