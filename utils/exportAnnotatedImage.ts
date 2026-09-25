import { CatalogPaint, ColorData } from "../types";
import { getContrastColor } from "./colorUtils";
import { paintBottleUrls } from "./paintBottle";
import {
  BASE_CARD_H,
  BASE_CARD_W,
  calculateLeaderLine,
  drawLeaderLineOnCanvas,
  getCanvasScale,
  SwatchSettings,
  DEFAULT_SWATCH_SETTINGS,
} from "./swatchLayout";

export interface ExtractMarker {
  id: string;
  nx: number;
  ny: number;
  hex: string;
  paint?: CatalogPaint;
  labelNx?: number;
  labelNy?: number;
  labelScale?: number;
}

const imageCache = new Map<string, HTMLImageElement | null>();

const loadImage = (src: string, cors = true): Promise<HTMLImageElement | null> => {
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

const loadBottle = async (paint?: CatalogPaint): Promise<HTMLImageElement | null> => {
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
    }));

export const exportAnnotatedImage = async (
  source: HTMLImageElement | HTMLCanvasElement,
  markers: ExtractMarker[],
  settings?: Partial<SwatchSettings>
): Promise<void> => {
  const cw = "naturalWidth" in source && source.naturalWidth ? source.naturalWidth : source.width;
  const ch = "naturalHeight" in source && source.naturalHeight ? source.naturalHeight : source.height;
  if (!cw || !ch) return;

  const mergedSettings: SwatchSettings = {
    ...DEFAULT_SWATCH_SETTINGS,
    ...settings,
  };

  const bottles = await Promise.all(markers.map((marker) => loadBottle(marker.paint)));

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.drawImage(source, 0, 0, cw, ch);

  const s = getCanvasScale(cw, ch);
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
      // Just unassigned pin point
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

    const effectiveScale = (marker.labelScale ?? globalScale);
    const cardW = BASE_CARD_W * s * effectiveScale;
    const cardH = BASE_CARD_H * s * effectiveScale;

    const box =
      typeof marker.labelNx === "number" && typeof marker.labelNy === "number"
        ? {
            x: marker.labelNx * cw,
            y: marker.labelNy * ch,
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

    // Draw leader line using chosen style
    const linePath = calculateLeaderLine(
      box,
      { x: mx, y: my },
      mergedSettings.lineStyle,
      6 * s,
      s * effectiveScale
    );

    const strokeColor = mergedSettings.lineMatchPaintColor ? hex : "rgba(255,255,255,0.95)";
    const shadowColor = mergedSettings.lineMatchPaintColor ? "rgba(0,0,0,0.65)" : "rgba(0,0,0,0.45)";
    const lineWidth = mergedSettings.lineWidth * 1.1;

    drawLeaderLineOnCanvas(
      ctx,
      linePath,
      lineWidth,
      strokeColor,
      shadowColor,
      s
    );

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

  // Second pass: draw cards on top of lines
  renderedItems.forEach(({ marker, box, paint, bottle, hex, effectiveScale }) => {
    const font1 = Math.round(15 * s * effectiveScale);
    const font2 = Math.round(13 * s * effectiveScale);
    const fontHex = Math.round(11 * s * effectiveScale);
    const pad = 7 * s * effectiveScale;
    const gap = 5 * s * effectiveScale;
    const codeLine = `${paint.brand} ${paint.code}`;
    const nameLine = paint.name || "";
    const cornerRadius = 10 * s * effectiveScale;

    // Card background: Solid or Liquid Glass
    ctx.save();
    if (mergedSettings.cardGlassEffect) {
      // Frosted glass translucent look
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      roundRect(ctx, box.x, box.y, box.w, box.h, cornerRadius);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 1.5 * s;
      ctx.stroke();
    } else {
      // Crisp solid white card
      ctx.fillStyle = "rgba(255,255,255,0.97)";
      roundRect(ctx, box.x, box.y, box.w, box.h, cornerRadius);
      ctx.fill();
      ctx.strokeStyle = "rgba(15,23,42,0.12)";
      ctx.lineWidth = 1.25 * s;
      ctx.stroke();
    }
    ctx.restore();

    const thumbW = bottle ? 46 * s * effectiveScale : 0;
    const thumbPad = bottle ? 8 * s * effectiveScale : 0;
    const textX = box.x + thumbW + thumbPad + pad;

    // Draw bottle thumbnail
    if (bottle) {
      const tX = box.x + pad;
      const tY = box.y + pad;
      const tH = box.h - pad * 2;
      ctx.save();
      roundRect(ctx, tX, tY, thumbW, tH, 6 * s * effectiveScale);
      ctx.clip();
      ctx.fillStyle = mergedSettings.cardGlassEffect ? "rgba(241,245,249,0.75)" : "#f8fafc";
      ctx.fillRect(tX, tY, thumbW, tH);
      const aspect = bottle.width / bottle.height;
      let dW = thumbW;
      let dH = tH;
      if (aspect > thumbW / tH) dH = thumbW / aspect;
      else dW = tH * aspect;
      ctx.drawImage(bottle, tX + (thumbW - dW) / 2, tY + (tH - dH) / 2, dW, dH);
      ctx.restore();
    }

    const maxTextW = Math.max(10, box.x + box.w - pad - textX);
    const fitText = (text: string, maxWidth: number) => {
      if (ctx.measureText(text).width <= maxWidth) return text;
      let str = text;
      while (str.length > 1 && ctx.measureText(str + "...").width > maxWidth) {
        str = str.slice(0, -1);
      }
      return str + "...";
    };

    // Paint brand & code
    ctx.font = `bold ${font1}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = "#0f172a";
    ctx.fillText(fitText(codeLine, maxTextW), textX, box.y + pad + font1);

    // Paint name
    if (nameLine) {
      ctx.font = `${font2}px ui-sans-serif, system-ui, sans-serif`;
      ctx.fillStyle = "#64748b";
      ctx.fillText(fitText(nameLine, maxTextW), textX, box.y + pad + font1 + gap + font2);
    }

    // Hex badge
    ctx.font = `bold ${fontHex}px ui-monospace, Menlo, monospace`;
    const hexW = ctx.measureText(hex).width;
    const hexY = box.y + pad + font1 + (nameLine ? gap + font2 : 0) + gap;
    roundRect(ctx, textX, hexY, hexW + 12 * s * effectiveScale, fontHex + 6 * s * effectiveScale, 4 * s * effectiveScale);
    ctx.fillStyle = hex;
    ctx.fill();
    ctx.fillStyle = getContrastColor(hex);
    ctx.fillText(hex, textX + 6 * s * effectiveScale, hexY + fontHex + 1 * s * effectiveScale);
  });

  // Watermark
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

  const link = document.createElement("a");
  link.download = `gk-mixer-swatch-${Date.now()}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
};
