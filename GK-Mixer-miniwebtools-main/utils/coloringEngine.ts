/**
 * GKMixer Coloring Sandbox Engine
 * ------------------------------------------------------------
 * Pure-frontend TypedArray image pipeline for the CHROMA × impCAT sandbox:
 *  - Pre-computed grayscale / red-stamp caches (computed ONCE per image)
 *  - Smoothstep soft-threshold anti-aliased line-art extraction (LUT based)
 *  - Canny edge detection with cached NMS (threshold changes only re-run hysteresis)
 *  - Morphological closing for gap welding (collision boundary mask)
 *  - Allocation-free Int32Array scanline flood fill + anti-halo bleed rings
 *  - impCAT Base / Shade / Highlight triad derivation
 */

// ============================================================================
// Color helpers
// ============================================================================
export function hexToRgbTuple(hex: string): [number, number, number] {
  const clean = (hex || "#808080").replace(/^#/, "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return [128, 128, 128];
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

export function rgbTupleToHex(r: number, g: number, b: number): string {
  const cr = Math.max(0, Math.min(255, Math.round(r)));
  const cg = Math.max(0, Math.min(255, Math.round(g)));
  const cb = Math.max(0, Math.min(255, Math.round(b)));
  return "#" + ((1 << 24) + (cr << 16) + (cg << 8) + cb).toString(16).slice(1).toUpperCase();
}

/** Pack RGBA into a little-endian Uint32 pixel (ImageData byte order R,G,B,A). */
export function packRGBA(r: number, g: number, b: number, a: number): number {
  return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

/** impCAT triad: Shade = −35% lightness (+12% sat), Highlight = +35% towards white. */
export function deriveImpcatTriad(baseHex: string): {
  baseHex: string;
  shadeHex: string;
  highlightHex: string;
} {
  const [r, g, b] = hexToRgbTuple(baseHex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const [sr, sg, sb] = hslToRgb(h, Math.min(1, s * 1.12), Math.max(0.04, l * 0.65));
  const [hr, hg, hb] = hslToRgb(h, Math.max(0, s * 0.92), Math.min(0.96, l + (1 - l) * 0.35));
  return {
    baseHex: rgbTupleToHex(r, g, b),
    shadeHex: rgbTupleToHex(sr, sg, sb),
    highlightHex: rgbTupleToHex(hr, hg, hb),
  };
}

// ============================================================================
// Pre-computed caches (run ONCE per loaded image)
// ============================================================================
export interface GrayCache {
  /** Raw luminance 0..255 */
  gray: Uint8Array;
  /** 1 where pixel is a red stamp / red ink ("Classified") */
  redMask: Uint8Array;
}

export function buildGrayCache(rgba: Uint8ClampedArray, n: number): GrayCache {
  const gray = new Uint8Array(n);
  const redMask = new Uint8Array(n);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const r = rgba[p];
    const g = rgba[p + 1];
    const b = rgba[p + 2];
    const a = rgba[p + 3];
    if (a < 32) {
      gray[i] = 255;
      continue;
    }
    gray[i] = (r * 77 + g * 150 + b * 29) >> 8;
    if (r > 90 && r - g > 40 && r - b > 30) redMask[i] = 1;
  }
  return { gray, redMask };
}

/** 2%–98% percentile normalized luminance map L ∈ [0,1] for impCAT shading. */
export function buildLuminanceMap(gray: Uint8Array): Float32Array {
  const n = gray.length;
  const hist = new Uint32Array(256);
  for (let i = 0; i < n; i++) hist[gray[i]]++;
  let lowCut = 0;
  let highCut = 255;
  let acc = 0;
  for (let i = 0; i < 256; i++) {
    acc += hist[i];
    if (acc >= n * 0.02) {
      lowCut = i;
      break;
    }
  }
  acc = 0;
  for (let i = 255; i >= 0; i--) {
    acc += hist[i];
    if (acc >= n * 0.02) {
      highCut = i;
      break;
    }
  }
  const span = Math.max(20, highCut - lowCut);
  const lut = new Float32Array(256);
  for (let v = 0; v < 256; v++) lut[v] = Math.max(0, Math.min(1, (v - lowCut) / span));
  const lum = new Float32Array(n);
  for (let i = 0; i < n; i++) lum[i] = lut[gray[i]];
  return lum;
}

// ============================================================================
// Mode A: Smoothstep soft-threshold anti-aliased line-art extraction (LUT)
// ============================================================================
export interface LineLayer {
  /** Visible anti-aliased line alpha 0..255 */
  alpha: Uint8Array;
  /** Hard collision mask (pixel counts as a wall) */
  binary: Uint8Array;
}

/**
 * α = smoothstep(clamp((threshold + softness − g) / (2·softness), 0, 1))
 * Wall (binary) = g < threshold  (i.e. α > 0.5)
 */
export function extractSoftLineArt(
  cache: GrayCache,
  threshold: number,
  softness: number,
  filterRedStamp: boolean
): LineLayer {
  const { gray, redMask } = cache;
  const n = gray.length;
  const s = Math.max(1, softness);
  const alphaLut = new Uint8Array(256);
  const wallLut = new Uint8Array(256);
  for (let g = 0; g < 256; g++) {
    let t = (threshold + s - g) / (2 * s);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const sm = t * t * (3 - 2 * t);
    alphaLut[g] = Math.round(sm * 255);
    wallLut[g] = g < threshold ? 1 : 0;
  }
  const alpha = new Uint8Array(n);
  const binary = new Uint8Array(n);
  if (filterRedStamp) {
    for (let i = 0; i < n; i++) {
      if (redMask[i]) continue;
      const g = gray[i];
      alpha[i] = alphaLut[g];
      binary[i] = wallLut[g];
    }
  } else {
    for (let i = 0; i < n; i++) {
      const g = gray[i];
      alpha[i] = alphaLut[g];
      binary[i] = wallLut[g];
    }
  }
  return { alpha, binary };
}

// ============================================================================
// Mode X: SD-ControlNet-style Lineart via XDoG (Extended Difference of Gaussians)
// ----------------------------------------------------------------------------
// Pipeline (all caches are reused across slider moves):
//   1. I(x,y) ∈ [0,1]      — paper-normalized luminance, red stamp → 1.0   (per image)
//   2. G1 = Gσ * I, G2 = Gkσ * I, Gw = wide context blur               (per σ)
//   3. D  = 1 + p · (G1 − G2) / (G2 + c)   brightness-normalized XDoG    (per p/ε/φ)
//      E  = 1                     if D ≥ ε
//      E  = 1 + tanh(φ·(D − ε))   otherwise          α = 1 − E
//   4. Adaptive dark-groove ink fill: pixels much darker than their wide
//      context (G1 / Gw small) are filled solid → no hollow "double lines"
//      on thick strokes / filled slots.
// The brightness normalization (÷ G2) is what flattens curved-surface shading:
// with the raw D = (1+p)G1 − pG2 a flat dark shadow has D = I and would turn
// black; normalized, any flat area (lit or shadowed) maps to D = 1 → white.
// ============================================================================

/** Paper-normalized luminance I ∈ [0,1]; optional red-stamp & cream-paper flattening. */
export function buildXdogIntensity(cache: GrayCache, filterBackground: boolean): Float32Array {
  const { gray, redMask } = cache;
  const n = gray.length;
  let paper = 255;
  if (filterBackground) {
    // 90th-percentile luminance ≈ paper white → stretch cream/parchment to 1.0
    const hist = new Uint32Array(256);
    for (let i = 0; i < n; i++) hist[gray[i]]++;
    let acc = 0;
    for (let v = 255; v >= 0; v--) {
      acc += hist[v];
      if (acc >= n * 0.1) {
        paper = Math.max(150, v);
        break;
      }
    }
  }
  const inv = 1 / paper;
  const I = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (filterBackground && redMask[i]) {
      I[i] = 1;
      continue;
    }
    const v = gray[i] * inv;
    I[i] = v > 1 ? 1 : v;
  }
  return I;
}

/** True separable 1D Gaussian (radius ⌈3σ⌉, clamp-to-edge). O(n·R). */
export function gaussianBlurSep(src: Float32Array, w: number, h: number, sigma: number): Float32Array {
  const n = w * h;
  if (sigma < 0.2) return src.slice();
  const rad = Math.max(1, Math.ceil(sigma * 3));
  const kernel = new Float32Array(rad * 2 + 1);
  let sum = 0;
  for (let i = -rad; i <= rad; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel[i + rad] = v;
    sum += v;
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] /= sum;

  const temp = new Float32Array(n);
  const out = new Float32Array(n);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let acc = 0;
      if (x >= rad && x < w - rad) {
        const base = row + x - rad;
        for (let k = 0; k < kernel.length; k++) acc += src[base + k] * kernel[k];
      } else {
        for (let k = -rad; k <= rad; k++) {
          let cx = x + k;
          cx = cx < 0 ? 0 : cx >= w ? w - 1 : cx;
          acc += src[row + cx] * kernel[k + rad];
        }
      }
      temp[row + x] = acc;
    }
  }
  for (let y = 0; y < h; y++) {
    const row = y * w;
    // Cache-friendly vertical pass: accumulate whole contiguous rows per tap
    for (let k = -rad; k <= rad; k++) {
      let cy = y + k;
      cy = cy < 0 ? 0 : cy >= h ? h - 1 : cy;
      const srcRow = cy * w;
      const kv = kernel[k + rad];
      for (let x = 0; x < w; x++) out[row + x] += temp[srcRow + x] * kv;
    }
  }
  return out;
}

