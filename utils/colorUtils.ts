import { RGB, CMYK, ColorData, PaintBrand } from '../types';

// Helper to create unique IDs
export const generateId = (): string => Math.random().toString(36).substr(2, 9);

export const hexToRgb = (hex: string): RGB => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
};

export const rgbToHex = (r: number, g: number, b: number): string => {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
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
    k: Math.round(k * 100)
  };
};

export const getContrastColor = (hex: string): string => {
  const rgb = hexToRgb(hex);
  // YIQ equation
  const yiq = ((rgb.r * 299) + (rgb.g * 587) + (rgb.b * 114)) / 1000;
  return yiq >= 128 ? '#000000' : '#FFFFFF';
};

// Simple Euclidean distance for color matching (for speed)
export const getColorDistance = (c1: RGB, c2: RGB): number => {
  return Math.sqrt(
    Math.pow(c1.r - c2.r, 2) +
    Math.pow(c1.g - c2.g, 2) +
    Math.pow(c1.b - c2.b, 2)
  );
};

// Mock Database of common GK paints
export const COMMON_PAINTS: PaintBrand[] = [
  { id: '1', brand: 'Mr.Hobby', code: 'C1', name: 'White', hex: '#FFFFFF' },
  { id: '2', brand: 'Mr.Hobby', code: 'C2', name: 'Black', hex: '#000000' },
  { id: '3', brand: 'Mr.Hobby', code: 'C3', name: 'Red', hex: '#E60012' },
  { id: '4', brand: 'Mr.Hobby', code: 'C4', name: 'Yellow', hex: '#FFF100' },
  { id: '5', brand: 'Mr.Hobby', code: 'C5', name: 'Blue', hex: '#00479D' },
  { id: '6', brand: 'Gaia', code: '003', name: 'Bright Red', hex: '#FF0000' },
  { id: '7', brand: 'Gaia', code: '004', name: 'Ultra Blue', hex: '#0000FF' },
  { id: '8', brand: 'Gaia', code: '048', name: 'Clear Green', hex: '#00FF00' },
  { id: '9', brand: 'Jumpwind', code: 'JW01', name: 'Cold White', hex: '#F0F8FF' },
  { id: '10', brand: 'Jumpwind', code: 'JW02', name: 'Mechanic Grey', hex: '#708090' },
  // Add more conceptually...
];

export const findNearestPaints = (targetHex: string, count: number = 3): PaintBrand[] => {
  const targetRgb = hexToRgb(targetHex);
  const sorted = [...COMMON_PAINTS].sort((a, b) => {
    const distA = getColorDistance(targetRgb, hexToRgb(a.hex));
    const distB = getColorDistance(targetRgb, hexToRgb(b.hex));
    return distA - distB;
  });
  return sorted.slice(0, count);
};

export const extractProminentColors = (imgElement: HTMLImageElement, count: number = 5): Promise<ColorData[]> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return resolve([]);

    // Scale down for performance
    const scale = Math.min(1, 300 / Math.max(imgElement.naturalWidth, imgElement.naturalHeight));
    canvas.width = imgElement.naturalWidth * scale;
    canvas.height = imgElement.naturalHeight * scale;

    ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    const colorMap: Record<string, number> = {};

    // Sample every 10th pixel for speed
    for (let i = 0; i < data.length; i += 40) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a < 128) continue; // Skip transparent

      // Quantize colors to reduce noise (round to nearest 10)
      const qr = Math.round(r / 20) * 20;
      const qg = Math.round(g / 20) * 20;
      const qb = Math.round(b / 20) * 20;

      const hex = rgbToHex(qr, qg, qb);
      colorMap[hex] = (colorMap[hex] || 0) + 1;
    }

    const sortedHex = Object.entries(colorMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, count)
      .map(([hex]) => hex);

    const colors: ColorData[] = sortedHex.map(hex => {
      const rgb = hexToRgb(hex);
      return {
        id: generateId(),
        hex,
        rgb,
        cmyk: rgbToCmyk(rgb.r, rgb.g, rgb.b),
        source: 'auto'
      };
    });

    resolve(colors);
  });
};
