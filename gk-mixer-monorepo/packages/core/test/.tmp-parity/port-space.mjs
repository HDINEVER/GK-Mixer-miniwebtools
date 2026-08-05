// src/utils/color-space.ts
function sRGBToLinear(val) {
  if (val <= 0.04045) {
    return val / 12.92;
  }
  return Math.pow((val + 0.055) / 1.055, 2.4);
}
function linearToSRGB(val) {
  if (val <= 31308e-7) {
    return val * 12.92;
  }
  return 1.055 * Math.pow(val, 1 / 2.4) - 0.055;
}
function adobeRGBToLinear(val) {
  return Math.pow(val, 2.19921875);
}
function linearToAdobeRGB(val) {
  return Math.pow(val, 1 / 2.19921875);
}
var p3ToLinear = sRGBToLinear;
var linearToP3 = linearToSRGB;
var sRGB_to_XYZ = [
  [0.4124564, 0.3575761, 0.1804375],
  [0.2126729, 0.7151522, 0.072175],
  [0.0193339, 0.119192, 0.9503041]
];
var XYZ_to_sRGB = [
  [3.2404542, -1.5371385, -0.4985314],
  [-0.969266, 1.8760108, 0.041556],
  [0.0556434, -0.2040259, 1.0572252]
];
var P3_to_XYZ = [
  [0.4865709, 0.2656677, 0.1982173],
  [0.2289746, 0.6917385, 0.0792869],
  [0, 0.0451134, 1.0439444]
];
var XYZ_to_P3 = [
  [2.4934969, -0.9313836, -0.4027108],
  [-0.829489, 1.7626641, 0.0236247],
  [0.0358458, -0.0761724, 0.9568845]
];
var AdobeRGB_to_XYZ = [
  [0.5767309, 0.185554, 0.1881852],
  [0.2973769, 0.6273491, 0.0752741],
  [0.0270343, 0.0706872, 0.9911085]
];
var XYZ_to_AdobeRGB = [
  [2.041369, -0.5649464, -0.3446944],
  [-0.969266, 1.8760108, 0.041556],
  [0.0134474, -0.1183897, 1.0154096]
];
function matrixMultiply(matrix, rgb) {
  return [
    matrix[0][0] * rgb[0] + matrix[0][1] * rgb[1] + matrix[0][2] * rgb[2],
    matrix[1][0] * rgb[0] + matrix[1][1] * rgb[1] + matrix[1][2] * rgb[2],
    matrix[2][0] * rgb[0] + matrix[2][1] * rgb[1] + matrix[2][2] * rgb[2]
  ];
}
function clamp(val, min = 0, max = 1) {
  return Math.max(min, Math.min(max, val));
}
function convertToWorkingSpace(rgb, sourceSpace) {
  if (sourceSpace === "srgb") {
    return rgb;
  }
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  let linear;
  let xyz;
  if (sourceSpace === "display-p3") {
    linear = [p3ToLinear(r), p3ToLinear(g), p3ToLinear(b)];
    xyz = matrixMultiply(P3_to_XYZ, linear);
    const srgbLinear = matrixMultiply(XYZ_to_sRGB, xyz);
    const srgb = srgbLinear.map((v) => clamp(linearToSRGB(v)));
    return {
      r: Math.round(srgb[0] * 255),
      g: Math.round(srgb[1] * 255),
      b: Math.round(srgb[2] * 255)
    };
  } else if (sourceSpace === "adobe-rgb") {
    linear = [adobeRGBToLinear(r), adobeRGBToLinear(g), adobeRGBToLinear(b)];
    xyz = matrixMultiply(AdobeRGB_to_XYZ, linear);
    const srgbLinear = matrixMultiply(XYZ_to_sRGB, xyz);
    const srgb = srgbLinear.map((v) => clamp(linearToSRGB(v)));
    return {
      r: Math.round(srgb[0] * 255),
      g: Math.round(srgb[1] * 255),
      b: Math.round(srgb[2] * 255)
    };
  }
  return rgb;
}
function convertFromWorkingSpace(rgb, targetSpace) {
  if (targetSpace === "srgb") {
    return rgb;
  }
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const srgbLinear = [sRGBToLinear(r), sRGBToLinear(g), sRGBToLinear(b)];
  const xyz = matrixMultiply(sRGB_to_XYZ, srgbLinear);
  if (targetSpace === "display-p3") {
    const p3Linear = matrixMultiply(XYZ_to_P3, xyz);
    const p3 = p3Linear.map((v) => clamp(linearToP3(v)));
    return {
      r: Math.round(p3[0] * 255),
      g: Math.round(p3[1] * 255),
      b: Math.round(p3[2] * 255)
    };
  } else if (targetSpace === "adobe-rgb") {
    const adobeLinear = matrixMultiply(XYZ_to_AdobeRGB, xyz);
    const adobe = adobeLinear.map((v) => clamp(linearToAdobeRGB(v)));
    return {
      r: Math.round(adobe[0] * 255),
      g: Math.round(adobe[1] * 255),
      b: Math.round(adobe[2] * 255)
    };
  }
  return rgb;
}
function isInGamut(rgb, colorSpace) {
  if (colorSpace === "srgb") return true;
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const srgbLinear = [sRGBToLinear(r), sRGBToLinear(g), sRGBToLinear(b)];
  const xyz = matrixMultiply(sRGB_to_XYZ, srgbLinear);
  let targetLinear;
  if (colorSpace === "display-p3") {
    targetLinear = matrixMultiply(XYZ_to_P3, xyz);
  } else if (colorSpace === "adobe-rgb") {
    targetLinear = matrixMultiply(XYZ_to_AdobeRGB, xyz);
  } else {
    return true;
  }
  const epsilon = 1e-3;
  return targetLinear.every((v) => v >= -epsilon && v <= 1 + epsilon);
}
function getColorSpaceName(space, lang = "zh") {
  const names = {
    srgb: { en: "sRGB", zh: "sRGB (\u6807\u51C6)", ja: "sRGB" },
    "display-p3": { en: "Display P3", zh: "Display P3 (\u5E7F\u8272\u57DF)", ja: "Display P3" },
    "adobe-rgb": { en: "Adobe RGB", zh: "Adobe RGB (1998)", ja: "Adobe RGB" }
  };
  return names[space][lang];
}
function getColorSpaceCoverage(space) {
  const coverage = {
    srgb: "~35%",
    "display-p3": "~45%",
    "adobe-rgb": "~52%"
  };
  return coverage[space];
}
function getColorSpaceDescription(space, lang = "zh") {
  const descriptions = {
    srgb: {
      en: "Standard web color space, compatible with all displays",
      zh: "\u7F51\u9875\u6807\u51C6\u8272\u5F69\u7A7A\u95F4,\u517C\u5BB9\u6240\u6709\u663E\u793A\u5668",
      ja: "Web\u6A19\u6E96\u8272\u7A7A\u9593\u3001\u5168\u30C7\u30A3\u30B9\u30D7\u30EC\u30A4\u5BFE\u5FDC"
    },
    "display-p3": {
      en: "Wide gamut space for modern displays (iPhone, MacBook Pro)",
      zh: "\u73B0\u4EE3\u8BBE\u5907\u5E7F\u8272\u57DF\u7A7A\u95F4 (iPhone, MacBook Pro)",
      ja: "\u73FE\u4EE3\u30C7\u30D0\u30A4\u30B9\u5E83\u8272\u57DF\u7A7A\u9593 (iPhone, MacBook Pro)"
    },
    "adobe-rgb": {
      en: "Professional photography and print color space",
      zh: "\u4E13\u4E1A\u6444\u5F71\u548C\u5370\u5237\u8272\u5F69\u7A7A\u95F4",
      ja: "\u30D7\u30ED\u5199\u771F\u30FB\u5370\u5237\u8272\u7A7A\u9593"
    }
  };
  return descriptions[space][lang];
}
export {
  convertFromWorkingSpace,
  convertToWorkingSpace,
  getColorSpaceCoverage,
  getColorSpaceDescription,
  getColorSpaceName,
  isInGamut
};
