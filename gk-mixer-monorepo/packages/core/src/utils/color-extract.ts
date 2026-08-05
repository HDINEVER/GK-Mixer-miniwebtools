// ============================================================
// Prominent color extraction from raw pixel data
// Ported from GK-Mixer-miniwebtools-main/utils/colorUtils.ts
// (QUANT_TABLE + processPixelsSync + dominant color pipeline).
// The web app's canvas code (drawImage/getImageData) stays in the
// UI layer; BOTH web and React Native feed raw Uint8ClampedArray
// pixels into this pure function.
// ============================================================

import type { ColorData, ColorSpace } from '../types/color';
import { hexToRgb, rgbToCmyk, rgbToHex, rgbToHsb, rgbToLab } from './color-convert';
import { convertToWorkingSpace } from './color-space';
import { generateId } from './color-engine';

// Precomputed quantization table to avoid repeated Math.round calls during sampling
const COLOR_QUANT_STEP = 20;
const QUANT_TABLE: Uint8Array = (() => {
  const table = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    const quantized = Math.round(i / COLOR_QUANT_STEP) * COLOR_QUANT_STEP;
    table[i] = quantized > 255 ? 255 : quantized;
  }
  return table;
})();

const SAMPLE_STRIDE = 40; // Skip 9 pixels between samples to keep extraction fast

function processPixelsSync(
  data: Uint8ClampedArray,
  colorMap: Map<number, number>,
  stride: number,
): void {
  const totalLength = data.length;
  for (let index = 0; index < totalLength; index += stride) {
    const alpha = data[index + 3];
    if (alpha >= 128) {
      const qr = QUANT_TABLE[data[index]];
      const qg = QUANT_TABLE[data[index + 1]];
      const qb = QUANT_TABLE[data[index + 2]];
      const packed = (qr << 16) | (qg << 8) | qb;
      colorMap.set(packed, (colorMap.get(packed) || 0) + 1);
    }
  }
}

export interface ExtractProminentColorsOptions {
  /** Number of dominant colors to return (default 5) */
  count?: number;
  /** Sampling stride in bytes (default 40 = sample every 10th pixel) */
  sampleStride?: number;
  /** Working color space (default 'srgb') */
  colorSpace?: ColorSpace;
}

/**
 * Pure: raw RGBA pixel buffer -> dominant colors as ColorData.
 * The caller is responsible for decoding the image (web: canvas,
 * RN: image picker/vision-camera) and optionally downscaling.
 */
export function extractProminentColorsFromPixels(
  pixels: Uint8ClampedArray,
  options: ExtractProminentColorsOptions = {},
): ColorData[] {
  const { count = 5, sampleStride = SAMPLE_STRIDE, colorSpace = 'srgb' } = options;
  const colorMap = new Map<number, number>();

  processPixelsSync(pixels, colorMap, sampleStride);

  const sorted = Array.from(colorMap.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, count)
    .map(([packed]) => {
      const r = (packed >> 16) & 0xff;
      const g = (packed >> 8) & 0xff;
      const b = packed & 0xff;
      return rgbToHex(r, g, b);
    });

  return sorted.map(hex => {
    let rgb = hexToRgb(hex);

    if (colorSpace === 'adobe-rgb') {
      rgb = convertToWorkingSpace(rgb, 'adobe-rgb');
    }

    const hsb = rgbToHsb(rgb.r, rgb.g, rgb.b);
    const lab = rgbToLab(rgb.r, rgb.g, rgb.b);

    return {
      id: generateId(),
      hex: rgbToHex(rgb.r, rgb.g, rgb.b),
      rgb,
      cmyk: rgbToCmyk(rgb.r, rgb.g, rgb.b),
      hsb,
      lab,
      source: 'auto',
      colorSpace,
    } as ColorData;
  });
}
