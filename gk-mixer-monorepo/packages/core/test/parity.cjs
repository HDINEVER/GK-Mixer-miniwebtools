// ============================================================
// PARITY TEST - 无损迁移的核心证明
// 同一输入分别喂给「原始网页代码」和「@gk-mixer/core」，
// 逐一对比输出，必须完全一致。
//
// 原理: 用 esbuild 把两份 TS 源码分别打包成临时 ESM:
//   - 原始: apps/web/utils/colorUtils.ts + colorSpaceConverter.ts
//   - core: packages/core/src/utils/color-engine.ts + color-space.ts
// 运行时 diff 每个函数的输出 (相对路径依赖会被打包进去,
// 仅 simple-color-converter 保持外部, 由 node_modules 解析)。
// ============================================================
const path = require('node:path');
const assert = require('node:assert');
const fs = require('node:fs');

const ROOT = path.resolve(__dirname, '..');
const WEB = path.resolve(ROOT, '../../apps/web');
const TMP = path.resolve(ROOT, 'test/.tmp-parity');

fs.mkdirSync(TMP, { recursive: true });
const esbuild = require('esbuild');

const bundle = (entry, name) => {
  const out = path.join(TMP, `${name}.mjs`);
  esbuild.buildSync({
    entryPoints: [entry],
    outfile: out,
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    packages: 'external',
  });
  return out;
};

