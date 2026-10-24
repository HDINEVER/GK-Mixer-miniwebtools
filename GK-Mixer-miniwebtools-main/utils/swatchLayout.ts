import { CatalogPaint } from '../types';

export type ExtractLeaderLineStyle = 'stepped' | 'roundedStepped' | 'straight' | 'curved';

export interface SwatchSettings {
  lineStyle: ExtractLeaderLineStyle;
  lineWidth: number; // 1 to 6 px, default 2.5
  lineMatchPaintColor: boolean; // default false
  cardScale: number; // 0.6 to 1.6, default 1.0
  cardBaseWidth: number; // 120 to 220 px, default 160 (locked aspect ratio with height)
  cardGlassEffect: boolean; // default false
}

export const DEFAULT_SWATCH_SETTINGS: SwatchSettings = {
  lineStyle: 'stepped',
  lineWidth: 2.5,
  lineMatchPaintColor: false,
  cardScale: 1.0,
  cardBaseWidth: 160,
  cardGlassEffect: false,
};

export const BASE_CARD_W = 160;
export const BASE_CARD_H = 72;
export const CARD_ASPECT_RATIO = BASE_CARD_H / BASE_CARD_W; // 0.45 locked aspect ratio
export const REFERENCE_CANVAS_DIM = 800;

export function getCardBaseDimensions(cardBaseWidth = BASE_CARD_W): { baseW: number; baseH: number } {
  const baseW = Math.min(220, Math.max(120, cardBaseWidth || BASE_CARD_W));
  const baseH = Math.round(baseW * CARD_ASPECT_RATIO);
  return { baseW, baseH };
}

/**
 * Computes proportional canvas scale factor for cards & lines given image dimensions.
 * Matches iOS ExtractLabelMetrics.canvasScale with narrow aspect-ratio adaptation.
 */
export function getCanvasScale(width: number, height: number, cardBaseWidth = BASE_CARD_W): number {
  const maxSide = Math.max(width, height);
  if (maxSide <= 1) return 1.0;

  let scale = maxSide / REFERENCE_CANVAS_DIM;
  const { baseW } = getCardBaseDimensions(cardBaseWidth);

  // Guard for ultra-tall portrait aspect ratios (e.g. 9:19.5 phone screenshots):
  // Cap the card width so it never takes up more than ~36% of the canvas width
  // at default 1.0x card scale, preserving clean two-column layout without overlap.
  const maxCardWidth = width * 0.36;
  if (baseW * scale > maxCardWidth && width > 40) {
    scale = maxCardWidth / baseW;
  }

  // Set a reasonable floor so interactive cards don't vanish on tiny thumbnails
  return Math.max(0.32, scale);
}

export interface LeaderLinePath {
  svgPath: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  p1?: { x: number; y: number };
  p2?: { x: number; y: number };
  t1?: { x: number; y: number };
  t2?: { x: number; y: number };
  t3?: { x: number; y: number };
  t4?: { x: number; y: number };
  style: ExtractLeaderLineStyle;
}

/**
 * Calculates leader line path between a swatch card and its sample pin point.
 * Matches iOS GK-Mixer ExtractSample.swift leaderPathPoints implementation.
 */
