import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { XIcon } from "@phosphor-icons/react";
import { ColorData } from "../types";
import { colorsToMarkers, ExtractMarker } from "../utils/exportAnnotatedImage";
import {
  calculateLeaderLine,
  cleanPaintCardName,
  DEFAULT_SWATCH_SETTINGS,
  getCanvasScale,
  getCardBaseDimensions,
  getMarkerCardDimensions,
  REFERENCE_CANVAS_DIM,
  SwatchSettings,
} from "../utils/swatchLayout";
import { localizedBrand } from "../utils/paintCatalog";

export interface ExtractMarkerOverlayProps {
  markers?: ExtractMarker[];
  colors?: ColorData[];
  selectedId: string | null;
  viewScale?: number;
  settings?: Partial<SwatchSettings>;
  /** When provided (e.g. inside ProjectAnnotatedCanvas), locks the overlay to this exact reference stage size without DOM re-measurement */
  fixedStageSize?: { w: number; h: number };
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
  fixedStageSize,
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
  const innerRef = useRef<HTMLDivElement>(null);
  const onMoveLabelRef = useRef(moveCallback);
  onMoveLabelRef.current = moveCallback;

  // Refs to SVG leader line <path> elements for zero-rerender DOM updates during drag
  const outerPathRefs = useRef<Record<string, SVGPathElement | null>>({});
  const innerPathRefs = useRef<Record<string, SVGPathElement | null>>({});
  const dragRafRef = useRef<number | null>(null);
  const dragRef = useRef<ActiveDragState | null>(null);

  const [overlayBox, setOverlayBox] = useState({ left: 0, top: 0, w: 800, h: 600 });

  const overlayLeft = fixedStageSize ? 0 : overlayBox.left;
  const overlayTop = fixedStageSize ? 0 : overlayBox.top;
  const boxW = Math.max(1, fixedStageSize ? fixedStageSize.w : overlayBox.w || 800);
  const boxH = Math.max(1, fixedStageSize ? fixedStageSize.h : overlayBox.h || 600);

  // Core Reference Stage Law: All swatch cards & leader lines are calculated in a fixed 800px reference width
  // and scaled uniformly via CSS transform: scale(boxW / 800).
  const refW = REFERENCE_CANVAS_DIM; // 800
  const stageAspect = boxW / Math.max(1, boxH);
  const refH = refW / Math.max(0.05, stageAspect);
  const stageScale = boxW / refW;

  const { baseW, baseH } = getCardBaseDimensions(settings.cardBaseWidth);
  const canvasScale = getCanvasScale(refW, refH, baseW);
  const cardScale = settings.cardScale ?? 1.0;
  const visualScale = canvasScale * cardScale * ui;

  useLayoutEffect(() => {
    if (fixedStageSize) return;
    const el = rootRef.current;
    if (!el) return;
    let frame = 0;
    const applySize = (left: number, top: number, w: number, h: number) => {
      if (!w || !h) return;
      setOverlayBox((prev) =>
        Math.abs(prev.left - left) < 0.5 &&
        Math.abs(prev.top - top) < 0.5 &&
        Math.abs(prev.w - w) < 0.5 &&
        Math.abs(prev.h - h) < 0.5
          ? prev
          : { left, top, w, h }
      );
    };
    const measureAndApply = () => {
      const parent = el.parentElement;
      const siblingImg = parent?.querySelector("img") || null;

      if (siblingImg && siblingImg.clientWidth > 1 && siblingImg.clientHeight > 1) {
        const imgLeft = siblingImg.offsetLeft;
        const imgTop = siblingImg.offsetTop;
        const imgW = siblingImg.clientWidth;
        const imgH = siblingImg.clientHeight;
        let renderW = imgW;
        let renderH = imgH;
        const isFullStage = siblingImg.getAttribute("data-full-stage") === "true";
        if (!isFullStage && siblingImg.naturalWidth > 0 && siblingImg.naturalHeight > 0) {
          const natRatio = siblingImg.naturalWidth / siblingImg.naturalHeight;
          const boxRatio = imgW / imgH;
          if (Math.abs(natRatio - boxRatio) > 0.004) {
            if (boxRatio > natRatio) {
              renderH = imgH;
              renderW = imgH * natRatio;
            } else {
              renderW = imgW;
              renderH = imgW / natRatio;
            }
          }
        }
        const left = imgLeft + (imgW - renderW) / 2;
        const top = imgTop + (imgH - renderH) / 2;
        applySize(left, top, renderW, renderH);
        return;
      }

      const target = parent || el;
      const w = el.clientWidth || target.clientWidth;
      const h = el.clientHeight || target.clientHeight;
      if (w > 1 && h > 1) {
        applySize(0, 0, w, h);
      } else {
        const rect = el.getBoundingClientRect();
        const scale = Math.max(viewScale, 0.01);
        if (rect.width > 1 && rect.height > 1) {
          applySize(0, 0, rect.width / scale, rect.height / scale);
        }
      }
    };
    const scheduleMeasure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measureAndApply);
    };
    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(el);
    const parent = el.parentElement;
    let currentImg: HTMLImageElement | null = parent?.querySelector("img") || null;
    const siblingCanvas = parent?.querySelector("canvas") || null;
    if (parent) observer.observe(parent);
    if (currentImg) {
      observer.observe(currentImg);
      currentImg.addEventListener("load", measureAndApply);
    }
    if (siblingCanvas) observer.observe(siblingCanvas);

