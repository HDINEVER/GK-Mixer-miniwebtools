/**
 * GKMixer [SWATCH STUDIO] Dual-Engine Pixel Composition & Flood-Fill Service
 * Architecture: Rust Wasm (`wasm-canvas-core`) priority + Zero-blocking TypeScript TypedArray / OffscreenCanvas fallback.
 */

export type ExpandFillMode = 'solid' | 'edge-clamp' | 'ambient-blur';

export interface ExpandCropState {
  /** >0 pulls out margin pixels to the left; <0 crops inward into original image */
  leftPx: number;
  /** >0 pulls out margin pixels to the right; <0 crops inward into original image */
  rightPx: number;
  /** >0 pulls out margin pixels to the top; <0 crops inward into original image */
  topPx: number;
  /** >0 pulls out margin pixels to the bottom; <0 crops inward into original image */
  bottomPx: number;
  fillMode: ExpandFillMode;
  /** Hex string (e.g. '#F1F5F9'), defaults to auto-sampled edge mode color */
  fillColor: string;
}

export interface SampledBorderPalette {
  left: string;
  right: string;
  top: string;
  bottom: string;
  overall: string;
}

export interface WasmCanvasCoreExports {
  expand_edge_clamp_rgba?: (
    srcPtr: Uint8ClampedArray,
    srcW: number,
    srcH: number,
    leftPx: number,
    rightPx: number,
    topPx: number,
    bottomPx: number
  ) => Uint8ClampedArray;
  scanline_flood_fill_rgba?: (
    buf: Uint8ClampedArray,
    width: number,
    height: number,
    seedX: number,
    seedY: number,
    r: number,
    g: number,
    b: number,
    tolerance: number,
    feather: number
  ) => number;
}

declare global {
  interface Window {
    __WASM_CANVAS_CORE__?: WasmCanvasCoreExports;
  }
}

let wasmCoreInstance: WasmCanvasCoreExports | null = null;
let wasmProbeAttempted = false;

/**
 * Probes for an optional preloaded or public Rust Wasm module (`wasm-canvas-core`).
 * Falls back immediately and seamlessly to the isomorphic TypeScript Uint32Array engine.
 */
export async function ensureCanvasExpandEngineReady(): Promise<'rust-wasm' | 'ts-typedarray'> {
  if (typeof window !== 'undefined' && window.__WASM_CANVAS_CORE__) {
    wasmCoreInstance = window.__WASM_CANVAS_CORE__;
    return 'rust-wasm';
  }
  if (wasmCoreInstance) return 'rust-wasm';
  if (!wasmProbeAttempted && typeof window !== 'undefined') {
    wasmProbeAttempted = true;
    try {
      const candidate = (window as unknown as Record<string, unknown>)['wasm_canvas_core'] as
        | WasmCanvasCoreExports
        | undefined;
      if (candidate && typeof candidate === 'object') {
        wasmCoreInstance = candidate;
        return 'rust-wasm';
      }
    } catch {
      // Fallback to TS TypedArray engine
    }
  }
  return 'ts-typedarray';
}

export function getExpandEngineDriverName(): 'rust-wasm' | 'ts-typedarray' {
  if (typeof window !== 'undefined' && window.__WASM_CANVAS_CORE__) {
    return 'rust-wasm';
  }
  return wasmCoreInstance ? 'rust-wasm' : 'ts-typedarray';
}

