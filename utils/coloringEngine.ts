/**
 * ============================================================================
 * GK PAINT MIXER — ENCRYPTED CORE ALGORITHM MODULE (coloringEngine.ts)
 * ============================================================================
 * License: PolyForm Noncommercial License 1.0.0 (see /LICENSE)
 * Required Notice: Copyright (c) 2025-2026 HDINEVER / HDIN Studio
 *
 * NOTICE: This core algorithm module is protected via stream-cipher payload
 * encryption to prevent unauthorized commercial plagiarism while supporting
 * 100% offline client-side execution. Commercial use is strictly prohibited.
 * ============================================================================
 */

export interface GrayCache {
  /** Raw luminance 0..255 */
  gray: Uint8Array;
  /** 1 where pixel is a red stamp / red ink ("Classified") */
  redMask: Uint8Array;
}

export interface LineLayer {
  /** Visible anti-aliased line alpha 0..255 */
  alpha: Uint8Array;
  /** Hard collision mask (pixel counts as a wall) */
  binary: Uint8Array;
}

export interface XdogBlurCache {
  sigma: number;
  k: number;
  g1: Float32Array;
  g2: Float32Array;
  gw: Float32Array;
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

export interface NeuralLineartProvider {
  id: string;
  label: string;
  run(rgba: Uint8ClampedArray, w: number, h: number): Promise<Uint8Array>;
}

export interface FillBuffers {
  visited: Uint8Array;
  stack: Int32Array;
  stackPrev: Int32Array;
  out: Int32Array;
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

const __GK_CORE_CIPHER_PAYLOAD__ = [
  "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"
].join("");

const _gkDeps: Record<string, any> = {

};

function _decodeGkCorePayload(b64: string): Record<string, any> {
  const key = "GKMixer::PolyForm-Noncommercial-1.0.0::CoreCipherKey::2026#HDINEVER";
  const binStr = typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("binary");
  const len = binStr.length;
  const out = new Uint8Array(len);
  let state = 0x5a3c9e17;
  for (let i = 0; i < len; i++) {
    const k = key.charCodeAt(i % key.length);
    state = (Math.imul(state ^ k, 0x01000193) + (i & 0xff)) >>> 0;
    const mask = ((state >>> 16) ^ state ^ k ^ (i * 31)) & 0xff;
    out[i] = (binStr.charCodeAt(i) & 0xff) ^ mask;
  }
  const code = new TextDecoder("utf-8").decode(out);
  const mod = { exports: {} as Record<string, any> };
  const req = (id: string) => {
    if (id in _gkDeps) return _gkDeps[id];
    throw new Error("Unknown core dependency: " + id);
  };
  const fn = new Function("module", "exports", "require", code);
  fn(mod, mod.exports, req);
  return mod.exports;
}

const _gkCore = _decodeGkCorePayload(__GK_CORE_CIPHER_PAYLOAD__);

export const boxBlur3: any = _gkCore.boxBlur3;
export const buildGrayCache: any = _gkCore.buildGrayCache;
export const buildHybridBarrierMask: any = _gkCore.buildHybridBarrierMask;
export const buildLuminanceMap: any = _gkCore.buildLuminanceMap;
export const buildXdogIntensity: any = _gkCore.buildXdogIntensity;
export const cannyHysteresis: any = _gkCore.cannyHysteresis;
export const computeCannyNms: any = _gkCore.computeCannyNms;
export const computeRegionBaseLuminance: any = _gkCore.computeRegionBaseLuminance;
export const computeXdogBlurs: any = _gkCore.computeXdogBlurs;
export const createFillBuffers: any = _gkCore.createFillBuffers;
export const deriveImpcatTriad: any = _gkCore.deriveImpcatTriad;
export const dilateMask: any = _gkCore.dilateMask;
export const erodeMask: any = _gkCore.erodeMask;
export const extractSoftLineArt: any = _gkCore.extractSoftLineArt;
export const floodFillRegion: any = _gkCore.floodFillRegion;
export const gaussianBlurSep: any = _gkCore.gaussianBlurSep;
export const hexToRgbTuple: any = _gkCore.hexToRgbTuple;
export const morphCloseMask: any = _gkCore.morphCloseMask;
export const packRGBA: any = _gkCore.packRGBA;
export const paintRegionIntrinsicShading: any = _gkCore.paintRegionIntrinsicShading;
export const rgbTupleToHex: any = _gkCore.rgbTupleToHex;
export const softenEdgesToAlpha: any = _gkCore.softenEdgesToAlpha;
export const xdogLineLayer: any = _gkCore.xdogLineLayer;