/** O(n) Gaussian approximation via 3 successive running-sum box blurs (for wide σ). */
export function boxBlur3(src: Float32Array, w: number, h: number, sigma: number): Float32Array {
  const nBoxes = 3;
  const wIdeal = Math.sqrt((12 * sigma * sigma) / nBoxes + 1);
  let wl = Math.floor(wIdeal);
  if (wl % 2 === 0) wl--;
  const wu = wl + 2;
  const mIdeal = (12 * sigma * sigma - nBoxes * wl * wl - 4 * nBoxes * wl - 3 * nBoxes) / (-4 * wl - 4);
  const m = Math.round(mIdeal);
  let a = src.slice();
  let b = new Float32Array(src.length);
  for (let i = 0; i < nBoxes; i++) {
    const r = ((i < m ? wl : wu) - 1) / 2;
    boxBlurH(a, b, w, h, r);
    boxBlurV(b, a, w, h, r);
  }
  return a;
}

function boxBlurH(src: Float32Array, dst: Float32Array, w: number, h: number, r: number) {
  const inv = 1 / (r + r + 1);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    const first = src[row];
    const last = src[row + w - 1];
    let acc = (r + 1) * first;
    for (let k = 0; k < r; k++) acc += src[row + Math.min(k, w - 1)];
    for (let x = 0; x < w; x++) {
      const addX = x + r;
      const remX = x - r - 1;
      acc += addX < w ? src[row + addX] : last;
      acc -= remX >= 0 ? src[row + remX] : first;
      dst[row + x] = acc * inv;
    }
  }
}

