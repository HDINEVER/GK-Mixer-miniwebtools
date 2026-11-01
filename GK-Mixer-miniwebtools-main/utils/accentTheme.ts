import { PALETTES, PaletteName, Shade } from './accentPalettes';
import { IS_NIGHTWORKS_EDITION } from './brandEdition';

/**
 * Accent theming
 * ------------------------------------------------------------------
 * Every accent colour family used by the UI (sky / blue / indigo / violet /
 * purple / pink / amber / orange + the macaron pastels) is compiled by
 * Tailwind as `rgb(var(--ac-<family>-<shade>) / <alpha>)`. Switching a theme
 * just rewrites those CSS variables, so no component class names change.
 * Semantic colours (emerald/green = success, red/rose = danger, slate = neutral)
 * are deliberately NOT themed.
 */

export const ACCENT_FAMILIES = ['sky', 'blue', 'indigo', 'violet', 'purple', 'pink', 'amber', 'orange'] as const;
export type AccentFamily = (typeof ACCENT_FAMILIES)[number];
export const SHADES: Shade[] = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
export const MACARON_KEYS = ['blue', 'purple', 'pink'] as const;
type MacaronKey = (typeof MACARON_KEYS)[number];

export type AccentThemeId = 'classic' | 'ocean' | 'sakura' | 'matcha' | 'sunset' | 'twilight' | 'graphite';

export interface AsciiSurfaceTokens {
  page: string;
  surface: string;
  subsurface: string;
  well: string;
  ink: string;
  muted: string;
  border: string;
  rule: string;
  shadow: string;
  headerTint: string;
}

export interface AsciiThemeConfig {
  /** Desaturated retro-terminal accent color */
  accentHex: string;
  hoverHex: string;
  darkTextHex: string;
  /** WebGL GradientASCII field geometry */
  shape: 'horizon' | 'pinch' | 'rise' | 'eclipse';
  /** Character ramp from dimmest to brightest */
  characters: string;
  /** Desaturated 4-color ramp for Light Mode GradientASCII */
  lightColors: string[];
  /** Desaturated 4-color ramp for Dark Mode GradientASCII */
  darkColors: string[];
  /** Bold, non-yellowish terminal surface & ink palette for Light Mode */
  lightSurface: AsciiSurfaceTokens;
  /** Bold terminal surface & phosphor palette for Dark Mode */
  darkSurface: AsciiSurfaceTokens;
}

export interface FieldworkSurfaceTokens {
  /** Warm/tinted specimen paper background */
  paper: string;
  /** Flat specimen card sheet surface */
  surface: string;
  /** Recessed editorial grid / row subsurface */
  subsurface: string;
  /** Signature Fieldwork high-value luminous stage block (e.g. #E5ED85 Acid-Chartreuse) */
  acid: string;
  /** Secondary print-sample plate block (e.g. #CED9F0 Studio Periwinkle) */
  plate: string;
  /** Primary deep chromatic foundry ink */
  ink: string;
  /** Hover ink shade for solid buttons */
  inkHover: string;
  /** High-contrast dark foundry ink used ON TOP of `acid` / `plate` stages */
  stageInk: string;
  /** Muted caption / metadata ink */
  muted: string;
  /** 1px hairline rule color */
  line: string;
}

export interface FieldworkThemeConfig {
  /** Foundry accent hex for Tailwind/charts in Fieldwork mode */
  accentHex: string;
  hoverHex: string;
  darkTextHex: string;
  light: FieldworkSurfaceTokens;
  dark: FieldworkSurfaceTokens;
}

export interface NeumorphismSurfaceTokens {
  /** Monochromatic soft clay base surface (--base-color in adamgiebl/neumorphism) */
  base: string;
  /** 145deg bottom-right dark shadow color (colorLuminance(base, -0.15)) */
  dark: string;
  /** 145deg top-left light highlight color (colorLuminance(base, +0.15)) */
  light: string;
  /** 145deg convex gradient start (colorLuminance(base, +0.07)) */
  gradFirst: string;
  /** 145deg convex gradient end (colorLuminance(base, -0.10)) */
  gradSecond: string;
  /** High-contrast text color (#001f3f light / #f6f5f7 dark from adamgiebl/neumorphism) */
  text: string;
  /** Secondary muted label color */
  muted: string;
}

export interface NeumorphismThemeConfig {
  accentHex: string;
  hoverHex: string;
  darkTextHex: string;
  light: NeumorphismSurfaceTokens;
  dark: NeumorphismSurfaceTokens;
}

export interface AccentTheme {
  id: AccentThemeId;
  name: { zh: string; en: string; ja: string };
  accentHex: string;
  hoverHex: string;
  darkTextHex: string;
  map: Record<AccentFamily, PaletteName>;
  macaron: Record<MacaronKey, string>;
  ascii: AsciiThemeConfig;
  fieldwork: FieldworkThemeConfig;
  neumorphism: NeumorphismThemeConfig;
}

/** Original macaron pastels (kept exact for the default theme). */
export const MACARON_DEFAULTS: Record<MacaronKey, string> = {
  blue: '#AEC6CF',
  purple: '#B39EB5',
  pink: '#FFB7B2',
};

const identity: Record<AccentFamily, PaletteName> = {
  sky: 'sky', blue: 'blue', indigo: 'indigo', violet: 'violet',
  purple: 'purple', pink: 'pink', amber: 'amber', orange: 'orange',
};