    const mutObserver = parent
      ? new MutationObserver(() => {
          const nextImg = parent.querySelector("img") || null;
          if (nextImg !== currentImg) {
            if (currentImg) currentImg.removeEventListener("load", measureAndApply);
            currentImg = nextImg;
            if (currentImg) {
              observer.observe(currentImg);
              currentImg.addEventListener("load", measureAndApply);
            }
          }
          scheduleMeasure();
        })
      : null;
    if (parent && mutObserver) {
      mutObserver.observe(parent, { childList: true, attributes: true, subtree: true });
    }

    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("orientationchange", scheduleMeasure);
    measureAndApply();
    return () => {
      cancelAnimationFrame(frame);
      if (currentImg) {
        currentImg.removeEventListener("load", measureAndApply);
      }
      mutObserver?.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("orientationchange", scheduleMeasure);
      observer.disconnect();
    };
  }, [fixedStageSize, markers.length, viewScale]);

  useEffect(() => {
    return () => {
      if (dragRafRef.current !== null) {
        cancelAnimationFrame(dragRafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const move = onMoveLabelRef.current;
    if (!move || refW < 2 || refH < 2) return;
    for (const marker of markers) {
      if (!marker.paint || marker.labelNx != null) continue;
      const mScale = (marker.labelScale ?? cardScale) * canvasScale * ui;
      const { baseW: mBaseW, baseH: mBaseH } = getMarkerCardDimensions(
        marker.paint,
        settings.cardBaseWidth
      );
      const fallback = defaultLabel(
        marker.nx,
        marker.ny,
        refW,
        refH,
        mBaseW * mScale,
        mBaseH * mScale
      );
      move(marker.id, fallback.left, fallback.top);
    }
  }, [markers, refW, refH, settings.cardBaseWidth, cardScale, canvasScale, ui]);

  const positions = useMemo(() => {
    return markers
      .filter((marker) => Number.isFinite(marker.nx) && Number.isFinite(marker.ny))
      .map((marker) => {
        const mScale = (marker.labelScale ?? cardScale) * canvasScale * ui;
        const { baseW: mBaseW, baseH: mBaseH } = getMarkerCardDimensions(
          marker.paint,
          settings.cardBaseWidth
        );
        const hasTonal = marker.tonalGradient && marker.tonalGradient.length > 0;
        const cW = mBaseW * mScale;
        const cH = (mBaseH + (hasTonal ? 12 : 0)) * mScale;
        const fallback = defaultLabel(marker.nx, marker.ny, refW, refH, cW, cH);
        const isBeingDragged = dragRef.current?.id === marker.id;
        const rawLeft = isBeingDragged ? dragRef.current!.latestNx : (marker.labelNx ?? fallback.left);
        const rawTop = isBeingDragged ? dragRef.current!.latestNy : (marker.labelNy ?? fallback.top);
        const maxLeft = Math.max(0, 1 - cW / refW);
        const maxTop = Math.max(0, 1 - cH / refH);
        return {
          marker,
          left: Math.min(Math.max(0, rawLeft), maxLeft),
          top: Math.min(Math.max(0, rawTop), maxTop),
          mScale,
          mBaseW,
          mBaseH,
          cW,
          cH,
        };
      });
  }, [markers, refW, refH, settings.cardBaseWidth, cardScale, canvasScale, ui, selectedId]);

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

    // Measure live screen rect for pointer delta normalization while keeping internal coordinates in (refW, refH)
    const el = innerRef.current || rootRef.current;
    const rect = el.getBoundingClientRect();
    const scale = Math.max(viewScale, 0.01);
    const rectW = Math.max(rect.width || boxW * scale, 1);
    const rectH = Math.max(rect.height || boxH * scale, 1);

    const liveAspect = rectW / Math.max(1, rectH);
    const liveRefW = REFERENCE_CANVAS_DIM; // 800
    const liveRefH = liveRefW / Math.max(0.05, liveAspect);

    const liveCanvasScale = getCanvasScale(liveRefW, liveRefH, baseW);
    const liveMScale = (marker.labelScale ?? cardScale) * liveCanvasScale * ui;
    const { baseW: mBaseW, baseH: mBaseH } = getMarkerCardDimensions(
      marker.paint,
      settings.cardBaseWidth
    );
    const hasTonal = Boolean(marker.tonalGradient && marker.tonalGradient.length > 0);
    const liveCW = mBaseW * liveMScale || cW;
    const liveCH = (mBaseH + (hasTonal ? 12 : 0)) * liveMScale || cH;

    const normX = (event.clientX - rect.left) / rectW;
    const normY = (event.clientY - rect.top) / rectH;

    const cardWNorm = liveCW / liveRefW;
    const cardHNorm = liveCH / liveRefH;

    dragRef.current = {
      id: marker.id,
      grabX: normX - left,
      grabY: normY - top,
      rectLeft: rect.left,
      rectTop: rect.top,
      rectW,
      rectH,
      boxW: liveRefW,
      boxH: liveRefH,
      cW: liveCW,
      cH: liveCH,
      maxX: Math.max(0, 1 - cardWNorm),
      maxY: Math.max(0, 1 - cardHNorm),
      pinX: marker.nx * liveRefW,
      pinY: marker.ny * liveRefH,
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
      <div
        className="pointer-events-none absolute overflow-hidden select-none"
        style={{
          left: overlayLeft,
          top: overlayTop,
          width: boxW,
          height: boxH,
        }}
      >
        <div
          ref={innerRef}
          className="pointer-events-none absolute top-0 left-0 overflow-hidden select-none"
          style={{
            width: `${refW}px`,
            height: `${refH}px`,
            transform: Math.abs(stageScale - 1) > 0.0005 ? `scale(${stageScale})` : undefined,
            transformOrigin: "top left",
          }}
        >
          {/* Leader lines SVG in 1:1 Reference Stage pixel coordinates (800 × refH) */}
          <svg
            width={refW}
            height={refH}
            viewBox={`0 0 ${refW} ${refH}`}
            className="pointer-events-none absolute inset-0 overflow-visible"
          >
            {positions.map(({ marker, left, top, mScale, cW, cH }) => {
              if (!marker.paint) return null;
              const cardRect = {
                x: left * refW,
                y: top * refH,
                w: cW,
                h: cH,
              };
              const pin = {
                x: marker.nx * refW,
                y: marker.ny * refH,
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

          {positions.map(({ marker, left, top, mScale, mBaseW, mBaseH, cW, cH }) => {
            const active = marker.id === selectedId;
            const paint = marker.paint;
            const paintHex = paint ? paint.hex.toUpperCase() : marker.hex.toUpperCase();
            const pinScale = canvasScale * ui;
            const hasTonal = marker.tonalGradient && marker.tonalGradient.length > 0;
            const cardH = mBaseH + (hasTonal ? 12 : 0);

            return (
              <div key={marker.id}>
                {/* Sample pin dot */}
                <button
                  type="button"
                  className="bp-pin-dot pointer-events-auto absolute p-0 m-0 min-w-0 min-h-0 leading-none appearance-none rounded-full transition-transform hover:scale-125"
                  style={{
                    left: `${marker.nx * refW}px`,
                    top: `${marker.ny * refH}px`,
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

                {/* Floating swatch card positioned with GPU-composited translate3d in 800 × refH space */}
                {paint && (
                  <div
                    data-marker-id={marker.id}
                    className={`pointer-events-auto absolute top-0 left-0 select-none ${
                      allowDrag ? "touch-none cursor-grab active:cursor-grabbing" : "cursor-pointer"
                    }`}
                    style={{
                      width: cW,
                      height: cH,
                      transform: `translate3d(${left * refW}px, ${top * refH}px, 0)`,
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
                        width: mBaseW,
                        height: cardH,
                        transform: `scale(${mScale})`,
                        transformOrigin: "top left",
                        contain: "layout style",
                        userSelect: "none",
                      }}
                    >
                      <SwatchCard
                        marker={marker}
                        baseW={mBaseW}
                        baseH={mBaseH}
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
      </div>
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
  const swatchW = 46;
  const titleText = cleanPaintCardName(paint.name || paint.code);
  const brandCodeText = `${localizedBrand(paint.brand, "zh")} ${paint.code}`.trim();

  const isLightHex = (hex: string) => {
    const clean = hex.replace("#", "");
    const r = parseInt(clean.slice(0, 2), 16) * 0.299;
    const g = parseInt(clean.slice(2, 4), 16) * 0.587;
    const b = parseInt(clean.slice(4, 6), 16) * 0.114;
    return r + g + b > 140;
  };

  return (
    <div
      style={{
        width: `${baseW}px`,
        height: `${totalH}px`,
        boxShadow: glassEffect
          ? "0 8px 20px rgba(15,23,42,0.22)"
          : active
          ? "2.5px 2.5px 0px #EF5350"
          : "2.5px 2.5px 0px #0F172A",
      }}
      className={`bp-floating-swatch group relative flex flex-col rounded-[10px] ${
        glassEffect
          ? "bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-[1.5px] border-white/75 dark:border-white/25"
          : "bg-white dark:bg-slate-900 border-[1.5px] border-slate-900 dark:border-slate-500"
      } ${active ? "bp-floating-swatch-active ring-2 ring-[var(--accent-color)] border-[var(--accent-color)]" : ""}`}
    >
      {/* Main Body with Strict 1:1 Pixel Metrics matching exportAnnotatedImage.ts */}
      <div
        style={{ height: `${baseH}px` }}
        className="bp-floating-swatch-body flex w-full items-stretch overflow-hidden rounded-t-[8.5px]"
      >
        {/* Left Pure Color Swatch Block (46px wide, no bottle thumbnail inside card) */}
        <div
          style={{
            width: `${swatchW}px`,
            height: `${baseH}px`,
            backgroundColor: paintHex,
            padding: "3px",
          }}
          className={`bp-floating-swatch-thumb relative flex flex-shrink-0 items-end justify-start overflow-hidden border-r-[1.5px] ${
            glassEffect
              ? "border-black/15 dark:border-white/15"
              : "border-slate-900/85 dark:border-slate-600"
          } ${!hasTonal ? "rounded-bl-[8.5px]" : ""}`}
        >
          {/* Inner subtle highlight sheen */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-[35%]"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 100%)",
            }}
          />
          {/* Sample hex corner dot if different from assigned paint hex */}
          {showSample && (
            <span
              className="absolute rounded-sm border border-white shadow-xs"
              style={{
                right: "3px",
                top: "3px",
                width: "9px",
                height: "9px",
                backgroundColor: sampleHex,
              }}
              title={`原图取样色: ${sampleHex}`}
            />
          )}
          <span
            className="relative z-10 max-w-full truncate font-mono font-black leading-none"
            style={{
              fontSize: "7.5px",
              padding: "1.5px 3px",
              borderRadius: "2.5px",
              backgroundColor: isLightHex(paintHex)
                ? "rgba(15,23,42,0.16)"
                : "rgba(0,0,0,0.32)",
              color: isLightHex(paintHex) ? "#0F172A" : "#FFFFFF",
            }}
          >
            {paint.code}
          </span>
        </div>

        {/* Right Hierarchy: Line 1 = Paint Name (Large Title), Line 2 = Brand + Code (Subtitle), Line 3 = HEX */}
        <div
          className="min-w-0 flex-1 flex flex-col justify-center overflow-hidden"
          style={{ padding: "4px 7px" }}
        >
          <div
            className="truncate font-black text-slate-900 dark:text-slate-50"
            style={{ fontSize: "12px", lineHeight: 1.15 }}
            title={titleText}
          >
            {titleText}
          </div>
          <div
            className="truncate font-extrabold text-slate-500 dark:text-slate-400"
            style={{ marginTop: "2px", fontSize: "10px", lineHeight: 1.15 }}
            title={brandCodeText}
          >
            {brandCodeText}
          </div>
          <div
            className="flex items-center overflow-hidden"
            style={{ marginTop: "3px", gap: "4px" }}
          >
            <span
              className="bp-badge inline-block truncate font-mono font-bold leading-none tabular-nums border border-black/15"
              style={{
                fontSize: "9px",
                padding: "1.5px 5px",
                borderRadius: "3px",
                backgroundColor: paintHex,
                color: isLightHex(paintHex) ? "#0F172A" : "#FFFFFF",
              }}
            >
              {paintHex}
            </span>
          </div>
        </div>
      </div>

      {/* Optional 3-Step Tonal Gradient Bar at bottom */}
      {hasTonal && marker.tonalGradient && (
        <div
          className="bp-floating-swatch-tonal flex w-full shrink-0 overflow-hidden rounded-b-[8.5px] border-t border-slate-900/20"
          style={{ height: "12px" }}
        >
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

      {/* Remove button */}
      {showRemove && (
        <button
          type="button"
          className="bp-delete-btn absolute -right-2 -top-2 z-30 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white opacity-0 shadow-md pointer-events-none hover:bg-red-500 group-hover:pointer-events-auto group-hover:opacity-100 transition-opacity"
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