function boxBlurV(src: Float32Array, dst: Float32Array, w: number, h: number, r: number) {
  // Row-wise running sum (contiguous memory access instead of column walks)
  const inv = 1 / (r + r + 1);
  const acc = new Float32Array(w);
  const lastRow = (h - 1) * w;
  for (let x = 0; x < w; x++) acc[x] = (r + 1) * src[x];
  for (let k = 0; k < r; k++) {
    const row = Math.min(k, h - 1) * w;
    for (let x = 0; x < w; x++) acc[x] += src[row + x];
  }
  for (let y = 0; y < h; y++) {
    const addY = y + r;
    const remY = y - r - 1;
    const addRow = addY < h ? addY * w : lastRow;
    const remRow = remY >= 0 ? remY * w : 0;
    const dstRow = y * w;
    for (let x = 0; x < w; x++) {
      const v = acc[x] + src[addRow + x] - src[remRow + x];
      acc[x] = v;
      dst[dstRow + x] = v * inv;
    }
  }
}

export interface XdogBlurCache {
  sigma: number;
  k: number;
  g1: Float32Array;
  g2: Float32Array;
  gw: Float32Array;
}

/** Blur pyramid for XDoG. G2 is cascaded from G1 (σ₂² = (kσ)² − σ²) to save taps. */
export function computeXdogBlurs(I: Float32Array, w: number, h: number, sigma: number, k: number): XdogBlurCache {
  const g1 = gaussianBlurSep(I, w, h, sigma);
  const g2 = gaussianBlurSep(g1, w, h, sigma * Math.sqrt(Math.max(0.05, k * k - 1)));
  const gw = boxBlur3(I, w, h, Math.max(16, sigma * 10));
  return { sigma, k, g1, g2, gw };
}

export interface XdogParams {
  /** Sensitivity / sharpening weight p (5..45) */
  p: number;
  /** Shading-suppression threshold ε (D ≥ ε → transparent) */
  epsilon: number;
  /** tanh steepness φ (higher = crisper edge, lower = softer AA) */
  phi: number;
  /** Adaptive dark-groove ink fill (prevents hollow thick strokes) */
  inkFill: boolean;
}

const TANH_LUT_SIZE = 4096;
const TANH_LUT_MIN = -6;
const TANH_LUT = (() => {
  const lut = new Float32Array(TANH_LUT_SIZE + 1);
  for (let i = 0; i <= TANH_LUT_SIZE; i++) lut[i] = Math.tanh(TANH_LUT_MIN * (1 - i / TANH_LUT_SIZE));
  return lut;
})();

/** Pointwise XDoG activation over cached blurs — O(n), no allocation besides output. */
export function xdogLineLayer(bl: XdogBlurCache, w: number, h: number, params: XdogParams): LineLayer {
  const { g1, g2, gw } = bl;
  const n = g1.length;
  const { p, epsilon, phi, inkFill } = params;
  const raw = new Uint8Array(n);
  const alpha = new Uint8Array(n);
  const binary = new Uint8Array(n);
  const C = 0.08; // stabilizer for very dark regions
  const INK_START = 0.6; // G1/Gw below this begins solid ink
  const INK_FULL = 0.4;
  const inkSpan = INK_START - INK_FULL;
  const lutScale = TANH_LUT_SIZE / -TANH_LUT_MIN;

  for (let i = 0; i < n; i++) {
    const a1 = g1[i];
    const a2 = g2[i];
    const D = 1 + (p * (a1 - a2)) / (a2 + C);
    let a = 0;
    if (D < epsilon) {
      const t = phi * (D - epsilon); // < 0
      const E = t <= TANH_LUT_MIN ? 0 : 1 + TANH_LUT[((t - TANH_LUT_MIN) * lutScale) | 0];
      a = 1 - E;
    }
    if (inkFill) {
      const q = a1 / (gw[i] + 0.02);
      if (q < INK_START) {
        let tt = (INK_START - q) / inkSpan;
        tt = tt > 1 ? 1 : tt;
        const ia = tt * tt * (3 - 2 * tt);
        if (ia > a) a = ia;
      }
    }
    const av = Math.round(a * 255);
    raw[i] = av;
    binary[i] = av >= 128 ? 1 : 0;
  }

  // 1px anti-alias ramp: XDoG flips sign within ~1px at stroke borders, so a
  // 3×3 Gaussian soften (core-preserving) gives hand-drawn-like smooth edges.
  for (let y = 0; y < h; y++) {
    const up = y > 0 ? -w : 0;
    const dn = y < h - 1 ? w : 0;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const l = x > 0 ? -1 : 0;
      const r = x < w - 1 ? 1 : 0;
      const s =
        raw[i + up + l] + 2 * raw[i + up] + raw[i + up + r] +
        2 * raw[i + l] + 4 * raw[i] + 2 * raw[i + r] +
        raw[i + dn + l] + 2 * raw[i + dn] + raw[i + dn + r];
      const blurred = s >> 4;
      const core = (raw[i] * 217) >> 8; // 0.85 × raw keeps 1px lines dark
      alpha[i] = blurred > core ? blurred : core;
    }
  }
  return { alpha, binary };
}

