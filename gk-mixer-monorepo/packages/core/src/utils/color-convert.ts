// ============================================================
// Color conversion utilities
// Ported verbatim from GK-Mixer-miniwebtools-main/utils/colorUtils.ts
// (lines 44-270: hexToRgb, rgbToHex, rgbToCmyk, getContrastColor,
//  getColorDistance, rgbToHsb, hsbToRgb, rgbToLab, labToRgb)
// ============================================================

import type { CMYK, HSB, LAB, RGB } from '../types/color';

export const hexToRgb = (hex: string): RGB => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
};

export const rgbToHex = (r: number, g: number, b: number): string => {
  return (
    '#' +
    ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()
  );
};

export const rgbToCmyk = (r: number, g: number, b: number): CMYK => {
  let c = 0;
  let m = 0;
  let y = 0;
  let k = 0;

  r = r / 255;
  g = g / 255;
  b = b / 255;

  k = Math.min(1 - r, 1 - g, 1 - b);
  if (k === 1) {
    return { c: 0, m: 0, y: 0, k: 100 };
  }

  c = (1 - r - k) / (1 - k);
  m = (1 - g - k) / (1 - k);
  y = (1 - b - k) / (1 - k);

  return {
    c: Math.round(c * 100),
    m: Math.round(m * 100),
    y: Math.round(y * 100),
    k: Math.round(k * 100),
  };
};

export const getContrastColor = (hex: string): string => {
  const rgb = hexToRgb(hex);
  // YIQ equation
  const yiq = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return yiq >= 128 ? '#000000' : '#FFFFFF';
};

// Simple Euclidean distance for color matching (for speed)
export const getColorDistance = (c1: RGB, c2: RGB): number => {
  return Math.sqrt(
    Math.pow(c1.r - c2.r, 2) +
      Math.pow(c1.g - c2.g, 2) +
      Math.pow(c1.b - c2.b, 2),
  );
};

/**
 * Convert RGB to HSB (HSV) color space
 * Based on Photoshop color picker algorithm
 * H: 0-360° (full color wheel)
 * S: 0-100% (saturation)
 * B: 0-100% (brightness/value)
 */
export const rgbToHsb = (r: number, g: number, b: number): HSB => {
  // Normalize RGB values to 0-1
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;

  // Calculate brightness (value)
  const brightness = max * 100;

  // Calculate saturation
  const saturation = max === 0 ? 0 : (delta / max) * 100;

  // Calculate hue
  let hue = 0;
  if (delta !== 0) {
    if (max === rNorm) {
      hue = ((gNorm - bNorm) / delta + (gNorm < bNorm ? 6 : 0)) * 60;
    } else if (max === gNorm) {
      hue = ((bNorm - rNorm) / delta + 2) * 60;
    } else {
      hue = ((rNorm - gNorm) / delta + 4) * 60;
    }
  }

  return {
    h: Math.round(hue),
    s: Math.round(saturation),
    b: Math.round(brightness),
  };
};

/**
 * Convert HSB (HSV) to RGB color space
 * Based on Photoshop color picker algorithm
 * Inverse of rgbToHsb
 */
export const hsbToRgb = (h: number, s: number, b: number): RGB => {
  // Normalize inputs
  const hNorm = h / 360;
  const sNorm = s / 100;
  const bNorm = b / 100;

  const hIndex = Math.floor(hNorm * 6);
  const f = hNorm * 6 - hIndex;
  const p = bNorm * (1 - sNorm);
  const q = bNorm * (1 - f * sNorm);
  const t = bNorm * (1 - (1 - f) * sNorm);

  let rNorm = 0,
    gNorm = 0,
    bNormOut = 0;

  switch (hIndex % 6) {
    case 0:
      rNorm = bNorm;
      gNorm = t;
      bNormOut = p;
      break;
    case 1:
      rNorm = q;
      gNorm = bNorm;
      bNormOut = p;
      break;
    case 2:
      rNorm = p;
      gNorm = bNorm;
      bNormOut = t;
      break;
    case 3:
      rNorm = p;
      gNorm = q;
      bNormOut = bNorm;
      break;
    case 4:
      rNorm = t;
      gNorm = p;
      bNormOut = bNorm;
      break;
    case 5:
      rNorm = bNorm;
      gNorm = p;
      bNormOut = q;
      break;
  }

  return {
    r: Math.round(rNorm * 255),
    g: Math.round(gNorm * 255),
    b: Math.round(bNormOut * 255),
  };
};

