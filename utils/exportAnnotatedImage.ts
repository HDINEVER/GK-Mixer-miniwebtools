import { Capacitor, registerPlugin } from "@capacitor/core";
import { CatalogPaint, ColorData, TonalStep } from "../types";
import { getContrastColor } from "./colorUtils";
import { paintBottleUrls } from "./paintBottle";
import { localizedBrand } from "./paintCatalog";
import {
  calculateLeaderLine,
  cleanPaintCardName,
  drawLeaderLineOnCanvas,
  getCanvasScale,
  getCardBaseDimensions,
  getMarkerCardDimensions,
  REFERENCE_CANVAS_DIM,
  SwatchSettings,
  DEFAULT_SWATCH_SETTINGS,
} from "./swatchLayout";

export interface MediaSaverPlugin {
  saveImageToGallery(options: {
    base64Data: string;
    filename?: string;
  }): Promise<{ success: boolean; uri?: string; filePath?: string }>;
  shareImage(options: {
    base64Data: string;
    filename?: string;
    title?: string;
  }): Promise<{ success: boolean }>;
}

export const MediaSaver = registerPlugin<MediaSaverPlugin>("MediaSaver");

export interface ExportResult {
  dataUrl: string;
  filename: string;
  savedToGallery: boolean;
  shared: boolean;
}

export interface ExtractMarker {
  id: string;
  nx: number;
  ny: number;
  hex: string;
  paint?: CatalogPaint;
  labelNx?: number;
  labelNy?: number;
  labelScale?: number;
  tonalGradient?: TonalStep[];
}

const imageCache = new Map<string, HTMLImageElement | null>();

export const loadImage = (src: string, cors = true): Promise<HTMLImageElement | null> => {
  const cached = imageCache.get(src);
  if (cached !== undefined) return Promise.resolve(cached);
  return new Promise((resolve) => {
    const img = new Image();
    if (cors) img.crossOrigin = "anonymous";
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = () => {
      imageCache.set(src, null);
      resolve(null);
    };
    img.src = src;
  });
};

export const loadBottle = async (paint?: { brand: string; code: string }): Promise<HTMLImageElement | null> => {
  if (!paint) return null;
  for (const url of paintBottleUrls(paint.brand, paint.code)) {
    const img = await loadImage(url);
    if (img) return img;
  }
  return null;
};

const roundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) => {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
};

type LabelBox = { x: number; y: number; w: number; h: number };

const placeCard = (
  m: { x: number; y: number },
  cardW: number,
  cardH: number,
  cw: number,
  ch: number,
  s: number,
  placed: LabelBox[],
  others: { x: number; y: number }[]
): LabelBox => {
  const gap = 30 * s;
  const candidates = [
    { x: m.x + gap, y: m.y - cardH / 2 },
    { x: m.x - cardW - gap, y: m.y - cardH / 2 },
    { x: m.x - cardW / 2, y: m.y - cardH - gap },
    { x: m.x - cardW / 2, y: m.y + gap },
    { x: m.x + gap, y: m.y - cardH - gap },
    { x: m.x - cardW - gap, y: m.y - cardH - gap },
    { x: m.x + gap, y: m.y + gap },
    { x: m.x - cardW - gap, y: m.y + gap },
  ];
  let best = candidates[0];
  let bestScore = -Infinity;
  for (const c of candidates) {
    const cx = Math.max(4 * s, Math.min(c.x, cw - cardW - 4 * s));
    const cy = Math.max(4 * s, Math.min(c.y, ch - cardH - 4 * s));
    let score = 0;
    for (const box of placed) {
      if (cx < box.x + box.w && cx + cardW > box.x && cy < box.y + box.h && cy + cardH > box.y) {
        score -= 1000;
      }
    }
    for (const other of others) {
      if (cx < other.x + 24 * s && cx + cardW > other.x - 24 * s && cy < other.y + 24 * s && cy + cardH > other.y - 24 * s) {
        score -= 500;
      }
    }
    if (c.x === cx && c.y === cy) score += 100;
    score += (Math.abs(cx + cardW / 2 - cw / 2) / (cw / 2) + Math.abs(cy + cardH / 2 - ch / 2) / (ch / 2)) * 50;
    if (score > bestScore) {
      bestScore = score;
      best = { x: cx, y: cy };
    }
  }
  return { x: best.x, y: best.y, w: cardW, h: cardH };
};