/**
 * Reserved hook for a neural lineart preprocessor (e.g. ControlNet
 * `lineart` / informative-drawings exported to ONNX, run via
 * onnxruntime-web / Transformers.js on WebGPU, or CoreML on iOS).
 * Implementations return an anti-aliased line alpha map (0..255, w×h);
 * the sandbox then builds the collision mask exactly like XDoG output.
 */
export interface NeuralLineartProvider {
  id: string;
  label: string;
  run(rgba: Uint8ClampedArray, w: number, h: number): Promise<Uint8Array>;
}

// ============================================================================
// Mode B: Canny (Gaussian → Sobel → NMS cached; hysteresis per threshold change)
// ============================================================================
export function computeCannyNms(gray: Uint8Array, w: number, h: number, blurRadius: number): Float32Array {
  const n = w * h;
  const rad = Math.max(1, Math.min(5, Math.round(blurRadius)));
  const sigma = rad * 0.8 + 0.4;
  const kSize = rad * 2 + 1;
  const kernel = new Float32Array(kSize);
  let kSum = 0;
  for (let i = -rad; i <= rad; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel[i + rad] = v;
    kSum += v;
  }
  for (let i = 0; i < kSize; i++) kernel[i] /= kSum;

  const temp = new Float32Array(n);
  const blurred = new Float32Array(n);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let k = -rad; k <= rad; k++) {
        let cx = x + k;
        cx = cx < 0 ? 0 : cx >= w ? w - 1 : cx;
        acc += gray[row + cx] * kernel[k + rad];
      }
      temp[row + x] = acc;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let k = -rad; k <= rad; k++) {
        let cy = y + k;
        cy = cy < 0 ? 0 : cy >= h ? h - 1 : cy;
        acc += temp[cy * w + x] * kernel[k + rad];
      }
      blurred[y * w + x] = acc;
    }
  }

  const mag = new Float32Array(n);
  const dir = new Uint8Array(n);
  const TAN22 = 0.41421356;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const tl = blurred[i - w - 1];
      const tc = blurred[i - w];
      const tr = blurred[i - w + 1];
      const ml = blurred[i - 1];
      const mr = blurred[i + 1];
      const bl = blurred[i + w - 1];
      const bc = blurred[i + w];
      const br = blurred[i + w + 1];
      const gx = -tl + tr - 2 * ml + 2 * mr - bl + br;
      const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;
      mag[i] = Math.sqrt(gx * gx + gy * gy);
      const ax = Math.abs(gx);
      const ay = Math.abs(gy);
      if (ay <= ax * TAN22) dir[i] = 0;
      else if (ax <= ay * TAN22) dir[i] = 2;
      else dir[i] = gx * gy > 0 ? 3 : 1;
    }
  }

  const nms = new Float32Array(n);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const m = mag[i];
      if (m === 0) continue;
      let n1: number;
      let n2: number;
      switch (dir[i]) {
        case 0:
          n1 = mag[i - 1];
          n2 = mag[i + 1];
          break;
        case 1:
          n1 = mag[i - w + 1];
          n2 = mag[i + w - 1];
          break;
        case 2:
          n1 = mag[i - w];
          n2 = mag[i + w];
          break;
        default:
          n1 = mag[i - w - 1];
          n2 = mag[i + w + 1];
      }
      if (m >= n1 && m >= n2) nms[i] = m;
    }
  }
  return nms;
}

export function cannyHysteresis(
  nms: Float32Array,
  w: number,
  h: number,
  low: number,
  high: number
): Uint8Array {
  const n = w * h;
  const state = new Uint8Array(n);
  const queue = new Int32Array(n);
  let qh = 0;
  let qt = 0;
  const hi = Math.max(low + 1, high);
  for (let i = 0; i < n; i++) {
    const v = nms[i];
    if (v >= hi) {
      state[i] = 2;
      queue[qt++] = i;
    } else if (v >= low) {
      state[i] = 1;
    }
  }
  while (qh < qt) {
    const c = queue[qh++];
    const cy = (c / w) | 0;
    const cx = c - cy * w;
    if (cx <= 0 || cx >= w - 1 || cy <= 0 || cy >= h - 1) continue;
    const nbs = [c - w - 1, c - w, c - w + 1, c - 1, c + 1, c + w - 1, c + w, c + w + 1];
    for (let k = 0; k < 8; k++) {
      const ni = nbs[k];
      if (state[ni] === 1) {
        state[ni] = 2;
        queue[qt++] = ni;
      }
    }
  }
  const edges = new Uint8Array(n);
  for (let i = 0; i < n; i++) edges[i] = state[i] === 2 ? 1 : 0;
  return edges;
}