const derivedMacaron = (map: Record<AccentFamily, PaletteName>): Record<MacaronKey, string> => ({
  blue: PALETTES[map.sky]['300'],
  purple: PALETTES[map.purple]['300'],
  pink: PALETTES[map.pink]['200'],
});

const ASCII_PRESETS: Record<AccentThemeId, AsciiThemeConfig> = {
  classic: {
    accentHex: '#C25953',
    hoverHex: '#A84640',
    darkTextHex: '#DE857E',
    shape: 'horizon',
    characters: ' =+xX0S8#@',
    lightColors: ['#6E2B2B', '#B5544E', '#D88C84', '#9E423D'],
    darkColors: ['#5E2022', '#A84A44', '#D6837A', '#F0C4BE'],
    lightSurface: {
      page: '#EDE5E6',
      surface: 'rgba(250, 245, 246, 0.90)',
      subsurface: '#F1E3E5',
      well: '#E3D1D4',
      ink: '#211315',
      muted: '#6B4F53',
      border: '#3B1D21',
      rule: 'rgba(59, 29, 33, 0.24)',
      shadow: 'rgba(115, 44, 48, 0.34)',
      headerTint: '#EAD6D9',
    },
    darkSurface: {
      page: '#0E0809',
      surface: 'rgba(24, 14, 16, 0.88)',
      subsurface: '#211316',
      well: '#120A0C',
      ink: '#EFE4E6',
      muted: '#9E8084',
      border: '#6E4045',
      rule: 'rgba(239, 228, 230, 0.20)',
      shadow: 'rgba(194, 89, 83, 0.44)',
      headerTint: '#2B1619',
    },
  },
  ocean: {
    accentHex: '#4673B0',
    hoverHex: '#365E96',
    darkTextHex: '#8AB0E0',
    shape: 'horizon',
    characters: ' =+xX0S8#@',
    lightColors: ['#1E3F73', '#4673B0', '#7FA8D9', '#325B96'],
    darkColors: ['#183159', '#3E6AA6', '#7BA5DB', '#C2D9F2'],
    lightSurface: {
      page: '#E3ECF6',
      surface: 'rgba(245, 249, 254, 0.90)',
      subsurface: '#E1EBF7',
      well: '#CEDEEF',
      ink: '#101C2B',
      muted: '#4C627D',
      border: '#1B2F4A',
      rule: 'rgba(27, 47, 74, 0.24)',
      shadow: 'rgba(34, 65, 112, 0.34)',
      headerTint: '#D6E4F4',
    },
    darkSurface: {
      page: '#070C14',
      surface: 'rgba(13, 21, 34, 0.88)',
      subsurface: '#121E30',
      well: '#080F19',
      ink: '#E2ECF7',
      muted: '#7B93B0',
      border: '#3E5C82',
      rule: 'rgba(226, 236, 247, 0.20)',
      shadow: 'rgba(70, 115, 176, 0.44)',
      headerTint: '#16253B',
    },
  },
  sakura: {
    accentHex: '#B55B82',
    hoverHex: '#99476B',
    darkTextHex: '#DF95B5',
    shape: 'pinch',
    characters: ' .:+*xX08#@',
    lightColors: ['#632945', '#B55B82', '#D694B2', '#8E3F63'],
    darkColors: ['#4F1E36', '#A64D74', '#D68CAE', '#F2C9DC'],
    lightSurface: {
      page: '#EFE5EC',
      surface: 'rgba(251, 245, 249, 0.90)',
      subsurface: '#F2E3ED',
      well: '#E4D0DE',
      ink: '#24121D',
      muted: '#704F62',
      border: '#3E1D30',
      rule: 'rgba(62, 29, 48, 0.24)',
      shadow: 'rgba(115, 45, 80, 0.34)',
      headerTint: '#ECD6E4',
    },
    darkSurface: {
      page: '#10080E',
      surface: 'rgba(25, 14, 22, 0.88)',
      subsurface: '#22131E',
      well: '#130910',
      ink: '#F0E4EC',
      muted: '#A18195',
      border: '#6E405B',
      rule: 'rgba(240, 228, 236, 0.20)',
      shadow: 'rgba(181, 91, 130, 0.44)',
      headerTint: '#2B1725',
    },
  },
  matcha: {
    accentHex: '#388A6E',
    hoverHex: '#2B7058',
    darkTextHex: '#7CC7AC',
    shape: 'rise',
    characters: ' =+xX0S8#@',
    lightColors: ['#1C4D3C', '#388A6E', '#7ABAA2', '#2B6E57'],
    darkColors: ['#133B2E', '#328266', '#72B89E', '#BFE6D7'],
    lightSurface: {
      page: '#E3EFE9',
      surface: 'rgba(244, 250, 247, 0.90)',
      subsurface: '#E0EFE8',
      well: '#CDE2D8',
      ink: '#0F211B',
      muted: '#4A695E',
      border: '#18382D',
      rule: 'rgba(24, 56, 45, 0.24)',
      shadow: 'rgba(28, 77, 60, 0.34)',
      headerTint: '#D4E9DF',
    },
    darkSurface: {
      page: '#070E0B',
      surface: 'rgba(12, 24, 19, 0.88)',
      subsurface: '#10221B',
      well: '#07120E',
      ink: '#E1EFEA',
      muted: '#78998D',
      border: '#396656',
      rule: 'rgba(225, 239, 234, 0.20)',
      shadow: 'rgba(56, 138, 110, 0.44)',
      headerTint: '#152B22',
    },
  },
  sunset: {
    accentHex: '#BF713A',
    hoverHex: '#A15B29',
    darkTextHex: '#E3A374',
    shape: 'horizon',
    characters: ' =+xX0S8#@',
    lightColors: ['#6B3A18', '#BF713A', '#DEA478', '#965323'],
    darkColors: ['#572D10', '#B56732', '#DEA273', '#F2D2B8'],
    lightSurface: {
      page: '#EFE7E1',
      surface: 'rgba(251, 247, 243, 0.90)',
      subsurface: '#F2E6DC',
      well: '#E5D4C5',
      ink: '#24170F',
      muted: '#705848',
      border: '#3E2516',
      rule: 'rgba(62, 37, 22, 0.24)',
      shadow: 'rgba(115, 62, 26, 0.34)',
      headerTint: '#ECDDD0',
    },
    darkSurface: {
      page: '#100A06',
      surface: 'rgba(25, 17, 12, 0.88)',
      subsurface: '#221710',
      well: '#130C07',
      ink: '#F0E8E1',
      muted: '#A38B78',
      border: '#704E36',
      rule: 'rgba(240, 232, 225, 0.20)',
      shadow: 'rgba(191, 113, 58, 0.44)',
      headerTint: '#2B1D13',
    },
  },
  twilight: {
    accentHex: '#735CAD',
    hoverHex: '#5C4694',
    darkTextHex: '#B19EE0',
    shape: 'eclipse',
    characters: ' =+xX0S8#@',
    lightColors: ['#392966', '#735CAD', '#A896D6', '#56408C'],
    darkColors: ['#2C1E52', '#6B54A6', '#A491D6', '#DDD4F5'],
    lightSurface: {
      page: '#E9E6F3',
      surface: 'rgba(248, 246, 253, 0.90)',
      subsurface: '#E8E3F5',
      well: '#D8D0EC',
      ink: '#181329',
      muted: '#5A5078',
      border: '#2A1F47',
      rule: 'rgba(42, 31, 71, 0.24)',
      shadow: 'rgba(62, 46, 112, 0.34)',
      headerTint: '#DFD9F0',
    },
    darkSurface: {
      page: '#090712',
      surface: 'rgba(17, 14, 29, 0.88)',
      subsurface: '#171326',
      well: '#0B0916',
      ink: '#E8E4F2',
      muted: '#8B80AB',
      border: '#51417A',
      rule: 'rgba(232, 228, 242, 0.20)',
      shadow: 'rgba(115, 92, 173, 0.44)',
      headerTint: '#1F1933',
    },
  },
  graphite: {
    accentHex: '#526478',
    hoverHex: '#3E4E60',
    darkTextHex: '#9EB0C4',
    shape: 'pinch',
    characters: ' =+xX0S8#@',
    lightColors: ['#273442', '#526478', '#8FA1B5', '#3D4E61'],
    darkColors: ['#1D2733', '#4B5D70', '#8CA0B5', '#CFD9E3'],
    lightSurface: {
      page: '#E5EAF0',
      surface: 'rgba(246, 248, 251, 0.90)',
      subsurface: '#E3E9F0',
      well: '#D3DBE5',
      ink: '#121820',
      muted: '#516070',
      border: '#202B38',
      rule: 'rgba(32, 43, 56, 0.24)',
      shadow: 'rgba(44, 58, 74, 0.34)',
      headerTint: '#DAE2EC',
    },
    darkSurface: {
      page: '#080B0F',
      surface: 'rgba(15, 19, 25, 0.88)',
      subsurface: '#131921',
      well: '#090D12',
      ink: '#E4E9EF',
      muted: '#808E9E',
      border: '#455363',
      rule: 'rgba(228, 233, 239, 0.20)',
      shadow: 'rgba(82, 100, 120, 0.44)',
      headerTint: '#1A222D',
    },
  },
};