export function calculateLeaderLine(
  cardRect: { x: number; y: number; w: number; h: number },
  pin: { x: number; y: number },
  style: ExtractLeaderLineStyle = 'stepped',
  pinRadius = 0,
  scale = 1.0
): LeaderLinePath {
  const cardCenterX = cardRect.x + cardRect.w / 2;
  const cardCenterY = cardRect.y + cardRect.h / 2;
  const isLeft = pin.x >= cardCenterX;

  if (style === 'straight') {
    const from = {
      x: isLeft ? cardRect.x + cardRect.w : cardRect.x,
      y: cardCenterY,
    };
    let toX = pin.x;
    let toY = pin.y;
    if (pinRadius > 0) {
      const dx = pin.x - from.x;
      const dy = pin.y - from.y;
      const dist = Math.hypot(dx, dy);
      if (dist > pinRadius) {
        toX = pin.x - (dx / dist) * pinRadius;
        toY = pin.y - (dy / dist) * pinRadius;
      }
    }
    const to = { x: toX, y: toY };
    return {
      svgPath: `M ${from.x} ${from.y} L ${to.x} ${to.y}`,
      from,
      to,
      style,
    };
  }

  if (style === 'curved') {
    const from = {
      x: isLeft ? cardRect.x + cardRect.w : cardRect.x,
      y: cardCenterY,
    };
    let toX = pin.x;
    let toY = pin.y;
    if (pinRadius > 0) {
      toX = isLeft ? Math.max(from.x, pin.x - pinRadius) : Math.min(from.x, pin.x + pinRadius);
    }
    const to = { x: toX, y: toY };
    const dx = to.x - from.x;
    const p1 = { x: from.x + dx * 0.5, y: from.y };
    const p2 = { x: from.x + dx * 0.5, y: to.y };
    return {
      svgPath: `M ${from.x} ${from.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${to.x} ${to.y}`,
      from,
      to,
      p1,
      p2,
      style,
    };
  }

  // Stepped and RoundedStepped
  const from = {
    x: isLeft ? cardRect.x + cardRect.w : cardRect.x,
    y: cardCenterY,
  };

  let elbowX: number;
  let finalX: number;
  let endX: number;

  if (isLeft) {
    endX = Math.max(from.x, pin.x - pinRadius);
    if (Math.abs(from.y - pin.y) < 2) {
      const to = { x: endX, y: pin.y };
      return {
        svgPath: `M ${from.x} ${from.y} L ${to.x} ${to.y}`,
        from,
        to,
        style,
      };
    }
    if (pin.x > cardRect.x + cardRect.w) {
      elbowX = from.x + (pin.x - from.x) * 0.5;
      finalX = Math.max(elbowX, pin.x - pinRadius);
    } else {
      const lead = Math.max(14 * scale, 10);
      elbowX = Math.max(from.x + lead, cardRect.x + cardRect.w + lead);
      finalX = pin.x < elbowX ? Math.max(elbowX, pin.x + pinRadius) : Math.min(elbowX, pin.x - pinRadius);
    }
  } else {
    endX = Math.min(from.x, pin.x + pinRadius);
    if (Math.abs(from.y - pin.y) < 2) {
      const to = { x: endX, y: pin.y };
      return {
        svgPath: `M ${from.x} ${from.y} L ${to.x} ${to.y}`,
        from,
        to,
        style,
      };
    }
    if (pin.x < cardRect.x) {
      elbowX = from.x - (from.x - pin.x) * 0.5;
      finalX = Math.min(elbowX, pin.x + pinRadius);
    } else {
      const lead = Math.max(14 * scale, 10);
      elbowX = Math.min(from.x - lead, cardRect.x - lead);
      finalX = pin.x > elbowX ? Math.min(elbowX, pin.x - pinRadius) : Math.max(elbowX, pin.x + pinRadius);
    }
  }

  const p1 = { x: elbowX, y: from.y };
  const p2 = { x: elbowX, y: pin.y };
  const to = { x: finalX, y: pin.y };

  if (style === 'stepped') {
    return {
      svgPath: `M ${from.x} ${from.y} L ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${to.x} ${to.y}`,
      from,
      to,
      p1,
      p2,
      style,
    };
  }

  // Rounded stepped fillet
  const nominalRadius = Math.max(14 * scale, 8);
  const d1x = p1.x - from.x;
  const d2y = p2.y - p1.y;
  const d3x = to.x - p2.x;

  const len1 = Math.abs(d1x);
  const len2 = Math.abs(d2y);
  const len3 = Math.abs(d3x);

  const r1 = Math.min(nominalRadius, len1 * 0.45, len2 * 0.45);
  const r2 = Math.min(nominalRadius, len2 * 0.45, len3 * 0.45);

  if (r1 <= 2 || r2 <= 2) {
    return {
      svgPath: `M ${from.x} ${from.y} L ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${to.x} ${to.y}`,
      from,
      to,
      p1,
      p2,
      style,
    };
  }

  const sign1x = d1x >= 0 ? 1 : -1;
  const sign2y = d2y >= 0 ? 1 : -1;
  const sign3x = d3x >= 0 ? 1 : -1;

  const t1 = { x: p1.x - sign1x * r1, y: p1.y };
  const t2 = { x: p1.x, y: p1.y + sign2y * r1 };
  const t3 = { x: p2.x, y: p2.y - sign2y * r2 };
  const t4 = { x: p2.x + sign3x * r2, y: p2.y };

  const svgPath = `M ${from.x} ${from.y} L ${t1.x} ${t1.y} Q ${p1.x} ${p1.y} ${t2.x} ${t2.y} L ${t3.x} ${t3.y} Q ${p2.x} ${p2.y} ${t4.x} ${t4.y} L ${to.x} ${to.y}`;

  return {
    svgPath,
    from,
    to,
    p1,
    p2,
    t1,
    t2,
    t3,
    t4,
    style,
  };
}

/**
 * Draws leader line on HTML5 Canvas.
 */
export function drawLeaderLineOnCanvas(
  ctx: CanvasRenderingContext2D,
  line: LeaderLinePath,
  lineWidth: number,
  strokeColor: string,
  shadowColor: string,
  scale = 1.0
) {
  const outerWidth = lineWidth * 1.7 * scale;
  const innerWidth = lineWidth * scale;

  const tracePath = () => {
    ctx.beginPath();
    ctx.moveTo(line.from.x, line.from.y);
    if (line.style === 'straight') {
      ctx.lineTo(line.to.x, line.to.y);
    } else if (line.style === 'stepped' && line.p1 && line.p2) {
      ctx.lineTo(line.p1.x, line.p1.y);
      ctx.lineTo(line.p2.x, line.p2.y);
      ctx.lineTo(line.to.x, line.to.y);
    } else if (line.style === 'roundedStepped' && line.p1 && line.p2 && line.t1 && line.t2 && line.t3 && line.t4) {
      ctx.lineTo(line.t1.x, line.t1.y);
      ctx.quadraticCurveTo(line.p1.x, line.p1.y, line.t2.x, line.t2.y);
      ctx.lineTo(line.t3.x, line.t3.y);
      ctx.quadraticCurveTo(line.p2.x, line.p2.y, line.t4.x, line.t4.y);
      ctx.lineTo(line.to.x, line.to.y);
    } else if (line.style === 'curved' && line.p1 && line.p2) {
      ctx.bezierCurveTo(line.p1.x, line.p1.y, line.p2.x, line.p2.y, line.to.x, line.to.y);
    } else {
      ctx.lineTo(line.to.x, line.to.y);
    }
  };

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Contrast / Shadow outline
  tracePath();
  ctx.strokeStyle = shadowColor;
  ctx.lineWidth = outerWidth;
  ctx.stroke();

  // Foreground colored line
  tracePath();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = innerWidth;
  ctx.stroke();

  ctx.restore();
}