/** 3×3 Gaussian anti-alias softening of a 1px binary edge map → alpha 0..255. */
export function softenEdgesToAlpha(edges: Uint8Array, w: number, h: number): Uint8Array {
  const n = w * h;
  const out = new Uint8Array(n);
  for (let y = 0; y < h; y++) {
    const y0 = y > 0 ? -w : 0;
    const y1 = y < h - 1 ? w : 0;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const x0 = x > 0 ? -1 : 0;
      const x1 = x < w - 1 ? 1 : 0;
      const sum =
        edges[i + y0 + x0] + 2 * edges[i + y0] + edges[i + y0 + x1] +
        2 * edges[i + x0] + 4 * edges[i] + 2 * edges[i + x1] +
        edges[i + y1 + x0] + 2 * edges[i + y1] + edges[i + y1 + x1];
      // sum/16 then ×2 gain so that a 1px line core reaches full opacity
      const v = Math.min(255, Math.round((sum / 16) * 2 * 255));
      out[i] = v;
    }
  }
  return out;
}

// ============================================================================
// Morphology (separable square structuring element)
// ============================================================================
export function dilateMask(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  if (r <= 0) return mask.slice();
  const temp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    // sliding window count along the row
    let count = 0;
    for (let k = 0; k <= Math.min(r, w - 1); k++) count += mask[row + k];
    for (let x = 0; x < w; x++) {
      temp[row + x] = count > 0 ? 1 : 0;
      const add = x + r + 1;
      const rem = x - r;
      if (add < w) count += mask[row + add];
      if (rem >= 0) count -= mask[row + rem];
    }
  }
  for (let x = 0; x < w; x++) {
    let count = 0;
    for (let k = 0; k <= Math.min(r, h - 1); k++) count += temp[k * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = count > 0 ? 1 : 0;
      const add = y + r + 1;
      const rem = y - r;
      if (add < h) count += temp[add * w + x];
      if (rem >= 0) count -= temp[rem * w + x];
    }
  }
  return out;
}

export function erodeMask(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  if (r <= 0) return mask.slice();
  const inv = new Uint8Array(w * h);
  for (let i = 0; i < inv.length; i++) inv[i] = mask[i] ? 0 : 1;
  const d = dilateMask(inv, w, h, r);
  for (let i = 0; i < d.length; i++) d[i] = d[i] ? 0 : 1;
  return d;
}

/** Morphological closing that welds gaps up to ~2r px while keeping walls slim. */
export function morphCloseMask(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  if (r <= 0) return mask.slice();
  const dilated = dilateMask(mask, w, h, r);
  return r <= 1 ? dilated : erodeMask(dilated, w, h, r - 1);
}

// ============================================================================
// Allocation-free scanline flood fill + Hybrid 3-Barrier Engine + anti-halo bleed
// ============================================================================
export interface FillBuffers {
  visited: Uint8Array;
  stack: Int32Array;
  stackPrev: Int32Array;
  out: Int32Array;
}

export function createFillBuffers(n: number): FillBuffers {
  const cap = Math.max(1024, n >> 2);
  return {
    visited: new Uint8Array(n),
    stack: new Int32Array(cap),
    stackPrev: new Int32Array(cap),
    out: new Int32Array(n),
  };
}

/**
 * Barrier A: Geometric Structure Closed Wall
 * Combines XDoG dark-groove binary lines + optional Canny gradient edges + user pen/eraser edits,
 * then runs morphological closing (radius = gapCloseRadius) to weld highlight micro-gaps.
 */
export function buildHybridBarrierMask(
  xdogBinary: Uint8Array,
  cannyEdges: Uint8Array | null,
  userEdits: Int8Array,
  w: number,
  h: number,
  gapCloseRadius: number
): Uint8Array {
  const n = w * h;
  const combined = new Uint8Array(n);
  if (cannyEdges && cannyEdges.length === n) {
    for (let i = 0; i < n; i++) {
      const e = userEdits[i];
      if (e < 0) {
        combined[i] = 0;
      } else if (e >= 64) {
        combined[i] = 1;
      } else {
        combined[i] = xdogBinary[i] | cannyEdges[i];
      }
    }
  } else {
    for (let i = 0; i < n; i++) {
      const e = userEdits[i];
      if (e < 0) {
        combined[i] = 0;
      } else if (e >= 64) {
        combined[i] = 1;
      } else {
        combined[i] = xdogBinary[i];
      }
    }
  }
  return morphCloseMask(combined, w, h, gapCloseRadius);
}

