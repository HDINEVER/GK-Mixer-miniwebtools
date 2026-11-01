import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ColorData } from "../types";
import { ExtractMarker } from "../utils/exportAnnotatedImage";
import { REFERENCE_CANVAS_DIM, SwatchSettings } from "../utils/swatchLayout";
import { ExtractMarkerOverlay } from "./ExtractMarkerOverlay";

export const REF_WIDTH = REFERENCE_CANVAS_DIM; // 800px fixed reference stage width

export interface ProjectAnnotatedCanvasProps {
  imageSrc: string;
  alt?: string;
  colors?: ColorData[];
  markers?: ExtractMarker[];
  selectedId?: string | null;
  swatchSettings: Partial<SwatchSettings>;
  readOnly?: boolean;
  onSelect?: (idOrColor: any) => void;
  onUpdatePosition?: (id: string, nx: number, ny: number) => void;
  onRequestAssign?: (id: string) => void;
  onRemove?: (id: string) => void;
  showRemove?: boolean;
  /**
   * When true (e.g. inside the export poster artwork slot), fills 100% of the parent width
   * and locks the outer height to `containerActualWidth / stageAspect`.
   */
  fillWidth?: boolean;
  /**
   * Optional maximum height (in px) when fitting inside a viewport container (e.g. PaintProjectDetailView).
   */
  maxHeightPx?: number;
  className?: string;
  roundedClassName?: string;
}

/**
 * Single source-of-truth annotated canvas component shared between:
 * 1. Project Folder Preview (`PaintProjectDetailView.tsx`, interactive)
 * 2. Export Card Live Preview (`ProjectSharePosterModal.tsx`, `readOnly={true}`)
 *
 * Enforces the Reference Stage Law:
 * - Inner coordinate space is strictly locked to `REF_WIDTH (800px) × REF_HEIGHT (800 / stageAspect)`.
 * - Outer wrapper uses `ResizeObserver` to measure `containerActualWidth` and scales the entire
 *   800px stage uniformly via `transform: scale(stageScreenW / 800)` with `transformOrigin: 'top left'`.
 * - Leader lines and line styles are read directly from `swatchSettings` without any export overrides.
 */
export const ProjectAnnotatedCanvas: React.FC<ProjectAnnotatedCanvasProps> = ({
  imageSrc,
  alt = "Annotated Model Preview",
  colors,
  markers,
  selectedId = null,
  swatchSettings,
  readOnly = false,
  onSelect,
  onUpdatePosition,
  onRequestAssign,
  onRemove,
  showRemove = false,
  fillWidth = false,
  maxHeightPx,
  className = "",
  roundedClassName = "rounded-xl",
}) => {
  const outerMeasureRef = useRef<HTMLDivElement>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number }>({ w: 800, h: 800 });
  const [containerWidth, setContainerWidth] = useState<number>(0);

  // Synchronously probe natural image dimensions whenever imageSrc changes
  useEffect(() => {
    if (!imageSrc) return;
    let cancelled = false;
    const probe = new Image();
    probe.onload = () => {
      if (cancelled) return;
      if (probe.naturalWidth > 0 && probe.naturalHeight > 0) {
        setNaturalSize((prev) =>
          prev.w === probe.naturalWidth && prev.h === probe.naturalHeight
            ? prev
            : { w: probe.naturalWidth, h: probe.naturalHeight }
        );
      }
    };
    probe.src = imageSrc;
    if (probe.complete && probe.naturalWidth > 0 && probe.naturalHeight > 0) {
      setNaturalSize({ w: probe.naturalWidth, h: probe.naturalHeight });
    }
    return () => {
      cancelled = true;
    };
  }, [imageSrc]);

  useLayoutEffect(() => {
    const el = outerMeasureRef.current;
    if (!el) return;
    let frame = 0;
    const updateWidth = () => {
      const w = el.clientWidth || el.getBoundingClientRect().width;
      if (w > 1) {
        setContainerWidth((prev) => (Math.abs(prev - w) < 0.5 ? prev : w));
      }
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateWidth);
    };
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    if (el.parentElement) ro.observe(el.parentElement);
    window.addEventListener("resize", schedule);
    updateWidth();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      ro.disconnect();
    };
  }, []);

  const stageAspect = Math.max(0.1, naturalSize.w / Math.max(1, naturalSize.h));
  const refHeight = REF_WIDTH / stageAspect;

  const availW = containerWidth > 1 ? containerWidth : 480;
  let stageScreenW = availW;
  if (!fillWidth && maxHeightPx && maxHeightPx > 40) {
    stageScreenW = Math.min(availW, maxHeightPx * stageAspect);
  }
  const stageScreenH = stageScreenW / stageAspect;
  const scaleFactor = stageScreenW / REF_WIDTH;

  return (
    <div
      ref={outerMeasureRef}
      className={`w-full flex items-center justify-center ${className}`}
    >
      {imageSrc ? (
        <div
          className={`relative overflow-hidden select-none shrink-0 ${roundedClassName}`}
          style={{
            width: `${stageScreenW}px`,
            height: `${stageScreenH}px`,
          }}
        >
          {/* Fixed 800 × REF_HEIGHT Reference Stage scaled uniformly as a single unit */}
          <div
            className="relative top-0 left-0 select-none"
            style={{
              width: `${REF_WIDTH}px`,
              height: `${refHeight}px`,
              transform: `scale(${scaleFactor})`,
              transformOrigin: "top left",
            }}
          >
            <img
              src={imageSrc}
              alt={alt}
              data-full-stage="true"
              onLoad={(e) => {
                const nw = e.currentTarget.naturalWidth;
                const nh = e.currentTarget.naturalHeight;
                if (nw > 0 && nh > 0) {
                  setNaturalSize((prev) =>
                    prev.w === nw && prev.h === nh ? prev : { w: nw, h: nh }
                  );
                }
              }}
              className="bp-swatch block w-full h-full object-fill select-none pointer-events-none"
              draggable={false}
            />
            <ExtractMarkerOverlay
              colors={colors}
              markers={markers}
              selectedId={selectedId}
              settings={swatchSettings}
              fixedStageSize={{ w: REF_WIDTH, h: refHeight }}
              interactive={!readOnly}
              allowDrag={!readOnly && Boolean(onUpdatePosition)}
              onSelect={onSelect}
              onUpdatePosition={onUpdatePosition}
              onRequestAssign={onRequestAssign}
              onRemove={onRemove}
              showRemove={showRemove}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-10 text-xs font-bold text-slate-400">
          正在加载预览图像…
        </div>
      )}
    </div>
  );
};

export default ProjectAnnotatedCanvas;