const FIELDWORK_PRESETS: Record<AccentThemeId, FieldworkThemeConfig> = {
  classic: {
    // Fieldwork Poster Print Edition (Terracotta-Peach Stage × Carmine-Espresso Foundry Ink × Butter-Ochre Plate)
    accentHex: '#C8553D',
    hoverHex: '#A6422D',
    darkTextHex: '#F6B89E',
    light: {
      paper: '#FAF6F2',
      surface: '#FAF6F2',
      subsurface: '#F2EBE3',
      acid: '#F6B89E',
      plate: '#F3DF9E',
      ink: '#361C18',
      inkHover: '#522B25',
      stageInk: '#361C18',
      muted: '#735752',
      line: 'rgba(54, 28, 24, 0.24)',
    },
    dark: {
      paper: '#211311',
      surface: '#2B1916',
      subsurface: '#251613',
      acid: '#F6B89E',
      plate: '#3D2420',
      ink: '#FAF6F2',
      inkHover: '#F6B89E',
      stageInk: '#361C18',
      muted: '#D4BDB8',
      line: 'rgba(250, 246, 242, 0.22)',
    },
  },
  ocean: {
    // Fieldwork Studio Print Edition (Periwinkle-Sky Stage × Prussian Foundry Ink × Acid-Lime Plate)
    accentHex: '#2B5B9E',
    hoverHex: '#1E447A',
    darkTextHex: '#C5D7F7',
    light: {
      paper: '#F4F6FA',
      surface: '#F4F6FA',
      subsurface: '#E8EEF6',
      acid: '#C5D7F7',
      plate: '#E5ED85',
      ink: '#18263A',
      inkHover: '#263B59',
      stageInk: '#18263A',
      muted: '#54647A',
      line: 'rgba(24, 38, 58, 0.24)',
    },
    dark: {
      paper: '#131D2B',
      surface: '#1A273B',
      subsurface: '#162233',
      acid: '#C5D7F7',
      plate: '#24354F',
      ink: '#F4F6FA',
      inkHover: '#C5D7F7',
      stageInk: '#18263A',
      muted: '#B8C7DC',
      line: 'rgba(244, 246, 250, 0.22)',
    },
  },
  sakura: {
    // Fieldwork Botanical Rose Edition (Petal-Rose Stage × Aubergine-Plum Foundry Ink × Pistachio Plate)
    accentHex: '#B84A7A',
    hoverHex: '#963861',
    darkTextHex: '#F5C2D7',
    light: {
      paper: '#FAF6F8',
      surface: '#FAF6F8',
      subsurface: '#F2EAEF',
      acid: '#F5C2D7',
      plate: '#E2E8C0',
      ink: '#361928',
      inkHover: '#52273D',
      stageInk: '#361928',
      muted: '#735464',
      line: 'rgba(54, 25, 40, 0.24)',
    },
    dark: {
      paper: '#22121B',
      surface: '#2E1925',
      subsurface: '#271520',
      acid: '#F5C2D7',
      plate: '#3F2333',
      ink: '#FAF6F8',
      inkHover: '#F5C2D7',
      stageInk: '#361928',
      muted: '#D6BCC9',
      line: 'rgba(250, 246, 248, 0.22)',
    },
  },
  matcha: {
    // Fieldwork Original No. 01 Edition (Acid-Chartreuse #E5ED85 Stage × Forest-Pine #24352B Ink × Studio Periwinkle #CED9F0)
    accentHex: '#2D6A4F',
    hoverHex: '#24352B',
    darkTextHex: '#E5ED85',
    light: {
      paper: '#F7F8F2',
      surface: '#F7F8F2',
      subsurface: '#F0F2E8',
      acid: '#E5ED85',
      plate: '#CED9F0',
      ink: '#24352B',
      inkHover: '#394D40',
      stageInk: '#24352B',
      muted: '#5D685F',
      line: 'rgba(36, 53, 43, 0.25)',
    },
    dark: {
      paper: '#1B2820',
      surface: '#24352B',
      subsurface: '#1F2E25',
      acid: '#E5ED85',
      plate: '#2B3D33',
      ink: '#F7F8F2',
      inkHover: '#E5ED85',
      stageInk: '#24352B',
      muted: '#C3CEC2',
      line: 'rgba(247, 248, 242, 0.22)',
    },
  },
  sunset: {
    // Fieldwork Almanac Ochre Edition (Marigold-Amber Stage × Raw-Umber Foundry Ink × Apricot Plate)
    accentHex: '#C97324',
    hoverHex: '#A65B17',
    darkTextHex: '#F7D47E',
    light: {
      paper: '#FAF7F0',
      surface: '#FAF7F0',
      subsurface: '#F3EDE0',
      acid: '#F7D47E',
      plate: '#F0B89A',
      ink: '#332112',
      inkHover: '#4D331C',
      stageInk: '#332112',
      muted: '#705C49',
      line: 'rgba(51, 33, 18, 0.24)',
    },
    dark: {
      paper: '#21170E',
      surface: '#2C1F14',
      subsurface: '#261B11',
      acid: '#F7D47E',
      plate: '#3D2B1C',
      ink: '#FAF7F0',
      inkHover: '#F7D47E',
      stageInk: '#332112',
      muted: '#D4C3B2',
      line: 'rgba(250, 247, 240, 0.22)',
    },
  },
  twilight: {
    // Fieldwork Iris Specimen Edition (Iris-Lavender Stage × Midnight-Violet Foundry Ink × Acid-Lime Plate)
    accentHex: '#6B4EAB',
    hoverHex: '#543A8F',
    darkTextHex: '#D7C9F7',
    light: {
      paper: '#F7F6FA',
      surface: '#F7F6FA',
      subsurface: '#EEEBF5',
      acid: '#D7C9F7',
      plate: '#E5ED85',
      ink: '#241B38',
      inkHover: '#382A57',
      stageInk: '#241B38',
      muted: '#615678',
      line: 'rgba(36, 27, 56, 0.24)',
    },
    dark: {
      paper: '#181326',
      surface: '#221B36',
      subsurface: '#1D172E',
      acid: '#D7C9F7',
      plate: '#30264B',
      ink: '#F7F6FA',
      inkHover: '#D7C9F7',
      stageInk: '#241B38',
      muted: '#C5BCD9',
      line: 'rgba(247, 246, 250, 0.22)',
    },
  },
  graphite: {
    // Fieldwork Lead-Type Monolith Edition (Mineral Silver-Sage Stage × Carbon-Lead Ink × Cool Lead Plate)
    accentHex: '#43504D',
    hoverHex: '#2F3937',
    darkTextHex: '#DCE3D5',
    light: {
      paper: '#F5F6F5',
      surface: '#F5F6F5',
      subsurface: '#EAECEB',
      acid: '#DCE3D5',
      plate: '#D0D7DF',
      ink: '#1C2120',
      inkHover: '#2F3735',
      stageInk: '#1C2120',
      muted: '#5A6260',
      line: 'rgba(28, 33, 32, 0.24)',
    },
    dark: {
      paper: '#151918',
      surface: '#1E2422',
      subsurface: '#191E1D',
      acid: '#DCE3D5',
      plate: '#2A3230',
      ink: '#F5F6F5',
      inkHover: '#DCE3D5',
      stageInk: '#1C2120',
      muted: '#BDC4C2',
      line: 'rgba(245, 246, 245, 0.22)',
    },
  },
};