const drawWatermark = (
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  dark: boolean
) => {
  const s = Math.max(cw, ch) / 800;
  const text = "GK-Mixer";
  ctx.font = `bold ${Math.round(18 * s)}px ui-sans-serif, system-ui, sans-serif`;
  const w = ctx.measureText(text).width;
  const pad = 10 * s;
  const x = cw - w - 28 * s;
  const y = ch - 22 * s;
  ctx.fillStyle = dark ? "rgba(255,255,255,0.18)" : "rgba(15,23,42,0.16)";
  roundRect(ctx, x - pad, y - 16 * s, w + pad * 2, 26 * s, 8 * s);
  ctx.fill();
  ctx.fillStyle = dark ? "rgba(255,255,255,0.85)" : "rgba(15,23,42,0.75)";
  ctx.fillText(text, x, y);
};

export const colorsToMarkers = (colors: ColorData[]): ExtractMarker[] =>
  colors
    .filter(
      (color): color is ColorData & { sampleX: number; sampleY: number } =>
        Number.isFinite(color.sampleX) && Number.isFinite(color.sampleY)
    )
    .map((color) => ({
      id: color.id,
      nx: color.sampleX,
      ny: color.sampleY,
      hex: color.hex,
      paint: color.assignedPaint,
      labelNx: color.labelNx,
      labelNy: color.labelNy,
      labelScale: color.labelScale,
      tonalGradient: color.tonalGradient,
    }));

