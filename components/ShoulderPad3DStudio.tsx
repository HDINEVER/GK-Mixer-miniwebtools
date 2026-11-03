import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  SlidersHorizontal as SlidersHorizontalIcon,
  Target as TargetIcon,
  ArrowsCounterClockwise as ArrowsCounterClockwiseIcon,
  Copy as CopyIcon,
  DownloadSimple as DownloadSimpleIcon,
  UploadSimple as UploadSimpleIcon,
  Camera as CameraIcon,
  Check as CheckIcon,
  Palette as PaletteIcon,
  Code as CodeIcon,
  CaretDown as CaretDownIcon,
  CaretUp as CaretUpIcon,
  Sparkle as SparkleIcon,
  Cube as CubeIcon,
} from "@phosphor-icons/react";

// ============================================================================
// 1. OpenSCAD Parametric Space Marine Pauldron Definition (1:1 Mathematical Port)
// ============================================================================

export interface PauldronScadParams {
  renderMode: "all" | "blue_only" | "gold_only";
  meshResolution: number;
  width: number;
  depth: number;
  height: number;
  domeRatio: number;
  bottomFlare: number;
  archCutOffset: number;
  shellThickness: number;
  trimRelief: number;
  bottomTrimWidth: number;
  sideTrimWidth: number;
  bottomTiltAngle: number;
  // OpenSCAD 物理凹坑与利刃劈砍豁口布尔几何参数
  battleDamageEnabled: boolean;
  damageCount: number; // 1 .. 6 处物理弹坑与劈砍豁口
  damageDepth: number; // 0.20 .. 1.0 物理切削深度倍率
  damageSeed: number;  // 1 .. 100 战损空间分布随机种子
}

export const DEFAULT_PAULDRON_SCAD_PARAMS: PauldronScadParams = {
  renderMode: "all",
  meshResolution: 136,
  width: 44,
  depth: 40,
  height: 40,
  domeRatio: 0.62,
  bottomFlare: 1.08,
  archCutOffset: 3.5,
  shellThickness: 2.8,
  trimRelief: 1.2,
  bottomTrimWidth: 5.0,
  sideTrimWidth: 4.2,
  bottomTiltAngle: 6,
  battleDamageEnabled: false,
  damageCount: 2,
  damageDepth: 0.62,
  damageSeed: 18,
};

export interface PartColorRampConfig {
  shadowDeepHex: string; // -18%L ~ -26%L (slate/indigo deep shadow)
  shadowHex: string;     // -10%L ~ -16%L (mid shadow)
  baseHex: string;       // 0%L (main armor color)
  highlightHex: string;  // +12%L ~ +18%L (volumetric ice/warm highlight)
  specularHex: string;   // +24%L ~ +32%L (extreme edge & crown catch-light)
  brandLabel?: string;
  paintName?: string;
}

export interface BlenderShaderParams {
  rampStyle: "eavy-metal" | "stipple" | "stepped" | "airbrush" | "nmm";
  colorSteps: 3 | 5;
  naturalWarmCoolShift: boolean;
  clearcoatMode: "matte" | "satin" | "gloss";
  shadowStop: number;            // 0.15 .. 0.45
  highlightStop: number;         // 0.55 .. 0.85
  aoStrength: number;            // 0.0 .. 1.0
  edgeHighlightStrength: number; // 0.0 .. 1.0
  zenithalFocus: number;         // 0.0 .. 1.0 (dome volumetric spotlight focus)
  brushStipple: number;          // 0.0 .. 1.0 (Screenshot 3 hand-painted stipple/glaze texture)
  lightAzimuthDeg: number;       // -180 .. 180
  lightElevationDeg: number;     // 10 .. 85
  sprayGuideMode: boolean;       // Novice God-Tier Feature: 🎯 喷涂区域向导开关
  // 6 项可开关的高光特化与战损旧化渲染层
  edgeLineEnabled: boolean;      // 1. 模型边缘高光描线 (双阶刀锋描边+尖角亮白点)
  whiteHotspotEnabled: boolean;  // 2. 曲面高光白色圆点 (凸面中心纯白聚光圆核)
  grimeStainEnabled: boolean;    // 3. 旧化污渍 (凹槽油污渗渍 + 装甲表面局部斑块流痕)
  metalChippingEnabled: boolean; // 4. 掉漆露铁 (双层海绵掉漆：黑褐底漆圈+寒铁银金属底)
  scratchesEnabled: boolean;     // 5. 利刃划痕 (锐利刀剑/流弹亮银划痕+高光托边)
  dentDamageEnabled: boolean;    // 6. 实体凹损 (联动 OpenSCAD 物理弹坑凹陷与刀砍豁口)
  // 各特效独立子控件参数（默认克制稀疏，拒绝密集杂乱）
  hotspotSize: number;           // 0.15 .. 1.0 曲面白色高光圆点半径 (默认 0.56)
  grimeDensity: number;          // 0.05 .. 1.0 污渍分布面积密度 (默认 0.25 稀疏自然)
  grimeStrength: number;         // 0.10 .. 1.0 凹槽渗渍与污渍浓度 (默认 0.52)
  chipDensity: number;           // 0.05 .. 1.0 掉漆分布密度 (默认 0.22 仅棱角局部)
  chipScale: number;             // 0.20 .. 1.0 掉漆斑块颗粒尺寸 (默认 0.48)
  scratchDensity: number;        // 0.05 .. 1.0 划痕条数密度 (默认 0.20 仅2~4道清晰划痕)
  scratchScale: number;          // 0.20 .. 1.0 划痕长度与粗细 (默认 0.50)
  weatheringSeed: number;        // 1 .. 100 战损与旧化随机种子 (可随时换一批位置)
  weatheringIntensity: number;   // 0.10 .. 1.0 全局倍率
}

export const DEFAULT_BLENDER_SHADER_PARAMS: BlenderShaderParams = {
  rampStyle: "stipple",
  colorSteps: 5,
  naturalWarmCoolShift: true,
  clearcoatMode: "satin",
  shadowStop: 0.31,
  highlightStop: 0.64,
  aoStrength: 0.86,
  edgeHighlightStrength: 0.85,
  zenithalFocus: 0.74,
  brushStipple: 0.68,
  lightAzimuthDeg: 28,
  lightElevationDeg: 46,
  sprayGuideMode: false,
  edgeLineEnabled: true,
  whiteHotspotEnabled: true,
  grimeStainEnabled: false,
  metalChippingEnabled: false,
  scratchesEnabled: false,
  dentDamageEnabled: false,
  hotspotSize: 0.56,
  grimeDensity: 0.25,
  grimeStrength: 0.52,
  chipDensity: 0.22,
  chipScale: 0.48,
  scratchDensity: 0.20,
  scratchScale: 0.50,
  weatheringSeed: 18,
  weatheringIntensity: 0.55,
};

export interface WarhammerChapterPreset {
  id: string;
  name: string;
  archetypeNote: string;
  styleTag: string;
  blueHex: string;
  goldHex: string;
  rampStyle: BlenderShaderParams["rampStyle"];
  stipple: number;
  clearcoat: BlenderShaderParams["clearcoatMode"];
  edgeStrength: number;
  aoStrength: number;
  zenithalFocus: number;
  blueRampOverride?: PartColorRampConfig;
  goldRampOverride?: PartColorRampConfig;
  recipeSummary: string;
}

// 无版权风险的经典星际重甲军团色阶预设（保留标志性军团番号与配色特征，去除外部跳转与商标直引）
export const CHAPTER_PAINT_PRESETS: WarhammerChapterPreset[] = [
  {
    id: "ref_stipple_blue",
    name: "✨ 冰蓝体积光 · 手涂点拍示范",
    archetypeNote: "天顶聚光圆核 + 冰青点拍过渡",
    styleTag: "Volumetric Stipple",
    blueHex: "#2B6CB0",
    goldHex: "#334155",
    rampStyle: "stipple",
    stipple: 0.72,
    clearcoat: "satin",
    edgeStrength: 0.82,
    aoStrength: 0.88,
    zenithalFocus: 0.76,
    blueRampOverride: {
      shadowDeepHex: "#0F1E3D",
      shadowHex: "#1B3B73",
      baseHex: "#2B6CB0",
      highlightHex: "#5BC0EB",
      specularHex: "#D4F5FF",
    },
    goldRampOverride: {
      shadowDeepHex: "#0B0F19",
      shadowHex: "#1E293B",
      baseHex: "#334155",
      highlightHex: "#64748B",
      specularHex: "#CBD5E1",
    },
    recipeSummary: "深靛蓝打底 ➔ 钴蓝层涂 ➔ 冰青密集点拍 (Stippling) ➔ 凸面中心钛白高光圆点",
  },
  {
    id: "ultramarines_eavy",
    name: "🏛️ 第XIII圣典军团 · 钴蓝金框",
    archetypeNote: "罗马圣典主力军团经典蓝金",
    styleTag: "Box-Art 双阶描边",
    blueHex: "#183884",
    goldHex: "#C59B27",
    rampStyle: "eavy-metal",
    stipple: 0.12,
    clearcoat: "satin",
    edgeStrength: 0.94,
    aoStrength: 0.92,
    zenithalFocus: 0.52,
    blueRampOverride: {
      shadowDeepHex: "#071126",
      shadowHex: "#10255A",
      baseHex: "#183884",
      highlightHex: "#4277C2",
      specularHex: "#9CC2DE",
    },
    goldRampOverride: {
      shadowDeepHex: "#2E120B",
      shadowHex: "#7A3E18",
      baseHex: "#C59B27",
      highlightHex: "#E2C36B",
      specularHex: "#F1F5F9",
    },
    recipeSummary: "底涂: 皇家钴蓝 ➔ 凹槽暗线: 深海夜蓝+黑 ➔ 一阶粗描边: 天青蓝 ➔ 二阶刀锋与尖角: 极地灰蓝",
  },
  {
    id: "blood_angels_eavy",
    name: "🩸 第IX绯红圣翼 · 鲜红金框",
    archetypeNote: "猩红天使突击军团经典红金",
    styleTag: "Box-Art 暖橙提亮",
    blueHex: "#A8181E",
    goldHex: "#C59B27",
    rampStyle: "eavy-metal",
    stipple: 0.14,
    clearcoat: "satin",
    edgeStrength: 0.92,
    aoStrength: 0.90,
    zenithalFocus: 0.56,
    blueRampOverride: {
      shadowDeepHex: "#260508",
      shadowHex: "#690C12",
      baseHex: "#A8181E",
      highlightHex: "#F06423",
      specularHex: "#F5D2A2",
    },
    goldRampOverride: {
      shadowDeepHex: "#2E120B",
      shadowHex: "#7A3E18",
      baseHex: "#C59B27",
      highlightHex: "#E2C36B",
      specularHex: "#F1F5F9",
    },
    recipeSummary: "底涂: 猩红主色 ➔ 暗槽: 深酒红+黑 ➔ 一阶粗描边: 烈阳朱红 ➔ 二阶刀锋: 暖橘黄 ➔ 尖角: 浅赭白",
  },
  {
    id: "dark_angels_eavy",
    name: "🗡️ 第I深林骑士团 · 墨绿骨金",
    archetypeNote: "初代森林秘密骑士深绿重甲",
    styleTag: "Box-Art 翠绿刀锋",
    blueHex: "#063E21",
    goldHex: "#C9B88C",
    rampStyle: "eavy-metal",
    stipple: 0.15,
    clearcoat: "satin",
    edgeStrength: 0.95,
    aoStrength: 0.92,
    zenithalFocus: 0.54,
    blueRampOverride: {
      shadowDeepHex: "#02140A",
      shadowHex: "#042815",
      baseHex: "#063E21",
      highlightHex: "#1E7836",
      specularHex: "#82D159",
    },
    goldRampOverride: {
      shadowDeepHex: "#3E2114",
      shadowHex: "#87663A",
      baseHex: "#C9B88C",
      highlightHex: "#E6DEC3",
      specularHex: "#FFFFFF",
    },
    recipeSummary: "底涂: 森林墨绿 ➔ 暗线: 墨绿+黑 ➔ 一阶粗描边: 宝石翠绿 ➔ 二阶刀锋: 嫩叶黄绿 ➔ 尖角: 象牙骨白",
  },
  {
    id: "imperial_fists_eavy",
    name: "🏰 第VII圣城禁卫 · 暖黄黑铁",
    archetypeNote: "泰拉壁垒守卫军团高饱和黄黑",
    styleTag: "暖褐罩染+亮黄棱",
    blueHex: "#E5A118",
    goldHex: "#1E2229",
    rampStyle: "eavy-metal",
    stipple: 0.16,
    clearcoat: "satin",
    edgeStrength: 0.90,
    aoStrength: 0.92,
    zenithalFocus: 0.60,
    blueRampOverride: {
      shadowDeepHex: "#591614",
      shadowHex: "#9E5127",
      baseHex: "#E5A118",
      highlightHex: "#FFF300",
      specularHex: "#FFF9A6",
    },
    goldRampOverride: {
      shadowDeepHex: "#090B0E",
      shadowHex: "#14181F",
      baseHex: "#1E2229",
      highlightHex: "#4E6370",
      specularHex: "#A3B8C2",
    },
    recipeSummary: "底涂: 落日暖黄 ➔ 柔暗罩染: 暖赭褐 ➔ 深凹槽: 焦红褐 ➔ 一阶粗描边: 柠檬亮黄 ➔ 尖角: 奶油浅黄",
  },
  {
    id: "black_templars_eavy",
    name: "✝️ 远征十字军团 · 冷青黑甲",
    archetypeNote: "永恒远征骑士黑甲与冷青描边",
    styleTag: "Cold Black 刀锋",
    blueHex: "#141920",
    goldHex: "#EDEAE2",
    rampStyle: "eavy-metal",
    stipple: 0.18,
    clearcoat: "satin",
    edgeStrength: 0.96,
    aoStrength: 0.90,
    zenithalFocus: 0.50,
    blueRampOverride: {
      shadowDeepHex: "#05070A",
      shadowHex: "#0D131A",
      baseHex: "#141920",
      highlightHex: "#23536D",
      specularHex: "#A8C0C9",
    },
    goldRampOverride: {
      shadowDeepHex: "#3D352E",
      shadowHex: "#8C857B",
      baseHex: "#EDEAE2",
      highlightHex: "#F7F6F2",
      specularHex: "#FFFFFF",
    },
    recipeSummary: "底涂: 煤玉冷黑 ➔ 一阶粗描边: 寒铁暗青蓝 ➔ 二阶刀锋边: 冷云灰蓝 ➔ 折角高光点: 纯白",
  },
  {
    id: "space_wolves_eavy",
    name: "🐺 第VI凛冬狼卫 · 极地灰蓝",
    archetypeNote: "北境冰原猎手灰蓝重甲与暖金",
    styleTag: "极地冷灰蓝",
    blueHex: "#54758C",
    goldHex: "#D49B28",
    rampStyle: "eavy-metal",
    stipple: 0.22,
    clearcoat: "satin",
    edgeStrength: 0.90,
    aoStrength: 0.90,
    zenithalFocus: 0.58,
    blueRampOverride: {
      shadowDeepHex: "#261E29",
      shadowHex: "#3C5266",
      baseHex: "#54758C",
      highlightHex: "#7DA6C4",
      specularHex: "#D8EAF6",
    },
    goldRampOverride: {
      shadowDeepHex: "#2E120B",
      shadowHex: "#7A3E18",
      baseHex: "#C59B27",
      highlightHex: "#E2C36B",
      specularHex: "#F1F5F9",
    },
    recipeSummary: "底涂: 冻原狼灰蓝 ➔ 深凹槽: 暗蓝灰+深褐 1:1 ➔ 一阶粗描边: 冰川浅灰蓝 ➔ 二阶刀锋: 极光冰白",
  },
  {
    id: "deathwing_bone",
    name: "💀 重装终结老兵 · 象牙骨白",
    archetypeNote: "第一连重装老兵暖白骨甲与深绿",
    styleTag: "Warm Bone 旧化",
    blueHex: "#D9D0B4",
    goldHex: "#1E5C32",
    rampStyle: "stipple",
    stipple: 0.42,
    clearcoat: "matte",
    edgeStrength: 0.86,
    aoStrength: 0.92,
    zenithalFocus: 0.62,
    blueRampOverride: {
      shadowDeepHex: "#4A2618",
      shadowHex: "#A88854",
      baseHex: "#D9D0B4",
      highlightHex: "#EFEAD8",
      specularHex: "#FFFFFF",
    },
    goldRampOverride: {
      shadowDeepHex: "#04210E",
      shadowHex: "#0B3D1C",
      baseHex: "#1E5C32",
      highlightHex: "#4BA851",
      specularHex: "#B5E892",
    },
    recipeSummary: "底涂: 陈年象牙白 ➔ 柔暗部: 暖黄土罩染 ➔ 深凹槽: 焦皮褐渗线 ➔ 棱边提亮: 象牙白+纯白",
  },
  {
    id: "salamanders_eavy",
    name: "🔥 第XVIII熔炉龙卫 · 翡翠碧绿",
    archetypeNote: "火山锻造军团高彩翠绿与暖金",
    styleTag: "Luminous 翠绿",
    blueHex: "#1E7836",
    goldHex: "#C59B27",
    rampStyle: "eavy-metal",
    stipple: 0.18,
    clearcoat: "satin",
    edgeStrength: 0.92,
    aoStrength: 0.90,
    zenithalFocus: 0.58,
    blueRampOverride: {
      shadowDeepHex: "#071F0E",
      shadowHex: "#144222",
      baseHex: "#1E7836",
      highlightHex: "#48AD44",
      specularHex: "#C7EB88",
    },
    goldRampOverride: {
      shadowDeepHex: "#2E120B",
      shadowHex: "#7A3E18",
      baseHex: "#C59B27",
      highlightHex: "#E2C36B",
      specularHex: "#F1F5F9",
    },
    recipeSummary: "底涂: 翡翠主色 ➔ 柔暗部: 翠绿+深褐 ➔ 深凹槽: 墨绿+黑 ➔ 粗描边: 鲜草绿 ➔ 尖角: 浅黄绿",
  },
];

// ============================================================================
// Color Math Helpers for 3-Step / 5-Step Volumetric ColorRamp Derivation
// ============================================================================

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function hexToRgb01(hex: string): [number, number, number] {
  const clean = (hex || "#2B6CB0").replace(/^#/, "").trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) / 255;
    const g = parseInt(clean[1] + clean[1], 16) / 255;
    const b = parseInt(clean[2] + clean[2], 16) / 255;
    return [r || 0, g || 0, b || 0];
  }
  const num = parseInt(clean.slice(0, 6), 16);
  if (Number.isNaN(num)) return [0.17, 0.42, 0.69];
  return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
}

function rgb01ToHex(r: number, g: number, b: number): string {
  const toByte = (c: number) => clamp(Math.round(c * 255), 0, 255).toString(16).padStart(2, "0");
  return `#${toByte(r)}${toByte(g)}${toByte(b)}`.toUpperCase();
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
}

function hslToRgb(hDeg: number, sPct: number, lPct: number): [number, number, number] {
  const h = (((hDeg % 360) + 360) % 360) / 360;
  const s = clamp(sPct, 0, 100) / 100;
  const l = clamp(lPct, 0, 100) / 100;
  if (s === 0) return [l, l, l];
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue2rgb(p, q, h + 1 / 3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1 / 3)];
}

/**
 * Derives a 5-stop miniature painting ColorRamp from any base paint hex.
 * Tuned against Screenshot 3 reference:
 * - Deep shadows desaturate slightly into grounded slate-navy/indigo (like dark primer shadow).
 * - Highlights shift toward luminous ice-cyan (for blues) or warm ivory-gold (for warm colors).
 */
export function deriveMiniatureColorRamp(
  baseHex: string,
  naturalWarmCoolShift = true,
  customShadeHex?: string,
  customHighlightHex?: string
): PartColorRampConfig {
  const [r, g, b] = hexToRgb01(baseHex);
  const [h, s, l] = rgbToHsl(r, g, b);

  const shiftHueToward = (currH: number, targetH: number, amount: number) => {
    const diff = ((targetH - currH + 540) % 360) - 180;
    return (currH + diff * amount + 360) % 360;
  };

  const isBlueFamily = h >= 180 && h <= 265;
  // Blues shift toward luminous ice-cyan (194 deg) in highlights and slate-indigo (232 deg) in deep shadows
  const highlightTargetHue = isBlueFamily ? 194 : 50;
  const shadowTargetHue = isBlueFamily ? 228 : 258;

  const hDeep = naturalWarmCoolShift ? shiftHueToward(h, shadowTargetHue, 0.24) : h;
  const hShade = naturalWarmCoolShift ? shiftHueToward(h, shadowTargetHue, 0.14) : h;
  const hHigh = naturalWarmCoolShift ? shiftHueToward(h, highlightTargetHue, 0.28) : h;
  const hSpec = naturalWarmCoolShift ? shiftHueToward(h, highlightTargetHue, 0.42) : h;

  const lDeep = clamp(l - 25, 6, 32);
  const lShade = clamp(l - 13, 10, 48);
  const lHigh = clamp(l + 16, 42, 85);
  const lSpec = clamp(l + 31, 64, 94);

  // Grounded slate-indigo shadow (slightly lower saturation in deepest recess like Screenshot 3's dark primer)
  const sDeep = clamp(isBlueFamily ? s * 0.72 : s + (naturalWarmCoolShift ? 4 : 0), 12, 82);
  const sShade = clamp(isBlueFamily ? s * 0.92 : s + (naturalWarmCoolShift ? 5 : 0), 14, 92);
  // Luminous cyan-blue volumetric highlight
  const sHigh = clamp(s + (isBlueFamily ? 18 : -2), 16, 98);
  const sSpec = clamp(isBlueFamily ? s + 6 : s - 12, 18, 92);

  const shadowDeepHex = rgb01ToHex(...hslToRgb(hDeep, sDeep, lDeep));
  const shadowHex = customShadeHex || rgb01ToHex(...hslToRgb(hShade, sShade, lShade));
  const highlightHex = customHighlightHex || rgb01ToHex(...hslToRgb(hHigh, sHigh, lHigh));
  const specularHex = rgb01ToHex(...hslToRgb(hSpec, sSpec, lSpec));

  return {
    shadowDeepHex,
    shadowHex,
    baseHex: baseHex.toUpperCase(),
    highlightHex,
    specularHex,
  };
}