/**
 * Exact luminance helper from https://github.com/adamgiebl/neumorphism (`src/utils.js`)
 * Used to derive 145deg dual opposing shadows (±15%) and convex/concave surface gradients (+7% / -10%).
 */
export const colorLuminance = (hex: string, lum: number): string => {
  let clean = String(hex).replace(/[^0-9a-f]/gi, '');
  if (clean.length < 6) {
    clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
  }
  const factor = lum || 0;
  let rgb = '#';
  for (let i = 0; i < 3; i++) {
    const c = parseInt(clean.substr(i * 2, 2), 16);
    const MathVal = Math.round(Math.min(Math.max(0, c + c * factor), 255)).toString(16);
    rgb += ('00' + MathVal).substr(MathVal.length);
  }
  return rgb;
};

const makeNeuLight = (base: string, text = '#001f3f', muted = '#546478'): NeumorphismSurfaceTokens => ({
  base,
  dark: colorLuminance(base, -0.15),
  light: colorLuminance(base, 0.15),
  gradFirst: colorLuminance(base, 0.07),
  gradSecond: colorLuminance(base, -0.10),
  text,
  muted,
});

const makeNeuDark = (base: string, text = '#f6f5f7', muted = '#9aa5b4'): NeumorphismSurfaceTokens => ({
  base,
  dark: colorLuminance(base, -0.38),
  light: colorLuminance(base, 0.26),
  gradFirst: colorLuminance(base, 0.09),
  gradSecond: colorLuminance(base, -0.12),
  text,
  muted,
});