export const renderAnnotatedCanvas = async (
  source: HTMLImageElement | HTMLCanvasElement,
  markers: ExtractMarker[],
  settings?: Partial<SwatchSettings>,
  includeWatermark = true,
  targetWidth?: number
): Promise<HTMLCanvasElement | null> => {
  const srcW = "naturalWidth" in source && source.naturalWidth ? source.naturalWidth : source.width;
  const srcH = "naturalHeight" in source && source.naturalHeight ? source.naturalHeight : source.height;
  if (!srcW || !srcH) return null;

  const aspectRatio = srcH / srcW;
  const cw =
    targetWidth && targetWidth > 0
      ? Math.round(targetWidth)
      : Math.max(srcW, 2160);
  const ch = Math.max(1, Math.round(cw * aspectRatio));

  const mergedSettings: SwatchSettings = {
    ...DEFAULT_SWATCH_SETTINGS,
    ...settings,
  };

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, cw, ch);

  // Core Reference Stage Law: Compute all positions, card sizes, and leader lines in the exact
  // 800 × refH reference space used by <ProjectAnnotatedCanvas /> and <ExtractMarkerOverlay />,
  // then scale uniformly by stageScale = cw / 800.
  const refW = REFERENCE_CANVAS_DIM; // 800
  const refH = refW * aspectRatio;
  const stageScale = cw / refW;

  ctx.save();
  ctx.scale(stageScale, stageScale);

  const { baseW } = getCardBaseDimensions(mergedSettings.cardBaseWidth);
  const s = getCanvasScale(refW, refH, baseW);
  const globalScale = mergedSettings.cardScale;
  const pinRadius = 6 * s * globalScale;
  const placed: LabelBox[] = [];
  const points = markers.map((marker) => ({ x: marker.nx * refW, y: marker.ny * refH }));

  // First pass: calculate box positions and draw leader lines behind cards
  const renderedItems: Array<{
    marker: ExtractMarker;
    box: LabelBox;
    paint: CatalogPaint;
    hex: string;
    mx: number;
    my: number;
    effectiveScale: number;
    mBaseW: number;
    mBaseH: number;
  }> = [];

  const drawPinAt = (mx: number, my: number, fillHex: string) => {
    ctx.save();
    ctx.translate(mx, my);
    ctx.scale(s, s);
    if (!mergedSettings.cardGlassEffect) {
      // Blueprint mode 14x14 rounded-square pin with hard offset shadow matching .bp-pin-dot
      roundRect(ctx, -7 + 1.5, -7 + 1.5, 14, 14, 3);
      ctx.fillStyle = "#0F172A";
      ctx.fill();

      roundRect(ctx, -7, -7, 14, 14, 3);
      ctx.fillStyle = fillHex;
      ctx.fill();
      ctx.strokeStyle = "#0F172A";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fillStyle = fillHex;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  };

  markers.forEach((marker, index) => {
    const mx = points[index].x;
    const my = points[index].y;
    const paint = marker.paint;
    const hex = (paint?.hex || marker.hex).toUpperCase();
    const pinFill = mergedSettings.lineMatchPaintColor && paint ? hex : marker.hex.toUpperCase();

    if (!paint) {
      drawPinAt(mx, my, pinFill);
      return;
    }

    const effectiveScale = marker.labelScale ?? globalScale;
    const unitScale = s * effectiveScale;
    const { baseW: mBaseW, baseH: mBaseH } = getMarkerCardDimensions(
      paint,
      mergedSettings.cardBaseWidth
    );
    const cardW = mBaseW * unitScale;
    const hasTonal = marker.tonalGradient && marker.tonalGradient.length > 0;
    const cardH = (mBaseH + (hasTonal ? 12 : 0)) * unitScale;

    const maxLeft = Math.max(0, 1 - cardW / refW);
    const maxTop = Math.max(0, 1 - cardH / refH);

    const box =
      typeof marker.labelNx === "number" && typeof marker.labelNy === "number"
        ? {
            x: Math.min(Math.max(0, marker.labelNx), maxLeft) * refW,
            y: Math.min(Math.max(0, marker.labelNy), maxTop) * refH,
            w: cardW,
            h: cardH,
          }
        : placeCard({ x: mx, y: my }, cardW, cardH, refW, refH, s, placed, points);
    placed.push(box);

    renderedItems.push({
      marker,
      box,
      paint,
      hex,
      mx,
      my,
      effectiveScale,
      mBaseW,
      mBaseH,
    });

    const linePath = calculateLeaderLine(
      box,
      { x: mx, y: my },
      mergedSettings.lineStyle,
      pinRadius,
      unitScale
    );

    const strokeColor = mergedSettings.lineMatchPaintColor ? hex : "rgba(255,255,255,0.95)";
    const shadowColor = mergedSettings.lineMatchPaintColor ? "rgba(0,0,0,0.65)" : "rgba(0,0,0,0.45)";

    drawLeaderLineOnCanvas(ctx, linePath, mergedSettings.lineWidth, strokeColor, shadowColor, s);
    drawPinAt(mx, my, pinFill);
  });

  // Second pass: draw each card in its exact unscaled (mBaseW × totalH) local space scaled by unitScale
  // so font sizes, paddings, and swatch widths have zero rounding divergence from SwatchCard in ExtractMarkerOverlay.tsx.
  renderedItems.forEach(({ marker, box, paint, hex, effectiveScale, mBaseW, mBaseH }) => {
    const unitScale = s * effectiveScale;
    const hasTonal = Boolean(marker.tonalGradient && marker.tonalGradient.length > 0);
    const tonalBarH = hasTonal ? 12 : 0;
    const totalH = mBaseH + tonalBarH;
    const mainBodyH = mBaseH;
    const swatchW = 46;
    const cornerRadius = mergedSettings.cardGlassEffect ? 10 : 4;

    const titleLine = cleanPaintCardName(paint.name || paint.code);
    const brandCodeLine = `${localizedBrand(paint.brand, "zh")} ${paint.code}`.trim();
    const sampleHex = (marker.hex || hex).toUpperCase();
    const showSample = sampleHex !== hex;

    ctx.save();
    ctx.translate(box.x, box.y);
    ctx.scale(unitScale, unitScale);

    // 1. Offset hard shadow (Blueprint mode) or soft glass shadow
    if (!mergedSettings.cardGlassEffect) {
      ctx.save();
      roundRect(ctx, 2, 2, mBaseW, totalH, cornerRadius);
      ctx.fillStyle = "#0F172A";
      ctx.fill();
      ctx.restore();
    } else {
      ctx.save();
      ctx.shadowColor = "rgba(15, 23, 42, 0.22)";
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 5;
      roundRect(ctx, 0, 0, mBaseW, totalH, cornerRadius);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fill();
      ctx.restore();
    }

    // 2. Main card surface & clip
    ctx.save();
    roundRect(ctx, 0, 0, mBaseW, totalH, cornerRadius);
    ctx.fillStyle = mergedSettings.cardGlassEffect ? "rgba(255,255,255,0.9)" : "#FFFFFF";
    ctx.fill();
    ctx.clip();

    // Left pure color swatch block (46px wide)
    ctx.fillStyle = hex;
    ctx.fillRect(0, 0, swatchW, mainBodyH);

    // Top subtle highlight sheen on left color block
    const sheenGrad = ctx.createLinearGradient(0, 0, 0, mainBodyH * 0.35);
    sheenGrad.addColorStop(0, "rgba(255,255,255,0.22)");
    sheenGrad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sheenGrad;
    ctx.fillRect(0, 0, swatchW, mainBodyH * 0.35);

    // Vertical divider between left swatch block and right text
    ctx.strokeStyle = mergedSettings.cardGlassEffect ? "rgba(15,23,42,0.15)" : "#0F172A";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(swatchW, 0);
    ctx.lineTo(swatchW, mainBodyH);
    ctx.stroke();

    // Optional sample hex dot in top-right corner of the color swatch block
    if (showSample) {
      const dotSize = 9;
      const dotX = swatchW - dotSize - 3;
      const dotY = 3;
      ctx.fillStyle = sampleHex;
      ctx.fillRect(dotX, dotY, dotSize, dotSize);
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 1;
      ctx.strokeRect(dotX, dotY, dotSize, dotSize);
    }

    // Bottom-left code pill inside swatch block
    const isLightSwatch = getContrastColor(hex) === "#000000";
    const fontCodeBadge = 7.5;
    ctx.font = `900 ${fontCodeBadge}px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;
    const codeBadgePadX = 3;
    const codeBadgeH = 10.5;
    const maxCodeBadgeW = swatchW - 6;
    let codeShort = paint.code || "";
    while (codeShort.length > 1 && ctx.measureText(codeShort).width + codeBadgePadX * 2 > maxCodeBadgeW) {
      codeShort = codeShort.slice(0, -1);
    }
    const codeBadgeW = Math.min(maxCodeBadgeW, Math.ceil(ctx.measureText(codeShort).width + codeBadgePadX * 2));
    const codeBadgeX = 3;
    const codeBadgeY = mainBodyH - codeBadgeH - 3;
    roundRect(ctx, codeBadgeX, codeBadgeY, codeBadgeW, codeBadgeH, 2.5);
    ctx.fillStyle = isLightSwatch ? "rgba(15,23,42,0.16)" : "rgba(0,0,0,0.32)";
    ctx.fill();
    ctx.fillStyle = isLightSwatch ? "#0F172A" : "#FFFFFF";
    ctx.textBaseline = "middle";
    ctx.fillText(codeShort, codeBadgeX + codeBadgePadX, codeBadgeY + codeBadgeH / 2 + 0.5);
    ctx.textBaseline = "alphabetic";

    const textX = swatchW + 7;
    const maxTextW = Math.max(12, mBaseW - 7 - textX);
    const fitText = (text: string, maxWidth: number) => {
      if (ctx.measureText(text).width <= maxWidth) return text;
      let str = text;
      while (str.length > 1 && ctx.measureText(str + "…").width > maxWidth) {
        str = str.slice(0, -1);
      }
      return str + "…";
    };

    // Line 1 (Large Title): Paint Name (12px font-black)
    ctx.font = `900 12px ui-sans-serif, system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`;
    ctx.fillStyle = "#0F172A";
    const line1Y = 21;
    ctx.fillText(fitText(titleLine, maxTextW), textX, line1Y);

    // Line 2 (Subtitle): Localized Brand + Code (10px font-extrabold)
    ctx.font = `800 10px ui-sans-serif, system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`;
    ctx.fillStyle = "#64748B";
    const line2Y = 36;
    ctx.fillText(fitText(brandCodeLine, maxTextW), textX, line2Y);

    // Line 3: HEX badge (9px font-mono)
    ctx.font = `700 9px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;
    const hexTextW = ctx.measureText(hex).width;
    const hexPadX = 5;
    const hexBadgeH = 13;
    const hexBadgeW = Math.min(maxTextW, Math.ceil(hexTextW + hexPadX * 2));
    const hexY = 42;
    roundRect(ctx, textX, hexY, hexBadgeW, hexBadgeH, 3);
    ctx.fillStyle = hex;
    ctx.fill();
    ctx.strokeStyle = "rgba(15,23,42,0.16)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = isLightSwatch ? "#0F172A" : "#FFFFFF";
    ctx.textBaseline = "middle";
    ctx.fillText(hex, textX + hexPadX, hexY + hexBadgeH / 2 + 0.5);
    ctx.textBaseline = "alphabetic";

    // Optional Tonal Gradient Bar at bottom of card
    if (marker.tonalGradient && marker.tonalGradient.length > 0) {
      const steps = marker.tonalGradient;
      const barY = mainBodyH;
      const segW = mBaseW / steps.length;
      steps.forEach((step, idx) => {
        ctx.fillStyle = step.hex;
        ctx.fillRect(idx * segW, barY, segW + 0.5, tonalBarH);
      });
      ctx.strokeStyle = mergedSettings.cardGlassEffect ? "rgba(15,23,42,0.22)" : "#0F172A";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, barY);
      ctx.lineTo(mBaseW, barY);
      ctx.stroke();
    }

    ctx.restore();

    // Draw crisp outer border on top of clipped content
    roundRect(ctx, 0, 0, mBaseW, totalH, cornerRadius);
    ctx.strokeStyle = mergedSettings.cardGlassEffect ? "rgba(255,255,255,0.8)" : "#0F172A";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  });

  ctx.restore();

  if (includeWatermark) {
    const sample = Math.max(8, Math.round(40 * s));
    const lumData = ctx.getImageData(
      Math.max(0, cw - sample * 8),
      Math.max(0, ch - sample * 3),
      Math.min(sample * 8, cw),
      Math.min(sample * 3, ch)
    ).data;
    let r = 0;
    let g = 0;
    let b = 0;
    const n = lumData.length / 4;
    for (let i = 0; i < lumData.length; i += 4) {
      r += lumData[i];
      g += lumData[i + 1];
      b += lumData[i + 2];
    }
    drawWatermark(ctx, cw, ch, (r / n) * 0.299 + (g / n) * 0.587 + (b / n) * 0.114 < 128);
  }

  return canvas;
};