// ============================================================================
// 2. Watertight Analytical OpenSCAD `hull()` + Exact Cut-Wall Mesh Builder
// ============================================================================

interface ScadVertex {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  ao: number;
  curvature: number;
  damage: number; // 0 = intact, 0.15..0.36 = raised paint lip, 0.36..0.68 = dark primer wall, 0.68..1.0 = bare steel floor
}

function lerpVertex(a: ScadVertex, b: ScadVertex, t: number): ScadVertex {
  const nx = a.nx + (b.nx - a.nx) * t;
  const ny = a.ny + (b.ny - a.ny) * t;
  const nz = a.nz + (b.nz - a.nz) * t;
  const len = Math.hypot(nx, ny, nz) || 1;
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
    nx: nx / len,
    ny: ny / len,
    nz: nz / len,
    ao: a.ao + (b.ao - a.ao) * t,
    curvature: a.curvature + (b.curvature - a.curvature) * t,
    damage: a.damage + (b.damage - a.damage) * t,
  };
}

/**
 * Clips a convex polygon against a half-space evalFn(v) >= 0 (Sutherland-Hodgman).
 */
function clipPolygonByPlane(poly: ScadVertex[], evalFn: (v: ScadVertex) => number): ScadVertex[] {
  if (poly.length < 3) return [];
  const out: ScadVertex[] = [];
  const n = poly.length;

  for (let i = 0; i < n; i++) {
    const curr = poly[i];
    const prev = poly[(i + n - 1) % n];
    const dCurr = evalFn(curr);
    const dPrev = evalFn(prev);

    const currIn = dCurr >= 0;
    const prevIn = dPrev >= 0;

    if (currIn !== prevIn) {
      const denom = dPrev - dCurr;
      const t = Math.abs(denom) > 1e-9 ? clamp(dPrev / denom, 0, 1) : 0.5;
      out.push(lerpVertex(prev, curr, t));
    }
    if (currIn) {
      out.push(curr);
    }
  }
  return out;
}

interface ShellEvaluator {
  a: number;
  b: number;
  zMin: number;
  zMax: number;
  evalAtVTheta: (v: number, theta: number) => {
    x: number;
    y: number;
    z: number;
    nx: number;
    ny: number;
    nz: number;
    r: number;
  };
  evalRadiusAtZ: (zWorld: number) => { r: number; drdz: number };
}

/**
 * Builds an exact analytical evaluator for OpenSCAD's `base_solid(w, d, h, ratio, flare)`
 * with optional world Z shift `zOffset` (used by `inner_cavity` which translates by `[0, 0, -1]`).
 */
function makeShellEvaluator(
  w: number,
  d: number,
  h: number,
  ratio: number,
  flare: number,
  zOffset = 0
): ShellEvaluator {
  const a = Math.max(1, w / 2);
  const b = Math.max(1, d / 2);
  const domeH = Math.max(1, h * ratio);
  const skirtH = h * (1 - ratio);
  const zBotLocal = -h * 0.18;

  // Exact tangency latitude u_t in [0, 1) between upper ellipsoid and lower flared disk
  const K = (skirtH - zBotLocal) / domeH;
  const f = Math.max(1.0, flare);
  const disc = Math.max(0, K * K + f * f - 1);
  const ut = clamp((f * Math.sqrt(disc) - K) / (K * K + f * f), 0, 0.92);
  const psiT = Math.asin(ut);
  const zTLocal = skirtH + domeH * ut;
  const rT = Math.cos(psiT);
  const drdzSkirt = (rT - f) / Math.max(1e-4, zTLocal - zBotLocal);
  const vSplit = 0.28;

  const evalRadiusAtZ = (zWorld: number): { r: number; drdz: number } => {
    const zLocal = zWorld - zOffset;
    if (zLocal <= zTLocal) {
      const tv = clamp((zLocal - zBotLocal) / Math.max(1e-5, zTLocal - zBotLocal), 0, 1);
      return {
        r: f + tv * (rT - f),
        drdz: drdzSkirt,
      };
    }
    const u = clamp((zLocal - skirtH) / domeH, 0, 1);
    const r = Math.sqrt(Math.max(0, 1 - u * u));
    const drdz = -u / (domeH * Math.max(1e-4, r));
    return { r, drdz };
  };

  const evalAtVTheta = (v: number, theta: number) => {
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);

    let r: number;
    let zLocal: number;
    let nxUn: number;
    let nyUn: number;
    let nzUn: number;

    if (v <= vSplit) {
      const tv = vSplit > 0 ? v / vSplit : 0;
      zLocal = zBotLocal + tv * (zTLocal - zBotLocal);
      r = f + tv * (rT - f);
      nxUn = cosT / a;
      nyUn = sinT / b;
      nzUn = -drdzSkirt;
    } else {
      const td = (v - vSplit) / (1 - vSplit);
      const psi = psiT + td * (Math.PI / 2 - psiT);
      const cosPsi = Math.cos(psi);
      const sinPsi = Math.sin(psi);
      r = cosPsi;
      zLocal = skirtH + domeH * sinPsi;
      nxUn = (cosPsi * cosT) / a;
      nyUn = (cosPsi * sinT) / b;
      nzUn = sinPsi / domeH;
    }

    const nLen = Math.hypot(nxUn, nyUn, nzUn) || 1;
    return {
      x: a * r * cosT,
      y: b * r * sinT,
      z: zLocal + zOffset,
      nx: nxUn / nLen,
      ny: nyUn / nLen,
      nz: nzUn / nLen,
      r,
    };
  };

  return {
    a,
    b,
    zMin: zBotLocal + zOffset,
    zMax: h + zOffset,
    evalAtVTheta,
    evalRadiusAtZ,
  };
}

function scadToThreePos(x: number, y: number, z: number, hCenter: number): [number, number, number] {
  return [x, z - hCenter, -y];
}

function scadToThreeNormal(nx: number, ny: number, nz: number): [number, number, number] {
  return [nx, nz, -ny];
}

export function buildSpaceMarinePauldronGeometries(params: PauldronScadParams): {
  blueGeometry: THREE.BufferGeometry;
  goldGeometry: THREE.BufferGeometry;
} {
  const {
    renderMode,
    meshResolution,
    width,
    depth,
    height,
    domeRatio,
    bottomFlare,
    archCutOffset,
    shellThickness,
    trimRelief,
    bottomTrimWidth,
    sideTrimWidth,
    bottomTiltAngle,
  } = params;

  const nTheta = clamp(Math.round(meshResolution), 72, 240);
  const nV = clamp(Math.round(meshResolution * 0.68), 48, 160);
  const alphaRad = (bottomTiltAngle * Math.PI) / 180;
  const cosA = Math.cos(alphaRad);
  const sinA = Math.sin(alphaRad);
  const tanA = Math.tan(alphaRad);
  const hCenter = height * 0.44;

  // 4 OpenSCAD cutting planes:
  // g1 >= 0: inside back arch cut (y <= archCutOffset)
  const g1 = (v: { y: number }) => archCutOffset - v.y;
  // g2 >= 0: above bottom tilted cut (z * cosA - y * sinA >= 0)
  const g2 = (v: { y: number; z: number }) => v.z * cosA - v.y * sinA;
  // g3 >= 0: inside side trim window (y <= archCutOffset - sideTrimWidth)
  const g3 = (v: { y: number }) => archCutOffset - sideTrimWidth - v.y;
  // g4 >= 0: above bottom trim window (z * cosA - y * sinA >= bottomTrimWidth)
  const g4 = (v: { y: number; z: number }) => v.z * cosA - v.y * sinA - bottomTrimWidth;

  // 3 Analytical Shells:
  const shellBlueOuter = makeShellEvaluator(width, depth, height, domeRatio, bottomFlare, 0);
  const shellBlueInner = makeShellEvaluator(
    Math.max(4, width - shellThickness * 2),
    Math.max(4, depth - shellThickness * 2),
    Math.max(4, height - shellThickness + 1),
    domeRatio,
    bottomFlare,
    -1
  );
  const shellGoldOuter = makeShellEvaluator(
    width + trimRelief * 2,
    depth + trimRelief * 2,
    height + trimRelief,
    domeRatio,
    bottomFlare,
    0
  );

  // Vertex attribute calculators for AO (recess darkening) and Curvature (edge highlights)
  const computeBlueVertexAoAndCurv = (p: { x: number; y: number; z: number }): { ao: number; curvature: number } => {
    const dWin = Math.min(g3(p), g4(p));
    const dCut = Math.min(g1(p), g2(p));
    const dCorner = Math.hypot(g3(p), g4(p));
    // Crisp dark AO recess groove right along the step where blue armor meets the raised gold trim
    let ao = 1.0;
    if (dWin >= -0.3 && dWin < 2.2) {
      const t = clamp((dWin + 0.12) / 2.1, 0, 1);
      const smooth = t * t * (3 - 2 * t);
      ao = 0.12 + 0.88 * smooth;
    }
    let curvature = 0.08;
    // Inner panel border highlight band just inside the recess groove
    if (dWin >= 1.1 && dWin <= 2.6) {
      const t = 1 - Math.abs(dWin - 1.85) / 0.75;
      curvature = Math.max(curvature, 0.56 * clamp(t, 0, 1));
    }
    // Outer cut rim edge highlight (especially visible in blue_only mode or along inner rim)
    if (dCut < 1.35) {
      curvature = Math.max(curvature, 0.88 * clamp(1 - dCut / 1.35, 0, 1));
    }
    if (dCorner < 2.8 && dWin > 0.8) {
      curvature = Math.max(curvature, 0.72 * clamp(1 - dCorner / 2.8, 0, 1));
    }
    return { ao, curvature };
  };

  const computeGoldVertexAoAndCurv = (p: { x: number; y: number; z: number }): { ao: number; curvature: number } => {
    const dWin = Math.min(g3(p), g4(p));
    const dCut = Math.min(g1(p), g2(p));
    const dInnerStep = Math.abs(dWin);
    const dOuterRim = Math.abs(dCut);
    const dCorner = Math.hypot(g3(p), g4(p));
    const dOuterCorner = Math.hypot(g1(p), g2(p));

    let curvature = 0.16;
    if (dInnerStep < 1.45) {
      curvature = Math.max(curvature, 0.98 * (1 - dInnerStep / 1.45));
    }
    if (dOuterRim < 1.35) {
      curvature = Math.max(curvature, 0.96 * (1 - dOuterRim / 1.35));
    }
    if (dCorner < 3.0) {
      curvature = Math.max(curvature, 0.99 * (1 - dCorner / 3.0));
    }
    if (dOuterCorner < 3.0) {
      curvature = Math.max(curvature, 0.99 * (1 - dOuterCorner / 3.0));
    }
    const ao = 0.76 + 0.24 * clamp(Math.min(dInnerStep, dOuterRim) / 1.5, 0, 1);
    return { ao, curvature };
  };

  // Deterministic pseudo-random helper for OpenSCAD physical battle damage placement
  const seededRand = (idx: number, salt: number) => {
    const s = Math.sin((params.damageSeed * 19.37 + idx * 43.17 + salt * 11.73) * 12.9898) * 43758.5453;
    return s - Math.floor(s);
  };

  interface ScadBattleFeature {
    kind: "crater" | "slash";
    cx: number;
    cy: number;
    cz: number;
    nx: number;
    ny: number;
    nz: number;
    tx: number;
    ty: number;
    tz: number;
    bx: number;
    by: number;
    bz: number;
    radius: number;
    halfLen: number;
    maxDepth: number;
    phase: number;
  }

  const battleFeatures: ScadBattleFeature[] = [];
  if (params.battleDamageEnabled && params.damageCount > 0) {
    const count = clamp(Math.round(params.damageCount), 1, 6);
    const depthScale = clamp(params.damageDepth, 0.2, 1.0);
    for (let i = 0; i < count; i++) {
      const r1 = seededRand(i, 1);
      const r2 = seededRand(i, 2);
      const r3 = seededRand(i, 3);
      const r4 = seededRand(i, 4);
      // Place features on the front/side visible hemisphere (theta in [-0.82*PI, -0.18*PI] or [0.15*PI, 0.45*PI])
      const vPos = 0.36 + 0.46 * r1;
      const thetaPos = -Math.PI * (0.20 + 0.62 * r2);
      const surfPt = shellBlueOuter.evalAtVTheta(vPos, thetaPos);

      // Build local orthonormal tangent frame (T, B, N) on the armor dome
      const upX = 0;
      const upY = 0;
      const upZ = 1;
      let tx = upY * surfPt.nz - upZ * surfPt.ny;
      let ty = upZ * surfPt.nx - upX * surfPt.nz;
      let tz = upX * surfPt.ny - upY * surfPt.nx;
      const tLen = Math.hypot(tx, ty, tz) || 1;
      tx /= tLen;
      ty /= tLen;
      tz /= tLen;

      const bx = surfPt.ny * tz - surfPt.nz * ty;
      const by = surfPt.nz * tx - surfPt.nx * tz;
      const bz = surfPt.nx * ty - surfPt.ny * tx;

      // Rotate tangent frame by slash angle
      const slashAng = (r3 - 0.5) * 1.9;
      const ca = Math.cos(slashAng);
      const sa = Math.sin(slashAng);
      const rtx = tx * ca + bx * sa;
      const rty = ty * ca + by * sa;
      const rtz = tz * ca + bz * sa;
      const rbx = -tx * sa + bx * ca;
      const rby = -ty * sa + by * ca;
      const rbz = -tz * sa + bz * ca;

      const isSlash = i % 2 === 1;
      battleFeatures.push({
        kind: isSlash ? "slash" : "crater",
        cx: surfPt.x,
        cy: surfPt.y,
        cz: surfPt.z,
        nx: surfPt.nx,
        ny: surfPt.ny,
        nz: surfPt.nz,
        tx: rtx,
        ty: rty,
        tz: rtz,
        bx: rbx,
        by: rby,
        bz: rbz,
        radius: isSlash ? 1.45 + 0.55 * r4 : 3.2 + 1.4 * r4,
        halfLen: isSlash ? 5.8 + 2.8 * r3 : 0,
        maxDepth: (isSlash ? 1.45 + 0.45 * r4 : 1.65 + 0.55 * r4) * depthScale,
        phase: r4 * 6.28,
      });
    }
  }

  const evalPhysicalBattleDamage = (p: { x: number; y: number; z: number }) => {
    if (battleFeatures.length === 0) return { disp: 0, damage: 0, aoMult: 1 };
    const dCut = Math.min(g1(p), g2(p));
    // Keep outer cut boundaries watertight while allowing full displacement across the armor & trim
    const wallSafe = clamp((dCut - 0.9) / 1.8, 0, 1);
    if (wallSafe <= 0.001) return { disp: 0, damage: 0, aoMult: 1 };

    let totalDisp = 0;
    let maxDamage = 0;
    let minAoMult = 1.0;

    for (const feat of battleFeatures) {
      const dx = p.x - feat.cx;
      const dy = p.y - feat.cy;
      const dz = p.z - feat.cz;

      const sAlong = dx * feat.tx + dy * feat.ty + dz * feat.tz;
      const sPerp = dx * feat.bx + dy * feat.by + dz * feat.bz;

      if (feat.kind === "crater") {
        const dist = Math.hypot(sAlong, sPerp);
        const ang = Math.atan2(sPerp, sAlong);
        // Jagged shattered-ceramite crater contour
        const jagged =
          1.0 +
          0.11 * Math.sin(5 * ang + feat.phase) +
          0.07 * Math.cos(8 * ang - feat.phase * 1.3);
        const rEff = feat.radius * jagged;
        const u = dist / rEff;

        if (u < 1.0) {
          // Physical concave bolter impact bowl
          const bowl = Math.pow(1 - u * u, 1.35);
          totalDisp -= feat.maxDepth * bowl * wallSafe;
          minAoMult = Math.min(minAoMult, 0.22 + 0.78 * u * u);
          if (u < 0.52) {
            // Bare cold-steel crater center
            maxDamage = Math.max(maxDamage, 0.72 + 0.28 * (1 - u / 0.52));
          } else if (u < 0.92) {
            // Spalled dark primer crater wall
            maxDamage = Math.max(maxDamage, 0.38 + 0.32 * (1 - (u - 0.52) / 0.40));
          } else {
            // Inner chipped rim
            maxDamage = Math.max(maxDamage, 0.22 + 0.16 * (1 - (u - 0.92) / 0.08));
          }
        } else if (u < 1.28) {
          // Raised impact rim lip around crater
          const rimSin = Math.sin(((u - 1.0) / 0.28) * Math.PI);
          totalDisp += feat.maxDepth * 0.17 * rimSin * wallSafe;
          maxDamage = Math.max(maxDamage, 0.28 * rimSin);
        }
      } else {
        // Physical Chainsword / Power-Blade V-Gouge Slash
        const uAlong = Math.abs(sAlong) / feat.halfLen;
        if (uAlong < 1.0) {
          const taper = Math.pow(1 - uAlong * uAlong, 1.2);
          const curvedPerp = sPerp + 0.28 * Math.sin(sAlong * 0.55 + feat.phase);
          const wLocal = feat.radius * (0.32 + 0.68 * Math.sqrt(taper));
          const uPerp = Math.abs(curvedPerp) / Math.max(0.2, wLocal);

          if (uPerp < 1.0) {
            // Deep V-shaped blade gouge
            const vGroove = Math.pow(1 - uPerp, 1.55) * taper;
            totalDisp -= feat.maxDepth * vGroove * wallSafe;
            minAoMult = Math.min(minAoMult, 0.25 + 0.75 * uPerp);
            if (uPerp < 0.44) {
              maxDamage = Math.max(maxDamage, (0.74 + 0.26 * (1 - uPerp / 0.44)) * taper);
            } else {
              maxDamage = Math.max(maxDamage, (0.40 + 0.32 * (1 - (uPerp - 0.44) / 0.56)) * taper);
            }
          } else if (uPerp < 1.34) {
            // Displaced paint/metal lip along both sides of the blade slash
            const lipSin = Math.sin(((uPerp - 1.0) / 0.34) * Math.PI) * taper;
            totalDisp += feat.maxDepth * 0.19 * lipSin * wallSafe;
            maxDamage = Math.max(maxDamage, 0.29 * lipSin);
          }
        }
      }
    }

    return { disp: totalDisp, damage: maxDamage * wallSafe, aoMult: minAoMult };
  };

  const buildGrid = (
    shell: ShellEvaluator,
    attrFn: (p: { x: number; y: number; z: number }) => { ao: number; curvature: number },
    flipNormal = false,
    applyDamage = false
  ): ScadVertex[][] => {
    const grid: ScadVertex[][] = [];
    const sign = flipNormal ? -1 : 1;
    for (let iv = 0; iv <= nV; iv++) {
      const v = iv / nV;
      const row: ScadVertex[] = [];
      for (let it = 0; it <= nTheta; it++) {
        const theta = -Math.PI + (it / nTheta) * (2 * Math.PI);
        const pt = shell.evalAtVTheta(v, theta);
        const { ao, curvature } = attrFn(pt);
        const dmg = applyDamage ? evalPhysicalBattleDamage(pt) : { disp: 0, damage: 0, aoMult: 1 };
        row.push({
          x: pt.x + pt.nx * dmg.disp,
          y: pt.y + pt.ny * dmg.disp,
          z: pt.z + pt.nz * dmg.disp,
          nx: pt.nx * sign,
          ny: pt.ny * sign,
          nz: pt.nz * sign,
          ao: ao * dmg.aoMult,
          curvature: dmg.damage > 0.12 && dmg.damage < 0.36 ? Math.max(curvature, 0.85) : curvature,
          damage: dmg.damage,
        });
      }
      grid.push(row);
    }

    // Recompute exact 3D vertex normals from displaced mesh neighbors where battle damage deformed the shell
    if (applyDamage && battleFeatures.length > 0) {
      for (let iv = 1; iv < nV; iv++) {
        for (let it = 0; it <= nTheta; it++) {
          const vCurr = grid[iv][it];
          if (vCurr.damage <= 0.005) continue;
          const itPrev = (it - 1 + nTheta) % nTheta;
          const itNext = (it + 1) % nTheta;
          const pUp = grid[iv + 1][it];
          const pDn = grid[iv - 1][it];
          const pRt = grid[iv][itNext];
          const pLt = grid[iv][itPrev];

          const ux = pRt.x - pLt.x;
          const uy = pRt.y - pLt.y;
          const uz = pRt.z - pLt.z;
          const vx = pUp.x - pDn.x;
          const vy = pUp.y - pDn.y;
          const vz = pUp.z - pDn.z;

          let nx = (uy * vz - uz * vy) * sign;
          let ny = (uz * vx - ux * vz) * sign;
          let nz = (ux * vy - uy * vx) * sign;
          const len = Math.hypot(nx, ny, nz);
          if (len > 1e-6) {
            nx /= len;
            ny /= len;
            nz /= len;
            // Ensure normal points outward in the same hemisphere as original shell normal
            if (nx * vCurr.nx + ny * vCurr.ny + nz * vCurr.nz < 0) {
              nx = -nx;
              ny = -ny;
              nz = -nz;
            }
            vCurr.nx = nx;
            vCurr.ny = ny;
            vCurr.nz = nz;
          }
        }
      }
    }

    return grid;
  };

  const blueOuterGrid = buildGrid(shellBlueOuter, computeBlueVertexAoAndCurv, false, true);
  const blueInnerGrid = buildGrid(shellBlueInner, () => ({ ao: 0.28, curvature: 0.05 }), true, false);
  const goldOuterGrid = buildGrid(shellGoldOuter, computeGoldVertexAoAndCurv, false, true);
  const goldInnerOnlyGrid =
    renderMode === "gold_only"
      ? buildGrid(shellBlueOuter, () => ({ ao: 0.45, curvature: 0.15 }), true, false)
      : null;

  const createAccumulator = () => {
    const positions: number[] = [];
    const normals: number[] = [];
    const aos: number[] = [];
    const curvatures: number[] = [];
    const damages: number[] = [];

    const pushVertex = (v: ScadVertex) => {
      const [px, py, pz] = scadToThreePos(v.x, v.y, v.z, hCenter);
      const [nx, ny, nz] = scadToThreeNormal(v.nx, v.ny, v.nz);
      positions.push(px, py, pz);
      normals.push(nx, ny, nz);
      aos.push(v.ao);
      curvatures.push(v.curvature);
      damages.push(v.damage || 0);
    };

    const pushTriangle = (a: ScadVertex, b: ScadVertex, c: ScadVertex) => {
      pushVertex(a);
      pushVertex(b);
      pushVertex(c);
    };

    /**
     * Pushes a polygon while automatically orienting its triangle winding so its geometric face normal
     * aligns with its vertex normal (prevents any front/back face flip or DoubleSide z-fighting).
     */
    const pushPolygon = (poly: ScadVertex[]) => {
      if (poly.length < 3) return;
      const p0 = scadToThreePos(poly[0].x, poly[0].y, poly[0].z, hCenter);
      const p1 = scadToThreePos(poly[1].x, poly[1].y, poly[1].z, hCenter);
      const p2 = scadToThreePos(poly[2].x, poly[2].y, poly[2].z, hCenter);
      const n0 = scadToThreeNormal(poly[0].nx, poly[0].ny, poly[0].nz);

      const ux = p1[0] - p0[0];
      const uy = p1[1] - p0[1];
      const uz = p1[2] - p0[2];
      const vx = p2[0] - p0[0];
      const vy = p2[1] - p0[1];
      const vz = p2[2] - p0[2];

      const cx = uy * vz - uz * vy;
      const cy = uz * vx - ux * vz;
      const cz = ux * vy - uy * vx;
      const dot = cx * n0[0] + cy * n0[1] + cz * n0[2];

      for (let i = 1; i < poly.length - 1; i++) {
        if (dot >= 0) {
          pushTriangle(poly[0], poly[i], poly[i + 1]);
        } else {
          pushTriangle(poly[0], poly[i + 1], poly[i]);
        }
      }
    };

    /**
     * Pushes a SINGLE correctly-oriented quad wall (never emits a coplanar reverse duplicate).
     */
    const pushWallQuad = (
      topA: { x: number; y: number; z: number },
      topB: { x: number; y: number; z: number },
      botB: { x: number; y: number; z: number },
      botA: { x: number; y: number; z: number },
      wallNormalScad: [number, number, number],
      aoTop: number,
      aoBot: number,
      curvTop: number,
      curvBot: number
    ) => {
      const [wnx, wny, wnz] = wallNormalScad;
      const vTopA: ScadVertex = { ...topA, nx: wnx, ny: wny, nz: wnz, ao: aoTop, curvature: curvTop, damage: 0 };
      const vTopB: ScadVertex = { ...topB, nx: wnx, ny: wny, nz: wnz, ao: aoTop, curvature: curvTop, damage: 0 };
      const vBotB: ScadVertex = { ...botB, nx: wnx, ny: wny, nz: wnz, ao: aoBot, curvature: curvBot, damage: 0 };
      const vBotA: ScadVertex = { ...botA, nx: wnx, ny: wny, nz: wnz, ao: aoBot, curvature: curvBot, damage: 0 };
      pushPolygon([vTopA, vTopB, vBotB, vBotA]);
    };

    const toBufferGeometry = () => {
      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geom.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
      geom.setAttribute("aAo", new THREE.Float32BufferAttribute(aos, 1));
      geom.setAttribute("aCurvature", new THREE.Float32BufferAttribute(curvatures, 1));
      geom.setAttribute("aDamage", new THREE.Float32BufferAttribute(damages, 1));
      geom.computeBoundingSphere();
      return geom;
    };

    return { pushPolygon, pushWallQuad, toBufferGeometry };
  };

  const blueAcc = createAccumulator();
  const goldAcc = createAccumulator();

  // 1. Build Curved Shell Surfaces (with ZERO coplanar overlap between Blue and Gold)
  for (let iv = 0; iv < nV; iv++) {
    for (let it = 0; it < nTheta; it++) {
      // Blue Outer Shell:
      // When renderMode === "all", only emit blue outer surface inside the window (g3 >= 0 && g4 >= 0)
      // so there is zero hidden internal blue surface under the gold trim.
      const boTris: Array<[ScadVertex, ScadVertex, ScadVertex]> = [
        [blueOuterGrid[iv][it], blueOuterGrid[iv][it + 1], blueOuterGrid[iv + 1][it + 1]],
        [blueOuterGrid[iv][it], blueOuterGrid[iv + 1][it + 1], blueOuterGrid[iv + 1][it]],
      ];
      for (const tri of boTris) {
        let p = clipPolygonByPlane(tri, g1);
        p = clipPolygonByPlane(p, g2);
        if (renderMode === "all") {
          p = clipPolygonByPlane(p, g3);
          p = clipPolygonByPlane(p, g4);
        }
        if (p.length >= 3) blueAcc.pushPolygon(p);
      }

      // Blue Inner Cavity Shell (clipped by g1 >= 0 and g2 >= 0)
      const biTris: Array<[ScadVertex, ScadVertex, ScadVertex]> = [
        [blueInnerGrid[iv][it], blueInnerGrid[iv][it + 1], blueInnerGrid[iv + 1][it + 1]],
        [blueInnerGrid[iv][it], blueInnerGrid[iv + 1][it + 1], blueInnerGrid[iv + 1][it]],
      ];
      for (const tri of biTris) {
        let p = clipPolygonByPlane(tri, g1);
        p = clipPolygonByPlane(p, g2);
        if (p.length >= 3) blueAcc.pushPolygon(p);
      }

      // Gold Trim Outer Shell (partitioned into Strip A: -g3 >= 0, and Strip B: g3 >= 0 && -g4 >= 0)
      const goTris: Array<[ScadVertex, ScadVertex, ScadVertex]> = [
        [goldOuterGrid[iv][it], goldOuterGrid[iv][it + 1], goldOuterGrid[iv + 1][it + 1]],
        [goldOuterGrid[iv][it], goldOuterGrid[iv + 1][it + 1], goldOuterGrid[iv + 1][it]],
      ];
      for (const tri of goTris) {
        let p = clipPolygonByPlane(tri, g1);
        p = clipPolygonByPlane(p, g2);
        if (p.length < 3) continue;

        const stripA = clipPolygonByPlane(p, (v) => -g3(v));
        if (stripA.length >= 3) goldAcc.pushPolygon(stripA);

        const insideG3 = clipPolygonByPlane(p, g3);
        if (insideG3.length >= 3) {
          const stripB = clipPolygonByPlane(insideG3, (v) => -g4(v));
          if (stripB.length >= 3) goldAcc.pushPolygon(stripB);
        }
      }

      // Only build inner underside of gold trim when exporting/viewing "gold_only"
      if (goldInnerOnlyGrid) {
        const giTris: Array<[ScadVertex, ScadVertex, ScadVertex]> = [
          [goldInnerOnlyGrid[iv][it], goldInnerOnlyGrid[iv][it + 1], goldInnerOnlyGrid[iv + 1][it + 1]],
          [goldInnerOnlyGrid[iv][it], goldInnerOnlyGrid[iv + 1][it + 1], goldInnerOnlyGrid[iv + 1][it]],
        ];
        for (const tri of giTris) {
          let p = clipPolygonByPlane(tri, g1);
          p = clipPolygonByPlane(p, g2);
          if (p.length < 3) continue;
          const stripA = clipPolygonByPlane(p, (v) => -g3(v));
          if (stripA.length >= 3) goldAcc.pushPolygon(stripA);
          const insideG3 = clipPolygonByPlane(p, g3);
          if (insideG3.length >= 3) {
            const stripB = clipPolygonByPlane(insideG3, (v) => -g4(v));
            if (stripB.length >= 3) goldAcc.pushPolygon(stripB);
          }
        }
      }
    }
  }

  // ==========================================================================
  // 2. Exact Analytical Cut & Step Walls via Convex Planar Ray-Casting
  //    (Zero Gaps, Zero Twisted Quads, Zero Z-Fighting)
  // ==========================================================================

  const isInsideShell = (shell: ShellEvaluator, x: number, y: number, z: number): boolean => {
    if (z < shell.zMin || z > shell.zMax) return false;
    const { r } = shell.evalRadiusAtZ(z);
    const nx = x / shell.a;
    const ny = y / shell.b;
    return nx * nx + ny * ny <= r * r;
  };

  const maxRayDist = Math.max(width, depth, height) * 2.2;

  /**
   * Samples the exact intersection curve of convex `shell` with the tilted bottom plane
   * `z * cosA - y * sinA = planeOffset` for `y <= yLimit`, by shooting radial rays
   * in the tilted plane from `(0, yLimit, zFloor)` for `phi in [0, PI]`.
   */
  const sampleTiltedBottomCurve = (
    shell: ShellEvaluator,
    planeOffset: number,
    yLimit: number,
    steps: number
  ): Array<{ x: number; y: number; z: number }> => {
    const zAtY = (y: number) => y * tanA + planeOffset / Math.max(1e-4, cosA);
    const pts: Array<{ x: number; y: number; z: number }> = [];

    for (let i = 0; i <= steps; i++) {
      const phi = (i / steps) * Math.PI;
      const cosP = Math.cos(phi);
      const sinP = Math.sin(phi);

      let lo = 0;
      let hi = maxRayDist;
      for (let iter = 0; iter < 24; iter++) {
        const mid = 0.5 * (lo + hi);
        const x = mid * cosP;
        const y = yLimit - mid * sinP;
        const z = zAtY(y);
        if (isInsideShell(shell, x, y, z)) lo = mid;
        else hi = mid;
      }
      const rho = 0.5 * (lo + hi);
      const x = rho * cosP;
      const y = yLimit - rho * sinP;
      const z = zAtY(y);
      pts.push({ x, y, z });
    }
    return pts;
  };

  /**
   * Samples the exact intersection arch curve of convex `shell` with the vertical plane `y = yPlane`
   * above `zFloor = yPlane * tanA + floorOffset / cosA`, by shooting radial rays
   * in the vertical plane from `(0, yPlane, zFloor)` for `phi in [0, PI]`.
   */
  const sampleVerticalArchCurve = (
    shell: ShellEvaluator,
    yPlane: number,
    floorOffset: number,
    steps: number
  ): Array<{ x: number; y: number; z: number }> => {
    const zFloor = yPlane * tanA + floorOffset / Math.max(1e-4, cosA);
    const pts: Array<{ x: number; y: number; z: number }> = [];

    for (let i = 0; i <= steps; i++) {
      const phi = (i / steps) * Math.PI;
      const cosP = Math.cos(phi);
      const sinP = Math.sin(phi);

      let lo = 0;
      let hi = maxRayDist;
      for (let iter = 0; iter < 24; iter++) {
        const mid = 0.5 * (lo + hi);
        const x = mid * cosP;
        const z = zFloor + mid * sinP;
        if (isInsideShell(shell, x, yPlane, z)) lo = mid;
        else hi = mid;
      }
      const rho = 0.5 * (lo + hi);
      pts.push({
        x: rho * cosP,
        y: yPlane,
        z: zFloor + rho * sinP,
      });
    }
    return pts;
  };

  const stitchRibbonWall = (
    acc: ReturnType<typeof createAccumulator>,
    curveOuter: Array<{ x: number; y: number; z: number }>,
    curveInner: Array<{ x: number; y: number; z: number }>,
    wallNormalScad: [number, number, number],
    aoOuter: number,
    aoInner: number,
    curvOuter: number,
    curvInner: number
  ) => {
    const count = Math.min(curveOuter.length, curveInner.length) - 1;
    for (let i = 0; i < count; i++) {
      acc.pushWallQuad(
        curveOuter[i],
        curveOuter[i + 1],
        curveInner[i + 1],
        curveInner[i],
        wallNormalScad,
        aoOuter,
        aoInner,
        curvOuter,
        curvInner
      );
    }
  };

  const nWallSteps = nTheta;

  // A. Back Arch Rim Wall at g1 == 0 (y = archCutOffset, above g2 == 0)
  const archGoldOut = sampleVerticalArchCurve(shellGoldOuter, archCutOffset, 0, nWallSteps);
  const archBlueOut = sampleVerticalArchCurve(shellBlueOuter, archCutOffset, 0, nWallSteps);
  const archBlueIn = sampleVerticalArchCurve(shellBlueInner, archCutOffset, 0, nWallSteps);

  // Blue cavity wall on back arch (between blueOuter and blueInner)
  stitchRibbonWall(blueAcc, archBlueOut, archBlueIn, [0, 1, 0], 0.85, 0.38, 0.72, 0.32);
  // Gold relief wall on back arch (between goldOuter and blueOuter)
  stitchRibbonWall(goldAcc, archGoldOut, archBlueOut, [0, 1, 0], 0.94, 0.58, 0.96, 0.58);

  // B. Bottom Tilted Rim Wall at g2 == 0 (z*cosA - y*sinA = 0, for y <= archCutOffset)
  const botGoldOut = sampleTiltedBottomCurve(shellGoldOuter, 0, archCutOffset, nWallSteps);
  const botBlueOut = sampleTiltedBottomCurve(shellBlueOuter, 0, archCutOffset, nWallSteps);
  const botBlueIn = sampleTiltedBottomCurve(shellBlueInner, 0, archCutOffset, nWallSteps);

  // Blue cavity wall on bottom tilted plane (between blueOuter and blueInner)
  stitchRibbonWall(blueAcc, botBlueOut, botBlueIn, [0, sinA, -cosA], 0.82, 0.35, 0.72, 0.32);
  // Gold relief wall on bottom tilted plane (between goldOuter and blueOuter)
  stitchRibbonWall(goldAcc, botGoldOut, botBlueOut, [0, sinA, -cosA], 0.92, 0.55, 0.95, 0.55);

  // C. Gold Inner Window Step Wall: Side Arch at g3 == 0 (y = archCutOffset - sideTrimWidth, above g4 == 0)
  const innerArchY = archCutOffset - sideTrimWidth;
  const stepArchGoldOut = sampleVerticalArchCurve(shellGoldOuter, innerArchY, bottomTrimWidth, nWallSteps);
  const stepArchBlueOut = sampleVerticalArchCurve(shellBlueOuter, innerArchY, bottomTrimWidth, nWallSteps);
  stitchRibbonWall(goldAcc, stepArchGoldOut, stepArchBlueOut, [0, -1, 0], 0.96, 0.18, 0.98, 0.35);

  // D. Gold Inner Window Step Wall: Bottom Horizontal Bar at g4 == 0 (z*cosA - y*sinA = bottomTrimWidth, for y <= innerArchY)
  const stepBotGoldOut = sampleTiltedBottomCurve(shellGoldOuter, bottomTrimWidth, innerArchY, nWallSteps);
  const stepBotBlueOut = sampleTiltedBottomCurve(shellBlueOuter, bottomTrimWidth, innerArchY, nWallSteps);
  stitchRibbonWall(goldAcc, stepBotGoldOut, stepBotBlueOut, [0, -sinA, cosA], 0.96, 0.18, 0.98, 0.35);

  // E. If viewing "blue_only", also seal the exposed blueOuter surface does not need gold step walls,
  // and if viewing "all", our blueOuter surface joins stepArchBlueOut and stepBotBlueOut at the exact same curve!

  return {
    blueGeometry: blueAcc.toBufferGeometry(),
    goldGeometry: goldAcc.toBufferGeometry(),
  };
}