/**
 * Automatically arranges swatch cards into left and right columns (左右分列).
 * Matches iOS ExtractSample.autoArrangedOriginsLeftRight algorithm with non-overlapping spacing.
 */
export function autoArrangeLeftRight<T extends { id: string; nx: number; ny: number; paint?: CatalogPaint }>(
  markers: T[],
  boxW: number,
  boxH: number,
  cardScale = 1.0,
  edgePadding = 12,
  cardBaseWidth = BASE_CARD_W
): { [id: string]: { nx: number; ny: number } } {
  const assigned = markers.filter((m) => !!m.paint);
  if (assigned.length === 0) return {};

  const width = Math.max(boxW, 100);
  const height = Math.max(boxH, 100);
  const { baseW, baseH } = getCardBaseDimensions(cardBaseWidth);
  const canvasScale = getCanvasScale(width, height, baseW);
  const totalScale = canvasScale * cardScale;
  const cardW = baseW * totalScale;
  const cardH = baseH * totalScale;
  const resolvedEdgePadding = Math.min(edgePadding, width * 0.04);

  const leftGroup: T[] = [];
  const rightGroup: T[] = [];

  for (const m of assigned) {
    if (m.nx < 0.5) {
      leftGroup.push(m);
    } else {
      rightGroup.push(m);
    }
  }

  leftGroup.sort((a, b) => a.ny - b.ny);
  rightGroup.sort((a, b) => a.ny - b.ny);

  const results: { [id: string]: { nx: number; ny: number } } = {};

  const arrangeCol = (group: T[], isLeft: boolean) => {
    if (group.length === 0) return;
    const count = group.length;
    const topPadding = Math.max(8, height * 0.02);
    const bottomPadding = Math.max(8, height * 0.02);
    const minGapY = Math.max(6, height * 0.015);

    const ys: number[] = [];
    for (let i = 0; i < count; i++) {
      const sample = group[i];
      const idealY = sample.ny * height - cardH / 2;
      const clampedY = Math.min(Math.max(idealY, topPadding), Math.max(topPadding, height - bottomPadding - cardH));
      ys.push(clampedY);
    }

    // Forward pass: avoid overlap with previous card
    for (let i = 1; i < count; i++) {
      const prevBottom = ys[i - 1] + cardH + minGapY;
      if (ys[i] < prevBottom) {
        ys[i] = prevBottom;
      }
    }

    // Backward pass: pull back if bottom overflows
    const maxBottom = height - bottomPadding;
    if (ys[count - 1] + cardH > maxBottom) {
      ys[count - 1] = Math.max(topPadding, maxBottom - cardH);
      for (let i = count - 2; i >= 0; i--) {
        const nextTop = ys[i + 1] - minGapY - cardH;
        if (ys[i] > nextTop) {
          ys[i] = nextTop;
        }
      }
    }

    // If top still exceeds boundary, compress or distribute evenly
    if (ys[0] < topPadding) {
      const totalH = count * cardH;
      const availH = Math.max(0, height - topPadding - bottomPadding);
      if (totalH + (count - 1) * minGapY <= availH) {
        const extra = (availH - totalH) / Math.max(count, 1);
        let curY = topPadding + extra / 2;
        for (let i = 0; i < count; i++) {
          ys[i] = curY;
          curY += cardH + extra;
        }
      } else {
        const step = count > 1 ? (availH - cardH) / (count - 1) : 0;
        for (let i = 0; i < count; i++) {
          ys[i] = topPadding + i * step;
        }
      }
    }

    for (let i = 0; i < count; i++) {
      const sample = group[i];
      const cardWNorm = cardW / width;
      const padNorm = resolvedEdgePadding / width;
      const maxX = Math.max(0, 1 - cardWNorm);
      const nx = isLeft
        ? Math.min(padNorm, maxX)
        : Math.max(0, maxX - padNorm);
      const ny = ys[i] / height;

      const maxY = Math.max(0, 1 - cardH / height);
      results[sample.id] = {
        nx: Math.min(Math.max(nx, 0), maxX),
        ny: Math.min(Math.max(ny, 0), maxY),
      };
    }
  };

  arrangeCol(leftGroup, true);
  arrangeCol(rightGroup, false);

  return results;
}

/**
 * Automatically arranges swatch cards into top and bottom rows (上下分行).
 * Matches iOS ExtractSample.autoArrangedOriginsTopBottom algorithm with non-overlapping spacing.
 */
