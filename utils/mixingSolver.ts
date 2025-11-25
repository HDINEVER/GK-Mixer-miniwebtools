import { RGB } from '../types';
import { hexToRgb, rgbToHex, getColorDistance } from './colorUtils';

// Declaration for the global mixbox library
declare var mixbox: any;

export interface Pigment {
  id: string;
  name: string;
  hex: string;
  isBase?: boolean;
}

export interface SolvedIngredient {
  pigment: Pigment;
  ratio: number; // 0 to 1
}

// Standard Pigments for Simulation
// Using specific hex codes that represent physical paint standards better than pure digital RGB
const CMYK_PALETTE: Pigment[] = [
  { id: 'w', name: 'White', hex: '#FFFFFF', isBase: true }, // Titanium White
  { id: 'k', name: 'Black', hex: '#2B2B2B' }, // Carbon Black (not absolute digital black)
  { id: 'c', name: 'Cyan', hex: '#0093D3' }, // Process Cyan
  { id: 'm', name: 'Magenta', hex: '#CC006B' }, // Process Magenta
  { id: 'y', name: 'Yellow', hex: '#FFF100' }, // Process Yellow
];

const PAINT_PALETTE: Pigment[] = [
  { id: 'w', name: 'White', hex: '#FFFFFF', isBase: true },
  { id: 'k', name: 'Black', hex: '#2B2B2B' },
  { id: 'r', name: 'Red', hex: '#E60012' },
  { id: 'b', name: 'Blue', hex: '#00479D' },
  { id: 'y', name: 'Yellow', hex: '#FFF100' },
  { id: 'g', name: 'Green', hex: '#00A651' },
];

/**
 * Solves the mixing ratio to match target color using Mixbox latent space.
 * Uses a Hill Climbing algorithm to minimize difference.
 */
export const solveMixingRecipe = (
  targetHex: string,
  basePaintHex: string | null,
  mode: 'CMYK' | 'PAINT'
): SolvedIngredient[] => {
  if (typeof mixbox === 'undefined') {
    console.warn("Mixbox library not loaded. Falling back to linear approximation.");
    return [];
  }

  const targetRgb = hexToRgb(targetHex);
  // Convert target RGB to mixbox latent? 
  // Note: We can't convert digital target -> latent directly for comparison easily 
  // because mixbox.latentOf is for pigments. 
  // Instead, we compare the mixbox.rgbOf(mixedLatent) with the targetRgb.

  const palette = mode === 'CMYK' ? [...CMYK_PALETTE] : [...PAINT_PALETTE];
  
  // If a base paint is selected, force it into the palette as the primary base
  if (basePaintHex) {
    // Remove default white if we have a custom base, or keep it?
    // Usually "Base Mode" means we start with the Base Paint and add tints.
    // We treat the Base Paint as a pigment with a high initial weight preference.
    const customBase: Pigment = { id: 'custom_base', name: 'Base', hex: basePaintHex, isBase: true };
    // Remove generic white from palette if we have a custom base to avoid confusion, 
    // unless we want to allow lightening the base.
    const paletteWithoutWhite = palette.filter(p => p.id !== 'w'); 
    palette.length = 0; // Clear
    palette.push(customBase);
    palette.push(...paletteWithoutWhite);
  }

  // Pre-calculate latents for palette
  const latents = palette.map(p => {
     const rgb = hexToRgb(p.hex);
     return {
       ...p,
       latent: mixbox.latentOf(`rgb(${rgb.r},${rgb.g},${rgb.b})`)
     };
  });

  // Optimization State
  // Weights corresponding to palette
  let weights = new Array(palette.length).fill(0);
  
  if (basePaintHex) {
      weights[0] = 0.8; // Start with 80% base paint
  } else {
      weights[0] = 0.5; // Start with 50% white
  }

  // Normalize helper
  const normalize = (w: number[]) => {
      const sum = w.reduce((a, b) => a + b, 0);
      return sum === 0 ? w : w.map(v => v / sum);
  };

  weights = normalize(weights);

  // Error function
  const calculateError = (currentWeights: number[]) => {
      const zMix = new Array(mixbox.LATENT_SIZE).fill(0);
      
      // Mix in latent space: sum(weight * latent)
      for (let i = 0; i < latents.length; i++) {
          if (currentWeights[i] <= 0) continue;
          for (let j = 0; j < mixbox.LATENT_SIZE; j++) {
              zMix[j] += currentWeights[i] * latents[i].latent[j];
          }
      }
      
      const rgbMixRaw = mixbox.rgbOf(zMix);
      const rgbMix: RGB = { r: rgbMixRaw[0], g: rgbMixRaw[1], b: rgbMixRaw[2] };
      
      return getColorDistance(rgbMix, targetRgb); // Simple Euclidean for speed, could use DeltaE
  };

  // Hill Climbing
  let currentError = calculateError(weights);
  const iterations = 500; // Enough for simple palette
  let stepSize = 0.1;

  for (let i = 0; i < iterations; i++) {
      // Pick random index to adjust
      const idx = Math.floor(Math.random() * weights.length);
      const change = (Math.random() - 0.5) * stepSize;
      
      const originalVal = weights[idx];
      let newWeights = [...weights];
      newWeights[idx] = Math.max(0, Math.min(1, newWeights[idx] + change));
      newWeights = normalize(newWeights);

      const newError = calculateError(newWeights);

      if (newError < currentError) {
          weights = newWeights;
          currentError = newError;
      } else {
          // Revert implicit
      }
      
      if (i % 50 === 0) stepSize *= 0.9; // Decay step
  }

  // Filter out negligible amounts (< 0.5%)
  const result: SolvedIngredient[] = weights
    .map((w, i) => ({ pigment: palette[i], ratio: w }))
    .filter(item => item.ratio > 0.005)
    .sort((a, b) => b.ratio - a.ratio); // Largest first

  // Re-normalize ratios for display
  const totalRatio = result.reduce((sum, item) => sum + item.ratio, 0);
  return result.map(item => ({ ...item, ratio: item.ratio / totalRatio }));
};