/**
 * 7 Dynamic Monochromatic Soft UI / Neumorphism Palettes (`adamgiebl/neumorphism`)
 * Each theme molds the entire canvas, cards, buttons, and inset grooves from a single
 * theme-tinted soft clay surface (`base`) with mathematically derived ±15% opposing 145° shadows.
 */
const NEUMORPHISM_PRESETS: Record<AccentThemeId, NeumorphismThemeConfig> = {
  classic: {
    accentHex: '#E05250',
    hoverHex: '#CC3E3C',
    darkTextHex: '#FF8A80',
    light: makeNeuLight('#E5DFDF', '#001f3f', '#5E5358'),
    dark: makeNeuDark('#262224', '#f6f5f7', '#A89BA0'),
  },
  ocean: {
    accentHex: '#3B82F6',
    hoverHex: '#2563EB',
    darkTextHex: '#93C5FD',
    light: makeNeuLight('#DCE4EE', '#001f3f', '#4D617A'),
    dark: makeNeuDark('#1F2530', '#f6f5f7', '#94A6BD'),
  },
  sakura: {
    accentHex: '#EC4899',
    hoverHex: '#DB2777',
    darkTextHex: '#F9A8D4',
    light: makeNeuLight('#E8DEE4', '#24131E', '#695060'),
    dark: makeNeuDark('#282025', '#f6f5f7', '#AD97A5'),
  },
  matcha: {
    accentHex: '#10B981',
    hoverHex: '#059669',
    darkTextHex: '#6EE7B7',
    light: makeNeuLight('#DCE6E1', '#0D261E', '#4C685E'),
    dark: makeNeuDark('#1E2723', '#f6f5f7', '#93ADA3'),
  },
  sunset: {
    accentHex: '#F97316',
    hoverHex: '#EA580C',
    darkTextHex: '#FDBA74',
    light: makeNeuLight('#E8E0D8', '#26170E', '#6B5749'),
    dark: makeNeuDark('#29231E', '#f6f5f7', '#B09E90'),
  },
  twilight: {
    accentHex: '#8B5CF6',
    hoverHex: '#7C3AED',
    darkTextHex: '#C4B5FD',
    light: makeNeuLight('#E2DFEC', '#191330', '#5A5275'),
    dark: makeNeuDark('#23202C', '#f6f5f7', '#9F97B8'),
  },
  graphite: {
    accentHex: '#475569',
    hoverHex: '#334155',
    darkTextHex: '#CBD5E1',
    light: makeNeuLight('#E0E5EC', '#001f3f', '#556478'),
    dark: makeNeuDark('#23272E', '#f6f5f7', '#98A4B3'),
  },
};