export function autoArrangeTopBottom<T extends { id: string; nx: number; ny: number; paint?: CatalogPaint }>(
  markers: T[],
  boxW: number,
  boxH: number,
  cardScale = 1.0,
  edgePadding = 12,
  cardBaseWidth = BASE_CARD_W
): { [id: string]: { nx: number; ny: number } } {
  const assigned = markers.filter((m) => !!m.paint);
  if (assigned.length === 0) return {};

  const width = Math.max(boxW, 100);
  const height = Math.max(boxH, 100);
  const { baseW, baseH } = getCardBaseDimensions(cardBaseWidth);
  const canvasScale = getCanvasScale(width, height, baseW);
  const totalScale = canvasScale * cardScale;
  const cardW = baseW * totalScale;
  const cardH = baseH * totalScale;
  const resolvedEdgePadding = Math.min(edgePadding, height * 0.04);

  const topGroup: T[] = [];
  const bottomGroup: T[] = [];

  for (const m of assigned) {
    if (m.ny < 0.5) {
      topGroup.push(m);
    } else {
      bottomGroup.push(m);
    }
  }

  topGroup.sort((a, b) => a.nx - b.nx);
  bottomGroup.sort((a, b) => a.nx - b.nx);

  const results: { [id: string]: { nx: number; ny: number } } = {};

  const arrangeRow = (group: T[], isTop: boolean) => {
    if (group.length === 0) return;
    const count = group.length;
    const leftPadding = Math.max(8, width * 0.02);
    const rightPadding = Math.max(8, width * 0.02);
    const minGapX = Math.max(6, width * 0.015);

    const xs: number[] = [];
    for (let i = 0; i < count; i++) {
      const sample = group[i];
      const idealX = sample.nx * width - cardW / 2;
      const clampedX = Math.min(Math.max(idealX, leftPadding), Math.max(leftPadding, width - rightPadding - cardW));
      xs.push(clampedX);
    }

    // Forward pass
    for (let i = 1; i < count; i++) {
      const prevRight = xs[i - 1] + cardW + minGapX;
      if (xs[i] < prevRight) {
        xs[i] = prevRight;
      }
    }

    // Backward pass
    const maxRight = width - rightPadding;
    if (xs[count - 1] + cardW > maxRight) {
      xs[count - 1] = Math.max(leftPadding, maxRight - cardW);
      for (let i = count - 2; i >= 0; i--) {
        const nextLeft = xs[i + 1] - minGapX - cardW;
        if (xs[i] > nextLeft) {
          xs[i] = nextLeft;
        }
      }
    }

    // If left overflows, distribute evenly
    if (xs[0] < leftPadding) {
      const totalW = count * cardW;
      const availW = Math.max(0, width - leftPadding - rightPadding);
      if (totalW + (count - 1) * minGapX <= availW) {
        const extra = (availW - totalW) / Math.max(count, 1);
        let curX = leftPadding + extra / 2;
        for (let i = 0; i < count; i++) {
          xs[i] = curX;
          curX += cardW + extra;
        }
      } else {
        const step = count > 1 ? (availW - cardW) / (count - 1) : 0;
        for (let i = 0; i < count; i++) {
          xs[i] = leftPadding + i * step;
        }
      }
    }

    for (let i = 0; i < count; i++) {
      const sample = group[i];
      const cardHNorm = cardH / height;
      const padNorm = resolvedEdgePadding / height;
      const maxY = Math.max(0, 1 - cardHNorm);
      const ny = isTop
        ? Math.min(padNorm, maxY)
        : Math.max(0, maxY - padNorm);
      const nx = xs[i] / width;

      const maxX = Math.max(0, 1 - cardW / width);
      results[sample.id] = {
        nx: Math.min(Math.max(nx, 0), maxX),
        ny: Math.min(Math.max(ny, 0), maxY),
      };
    }
  };

  arrangeRow(topGroup, true);
  arrangeRow(bottomGroup, false);

  return results;
}

/**
 * Alignment helpers for either a single selected card or all cards.
 */
export function alignMarkers<T extends { id: string; nx: number; ny: number; labelNx?: number; labelNy?: number; paint?: CatalogPaint }>(
  markers: T[],
  alignment: 'left' | 'right' | 'top' | 'bottom' | 'autoH' | 'autoV',
  boxW: number,
  boxH: number,
  cardScale = 1.0,
  targetId?: string,
  edgePadding = 12,
  cardBaseWidth = BASE_CARD_W
): { [id: string]: { nx: number; ny: number } } {
  const width = Math.max(boxW, 100);
  const height = Math.max(boxH, 100);
  const { baseW, baseH } = getCardBaseDimensions(cardBaseWidth);
  const canvasScale = getCanvasScale(width, height, baseW);
  const totalScale = canvasScale * cardScale;
  const cardW = baseW * totalScale;
  const cardH = baseH * totalScale;
  const cardWNorm = cardW / width;
  const cardHNorm = cardH / height;
  const resolvedEdgePadding = Math.min(edgePadding, Math.min(width, height) * 0.04);
  const padNormX = resolvedEdgePadding / width;
  const padNormY = resolvedEdgePadding / height;
  const maxX = Math.max(0, 1 - cardWNorm);
  const maxY = Math.max(0, 1 - cardHNorm);

  const targets = targetId ? markers.filter((m) => m.id === targetId) : markers.filter((m) => !!m.paint);
  const results: { [id: string]: { nx: number; ny: number } } = {};

  for (const m of targets) {
    let curNx = m.labelNx ?? (m.nx > 0.55 ? Math.max(0, m.nx - cardWNorm - 0.03) : Math.min(maxX, m.nx + 0.03));
    let curNy = m.labelNy ?? Math.min(maxY, Math.max(0, m.ny - cardHNorm / 2));

    switch (alignment) {
      case 'left':
        curNx = Math.min(padNormX, maxX);
        break;
      case 'right':
        curNx = Math.max(0, maxX - padNormX);
        break;
      case 'autoH':
        curNx = m.nx < 0.5 ? Math.min(padNormX, maxX) : Math.max(0, maxX - padNormX);
        break;
      case 'top':
        curNy = Math.min(padNormY, maxY);
        break;
      case 'bottom':
        curNy = Math.max(0, maxY - padNormY);
        break;
      case 'autoV':
        curNy = m.ny < 0.5 ? Math.min(padNormY, maxY) : Math.max(0, maxY - padNormY);
        break;
    }

    results[m.id] = {
      nx: Math.min(Math.max(curNx, 0), maxX),
      ny: Math.min(Math.max(curNy, 0), maxY),
    };
  }

  return results;
}