export interface HybridFillOptions {
  /** Source RGBA buffer (length = w * h * 4) for Barrier B (Chroma/Redmean) & Barrier C (Local Step) */
  rgba?: Uint8ClampedArray | null;
  /** Barrier B: source color + illumination-invariant chromaticity tolerance (0 = off, default ~26-28 for CG) */
  colorTolerance?: number;
  /** Barrier C: 1px neighbor local gradient step barrier (0 = off, default ~15) */
  localStepThreshold?: number;
  /** Number of 4-neighbour dilation rings pushed under anti-aliased line pixels (default 2 ≈ 1.5px) */
  bleedRings?: number;
  /** Extra color-guided rings that absorb fattened wall / fringe pixels up to the true part edge (0 = off) */
  edgeAbsorbRings?: number;
  /** Max Redmean step between an absorbed pixel and the filled pixel it grows from (default 22) */
  edgeAbsorbTolerance?: number;
}

/**
 * Hybrid 3-Barrier Scanline Flood Fill:
 *  - Barrier A: `boundary` (XDoG + Canny union + morphological closing)
 *  - Barrier B: Redmean color distance + illumination-invariant normalized chromaticity (stops at lineless color splits)
 *  - Barrier C: Local 1px/2px neighbor gradient step (passes smooth 3D shading <4/px, stops at part folds >15/px)
 */