const make = (
  id: AccentThemeId,
  name: AccentTheme['name'],
  accentHex: string,
  hoverHex: string,
  darkTextHex: string,
  overrides: Partial<Record<AccentFamily, PaletteName>>,
  macaron?: Record<MacaronKey, string>,
): AccentTheme => {
  const map = { ...identity, ...overrides };
  return {
    id,
    name,
    accentHex,
    hoverHex,
    darkTextHex,
    map,
    macaron: macaron ?? derivedMacaron(map),
    ascii: ASCII_PRESETS[id],
    fieldwork: FIELDWORK_PRESETS[id],
    neumorphism: NEUMORPHISM_PRESETS[id],
  };
};

export const ACCENT_THEMES: AccentTheme[] = [
  make('classic', { zh: '珊瑚红', en: 'Coral', ja: 'コーラル' }, '#EF5350', '#E53935', '#FF8A80', {}, MACARON_DEFAULTS),
  make('ocean', { zh: '深海蓝', en: 'Ocean', ja: 'オーシャン' }, '#3B82F6', '#2563EB', '#93C5FD', {
    sky: 'cyan', blue: 'blue', indigo: 'blue', violet: 'indigo', purple: 'indigo', pink: 'sky', amber: 'teal', orange: 'cyan',
  }),
  make('sakura', { zh: '樱花粉', en: 'Sakura', ja: 'サクラ' }, '#EC4899', '#DB2777', '#F9A8D4', {
    sky: 'pink', blue: 'rose', indigo: 'fuchsia', violet: 'fuchsia', purple: 'fuchsia', pink: 'rose', amber: 'rose', orange: 'pink',
  }),
  make('matcha', { zh: '抹茶绿', en: 'Matcha', ja: '抹茶' }, '#10B981', '#059669', '#6EE7B7', {
    sky: 'emerald', blue: 'green', indigo: 'teal', violet: 'teal', purple: 'teal', pink: 'lime', amber: 'lime', orange: 'green',
  }),
  make('sunset', { zh: '日落橙', en: 'Sunset', ja: 'サンセット' }, '#F97316', '#EA580C', '#FDBA74', {
    sky: 'orange', blue: 'amber', indigo: 'red', violet: 'rose', purple: 'rose', pink: 'amber', amber: 'amber', orange: 'red',
  }),
  make('twilight', { zh: '暮紫罗', en: 'Twilight', ja: 'トワイライト' }, '#8B5CF6', '#7C3AED', '#C4B5FD', {
    sky: 'violet', blue: 'indigo', indigo: 'indigo', violet: 'fuchsia', purple: 'fuchsia', pink: 'pink', amber: 'pink', orange: 'rose',
  }),
  make('graphite', { zh: '石墨灰', en: 'Graphite', ja: 'グラファイト' }, '#475569', '#334155', '#CBD5E1', {
    sky: 'slate', blue: 'zinc', indigo: 'slate', violet: 'zinc', purple: 'zinc', pink: 'stone', amber: 'stone', orange: 'stone',
  }),
];

export const DEFAULT_ACCENT_THEME: AccentThemeId = 'classic';
const STORAGE_KEY = 'gk-accent-theme';

export type UIStyle = 'glass' | 'blueprint' | 'craft' | 'ascii' | 'catalog';
export const DEFAULT_UI_STYLE: UIStyle = IS_NIGHTWORKS_EDITION ? 'blueprint' : 'glass';
const UI_STYLE_STORAGE_KEY = IS_NIGHTWORKS_EDITION ? 'gk-ui-style-nw' : 'gk-ui-style';

export type WorkflowMode = 'pro' | 'beginner';
export const DEFAULT_WORKFLOW_MODE: WorkflowMode = IS_NIGHTWORKS_EDITION ? 'beginner' : 'pro';
const WORKFLOW_MODE_STORAGE_KEY = IS_NIGHTWORKS_EDITION ? 'gk-workflow-mode-nw' : 'gk-workflow-mode';

export const DEFAULT_HIDE_TOP_BAR: boolean = IS_NIGHTWORKS_EDITION ? true : false;
const HIDE_TOP_BAR_STORAGE_KEY = IS_NIGHTWORKS_EDITION ? 'gk-hide-top-bar-nw' : 'gk-hide-top-bar';

export type UIFontScale = '100' | '108' | '115';
export const DEFAULT_UI_FONT_SCALE: UIFontScale = '100';
const UI_FONT_SCALE_STORAGE_KEY = 'gk-ui-font-scale';

export const THEME_SYNC_EVENT = 'gk-theme-sync';

const emitThemeSync = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(THEME_SYNC_EVENT));
  }
};

export const hexToRgbTriplet = (hex: string): string => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

export const getAccentTheme = (id: string | null | undefined): AccentTheme =>
  ACCENT_THEMES.find((t) => t.id === id) ?? ACCENT_THEMES[0];

const applyAsciiSurfaceVariables = (style: CSSStyleDeclaration, ascii: AsciiThemeConfig) => {
  const { lightSurface: ls, darkSurface: ds } = ascii;
  style.setProperty('--tui-light-page', ls.page);
  style.setProperty('--tui-light-surface', ls.surface);
  style.setProperty('--tui-light-subsurface', ls.subsurface);
  style.setProperty('--tui-light-well', ls.well);
  style.setProperty('--tui-light-ink', ls.ink);
  style.setProperty('--tui-light-muted', ls.muted);
  style.setProperty('--tui-light-border', ls.border);
  style.setProperty('--tui-light-rule', ls.rule);
  style.setProperty('--tui-light-shadow', ls.shadow);
  style.setProperty('--tui-light-header-tint', ls.headerTint);

  style.setProperty('--tui-dark-page', ds.page);
  style.setProperty('--tui-dark-surface', ds.surface);
  style.setProperty('--tui-dark-subsurface', ds.subsurface);
  style.setProperty('--tui-dark-well', ds.well);
  style.setProperty('--tui-dark-ink', ds.ink);
  style.setProperty('--tui-dark-muted', ds.muted);
  style.setProperty('--tui-dark-border', ds.border);
  style.setProperty('--tui-dark-rule', ds.rule);
  style.setProperty('--tui-dark-shadow', ds.shadow);
  style.setProperty('--tui-dark-header-tint', ds.headerTint);
};

