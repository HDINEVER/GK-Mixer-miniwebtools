import { RGB, ColorSpace } from '../types';

/**
 * 色彩空间转换工具
 * 支持 sRGB, Display P3, Adobe RGB (1998) 之间的转换
 * 
 * 转换流程:
 * 任意色彩空间 → 线性 RGB → XYZ (D65) → 线性 RGB → 目标色彩空间
 */

// ==================== Gamma 校正 ====================

// sRGB gamma 编码/解码
function sRGBToLinear(val: number): number {
  if (val <= 0.04045) {
    return val / 12.92;
  }
  return Math.pow((val + 0.055) / 1.055, 2.4);
}

function linearToSRGB(val: number): number {
  if (val <= 0.0031308) {
    return val * 12.92;
  }
  return 1.055 * Math.pow(val, 1 / 2.4) - 0.055;
}

// Adobe RGB gamma 编码/解码 (简单的 2.2 gamma)
function adobeRGBToLinear(val: number): number {
  return Math.pow(val, 2.19921875); // Adobe RGB gamma = 563/256 ≈ 2.2
}

function linearToAdobeRGB(val: number): number {
  return Math.pow(val, 1 / 2.19921875);
}

// Display P3 使用 sRGB 的 gamma 曲线
const p3ToLinear = sRGBToLinear;
const linearToP3 = linearToSRGB;

// ==================== 色彩空间转换矩阵 ====================

// sRGB → XYZ (D65)
const sRGB_to_XYZ = [
  [0.4124564, 0.3575761, 0.1804375],
  [0.2126729, 0.7151522, 0.0721750],
  [0.0193339, 0.1191920, 0.9503041]
];

// XYZ (D65) → sRGB
const XYZ_to_sRGB = [
  [3.2404542, -1.5371385, -0.4985314],
  [-0.9692660, 1.8760108, 0.0415560],
  [0.0556434, -0.2040259, 1.0572252]
];

// Display P3 → XYZ (D65)
const P3_to_XYZ = [
  [0.4865709, 0.2656677, 0.1982173],
  [0.2289746, 0.6917385, 0.0792869],
  [0.0000000, 0.0451134, 1.0439444]
];

// XYZ (D65) → Display P3
const XYZ_to_P3 = [
  [2.4934969, -0.9313836, -0.4027108],
  [-0.8294890, 1.7626641, 0.0236247],
  [0.0358458, -0.0761724, 0.9568845]
];

// Adobe RGB (1998) → XYZ (D65)
const AdobeRGB_to_XYZ = [
  [0.5767309, 0.1855540, 0.1881852],
  [0.2973769, 0.6273491, 0.0752741],
  [0.0270343, 0.0706872, 0.9911085]
];

// XYZ (D65) → Adobe RGB (1998)
const XYZ_to_AdobeRGB = [
  [2.0413690, -0.5649464, -0.3446944],
  [-0.9692660, 1.8760108, 0.0415560],
  [0.0134474, -0.1183897, 1.0154096]
];

// ==================== 矩阵运算 ====================

function matrixMultiply(matrix: number[][], rgb: number[]): number[] {
  return [
    matrix[0][0] * rgb[0] + matrix[0][1] * rgb[1] + matrix[0][2] * rgb[2],
    matrix[1][0] * rgb[0] + matrix[1][1] * rgb[1] + matrix[1][2] * rgb[2],
    matrix[2][0] * rgb[0] + matrix[2][1] * rgb[1] + matrix[2][2] * rgb[2]
  ];
}

function clamp(val: number, min: number = 0, max: number = 1): number {
  return Math.max(min, Math.min(max, val));
}

// ==================== 核心转换函数 ====================

/**
 * 将 RGB 值从源色彩空间转换到 sRGB 工作空间
 * (所有算法都在 sRGB 空间工作)
 */
export function convertToWorkingSpace(rgb: RGB, sourceSpace: ColorSpace): RGB {
  if (sourceSpace === 'srgb') {
    return rgb; // 已经是工作空间,无需转换
  }

  // 归一化到 0-1
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  let linear: number[];
  let xyz: number[];

  if (sourceSpace === 'display-p3') {
    // P3 → 线性 → XYZ → sRGB
    linear = [p3ToLinear(r), p3ToLinear(g), p3ToLinear(b)];
    xyz = matrixMultiply(P3_to_XYZ, linear);
    const srgbLinear = matrixMultiply(XYZ_to_sRGB, xyz);
    const srgb = srgbLinear.map(v => clamp(linearToSRGB(v)));
    
    return {
      r: Math.round(srgb[0] * 255),
      g: Math.round(srgb[1] * 255),
      b: Math.round(srgb[2] * 255)
    };
  } else if (sourceSpace === 'adobe-rgb') {
    // Adobe RGB → 线性 → XYZ → sRGB
    linear = [adobeRGBToLinear(r), adobeRGBToLinear(g), adobeRGBToLinear(b)];
    xyz = matrixMultiply(AdobeRGB_to_XYZ, linear);
    const srgbLinear = matrixMultiply(XYZ_to_sRGB, xyz);
    const srgb = srgbLinear.map(v => clamp(linearToSRGB(v)));
    
    return {
      r: Math.round(srgb[0] * 255),
      g: Math.round(srgb[1] * 255),
      b: Math.round(srgb[2] * 255)
    };
  }

  return rgb;
}

