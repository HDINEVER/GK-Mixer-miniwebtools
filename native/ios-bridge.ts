import {
  EXTENDED_MIXING_COLORS,
  calculateMixboxRatios,
  getRALByNumber,
  hexToRAL,
} from '../utils/colorUtils';
import { latentToRgb, rgbToLatent } from '../utils/mixbox';

const BUNDLE_VERSION = 1;

const BASIC_COLORS = [
  { id: 'white', name: '白', hex: '#FFFFFF' },
  { id: 'black', name: '黑', hex: '#000000' },
  { id: 'red', name: '红', hex: '#E60012' },
  { id: 'blue', name: '蓝', hex: '#004098' },
  { id: 'yellow', name: '黄', hex: '#FFD900' },
  { id: 'sourceYellow', name: '色源黄', hex: '#FFEF00' },
  { id: 'sourceCyan', name: '色源青', hex: '#00B7EB' },
  { id: 'sourceMagenta', name: '色源品红', hex: '#FF0090' },
] as const;

type Request =
  | { method: 'bundleVersion'; payload?: undefined }
  | { method: 'decompose8'; payload: { hex: string; colorSpace?: 'srgb' | 'p3' | 'adobe-rgb' } }
  | { method: 'mixBasic'; payload: { weights: number[] } }
  | { method: 'mixMulti'; payload: { colors: { hex: string; weight: number }[] } }
  | { method: 'findNearestRAL'; payload: { hex: string } };

const assertHex = (hex: string) => {
  if (!/^#[0-9A-F]{6}$/i.test(hex)) {
    throw new Error('Expected a #RRGGBB color');
  }
};

const decompose8 = (hex: string, colorSpace: 'srgb' | 'p3' | 'adobe-rgb' = 'srgb') => {
  assertHex(hex);
  const raw = calculateMixboxRatios(hex, colorSpace, true);
  // The legacy web grayscale branch accidentally returned five values.
  // Native callers require a stable eight-component recipe.
  const weights = [...raw, ...new Array(Math.max(0, 8 - raw.length)).fill(0)].slice(0, 8);
  return EXTENDED_MIXING_COLORS.map((color, index) => ({
    id: `legacy-${color.code}`,
    name: color.name,
    hex: color.hex.toUpperCase(),
    weight: Math.max(0, Number(weights[index] ?? 0)) / 100,
  }));
};

const mixBasic = (weights: number[]) => {
  if (weights.length !== BASIC_COLORS.length) {
    throw new Error(`mixBasic expects ${BASIC_COLORS.length} weights`);
  }

  const sanitized = weights.map(value => Math.max(0, Number(value) || 0));
  const total = sanitized.reduce((sum, value) => sum + value, 0);
  if (total <= 0.001) {
    return null;
  }

  const latentMix = new Array(7).fill(0);
  BASIC_COLORS.forEach((color, index) => {
    if (sanitized[index] <= 0.001) return;
    const latent = rgbToLatent(color.hex);
    if (!latent) throw new Error(`Unable to convert ${color.hex} to Mixbox latent`);
    const normalizedWeight = sanitized[index] / total;
    latent.forEach((value, latentIndex) => {
      latentMix[latentIndex] += value * normalizedWeight;
    });
  });

  const rgb = latentToRgb(latentMix);
  if (!rgb) throw new Error('Unable to convert mixed latent value to RGB');
  const hex = `#${rgb.slice(0, 3).map(value =>
    Math.round(value).toString(16).padStart(2, '0')
  ).join('')}`.toUpperCase();

  return {
    hex,
    components: BASIC_COLORS.map((color, index) => ({
      ...color,
      weight: sanitized[index] / total,
    })),
  };
};

/** Arbitrary multi-color Mixbox blend — mirrors web `mixboxMultiBlend`. */
const mixMulti = (colors: { hex: string; weight: number }[]) => {
  const filtered = colors
    .map(entry => ({
      hex: String(entry.hex || '').toUpperCase(),
      weight: Math.max(0, Number(entry.weight) || 0),
    }))
    .filter(entry => {
      assertHex(entry.hex);
      return entry.weight > 0.0001;
    });

  if (filtered.length === 0) {
    return null;
  }
  if (filtered.length === 1) {
    return { hex: filtered[0].hex };
  }

  const totalWeight = filtered.reduce((sum, entry) => sum + entry.weight, 0);
  const latentMix = new Array(7).fill(0);
  for (const entry of filtered) {
    const latent = rgbToLatent(entry.hex);
    if (!latent) throw new Error(`Unable to convert ${entry.hex} to Mixbox latent`);
    const normalizedWeight = entry.weight / totalWeight;
    latent.forEach((value, latentIndex) => {
      latentMix[latentIndex] += value * normalizedWeight;
    });
  }

  const rgb = latentToRgb(latentMix);
  if (!rgb) throw new Error('Unable to convert mixed latent value to RGB');
  const hex = `#${rgb.slice(0, 3).map(value =>
    Math.round(value).toString(16).padStart(2, '0')
  ).join('')}`.toUpperCase();
  return { hex };
};

const findNearestRAL = (hex: string) => {
  assertHex(hex);
  const nearest = hexToRAL(hex);
  if (!nearest) return null;

  // findNearestRAL in the web app returns the input RGB as its display color.
  // Resolve the canonical RAL entry so native UI does not mislabel the target color.
  const canonical = getRALByNumber(nearest.ral) ?? nearest;
  return {
    number: canonical.ral,
    name: canonical.name,
    lrv: canonical.lrv,
    standardHex: canonical.hex.toUpperCase(),
  };
};

const invoke = (requestJSON: string): string => {
  try {
    const request = JSON.parse(requestJSON) as Request;
    let value: unknown;

    switch (request.method) {
      case 'bundleVersion':
        value = BUNDLE_VERSION;
        break;
      case 'decompose8':
        value = decompose8(request.payload.hex, request.payload.colorSpace);
        break;
      case 'mixBasic':
        value = mixBasic(request.payload.weights);
        break;
      case 'mixMulti':
        value = mixMulti(request.payload.colors);
        break;
      case 'findNearestRAL':
        value = findNearestRAL(request.payload.hex);
        break;
      default:
        throw new Error('Unsupported algorithm method');
    }

    return JSON.stringify({ ok: true, value });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return JSON.stringify({ ok: false, error: message });
  }
};

(globalThis as typeof globalThis & {
  GKColorAlgorithms?: { invoke: (requestJSON: string) => string };
}).GKColorAlgorithms = { invoke };
