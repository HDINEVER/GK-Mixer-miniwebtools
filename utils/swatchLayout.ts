import { CatalogPaint } from '../types';

export type ExtractLeaderLineStyle = 'stepped' | 'roundedStepped' | 'straight' | 'curved';

export interface SwatchSettings {
  lineStyle: ExtractLeaderLineStyle;
  lineWidth: number; // 1 to 6 px, default 2.5
  lineMatchPaintColor: boolean; // default false
  cardScale: number; // 0.6 to 1.6, default 1.0
  cardGlassEffect: boolean; // default false
}

export const DEFAULT_SWATCH_SETTINGS: SwatchSettings = {
  lineStyle: 'stepped',
  lineWidth: 2.5,
  lineMatchPaintColor: false,
  cardScale: 1.0,
  cardGlassEffect: false,
};

export const BASE_CARD_W = 160;
export const BASE_CARD_H = 72;
export const REFERENCE_CANVAS_DIM = 800;

/**
 * Computes proportional canvas scale factor for cards & lines given image dimensions.
 * Matches iOS ExtractLabelMetrics.canvasScale with narrow aspect-ratio adaptation.
 */
export function getCanvasScale(width: number, height: number): number {
  const maxSide = Math.max(width, height);
  if (maxSide <= 1) return 1.0;

  let scale = maxSide / REFERENCE_CANVAS_DIM;

  // Guard for ultra-tall portrait aspect ratios (e.g. 9:19.5 phone screenshots):
  // Cap the card width so it never takes up more than ~36% of the canvas width
  // at default 1.0x card scale, preserving clean two-column layout without overlap.
  const maxCardWidth = width * 0.36;
  if (BASE_CARD_W * scale > maxCardWidth && width > 40) {
    scale = maxCardWidth / BASE_CARD_W;
  }

  // Set a reasonable floor so interactive cards don't vanish on tiny thumbnails
  return Math.max(0.35, scale);
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
  edgePadding = 12
): { [id: string]: { nx: number; ny: number } } {
  const assigned = markers.filter((m) => !!m.paint);
  if (assigned.length === 0) return {};

  const width = Math.max(boxW, 100);
  const height = Math.max(boxH, 100);
  const canvasScale = getCanvasScale(width, height);
  const totalScale = canvasScale * cardScale;
  const cardW = BASE_CARD_W * totalScale;
  const cardH = BASE_CARD_H * totalScale;
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
  edgePadding = 12
): { [id: string]: { nx: number; ny: number } } {
  const assigned = markers.filter((m) => !!m.paint);
  if (assigned.length === 0) return {};

  const width = Math.max(boxW, 100);
  const height = Math.max(boxH, 100);
  const canvasScale = getCanvasScale(width, height);
  const totalScale = canvasScale * cardScale;
  const cardW = BASE_CARD_W * totalScale;
  const cardH = BASE_CARD_H * totalScale;
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
  edgePadding = 12
): { [id: string]: { nx: number; ny: number } } {
  const width = Math.max(boxW, 100);
  const height = Math.max(boxH, 100);
  const canvasScale = getCanvasScale(width, height);
  const totalScale = canvasScale * cardScale;
  const cardW = BASE_CARD_W * totalScale;
  const cardH = BASE_CARD_H * totalScale;
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
  targetId?: string
): { [id: string]: { nx: number; ny: number } } {
  const width = Math.max(boxW, 100);
  const height = Math.max(boxH, 100);
  const canvasScale = getCanvasScale(width, height);
  const totalScale = canvasScale * cardScale;
  const cardW = BASE_CARD_W * totalScale;
  const cardH = BASE_CARD_H * totalScale;
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