export const exportAnnotatedImage = async (
  source: HTMLImageElement | HTMLCanvasElement,
  markers: ExtractMarker[],
  settings?: Partial<SwatchSettings>
): Promise<ExportResult | null> => {
  const canvas = await renderAnnotatedCanvas(source, markers, settings, true);
  if (!canvas) return null;
  const filename = `gk-mixer-swatch-${Date.now()}.png`;
  return await saveOrExportImage(canvas, filename);
};

export const saveOrExportImage = async (
  canvas: HTMLCanvasElement,
  filename = `gk-mixer-swatch-${Date.now()}.png`
): Promise<ExportResult> => {
  const dataUrl = canvas.toDataURL("image/png");
  let savedToGallery = false;
  let shared = false;

  // 1. Android APK native MediaSaver plugin
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await MediaSaver.saveImageToGallery({
        base64Data: dataUrl,
        filename,
      });
      if (res && res.success) {
        savedToGallery = true;
      }
    } catch (err) {
      console.warn("[Export] MediaSaver native save failed:", err);
    }
  }

  // 2. If not on native platform, or if native save failed, trigger browser download
  if (!Capacitor.isNativePlatform()) {
    try {
      const link = document.createElement("a");
      link.download = filename;
      link.href = dataUrl;
      link.click();
    } catch (linkErr) {
      console.warn("[Export] DOM download link click failed:", linkErr);
    }
  }

  return { dataUrl, filename, savedToGallery, shared };
};

export const shareExportedImage = async (
  dataUrl: string,
  filename = `gk-mixer-swatch-${Date.now()}.png`
): Promise<boolean> => {
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await MediaSaver.shareImage({
        base64Data: dataUrl,
        filename,
        title: "分享色卡标注图",
      });
      return res?.success ?? false;
    } catch (e) {
      console.warn("[Share] Native share failed:", e);
    }
  }

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], filename, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "GK Mixer 色卡标注图",
        });
        return true;
      }
    } catch (err) {
      console.log("[Share] Web share cancelled or failed:", err);
    }
  }

  return false;
};