// ============================================================================
// 3. Blender ShaderToRGB + Hand-Painted Stipple/Glaze + ColorRamp GLSL Shaders
// ============================================================================

const BLENDER_NPR_VERTEX_SHADER = /* glsl */ `
  attribute float aAo;
  attribute float aCurvature;
  attribute float aDamage;

  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying vec3 vObjectPos;
  varying vec3 vViewDir;
  varying float vAo;
  varying float vCurvature;
  varying float vDamage;

  void main() {
    vAo = aAo > 0.0 ? aAo : 1.0;
    vCurvature = aCurvature;
    vDamage = aDamage;
    vObjectPos = position;

    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - worldPos.xyz);

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const BLENDER_NPR_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform vec3 uColorShadowDeep;
  uniform vec3 uColorShadow;
  uniform vec3 uColorBase;
  uniform vec3 uColorHighlight;
  uniform vec3 uColorSpecular;

  uniform vec3 uLightDir;
  uniform int uRampStyle;         // 0 = airbrush, 1 = stepped, 2 = NMM, 3 = stipple, 4 = box-art edge style
  uniform int uColorSteps;        // 3 or 5
  uniform int uClearcoatMode;     // 0 = matte, 1 = satin, 2 = gloss
  uniform float uShadowStop;
  uniform float uHighlightStop;
  uniform float uAoStrength;
  uniform float uEdgeStrength;
  uniform float uZenithalFocus;
  uniform float uBrushStipple;    // 0.0 .. 1.0 hand-painted stipple/glaze micro-texture
  uniform int uSprayGuideMode;    // 0 = normal render, 1 = 🎯 Spray Zone Guide

  // 6 Toggleable Special Highlight & Weathering / Battle-Damage Layers + Sub-Controls
  uniform int uEdgeLineEnabled;      // 1 = 📐 边缘描线 (双阶刀锋描边+尖角亮白点)
  uniform int uWhiteHotspotEnabled;  // 1 = ⚪ 曲面白点 (凸面中心纯白聚光圆点)
  uniform int uGrimeStainEnabled;    // 1 = 🛢️ 旧化污渍 (凹槽油污渍洗 + 表面茶褐斑块流痕)
  uniform int uMetalChippingEnabled; // 1 = 🔩 掉漆露铁 (深褐底漆圈 + 寒铁银金属底)
  uniform int uScratchesEnabled;     // 1 = 🗡️ 利刃划痕 (稀疏锐利亮银划痕 + 高光托边)
  uniform int uDentDamageEnabled;    // 1 = 💥 实体凹损 (配合 OpenSCAD 3D 几何凹坑与多层崩漆)

  uniform float uHotspotSize;        // 0.15 .. 1.0 白色高光圆点半径与聚光度
  uniform float uGrimeDensity;       // 0.05 .. 1.0 污渍分布面积密度
  uniform float uGrimeStrength;      // 0.10 .. 1.0 污渍深浅浓度
  uniform float uChipDensity;        // 0.05 .. 1.0 掉漆分布密度
  uniform float uChipScale;          // 0.10 .. 1.0 掉漆斑块尺寸
  uniform float uScratchDensity;     // 0.05 .. 1.0 划痕数量密度
  uniform float uScratchScale;       // 0.10 .. 1.0 划痕长度与粗细
  uniform float uWeatheringSeed;     // 1.0 .. 100.0 随机种子
  uniform float uWeatheringIntensity;// 0.10 .. 1.0 综合强度

  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying vec3 vObjectPos;
  varying vec3 vViewDir;
  varying float vAo;
  varying float vCurvature;
  varying float vDamage;

  // 3D Value Noise for object-space hand-painted stippling & brush texture
  float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  vec3 hash33(vec3 p) {
    p = vec3(
      dot(p, vec3(127.1, 311.7, 74.7)),
      dot(p, vec3(269.5, 183.3, 246.1)),
      dot(p, vec3(113.5, 271.9, 124.6))
    );
    return fract(sin(p) * 43758.5453123);
  }

  float noise3D(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);

    return mix(
      mix(
        mix(hash31(i + vec3(0, 0, 0)), hash31(i + vec3(1, 0, 0)), f.x),
        mix(hash31(i + vec3(0, 1, 0)), hash31(i + vec3(1, 1, 0)), f.x),
        f.y
      ),
      mix(
        mix(hash31(i + vec3(0, 0, 1)), hash31(i + vec3(1, 0, 1)), f.x),
        mix(hash31(i + vec3(0, 1, 1)), hash31(i + vec3(1, 1, 1)), f.x),
        f.y
      ),
      f.z
    );
  }

  // Multi-octave miniature brushwork stipple pattern anchored to 3D object surface
  float miniatureBrushStipple(vec3 objPos) {
    float n1 = noise3D(objPos * 0.85);
    float n2 = noise3D(objPos * 2.35 + vec3(11.7, 5.3, 8.1));
    float n3 = noise3D(objPos * 5.80 - vec3(4.2, 19.1, 3.7));
    float stroke = noise3D(vec3(objPos.x * 3.6, objPos.y * 1.4, objPos.z * 3.6));
    return (n1 * 0.30 + n2 * 0.42 + n3 * 0.16 + stroke * 0.12) - 0.5;
  }

  // Evaluates 3-stop or 5-stop ColorRamp
  vec3 sampleColorRamp(float t, int steps, int style, float sStop, float hStop) {
    float x = clamp(t, 0.0, 1.0);

    float feather = style == 1
      ? 0.025
      : (style == 3 ? 0.052 : (style == 2 ? 0.072 : 0.165));

    if (steps == 3) {
      float wBase = smoothstep(sStop - feather, sStop + feather, x);
      float wHigh = smoothstep(hStop - feather, hStop + feather, x);
      vec3 c = mix(uColorShadow, uColorBase, wBase);
      c = mix(c, uColorHighlight, wHigh);
      float wSpec = smoothstep(0.88 - feather * 0.5, 0.96, x);
      c = mix(c, uColorSpecular, wSpec * 0.72);
      return c;
    } else {
      float p1 = sStop * 0.56;
      float p2 = sStop * 1.06;
      float p3 = mix(sStop, hStop, 0.52);
      float p4 = hStop + (1.0 - hStop) * 0.42;

      vec3 c = uColorShadowDeep;
      c = mix(c, uColorShadow, smoothstep(p1 - feather, p1 + feather, x));
      c = mix(c, uColorBase, smoothstep(p2 - feather, p2 + feather, x));
      c = mix(c, uColorHighlight, smoothstep(p3 - feather, p3 + feather, x));
      c = mix(c, uColorSpecular, smoothstep(p4 - feather, p4 + feather, x));
      return c;
    }
  }

  void main() {
    vec3 N = normalize(vWorldNormal);
    if (!gl_FrontFacing) {
      N = -N;
    }
    vec3 L = normalize(uLightDir);
    vec3 V = normalize(vViewDir);

    // Deterministic seed offset for weathering layers
    vec3 seedOffset = vec3(
      uWeatheringSeed * 1.731,
      uWeatheringSeed * 2.917,
      uWeatheringSeed * 4.103
    );

    // Screen-space + analytical geometric bevel detection (C-chamfer & brow/rim ridges)
    vec3 dNdx = dFdx(N);
    vec3 dNdy = dFdy(N);
    float screenCurv = clamp((length(dNdx) + length(dNdy)) * 2.4, 0.0, 1.0);
    float combinedCurv = max(vCurvature, screenCurv * 0.65);

    // Compute 3D object-space brushwork / stippling pattern
    float stippleDelta = miniatureBrushStipple(vObjectPos);
    float activeStipple = uRampStyle == 3 ? max(0.35, uBrushStipple) : uBrushStipple * 0.55;

    // Subtle micro-normal perturbation from brush texture
    vec3 microN = normalize(
      N + vec3(
        noise3D(vObjectPos * 4.5) - 0.5,
        noise3D(vObjectPos * 4.5 + 17.3) - 0.5,
        noise3D(vObjectPos * 4.5 + 31.7) - 0.5
      ) * (activeStipple * 0.11)
    );

    // If inside an OpenSCAD 3D physical battle crater/slash, add fine fractured ceramite micro-roughness
    if (uDentDamageEnabled == 1 && vDamage > 0.12) {
      vec3 fracNoise = vec3(
        noise3D(vObjectPos * 7.2 + seedOffset) - 0.5,
        noise3D(vObjectPos * 7.2 + seedOffset + 9.4) - 0.5,
        noise3D(vObjectPos * 7.2 + seedOffset + 21.8) - 0.5
      );
      microN = normalize(microN + fracNoise * (0.22 * smoothstep(0.15, 0.65, vDamage)));
    }

    vec3 H = normalize(L + V);

    // 1. Blender Diffuse BSDF -> Shader to RGB (N dot L + Half-Lambert wrap)
    float ndotlRaw = dot(microN, L);
    float halfLambert = ndotlRaw * 0.5 + 0.5;

    // 2. Zenithal Volumetric Dome Spotlight
    vec3 domeSpotDir = normalize(L * 0.72 + V * 0.28);
    float domeAlign = max(0.0, dot(microN, domeSpotDir));
    float domeCrown = pow(domeAlign, 2.65);
    float hotSpot = pow(max(0.0, dot(microN, normalize(L + V * 0.25))), 7.0);
    float nmmBands = uRampStyle == 2
      ? pow(max(0.0, dot(reflect(-L, microN), V)), 4.0) * 0.38
      : 0.0;

    float baseLight = mix(
      halfLambert,
      pow(max(0.0, ndotlRaw), 1.18) * 0.68 + domeCrown * 0.42 + hotSpot * 0.16,
      uZenithalFocus
    );
    baseLight += nmmBands;

    // 4. Combine Lighting + Cavity AO + Edge Curvature + Hand-Painted Stipple into ColorRamp Factor
    float cavityDarken = (1.0 - vAo) * uAoStrength * 0.78;
    float edgeLift = combinedCurv * uEdgeStrength * (0.38 + 0.62 * max(0.18, halfLambert));

    float rawFactor = clamp(baseLight - cavityDarken + edgeLift, 0.0, 1.0);

    float transitionMask = smoothstep(0.08, 0.28, rawFactor) * (1.0 - smoothstep(0.84, 0.98, rawFactor));
    float stippleOffset = stippleDelta * activeStipple * 0.24 * (0.45 + 0.55 * transitionMask);
    float rampFactor = clamp(rawFactor + stippleOffset, 0.0, 1.0);

    // 5. Evaluate ColorRamp
    vec3 rampColor = sampleColorRamp(rampFactor, uColorSteps, uRampStyle, uShadowStop, uHighlightStop);

    // 5b. 🏆 Heavy Armor Box-Art Mode (uRampStyle == 4)
    if (uRampStyle == 4) {
      float softShadeMask = smoothstep(0.14, 0.48, baseLight);
      vec3 eavyCol = mix(uColorShadow, uColorBase, softShadeMask);

      float domeGlaze = smoothstep(0.62, 0.94, baseLight) * uZenithalFocus * 0.42;
      eavyCol = mix(eavyCol, uColorHighlight, domeGlaze);

      float recessCrevice = (1.0 - smoothstep(0.24, 0.56, vAo)) * uAoStrength;
      eavyCol = mix(eavyCol, uColorShadowDeep, clamp(recessCrevice * 1.15, 0.0, 1.0));

      float bevelMetric = combinedCurv * uEdgeStrength * (0.55 + 0.45 * max(0.2, halfLambert));
      float chunkyEdge = smoothstep(0.24, 0.44, bevelMetric);
      float fineEdge = smoothstep(0.50, 0.72, bevelMetric);
      float cornerDot = smoothstep(0.66, 0.84, combinedCurv) * smoothstep(0.45, 0.82, baseLight);

      eavyCol = mix(eavyCol, uColorHighlight, chunkyEdge * 0.92);
      eavyCol = mix(eavyCol, uColorSpecular, clamp(fineEdge * 0.90 + cornerDot * 0.45, 0.0, 1.0));

      rampColor = eavyCol;
    }

    // =========================================================================
    // Special Toggleable Rendering Layers (1~6)
    // =========================================================================

    // [Layer 1] ⚪ 曲面高光白色化圆点 (Curved Surface White Hotspot Core)
    if (uWhiteHotspotEnabled == 1) {
      float spotRadius = mix(0.06, 0.26, uHotspotSize);
      float stippledSpot = domeAlign + stippleDelta * (0.025 + 0.045 * activeStipple);
      float outerHalo = smoothstep(1.0 - spotRadius * 1.65, 1.0 - spotRadius * 0.55, stippledSpot);
      float whiteOriginCore = smoothstep(1.0 - spotRadius * 0.62, 1.0 - spotRadius * 0.06, stippledSpot);
      // Avoid placing white dome hotspot inside a physical 3D battle crater
      float intactDomeMask = smoothstep(0.45, 0.85, vAo) * (1.0 - smoothstep(0.10, 0.35, vDamage));

      vec3 haloCol = mix(uColorHighlight, uColorSpecular, 0.72);
      vec3 pureWhiteCore = mix(uColorSpecular, vec3(0.98, 0.99, 1.0), 0.88);

      rampColor = mix(rampColor, haloCol, outerHalo * intactDomeMask * 0.76);
      rampColor = mix(rampColor, pureWhiteCore, whiteOriginCore * intactDomeMask * 0.94);
    }

    // [Layer 2] 📐 模型边缘高光描线 (Two-Stage Edge Line Highlighting)
    if (uEdgeLineEnabled == 1) {
      float edgeCoord = combinedCurv * (0.58 + 0.42 * uEdgeStrength) + stippleDelta * 0.025;
      float lightGate = 0.45 + 0.55 * smoothstep(0.10, 0.65, halfLambert);

      float chunkyLine = smoothstep(0.36, 0.54, edgeCoord) * lightGate;
      float razorLine = smoothstep(0.64, 0.80, edgeCoord) * (0.55 + 0.45 * lightGate);
      float cornerWhiteDot = smoothstep(0.84, 0.94, combinedCurv) * smoothstep(0.38, 0.78, halfLambert);

      rampColor = mix(rampColor, uColorHighlight, clamp(chunkyLine * 0.88, 0.0, 1.0));
      rampColor = mix(rampColor, uColorSpecular, clamp(razorLine * 0.95, 0.0, 1.0));
      rampColor = mix(
        rampColor,
        mix(uColorSpecular, vec3(0.99, 0.99, 1.0), 0.75),
        clamp(cornerWhiteDot * 0.92, 0.0, 1.0)
      );
    }

    // Track exposed bare metal mask so clearcoat specular glints like real steel on chips/scratches/craters
    float bareMetalMask = 0.0;

    // [Layer 3] 🛢️ 旧化污渍 (Controlled by uGrimeDensity, uGrimeStrength, uWeatheringSeed)
    if (uGrimeStainEnabled == 1) {
      float gDens = clamp(uGrimeDensity, 0.05, 1.0);
      float gStr = clamp(uGrimeStrength, 0.05, 1.0);

      // 3a. Capillary recess oil/enamel wash concentrated in deep AO crevices
      float creviceNoise = noise3D(vObjectPos * 1.25 + seedOffset * 0.35);
      float aoCutoff = mix(0.32, 0.74, gDens) + (creviceNoise - 0.5) * 0.14;
      float recessGrime = (1.0 - smoothstep(aoCutoff - 0.18, aoCutoff, vAo)) * gStr;

      // 3b. Sparse organic surface oil/tea-stain patches
      float blotchN1 = noise3D(vObjectPos * 0.32 + seedOffset * 0.6);
      float blotchN2 = noise3D(vObjectPos * 1.15 - seedOffset * 0.4);
      float blotchField = blotchN1 * 0.65 + blotchN2 * 0.35;
      float stainThresh = mix(0.82, 0.48, gDens);
      float stainPatch = smoothstep(stainThresh, stainThresh + 0.12, blotchField) * gStr;

      // 3c. Subtle vertical gravity streak from lower crevices
      float streakN = noise3D(vec3(vObjectPos.x * 0.65, vObjectPos.y * 0.12, vObjectPos.z * 0.65) + seedOffset);
      float streakThresh = mix(0.85, 0.58, gDens);
      float streakMask = smoothstep(streakThresh, streakThresh + 0.10, streakN) *
        smoothstep(6.0, -15.0, vObjectPos.y) * gStr * 0.65;

      vec3 oilUmber = vec3(0.11, 0.08, 0.06);
      vec3 rustScuff = vec3(0.23, 0.16, 0.11);

      rampColor = mix(rampColor, oilUmber, clamp(recessGrime * 0.85 + streakMask * 0.50, 0.0, 0.88));
      rampColor = mix(rampColor, mix(rampColor * 0.48, rustScuff, 0.62), clamp(stainPatch * 0.72, 0.0, 0.82));
    }

    // [Layer 4] 🔩 掉漆露铁 (Controlled by uChipDensity, uChipScale, uWeatheringSeed)
    if (uMetalChippingEnabled == 1) {
      float cDens = clamp(uChipDensity, 0.05, 1.0);
      float cScale = clamp(uChipScale, 0.10, 1.0);
      // Higher uChipScale = larger paint flakes (lower spatial frequency)
      float freqBase = mix(1.45, 0.48, cScale);

      // Cluster mask so chips appear in localized realistic groups rather than uniform noise
      float clusterMask = noise3D(vObjectPos * (freqBase * 0.45) + seedOffset * 0.5);
      float detail1 = noise3D(vObjectPos * (freqBase * 1.85) + seedOffset);
      float detail2 = noise3D(vObjectPos * (freqBase * 4.40) - seedOffset * 0.7);
      float spongePattern = clusterMask * 0.48 + detail1 * 0.34 + detail2 * 0.18;

      // Strongly favor armor rims & bevels; only spill onto flat panels when density is cranked up
      float edgeAffinity = smoothstep(0.24, 0.74, combinedCurv) * 0.34;
      float chipScore = spongePattern + edgeAffinity;
      // At default cDens = 0.22, chipThresh is ~0.83 so only the sharpest exposed corners/edges get chipped!
      float chipThresh = mix(0.91, 0.58, cDens);

      float primerChip = smoothstep(chipThresh - 0.024, chipThresh + 0.005, chipScore);
      float metalCore = smoothstep(chipThresh + 0.018, chipThresh + 0.044, chipScore);

      // Lower paint-edge highlight under each chip (3D paint thickness illusion)
      float chipAbove = noise3D((vObjectPos + vec3(0.0, 0.28, 0.0)) * (freqBase * 1.85) + seedOffset);
      float lowerLip = clamp((chipAbove - detail1) * 3.8, 0.0, 1.0) * primerChip * (1.0 - metalCore);

      vec3 darkPrimerCol = vec3(0.10, 0.08, 0.08);
      float metalGrain = noise3D(vObjectPos * 9.5) * 0.14;
      vec3 bareSteelCol = vec3(0.66, 0.71, 0.77) + vec3(metalGrain);
      float metalLit = 0.45 + 0.55 * max(0.0, dot(microN, L)) + pow(max(0.0, dot(microN, H)), 16.0) * 0.45;
      bareSteelCol *= metalLit;

      rampColor = mix(rampColor, uColorSpecular, clamp(lowerLip * 0.88, 0.0, 1.0));
      rampColor = mix(rampColor, darkPrimerCol, primerChip * 0.92);
      rampColor = mix(rampColor, clamp(bareSteelCol, 0.0, 1.0), metalCore * 0.95);
      bareMetalMask = max(bareMetalMask, metalCore);
    }

    // [Layer 5] 🗡️ 利刃划痕 (Sparse Cell-Gated Slash Strokes controlled by uScratchDensity, uScratchScale, uWeatheringSeed)
    if (uScratchesEnabled == 1) {
      float sDens = clamp(uScratchDensity, 0.05, 1.0);
      float sScale = clamp(uScratchScale, 0.10, 1.0);

      // Use sparse 3D cells so at default density (20%) only 2~4 crisp individual scratches appear on the armor
      float cellScale = mix(0.22, 0.11, sScale);
      vec3 warp = vec3(
        noise3D(vObjectPos * 0.28 + seedOffset * 0.2) - 0.5,
        noise3D(vObjectPos * 0.28 + seedOffset * 0.2 + 11.3) - 0.5,
        noise3D(vObjectPos * 0.28 + seedOffset * 0.2 + 23.7) - 0.5
      ) * 1.35;
      vec3 sp = (vObjectPos + warp) * cellScale;
      vec3 cellId = floor(sp);
      vec3 cellUv = fract(sp) - 0.5;

      vec3 rnd = hash33(cellId + floor(seedOffset));
      // Gate: only a small fraction of cells spawn a scratch
      float spawnCutoff = mix(0.92, 0.42, sDens);
      if (rnd.x > spawnCutoff) {
        // Random 3D slash tangent & binormal inside the active cell
        float angle1 = rnd.y * 6.28318;
        float angle2 = (rnd.z - 0.5) * 1.4;
        vec3 dir = normalize(vec3(cos(angle1) * cos(angle2), sin(angle2), sin(angle1) * cos(angle2)));
        vec3 perp = normalize(cross(dir, vec3(0.15, 0.92, 0.35)));
        vec3 perp2 = cross(dir, perp);

        vec3 rel = cellUv - (rnd - 0.5) * 0.22;
        float along = dot(rel, dir);
        float across = length(vec2(dot(rel, perp), dot(rel, perp2)));

        float halfLen = mix(0.18, 0.44, sScale) * (0.75 + 0.5 * rnd.z);
        float endTaper = clamp(1.0 - pow(abs(along) / halfLen, 2.2), 0.0, 1.0);

        if (endTaper > 0.01) {
          float widthBase = mix(0.014, 0.032, sScale) * endTaper;
          float sDark = 1.0 - smoothstep(widthBase * 0.55, widthBase * 1.45, across);
          float sMetal = 1.0 - smoothstep(0.0, widthBase * 0.65, across);
          // Lower highlight lip on one side of the slash
          float signedAcross = dot(rel, perp);
          float sLip = (1.0 - smoothstep(widthBase * 0.4, widthBase * 1.35, abs(signedAcross - widthBase * 1.05))) * endTaper;

          vec3 silverSlash = vec3(0.84, 0.89, 0.95) * (0.55 + 0.45 * halfLambert);
          rampColor = mix(rampColor, uColorSpecular, clamp(sLip * 0.88, 0.0, 1.0));
          rampColor = mix(rampColor, vec3(0.08, 0.09, 0.11), clamp(sDark * 0.90, 0.0, 1.0));
          rampColor = mix(rampColor, silverSlash, clamp(sMetal * 0.96, 0.0, 1.0));
          bareMetalMask = max(bareMetalMask, sMetal);
        }
      }
    }

    // [Layer 6] 💥 实体凹损涂装同步 (Synchronized Multi-Layer Paint Spalling on OpenSCAD 3D Craters & Blade Gouges)
    // vDamage is baked directly by buildSpaceMarinePauldronGeometries:
    //   0.12 .. 0.36 = Raised upturned paint/ceramite lip around the 3D crater or slash
    //   0.36 .. 0.68 = Spalled dark charcoal/oxide primer bevel wall inside the crater/slash
    //   0.68 .. 1.00 = Deep gouged bare cold-steel armor core
    if (uDentDamageEnabled == 1 && vDamage > 0.08) {
      float microJagged = (noise3D(vObjectPos * 5.2 + seedOffset) - 0.5) * 0.07;
      float dmg = clamp(vDamage + microJagged, 0.0, 1.0);

      // 1. Raised paint lip ring (catches bright edge highlight, strongest on upturned rim facing light)
      float lipRing = smoothstep(0.10, 0.22, dmg) * (1.0 - smoothstep(0.32, 0.44, dmg));
      float lipLightBoost = 0.55 + 0.45 * smoothstep(0.15, 0.75, halfLambert);
      vec3 lipCol = mix(uColorHighlight, uColorSpecular, 0.78);

      // 2. Spalled dark oxide/charcoal primer wall + impact scorch halo
      float primerWall = smoothstep(0.30, 0.42, dmg);
      vec3 spalledPrimerCol = vec3(0.09, 0.08, 0.10) * (0.65 + 0.35 * halfLambert);

      // 3. Exposed bare cold-steel floor at the bottom of the 3D crater / slash gouge
      float steelFloor = smoothstep(0.62, 0.76, dmg);
      float steelStriation = (noise3D(vObjectPos * 11.5) - 0.5) * 0.15;
      float steelLit = 0.38 + 0.62 * max(0.0, dot(microN, L)) + pow(max(0.0, dot(microN, H)), 20.0) * 0.55;
      vec3 craterSteelCol = (vec3(0.64, 0.69, 0.76) + vec3(steelStriation)) * steelLit;

      rampColor = mix(rampColor, lipCol, clamp(lipRing * lipLightBoost * 0.94, 0.0, 1.0));
      rampColor = mix(rampColor, spalledPrimerCol, clamp(primerWall * 0.94, 0.0, 1.0));
      rampColor = mix(rampColor, clamp(craterSteelCol, 0.0, 1.0), clamp(steelFloor * 0.96, 0.0, 1.0));
      bareMetalMask = max(bareMetalMask, steelFloor);
    }

    // Subtle painterly pigment grain in stipple mode
    if (activeStipple > 0.05) {
      float grain = (noise3D(vObjectPos * 6.5) - 0.5) * activeStipple * 0.045;
      rampColor = clamp(rampColor + vec3(grain), 0.0, 1.0);
    }

    // 6. 🎯 Spray Zone Guide Mode (Iso-contour boundary lines + zone hatching)
    if (uSprayGuideMode == 1) {
      float z1 = uShadowStop;
      float z2 = uHighlightStop;
      float z3 = 0.85;

      float distToBoundary = min(
        min(abs(rawFactor - z1), abs(rawFactor - z2)),
        abs(rawFactor - z3)
      );
      float contourLine = 1.0 - smoothstep(0.006, 0.016, distToBoundary);

      float isEdgeZone = smoothstep(0.52, 0.72, combinedCurv * uEdgeStrength);

      float screenStripe = sin((gl_FragCoord.x + gl_FragCoord.y) * 0.45);
      float shadowHatch = (rawFactor < z1 && screenStripe > 0.65) ? 0.14 : 0.0;
      float highHatch = (rawFactor > z2 && screenStripe < -0.65) ? 0.14 : 0.0;

      rampColor = mix(rampColor, rampColor * 0.75, shadowHatch);
      rampColor = mix(rampColor, mix(rampColor, vec3(1.0), 0.35), highHatch);

      vec3 lineColor = rawFactor > z2 ? vec3(1.0, 0.95, 0.35) : vec3(0.95, 0.98, 1.0);
      rampColor = mix(rampColor, lineColor, contourLine * 0.92);

      if (isEdgeZone > 0.25 && combinedCurv > 0.62) {
        float edgeOutline = smoothstep(0.62, 0.85, combinedCurv);
        rampColor = mix(rampColor, vec3(0.35, 0.98, 1.0), edgeOutline * 0.45);
      }
    }

    // 7. Principled Clearcoat Layer (Matte / Satin / Gloss) + Exposed Bare Metal Specular Glint
    float ndoth = max(0.0, dot(microN, H));
    float fresnel = pow(1.0 - max(0.0, dot(N, V)), 4.0);
    vec3 clearcoatSpec = vec3(0.0);

    if (uClearcoatMode == 0) {
      clearcoatSpec = vec3(pow(ndoth, 8.0) * 0.03);
    } else if (uClearcoatMode == 1) {
      clearcoatSpec = vec3(pow(ndoth, 28.0) * 0.12 + fresnel * 0.04);
    } else {
      clearcoatSpec = vec3(pow(ndoth, 110.0) * 0.44 + fresnel * 0.14);
    }

    // Exposed bare metal chips/scratches/3D craters have a sharp metallic glint regardless of matte paint varnish
    if (bareMetalMask > 0.01) {
      vec3 metalGlint = vec3(0.90, 0.95, 1.0) * (pow(ndoth, 42.0) * 0.62 + fresnel * 0.18);
      clearcoatSpec = mix(clearcoatSpec, metalGlint, bareMetalMask);
    }

    vec3 finalColor = rampColor + clearcoatSpec;
    gl_FragColor = vec4(clamp(finalColor, 0.0, 1.0), 1.0);
  }
`;