export function floodFillRegion(
  seedX: number,
  seedY: number,
  w: number,
  h: number,
  boundary: Uint8Array,
  lineAlpha: Uint8Array,
  gray: Uint8Array,
  tolerance: number,
  buf: FillBuffers,
  bleedRingsOrOpts: number | HybridFillOptions = 2
): Uint32Array {
  const n = w * h;
  if (seedX < 0 || seedY < 0 || seedX >= w || seedY >= h) return new Uint32Array(0);

  const opts: HybridFillOptions =
    typeof bleedRingsOrOpts === "number"
      ? { colorTolerance: tolerance, localStepThreshold: 0, bleedRings: bleedRingsOrOpts }
      : bleedRingsOrOpts;

  const rgba = opts.rgba ?? null;
  const colorTol = opts.colorTolerance ?? tolerance;
  const localStep = opts.localStepThreshold ?? 0;
  const bleedRings = opts.bleedRings ?? 2;

  // Nudge seed off a wall (user tapped on or right next to a line)
  let seed = seedY * w + seedX;
  if (boundary[seed]) {
    let found = -1;
    for (let r = 1; r <= 4 && found < 0; r++) {
      for (let dy = -r; dy <= r && found < 0; dy++) {
        for (let dx = -r; dx <= r && found < 0; dx++) {
          const nx = seedX + dx;
          const ny = seedY + dy;
          if (nx >= 0 && ny >= 0 && nx < w && ny < h && !boundary[ny * w + nx]) {
            found = ny * w + nx;
          }
        }
      }
    }
    if (found < 0) return new Uint32Array(0);
    seed = found;
  }

  const visited = buf.visited;
  visited.fill(0);
  const out = buf.out;
  let stack = buf.stack;
  let stackPrev = buf.stackPrev;
  let sp = 0;
  let count = 0;

  const seedGray = gray[seed];
  const useColorTol = colorTol > 0;
  const colorTolSq = colorTol * colorTol;
  const useLocalStep = localStep > 0;
  const localStepSq = localStep * localStep;

  // Seed RGB + illumination-invariant regularized chromaticity (r, g, b) scaled to 0..255 reference
  let sr = seedGray;
  let sg = seedGray;
  let sb = seedGray;
  let seedCr = 140;
  let seedCg = 140;
  let seedCb = 140;
  if (rgba) {
    const sp4 = seed << 2;
    sr = rgba[sp4];
    sg = rgba[sp4 + 1];
    sb = rgba[sp4 + 2];
    const sSum = sr + sg + sb + 45;
    const sInv = 420 / sSum;
    seedCr = (sr + 15) * sInv;
    seedCg = (sg + 15) * sInv;
    seedCb = (sb + 15) * sInv;
  }

  const push = (v: number, prev: number) => {
    if (sp >= stack.length) {
      const grown = new Int32Array(stack.length * 2);
      grown.set(stack);
      stack = grown;
      buf.stack = grown;
      const grownPrev = new Int32Array(stackPrev.length * 2);
      grownPrev.set(stackPrev);
      stackPrev = grownPrev;
      buf.stackPrev = grownPrev;
    }
    stack[sp] = v;
    stackPrev[sp] = prev;
    sp++;
  };

  const canEnter = (i: number, prev: number): boolean => {
    // Barrier A: Visited or Geometric Closed Wall
    if (visited[i] !== 0 || boundary[i] !== 0) return false;

    if (rgba) {
      const p = i << 2;
      const r = rgba[p];
      const g = rgba[p + 1];
      const b = rgba[p + 2];

      // Barrier B: Source Chroma / Redmean Color Distance Barrier
      if (useColorTol) {
        const dr = r - sr;
        const dg = g - sg;
        const db = b - sb;
        // Redmean weighted distance: sqrt((2*dR^2 + 4*dG^2 + 3*dB^2) / 9)
        const rawDistSq = (2 * dr * dr + 4 * dg * dg + 3 * db * db) * 0.11111111;
        // Illumination-invariant normalized chromaticity distance
        const sum = r + g + b + 45;
        const inv = 420 / sum;
        const cdr = (r + 15) * inv - seedCr;
        const cdg = (g + 15) * inv - seedCg;
        const cdb = (b + 15) * inv - seedCb;
        const chromaDistSq = (2 * cdr * cdr + 4 * cdg * cdg + 3 * cdb * cdb) * 0.11111111;
        if (chromaDistSq > colorTolSq) return false;
        const chromaDist = Math.sqrt(chromaDistSq);
        const rawDist = Math.sqrt(rawDistSq);
        if (0.65 * chromaDist + 0.38 * rawDist > colorTol) return false;
      }

      // Barrier C: Local Edge Step Barrier (1px & 2px neighbor step)
      if (useLocalStep && prev >= 0 && prev !== i) {
        const pp = prev << 2;
        const ldr = r - rgba[pp];
        const ldg = g - rgba[pp + 1];
        const ldb = b - rgba[pp + 2];
        const stepSq = (2 * ldr * ldr + 4 * ldg * ldg + 3 * ldb * ldb) * 0.11111111;
        if (stepSq > localStepSq) return false;
        // 2px span check along step direction to catch 2px anti-aliased color/fold boundaries
        const prev2 = prev + (prev - i);
        if (prev2 >= 0 && prev2 < n && visited[prev2] !== 0) {
          const pp2 = prev2 << 2;
          const dr2 = r - rgba[pp2];
          const dg2 = g - rgba[pp2 + 1];
          const db2 = b - rgba[pp2 + 2];
          const step2Sq = (2 * dr2 * dr2 + 4 * dg2 * dg2 + 3 * db2 * db2) * 0.11111111;
          if (step2Sq * 0.36 > localStepSq) return false;
        }
      }
    } else {
      if (useColorTol) {
        const d = gray[i] - seedGray;
        if (d > colorTol || d < -colorTol) return false;
      }
      if (useLocalStep && prev >= 0 && prev !== i) {
        const ld = gray[i] - gray[prev];
        if (ld > localStep || ld < -localStep) return false;
      }
    }

    return true;
  };

  push(seed, seed);
  while (sp > 0) {
    sp--;
    const idx = stack[sp];
    const parentIdx = stackPrev[sp];
    if (!canEnter(idx, parentIdx)) continue;

    const y = (idx / w) | 0;
    const rowStart = y * w;
    const x0 = idx - rowStart;

    // Mark seed point on scanline
    visited[idx] = 1;
    out[count++] = idx;

    // Walk left from x0 - 1 (each pixel enters from its right neighbor i + 1)
    let xMin = x0;
    while (xMin > 0) {
      const nextI = rowStart + xMin - 1;
      if (!canEnter(nextI, nextI + 1)) break;
      visited[nextI] = 1;
      out[count++] = nextI;
      xMin--;
    }

    // Walk right from x0 + 1 (each pixel enters from its left neighbor i - 1)
    let xMax = x0;
    while (xMax < w - 1) {
      const nextI = rowStart + xMax + 1;
      if (!canEnter(nextI, nextI - 1)) break;
      visited[nextI] = 1;
      out[count++] = nextI;
      xMax++;
    }

    // Push vertical scanline seeds across [xMin .. xMax]
    let above = false;
    let below = false;
    for (let x = xMin; x <= xMax; x++) {
      const i = rowStart + x;
      if (y > 0) {
        const u = i - w;
        if (canEnter(u, i)) {
          if (!above) {
            push(u, i);
            above = true;
          }
        } else {
          above = false;
        }
      }
      if (y < h - 1) {
        const d = i + w;
        if (canEnter(d, i)) {
          if (!below) {
            push(d, i);
            below = true;
          }
        } else {
          below = false;
        }
      }
    }
  }

  // Anti-halo bleed: grow under walls / AA line pixels so semi-transparent lines have no white halo.
  // Rings 0..bleedRings-1: unconditional under wall / line pixels (classic 1.5px under-line bleed).
  // Extra "edge absorb" rings: keep eating wall-mask pixels (fattened by Canny + morphological
  // closing) or color-barrier fringe ONLY while the source color stays close to the filled
  // neighbour it grows from — fills thin parts (rods, antennae, piping) up to their real edges
  // without crossing into the neighbouring part.
  const absorbRings = Math.max(0, opts.edgeAbsorbRings ?? 0);
  const absorbTol = Math.max(10, opts.edgeAbsorbTolerance ?? 22);
  const absorbTolSq = absorbTol * absorbTol;
  let frontStart = 0;
  let frontEnd = count;
  const similarTo = (j: number, from: number): boolean => {
    if (rgba) {
      const a = j << 2;
      const b = from << 2;
      const dr = rgba[a] - rgba[b];
      const dg = rgba[a + 1] - rgba[b + 1];
      const db = rgba[a + 2] - rgba[b + 2];
      return (2 * dr * dr + 4 * dg * dg + 3 * db * db) * 0.11111111 <= absorbTolSq;
    }
    const d = gray[j] - gray[from];
    return d <= absorbTol && d >= -absorbTol;
  };
  const totalRings = bleedRings + absorbRings;
  for (let ring = 0; ring < totalRings; ring++) {
    const absorbing = ring >= bleedRings;
    const canBleed = (j: number, from: number): boolean => {
      if (visited[j] !== 0) return false;
      if (!absorbing) return boundary[j] !== 0 || lineAlpha[j] !== 0;
      // Never absorb strong dark ink lines; only fattened mask pixels / soft fringe
      if (lineAlpha[j] > 200) return false;
      return similarTo(j, from);
    };
    for (let k = frontStart; k < frontEnd; k++) {
      const i = out[k];
      const x = i % w;
      if (x > 0 && canBleed(i - 1, i)) {
        visited[i - 1] = 1;
        out[count++] = i - 1;
      }
      if (x < w - 1 && canBleed(i + 1, i)) {
        visited[i + 1] = 1;
        out[count++] = i + 1;
      }
      if (i >= w && canBleed(i - w, i)) {
        visited[i - w] = 1;
        out[count++] = i - w;
      }
      if (i < n - w && canBleed(i + w, i)) {
        visited[i + w] = 1;
        out[count++] = i + w;
      }
    }
    frontStart = frontEnd;
    frontEnd = count;
    if (frontStart === frontEnd) break;
  }

  return new Uint32Array(out.subarray(0, count));
}