const applyFieldworkSurfaceVariables = (style: CSSStyleDeclaration, fieldwork: FieldworkThemeConfig) => {
  const { light: lf, dark: df } = fieldwork;
  style.setProperty('--ft-light-paper', lf.paper);
  style.setProperty('--ft-light-surface', lf.surface);
  style.setProperty('--ft-light-subsurface', lf.subsurface);
  style.setProperty('--ft-light-acid', lf.acid);
  style.setProperty('--ft-light-plate', lf.plate);
  style.setProperty('--ft-light-ink', lf.ink);
  style.setProperty('--ft-light-ink-hover', lf.inkHover);
  style.setProperty('--ft-light-stage-ink', lf.stageInk);
  style.setProperty('--ft-light-muted', lf.muted);
  style.setProperty('--ft-light-line', lf.line);

  style.setProperty('--ft-dark-paper', df.paper);
  style.setProperty('--ft-dark-surface', df.surface);
  style.setProperty('--ft-dark-subsurface', df.subsurface);
  style.setProperty('--ft-dark-acid', df.acid);
  style.setProperty('--ft-dark-plate', df.plate);
  style.setProperty('--ft-dark-ink', df.ink);
  style.setProperty('--ft-dark-ink-hover', df.inkHover);
  style.setProperty('--ft-dark-stage-ink', df.stageInk);
  style.setProperty('--ft-dark-muted', df.muted);
  style.setProperty('--ft-dark-line', df.line);
};

const applyNeumorphismSurfaceVariables = (style: CSSStyleDeclaration, neu: NeumorphismThemeConfig) => {
  const { light: ln, dark: dn } = neu;
  style.setProperty('--neu-light-base', ln.base);
  style.setProperty('--neu-light-dark', ln.dark);
  style.setProperty('--neu-light-light', ln.light);
  style.setProperty('--neu-light-grad-first', ln.gradFirst);
  style.setProperty('--neu-light-grad-second', ln.gradSecond);
  style.setProperty('--neu-light-text', ln.text);
  style.setProperty('--neu-light-muted', ln.muted);

  style.setProperty('--neu-dark-base', dn.base);
  style.setProperty('--neu-dark-dark', dn.dark);
  style.setProperty('--neu-dark-light', dn.light);
  style.setProperty('--neu-dark-grad-first', dn.gradFirst);
  style.setProperty('--neu-dark-grad-second', dn.gradSecond);
  style.setProperty('--neu-dark-text', dn.text);
  style.setProperty('--neu-dark-muted', dn.muted);
};

export const applyAccentTheme = (id: AccentThemeId) => {
  if (typeof document === 'undefined') return;
  const theme = getAccentTheme(id);
  const style = document.documentElement.style;
  const currentUiStyle = document.documentElement.dataset.uiStyle || loadUIStyle();
  const isAscii = currentUiStyle === 'ascii';
  const isCatalog = currentUiStyle === 'catalog';
  const isCraft = currentUiStyle === 'craft';

  const activeAccentHex = isAscii
    ? theme.ascii.accentHex
    : isCatalog
      ? theme.fieldwork.accentHex
      : isCraft
        ? theme.neumorphism.accentHex
        : theme.accentHex;
  const activeHoverHex = isAscii
    ? theme.ascii.hoverHex
    : isCatalog
      ? theme.fieldwork.hoverHex
      : isCraft
        ? theme.neumorphism.hoverHex
        : theme.hoverHex;
  const activeDarkTextHex = isAscii
    ? theme.ascii.darkTextHex
    : isCatalog
      ? theme.fieldwork.darkTextHex
      : isCraft
        ? theme.neumorphism.darkTextHex
        : theme.darkTextHex;

  const accentRgb = hexToRgbTriplet(activeAccentHex);
  const hoverRgb = hexToRgbTriplet(activeHoverHex);
  const darkTextRgb = hexToRgbTriplet(activeDarkTextHex);

  style.setProperty('--accent-color', activeAccentHex);
  style.setProperty('--accent-rgb', accentRgb);
  style.setProperty('--accent-hover', activeHoverHex);
  style.setProperty('--accent-hover-rgb', hoverRgb);
  style.setProperty('--accent-soft', `rgb(${accentRgb} / ${isAscii || isCatalog ? '0.16' : '0.12'})`);
  style.setProperty('--accent-dark-text-rgb', darkTextRgb);

  applyAsciiSurfaceVariables(style, theme.ascii);
  applyFieldworkSurfaceVariables(style, theme.fieldwork);
  applyNeumorphismSurfaceVariables(style, theme.neumorphism);

  for (const family of ACCENT_FAMILIES) {
    const palette = PALETTES[theme.map[family]];
    for (const shade of SHADES) {
      style.setProperty(`--ac-${family}-${shade}`, hexToRgbTriplet(palette[shade]));
    }
  }
  for (const key of MACARON_KEYS) {
    style.setProperty(`--ac-macaron-${key}`, hexToRgbTriplet(theme.macaron[key]));
  }
  document.documentElement.dataset.accent = theme.id;
};