// ============================================================================
// 4. OpenSCAD Code & STL Binary Exporter Helpers
// ============================================================================

export function generateUpdatedOpenScadSource(p: PauldronScadParams): string {
  return `// ==========================================
// 重装机甲肩甲 (GK-Mixer 3D 节点台实时同步参数 + 实体战损凹坑)
// ==========================================

render_mode = "${p.renderMode}"; // [all, blue_only, gold_only]
mesh_resolution = ${p.meshResolution}; // [60:12:360]

width = ${p.width}; // 左右总宽度 (X轴)
depth = ${p.depth}; // 前后总深度 (Y轴)
height = ${p.height}; // 上下总高度 (Z轴)
dome_ratio = ${p.domeRatio}; // 穹顶高度占比
bottom_flare = ${p.bottomFlare}; // 下部开口外扩系数
arch_cut_offset = ${p.archCutOffset}; // 侧边框前后切面偏移

shell_thickness = ${p.shellThickness}; // 主装甲壳体厚度
trim_relief = ${p.trimRelief}; // 外框凸起高度
bottom_trim_width = ${p.bottomTrimWidth}; // 底部横边外框宽度
side_trim_width = ${p.sideTrimWidth}; // 侧面竖边外框宽度
bottom_tilt_angle = ${p.bottomTiltAngle}; // 底部开口边缘倾斜角

// 实体战损弹坑与链锯劈砍凹槽 (CSG Boolean Difference)
battle_damage_enabled = ${p.battleDamageEnabled ? "true" : "false"};
damage_count = ${p.damageCount}; // 弹坑/劈砍数量 [1:1:6]
damage_depth = ${p.damageDepth}; // 凹陷深度系数 [0.2:0.05:1.0]
damage_seed = ${p.damageSeed}; // 随机排布种子
`;
}