const run = async () => {
  const origEntry = bundle(path.join(WEB, 'utils/colorUtils.ts'), 'orig');
  const portEntry = bundle(path.join(ROOT, 'src/utils/color-engine.ts'), 'port');
  const origSpaceEntry = bundle(path.join(WEB, 'utils/colorSpaceConverter.ts'), 'orig-space');
  const portSpaceEntry = bundle(path.join(ROOT, 'src/utils/color-space.ts'), 'port-space');
  const portIndexEntry = bundle(path.join(ROOT, 'src/index.ts'), 'port-index');

  const orig = await import(origEntry);
  const port = await import(portEntry);
  const origSpace = await import(origSpaceEntry);
  const portSpace = await import(portSpaceEntry);
  const portIndex = await import(portIndexEntry);

  const inputs = [
    '#8D93AD', '#E60012', '#FF9900', '#000000', '#FFFFFF',
    '#123456', '#ABCDEF', '#B85C38', '#004098', '#F5F5DC',
  ];

  let checks = 0;
  const compare = (name, origVal, portVal) => {
    checks++;
    const o = JSON.stringify(origVal);
    const p = JSON.stringify(portVal);
    assert.strictEqual(o, p, `[${name}] 不一致!\n  原始: ${o}\n  core: ${p}`);
  };

  // 1. findNearestPaints (最近色匹配)
  for (const hex of inputs) {
    compare(`findNearestPaints(${hex})`, orig.findNearestPaints(hex, 3), port.findNearestPaints(hex, 3));
  }

  // 2. mixboxBlend 双色混合
  compare('mixboxBlend(red,blue,.5)', orig.mixboxBlend('#FF0000', '#0000FF', 0.5), port.mixboxBlend('#FF0000', '#0000FF', 0.5));
  compare('mixboxBlend(blue,yellow,.5)', orig.mixboxBlend('#0000FF', '#FFFF00', 0.5), port.mixboxBlend('#0000FF', '#FFFF00', 0.5));

  // 3. mixboxMultiBlend 多色混合
  const weights = [
    { hex: '#FFFFFF', weight: 0.3 },
    { hex: '#000000', weight: 0.2 },
    { hex: '#FF0000', weight: 0.2 },
    { hex: '#0000FF', weight: 0.2 },
    { hex: '#FFFF00', weight: 0.1 },
  ];
  compare('mixboxMultiBlend', orig.mixboxMultiBlend(weights), port.mixboxMultiBlend(weights));

  // 4. calculateMixboxRatios (5色 + 8色)
  for (const hex of inputs) {
    compare(`calcRatios5(${hex})`, orig.calculateMixboxRatios(hex), port.calculateMixboxRatios(hex));
    compare(`calcRatios8(${hex})`, orig.calculateMixboxRatios(hex, 'srgb', true), port.calculateMixboxRatios(hex, 'srgb', true));
  }

  // 5. calculateProfessionalRecipe
  for (const hex of inputs) {
    compare(`calcRecipe(${hex})`, orig.calculateProfessionalRecipe(hex), port.calculateProfessionalRecipe(hex));
  }

  // 6. RAL 匹配
  for (const hex of inputs) {
    compare(`hexToRAL(${hex})`, orig.hexToRAL(hex), port.hexToRAL(hex));
  }

  // 7. 漆料库数据完整性
  compare('GAIA_PAINTS', orig.GAIA_PAINTS, port.GAIA_PAINTS);
  compare('JUMPWIND_PAINTS', orig.JUMPWIND_PAINTS, port.JUMPWIND_PAINTS);
  compare('GUNZE_PAINTS', orig.GUNZE_PAINTS, port.GUNZE_PAINTS);
  compare('CMY_PIGMENT_COLORS', orig.CMY_PIGMENT_COLORS, port.CMY_PIGMENT_COLORS);
  compare('CMY_SOLID_COLORS', orig.CMY_SOLID_COLORS, port.CMY_SOLID_COLORS);
  // BASE_MIXING_COLORS + EXTENDED_MIXING_COLORS intentionally corrected:
  // Gaia brand → CMY Solid/Pigment naming; Orange → Process Yellow

  // 8. 色彩空间转换 (sRGB / Display P3 / Adobe RGB)
  for (const hex of inputs) {
    const rgb = orig.hexToRgb(hex);
    for (const space of ['display-p3', 'adobe-rgb']) {
      compare(`convertToWorkingSpace(${hex},${space})`,
        origSpace.convertToWorkingSpace(rgb, space),
        portSpace.convertToWorkingSpace(rgb, space));
      compare(`convertFromWorkingSpace(${hex},${space})`,
        origSpace.convertFromWorkingSpace(rgb, space),
        portSpace.convertFromWorkingSpace(rgb, space));
      compare(`isInGamut(${hex},${space})`,
        origSpace.isInGamut(rgb, space),
        portSpace.isInGamut(rgb, space));
    }
  }

  // 9. 取色像素管线: 复刻原始 colorUtils.ts 的私有算法 (QUANT_TABLE +
  // processPixelsSync + 主色排序), 与 core 的 extractProminentColorsFromPixels 对拍
  const COLOR_QUANT_STEP = 20;
  const QUANT_TABLE = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    const q = Math.round(i / COLOR_QUANT_STEP) * COLOR_QUANT_STEP;
    QUANT_TABLE[i] = q > 255 ? 255 : q;
  }
  const originalExtract = (data, count = 5, stride = 40) => {
    const colorMap = new Map();
    for (let index = 0; index < data.length; index += stride) {
      if (data[index + 3] >= 128) {
        const packed = (QUANT_TABLE[data[index]] << 16) | (QUANT_TABLE[data[index + 1]] << 8) | QUANT_TABLE[data[index + 2]];
        colorMap.set(packed, (colorMap.get(packed) || 0) + 1);
      }
    }
    return Array.from(colorMap.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, count)
      .map(([packed]) => {
        const r = (packed >> 16) & 0xff;
        const g = (packed >> 8) & 0xff;
        const b = packed & 0xff;
        return orig.rgbToHex(r, g, b);
      });
  };

  const mkPixels = (w, h, fill) => {
    const px = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) fill(px, i);
    return px;
  };
  const fillPixel = (px, i, r, g, b, a = 255) => {
    px[i * 4] = r; px[i * 4 + 1] = g; px[i * 4 + 2] = b; px[i * 4 + 3] = a;
  };

  // 场景 A: 70% 纯红 + 30% 纯白
  const pixelsA = mkPixels(100, 100, (px, i) =>
    fillPixel(px, i, ...(i < 7000 ? [255, 0, 0] : [255, 255, 255])));
  // 场景 B: 蓝绿交替 (含透明像素)
  const pixelsB = mkPixels(64, 64, (px, i) =>
    fillPixel(px, i, ...(i % 2 === 0 ? [0, 0, 255, 255] : [0, 255, 0, 0])));
  // 场景 C: 黄紫混合
  const pixelsC = mkPixels(50, 50, (px, i) =>
    fillPixel(px, i, ...(i % 3 === 0 ? [255, 255, 0] : [128, 0, 128])));

  for (const [name, px] of [['A', pixelsA], ['B', pixelsB], ['C', pixelsC]]) {
    for (const count of [3, 5]) {
      const origColors = originalExtract(px, count);
      const coreColors = portIndex.extractProminentColorsFromPixels(px, { count }).map(c => c.hex);
      compare(`extractPixels(${name},count=${count})`, origColors, coreColors);
    }
  }

  console.log(`✅ PARITY PASSED: ${checks} 项输出与原始代码完全一致`);
};

run().catch((err) => {
  console.error('❌ PARITY FAILED:', err.message || err);
  process.exit(1);
});