/**
 * Convert RGB to LAB color space (via XYZ)
 * LAB provides perceptual uniformity for color mixing
 * L: 0-100 (lightness)
 * a: -128~127 (green to red)
 * b: -128~127 (blue to yellow)
 */
export const rgbToLab = (r: number, g: number, b: number): LAB => {
  // Step 1: RGB to XYZ (D65 illuminant, sRGB color space)
  let rNorm = r / 255;
  let gNorm = g / 255;
  let bNorm = b / 255;

  // Apply gamma correction (sRGB)
  rNorm = rNorm > 0.04045 ? Math.pow((rNorm + 0.055) / 1.055, 2.4) : rNorm / 12.92;
  gNorm = gNorm > 0.04045 ? Math.pow((gNorm + 0.055) / 1.055, 2.4) : gNorm / 12.92;
  bNorm = bNorm > 0.04045 ? Math.pow((bNorm + 0.055) / 1.055, 2.4) : bNorm / 12.92;

  // Convert to XYZ (D65 standard observer)
  const x = (rNorm * 0.4124564 + gNorm * 0.3575761 + bNorm * 0.1804375) * 100;
  const y = (rNorm * 0.2126729 + gNorm * 0.7151522 + bNorm * 0.0721750) * 100;
  const z = (rNorm * 0.0193339 + gNorm * 0.1191920 + bNorm * 0.9503041) * 100;

  // Step 2: XYZ to LAB
  // Reference white point D65
  const refX = 95.047;
  const refY = 100.0;
  const refZ = 108.883;

  let xNorm = x / refX;
  let yNorm = y / refY;
  let zNorm = z / refZ;

  // Apply LAB transformation function
  const labF = (t: number) =>
    t > 0.008856 ? Math.pow(t, 1 / 3) : 7.787 * t + 16 / 116;

  xNorm = labF(xNorm);
  yNorm = labF(yNorm);
  zNorm = labF(zNorm);

  const l = 116 * yNorm - 16;
  const a = 500 * (xNorm - yNorm);
  const bLab = 200 * (yNorm - zNorm);

  return {
    l: Math.round(l * 100) / 100,
    a: Math.round(a * 100) / 100,
    b: Math.round(bLab * 100) / 100,
  };
};

/**
 * Convert LAB to RGB color space (via XYZ)
 * Inverse of rgbToLab
 */
export const labToRgb = (l: number, a: number, b: number): RGB => {
  // Step 1: LAB to XYZ
  let y = (l + 16) / 116;
  let x = a / 500 + y;
  let z = y - b / 200;

  // Inverse LAB transformation
  const labInvF = (t: number) =>
    t > 0.206897 ? Math.pow(t, 3) : (t - 16 / 116) / 7.787;

  x = labInvF(x);
  y = labInvF(y);
  z = labInvF(z);

  // Reference white point D65
  const refX = 95.047;
  const refY = 100.0;
  const refZ = 108.883;

  x *= refX;
  y *= refY;
  z *= refZ;

  // Step 2: XYZ to RGB
  let rNorm = (x * 0.0032404542 + y * -0.0015371385 + z * -0.0004985314) / 100;
  let gNorm = (x * -0.000969266 + y * 0.0018760108 + z * 0.0004155506) / 100;
  let bNorm = (x * 0.0005563008 + y * -0.0002040259 + z * 0.0010572252) / 100;

  // Apply inverse gamma correction (sRGB)
  rNorm = rNorm > 0.0031308 ? 1.055 * Math.pow(rNorm, 1 / 2.4) - 0.055 : 12.92 * rNorm;
  gNorm = gNorm > 0.0031308 ? 1.055 * Math.pow(gNorm, 1 / 2.4) - 0.055 : 12.92 * gNorm;
  bNorm = bNorm > 0.0031308 ? 1.055 * Math.pow(bNorm, 1 / 2.4) - 0.055 : 12.92 * bNorm;

  // Clamp to valid RGB range
  const r = Math.max(0, Math.min(255, Math.round(rNorm * 255)));
  const g = Math.max(0, Math.min(255, Math.round(gNorm * 255)));
  const bOut = Math.max(0, Math.min(255, Math.round(bNorm * 255)));

  return { r, g, b: bOut };
};