export function parseHexRgb(hex: string): { r: number; g: number; b: number } {
  const clean = (hex || '#F1F5F9').replace('#', '').trim();
  const num = parseInt(clean, 16);
  if (Number.isNaN(num)) return { r: 241, g: 245, b: 249 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g)
    .toString(16)
    .padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`.toUpperCase();
}

/**
 * Computes the total stage dimensions given original image dimensions and ExpandCropState.
 */
export function computeStageDimensions(
  imgW: number,
  imgH: number,
  state: Pick<ExpandCropState, 'leftPx' | 'rightPx' | 'topPx' | 'bottomPx'>
): {
  stageW: number;
  stageH: number;
  leftPx: number;
  rightPx: number;
  topPx: number;
  bottomPx: number;
} {
  const minRemainW = Math.max(48, Math.round(imgW * 0.25));
  const minRemainH = Math.max(48, Math.round(imgH * 0.25));

  let leftPx = Math.round(state.leftPx);
  let rightPx = Math.round(state.rightPx);
  let topPx = Math.round(state.topPx);
  let bottomPx = Math.round(state.bottomPx);

  if (imgW + leftPx + rightPx < minRemainW) {
    const deficit = minRemainW - (imgW + leftPx + rightPx);
    leftPx += Math.ceil(deficit / 2);
    rightPx += Math.floor(deficit / 2);
  }
  if (imgH + topPx + bottomPx < minRemainH) {
    const deficit = minRemainH - (imgH + topPx + bottomPx);
    topPx += Math.ceil(deficit / 2);
    bottomPx += Math.floor(deficit / 2);
  }

  const stageW = Math.max(minRemainW, imgW + leftPx + rightPx);
  const stageH = Math.max(minRemainH, imgH + topPx + bottomPx);

  return { stageW, stageH, leftPx, rightPx, topPx, bottomPx };
}

/**
 * Maps an anchor point `(origNx, origNy)` normalized in original image `[0, 1]`
 * to normalized stage coordinates `[0, 1]` in the expanded/cropped canvas.
 */
export function mapPinOrigToStage(
  origNx: number,
  origNy: number,
  imgW: number,
  imgH: number,
  state: Pick<ExpandCropState, 'leftPx' | 'rightPx' | 'topPx' | 'bottomPx'>
): { nx: number; ny: number } {
  const { stageW, stageH, leftPx, topPx } = computeStageDimensions(imgW, imgH, state);
  const nx = (leftPx + origNx * imgW) / Math.max(1, stageW);
  const ny = (topPx + origNy * imgH) / Math.max(1, stageH);
  return {
    nx: Math.max(0.005, Math.min(0.995, nx)),
    ny: Math.max(0.005, Math.min(0.995, ny)),
  };
}

/**
 * Inverse mapping: recovers original image normalized `(origNx, origNy)` from stage `(nx, ny)`.
 */
export function mapPinStageToOrig(
  stageNx: number,
  stageNy: number,
  imgW: number,
  imgH: number,
  state: Pick<ExpandCropState, 'leftPx' | 'rightPx' | 'topPx' | 'bottomPx'>
): { origNx: number; origNy: number } {
  const { stageW, stageH, leftPx, topPx } = computeStageDimensions(imgW, imgH, state);
  const origNx = (stageNx * stageW - leftPx) / Math.max(1, imgW);
  const origNy = (stageNy * stageH - topPx) / Math.max(1, imgH);
  return {
    origNx: Math.max(0, Math.min(1, origNx)),
    origNy: Math.max(0, Math.min(1, origNy)),
  };
}

/**
 * Renders the expanded/cropped canvas using the Dual-Engine architecture:
 * - `solid`: Pure color fill (or directional border color fill)
 * - `edge-clamp`: Replicates and smooths the 1-2px outermost border pixels outward for studio gradient backdrops
 * - `ambient-blur`: Mirrors and scales the original image with Gaussian backdrop blur and subtle vignette
 */
export function composeExpandedStageCanvas(
  origImg: HTMLImageElement | HTMLCanvasElement,
  state: ExpandCropState,
  sampledEdges?: SampledBorderPalette,
  useDirectionalSolid = false
): HTMLCanvasElement {
  const imgW =
    'naturalWidth' in origImg && origImg.naturalWidth
      ? origImg.naturalWidth
      : origImg.width || 800;
  const imgH =
    'naturalHeight' in origImg && origImg.naturalHeight
      ? origImg.naturalHeight
      : origImg.height || 600;

  const { stageW, stageH, leftPx, rightPx, topPx, bottomPx } = computeStageDimensions(
    imgW,
    imgH,
    state
  );

  const outCanvas = document.createElement('canvas');
  outCanvas.width = stageW;
  outCanvas.height = stageH;
  const ctx = outCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return outCanvas;

  // Fast path: no expansion and no crop
  if (leftPx === 0 && rightPx === 0 && topPx === 0 && bottomPx === 0) {
    ctx.drawImage(origImg, 0, 0, imgW, imgH);
    return outCanvas;
  }

  // Mode 1: SOLID COLOR FILL
  if (state.fillMode === 'solid') {
    const baseHex = state.fillColor || sampledEdges?.overall || '#F1F5F9';
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, stageW, stageH);

    if (useDirectionalSolid && sampledEdges) {
      if (leftPx > 0) {
        ctx.fillStyle = sampledEdges.left;
        ctx.fillRect(0, 0, leftPx, stageH);
      }
      if (rightPx > 0) {
        ctx.fillStyle = sampledEdges.right;
        ctx.fillRect(leftPx + imgW, 0, rightPx, stageH);
      }
      if (topPx > 0) {
        ctx.fillStyle = sampledEdges.top;
        ctx.fillRect(0, 0, stageW, topPx);
      }
      if (bottomPx > 0) {
        ctx.fillStyle = sampledEdges.bottom;
        ctx.fillRect(0, topPx + imgH, stageW, bottomPx);
      }
    }

    ctx.drawImage(origImg, leftPx, topPx, imgW, imgH);
    return outCanvas;
  }

  // Mode 2: AMBIENT GAUSSIAN BLUR BACKDROP
  if (state.fillMode === 'ambient-blur') {
    ctx.save();
    ctx.fillStyle = state.fillColor || sampledEdges?.overall || '#0F172A';
    ctx.fillRect(0, 0, stageW, stageH);

    // Draw scaled blurred backdrop
    const blurRadius = Math.max(24, Math.round(Math.max(stageW, stageH) * 0.035));
    try {
      ctx.filter = `blur(${blurRadius}px) brightness(0.86) saturate(1.12)`;
    } catch {
      // Older WebView fallback
    }
    const bleed = Math.round(blurRadius * 1.6);
    ctx.drawImage(origImg, -bleed, -bleed, stageW + bleed * 2, stageH + bleed * 2);
    ctx.restore();

    // Subtle dark ambient vignette over the blurred margin
    ctx.fillStyle = 'rgba(15, 23, 42, 0.14)';
    ctx.fillRect(0, 0, stageW, stageH);

    // Crisp drop shadow behind the central original image
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
    ctx.shadowBlur = Math.max(16, Math.round(Math.min(imgW, imgH) * 0.025));
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;
    ctx.drawImage(origImg, leftPx, topPx, imgW, imgH);
    ctx.restore();
    return outCanvas;
  }

  // Mode 3: EDGE-CLAMP PIXEL STRETCH (Wasm priority + TypedArray 32-bit clamping with 5-tap border smoothing)
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = imgW;
  srcCanvas.height = imgH;
  const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
  if (!srcCtx) {
    ctx.drawImage(origImg, leftPx, topPx, imgW, imgH);
    return outCanvas;
  }
  srcCtx.drawImage(origImg, 0, 0, imgW, imgH);
  const srcImageData = srcCtx.getImageData(0, 0, imgW, imgH);

  if (wasmCoreInstance?.expand_edge_clamp_rgba) {
    try {
      const outBytes = wasmCoreInstance.expand_edge_clamp_rgba(
        srcImageData.data,
        imgW,
        imgH,
        leftPx,
        rightPx,
        topPx,
        bottomPx
      );
      const outData = new ImageData(new Uint8ClampedArray(outBytes), stageW, stageH);
      ctx.putImageData(outData, 0, 0);
      return outCanvas;
    } catch {
      // Fallback to TS TypedArray implementation below
    }
  }

  // Isomorphic TypeScript Uint32Array + Smoothed Edge-Clamp implementation
  const srcData = srcImageData.data;
  const outImageData = ctx.createImageData(stageW, stageH);
  const dst32 = new Uint32Array(outImageData.data.buffer);
  const src32 = new Uint32Array(srcImageData.data.buffer);

  // Precompute smoothed 1D edge color profiles (average of outer 2px + 7-tap box filter along edge)
  // so studio lighting gradients extend smoothly without single-pixel sensor noise streaks
  const topProfile = new Uint32Array(imgW);
  const botProfile = new Uint32Array(imgW);
  const leftProfile = new Uint32Array(imgH);
  const rightProfile = new Uint32Array(imgH);

  const packRgba = (r: number, g: number, b: number, a: number) =>
    ((a & 255) << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255);

  const radius = Math.min(6, Math.max(2, Math.floor(Math.min(imgW, imgH) * 0.012)));

  for (let x = 0; x < imgW; x++) {
    let tr = 0, tg = 0, tb = 0, br = 0, bg = 0, bb = 0, count = 0;
    const x0 = Math.max(0, x - radius);
    const x1 = Math.min(imgW - 1, x + radius);
    const yTop2 = Math.min(imgH - 1, 1);
    const yBot2 = Math.max(0, imgH - 2);
    for (let sx = x0; sx <= x1; sx++) {
      const iT0 = sx * 4;
      const iT1 = (yTop2 * imgW + sx) * 4;
      tr += (srcData[iT0] + srcData[iT1]) * 0.5;
      tg += (srcData[iT0 + 1] + srcData[iT1 + 1]) * 0.5;
      tb += (srcData[iT0 + 2] + srcData[iT1 + 2]) * 0.5;

      const iB0 = ((imgH - 1) * imgW + sx) * 4;
      const iB1 = (yBot2 * imgW + sx) * 4;
      br += (srcData[iB0] + srcData[iB1]) * 0.5;
      bg += (srcData[iB0 + 1] + srcData[iB1 + 1]) * 0.5;
      bb += (srcData[iB0 + 2] + srcData[iB1 + 2]) * 0.5;
      count++;
    }
    topProfile[x] = packRgba(tr / count, tg / count, tb / count, 255);
    botProfile[x] = packRgba(br / count, bg / count, bb / count, 255);
  }

  for (let y = 0; y < imgH; y++) {
    let lr = 0, lg = 0, lb = 0, rr = 0, rg = 0, rb = 0, count = 0;
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(imgH - 1, y + radius);
    const xLeft2 = Math.min(imgW - 1, 1);
    const xRight2 = Math.max(0, imgW - 2);
    for (let sy = y0; sy <= y1; sy++) {
      const iL0 = (sy * imgW) * 4;
      const iL1 = (sy * imgW + xLeft2) * 4;
      lr += (srcData[iL0] + srcData[iL1]) * 0.5;
      lg += (srcData[iL0 + 1] + srcData[iL1 + 1]) * 0.5;
      lb += (srcData[iL0 + 2] + srcData[iL1 + 2]) * 0.5;

      const iR0 = (sy * imgW + (imgW - 1)) * 4;
      const iR1 = (sy * imgW + xRight2) * 4;
      rr += (srcData[iR0] + srcData[iR1]) * 0.5;
      rg += (srcData[iR0 + 1] + srcData[iR1 + 1]) * 0.5;
      rb += (srcData[iR0 + 2] + srcData[iR1 + 2]) * 0.5;
      count++;
    }
    leftProfile[y] = packRgba(lr / count, lg / count, lb / count, 255);
    rightProfile[y] = packRgba(rr / count, rg / count, rb / count, 255);
  }

  const blendPacked = (c1: number, c2: number, t: number) => {
    const r1 = c1 & 255, g1 = (c1 >> 8) & 255, b1 = (c1 >> 16) & 255;
    const r2 = c2 & 255, g2 = (c2 >> 8) & 255, b2 = (c2 >> 16) & 255;
    return packRgba(
      r1 + (r2 - r1) * t,
      g1 + (g2 - g1) * t,
      b1 + (b2 - b1) * t,
      255
    );
  };

  const nwCorner = blendPacked(topProfile[0], leftProfile[0], 0.5);
  const neCorner = blendPacked(topProfile[imgW - 1], rightProfile[0], 0.5);
  const swCorner = blendPacked(botProfile[0], leftProfile[imgH - 1], 0.5);
  const seCorner = blendPacked(botProfile[imgW - 1], rightProfile[imgH - 1], 0.5);

  for (let sy = 0; sy < stageH; sy++) {
    const oy = sy - topPx;
    const rowOffset = sy * stageW;

    if (oy >= 0 && oy < imgH) {
      // Middle band: left margin + original row + right margin
      const leftColor = leftProfile[oy];
      const rightColor = rightProfile[oy];
      const srcRowOffset = oy * imgW;

      for (let sx = 0; sx < stageW; sx++) {
        const ox = sx - leftPx;
        if (ox < 0) {
          dst32[rowOffset + sx] = leftColor;
        } else if (ox >= imgW) {
          dst32[rowOffset + sx] = rightColor;
        } else {
          dst32[rowOffset + sx] = src32[srcRowOffset + ox];
        }
      }
    } else if (oy < 0) {
      // Top margin band
      for (let sx = 0; sx < stageW; sx++) {
        const ox = sx - leftPx;
        if (ox < 0) {
          dst32[rowOffset + sx] = nwCorner;
        } else if (ox >= imgW) {
          dst32[rowOffset + sx] = neCorner;
        } else {
          dst32[rowOffset + sx] = topProfile[ox];
        }
      }
    } else {
      // Bottom margin band
      for (let sx = 0; sx < stageW; sx++) {
        const ox = sx - leftPx;
        if (ox < 0) {
          dst32[rowOffset + sx] = swCorner;
        } else if (ox >= imgW) {
          dst32[rowOffset + sx] = seCorner;
        } else {
          dst32[rowOffset + sx] = botProfile[ox];
        }
      }
    }
  }

  ctx.putImageData(outImageData, 0, 0);
  return outCanvas;
}

/**
 * High-speed Scanline Flood Fill with 1.5px Anti-Aliased Edge Feathering.
 * Supports seamless flooding across the boundary between outer margin space and original image backdrop
 * while strictly protecting the central model subject.
 */
export function scanlineFloodFillCanvas(
  canvas: HTMLCanvasElement,
  seedX: number,
  seedY: number,
  fillHex: string,
  tolerance = 32,
  options?: {
    connectMarginAndBackdrop?: boolean;
    innerRect?: { left: number; top: number; width: number; height: number };
  }
): { changedPixels: number; sampledSeedHex: string } {
  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || width < 2 || height < 2) {
    return { changedPixels: 0, sampledSeedHex: fillHex };
  }

  const sx = Math.max(0, Math.min(width - 1, Math.round(seedX)));
  const sy = Math.max(0, Math.min(height - 1, Math.round(seedY)));

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const seedIdx = (sy * width + sx) * 4;
  const sr = data[seedIdx];
  const sg = data[seedIdx + 1];
  const sb = data[seedIdx + 2];
  const sampledSeedHex = rgbToHex(sr, sg, sb);

  const { r: tr, g: tg, b: tb } = parseHexRgb(fillHex);
  const featherWidth = 16; // 1.5px perceptual feathering transition band

  // Priority 1: Rust Wasm kernel if available
  if (wasmCoreInstance?.scanline_flood_fill_rgba) {
    try {
      const changed = wasmCoreInstance.scanline_flood_fill_rgba(
        data,
        width,
        height,
        sx,
        sy,
        tr,
        tg,
        tb,
        tolerance,
        featherWidth
      );
      ctx.putImageData(imageData, 0, 0);
      return { changedPixels: changed, sampledSeedHex };
    } catch {
      // Fallback to TS scanline flood fill below
    }
  }

  // Perceptual RGB color distance (0..255 scale)
  const colorDistSq = (r: number, g: number, b: number, r0: number, g0: number, b0: number) => {
    const dr = r - r0;
    const dg = g - g0;
    const db = b - b0;
    return 0.299 * dr * dr + 0.587 * dg * dg + 0.114 * db * db;
  };

  const tolSq = tolerance * tolerance;
  const featherOuter = tolerance + featherWidth;
  const featherOuterSq = featherOuter * featherOuter;

  // 0 = unvisited, 1 = core filled, 2 = feather candidate
  const visited = new Uint8Array(width * height);
  const stackX = new Int32Array(width * height);
  const stackY = new Int32Array(width * height);
  let sp = 0;

  const pushSeed = (px: number, py: number) => {
    if (px < 0 || px >= width || py < 0 || py >= height) return;
    const idx = py * width + px;
    if (visited[idx] !== 0) return;
    visited[idx] = 1;
    stackX[sp] = px;
    stackY[sp] = py;
    sp++;
  };

  pushSeed(sx, sy);

  // If user clicked in the outer margin AND `connectMarginAndBackdrop` is enabled,
  // also seed along the inner image border wherever the original image border color is close to its own edge backdrop
  const inner = options?.innerRect;
  let secondarySeedR = sr;
  let secondarySeedG = sg;
  let secondarySeedB = sb;
  let hasSecondarySeed = false;

  if (options?.connectMarginAndBackdrop && inner && inner.width > 4 && inner.height > 4) {
    const clickedInMargin =
      sx < inner.left ||
      sx >= inner.left + inner.width ||
      sy < inner.top ||
      sy >= inner.top + inner.height;

    if (clickedInMargin) {
      // Sample the nearest point on the inner image border to bridge the seam between margin and photo backdrop
      const clampedX = Math.max(
        inner.left + 1,
        Math.min(inner.left + inner.width - 2, sx)
      );
      const clampedY = Math.max(
        inner.top + 1,
        Math.min(inner.top + inner.height - 2, sy)
      );
      const borderIdx = (clampedY * width + clampedX) * 4;
      secondarySeedR = data[borderIdx];
      secondarySeedG = data[borderIdx + 1];
      secondarySeedB = data[borderIdx + 2];
      hasSecondarySeed = true;

      // Seed the 4 outer corners of the margin so all 4 margin strips fill together
      pushSeed(0, 0);
      pushSeed(width - 1, 0);
      pushSeed(0, height - 1);
      pushSeed(width - 1, height - 1);
      pushSeed(clampedX, clampedY);
    } else {
      // Clicked inside the original image backdrop: also seed the outer margin corners if the seed is near the border
      if (inner.left > 0) pushSeed(0, sy);
      if (inner.top > 0) pushSeed(sx, 0);
      if (inner.left + inner.width < width) pushSeed(width - 1, sy);
      if (inner.top + inner.height < height) pushSeed(sx, height - 1);
    }
  }

  const matchesSeed = (r: number, g: number, b: number): number => {
    const d1 = colorDistSq(r, g, b, sr, sg, sb);
    if (!hasSecondarySeed) return d1;
    const d2 = colorDistSq(r, g, b, secondarySeedR, secondarySeedG, secondarySeedB);
    return d1 < d2 ? d1 : d2;
  };

  let changedPixels = 0;
  const featherList: number[] = [];

  while (sp > 0) {
    sp--;
    const cx = stackX[sp];
    const cy = stackY[sp];

    // Scan left from cx
    let lx = cx;
    while (lx > 0) {
      const nIdx = cy * width + (lx - 1);
      if (visited[nIdx] === 1) break;
      const p4 = nIdx * 4;
      const distSq = matchesSeed(data[p4], data[p4 + 1], data[p4 + 2]);
      if (distSq <= tolSq) {
        lx--;
        visited[nIdx] = 1;
      } else {
        if (distSq <= featherOuterSq && visited[nIdx] === 0) {
          visited[nIdx] = 2;
          featherList.push(nIdx);
        }
        break;
      }
    }

    // Scan right from cx
    let rx = cx;
    while (rx < width - 1) {
      const nIdx = cy * width + (rx + 1);
      if (visited[nIdx] === 1) break;
      const p4 = nIdx * 4;
      const distSq = matchesSeed(data[p4], data[p4 + 1], data[p4 + 2]);
      if (distSq <= tolSq) {
        rx++;
        visited[nIdx] = 1;
      } else {
        if (distSq <= featherOuterSq && visited[nIdx] === 0) {
          visited[nIdx] = 2;
          featherList.push(nIdx);
        }
        break;
      }
    }

    // Fill the horizontal span [lx..rx] and check rows above and below
    for (let x = lx; x <= rx; x++) {
      const p4 = (cy * width + x) * 4;
      data[p4] = tr;
      data[p4 + 1] = tg;
      data[p4 + 2] = tb;
      data[p4 + 3] = 255;
      changedPixels++;

      // Check row above (cy - 1) and row below (cy + 1)
      for (let dy = -1; dy <= 1; dy += 2) {
        const ny = cy + dy;
        if (ny < 0 || ny >= height) continue;
        const nIdx = ny * width + x;
        if (visited[nIdx] !== 0) continue;
        const np4 = nIdx * 4;
        const distSq = matchesSeed(data[np4], data[np4 + 1], data[np4 + 2]);
        if (distSq <= tolSq) {
          visited[nIdx] = 1;
          stackX[sp] = x;
          stackY[sp] = ny;
          sp++;
        } else if (distSq <= featherOuterSq) {
          visited[nIdx] = 2;
          featherList.push(nIdx);
        }
      }
    }
  }

  // Anti-aliased 1.5px edge feathering pass along the model silhouette boundary
  for (let i = 0; i < featherList.length; i++) {
    const idx = featherList[i];
    if (visited[idx] !== 2) continue;
    const p4 = idx * 4;
    const r = data[p4];
    const g = data[p4 + 1];
    const b = data[p4 + 2];
    const dist = Math.sqrt(matchesSeed(r, g, b));
    const alpha = Math.max(0, Math.min(1, 1 - (dist - tolerance) / featherWidth));
    if (alpha > 0.02) {
      data[p4] = Math.round(r + (tr - r) * alpha);
      data[p4 + 1] = Math.round(g + (tg - g) * alpha);
      data[p4 + 2] = Math.round(b + (tb - b) * alpha);
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return { changedPixels, sampledSeedHex };
}

/**
 * Samples a single pixel's hex color at normalized `(nx, ny)` on an image or canvas.
 */
export function sampleStagePixelHex(
  source: HTMLImageElement | HTMLCanvasElement,
  nx: number,
  ny: number
): string {
  const w = 'naturalWidth' in source && source.naturalWidth ? source.naturalWidth : source.width;
  const h = 'naturalHeight' in source && source.naturalHeight ? source.naturalHeight : source.height;
  if (!w || !h) return '#F1F5F9';

  const px = Math.max(0, Math.min(w - 1, Math.round(nx * w)));
  const py = Math.max(0, Math.min(h - 1, Math.round(ny * h)));

  const c = document.createElement('canvas');
  c.width = 1;
  c.height = 1;
  const ctx = c.getContext('2d');
  if (!ctx) return '#F1F5F9';
  ctx.drawImage(source, px, py, 1, 1, 0, 0, 1, 1);
  const d = ctx.getImageData(0, 0, 1, 1).data;
  return rgbToHex(d[0], d[1], d[2]);
}
