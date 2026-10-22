import { Capacitor, registerPlugin } from "@capacitor/core";
import { CatalogPaint, ColorData, TonalStep } from "../types";
import { getContrastColor } from "./colorUtils";
import { paintBottleUrls } from "./paintBottle";
import {
  calculateLeaderLine,
  drawLeaderLineOnCanvas,
  getCanvasScale,
  getCardBaseDimensions,
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
  const cw = targetWidth && targetWidth > 0 ? Math.round(targetWidth) : srcW;
  const ch = targetWidth && targetWidth > 0 ? Math.round(cw * aspectRatio) : srcH;

  const mergedSettings: SwatchSettings = {
    ...DEFAULT_SWATCH_SETTINGS,
    ...settings,
  };

  const bottles = await Promise.all(markers.map((marker) => loadBottle(marker.paint)));

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(source, 0, 0, cw, ch);

  const { baseW, baseH } = getCardBaseDimensions(mergedSettings.cardBaseWidth);
  const s = getCanvasScale(cw, ch, baseW);
  const globalScale = mergedSettings.cardScale;
  const placed: LabelBox[] = [];
  const points = markers.map((marker) => ({ x: marker.nx * cw, y: marker.ny * ch }));

  // First pass: calculate box positions and draw leader lines behind cards
  const renderedItems: Array<{
    marker: ExtractMarker;
    box: LabelBox;
    paint: CatalogPaint;
    bottle: HTMLImageElement | null;
    hex: string;
    mx: number;
    my: number;
    effectiveScale: number;
  }> = [];

  markers.forEach((marker, index) => {
    const mx = points[index].x;
    const my = points[index].y;
    const paint = marker.paint;
    const bottle = bottles[index];
    const hex = (paint?.hex || marker.hex).toUpperCase();

    if (!paint) {
      ctx.beginPath();
      ctx.arc(mx, my, 6 * s, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.lineWidth = 3.5 * s;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(mx, my, 6 * s, 0, Math.PI * 2);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2 * s;
      ctx.stroke();
      return;
    }

    const effectiveScale = marker.labelScale ?? globalScale;
    const unitScale = s * effectiveScale;
    const cardW = Math.round(baseW * unitScale);
    const hasTonal = marker.tonalGradient && marker.tonalGradient.length > 0;
    const cardH = Math.round((baseH + (hasTonal ? 14 : 0)) * unitScale);

    const box =
      typeof marker.labelNx === "number" && typeof marker.labelNy === "number"
        ? {
            x: Math.min(Math.max(0, Math.round(marker.labelNx * cw)), Math.max(0, cw - cardW)),
            y: Math.min(Math.max(0, Math.round(marker.labelNy * ch)), Math.max(0, ch - cardH)),
            w: cardW,
            h: cardH,
          }
        : placeCard({ x: mx, y: my }, cardW, cardH, cw, ch, s, placed, points);
    placed.push(box);

    renderedItems.push({
      marker,
      box,
      paint,
      bottle,
      hex,
      mx,
      my,
      effectiveScale,
    });

    const linePath = calculateLeaderLine(
      box,
      { x: mx, y: my },
      mergedSettings.lineStyle,
      6 * s,
      unitScale
    );

    const strokeColor = mergedSettings.lineMatchPaintColor ? hex : "rgba(255,255,255,0.95)";
    const shadowColor = mergedSettings.lineMatchPaintColor ? "rgba(0,0,0,0.65)" : "rgba(0,0,0,0.45)";
    const lineWidth = mergedSettings.lineWidth * 1.1;

    drawLeaderLineOnCanvas(ctx, linePath, lineWidth, strokeColor, shadowColor, s);

    // Draw sample pin point
    ctx.beginPath();
    ctx.arc(mx, my, 6 * s, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 3.5 * s;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(mx, my, 6 * s, 0, Math.PI * 2);
    ctx.strokeStyle = mergedSettings.lineMatchPaintColor ? hex : "#ffffff";
    ctx.lineWidth = 2 * s;
    ctx.stroke();

    if (mergedSettings.lineMatchPaintColor) {
      ctx.beginPath();
      ctx.arc(mx, my, 3 * s, 0, Math.PI * 2);
      ctx.fillStyle = hex;
      ctx.fill();
    }
  });

  // Second pass: draw cards on top of lines with strict clipping so long names never overflow
  renderedItems.forEach(({ marker, box, paint, bottle, hex, effectiveScale }) => {
    const unitScale = s * effectiveScale;
    const font1 = Math.max(8, Math.round(13.5 * unitScale));
    const font2 = Math.max(7, Math.round(11.5 * unitScale));
    const fontHex = Math.max(7, Math.round(10 * unitScale));
    const pad = Math.round(6.5 * unitScale);
    const gap = Math.round(4 * unitScale);
    const codeLine = `${paint.brand} ${paint.code}`;
    const nameLine = paint.name || "";
    const cornerRadius = Math.round(10 * unitScale);

    ctx.save();
    roundRect(ctx, box.x, box.y, box.w, box.h, cornerRadius);
    if (mergedSettings.cardGlassEffect) {
      ctx.fillStyle = "rgba(255,255,255,0.86)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.75)";
      ctx.lineWidth = 1.5 * s;
      ctx.stroke();
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.97)";
      ctx.fill();
      ctx.strokeStyle = "rgba(15,23,42,0.12)";
      ctx.lineWidth = 1.25 * s;
      ctx.stroke();
    }
    // Clip everything inside the card boundary
    ctx.clip();

    const tonalBarH = marker.tonalGradient?.length ? Math.round(11 * unitScale) : 0;
    const mainBodyH = box.h - tonalBarH;
    // Strict 1:1 square inner swatch/bottle thumbnail (never stretched non-uniformly)
    const thumbSize = Math.max(
      12,
      Math.round(Math.min(mainBodyH - pad * 2, (box.w - pad * 2) * 0.34))
    );
    const thumbPad = Math.round(7 * unitScale);
    const tX = box.x + pad;
    const tY = box.y + Math.round((mainBodyH - thumbSize) / 2);
    const textX = tX + thumbSize + thumbPad;

    ctx.save();
    roundRect(ctx, tX, tY, thumbSize, thumbSize, Math.round(6 * unitScale));
    ctx.clip();
    if (bottle) {
      ctx.fillStyle = mergedSettings.cardGlassEffect ? "rgba(241,245,249,0.75)" : "#f8fafc";
      ctx.fillRect(tX, tY, thumbSize, thumbSize);
      const aspect = bottle.width / bottle.height;
      let dW = thumbSize;
      let dH = thumbSize;
      if (aspect > 1) dH = thumbSize / aspect;
      else dW = thumbSize * aspect;
      ctx.drawImage(bottle, tX + (thumbSize - dW) / 2, tY + (thumbSize - dH) / 2, dW, dH);
    } else {
      ctx.fillStyle = hex;
      ctx.fillRect(tX, tY, thumbSize, thumbSize);
    }
    ctx.restore();

    const maxTextW = Math.max(10, box.x + box.w - pad - textX);
    const fitText = (text: string, maxWidth: number) => {
      if (ctx.measureText(text).width <= maxWidth) return text;
      let str = text;
      while (str.length > 1 && ctx.measureText(str + "…").width > maxWidth) {
        str = str.slice(0, -1);
      }
      return str + "…";
    };

    // Paint brand & code
    ctx.font = `bold ${font1}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = "#0f172a";
    ctx.fillText(fitText(codeLine, maxTextW), textX, box.y + pad + font1 * 0.92);

    // Paint name with auto font scaling for long Japanese/Chinese names
    if (nameLine) {
      ctx.font = `600 ${font2}px ui-sans-serif, system-ui, sans-serif`;
      let actualNameFont = font2;
      if (ctx.measureText(nameLine).width > maxTextW && font2 > 8) {
        actualNameFont = Math.max(8, Math.round(font2 * 0.85));
        ctx.font = `600 ${actualNameFont}px ui-sans-serif, system-ui, sans-serif`;
      }
      ctx.fillStyle = "#475569";
      ctx.fillText(fitText(nameLine, maxTextW), textX, box.y + pad + font1 + gap + actualNameFont * 0.9);
    }

    // Hex badge
    ctx.font = `bold ${fontHex}px ui-monospace, Menlo, monospace`;
    const hexW = Math.min(maxTextW - 10 * unitScale, ctx.measureText(hex).width);
    const hexY = box.y + mainBodyH - pad - (fontHex + 5 * unitScale);
    roundRect(ctx, textX, hexY, hexW + 10 * unitScale, fontHex + 5 * unitScale, 4 * unitScale);
    ctx.fillStyle = hex;
    ctx.fill();
    ctx.fillStyle = getContrastColor(hex);
    ctx.fillText(hex, textX + 5 * unitScale, hexY + fontHex + 0.5 * unitScale);

    // Optional Tonal Gradient Bar at bottom of card (matching iOS TonalStep integration)
    if (marker.tonalGradient && marker.tonalGradient.length > 0) {
      const steps = marker.tonalGradient;
      const barY = box.y + mainBodyH;
      const segW = box.w / steps.length;
      steps.forEach((step, idx) => {
        ctx.fillStyle = step.hex;
        ctx.fillRect(box.x + idx * segW, barY, segW + 0.5, tonalBarH);
      });
    }

    ctx.restore();
  });

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
