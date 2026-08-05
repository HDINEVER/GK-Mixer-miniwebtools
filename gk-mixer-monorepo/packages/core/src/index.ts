// GK Mixer Core - public API surface
// ============================================================
// This is the ONLY file apps are allowed to import from.
// Keeping it small makes the future Swift port mechanical.
// ============================================================

export * from './types/color';

export {
  hexToRgb,
  rgbToHex,
  rgbToCmyk,
  rgbToHsb,
  hsbToRgb,
  rgbToLab,
  labToRgb,
  getContrastColor,
  getColorDistance,
} from './utils/color-convert';

export {
  convertToWorkingSpace,
  convertFromWorkingSpace,
  isInGamut,
  getColorSpaceName,
  getColorSpaceCoverage,
  getColorSpaceDescription,
} from './utils/color-space';

export {
  convertHexToAllSpaces,
  mixDemoColors,
} from './utils/color-data';

export { extractProminentColorsFromPixels } from './utils/color-extract';

// Paint engine (ported verbatim from original web utils/colorUtils.ts +
// utils/mixbox.ts) - paint databases, mixbox blending, recipes, RAL matching
export {
  generateId,
  GAIA_PAINTS,
  JUMPWIND_PAINTS,
  GUNZE_PAINTS,
  COMMON_PAINTS,
  CMY_PIGMENT_COLORS,
  CMY_SOLID_COLORS,
  BASE_MIXING_COLORS,
  EXTENDED_MIXING_COLORS,
  findNearestPaints,
  mixboxBlend,
  opticalBlend,
  CMY_PRIMARIES,
  mixboxMultiBlend,
  calculateMixboxRatios,
  calculateProfessionalRecipe,
  findNearestRAL,
  hexToRAL,
  cmykToRAL,
  getRALByNumber,
  colorDataToRAL,
} from './utils/color-engine';

export * as mixbox from './utils/mixbox';

export {
  createApiClient,
  createApiService,
  type ApiClient,
  type ApiRequest,
  type ApiResponse,
  type CreateApiClientOptions,
  type HttpClient,
  type HttpMethod,
} from './services/api';