function exportMeshesToAsciiStl(meshes: THREE.Mesh[], filename: string) {
  const lines: string[] = ["solid space_marine_pauldron"];
  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();
  const cb = new THREE.Vector3();
  const ab = new THREE.Vector3();

  for (const mesh of meshes) {
    if (!mesh.visible) continue;
    const geom = mesh.geometry;
    const pos = geom.getAttribute("position");
    if (!pos) continue;
    mesh.updateMatrixWorld();

    for (let i = 0; i < pos.count; i += 3) {
      vA.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      vB.fromBufferAttribute(pos, i + 1).applyMatrix4(mesh.matrixWorld);
      vC.fromBufferAttribute(pos, i + 2).applyMatrix4(mesh.matrixWorld);
      cb.subVectors(vC, vB);
      ab.subVectors(vA, vB);
      cb.cross(ab).normalize();
      lines.push(`facet normal ${cb.x.toFixed(5)} ${cb.y.toFixed(5)} ${cb.z.toFixed(5)}`);
      lines.push("  outer loop");
      lines.push(`    vertex ${vA.x.toFixed(4)} ${vA.y.toFixed(4)} ${vA.z.toFixed(4)}`);
      lines.push(`    vertex ${vB.x.toFixed(4)} ${vB.y.toFixed(4)} ${vB.z.toFixed(4)}`);
      lines.push(`    vertex ${vC.x.toFixed(4)} ${vC.y.toFixed(4)} ${vC.z.toFixed(4)}`);
      lines.push("  endloop");
      lines.push("endfacet");
    }
  }
  lines.push("endsolid space_marine_pauldron");

  const blob = new Blob([lines.join("\n")], { type: "model/stl" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// ============================================================================
// 5. Main Component: <ShoulderPad3DStudio />
//    Left & Right Column Dropdown Layout (Zero Center Obstruction)
// ============================================================================

export interface ShoulderPad3DStudioProps {
  activeHex: string;
  activePaintMeta?: { brand?: string; code?: string; name?: string };
  customShadeHex?: string | null;
  customHighlightHex?: string | null;
  findClosestPaintLabel?: (hex: string) => string | null;
  onCaptureTo2DCanvas?: (dataUrl: string, label: string) => void;
  onSelectRampStepHex?: (hex: string) => void;
  isBlueprint?: boolean;
}

export const ShoulderPad3DStudio: React.FC<ShoulderPad3DStudioProps> = ({
  activeHex,
  activePaintMeta,
  customShadeHex,
  customHighlightHex,
  findClosestPaintLabel,
  onCaptureTo2DCanvas,
  onSelectRampStepHex,
}) => {
  const studioRootRef = useRef<HTMLDivElement | null>(null);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const blueMeshRef = useRef<THREE.Mesh | null>(null);
  const goldMeshRef = useRef<THREE.Mesh | null>(null);
  const customMeshRef = useRef<THREE.Mesh | null>(null);
  const blueMatRef = useRef<THREE.ShaderMaterial | null>(null);
  const goldMatRef = useRef<THREE.ShaderMaterial | null>(null);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);

  // Active part being edited ("blue" = 主装甲, "gold" = 金色外框)
  const [selectedPart, setSelectedPart] = useState<"blue" | "gold">("blue");
  const [isCompactViewport, setIsCompactViewport] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth < 640 : false
  );

  // Touch single-finger gesture mode ("rotate" = 360°旋转, "pan" = 画面平移; two-finger always pinch-zooms & pans)
  const [touchMode, setTouchMode] = useState<"rotate" | "pan">("rotate");
  const [cameraZoomPct, setCameraZoomPct] = useState<number>(100);

  // Portal slots in parent ColoringSandboxLab (Row 3 zoom/touch bar + Mobile below-staging dropdown container)
  const [portalSlots, setPortalSlots] = useState<{
    row3El: HTMLElement | null;
    belowStagingEl: HTMLElement | null;
  }>({ row3El: null, belowStagingEl: null });

  useEffect(() => {
    if (typeof document === "undefined") return;
    setPortalSlots({
      row3El: document.getElementById("gk-3d-row3-controls-slot"),
      belowStagingEl: document.getElementById("gk-3d-mobile-below-staging-slot"),
    });
  }, []);

  // Mobile Portrait (< 1024px) Below-Staging 4 Dropdown Panels Open/Collapsed State
  const [mobileOpenPanels, setMobileOpenPanels] = useState<{
    part: boolean;
    shader: boolean;
    scad: boolean;
    nodes: boolean;
  }>({
    part: true,
    shader: false,
    scad: false,
    nodes: false,
  });

  // Desktop (>= 1024px) Open/Collapsed state for each floating window inside the canvas
  const [openWindows, setOpenWindows] = useState<{
    part: boolean;
    scad: boolean;
    shader: boolean;
    nodes: boolean;
  }>({
    part: true,
    scad: false,
    shader: true,
    nodes: false,
  });

  // Free-draggable & resizable window states (matching ColoringSandboxLab's 📌 备选与已涂漆号 window)
  type WindowId = "part" | "scad" | "shader" | "nodes";
  interface FloatingWinBox {
    x: number | null; // null = docked in default left/right column
    y: number | null;
    w: number;
    h: number;
    z: number;
  }

  const [winBoxes, setWinBoxes] = useState<Record<WindowId, FloatingWinBox>>({
    part: { x: null, y: null, w: 248, h: 340, z: 21 },
    scad: { x: null, y: null, w: 248, h: 320, z: 20 },
    shader: { x: null, y: null, w: 256, h: 360, z: 22 },
    nodes: { x: null, y: null, w: 248, h: 240, z: 19 },
  });

  const winDomRefs = useRef<Record<WindowId, HTMLDivElement | null>>({
    part: null,
    scad: null,
    shader: null,
    nodes: null,
  });

  const dragSessionRef = useRef<{
    id: WindowId;
    mode: "move" | "resize-bl" | "resize-b" | "resize-br";
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  } | null>(null);

  const bringWindowToFront = useCallback((id: WindowId) => {
    setWinBoxes((prev) => {
      const maxZ = Math.max(prev.part.z, prev.scad.z, prev.shader.z, prev.nodes.z);
      if (prev[id].z === maxZ) return prev;
      return {
        ...prev,
        [id]: { ...prev[id], z: maxZ + 1 },
      };
    });
  }, []);

  const toggleWindowOpen = useCallback(
    (id: WindowId) => {
      bringWindowToFront(id);
      setOpenWindows((prev) => {
        const nextOpen = !prev[id];
        // On narrow mobile viewports, only keep one window expanded at a time so they never overlap
        if (isCompactViewport && nextOpen) {
          return {
            part: id === "part",
            scad: id === "scad",
            shader: id === "shader",
            nodes: id === "nodes",
          };
        }
        return { ...prev, [id]: nextOpen };
      });
    },
    [bringWindowToFront, isCompactViewport]
  );

  const startWindowDrag = (
    e: React.PointerEvent<HTMLElement>,
    id: WindowId,
    mode: "move" | "resize-bl" | "resize-b" | "resize-br"
  ) => {
    e.stopPropagation();
    const rootEl = studioRootRef.current;
    const winEl = winDomRefs.current[id];
    if (!rootEl || !winEl) return;

    bringWindowToFront(id);
    const rootRect = rootEl.getBoundingClientRect();
    const winRect = winEl.getBoundingClientRect();
    const currentBox = winBoxes[id];

    const startX = currentBox.x !== null ? currentBox.x : Math.max(6, winRect.left - rootRect.left);
    const startY = currentBox.y !== null ? currentBox.y : Math.max(6, winRect.top - rootRect.top);

    dragSessionRef.current = {
      id,
      mode,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX,
      startY,
      startW: currentBox.w,
      startH: currentBox.h,
    };

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const moveWindowDrag = (e: React.PointerEvent<HTMLElement>) => {
    const sess = dragSessionRef.current;
    const rootEl = studioRootRef.current;
    if (!sess || !rootEl) return;
    e.stopPropagation();

    const dx = e.clientX - sess.startClientX;
    const dy = e.clientY - sess.startClientY;
    if (sess.mode === "move" && Math.hypot(dx, dy) < 3 && winBoxes[sess.id].x === null) {
      return;
    }

    const rootW = rootEl.clientWidth || 360;
    const rootH = rootEl.clientHeight || 420;

    setWinBoxes((prev) => {
      const box = prev[sess.id];
      if (sess.mode === "move") {
        const nextX = clamp(Math.round(sess.startX + dx), 6, Math.max(6, rootW - box.w - 6));
        const nextY = clamp(Math.round(sess.startY + dy), 6, Math.max(6, rootH - 42));
        return {
          ...prev,
          [sess.id]: { ...box, x: nextX, y: nextY },
        };
      }

      let nextW = sess.startW;
      let nextH = clamp(Math.round(sess.startH + dy), 160, Math.max(200, rootH - 56));
      let nextX = box.x;

      if (sess.mode === "resize-br") {
        nextW = clamp(Math.round(sess.startW + dx), 200, Math.min(360, rootW - 16));
      } else if (sess.mode === "resize-bl") {
        nextW = clamp(Math.round(sess.startW - dx), 200, Math.min(360, rootW - 16));
        if (box.x !== null) {
          nextX = clamp(Math.round(sess.startX + (sess.startW - nextW)), 6, Math.max(6, rootW - nextW - 6));
        }
      }

      return {
        ...prev,
        [sess.id]: { ...box, x: nextX, w: nextW, h: nextH },
      };
    });
  };

  const endWindowDrag = (e: React.PointerEvent<HTMLElement>) => {
    if (!dragSessionRef.current) return;
    e.stopPropagation();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    dragSessionRef.current = null;
  };

  const resetWindowPosition = (id: WindowId) => {
    setWinBoxes((prev) => ({
      ...prev,
      [id]: { ...prev[id], x: null, y: null, w: id === "shader" ? 256 : 248 },
    }));
  };

  const [scadParams, setScadParams] = useState<PauldronScadParams>(DEFAULT_PAULDRON_SCAD_PARAMS);
  const [shaderParams, setShaderParams] = useState<BlenderShaderParams>(DEFAULT_BLENDER_SHADER_PARAMS);
  const [copiedScad, setCopiedScad] = useState(false);
  const [importedModelName, setImportedModelName] = useState<string | null>(null);

  // Default to volumetric cobalt/ice-blue armor + classical gold trim (copyright-safe archetype)
  const [activePresetId, setActivePresetId] = useState<string>("ref_stipple_blue");
  const [blueBaseHex, setBlueBaseHex] = useState<string>("#2B6CB0");
  const [bluePaintLabel, setBluePaintLabel] = useState<string>("极寒冰蓝体积光 #2B6CB0");
  const [goldBaseHex, setGoldBaseHex] = useState<string>("#D99B26");
  const [goldPaintLabel, setGoldPaintLabel] = useState<string>("圣典暖金外框 #D99B26");
  const [blueRampOverride, setBlueRampOverride] = useState<PartColorRampConfig | null>(
    CHAPTER_PAINT_PRESETS[0].blueRampOverride || null
  );
  const [goldRampOverride, setGoldRampOverride] = useState<PartColorRampConfig | null>(
    null
  );

  // Keep OpenSCAD 3D physical battle-damage CSG in sync with shaderParams.dentDamageEnabled & weatheringSeed
  useEffect(() => {
    setScadParams((prev) => {
      if (
        prev.battleDamageEnabled === shaderParams.dentDamageEnabled &&
        prev.damageSeed === shaderParams.weatheringSeed
      ) {
        return prev;
      }
      return {
        ...prev,
        battleDamageEnabled: shaderParams.dentDamageEnabled,
        damageSeed: shaderParams.weatheringSeed,
      };
    });
  }, [shaderParams.dentDamageEnabled, shaderParams.weatheringSeed]);

  const activeChapterPreset = useMemo(
    () => CHAPTER_PAINT_PRESETS.find((pr) => pr.id === activePresetId) || CHAPTER_PAINT_PRESETS[0],
    [activePresetId]
  );

  // Sync incoming color selections from the right-side paint panel to the currently selected armor part
  const prevActiveHexRef = useRef<string>(activeHex);
  useEffect(() => {
    if (!activeHex || activeHex.toUpperCase() === prevActiveHexRef.current.toUpperCase()) return;
    prevActiveHexRef.current = activeHex;
    const label =
      activePaintMeta?.brand || activePaintMeta?.code || activePaintMeta?.name
        ? `${activePaintMeta.brand || ""} ${activePaintMeta.code || ""} ${activePaintMeta.name || ""}`.trim()
        : activeHex.toUpperCase();

    if (selectedPart === "blue") {
      setBlueBaseHex(activeHex.toUpperCase());
      setBluePaintLabel(label);
      setBlueRampOverride(null);
    } else {
      setGoldBaseHex(activeHex.toUpperCase());
      setGoldPaintLabel(label);
      setGoldRampOverride(null);
    }
  }, [activeHex, activePaintMeta, selectedPart]);

  // Derived 5-stop ColorRamps for both parts (uses authentic Citadel/'Eavy Archive 5-color override when preset active)
  const blueRamp = useMemo(() => {
    if (blueRampOverride && !(selectedPart === "blue" && (customShadeHex || customHighlightHex))) {
      return blueRampOverride;
    }
    return deriveMiniatureColorRamp(
      blueBaseHex,
      shaderParams.naturalWarmCoolShift,
      selectedPart === "blue" && customShadeHex ? customShadeHex : undefined,
      selectedPart === "blue" && customHighlightHex ? customHighlightHex : undefined
    );
  }, [blueRampOverride, blueBaseHex, shaderParams.naturalWarmCoolShift, selectedPart, customShadeHex, customHighlightHex]);

  const goldRamp = useMemo(() => {
    if (goldRampOverride && !(selectedPart === "gold" && (customShadeHex || customHighlightHex))) {
      return goldRampOverride;
    }
    return deriveMiniatureColorRamp(
      goldBaseHex,
      shaderParams.naturalWarmCoolShift,
      selectedPart === "gold" && customShadeHex ? customShadeHex : undefined,
      selectedPart === "gold" && customHighlightHex ? customHighlightHex : undefined
    );
  }, [goldRampOverride, goldBaseHex, shaderParams.naturalWarmCoolShift, selectedPart, customShadeHex, customHighlightHex]);

  const activeRamp = selectedPart === "blue" ? blueRamp : goldRamp;

  const createShaderMaterial = useCallback((ramp: PartColorRampConfig) => {
    return new THREE.ShaderMaterial({
      vertexShader: BLENDER_NPR_VERTEX_SHADER,
      fragmentShader: BLENDER_NPR_FRAGMENT_SHADER,
      side: THREE.DoubleSide,
      extensions: { derivatives: true } as any,
      uniforms: {
        uColorShadowDeep: { value: new THREE.Color(ramp.shadowDeepHex) },
        uColorShadow: { value: new THREE.Color(ramp.shadowHex) },
        uColorBase: { value: new THREE.Color(ramp.baseHex) },
        uColorHighlight: { value: new THREE.Color(ramp.highlightHex) },
        uColorSpecular: { value: new THREE.Color(ramp.specularHex) },
        uLightDir: { value: new THREE.Vector3(0.36, 0.72, 0.59).normalize() },
        uRampStyle: { value: 3 },
        uColorSteps: { value: 5 },
        uClearcoatMode: { value: 1 },
        uShadowStop: { value: 0.31 },
        uHighlightStop: { value: 0.64 },
        uAoStrength: { value: 0.86 },
        uEdgeStrength: { value: 0.85 },
        uZenithalFocus: { value: 0.74 },
        uBrushStipple: { value: 0.68 },
        uSprayGuideMode: { value: 0 },
        uEdgeLineEnabled: { value: 1 },
        uWhiteHotspotEnabled: { value: 1 },
        uGrimeStainEnabled: { value: 0 },
        uMetalChippingEnabled: { value: 0 },
        uScratchesEnabled: { value: 0 },
        uDentDamageEnabled: { value: 0 },
        uHotspotSize: { value: 0.56 },
        uGrimeDensity: { value: 0.25 },
        uGrimeStrength: { value: 0.52 },
        uChipDensity: { value: 0.22 },
        uChipScale: { value: 0.48 },
        uScratchDensity: { value: 0.20 },
        uScratchScale: { value: 0.50 },
        uWeatheringSeed: { value: 18.0 },
        uWeatheringIntensity: { value: 0.35 },
      },
    });
  }, []);

  // Initialize Three.js Scene, Camera, OrbitControls, and Raycaster
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const width = Math.max(300, container.clientWidth);
    const height = Math.max(280, container.clientHeight);

    const camera = new THREE.PerspectiveCamera(32, width / height, 1, 1000);
    // Heroic 3/4 front-side angle showing the convex shoulder dome, bottom gold trim, and side gold arch
    camera.position.set(48, 22, 54);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.domElement.style.touchAction = "none";
    container.innerHTML = "";
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.screenSpacePanning = true;
    controls.rotateSpeed = 0.85;
    controls.zoomSpeed = 1.15;
    controls.panSpeed = 0.9;
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };
    controls.target.set(0, 0, 2);
    controls.minDistance = 22;
    controls.maxDistance = 165;
    controls.update();
    controlsRef.current = controls;

    const defaultCamDist = Math.hypot(48, 22, 52);
    const handleControlsChange = () => {
      const dist = camera.position.distanceTo(controls.target);
      if (dist > 0.1) {
        const pct = Math.round(Math.max(45, Math.min(340, (defaultCamDist / dist) * 100)));
        setCameraZoomPct((prev) => (Math.abs(prev - pct) >= 2 ? pct : prev));
      }
    };
    controls.addEventListener("change", handleControlsChange);

    // Subtle reference floor ring grid
    const gridHelper = new THREE.PolarGridHelper(32, 12, 6, 48, 0x475569, 0x334155);
    gridHelper.position.set(0, -19.5, 0);
    (gridHelper.material as THREE.Material).transparent = true;
    (gridHelper.material as THREE.Material).opacity = 0.22;
    scene.add(gridHelper);

    const blueMat = createShaderMaterial(blueRamp);
    const goldMat = createShaderMaterial(goldRamp);
    blueMatRef.current = blueMat;
    goldMatRef.current = goldMat;

    const { blueGeometry, goldGeometry } = buildSpaceMarinePauldronGeometries(DEFAULT_PAULDRON_SCAD_PARAMS);
    const blueMesh = new THREE.Mesh(blueGeometry, blueMat);
    const goldMesh = new THREE.Mesh(goldGeometry, goldMat);
    blueMesh.name = "blue";
    goldMesh.name = "gold";
    scene.add(blueMesh);
    scene.add(goldMesh);
    blueMeshRef.current = blueMesh;
    goldMeshRef.current = goldMesh;

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downX = 0;
    let downY = 0;
    let lastTapTime = 0;
    let lastTapX = 0;
    let lastTapY = 0;

    const onPointerDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 8) return;
      const now = performance.now();
      if (now - lastTapTime < 280 && Math.hypot(e.clientX - lastTapX, e.clientY - lastTapY) < 24) {
        camera.position.set(48, 22, 54);
        controls.target.set(0, 0, 2);
        controls.update();
        setCameraZoomPct(100);
        lastTapTime = 0;
        return;
      }
      lastTapTime = now;
      lastTapX = e.clientX;
      lastTapY = e.clientY;

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const targets = [goldMesh, blueMesh].filter((m) => m.visible);
      const hits = raycaster.intersectObjects(targets, false);
      if (hits.length > 0) {
        const hitName = hits[0].object.name;
        if (hitName === "gold" || hitName === "blue") {
          setSelectedPart(hitName);
        }
      }
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(260, entry.contentRect.width);
        const h = Math.max(240, entry.contentRect.height);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        const compact = w < 560;
        setIsCompactViewport(compact);
        if (compact) {
          setOpenWindows((prev) => {
            const openKeys = (["part", "scad", "shader", "nodes"] as const).filter((k) => prev[k]);
            if (openKeys.length > 1) {
              return { part: false, scad: false, shader: false, nodes: false };
            }
            return prev;
          });
        }
      }
    });
    ro.observe(container);

    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
      controls.removeEventListener("change", handleControlsChange);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      controls.dispose();
      blueGeometry.dispose();
      goldGeometry.dispose();
      blueMat.dispose();
      goldMat.dispose();
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync single-finger touch gesture mode (Rotate vs Pan) with OrbitControls
  useEffect(() => {
    if (!controlsRef.current) return;
    controlsRef.current.touches.ONE =
      touchMode === "pan" ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE;
  }, [touchMode]);

  // Rebuild OpenSCAD Geometry in real time when scadParams change
  useEffect(() => {
    const blueMesh = blueMeshRef.current;
    const goldMesh = goldMeshRef.current;
    if (!blueMesh || !goldMesh) return;

    if (importedModelName && customMeshRef.current) {
      blueMesh.visible = false;
      goldMesh.visible = false;
      customMeshRef.current.visible = true;
      return;
    }

    if (customMeshRef.current) {
      customMeshRef.current.visible = false;
    }

    const { blueGeometry, goldGeometry } = buildSpaceMarinePauldronGeometries(scadParams);
    blueMesh.geometry.dispose();
    goldMesh.geometry.dispose();
    blueMesh.geometry = blueGeometry;
    goldMesh.geometry = goldGeometry;

    blueMesh.visible = scadParams.renderMode === "all" || scadParams.renderMode === "blue_only";
    goldMesh.visible = scadParams.renderMode === "all" || scadParams.renderMode === "gold_only";
  }, [scadParams, importedModelName]);

  // Update Shader Uniforms in real time when colors or shaderParams change
  useEffect(() => {
    const updateMatUniforms = (mat: THREE.ShaderMaterial | null, ramp: PartColorRampConfig) => {
      if (!mat) return;
      mat.uniforms.uColorShadowDeep.value.set(ramp.shadowDeepHex);
      mat.uniforms.uColorShadow.value.set(ramp.shadowHex);
      mat.uniforms.uColorBase.value.set(ramp.baseHex);
      mat.uniforms.uColorHighlight.value.set(ramp.highlightHex);
      mat.uniforms.uColorSpecular.value.set(ramp.specularHex);

      const az = (shaderParams.lightAzimuthDeg * Math.PI) / 180;
      const el = (shaderParams.lightElevationDeg * Math.PI) / 180;
      const lx = Math.cos(el) * Math.sin(az);
      const ly = Math.sin(el);
      const lz = Math.cos(el) * Math.cos(az);
      mat.uniforms.uLightDir.value.set(lx, ly, lz).normalize();

      mat.uniforms.uRampStyle.value =
        shaderParams.rampStyle === "airbrush"
          ? 0
          : shaderParams.rampStyle === "stepped"
          ? 1
          : shaderParams.rampStyle === "nmm"
          ? 2
          : shaderParams.rampStyle === "eavy-metal"
          ? 4
          : 3;
      mat.uniforms.uColorSteps.value = shaderParams.colorSteps;
      mat.uniforms.uClearcoatMode.value =
        shaderParams.clearcoatMode === "matte" ? 0 : shaderParams.clearcoatMode === "satin" ? 1 : 2;
      mat.uniforms.uShadowStop.value = shaderParams.shadowStop;
      mat.uniforms.uHighlightStop.value = shaderParams.highlightStop;
      mat.uniforms.uAoStrength.value = shaderParams.aoStrength;
      mat.uniforms.uEdgeStrength.value = shaderParams.edgeHighlightStrength;
      mat.uniforms.uZenithalFocus.value = shaderParams.zenithalFocus;
      mat.uniforms.uBrushStipple.value = shaderParams.brushStipple;
      mat.uniforms.uSprayGuideMode.value = shaderParams.sprayGuideMode ? 1 : 0;
      mat.uniforms.uEdgeLineEnabled.value = shaderParams.edgeLineEnabled ? 1 : 0;
      mat.uniforms.uWhiteHotspotEnabled.value = shaderParams.whiteHotspotEnabled ? 1 : 0;
      mat.uniforms.uGrimeStainEnabled.value = shaderParams.grimeStainEnabled ? 1 : 0;
      mat.uniforms.uMetalChippingEnabled.value = shaderParams.metalChippingEnabled ? 1 : 0;
      mat.uniforms.uScratchesEnabled.value = shaderParams.scratchesEnabled ? 1 : 0;
      mat.uniforms.uDentDamageEnabled.value = shaderParams.dentDamageEnabled ? 1 : 0;
      mat.uniforms.uHotspotSize.value = shaderParams.hotspotSize;
      mat.uniforms.uGrimeDensity.value = shaderParams.grimeDensity;
      mat.uniforms.uGrimeStrength.value = shaderParams.grimeStrength;
      mat.uniforms.uChipDensity.value = shaderParams.chipDensity;
      mat.uniforms.uChipScale.value = shaderParams.chipScale;
      mat.uniforms.uScratchDensity.value = shaderParams.scratchDensity;
      mat.uniforms.uScratchScale.value = shaderParams.scratchScale;
      mat.uniforms.uWeatheringSeed.value = shaderParams.weatheringSeed;
      mat.uniforms.uWeatheringIntensity.value = shaderParams.weatheringIntensity;
    };

    updateMatUniforms(blueMatRef.current, blueRamp);
    updateMatUniforms(goldMatRef.current, goldRamp);
  }, [blueRamp, goldRamp, shaderParams]);

  // Handle importing external .STL or .GLB 3D files
  const handleImport3DFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !sceneRef.current || !blueMatRef.current) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    const reader = new FileReader();

    reader.onload = () => {
      const buffer = reader.result as ArrayBuffer;
      if (!buffer || !sceneRef.current || !blueMatRef.current) return;

      const attachCustomGeometry = (geom: THREE.BufferGeometry) => {
        geom.computeVertexNormals();
        geom.computeBoundingBox();
        const box = geom.boundingBox!;
        const center = new THREE.Vector3();
        box.getCenter(center);
        geom.translate(-center.x, -center.y, -center.z);
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z, 1);
        const scale = 42 / maxDim;
        geom.scale(scale, scale, scale);

        if (customMeshRef.current && sceneRef.current) {
          sceneRef.current.remove(customMeshRef.current);
          customMeshRef.current.geometry.dispose();
        }
        const customMesh = new THREE.Mesh(geom, blueMatRef.current!);
        customMesh.name = "blue";
        sceneRef.current!.add(customMesh);
        customMeshRef.current = customMesh;
        setSelectedPart("blue");
        setImportedModelName(file.name);
      };

      if (ext === "stl") {
        const loader = new STLLoader();
        const geom = loader.parse(buffer);
        attachCustomGeometry(geom);
      } else if (ext === "glb" || ext === "gltf") {
        const loader = new GLTFLoader();
        loader.parse(buffer, "", (gltf) => {
          let foundGeom: THREE.BufferGeometry | null = null;
          gltf.scene.traverse((child) => {
            if (!foundGeom && (child as THREE.Mesh).isMesh) {
              foundGeom = (child as THREE.Mesh).geometry.clone();
            }
          });
          if (foundGeom) attachCustomGeometry(foundGeom);
        });
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const resetCamera = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    cameraRef.current.position.set(48, 22, 54);
    controlsRef.current.target.set(0, 0, 2);
    controlsRef.current.update();
    setCameraZoomPct(100);
  };

  const zoom3DByFactor = (factor: number) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const offset = camera.position.clone().sub(controls.target);
    const currentDist = Math.max(0.1, offset.length());
    const nextDist = Math.max(
      controls.minDistance,
      Math.min(controls.maxDistance, currentDist * factor)
    );
    offset.normalize().multiplyScalar(nextDist);
    camera.position.copy(controls.target).add(offset);
    controls.update();
    const defaultDist = Math.hypot(48, 22, 52);
    setCameraZoomPct(Math.round((defaultDist / nextDist) * 100));
  };

  const setCameraViewPreset = (preset: "hero" | "front" | "side" | "top") => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    controls.target.set(0, 0, 2);
    if (preset === "hero") {
      camera.position.set(48, 22, 54);
    } else if (preset === "front") {
      camera.position.set(0, 8, 74);
    } else if (preset === "side") {
      camera.position.set(74, 8, 2);
    } else if (preset === "top") {
      camera.position.set(0, 74, 14);
    }
    controls.update();
    setCameraZoomPct(100);
  };

  const toggleMobilePanel = (id: WindowId) => {
    setMobileOpenPanels((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCaptureSnapshot = () => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!renderer || !scene || !camera || !onCaptureTo2DCanvas) return;
    renderer.render(scene, camera);
    const dataUrl = renderer.domElement.toDataURL("image/png");
    onCaptureTo2DCanvas(dataUrl, `3D肩甲预览_${bluePaintLabel}`);
  };

  const rampStepsList = useMemo(() => {
    if (shaderParams.colorSteps === 3) {
      return [
        { role: "凹槽与背光暗部", tag: "暗部 Z1", hex: activeRamp.shadowHex },
        { role: "中段受光主色", tag: "主色 Z2", hex: activeRamp.baseHex },
        { role: "45°天顶与棱边高光", tag: "高光 Z3/Z4", hex: activeRamp.highlightHex },
      ];
    }
    return [
      { role: "深凹槽渗线暗部", tag: "-25%L 深暗", hex: activeRamp.shadowDeepHex },
      { role: "背光过渡暗部", tag: "-13%L 微暗", hex: activeRamp.shadowHex },
      { role: "装甲大面主色", tag: "0%L 主色", hex: activeRamp.baseHex },
      { role: "45°受光冰蓝提亮", tag: "+16%L 提亮", hex: activeRamp.highlightHex },
      { role: "极亮中心与C面棱边", tag: "+31%L 极亮", hex: activeRamp.specularHex },
    ];
  }, [activeRamp, shaderParams.colorSteps]);

  // Helper to render a Screenshot-2 style Solid Opaque Free-Draggable & Resizable Window
  const renderStudioWindow = (
    id: WindowId,
    headerIcon: React.ReactNode,
    title: string,
    badgeText: string,
    badgeClass: string,
    bodyContent: React.ReactNode
  ) => {
    const isOpen = openWindows[id];
    const box = winBoxes[id];
    const isDetached = box.x !== null && box.y !== null;
    const effectiveWidth = isCompactViewport ? Math.min(box.w, 240) : box.w;

    return (
      <div
        key={id}
        ref={(el) => {
          winDomRefs.current[id] = el;
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          bringWindowToFront(id);
        }}
        onTouchStart={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        style={
          isDetached
            ? {
                position: "absolute",
                left: `${box.x}px`,
                top: `${box.y}px`,
                width: `${effectiveWidth}px`,
                zIndex: box.z,
              }
            : {
                width: `${effectiveWidth}px`,
                zIndex: box.z,
              }
        }
        className="pointer-events-auto flex flex-col select-none overflow-hidden shrink-0 rounded-[6px] border-[1.5px] border-slate-900 dark:border-slate-500 bg-white dark:bg-[#111827] shadow-[3px_3px_0px_#0F172A] dark:shadow-[3px_3px_0px_#020617]"
      >
        {/* Draggable Header Bar */}
        <div
          onPointerDown={(e) => startWindowDrag(e, id, "move")}
          onPointerMove={moveWindowDrag}
          onPointerUp={endWindowDrag}
          onPointerCancel={endWindowDrag}
          onDoubleClick={() => resetWindowPosition(id)}
          title="按住标题栏可自由拖动窗口位置 · 双击标题栏复位默认位置 · 拖拽底部边角可调节宽高"
          className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 cursor-grab active:cursor-grabbing touch-none bg-white dark:bg-[#111827] ${
            isOpen ? "border-b border-dashed border-slate-300 dark:border-slate-700" : ""
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="text-slate-400 dark:text-slate-500 text-xs font-black shrink-0">
              ⠿
            </span>
            {headerIcon}
            <span className="text-[11px] font-black text-slate-900 dark:text-slate-100 truncate">
              {title}
            </span>
          </div>

          <div
            className="flex items-center gap-1 shrink-0"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {badgeText && (
              <span className={`font-mono text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${badgeClass}`}>
                {badgeText}
              </span>
            )}
            <button
              type="button"
              onClick={() => toggleWindowOpen(id)}
              className="px-2 py-0.5 rounded-[5px] border-[1.5px] border-slate-900 dark:border-slate-500 bg-white dark:bg-slate-800 text-[10px] font-extrabold text-slate-800 dark:text-slate-100 shadow-[1.5px_1.5px_0px_#0F172A] hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer whitespace-nowrap"
            >
              {isOpen ? "▴ 收起" : "▾ 展开"}
            </button>
          </div>
        </div>

        {/* Expanded Body + Dedicated Bottom Resize Bar */}
        {isOpen && (
          <div className="flex flex-col min-h-0 bg-white dark:bg-[#111827]">
            {/* Scrollable Body with extra right padding so scrollbar NEVER overlaps button black shadows */}
            <div
              style={{ maxHeight: `${isCompactViewport ? Math.min(box.h, 240) : box.h}px` }}
              className="overflow-y-auto pl-2.5 pr-3.5 py-2.5"
            >
              <div className="pr-1 space-y-2.5">{bodyContent}</div>
            </div>

            {/* Dedicated Bottom Resize Bar (◣  ══  ◢) */}
            <div className="h-[18px] shrink-0 flex items-center justify-between select-none touch-none border-t border-dashed border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
              <div
                onPointerDown={(e) => startWindowDrag(e, id, "resize-bl")}
                onPointerMove={moveWindowDrag}
                onPointerUp={endWindowDrag}
                onPointerCancel={endWindowDrag}
                title="拖拽左下角调整窗口宽高"
                className="h-full w-7 pl-1.5 flex items-center justify-start cursor-nesw-resize text-[10px] font-mono font-black text-slate-400 hover:text-[var(--accent-color)]"
              >
                ◣
              </div>
              <div
                onPointerDown={(e) => startWindowDrag(e, id, "resize-b")}
                onPointerMove={moveWindowDrag}
                onPointerUp={endWindowDrag}
                onPointerCancel={endWindowDrag}
                title="上下拖拽调整窗口高度"
                className="h-full flex-1 flex items-center justify-center cursor-ns-resize text-[9px] font-mono text-slate-300 dark:text-slate-600 hover:text-slate-500"
              >
                ══
              </div>
              <div
                onPointerDown={(e) => startWindowDrag(e, id, "resize-br")}
                onPointerMove={moveWindowDrag}
                onPointerUp={endWindowDrag}
                onPointerCancel={endWindowDrag}
                title="拖拽右下角调整窗口宽高"
                className="h-full w-7 pr-1.5 flex items-center justify-end cursor-nwse-resize text-[10px] font-mono font-black text-slate-400 hover:text-[var(--accent-color)]"
              >
                ◢
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Content for Window 1: 部件与色阶向导
  const partWindowBody = (
    <>
      {/* Active Part Switcher */}
      <div className="space-y-1">
        <div className="text-[9.5px] font-bold text-slate-500 dark:text-slate-400">
          点击切换当前受控部件（同步右侧选漆）
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedPart("blue")}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-[5px] text-[10.5px] font-black border-[1.5px] transition cursor-pointer whitespace-nowrap ${
              selectedPart === "blue"
                ? "border-slate-900 bg-[var(--accent-color)] text-white shadow-[1.5px_1.5px_0px_#0F172A]"
                : "border-slate-900 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-[1.5px_1.5px_0px_#0F172A]"
            }`}
          >
            <span
              className="w-2.5 h-2.5 rounded-full border border-white shrink-0"
              style={{ backgroundColor: blueBaseHex }}
            />
            <span>主装甲壳</span>
          </button>

          {!importedModelName && (
            <button
              type="button"
              onClick={() => setSelectedPart("gold")}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-[5px] text-[10.5px] font-black border-[1.5px] transition cursor-pointer whitespace-nowrap ${
                selectedPart === "gold"
                  ? "border-slate-900 bg-[var(--accent-color)] text-white shadow-[1.5px_1.5px_0px_#0F172A]"
                  : "border-slate-900 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-[1.5px_1.5px_0px_#0F172A]"
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full border border-white shrink-0"
                style={{ backgroundColor: goldBaseHex }}
              />
              <span>外框金边</span>
            </button>
          )}
        </div>
      </div>

      {/* Render Mode (All / Blue Only / Gold Only) */}
      {!importedModelName ? (
        <div className="grid grid-cols-3 gap-1 p-0.5 rounded-[5px] border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
          {(
            [
              { id: "all", label: "整体显示" },
              { id: "blue_only", label: "仅主甲" },
              { id: "gold_only", label: "仅金框" },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setScadParams((p) => ({ ...p, renderMode: m.id }))}
              className={`py-1 rounded-[4px] text-[10px] font-extrabold transition cursor-pointer whitespace-nowrap ${
                scadParams.renderMode === m.id
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setImportedModelName(null)}
          className="w-full py-1 rounded-[5px] border border-amber-500 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[10px] font-black cursor-pointer"
        >
          ↺ 恢复内置机甲肩甲
        </button>
      )}

      {/* Classic Legion Archetype Presets (Copyright-Safe) */}
      <div className="space-y-1">
        <div className="text-[9.5px] font-bold text-slate-500 dark:text-slate-400">
          经典军团涂装流派预设（含五阶色谱配方）
        </div>
        <div className="grid grid-cols-1 gap-1.5">
          {CHAPTER_PAINT_PRESETS.map((pr) => {
            const isActivePreset = activePresetId === pr.id;
            return (
              <button
                key={pr.id}
                type="button"
                onClick={() => {
                  setActivePresetId(pr.id);
                  setBlueBaseHex(pr.blueHex);
                  setGoldBaseHex(pr.goldHex);
                  setBluePaintLabel(pr.name);
                  setBlueRampOverride(pr.blueRampOverride || null);
                  setGoldRampOverride(pr.goldRampOverride || null);
                  setShaderParams((p) => ({
                    ...p,
                    rampStyle: pr.rampStyle,
                    brushStipple: pr.stipple,
                    clearcoatMode: pr.clearcoat,
                    edgeHighlightStrength: pr.edgeStrength,
                    aoStrength: pr.aoStrength,
                    zenithalFocus: pr.zenithalFocus,
                  }));
                }}
                className={`flex items-center justify-between px-2 py-1.5 rounded-[5px] border-[1.5px] text-[10px] font-extrabold transition cursor-pointer ${
                  isActivePreset
                    ? "border-slate-900 bg-[var(--accent-soft)] text-[var(--accent-color)] shadow-[1.5px_1.5px_0px_#0F172A]"
                    : "border-slate-900 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-[var(--accent-soft)] text-slate-800 dark:text-slate-100 shadow-[1.5px_1.5px_0px_#0F172A]"
                }`}
              >
                <span className="truncate">{pr.name}</span>
                <span className="flex items-center gap-1 shrink-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full border border-black/30"
                    style={{ backgroundColor: pr.blueHex }}
                  />
                  <span
                    className="w-2.5 h-2.5 rounded-full border border-black/30"
                    style={{ backgroundColor: pr.goldHex }}
                  />
                </span>
              </button>
            );
          })}
        </div>

        {/* Copyright-Safe 5-Stage Legion Color Bar & Recipe Card (No external jump links) */}
        {activeChapterPreset && (
          <div className="mt-1.5 rounded-[5px] border-[1.5px] border-slate-900 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/90 p-2 space-y-1.5">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[9.5px] font-black text-slate-800 dark:text-slate-100 truncate">
                🎨 {activeChapterPreset.styleTag}
              </span>
              <span className="text-[8.5px] font-bold px-1.5 py-0.5 rounded bg-[var(--accent-soft)] text-[var(--accent-color)] shrink-0">
                5阶色谱
              </span>
            </div>

            {/* Interactive 5-Stop Swatch Strip for Main Armor */}
            <div className="grid grid-cols-5 gap-1">
              {[
                { label: "深暗", hex: blueRamp.shadowDeepHex },
                { label: "微暗", hex: blueRamp.shadowHex },
                { label: "主色", hex: blueRamp.baseHex },
                { label: "提亮", hex: blueRamp.highlightHex },
                { label: "极亮", hex: blueRamp.specularHex },
              ].map((sw) => (
                <button
                  key={sw.label}
                  type="button"
                  onClick={() => onSelectRampStepHex?.(sw.hex)}
                  title={`点击吸取${sw.label}色 (${sw.hex})`}
                  className="group flex flex-col items-center rounded-[4px] border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-0.5 hover:border-slate-900 transition cursor-pointer"
                >
                  <span
                    className="w-full h-3.5 rounded-[2px] border border-black/15"
                    style={{ backgroundColor: sw.hex }}
                  />
                  <span className="text-[8px] font-black text-slate-600 dark:text-slate-300 mt-0.5">
                    {sw.label}
                  </span>
                </button>
              ))}
            </div>

            <div className="text-[8.5px] font-extrabold text-slate-700 dark:text-slate-200 leading-snug">
              {activeChapterPreset.archetypeNote}
            </div>
            <div className="text-[8.5px] font-bold text-slate-500 dark:text-slate-400 leading-snug">
              {activeChapterPreset.recipeSummary}
            </div>
          </div>
        )}
      </div>

      {/* 🎯 Novice Spray Zone Guide Switch */}
      <button
        type="button"
        onClick={() => setShaderParams((p) => ({ ...p, sprayGuideMode: !p.sprayGuideMode }))}
        className={`w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-[5px] text-[10.5px] font-black border-[1.5px] border-slate-900 dark:border-slate-500 transition cursor-pointer whitespace-nowrap ${
          shaderParams.sprayGuideMode
            ? "bg-amber-400 text-slate-950 shadow-[1.5px_1.5px_0px_#0F172A]"
            : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-[1.5px_1.5px_0px_#0F172A] hover:bg-amber-50"
        }`}
      >
        <TargetIcon className="w-3.5 h-3.5 shrink-0" weight="bold" />
        <span>{shaderParams.sprayGuideMode ? "🎯 喷涂区域向导: 开启" : "🎯 查看喷涂分布区域"}</span>
      </button>

      {shaderParams.sprayGuideMode && (
        <div className="rounded-[5px] border border-slate-700 bg-slate-900 text-slate-100 p-2 text-[9.5px] space-y-0.5 leading-relaxed">
          <div>• <b className="text-sky-300">Z1 斜纹槽</b>：喷/渗【暗部色】</div>
          <div>• <b className="text-white">Z2 白黄线间</b>：平喷【0%L 主色】</div>
          <div>• <b className="text-amber-300">Z3 黄线圆顶</b>：点拍提亮【高光色】</div>
          <div>• <b className="text-cyan-300">Z4 青色棱线</b>：侧锋点绘【极亮色】</div>
        </div>
      )}

      {/* Active Part ColorRamp Swatches Vertical List */}
      <div className="space-y-1">
        <div className="text-[9.5px] font-bold text-slate-500 dark:text-slate-400">
          当前部件 {shaderParams.colorSteps} 色阶推导（点击取色）
        </div>
        <div className="space-y-1.5">
          {rampStepsList.map((st) => {
            const matchedLabel = findClosestPaintLabel ? findClosestPaintLabel(st.hex) : null;
            return (
              <button
                key={st.tag}
                type="button"
                onClick={() => onSelectRampStepHex?.(st.hex)}
                className="w-full flex items-center gap-2 rounded-[5px] border-[1.5px] border-slate-900 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-left hover:bg-[var(--accent-soft)] shadow-[1.5px_1.5px_0px_#0F172A] transition cursor-pointer"
                title={`${st.role} (${st.hex}) — 点击设为当前选色`}
              >
                <span
                  className="h-3.5 w-3.5 rounded-[2px] border border-slate-900 dark:border-slate-300 shrink-0"
                  style={{ backgroundColor: st.hex }}
                />
                <div className="min-w-0 flex-1 flex items-center justify-between gap-1">
                  <span className="text-[9.5px] font-black text-slate-800 dark:text-slate-100 truncate">
                    {st.tag}
                  </span>
                  <span className="font-mono text-[8.5px] font-bold text-slate-500 dark:text-slate-400 truncate">
                    {matchedLabel || st.hex}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );

  // Content for Window 2: OpenSCAD 几何三围节点
  const scadWindowBody = (
    <>
      {[
        {
          label: "左右总宽 width",
          val: `${scadParams.width}mm`,
          min: 24,
          max: 80,
          step: 1,
          num: scadParams.width,
          onChange: (v: number) => setScadParams((p) => ({ ...p, width: v })),
        },
        {
          label: "前后总深 depth",
          val: `${scadParams.depth}mm`,
          min: 24,
          max: 80,
          step: 1,
          num: scadParams.depth,
          onChange: (v: number) => setScadParams((p) => ({ ...p, depth: v })),
        },
        {
          label: "上下总高 height",
          val: `${scadParams.height}mm`,
          min: 24,
          max: 80,
          step: 1,
          num: scadParams.height,
          onChange: (v: number) => setScadParams((p) => ({ ...p, height: v })),
        },
        {
          label: "下部外扩 flare",
          val: `${scadParams.bottomFlare.toFixed(2)}×`,
          min: 1.0,
          max: 1.25,
          step: 0.01,
          num: scadParams.bottomFlare,
          onChange: (v: number) => setScadParams((p) => ({ ...p, bottomFlare: v })),
        },
        {
          label: "穹顶占比 dome_ratio",
          val: scadParams.domeRatio.toFixed(2),
          min: 0.42,
          max: 0.82,
          step: 0.02,
          num: scadParams.domeRatio,
          onChange: (v: number) => setScadParams((p) => ({ ...p, domeRatio: v })),
        },
        {
          label: "金框凸起 trim_relief",
          val: `${scadParams.trimRelief.toFixed(1)}mm`,
          min: 0.4,
          max: 3.2,
          step: 0.1,
          num: scadParams.trimRelief,
          onChange: (v: number) => setScadParams((p) => ({ ...p, trimRelief: v })),
        },
        {
          label: "底框宽 bottom_trim",
          val: `${scadParams.bottomTrimWidth.toFixed(1)}mm`,
          min: 2.0,
          max: 12.0,
          step: 0.2,
          num: scadParams.bottomTrimWidth,
          onChange: (v: number) => setScadParams((p) => ({ ...p, bottomTrimWidth: v })),
        },
        {
          label: "侧框宽 side_trim",
          val: `${scadParams.sideTrimWidth.toFixed(1)}mm`,
          min: 2.0,
          max: 10.0,
          step: 0.2,
          num: scadParams.sideTrimWidth,
          onChange: (v: number) => setScadParams((p) => ({ ...p, sideTrimWidth: v })),
        },
        {
          label: "底口倾角 tilt_angle",
          val: `${scadParams.bottomTiltAngle}°`,
          min: 0,
          max: 18,
          step: 1,
          num: scadParams.bottomTiltAngle,
          onChange: (v: number) => setScadParams((p) => ({ ...p, bottomTiltAngle: v })),
        },
      ].map((item) => (
        <div key={item.label}>
          <div className="flex justify-between text-[9.5px] font-bold text-slate-600 dark:text-slate-300">
            <span>{item.label}</span>
            <span className="font-mono tabular-nums">{item.val}</span>
          </div>
          <input
            type="range"
            aria-label={item.label}
            min={item.min}
            max={item.max}
            step={item.step}
            value={item.num}
            onChange={(e) => item.onChange(parseFloat(e.target.value))}
            className="bp-range-slider w-full accent-[var(--accent-color)] cursor-pointer"
          />
        </div>
      ))}

      {/* OpenSCAD 3D Physical Battle Damage CSG Sub-Section */}
      <div className="pt-1.5 border-t border-dashed border-slate-300 dark:border-slate-700 space-y-1.5">
        <div className="flex items-center justify-between gap-1">
          <span className="text-[9.5px] font-black text-rose-700 dark:text-rose-300">
            💥 OpenSCAD 实体战损凹坑
          </span>
          <button
            type="button"
            onClick={() => {
              const next = !scadParams.battleDamageEnabled;
              setScadParams((p) => ({ ...p, battleDamageEnabled: next }));
              setShaderParams((p) => ({ ...p, dentDamageEnabled: next }));
            }}
            className={`px-2 py-0.5 rounded text-[9px] font-black border cursor-pointer whitespace-nowrap ${
              scadParams.battleDamageEnabled
                ? "border-slate-900 bg-rose-600 text-white"
                : "border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
            }`}
          >
            {scadParams.battleDamageEnabled ? "已雕刻 3D 凹坑" : "开启 3D 凹坑"}
          </button>
        </div>

        {scadParams.battleDamageEnabled && (
          <div className="space-y-1.5 rounded-[5px] bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 p-1.5">
            <div>
              <div className="flex justify-between text-[9px] font-bold text-slate-700 dark:text-slate-200">
                <span>弹坑与劈砍数量 damage_count</span>
                <span className="font-mono tabular-nums">{scadParams.damageCount} 处</span>
              </div>
              <input
                type="range"
                aria-label="弹坑与劈砍数量"
                min={1}
                max={6}
                step={1}
                value={scadParams.damageCount}
                onChange={(e) =>
                  setScadParams((p) => ({ ...p, damageCount: parseInt(e.target.value, 10) }))
                }
                className="bp-range-slider w-full accent-rose-600 cursor-pointer"
              />
            </div>
            <div>
              <div className="flex justify-between text-[9px] font-bold text-slate-700 dark:text-slate-200">
                <span>3D 几何凹陷深度 damage_depth</span>
                <span className="font-mono tabular-nums">{Math.round(scadParams.damageDepth * 100)}%</span>
              </div>
              <input
                type="range"
                aria-label="3D 几何凹陷深度"
                min={0.2}
                max={1.0}
                step={0.05}
                value={scadParams.damageDepth}
                onChange={(e) =>
                  setScadParams((p) => ({ ...p, damageDepth: parseFloat(e.target.value) }))
                }
                className="bp-range-slider w-full accent-rose-600 cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1.5 pt-1">
        <button
          type="button"
          onClick={() => {
            setScadParams(DEFAULT_PAULDRON_SCAD_PARAMS);
            setShaderParams((p) => ({ ...p, dentDamageEnabled: false }));
          }}
          className="px-2 py-1 rounded-[5px] border-[1.5px] border-slate-900 dark:border-slate-600 bg-white dark:bg-slate-800 text-[9.5px] font-extrabold text-slate-700 dark:text-slate-200 shadow-[1.5px_1.5px_0px_#0F172A] cursor-pointer whitespace-nowrap"
        >
          恢复默认
        </button>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(generateUpdatedOpenScadSource(scadParams));
            setCopiedScad(true);
            setTimeout(() => setCopiedScad(false), 1800);
          }}
          className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-[5px] border-[1.5px] border-slate-900 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-[9.5px] font-black text-slate-800 dark:text-slate-100 shadow-[1.5px_1.5px_0px_#0F172A] cursor-pointer whitespace-nowrap"
        >
          {copiedScad ? <CheckIcon className="w-3 h-3 text-emerald-500" /> : <CopyIcon className="w-3 h-3" />}
          <span>{copiedScad ? "已复制" : "复制.scad"}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            const meshes = [blueMeshRef.current, goldMeshRef.current].filter(Boolean) as THREE.Mesh[];
            exportMeshesToAsciiStl(
              meshes,
              `pauldron_${scadParams.width}x${scadParams.depth}x${scadParams.height}.stl`
            );
          }}
          className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-[5px] border-[1.5px] border-slate-900 bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-[9.5px] font-black shadow-[1.5px_1.5px_0px_#0F172A] cursor-pointer whitespace-nowrap"
        >
          <DownloadSimpleIcon className="w-3 h-3" />
          <span>导出.STL</span>
        </button>
        <button
          type="button"
          onClick={() => importFileInputRef.current?.click()}
          className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-[5px] border-[1.5px] border-slate-900 bg-[var(--accent-soft)] text-[var(--accent-color)] text-[9.5px] font-black shadow-[1.5px_1.5px_0px_#0F172A] cursor-pointer whitespace-nowrap"
        >
          <UploadSimpleIcon className="w-3 h-3" />
          <span>导入3D</span>
        </button>
        <input
          ref={importFileInputRef}
          type="file"
          accept=".stl,.glb,.gltf"
          onChange={handleImport3DFile}
          className="hidden"
        />
      </div>
    </>
  );

  // Content for Window 3: 光影涂装节点
  const shaderWindowBody = (
    <>
      {/* ColorRamp Brush / Interpolation Style */}
      <div className="space-y-1">
        <span className="text-[9.5px] font-bold text-slate-500 dark:text-slate-400">
          ColorRamp 笔触与过渡风格
        </span>
        <div className="grid grid-cols-2 gap-1 p-0.5 rounded-[5px] border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
          {(
            [
              { id: "eavy-metal", label: "🏆 盒照双阶描边流" },
              { id: "stipple", label: "✨ 手涂点拍体积光" },
              { id: "stepped", label: "战棋分层" },
              { id: "airbrush", label: "喷笔柔边" },
              { id: "nmm", label: "NMM伪金属" },
            ] as const
          ).map((st, idx) => (
            <button
              key={st.id}
              type="button"
              onClick={() => setShaderParams((p) => ({ ...p, rampStyle: st.id }))}
              className={`py-1 rounded-[4px] text-[10px] font-black transition cursor-pointer whitespace-nowrap ${
                idx === 0 ? "col-span-2" : ""
              } ${
                shaderParams.rampStyle === st.id
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "text-slate-600 dark:text-slate-300"
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Steps & Natural Warm/Cool Shift */}
      <div className="flex items-center justify-between gap-1">
        <div className="inline-flex rounded-[5px] border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5">
          {([3, 5] as const).map((cnt) => (
            <button
              key={cnt}
              type="button"
              onClick={() => setShaderParams((p) => ({ ...p, colorSteps: cnt }))}
              className={`px-2 py-0.5 rounded-[4px] text-[9.5px] font-black transition cursor-pointer whitespace-nowrap ${
                shaderParams.colorSteps === cnt
                  ? "bg-[var(--accent-color)] text-white"
                  : "text-slate-600 dark:text-slate-300"
              }`}
            >
              {cnt}色阶
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            setShaderParams((p) => ({
              ...p,
              naturalWarmCoolShift: !p.naturalWarmCoolShift,
            }))
          }
          className={`px-2 py-1 rounded-[5px] border-[1.5px] text-[9.5px] font-black transition cursor-pointer whitespace-nowrap ${
            shaderParams.naturalWarmCoolShift
              ? "border-slate-900 bg-[var(--accent-soft)] text-[var(--accent-color)] shadow-[1.5px_1.5px_0px_#0F172A]"
              : "border-slate-300 dark:border-slate-700 text-slate-500"
          }`}
        >
          {shaderParams.naturalWarmCoolShift ? "冷暖色偏: 开" : "冷暖色偏: 关"}
        </button>
      </div>

      {/* Clearcoat Mode */}
      <div className="space-y-1">
        <span className="text-[9.5px] font-bold text-slate-500 dark:text-slate-400">
          Clearcoat 消光/半光/光油层
        </span>
        <div className="grid grid-cols-3 gap-1 p-0.5 rounded-[5px] border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
          {(
            [
              { id: "matte", label: "消光" },
              { id: "satin", label: "半光" },
              { id: "gloss", label: "光油" },
            ] as const
          ).map((cc) => (
            <button
              key={cc.id}
              type="button"
              onClick={() => setShaderParams((p) => ({ ...p, clearcoatMode: cc.id }))}
              className={`py-1 rounded-[4px] text-[10px] font-black transition cursor-pointer whitespace-nowrap ${
                shaderParams.clearcoatMode === cc.id
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "text-slate-600 dark:text-slate-300"
              }`}
            >
              {cc.label}
            </button>
          ))}
        </div>
      </div>

      {/* 6 Toggleable Special Highlight & Weathering / Battle-Damage Layers (Full Text, Zero Truncation) */}
      <div className="space-y-1.5 pt-1 border-t border-dashed border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between gap-1">
          <span className="text-[9.5px] font-black text-slate-800 dark:text-slate-100 whitespace-nowrap">
            ⚡ 高光与战损图层
          </span>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                setShaderParams((p) => ({
                  ...p,
                  edgeLineEnabled: true,
                  whiteHotspotEnabled: true,
                  grimeStainEnabled: false,
                  metalChippingEnabled: false,
                  scratchesEnabled: false,
                  dentDamageEnabled: false,
                }));
                setScadParams((p) => ({ ...p, battleDamageEnabled: false }));
              }}
              className="px-1.5 py-0.5 rounded text-[8.5px] font-black border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-[var(--accent-soft)] cursor-pointer whitespace-nowrap"
              title="仅保留边缘描线与曲面白点（全新出厂涂装）"
            >
              洁净出厂
            </button>
            <button
              type="button"
              onClick={() => {
                setShaderParams((p) => ({
                  ...p,
                  edgeLineEnabled: true,
                  whiteHotspotEnabled: true,
                  grimeStainEnabled: true,
                  metalChippingEnabled: true,
                  scratchesEnabled: true,
                  dentDamageEnabled: true,
                }));
                setScadParams((p) => ({ ...p, battleDamageEnabled: true }));
              }}
              className="px-1.5 py-0.5 rounded text-[8.5px] font-black border border-amber-500/60 bg-amber-500/15 text-amber-800 dark:text-amber-300 hover:bg-amber-500/25 cursor-pointer whitespace-nowrap"
              title="一键开启全部旧化污渍、掉漆露铁、利刃划痕与 OpenSCAD 实体凹损"
            >
              全战损
            </button>
          </div>
        </div>

        {/* 2x3 Grid with 4-Char Labels so Text NEVER Truncates */}
        <div className="grid grid-cols-2 gap-1.5">
          {(
            [
              {
                key: "edgeLineEnabled" as const,
                label: "📐 边缘描线",
                desc: "双阶刀锋描边与折角白点",
                activeClass: "border-slate-900 bg-sky-600 text-white shadow-[1.5px_1.5px_0px_#0F172A]",
              },
              {
                key: "whiteHotspotEnabled" as const,
                label: "⚪ 曲面白点",
                desc: "凸面中心手涂点拍纯白聚光圆点",
                activeClass: "border-slate-900 bg-indigo-600 text-white shadow-[1.5px_1.5px_0px_#0F172A]",
              },
              {
                key: "grimeStainEnabled" as const,
                label: "🛢️ 旧化污渍",
                desc: "凹槽黑褐油污渍洗与表面斑块流痕",
                activeClass: "border-slate-900 bg-amber-700 text-white shadow-[1.5px_1.5px_0px_#0F172A]",
              },
              {
                key: "metalChippingEnabled" as const,
                label: "🔩 掉漆露铁",
                desc: "边缘黑褐底漆圈与寒铁银裸露金属底",
                activeClass: "border-slate-900 bg-slate-700 text-white shadow-[1.5px_1.5px_0px_#0F172A]",
              },
              {
                key: "scratchesEnabled" as const,
                label: "🗡️ 利刃划痕",
                desc: "稀疏锐利刀剑流弹亮银划痕与高光托边",
                activeClass: "border-slate-900 bg-teal-700 text-white shadow-[1.5px_1.5px_0px_#0F172A]",
              },
              {
                key: "dentDamageEnabled" as const,
                label: "💥 实体凹损",
                desc: "OpenSCAD 3D 真实几何弹坑/劈砍凹槽 + 多层崩漆露铁",
                activeClass: "border-slate-900 bg-rose-700 text-white shadow-[1.5px_1.5px_0px_#0F172A]",
              },
            ]
          ).map((item) => {
            const isOn = shaderParams[item.key];
            return (
              <button
                key={item.key}
                type="button"
                title={item.desc}
                onClick={() => {
                  const nextVal = !shaderParams[item.key];
                  setShaderParams((p) => ({
                    ...p,
                    [item.key]: nextVal,
                  }));
                  if (item.key === "dentDamageEnabled") {
                    setScadParams((p) => ({ ...p, battleDamageEnabled: nextVal }));
                  }
                }}
                className={`flex items-center justify-between gap-1 px-2 py-1.5 rounded-[5px] border-[1.5px] text-[9.5px] font-black transition cursor-pointer whitespace-nowrap ${
                  isOn
                    ? item.activeClass
                    : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:border-slate-900"
                }`}
              >
                <span>{item.label}</span>
                <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-black/15 dark:bg-white/10 shrink-0">
                  {isOn ? "开" : "关"}
                </span>
              </button>
            );
          })}
        </div>

        {/* Fine-Grained Sub-Controls for Enabled Highlight & Weathering Layers */}
        {(shaderParams.whiteHotspotEnabled ||
          shaderParams.grimeStainEnabled ||
          shaderParams.metalChippingEnabled ||
          shaderParams.scratchesEnabled ||
          shaderParams.dentDamageEnabled) && (
          <div className="mt-1.5 rounded-[5px] border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 p-2 space-y-2">
            {/* Random Seed Bar (shown whenever any weathering/damage layer is active) */}
            {(shaderParams.grimeStainEnabled ||
              shaderParams.metalChippingEnabled ||
              shaderParams.scratchesEnabled ||
              shaderParams.dentDamageEnabled) && (
              <div className="space-y-1 pb-1.5 border-b border-dashed border-slate-300 dark:border-slate-700">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[9px] font-black text-slate-700 dark:text-slate-200">
                    🎲 战损随机分布种子 #{shaderParams.weatheringSeed}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const nextSeed = ((shaderParams.weatheringSeed + 13) % 99) + 1;
                      setShaderParams((p) => ({ ...p, weatheringSeed: nextSeed }));
                      setScadParams((p) => ({ ...p, damageSeed: nextSeed }));
                    }}
                    className="px-1.5 py-0.5 rounded border border-slate-900 dark:border-slate-500 bg-white dark:bg-slate-900 text-[8.5px] font-black text-slate-800 dark:text-slate-100 shadow-[1px_1px_0px_#0F172A] hover:bg-[var(--accent-soft)] cursor-pointer whitespace-nowrap"
                    title="随机切换弹坑、劈砍、划痕、掉漆与油污在装甲上的位置"
                  >
                    🎲 随机换位
                  </button>
                </div>
                <input
                  type="range"
                  aria-label="战损随机分布种子"
                  min={1}
                  max={100}
                  step={1}
                  value={shaderParams.weatheringSeed}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setShaderParams((p) => ({ ...p, weatheringSeed: val }));
                    setScadParams((p) => ({ ...p, damageSeed: val }));
                  }}
                  className="bp-range-slider w-full accent-slate-700 cursor-pointer"
                />
              </div>
            )}

            {/* Sub-Control 1: ⚪ 曲面白点 */}
            {shaderParams.whiteHotspotEnabled && (
              <div>
                <div className="flex justify-between text-[9px] font-bold text-indigo-700 dark:text-indigo-300">
                  <span>⚪ 曲面白点半径与聚光</span>
                  <span className="font-mono tabular-nums">{Math.round(shaderParams.hotspotSize * 100)}%</span>
                </div>
                <input
                  type="range"
                  aria-label="曲面白点半径"
                  min={0.15}
                  max={1}
                  step={0.05}
                  value={shaderParams.hotspotSize}
                  onChange={(e) =>
                    setShaderParams((p) => ({ ...p, hotspotSize: parseFloat(e.target.value) }))
                  }
                  className="bp-range-slider w-full accent-indigo-600 cursor-pointer"
                />
              </div>
            )}

            {/* Sub-Control 2: 🛢️ 旧化污渍 */}
            {shaderParams.grimeStainEnabled && (
              <div className="space-y-1 pt-0.5">
                <div className="flex justify-between text-[9px] font-bold text-amber-800 dark:text-amber-300">
                  <span>🛢️ 污渍分布面积密度</span>
                  <span className="font-mono tabular-nums">{Math.round(shaderParams.grimeDensity * 100)}%</span>
                </div>
                <input
                  type="range"
                  aria-label="污渍分布面积密度"
                  min={0.05}
                  max={1}
                  step={0.05}
                  value={shaderParams.grimeDensity}
                  onChange={(e) =>
                    setShaderParams((p) => ({ ...p, grimeDensity: parseFloat(e.target.value) }))
                  }
                  className="bp-range-slider w-full accent-amber-700 cursor-pointer"
                />
                <div className="flex justify-between text-[9px] font-bold text-amber-800 dark:text-amber-300">
                  <span>🛢️ 油污渍洗深浅浓度</span>
                  <span className="font-mono tabular-nums">{Math.round(shaderParams.grimeStrength * 100)}%</span>
                </div>
                <input
                  type="range"
                  aria-label="油污渍洗深浅浓度"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={shaderParams.grimeStrength}
                  onChange={(e) =>
                    setShaderParams((p) => ({ ...p, grimeStrength: parseFloat(e.target.value) }))
                  }
                  className="bp-range-slider w-full accent-amber-700 cursor-pointer"
                />
              </div>
            )}

            {/* Sub-Control 3: 🔩 掉漆露铁 */}
            {shaderParams.metalChippingEnabled && (
              <div className="space-y-1 pt-0.5">
                <div className="flex justify-between text-[9px] font-bold text-slate-700 dark:text-slate-200">
                  <span>🔩 掉漆分布密度 (默认稀疏)</span>
                  <span className="font-mono tabular-nums">{Math.round(shaderParams.chipDensity * 100)}%</span>
                </div>
                <input
                  type="range"
                  aria-label="掉漆分布密度"
                  min={0.05}
                  max={1}
                  step={0.05}
                  value={shaderParams.chipDensity}
                  onChange={(e) =>
                    setShaderParams((p) => ({ ...p, chipDensity: parseFloat(e.target.value) }))
                  }
                  className="bp-range-slider w-full accent-slate-600 cursor-pointer"
                />
                <div className="flex justify-between text-[9px] font-bold text-slate-700 dark:text-slate-200">
                  <span>🔩 掉漆斑块颗粒尺寸</span>
                  <span className="font-mono tabular-nums">{Math.round(shaderParams.chipScale * 100)}%</span>
                </div>
                <input
                  type="range"
                  aria-label="掉漆斑块颗粒尺寸"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={shaderParams.chipScale}
                  onChange={(e) =>
                    setShaderParams((p) => ({ ...p, chipScale: parseFloat(e.target.value) }))
                  }
                  className="bp-range-slider w-full accent-slate-600 cursor-pointer"
                />
              </div>
            )}

            {/* Sub-Control 4: 🗡️ 利刃划痕 */}
            {shaderParams.scratchesEnabled && (
              <div className="space-y-1 pt-0.5">
                <div className="flex justify-between text-[9px] font-bold text-teal-800 dark:text-teal-300">
                  <span>🗡️ 划痕数量密度 (默认2~4道)</span>
                  <span className="font-mono tabular-nums">{Math.round(shaderParams.scratchDensity * 100)}%</span>
                </div>
                <input
                  type="range"
                  aria-label="划痕数量密度"
                  min={0.05}
                  max={1}
                  step={0.05}
                  value={shaderParams.scratchDensity}
                  onChange={(e) =>
                    setShaderParams((p) => ({ ...p, scratchDensity: parseFloat(e.target.value) }))
                  }
                  className="bp-range-slider w-full accent-teal-600 cursor-pointer"
                />
                <div className="flex justify-between text-[9px] font-bold text-teal-800 dark:text-teal-300">
                  <span>🗡️ 划痕长度与粗细</span>
                  <span className="font-mono tabular-nums">{Math.round(shaderParams.scratchScale * 100)}%</span>
                </div>
                <input
                  type="range"
                  aria-label="划痕长度与粗细"
                  min={0.15}
                  max={1}
                  step={0.05}
                  value={shaderParams.scratchScale}
                  onChange={(e) =>
                    setShaderParams((p) => ({ ...p, scratchScale: parseFloat(e.target.value) }))
                  }
                  className="bp-range-slider w-full accent-teal-600 cursor-pointer"
                />
              </div>
            )}

            {/* Sub-Control 5: 💥 实体凹损 (OpenSCAD 3D Craters & Blade Gouges) */}
            {shaderParams.dentDamageEnabled && (
              <div className="space-y-1 pt-0.5">
                <div className="flex justify-between text-[9px] font-bold text-rose-700 dark:text-rose-300">
                  <span>💥 3D 弹坑与劈砍数量 (OpenSCAD)</span>
                  <span className="font-mono tabular-nums">{scadParams.damageCount} 处</span>
                </div>
                <input
                  type="range"
                  aria-label="3D弹坑与劈砍数量"
                  min={1}
                  max={6}
                  step={1}
                  value={scadParams.damageCount}
                  onChange={(e) =>
                    setScadParams((p) => ({ ...p, damageCount: parseInt(e.target.value, 10) }))
                  }
                  className="bp-range-slider w-full accent-rose-600 cursor-pointer"
                />
                <div className="flex justify-between text-[9px] font-bold text-rose-700 dark:text-rose-300">
                  <span>💥 3D 几何雕刻深度与崩漆圈</span>
                  <span className="font-mono tabular-nums">{Math.round(scadParams.damageDepth * 100)}%</span>
                </div>
                <input
                  type="range"
                  aria-label="3D几何雕刻深度"
                  min={0.2}
                  max={1.0}
                  step={0.05}
                  value={scadParams.damageDepth}
                  onChange={(e) =>
                    setScadParams((p) => ({ ...p, damageDepth: parseFloat(e.target.value) }))
                  }
                  className="bp-range-slider w-full accent-rose-600 cursor-pointer"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Shader Node Parameter Sliders */}
      <div className="space-y-2 pt-0.5">
        <div>
          <div className="flex justify-between text-[9.5px] font-bold text-slate-600 dark:text-slate-300">
            <span>手涂点拍肌理 (Stipple)</span>
            <span className="font-mono tabular-nums">{Math.round(shaderParams.brushStipple * 100)}%</span>
          </div>
          <input
            type="range"
            aria-label="手涂点拍肌理"
            min={0}
            max={1}
            step={0.05}
            value={shaderParams.brushStipple}
            onChange={(e) => setShaderParams((p) => ({ ...p, brushStipple: parseFloat(e.target.value) }))}
            className="bp-range-slider w-full accent-[var(--accent-color)] cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between text-[9.5px] font-bold text-slate-600 dark:text-slate-300">
            <span>AO 凹槽渗线</span>
            <span className="font-mono tabular-nums">{Math.round(shaderParams.aoStrength * 100)}%</span>
          </div>
          <input
            type="range"
            aria-label="AO 凹槽渗线"
            min={0}
            max={1}
            step={0.05}
            value={shaderParams.aoStrength}
            onChange={(e) => setShaderParams((p) => ({ ...p, aoStrength: parseFloat(e.target.value) }))}
            className="bp-range-slider w-full accent-[var(--accent-color)] cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between text-[9.5px] font-bold text-slate-600 dark:text-slate-300">
            <span>棱边高光锐度</span>
            <span className="font-mono tabular-nums">
              {Math.round(shaderParams.edgeHighlightStrength * 100)}%
            </span>
          </div>
          <input
            type="range"
            aria-label="棱边高光锐度"
            min={0}
            max={1}
            step={0.05}
            value={shaderParams.edgeHighlightStrength}
            onChange={(e) =>
              setShaderParams((p) => ({ ...p, edgeHighlightStrength: parseFloat(e.target.value) }))
            }
            className="bp-range-slider w-full accent-[var(--accent-color)] cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between text-[9.5px] font-bold text-slate-600 dark:text-slate-300">
            <span>穹顶体积光聚拢</span>
            <span className="font-mono tabular-nums">{Math.round(shaderParams.zenithalFocus * 100)}%</span>
          </div>
          <input
            type="range"
            aria-label="穹顶体积光聚拢"
            min={0}
            max={1}
            step={0.05}
            value={shaderParams.zenithalFocus}
            onChange={(e) => setShaderParams((p) => ({ ...p, zenithalFocus: parseFloat(e.target.value) }))}
            className="bp-range-slider w-full accent-[var(--accent-color)] cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between text-[9.5px] font-bold text-slate-600 dark:text-slate-300">
            <span>天顶光源方位</span>
            <span className="font-mono tabular-nums">{shaderParams.lightAzimuthDeg}°</span>
          </div>
          <input
            type="range"
            aria-label="天顶光源方位"
            min={-120}
            max={120}
            step={2}
            value={shaderParams.lightAzimuthDeg}
            onChange={(e) =>
              setShaderParams((p) => ({ ...p, lightAzimuthDeg: parseInt(e.target.value, 10) }))
            }
            className="bp-range-slider w-full accent-[var(--accent-color)] cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between text-[9.5px] font-bold text-slate-600 dark:text-slate-300">
            <span>天顶光源仰角</span>
            <span className="font-mono tabular-nums">{shaderParams.lightElevationDeg}°</span>
          </div>
          <input
            type="range"
            aria-label="天顶光源仰角"
            min={15}
            max={85}
            step={2}
            value={shaderParams.lightElevationDeg}
            onChange={(e) =>
              setShaderParams((p) => ({ ...p, lightElevationDeg: parseInt(e.target.value, 10) }))
            }
            className="bp-range-slider w-full accent-[var(--accent-color)] cursor-pointer"
          />
        </div>
      </div>
    </>
  );

  // Content for Window 4: 节点管线说明
  const nodesWindowBody = (
    <div className="space-y-1.5 text-[9.5px]">
      <div className="rounded-[5px] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2">
        <div className="font-mono font-black text-emerald-600 dark:text-emerald-400">
          01 · OPENSCAD GEOMETRY + CSG
        </div>
        <div className="text-slate-600 dark:text-slate-300 mt-0.5">
          解析求解 hull() 穹顶与外扩裙边，支持在 3D 网格上直接雕刻爆矢弹坑与链锯劈砍凹槽并重算精确顶点法线。
        </div>
      </div>
      <div className="rounded-[5px] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2">
        <div className="font-mono font-black text-sky-600 dark:text-sky-400">
          02 · STIPPLE + SHADER TO RGB
        </div>
        <div className="text-slate-600 dark:text-slate-300 mt-0.5">
          3D 空间多频点拍笔触 (Brush Stipple) 叠加天顶光、凹槽 AO 与棱边曲率。
        </div>
      </div>
      <div className="rounded-[5px] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2">
        <div className="font-mono font-black text-amber-600 dark:text-amber-400">
          03 · VOLUMETRIC COLOR RAMP
        </div>
        <div className="text-slate-600 dark:text-slate-300 mt-0.5">
          深暗渗线 ➔ 背光暗部 ➔ 装甲主色 ➔ 45°提亮 ➔ 极亮尖角五阶映射。
        </div>
      </div>
      <div className="rounded-[5px] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2">
        <div className="font-mono font-black text-rose-600 dark:text-rose-400">
          04 · MULTI-LAYER WEATHERING
        </div>
        <div className="text-slate-600 dark:text-slate-300 mt-0.5">
          独立子控件调节边缘描线、曲面白点、旧化污渍、掉漆露铁、稀疏划痕，以及与 OpenSCAD 3D 凹坑同步的翻起漆唇+底漆坡面+寒铁坑底涂装。
        </div>
      </div>
    </div>
  );

  const partWindowNode = renderStudioWindow(
    "part",
    <span
      className="h-3.5 w-3.5 rounded-[3px] border border-slate-900 dark:border-white shrink-0"
      style={{ backgroundColor: selectedPart === "blue" ? blueBaseHex : goldBaseHex }}
    />,
    "部件与色阶向导",
    selectedPart === "blue" ? "主装甲" : "金外框",
    "bg-[var(--accent-soft)] text-[var(--accent-color)]",
    partWindowBody
  );

  const scadWindowNode = renderStudioWindow(
    "scad",
    <SlidersHorizontalIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" weight="bold" />,
    "几何三围节点",
    `${scadParams.width}×${scadParams.depth}`,
    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    scadWindowBody
  );

  const shaderWindowNode = renderStudioWindow(
    "shader",
    <PaletteIcon className="w-3.5 h-3.5 text-[var(--accent-color)] shrink-0" weight="bold" />,
    "光影涂装节点",
    shaderParams.rampStyle === "eavy-metal"
      ? "盒照描边"
      : shaderParams.rampStyle === "stipple"
      ? "手涂肌理"
      : shaderParams.rampStyle === "stepped"
      ? "战棋分层"
      : shaderParams.rampStyle === "airbrush"
      ? "喷笔柔边"
      : "NMM金属",
    "bg-[var(--accent-soft)] text-[var(--accent-color)]",
    shaderWindowBody
  );

  const nodesWindowNode = renderStudioWindow(
    "nodes",
    <CodeIcon className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" weight="bold" />,
    "节点管线说明",
    "",
    "",
    nodesWindowBody
  );

  // Helper to render a Portrait/Mobile Collapsible Dropdown Card below 📌 备选与已上色漆号
  const renderMobileBelowDropdownCard = (
    id: WindowId,
    headerIcon: React.ReactNode,
    title: string,
    badgeText: string,
    badgeClass: string,
    bodyContent: React.ReactNode
  ) => {
    const isOpen = mobileOpenPanels[id];
    return (
      <div
        key={`mobile-dropdown-${id}`}
        className="w-full rounded-[6px] border-[1.5px] border-slate-900 dark:border-slate-500 bg-white dark:bg-[#111827] shadow-[3px_3px_0px_#0F172A] dark:shadow-[3px_3px_0px_#020617] overflow-hidden"
      >
        <button
          type="button"
          onClick={() => toggleMobilePanel(id)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/90 border-b border-slate-200/80 dark:border-slate-700/80 text-left cursor-pointer"
        >
          <div className="flex items-center gap-2 min-w-0">
            {headerIcon}
            <span className="text-[11.5px] font-black text-slate-900 dark:text-slate-100 truncate">
              {title}
            </span>
            {badgeText && (
              <span
                className={`px-1.5 py-0.5 rounded-[4px] text-[9.5px] font-mono font-bold shrink-0 ${badgeClass}`}
              >
                {badgeText}
              </span>
            )}
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] border-[1.5px] border-slate-900 dark:border-slate-400 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-[10px] font-black shrink-0">
            {isOpen ? (
              <>
                <CaretUpIcon className="w-2.5 h-2.5" weight="bold" />
                <span>收起</span>
              </>
            ) : (
              <>
                <CaretDownIcon className="w-2.5 h-2.5" weight="bold" />
                <span>展开</span>
              </>
            )}
          </span>
        </button>

        {isOpen && (
          <div className="p-3 bg-white dark:bg-[#111827]">
            {bodyContent}
          </div>
        )}
      </div>
    );
  };

  // Row 3 3D Touch & Camera Controls Bar (portaled into #gk-3d-row3-controls-slot)
  const row3ControlsNode = (
    <div className="flex flex-wrap items-center justify-between gap-1.5 w-full">
      {/* Left: Zoom − / % / + & Reset Camera + Single-Finger Rotate/Pan Toggle */}
      <div className="flex flex-wrap items-center gap-1 min-w-0">
        <button
          type="button"
          onClick={() => zoom3DByFactor(1.18)}
          className="h-7 w-7 rounded-[4px] border-[1.5px] border-slate-900 dark:border-slate-400 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-black text-xs hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
          title="缩小 3D 模型视野"
        >
          −
        </button>
        <span className="px-1.5 text-[10.5px] font-mono font-black text-slate-700 dark:text-slate-300 tabular-nums shrink-0">
          {cameraZoomPct}%
        </span>
        <button
          type="button"
          onClick={() => zoom3DByFactor(0.84)}
          className="h-7 w-7 rounded-[4px] border-[1.5px] border-slate-900 dark:border-slate-400 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-black text-xs hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
          title="放大 3D 模型细节"
        >
          +
        </button>
        <button
          type="button"
          onClick={resetCamera}
          className="px-2 py-1 rounded-[4px] border-[1.5px] border-slate-900 dark:border-slate-400 bg-white dark:bg-slate-800 text-[10px] font-black text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
          title="复位 3D 最佳观察视角与居中位置（也可双击画布空白处复位）"
        >
          🎯 复位
        </button>

        {/* Portrait / Touch Single-Finger Mode Switcher: Rotate vs Pan */}
        <button
          type="button"
          onClick={() => setTouchMode((m) => (m === "rotate" ? "pan" : "rotate"))}
          className={`px-2 py-1 rounded-[4px] border-[1.5px] text-[10px] font-black transition-all cursor-pointer shrink-0 ${
            touchMode === "pan"
              ? "border-slate-900 bg-amber-500 text-white shadow-[1px_1px_0px_#0F172A]"
              : "border-slate-900 dark:border-slate-400 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300"
          }`}
          title="切换单指触屏滑动模式：单指旋转模型 / 单指上下左右平移模型（双指捏合始终支持缩放+平移）"
        >
          {touchMode === "pan" ? "✥ 单指:平移" : "🔄 单指:旋转"}
        </button>
      </div>

      {/* Right: Quick View Angle Presets + Capture to 2D Canvas */}
      <div className="flex flex-wrap items-center gap-1 shrink-0">
        <div className="inline-flex items-center rounded-[4px] border-[1.5px] border-slate-900 dark:border-slate-500 bg-slate-100 dark:bg-slate-800 p-0.5 gap-0.5">
          {(
            [
              { id: "hero", label: "斜视" },
              { id: "front", label: "正视" },
              { id: "side", label: "侧视" },
              { id: "top", label: "顶视" },
            ] as const
          ).map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setCameraViewPreset(v.id)}
              className="px-1.5 py-0.5 rounded-[3px] text-[9.5px] font-black text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              {v.label}
            </button>
          ))}
        </div>

        {onCaptureTo2DCanvas && (
          <button
            type="button"
            onClick={handleCaptureSnapshot}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-[4px] border-[1.5px] border-slate-900 dark:border-slate-400 bg-[var(--accent-color)] text-white text-[10px] font-black shadow-[1px_1px_0px_#0F172A] cursor-pointer whitespace-nowrap"
            title="将当前 3D 肩甲光影效果截图送入 2D 画布或保存色卡"
          >
            <CameraIcon className="w-3 h-3 shrink-0" weight="bold" />
            <span>截图至画布</span>
          </button>
        )}
      </div>
    </div>
  );

  // Portrait Below-Staging 4 Collapsible Dropdown Menus (portaled into #gk-3d-mobile-below-staging-slot)
  const mobileBelowStagingDropdownsNode = (
    <div className="w-full flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-[10.5px] font-black text-slate-700 dark:text-slate-200">
          🧊 3D 肩甲参数与涂装节点菜单（竖屏收纳于备选漆号下方，不遮挡 3D 模型）
        </span>
        <button
          type="button"
          onClick={() => {
            const anyOpen =
              mobileOpenPanels.part ||
              mobileOpenPanels.shader ||
              mobileOpenPanels.scad ||
              mobileOpenPanels.nodes;
            setMobileOpenPanels({
              part: !anyOpen,
              shader: false,
              scad: false,
              nodes: false,
            });
          }}
          className="px-2 py-0.5 rounded-[4px] border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-[9.5px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer shrink-0"
        >
          {mobileOpenPanels.part ||
          mobileOpenPanels.shader ||
          mobileOpenPanels.scad ||
          mobileOpenPanels.nodes
            ? "全部收起"
            : "展开向导"}
        </button>
      </div>

      {renderMobileBelowDropdownCard(
        "part",
        <span
          className="h-3.5 w-3.5 rounded-[3px] border border-slate-900 dark:border-white shrink-0"
          style={{ backgroundColor: selectedPart === "blue" ? blueBaseHex : goldBaseHex }}
        />,
        "部件与色阶向导",
        selectedPart === "blue" ? "主装甲" : "金外框",
        "bg-[var(--accent-soft)] text-[var(--accent-color)]",
        partWindowBody
      )}

      {renderMobileBelowDropdownCard(
        "shader",
        <PaletteIcon className="w-3.5 h-3.5 text-[var(--accent-color)] shrink-0" weight="bold" />,
        "光影涂装节点",
        shaderParams.rampStyle === "eavy-metal"
          ? "盒照描边"
          : shaderParams.rampStyle === "stipple"
          ? "手涂肌理"
          : shaderParams.rampStyle === "stepped"
          ? "战棋分层"
          : shaderParams.rampStyle === "airbrush"
          ? "喷笔柔边"
          : "NMM金属",
        "bg-[var(--accent-soft)] text-[var(--accent-color)]",
        shaderWindowBody
      )}

      {renderMobileBelowDropdownCard(
        "scad",
        <SlidersHorizontalIcon
          className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0"
          weight="bold"
        />,
        "几何三围节点",
        `${scadParams.width}×${scadParams.depth}`,
        "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
        scadWindowBody
      )}

      {renderMobileBelowDropdownCard(
        "nodes",
        <CodeIcon className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" weight="bold" />,
        "节点管线说明",
        "",
        "",
        nodesWindowBody
      )}
    </div>
  );

  return (
    <div
      ref={studioRootRef}
      className="relative w-full h-full min-h-[340px] sm:min-h-[440px] overflow-hidden select-none"
    >
      {/* 3D WebGL Canvas Mount — Center 100% Unobstructed */}
      <div
        ref={mountRef}
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing z-0 touch-none"
      />

      {/* Portrait Mode (< 1024px) Non-Obstructive Bottom-Left Mini Part Pill */}
      <div className="lg:hidden absolute left-2.5 bottom-2.5 z-10 flex items-center gap-1 pointer-events-auto">
        <button
          type="button"
          onClick={() => setSelectedPart("blue")}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-[5px] border-[1.5px] text-[10px] font-black shadow-[2px_2px_0px_#0F172A] cursor-pointer ${
            selectedPart === "blue"
              ? "border-slate-900 bg-[var(--accent-color)] text-white"
              : "border-slate-900 dark:border-slate-500 bg-white/95 dark:bg-slate-900/95 text-slate-700 dark:text-slate-200"
          }`}
        >
          <span
            className="h-2.5 w-2.5 rounded-full border border-white/80 shrink-0"
            style={{ backgroundColor: blueBaseHex }}
          />
          <span>主装甲</span>
        </button>
        <button
          type="button"
          onClick={() => setSelectedPart("gold")}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-[5px] border-[1.5px] text-[10px] font-black shadow-[2px_2px_0px_#0F172A] cursor-pointer ${
            selectedPart === "gold"
              ? "border-slate-900 bg-amber-500 text-white"
              : "border-slate-900 dark:border-slate-500 bg-white/95 dark:bg-slate-900/95 text-slate-700 dark:text-slate-200"
          }`}
        >
          <span
            className="h-2.5 w-2.5 rounded-full border border-white/80 shrink-0"
            style={{ backgroundColor: goldBaseHex }}
          />
          <span>外金框</span>
        </button>
      </div>

      {/* Desktop Only (>= 1024px): Detached Free-Dragged Windows */}
      <div className="hidden lg:block">
        {winBoxes.part.x !== null && partWindowNode}
        {winBoxes.scad.x !== null && scadWindowNode}
        {winBoxes.shader.x !== null && shaderWindowNode}
        {winBoxes.nodes.x !== null && nodesWindowNode}
      </div>

      {/* Desktop Only (>= 1024px): Default Left Dock Column */}
      <div className="hidden lg:flex absolute left-2.5 top-2.5 z-10 flex-col gap-2 pointer-events-none max-w-[calc(100%-20px)]">
        {winBoxes.part.x === null && partWindowNode}
        {winBoxes.scad.x === null && scadWindowNode}
      </div>

      {/* Desktop Only (>= 1024px): Default Right Dock Column */}
      <div className="hidden lg:flex absolute right-2.5 top-2.5 z-10 flex-col items-end gap-2 pointer-events-none max-w-[calc(100%-20px)]">
        {/* Top Quick Utility Row: Reset Camera + Capture Snapshot (Solid Opaque) */}
        <div className="pointer-events-auto flex items-center justify-end gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              resetCamera();
              setWinBoxes({
                part: { x: null, y: null, w: 248, h: 340, z: 21 },
                scad: { x: null, y: null, w: 248, h: 320, z: 20 },
                shader: { x: null, y: null, w: 256, h: 360, z: 22 },
                nodes: { x: null, y: null, w: 248, h: 240, z: 19 },
              });
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[6px] border-[1.5px] border-slate-900 dark:border-slate-500 bg-white dark:bg-[#111827] text-slate-800 dark:text-slate-100 text-[10.5px] font-black shadow-[2px_2px_0px_#0F172A] cursor-pointer whitespace-nowrap"
            title="复位 3D 最佳观察视角与浮动窗口默认布局"
          >
            <ArrowsCounterClockwiseIcon className="w-3.5 h-3.5" weight="bold" />
            <span>复位视角</span>
          </button>

          {onCaptureTo2DCanvas && (
            <button
              type="button"
              onClick={handleCaptureSnapshot}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[6px] border-[1.5px] border-slate-900 dark:border-slate-500 bg-[var(--accent-color)] text-white text-[10.5px] font-black shadow-[2px_2px_0px_#0F172A] cursor-pointer whitespace-nowrap"
              title="将当前 3D 肩甲光影效果截图送入 2D 画布或保存色卡"
            >
              <CameraIcon className="w-3.5 h-3.5 shrink-0" weight="bold" />
              <span>截图至画布</span>
            </button>
          )}
        </div>

        {winBoxes.shader.x === null && shaderWindowNode}
        {winBoxes.nodes.x === null && nodesWindowNode}
      </div>

      {/* Portals for Row 3 Touch/Zoom Bar and Portrait Below-Staging Dropdowns */}
      {portalSlots.row3El && createPortal(row3ControlsNode, portalSlots.row3El)}
      {portalSlots.belowStagingEl &&
        createPortal(mobileBelowStagingDropdownsNode, portalSlots.belowStagingEl)}
    </div>
  );
};

export default ShoulderPad3DStudio;