// ============================================================================
// Intrinsic Luminance Recoloring (3D Relative Shading Transfer)
// ============================================================================

/**
 * Computes the median luminance L_base of a region's interior pixels using a
 * 64-bin histogram (immune to anti-halo dark line fringe and specular spikes).
 */
export function computeRegionBaseLuminance(
  pixels: Uint32Array,
  lum: Float32Array,
  lineAlpha?: Uint8Array | null
): number {
  const len = pixels.length;
  if (len === 0) return 0.55;
  const BINS = 64;
  const hist = new Uint32Array(BINS);
  let validCount = 0;
  for (let i = 0; i < len; i++) {
    const p = pixels[i];
    if (lineAlpha && lineAlpha[p] > 96) continue;
    const b = Math.min(BINS - 1, Math.max(0, (lum[p] * BINS) | 0));
    hist[b]++;
    validCount++;
  }
  if (validCount < 8) {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += lum[pixels[i]];
    return Math.min(0.92, Math.max(0.15, sum / len));
  }
  const half = validCount >> 1;
  let acc = 0;
  for (let b = 0; b < BINS; b++) {
    acc += hist[b];
    if (acc >= half) {
      const median = (b + 0.5) / BINS;
      return Math.min(0.92, Math.max(0.15, median));
    }
  }
  return 0.55;
}

/**
 * Relative Shading Transfer (3D Intrinsic Luminance Recoloring):
 *  - ratio = clamp(L_i / max(L_base, 0.15), 0.25, 1.45)
 *  - ratio <= 1.0: darken C_paint proportionally toward a chroma-enriched shadow (prevents muddy gray)
 *  - ratio >  1.0: lerp(C_paint, White, (ratio - 1.0) * 0.65)
 */
export function paintRegionIntrinsicShading(
  pixels: Uint32Array,
  baseHex: string,
  baseLum: number,
  lum: Float32Array,
  lineAlpha: Uint8Array | null,
  u32: Uint32Array
): void {
  const [br, bg, bb] = hexToRgbTuple(baseHex);
  const [h, s, l] = rgbToHsl(br, bg, bb);
  // Shadow endpoint at ratio = 0.25 with +18% saturation boost so dark recesses stay rich
  const [sr, sg, sb] = hslToRgb(h, Math.min(1, s * 1.18 + 0.04), Math.max(0.02, l * 0.25));
  const safeBase = Math.max(baseLum || 0.55, 0.15);
  const invBase = 1 / safeBase;
  const invShadowSpan = 1 / 0.75; // maps ratio [0.25 .. 1.0] -> [0 .. 1]

  for (let i = 0; i < pixels.length; i++) {
    const p = pixels[i];
    let L = lum[p];
    // Soften dark line-bleed fringe when top visual line layer is semi-transparent
    if (lineAlpha) {
      const la = lineAlpha[p];
      if (la > 48) {
        const wLine = (la / 255) * 0.72;
        L = L * (1 - wLine) + safeBase * wLine;
      }
    }
    let ratio = L * invBase;
    if (ratio < 0.25) ratio = 0.25;
    else if (ratio > 1.45) ratio = 1.45;

    let r: number;
    let g: number;
    let b: number;
    if (ratio <= 1.0) {
      const t = (ratio - 0.25) * invShadowSpan;
      r = sr + (br - sr) * t;
      g = sg + (bg - sg) * t;
      b = sb + (bb - sb) * t;
    } else {
      const k = (ratio - 1.0) * 0.65;
      r = br + (255 - br) * k;
      g = bg + (255 - bg) * k;
      b = bb + (255 - bb) * k;
    }
    u32[p] = packRGBA(r | 0, g | 0, b | 0, 255);
  }
}