/**
 * Resets swatch cards back to default offset positions relative to their sample pins.
 */
export function resetMarkerPositions<T extends { id: string; nx: number; ny: number }>(
  markers: T[],
  boxW: number,
  boxH: number,
  cardScale = 1.0,
  targetId?: string,
  cardBaseWidth = BASE_CARD_W
): { [id: string]: { nx: number; ny: number } } {
  const width = Math.max(boxW, 100);
  const height = Math.max(boxH, 100);
  const { baseW, baseH } = getCardBaseDimensions(cardBaseWidth);
  const canvasScale = getCanvasScale(width, height, baseW);
  const totalScale = canvasScale * cardScale;
  const cardW = baseW * totalScale;
  const cardH = baseH * totalScale;
  const cardWNorm = cardW / width;
  const cardHNorm = cardH / height;
  const gap = Math.max(12, width * 0.02) / width;
  const maxX = Math.max(0, 1 - cardWNorm);
  const maxY = Math.max(0, 1 - cardHNorm);

  const targets = targetId ? markers.filter((m) => m.id === targetId) : markers;
  const results: { [id: string]: { nx: number; ny: number } } = {};

  for (const m of targets) {
    const left = m.nx > 0.55 ? Math.max(0.01, m.nx - cardWNorm - gap) : Math.min(maxX, m.nx + gap);
    const top = Math.min(maxY, Math.max(0.01, m.ny - cardHNorm / 2));
    results[m.id] = { nx: left, ny: top };
  }

  return results;
}

/**
 * Smart Edge-Color Margin Extension (画布边缘留白扩展 · 防遮挡模型)
 */
export type MarginExtendMode =
  | 'none'
  | 'leftRight'
  | 'topBottom'
  | 'left'
  | 'right'
  | 'top'
  | 'bottom';

export interface SampledEdgeColors {
  left: string;
  right: string;
  top: string;
  bottom: string;
  overall: string;
}

export interface CanvasMarginRecord {
  /** Unpadded original image dataURL / URL */
  originalImageSrc: string;
  origWidth: number;
  origHeight: number;
  /** Normalized bounding box of the original image inside the current expanded canvas (0..1) */
  innerLeftNx: number;
  innerTopNy: number;
  innerWidthNw: number;
  innerHeightNh: number;
  mode: MarginExtendMode;
  /** Ratio per extended side relative to original width/height (e.g. 0.24, 0.32, 0.42) */
  ratio: number;
  /** Null = auto-follow original image edge colors; otherwise user custom hex */
  customColor: string | null;
  sampledEdgeColors: SampledEdgeColors;
}

const canvasMarginRegistry = new Map<string, CanvasMarginRecord>();

export function getCanvasMarginRecord(imageSrc: string): CanvasMarginRecord | undefined {
  if (!imageSrc) return undefined;
  return canvasMarginRegistry.get(imageSrc);
}

