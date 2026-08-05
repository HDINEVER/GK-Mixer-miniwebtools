// ============================================================
// Composed pure functions - the public "demo" surface of core.
// convertHexToAllSpaces: single hex input -> full ColorData
// This is the canonical example of logic that will later be
// ported 1:1 to Swift (GK-Mixer native app).
// ============================================================

import type { ColorData } from '../types/color';
import { hexToRgb, rgbToCmyk, rgbToHex, rgbToHsb, rgbToLab } from './color-convert';
import { generateId } from './color-engine';

/**
 * Pure: '#RRGGBB' -> every color space representation the app needs.
 * No UI, no I/O - safe to run in web, React Native and (later) Swift.
 */
export function convertHexToAllSpaces(hex: string): ColorData {
  const rgb = hexToRgb(hex);
  return {
    id: generateId(),
    hex: rgbToHex(rgb.r, rgb.g, rgb.b),
    rgb,
    cmyk: rgbToCmyk(rgb.r, rgb.g, rgb.b),
    hsb: rgbToHsb(rgb.r, rgb.g, rgb.b),
    lab: rgbToLab(rgb.r, rgb.g, rgb.b),
    source: 'manual',
  };
}

/** Pure demo used by both apps to prove cross-package wiring. */
export function mixDemoColors(
  a: string,
  b: string,
  t: number = 0.5,
): ColorData {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  const rgb = {
    r: Math.round(ra.r + (rb.r - ra.r) * t),
    g: Math.round(ra.g + (rb.g - ra.g) * t),
    b: Math.round(ra.b + (rb.b - ra.b) * t),
  };
  return {
    id: generateId(),
    hex: rgbToHex(rgb.r, rgb.g, rgb.b),
    rgb,
    cmyk: rgbToCmyk(rgb.r, rgb.g, rgb.b),
    hsb: rgbToHsb(rgb.r, rgb.g, rgb.b),
    lab: rgbToLab(rgb.r, rgb.g, rgb.b),
    source: 'manual',
  };
}