export const loadAccentTheme = (): AccentThemeId => {
  try {
    return getAccentTheme(localStorage.getItem(STORAGE_KEY)).id;
  } catch {
    return DEFAULT_ACCENT_THEME;
  }
};

export const saveAccentTheme = (id: AccentThemeId) => {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* storage unavailable */
  }
  applyAccentTheme(id);
  emitThemeSync();
};

export const applyUIStyle = (uiStyle: UIStyle) => {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.uiStyle = uiStyle;
  applyAccentTheme(loadAccentTheme());
};

export const loadUIStyle = (): UIStyle => {
  try {
    const raw = localStorage.getItem(UI_STYLE_STORAGE_KEY);
    return raw === 'blueprint' || raw === 'glass' || raw === 'craft' || raw === 'ascii' || raw === 'catalog'
      ? raw
      : DEFAULT_UI_STYLE;
  } catch {
    return DEFAULT_UI_STYLE;
  }
};

export const saveUIStyle = (uiStyle: UIStyle) => {
  try {
    localStorage.setItem(UI_STYLE_STORAGE_KEY, uiStyle);
  } catch {
    /* storage unavailable */
  }
  if (typeof document !== 'undefined' && typeof requestAnimationFrame !== 'undefined') {
    const style = document.createElement('style');
    style.appendChild(document.createTextNode('*,*::before,*::after{transition:none !important}'));
    document.head.appendChild(style);
    applyUIStyle(uiStyle);
    void document.body?.offsetHeight;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => style.remove());
    });
  } else {
    applyUIStyle(uiStyle);
  }
  emitThemeSync();
};

export const loadWorkflowMode = (): WorkflowMode => {
  try {
    const raw = localStorage.getItem(WORKFLOW_MODE_STORAGE_KEY);
    return raw === 'beginner' || raw === 'pro' ? raw : DEFAULT_WORKFLOW_MODE;
  } catch {
    return DEFAULT_WORKFLOW_MODE;
  }
};

export const saveWorkflowMode = (mode: WorkflowMode) => {
  try {
    localStorage.setItem(WORKFLOW_MODE_STORAGE_KEY, mode);
  } catch {
    /* storage unavailable */
  }
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.workflowMode = mode;
  }
  emitThemeSync();
};

export const loadHideTopBar = (): boolean => {
  try {
    const raw = localStorage.getItem(HIDE_TOP_BAR_STORAGE_KEY);
    if (raw === '1') return true;
    if (raw === '0') return false;
    return DEFAULT_HIDE_TOP_BAR;
  } catch {
    return DEFAULT_HIDE_TOP_BAR;
  }
};

export const saveHideTopBar = (hide: boolean) => {
  try {
    localStorage.setItem(HIDE_TOP_BAR_STORAGE_KEY, hide ? '1' : '0');
  } catch {
    /* storage unavailable */
  }
  emitThemeSync();
};

export const applyUIFontScale = (scale: UIFontScale) => {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  html.dataset.fontScale = scale;
  const factor = scale === '115' ? '1.15' : scale === '108' ? '1.08' : '1';
  html.style.setProperty('--gk-font-scale', factor);
  if (scale === '115') {
    html.style.fontSize = '115%';
  } else if (scale === '108') {
    html.style.fontSize = '108%';
  } else {
    html.style.removeProperty('font-size');
  }
};

export const loadUIFontScale = (): UIFontScale => {
  try {
    const raw = localStorage.getItem(UI_FONT_SCALE_STORAGE_KEY);
    return raw === '108' || raw === '115' || raw === '100' ? raw : DEFAULT_UI_FONT_SCALE;
  } catch {
    return DEFAULT_UI_FONT_SCALE;
  }
};

export const saveUIFontScale = (scale: UIFontScale) => {
  try {
    localStorage.setItem(UI_FONT_SCALE_STORAGE_KEY, scale);
  } catch {
    /* storage unavailable */
  }
  applyUIFontScale(scale);
  emitThemeSync();
};

/** Preview swatches for the settings picker: primary / secondary / warm (adapts to desaturated ASCII ramp when in ASCII mode). */
export const themeSwatches = (theme: AccentTheme, uiStyle?: UIStyle): string[] => {
  if (uiStyle === 'ascii') {
    return [
      theme.ascii.accentHex,
      theme.ascii.lightColors[0],
      theme.ascii.lightColors[2],
    ];
  }
  if (uiStyle === 'catalog') {
    return [
      theme.fieldwork.light.acid,
      theme.fieldwork.light.ink,
      theme.fieldwork.light.plate,
    ];
  }
  if (uiStyle === 'craft') {
    return [
      theme.neumorphism.accentHex,
      theme.neumorphism.light.base,
      theme.neumorphism.light.dark,
    ];
  }
  return [
    theme.accentHex,
    PALETTES[theme.map.sky]['500'],
    PALETTES[theme.map.purple]['400'],
  ];
};