function rgbToHexStr(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g)
    .toString(16)
    .padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`.toUpperCase();
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

/**
 * Samples the border strips of an image using interquartile luminance mean
 * so foreground parts touching the border are ignored and true backdrop colors are extracted.
 */
export function sampleImageEdgeColors(img: HTMLImageElement): SampledEdgeColors {
  const fallback: SampledEdgeColors = {
    left: '#F1F5F9',
    right: '#F1F5F9',
    top: '#F1F5F9',
    bottom: '#F1F5F9',
    overall: '#F1F5F9',
  };
  try {
    const nw = img.naturalWidth || img.width || 100;
    const nh = img.naturalHeight || img.height || 100;
    const maxDim = 160;
    const scale = Math.min(1, maxDim / Math.max(nw, nh, 1));
    const sw = Math.max(16, Math.round(nw * scale));
    const sh = Math.max(16, Math.round(nh * scale));

    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return fallback;
    ctx.drawImage(img, 0, 0, sw, sh);
    const data = ctx.getImageData(0, 0, sw, sh).data;

    const sampleRect = (x0: number, y0: number, w: number, h: number) => {
      const pixels: Array<{ r: number; g: number; b: number; lum: number }> = [];
      const xEnd = Math.min(sw, Math.max(x0 + 1, x0 + w));
      const yEnd = Math.min(sh, Math.max(y0 + 1, y0 + h));
      for (let y = Math.max(0, y0); y < yEnd; y++) {
        for (let x = Math.max(0, x0); x < xEnd; x++) {
          const idx = (y * sw + x) * 4;
          const a = data[idx + 3];
          if (a < 32) continue;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          pixels.push({ r, g, b, lum });
        }
      }
      if (pixels.length === 0) return '#F1F5F9';
      pixels.sort((a, b) => a.lum - b.lum);
      const start = Math.floor(pixels.length * 0.25);
      const end = Math.max(start + 1, Math.ceil(pixels.length * 0.75));
      let sr = 0;
      let sg = 0;
      let sb = 0;
      const count = end - start;
      for (let i = start; i < end; i++) {
        sr += pixels[i].r;
        sg += pixels[i].g;
        sb += pixels[i].b;
      }
      return rgbToHexStr(sr / count, sg / count, sb / count);
    };

    const stripX = Math.max(2, Math.round(sw * 0.045));
    const stripY = Math.max(2, Math.round(sh * 0.045));
    const left = sampleRect(0, 0, stripX, sh);
    const right = sampleRect(sw - stripX, 0, stripX, sh);
    const top = sampleRect(0, 0, sw, stripY);
    const bottom = sampleRect(0, sh - stripY, sw, stripY);

    // Overall border average from the 4 edge colors
    const parseHex = (hex: string) => {
      const c = hex.replace('#', '');
      const n = parseInt(c, 16);
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    };
    const cL = parseHex(left);
    const cR = parseHex(right);
    const cT = parseHex(top);
    const cB = parseHex(bottom);
    const overall = rgbToHexStr(
      (cL.r + cR.r + cT.r + cB.r) / 4,
      (cL.g + cR.g + cT.g + cB.g) / 4,
      (cL.b + cR.b + cT.b + cB.b) / 4
    );

    return { left, right, top, bottom, overall };
  } catch {
    return fallback;
  }
}

export async function inspectOrSampleImageMargins(imageSrc: string): Promise<CanvasMarginRecord | null> {
  if (!imageSrc) return null;
  const existing = canvasMarginRegistry.get(imageSrc);
  if (existing) return existing;

  try {
    const img = await loadHtmlImage(imageSrc);
    const sampledEdgeColors = sampleImageEdgeColors(img);
    const record: CanvasMarginRecord = {
      originalImageSrc: imageSrc,
      origWidth: img.naturalWidth || img.width || 800,
      origHeight: img.naturalHeight || img.height || 600,
      innerLeftNx: 0,
      innerTopNy: 0,
      innerWidthNw: 1,
      innerHeightNh: 1,
      mode: 'none',
      ratio: 0.3,
      customColor: null,
      sampledEdgeColors,
    };
    canvasMarginRegistry.set(imageSrc, record);
    return record;
  } catch {
    return null;
  }
}

/**
 * Places swatch cards neatly inside the extended margin zone(s) so 0% of the model is covered.
 */
function arrangeCardsIntoMarginZone<
  T extends { id: string; sampleX?: number; sampleY?: number; assignedPaint?: CatalogPaint }
>(
  colors: T[],
  record: CanvasMarginRecord,
  newW: number,
  newH: number,
  cardScale = 1.0,
  cardBaseWidth = BASE_CARD_W
): { [id: string]: { nx: number; ny: number } } {
  const assigned = colors.filter(
    (c) => Number.isFinite(c.sampleX) && Number.isFinite(c.sampleY) && !!c.assignedPaint
  );
  if (assigned.length === 0) return {};

  const { baseW, baseH } = getCardBaseDimensions(cardBaseWidth);
  const canvasScale = getCanvasScale(newW, newH, baseW);
  const totalScale = canvasScale * cardScale;
  const cardWNorm = Math.min(0.42, (baseW * totalScale) / Math.max(100, newW));
  const cardHNorm = Math.min(0.32, (baseH * totalScale) / Math.max(100, newH));

  const results: { [id: string]: { nx: number; ny: number } } = {};
  const { mode, innerLeftNx, innerTopNy, innerWidthNw, innerHeightNh } = record;

  if (mode === 'none') {
    const markers = assigned.map((c) => ({
      id: c.id,
      nx: c.sampleX ?? 0.5,
      ny: c.sampleY ?? 0.5,
      paint: c.assignedPaint,
    }));
    return autoArrangeLeftRight(markers, newW, newH, cardScale, 12, cardBaseWidth);
  }

  // Helper to distribute cards vertically in a horizontal column band [bandLeft, bandRight]
  const placeVerticalColumn = (items: T[], bandLeft: number, bandRight: number) => {
    if (items.length === 0) return;
    const sorted = [...items].sort((a, b) => (a.sampleY ?? 0.5) - (b.sampleY ?? 0.5));
    const bandW = Math.max(0.02, bandRight - bandLeft);
    const nx = Math.max(
      0.008,
      Math.min(1 - cardWNorm - 0.008, bandLeft + (bandW - cardWNorm) / 2)
    );
    const minY = 0.025;
    const maxY = Math.max(minY, 1 - cardHNorm - 0.025);
    const desired = sorted.map((c) =>
      Math.min(maxY, Math.max(minY, (c.sampleY ?? 0.5) - cardHNorm / 2))
    );
    const ys = distribute1D(desired, cardHNorm, 0.016, minY, maxY);
    sorted.forEach((c, idx) => {
      results[c.id] = { nx, ny: ys[idx] };
    });
  };

  // Helper to distribute cards horizontally in a vertical row band [bandTop, bandBottom]
  const placeHorizontalRow = (items: T[], bandTop: number, bandBottom: number) => {
    if (items.length === 0) return;
    const sorted = [...items].sort((a, b) => (a.sampleX ?? 0.5) - (b.sampleX ?? 0.5));
    const bandH = Math.max(0.02, bandBottom - bandTop);
    const minX = 0.02;
    const maxX = Math.max(minX, 1 - cardWNorm - 0.02);

    // If many cards and band is tall enough for 2 staggered rows, split into 2 rows to prevent horizontal crowding
    if (sorted.length > 4 && bandH >= cardHNorm * 1.75) {
      const topRowY = Math.max(0.008, bandTop + (bandH - cardHNorm * 2 - 0.012) / 2);
      const botRowY = Math.min(1 - cardHNorm - 0.008, topRowY + cardHNorm + 0.012);
      const row0 = sorted.filter((_, idx) => idx % 2 === 0);
      const row1 = sorted.filter((_, idx) => idx % 2 === 1);
      const xs0 = distribute1D(
        row0.map((c) => Math.min(maxX, Math.max(minX, (c.sampleX ?? 0.5) - cardWNorm / 2))),
        cardWNorm,
        0.014,
        minX,
        maxX
      );
      const xs1 = distribute1D(
        row1.map((c) => Math.min(maxX, Math.max(minX, (c.sampleX ?? 0.5) - cardWNorm / 2))),
        cardWNorm,
        0.014,
        minX,
        maxX
      );
      row0.forEach((c, idx) => {
        results[c.id] = { nx: xs0[idx], ny: topRowY };
      });
      row1.forEach((c, idx) => {
        results[c.id] = { nx: xs1[idx], ny: botRowY };
      });
      return;
    }

    const ny = Math.max(
      0.008,
      Math.min(1 - cardHNorm - 0.008, bandTop + (bandH - cardHNorm) / 2)
    );
    const desired = sorted.map((c) =>
      Math.min(maxX, Math.max(minX, (c.sampleX ?? 0.5) - cardWNorm / 2))
    );
    const xs = distribute1D(desired, cardWNorm, 0.014, minX, maxX);
    sorted.forEach((c, idx) => {
      results[c.id] = { nx: xs[idx], ny };
    });
  };

  if (mode === 'left') {
    placeVerticalColumn(assigned, 0.008, Math.max(0.05, innerLeftNx - 0.008));
  } else if (mode === 'right') {
    const rightStart = innerLeftNx + innerWidthNw;
    placeVerticalColumn(assigned, Math.min(0.95, rightStart + 0.008), 0.992);
  } else if (mode === 'leftRight') {
    const midX = innerLeftNx + innerWidthNw / 2;
    let leftGroup = assigned.filter((c) => (c.sampleX ?? 0.5) < midX);
    let rightGroup = assigned.filter((c) => (c.sampleX ?? 0.5) >= midX);
    const maxPerSide = Math.ceil(assigned.length * 0.65);
    if (assigned.length >= 2 && (leftGroup.length > maxPerSide || rightGroup.length > maxPerSide)) {
      const sortedX = [...assigned].sort((a, b) => (a.sampleX ?? 0.5) - (b.sampleX ?? 0.5));
      const half = Math.ceil(sortedX.length / 2);
      leftGroup = sortedX.slice(0, half);
      rightGroup = sortedX.slice(half);
    }
    placeVerticalColumn(leftGroup, 0.008, Math.max(0.05, innerLeftNx - 0.008));
    const rightStart = innerLeftNx + innerWidthNw;
    placeVerticalColumn(rightGroup, Math.min(0.95, rightStart + 0.008), 0.992);
  } else if (mode === 'top') {
    placeHorizontalRow(assigned, 0.008, Math.max(0.05, innerTopNy - 0.008));
  } else if (mode === 'bottom') {
    const botStart = innerTopNy + innerHeightNh;
    placeHorizontalRow(assigned, Math.min(0.95, botStart + 0.008), 0.992);
  } else if (mode === 'topBottom') {
    const midY = innerTopNy + innerHeightNh / 2;
    let topGroup = assigned.filter((c) => (c.sampleY ?? 0.5) < midY);
    let botGroup = assigned.filter((c) => (c.sampleY ?? 0.5) >= midY);
    const maxPerSide = Math.ceil(assigned.length * 0.65);
    if (assigned.length >= 2 && (topGroup.length > maxPerSide || botGroup.length > maxPerSide)) {
      const sortedY = [...assigned].sort((a, b) => (a.sampleY ?? 0.5) - (b.sampleY ?? 0.5));
      const half = Math.ceil(sortedY.length / 2);
      topGroup = sortedY.slice(0, half);
      botGroup = sortedY.slice(half);
    }
    placeHorizontalRow(topGroup, 0.008, Math.max(0.05, innerTopNy - 0.008));
    const botStart = innerTopNy + innerHeightNh;
    placeHorizontalRow(botGroup, Math.min(0.95, botStart + 0.008), 0.992);
  }

  return results;
}

/**
 * Generates an expanded canvas dataURL with extra margin space on Left/Right/Top/Bottom
 * filled with the original image's edge colors (or custom color), remaps sample pins so they
 * stay locked to the exact model positions, and arranges swatch cards into the margin zones.
 */
export async function buildExtendedMarginCanvasAndColors<
  T extends {
    id: string;
    sampleX?: number;
    sampleY?: number;
    labelNx?: number;
    labelNy?: number;
    assignedPaint?: CatalogPaint;
  }
>(
  currentImageSrc: string,
  colors: T[],
  mode: MarginExtendMode,
  ratio = 0.3,
  customColor: string | null = null,
  cardScale = 1.0,
  cardBaseWidth = BASE_CARD_W
): Promise<{
  imageSrc: string;
  colors: T[];
  record: CanvasMarginRecord;
}> {
  const prevRecord = (await inspectOrSampleImageMargins(currentImageSrc))!;
  const origImg = await loadHtmlImage(prevRecord.originalImageSrc);
  const origW = origImg.naturalWidth || origImg.width || prevRecord.origWidth || 800;
  const origH = origImg.naturalHeight || origImg.height || prevRecord.origHeight || 600;
  const sampledEdgeColors = prevRecord.sampledEdgeColors;

  // Recover each color's unpadded normalized pin coordinate (origX, origY) on the original image
  const unpaddedColors = colors.map((c) => {
    if (!Number.isFinite(c.sampleX) || !Number.isFinite(c.sampleY)) return c;
    const origX = Math.max(
      0,
      Math.min(1, (c.sampleX! - prevRecord.innerLeftNx) / Math.max(0.0001, prevRecord.innerWidthNw))
    );
    const origY = Math.max(
      0,
      Math.min(1, (c.sampleY! - prevRecord.innerTopNy) / Math.max(0.0001, prevRecord.innerHeightNh))
    );
    return {
      ...c,
      sampleX: origX,
      sampleY: origY,
    };
  });

  if (mode === 'none') {
    const noneRecord: CanvasMarginRecord = {
      originalImageSrc: prevRecord.originalImageSrc,
      origWidth: origW,
      origHeight: origH,
      innerLeftNx: 0,
      innerTopNy: 0,
      innerWidthNw: 1,
      innerHeightNh: 1,
      mode: 'none',
      ratio,
      customColor,
      sampledEdgeColors,
    };
    canvasMarginRegistry.set(prevRecord.originalImageSrc, noneRecord);
    const arranged = arrangeCardsIntoMarginZone(
      unpaddedColors,
      noneRecord,
      origW,
      origH,
      cardScale,
      cardBaseWidth
    );
    const nextColors = unpaddedColors.map((c) =>
      arranged[c.id] ? { ...c, labelNx: arranged[c.id].nx, labelNy: arranged[c.id].ny } : c
    );
    return {
      imageSrc: prevRecord.originalImageSrc,
      colors: nextColors,
      record: noneRecord,
    };
  }

  // Compute pixel padding on each side
  const safeRatio = Math.max(0.15, Math.min(0.55, ratio));
  const singleSideRatio = Math.min(0.55, safeRatio * 1.15);
  const padLeft =
    mode === 'leftRight'
      ? Math.round(origW * safeRatio)
      : mode === 'left'
      ? Math.round(origW * singleSideRatio)
      : 0;
  const padRight =
    mode === 'leftRight'
      ? Math.round(origW * safeRatio)
      : mode === 'right'
      ? Math.round(origW * singleSideRatio)
      : 0;
  const padTop =
    mode === 'topBottom'
      ? Math.round(origH * safeRatio)
      : mode === 'top'
      ? Math.round(origH * singleSideRatio)
      : 0;
  const padBottom =
    mode === 'topBottom'
      ? Math.round(origH * safeRatio)
      : mode === 'bottom'
      ? Math.round(origH * singleSideRatio)
      : 0;

  const newW = origW + padLeft + padRight;
  const newH = origH + padTop + padBottom;

  const canvas = document.createElement('canvas');
  canvas.width = newW;
  canvas.height = newH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to create margin extension canvas context');
  }

  // Fill base background with overall or custom color
  ctx.fillStyle = customColor || sampledEdgeColors.overall;
  ctx.fillRect(0, 0, newW, newH);

  // Fill directional margins with their respective sampled edge colors (when customColor is not set)
  if (!customColor) {
    if (padLeft > 0) {
      ctx.fillStyle = sampledEdgeColors.left;
      ctx.fillRect(0, 0, padLeft, newH);
    }
    if (padRight > 0) {
      ctx.fillStyle = sampledEdgeColors.right;
      ctx.fillRect(padLeft + origW, 0, padRight, newH);
    }
    if (padTop > 0) {
      ctx.fillStyle = sampledEdgeColors.top;
      ctx.fillRect(0, 0, newW, padTop);
    }
    if (padBottom > 0) {
      ctx.fillStyle = sampledEdgeColors.bottom;
      ctx.fillRect(0, padTop + origH, newW, padBottom);
    }
  }

  // Draw the original unpadded image at (padLeft, padTop)
  ctx.drawImage(origImg, padLeft, padTop, origW, origH);

  const innerLeftNx = padLeft / newW;
  const innerTopNy = padTop / newH;
  const innerWidthNw = origW / newW;
  const innerHeightNh = origH / newH;

  // Remap sample pins into the new canvas coordinate space
  const remappedColors = unpaddedColors.map((c) => {
    if (!Number.isFinite(c.sampleX) || !Number.isFinite(c.sampleY)) return c;
    return {
      ...c,
      sampleX: innerLeftNx + c.sampleX! * innerWidthNw,
      sampleY: innerTopNy + c.sampleY! * innerHeightNh,
    };
  });

  const newRecord: CanvasMarginRecord = {
    originalImageSrc: prevRecord.originalImageSrc,
    origWidth: origW,
    origHeight: origH,
    innerLeftNx,
    innerTopNy,
    innerWidthNw,
    innerHeightNh,
    mode,
    ratio: safeRatio,
    customColor,
    sampledEdgeColors,
  };

  const arranged = arrangeCardsIntoMarginZone(
    remappedColors,
    newRecord,
    newW,
    newH,
    cardScale,
    cardBaseWidth
  );

  const finalColors = remappedColors.map((c) =>
    arranged[c.id] ? { ...c, labelNx: arranged[c.id].nx, labelNy: arranged[c.id].ny } : c
  );

  const expandedDataUrl = canvas.toDataURL('image/jpeg', 0.94);
  canvasMarginRegistry.set(expandedDataUrl, newRecord);

  return {
    imageSrc: expandedDataUrl,
    colors: finalColors,
    record: newRecord,
  };
}
