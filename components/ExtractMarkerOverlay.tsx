import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { XIcon } from "@phosphor-icons/react";
import { ColorData } from "../types";
import { colorsToMarkers, ExtractMarker } from "../utils/exportAnnotatedImage";
import {
  calculateLeaderLine,
  DEFAULT_SWATCH_SETTINGS,
  getCanvasScale,
  getCardBaseDimensions,
  SwatchSettings,
} from "../utils/swatchLayout";
import { PaintBottleImg } from "./PaintBottleHover";

export interface ExtractMarkerOverlayProps {
  markers?: ExtractMarker[];
  colors?: ColorData[];
  selectedId: string | null;
  viewScale?: number;
  settings?: Partial<SwatchSettings>;
  onSelect?: (idOrColor: any) => void;
  onRemove?: (id: string) => void;
  onRequestAssign?: (id: string) => void;
  onMoveLabel?: (id: string, labelNx: number, labelNy: number) => void;
  onUpdatePosition?: (id: string, labelNx: number, labelNy: number) => void;
  showRemove?: boolean;
  interactive?: boolean;
  allowDrag?: boolean;
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

interface ActiveDragState {
  id: string;
  grabX: number;
  grabY: number;
  rectLeft: number;
  rectTop: number;
  rectW: number;
  rectH: number;
  boxW: number;
  boxH: number;
  cW: number;
  cH: number;
  maxX: number;
  maxY: number;
  pinX: number;
  pinY: number;
  pinRadius: number;
  mScale: number;
  latestNx: number;
  latestNy: number;
  moved: boolean;
  wasAlreadySelected: boolean;
  cardEl: HTMLDivElement;
}

export const ExtractMarkerOverlay: React.FC<ExtractMarkerOverlayProps> = ({
  markers: markersProp,
  colors,
  selectedId,
  viewScale = 1,
  settings: settingsProp,
  onSelect,
  onRemove,
  onRequestAssign,
  onMoveLabel,
  onUpdatePosition,
  showRemove = false,
  interactive = true,
  allowDrag = true,
}) => {
  const settings: SwatchSettings = {
    ...DEFAULT_SWATCH_SETTINGS,
    ...settingsProp,
  };

  const markers = useMemo(() => {
    if (markersProp) return markersProp;
    if (colors) return colorsToMarkers(colors);
    return [];
  }, [markersProp, colors]);

  const moveCallback = onMoveLabel || onUpdatePosition;
  const ui = 1 / Math.max(viewScale, 0.01);
  const rootRef = useRef<HTMLDivElement>(null);
  const onMoveLabelRef = useRef(moveCallback);
  onMoveLabelRef.current = moveCallback;

  // Refs to SVG leader line <path> elements for zero-rerender DOM updates during drag
  const outerPathRefs = useRef<Record<string, SVGPathElement | null>>({});
  const innerPathRefs = useRef<Record<string, SVGPathElement | null>>({});
  const dragRafRef = useRef<number | null>(null);
  const dragRef = useRef<ActiveDragState | null>(null);

  const [overlayBox, setOverlayBox] = useState({ w: 0, h: 0 });

  const boxW = overlayBox.w || 1;
  const boxH = overlayBox.h || 1;
  const { baseW, baseH } = getCardBaseDimensions(settings.cardBaseWidth);
  const canvasScale = getCanvasScale(boxW, boxH, baseW);
  const cardScale = settings.cardScale ?? 1.0;
  const visualScale = canvasScale * cardScale * ui;

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
    const measureAndApply = () => {
      const target = el.parentElement || el;
      const w = el.clientWidth || target.clientWidth;
      const h = el.clientHeight || target.clientHeight;
      if (w > 1 && h > 1) {
        applySize(w, h);
      } else {
        const rect = el.getBoundingClientRect();
        const scale = Math.max(viewScale, 0.01);
        if (rect.width > 1 && rect.height > 1) {
          applySize(rect.width / scale, rect.height / scale);
        }
      }
    };
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measureAndApply);
    });
    observer.observe(el);
    const parent = el.parentElement;
    const siblingImg = parent?.querySelector("img") || null;
    const siblingCanvas = parent?.querySelector("canvas") || null;
    if (parent) observer.observe(parent);
    if (siblingImg) {
      observer.observe(siblingImg);
      siblingImg.addEventListener("load", measureAndApply);
    }
    if (siblingCanvas) observer.observe(siblingCanvas);
    measureAndApply();
    return () => {
      cancelAnimationFrame(frame);
      if (siblingImg) {
        siblingImg.removeEventListener("load", measureAndApply);
      }
      observer.disconnect();
    };
  }, [markers.length, viewScale]);

  useEffect(() => {
    return () => {
      if (dragRafRef.current !== null) {
        cancelAnimationFrame(dragRafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const move = onMoveLabelRef.current;
    if (!move || overlayBox.w < 2 || overlayBox.h < 2) return;
    for (const marker of markers) {
      if (!marker.paint || marker.labelNx != null) continue;
      const mScale = (marker.labelScale ?? cardScale) * canvasScale * ui;
      const fallback = defaultLabel(
        marker.nx,
        marker.ny,
        overlayBox.w,
        overlayBox.h,
        baseW * mScale,
        baseH * mScale
      );
      move(marker.id, fallback.left, fallback.top);
    }
  }, [markers, overlayBox.w, overlayBox.h, baseW, baseH, cardScale, canvasScale, ui]);

  const positions = useMemo(() => {
    const w = overlayBox.w || 1;
    const h = overlayBox.h || 1;
    return markers
      .filter((marker) => Number.isFinite(marker.nx) && Number.isFinite(marker.ny))
      .map((marker) => {
        const mScale = (marker.labelScale ?? cardScale) * canvasScale * ui;
        const hasTonal = marker.tonalGradient && marker.tonalGradient.length > 0;
        const cW = baseW * mScale;
        const cH = (baseH + (hasTonal ? 12 : 0)) * mScale;
        const fallback = defaultLabel(marker.nx, marker.ny, w, h, cW, cH);
        const isBeingDragged = dragRef.current?.id === marker.id;
        return {
          marker,
          left: isBeingDragged ? dragRef.current!.latestNx : (marker.labelNx ?? fallback.left),
          top: isBeingDragged ? dragRef.current!.latestNy : (marker.labelNy ?? fallback.top),
          mScale,
          cW,
          cH,
        };
      });
  }, [markers, overlayBox.w, overlayBox.h, baseW, baseH, cardScale, canvasScale, ui, selectedId]);

  const flushDragVisuals = () => {
    dragRafRef.current = null;
    const d = dragRef.current;
    if (!d) return;

    const xPx = d.latestNx * d.boxW;
    const yPx = d.latestNy * d.boxH;
    d.cardEl.style.transform = `translate3d(${xPx}px, ${yPx}px, 0)`;

    const line = calculateLeaderLine(
      { x: xPx, y: yPx, w: d.cW, h: d.cH },
      { x: d.pinX, y: d.pinY },
      settings.lineStyle,
      d.pinRadius,
      d.mScale
    );
    const outerPath = outerPathRefs.current[d.id];
    const innerPath = innerPathRefs.current[d.id];
    if (outerPath) outerPath.setAttribute("d", line.svgPath);
    if (innerPath) innerPath.setAttribute("d", line.svgPath);
  };

  const cleanEndDrag = () => {
    if (dragRafRef.current !== null) {
      cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = null;
    }
    dragRef.current = null;
  };

  const triggerSelect = (marker: ExtractMarker) => {
    if (!onSelect) return;
    if (colors) {
      const found = colors.find((c) => c.id === marker.id);
      onSelect(found || marker.id);
    } else {
      onSelect(marker.id);
    }
  };

  const startLabelDrag = (
    event: React.PointerEvent<HTMLDivElement>,
    marker: ExtractMarker,
    left: number,
    top: number,
    cW: number,
    cH: number,
    mScale: number
  ) => {
    if (!interactive) return;
    event.stopPropagation();

    const wasAlreadySelected = selectedId === marker.id;

    if (!allowDrag || !moveCallback || !rootRef.current) {
      if (!wasAlreadySelected) {
        triggerSelect(marker);
      }
      return;
    }
    event.preventDefault();

    // Measure live DOM dimensions on pointerdown so expanded-margin canvases never use a stale boxW/boxH
    const el = rootRef.current;
    const rect = el.getBoundingClientRect();
    const scale = Math.max(viewScale, 0.01);
    const rectW = Math.max(rect.width || boxW * scale, 1);
    const rectH = Math.max(rect.height || boxH * scale, 1);
    const liveBoxW = Math.max(el.clientWidth || rectW / scale || boxW, 1);
    const liveBoxH = Math.max(el.clientHeight || rectH / scale || boxH, 1);

    if (Math.abs(liveBoxW - boxW) > 0.5 || Math.abs(liveBoxH - boxH) > 0.5) {
      setOverlayBox({ w: liveBoxW, h: liveBoxH });
    }

    const liveCanvasScale = getCanvasScale(liveBoxW, liveBoxH, baseW);
    const liveMScale = (marker.labelScale ?? cardScale) * liveCanvasScale * ui;
    const hasTonal = Boolean(marker.tonalGradient && marker.tonalGradient.length > 0);
    const liveCW = baseW * liveMScale || cW;
    const liveCH = (baseH + (hasTonal ? 12 : 0)) * liveMScale || cH;

    const normX = (event.clientX - rect.left) / rectW;
    const normY = (event.clientY - rect.top) / rectH;

    const cardWNorm = liveCW / liveBoxW;
    const cardHNorm = liveCH / liveBoxH;

    dragRef.current = {
      id: marker.id,
      grabX: normX - left,
      grabY: normY - top,
      rectLeft: rect.left,
      rectTop: rect.top,
      rectW,
      rectH,
      boxW: liveBoxW,
      boxH: liveBoxH,
      cW: liveCW,
      cH: liveCH,
      maxX: Math.max(0, 1 - cardWNorm),
      maxY: Math.max(0, 1 - cardHNorm),
      pinX: marker.nx * liveBoxW,
      pinY: marker.ny * liveBoxH,
      pinRadius: 6 * liveCanvasScale * cardScale * ui,
      mScale: liveMScale || mScale,
      latestNx: left,
      latestNy: top,
      moved: false,
      wasAlreadySelected,
      cardEl: event.currentTarget,
    };

    if (!wasAlreadySelected) {
      triggerSelect(marker);
    }

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  };

  const moveLabelDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!allowDrag || !d || d.id !== event.currentTarget.dataset.markerId) return;
    event.preventDefault();
    event.stopPropagation();

    const normX = (event.clientX - d.rectLeft) / d.rectW;
    const normY = (event.clientY - d.rectTop) / d.rectH;
    const nx = Math.min(d.maxX, Math.max(0, normX - d.grabX));
    const ny = Math.min(d.maxY, Math.max(0, normY - d.grabY));

    d.latestNx = nx;
    d.latestNy = ny;
    d.moved = true;

    if (dragRafRef.current === null) {
      dragRafRef.current = requestAnimationFrame(flushDragVisuals);
    }
  };

  const endLabelDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.id !== event.currentTarget.dataset.markerId) return;
    event.stopPropagation();

    flushDragVisuals();
    const finalId = d.id;
    const finalNx = d.latestNx;
    const finalNy = d.latestNy;
    const didMove = d.moved;
    const wasSelected = d.wasAlreadySelected;

    cleanEndDrag();
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }
    }

    // Commit final position once on pointer release so zero React re-renders happen during drag
    if (didMove && onMoveLabelRef.current) {
      onMoveLabelRef.current(finalId, finalNx, finalNy);
    } else if (!didMove && wasSelected && onRequestAssign) {
      onRequestAssign(finalId);
    }
  };

  return (
    <div ref={rootRef} className="pointer-events-none absolute inset-0 overflow-hidden select-none">
      {/* Leader lines SVG */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        viewBox={`0 0 ${boxW} ${boxH}`}
        preserveAspectRatio="none"
      >
        {positions.map(({ marker, left, top, mScale, cW, cH }) => {
          if (!marker.paint) return null;
          const cardRect = {
            x: left * boxW,
            y: top * boxH,
            w: cW,
            h: cH,
          };
          const pin = {
            x: marker.nx * boxW,
            y: marker.ny * boxH,
          };
          const pinRadius = 6 * visualScale;
          const line = calculateLeaderLine(
            cardRect,
            pin,
            settings.lineStyle,
            pinRadius,
            mScale
          );

          const paintHex = marker.paint.hex.toUpperCase();
          const strokeColor = settings.lineMatchPaintColor
            ? paintHex
            : "rgba(255,255,255,0.95)";
          const shadowColor = settings.lineMatchPaintColor
            ? "rgba(0,0,0,0.65)"
            : "rgba(0,0,0,0.45)";
          const innerW = settings.lineWidth * canvasScale * ui;
          const outerW = innerW * 1.75;

          return (
            <g key={marker.id}>
              <path
                ref={(el) => {
                  outerPathRefs.current[marker.id] = el;
                }}
                d={line.svgPath}
                fill="none"
                stroke={shadowColor}
                strokeWidth={outerW}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                ref={(el) => {
                  innerPathRefs.current[marker.id] = el;
                }}
                d={line.svgPath}
                fill="none"
                stroke={strokeColor}
                strokeWidth={innerW}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          );
        })}
      </svg>

      {positions.map(({ marker, left, top, mScale, cW, cH }) => {
        const active = marker.id === selectedId;
        const paint = marker.paint;
        const paintHex = paint ? paint.hex.toUpperCase() : marker.hex.toUpperCase();
        const pinScale = canvasScale * ui;
        const hasTonal = marker.tonalGradient && marker.tonalGradient.length > 0;
        const cardH = baseH + (hasTonal ? 12 : 0);

        return (
          <div key={marker.id}>
            {/* Sample pin dot */}
            <button
              type="button"
              className="bp-pin-dot pointer-events-auto absolute rounded-full transition-transform hover:scale-125"
              style={{
                left: `${marker.nx * 100}%`,
                top: `${marker.ny * 100}%`,
                width: 14,
                height: 14,
                backgroundColor: settings.lineMatchPaintColor && paint ? paintHex : marker.hex,
                border: active
                  ? "2.5px solid var(--accent-color)"
                  : `2px solid ${settings.lineMatchPaintColor && paint ? "#ffffff" : "#ffffff"}`,
                boxShadow: "0 1px 4px rgba(0,0,0,0.65)",
                transform: `translate(-50%, -50%) scale(${pinScale})`,
              }}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                triggerSelect(marker);
                if (onRequestAssign && (!paint || active)) {
                  onRequestAssign(marker.id);
                }
              }}
              aria-label={marker.hex}
              title={marker.hex}
            />

            {/* Floating swatch card positioned with GPU-composited translate3d */}
            {paint && (
              <div
                data-marker-id={marker.id}
                className={`pointer-events-auto absolute top-0 left-0 select-none ${
                  allowDrag ? "touch-none cursor-grab active:cursor-grabbing" : "cursor-pointer"
                }`}
                style={{
                  width: cW,
                  height: cH,
                  transform: `translate3d(${left * boxW}px, ${top * boxH}px, 0)`,
                  willChange: allowDrag ? "transform" : "auto",
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                  touchAction: allowDrag ? "none" : "pan-x pan-y",
                  userSelect: "none",
                  WebkitUserSelect: "none",
                }}
                onPointerDown={(event) => startLabelDrag(event, marker, left, top, cW, cH, mScale)}
                onPointerMove={moveLabelDrag}
                onPointerUp={endLabelDrag}
                onPointerCancel={endLabelDrag}
                onMouseDown={(event) => event.stopPropagation()}
                onTouchStart={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
              >
                <div
                  style={{
                    width: baseW,
                    height: cardH,
                    transform: `scale(${mScale})`,
                    transformOrigin: "top left",
                    contain: "layout style",
                    userSelect: "none",
                  }}
                >
                  <SwatchCard
                    marker={marker}
                    baseW={baseW}
                    baseH={baseH}
                    active={active}
                    glassEffect={settings.cardGlassEffect}
                    showRemove={showRemove && !!onRemove}
                    onRemove={() => onRemove?.(marker.id)}
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

const SwatchCard = React.memo<{
  marker: ExtractMarker;
  baseW: number;
  baseH: number;
  active: boolean;
  glassEffect: boolean;
  showRemove: boolean;
  onRemove: () => void;
}>(({ marker, baseW, baseH, active, glassEffect, showRemove, onRemove }) => {
  const paint = marker.paint!;
  const paintHex = paint.hex.toUpperCase();
  const sampleHex = marker.hex.toUpperCase();
  const showSample = sampleHex !== paintHex;
  const hasTonal = marker.tonalGradient && marker.tonalGradient.length > 0;
  const totalH = baseH + (hasTonal ? 12 : 0);
  const thumbW = Math.round(baseW * 0.31);

  const isLightHex = (hex: string) => {
    const clean = hex.replace("#", "");
    const r = parseInt(clean.slice(0, 2), 16) * 0.299;
    const g = parseInt(clean.slice(2, 4), 16) * 0.587;
    const b = parseInt(clean.slice(4, 6), 16) * 0.114;
    return r + g + b > 140;
  };

  return (
    <div
      style={{ width: `${baseW}px`, height: `${totalH}px` }}
      className={`bp-floating-swatch group relative flex flex-col rounded-xl ${
        glassEffect
          ? "bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border border-white/55 dark:border-white/20 shadow-xl"
          : "bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700 shadow-lg"
      } ${active ? "bp-floating-swatch-active ring-2 ring-[var(--accent-color)] border-[var(--accent-color)]" : ""}`}
    >
      {/* Locked Aspect Ratio Main Body with Strict Overflow Clipping */}
      <div
        style={{ height: `${baseH}px` }}
        className="bp-floating-swatch-body flex w-full items-stretch overflow-hidden rounded-t-[11px]"
      >
        {/* Fixed-ratio Left Thumbnail / Bottle */}
        <div
          style={{ width: `${thumbW}px`, height: `${baseH}px` }}
          className={`bp-floating-swatch-thumb flex flex-shrink-0 items-center justify-center overflow-hidden px-0.5 ${
            !hasTonal ? "rounded-bl-[11px]" : ""
          } ${
            glassEffect
              ? "bg-white/40 dark:bg-slate-800/40 border-r border-white/30 dark:border-white/10"
              : "bg-slate-50 dark:bg-slate-800 border-r border-slate-100 dark:border-slate-800"
          }`}
        >
          <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
            <svg viewBox="0 0 40 44" className="h-10 w-8 shrink-0">
              <polygon
                points="20,2 38,12 38,32 20,42 2,32 2,12"
                fill={paintHex}
                stroke="rgba(0,0,0,0.18)"
                strokeWidth="1"
              />
            </svg>
            <span
              className="absolute max-w-[38px] truncate text-center font-mono text-[7px] font-bold leading-none"
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

        {/* Right Text Info (strictly min-w-0 + overflow-hidden so long names never stretch or overflow) */}
        <div className="min-w-0 flex-1 flex flex-col justify-center overflow-hidden px-2 py-1">
          <div className="truncate text-[11px] font-extrabold leading-tight text-slate-800 dark:text-slate-100">
            {paint.brand} {paint.code}
          </div>
          <div
            className={`truncate leading-tight text-slate-500 dark:text-slate-400 mt-0.5 ${
              (paint.name || "").length > 10 ? "text-[9px]" : "text-[10px]"
            }`}
            title={paint.name}
          >
            {paint.name}
          </div>
          <div className="mt-1 flex items-center gap-1 overflow-hidden">
            <span
              className="bp-badge inline-block truncate rounded px-1.5 py-px font-mono text-[9px] font-bold tabular-nums"
              style={{
                backgroundColor: paintHex,
                color: isLightHex(paintHex) ? "#000" : "#fff",
              }}
            >
              {paintHex}
            </span>
          </div>
        </div>
      </div>

      {/* Optional 3-Step Tonal Gradient Bar at bottom */}
      {hasTonal && marker.tonalGradient && (
        <div className="bp-floating-swatch-tonal flex h-[12px] w-full shrink-0 overflow-hidden rounded-b-[11px] border-t border-black/10">
          {marker.tonalGradient.map((step) => (
            <div
              key={step.id}
              className="flex-1 h-full"
              style={{ backgroundColor: step.hex }}
              title={`${step.label}: ${step.hex}`}
            />
          ))}
        </div>
      )}

      {/* Sample hex badge if different */}
      {showSample && (
        <span
          className="bp-badge absolute -right-1 -top-4 z-20 rounded-full px-1.5 py-px font-mono text-[8px] font-bold text-white shadow"
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
          className="bp-delete-btn absolute -right-2 -top-2 z-30 flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-white opacity-0 shadow-md pointer-events-none hover:bg-red-500 group-hover:pointer-events-auto group-hover:opacity-100 transition-opacity"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          aria-label="Remove"
          title="移除此色卡标注"
        >
          <XIcon className="h-3 w-3" />
        </button>
      )}
    </div>
  );
});

SwatchCard.displayName = "SwatchCard";

export default ExtractMarkerOverlay;