/**
 * 将 sRGB 工作空间的颜色转换到目标色彩空间
 */
export function convertFromWorkingSpace(rgb: RGB, targetSpace: ColorSpace): RGB {
  if (targetSpace === 'srgb') {
    return rgb; // 已经是目标空间
  }

  // 归一化到 0-1
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  // sRGB → 线性
  const srgbLinear = [sRGBToLinear(r), sRGBToLinear(g), sRGBToLinear(b)];
  
  // sRGB 线性 → XYZ
  const xyz = matrixMultiply(sRGB_to_XYZ, srgbLinear);

  if (targetSpace === 'display-p3') {
    // XYZ → P3 线性 → P3
    const p3Linear = matrixMultiply(XYZ_to_P3, xyz);
    const p3 = p3Linear.map(v => clamp(linearToP3(v)));
    
    return {
      r: Math.round(p3[0] * 255),
      g: Math.round(p3[1] * 255),
      b: Math.round(p3[2] * 255)
    };
  } else if (targetSpace === 'adobe-rgb') {
    // XYZ → Adobe RGB 线性 → Adobe RGB
    const adobeLinear = matrixMultiply(XYZ_to_AdobeRGB, xyz);
    const adobe = adobeLinear.map(v => clamp(linearToAdobeRGB(v)));
    
    return {
      r: Math.round(adobe[0] * 255),
      g: Math.round(adobe[1] * 255),
      b: Math.round(adobe[2] * 255)
    };
  }

  return rgb;
}

/**
 * 检测颜色是否在目标色域内
 * 返回 true 表示在色域内,false 表示超出色域(会被裁切)
 */
export function isInGamut(rgb: RGB, colorSpace: ColorSpace): boolean {
  // sRGB 始终在色域内(因为是工作空间)
  if (colorSpace === 'srgb') return true;

  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  // 转换到线性空间
  const srgbLinear = [sRGBToLinear(r), sRGBToLinear(g), sRGBToLinear(b)];
  const xyz = matrixMultiply(sRGB_to_XYZ, srgbLinear);

  let targetLinear: number[];
  
  if (colorSpace === 'display-p3') {
    targetLinear = matrixMultiply(XYZ_to_P3, xyz);
  } else if (colorSpace === 'adobe-rgb') {
    targetLinear = matrixMultiply(XYZ_to_AdobeRGB, xyz);
  } else {
    return true;
  }

  // 检查是否所有分量都在 [0, 1] 范围内(未被裁切)
  const epsilon = 0.001; // 容差
  return targetLinear.every(v => v >= -epsilon && v <= 1 + epsilon);
}

/**
 * 获取色彩空间的显示名称
 */
export function getColorSpaceName(space: ColorSpace, lang: 'en' | 'zh' | 'ja' = 'zh'): string {
  const names = {
    'srgb': {
      en: 'sRGB',
      zh: 'sRGB (标准)',
      ja: 'sRGB'
    },
    'display-p3': {
      en: 'Display P3',
      zh: 'Display P3 (广色域)',
      ja: 'Display P3'
    },
    'adobe-rgb': {
      en: 'Adobe RGB',
      zh: 'Adobe RGB (1998)',
      ja: 'Adobe RGB'
    }
  };
  
  return names[space][lang];
}

/**
 * 获取色彩空间的色域覆盖率(相对于 CIE 1931)
 */
export function getColorSpaceCoverage(space: ColorSpace): string {
  const coverage = {
    'srgb': '~35%',
    'display-p3': '~45%',
    'adobe-rgb': '~52%'
  };
  return coverage[space];
}

/**
 * 获取色彩空间描述
 */
export function getColorSpaceDescription(space: ColorSpace, lang: 'en' | 'zh' | 'ja' = 'zh'): string {
  const descriptions = {
    'srgb': {
      en: 'Standard web color space, compatible with all displays',
      zh: '网页标准色彩空间,兼容所有显示器',
      ja: 'Web標準色空間、全ディスプレイ対応'
    },
    'display-p3': {
      en: 'Wide gamut space for modern displays (iPhone, MacBook Pro)',
      zh: '现代设备广色域空间 (iPhone, MacBook Pro)',
      ja: '現代デバイス広色域空間 (iPhone, MacBook Pro)'
    },
    'adobe-rgb': {
      en: 'Professional photography and print color space',
      zh: '专业摄影和印刷色彩空间',
      ja: 'プロ写真・印刷色空間'
    }
  };
  
  return descriptions[space][lang];
}
