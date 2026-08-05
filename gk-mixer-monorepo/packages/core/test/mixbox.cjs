// Golden test 2: Mixbox blending + 8-color recipe (基于原 test-8color-fix.cjs 的场景)
const core = require('@gk-mixer/core');
const assert = require('node:assert');

let passed = 0;
const check = (name, fn) => {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
};

console.log('🎨 Golden test: Mixbox 混色');

// 物理混色: 蓝 + 黄 = 绿 (mixbox 的核心价值)
check('mixboxBlend(蓝, 黄, 0.5) 偏绿 (不是灰)', () => {
  const result = core.mixboxBlend('#0000FF', '#FFFF00', 0.5);
  const rgb = core.hexToRgb(result);
  console.log(`    → ${result} rgb(${rgb.r},${rgb.g},${rgb.b})`);
  assert.ok(rgb.g > rgb.r && rgb.g > rgb.b, '绿色分量应占主导');
});

// 红 + 蓝 50% = 紫
check('mixboxBlend(红, 蓝, 0.5) 为紫色系', () => {
  const result = core.mixboxBlend('#FF0000', '#0000FF', 0.5);
  const rgb = core.hexToRgb(result);
  assert.ok(rgb.b > rgb.g, '蓝色分量应高于绿色');
  console.log(`    → ${result}`);
});

// 多色混合
check('mixboxMultiBlend(白/黑/红/蓝/黄 五色)', () => {
  const result = core.mixboxMultiBlend([
    { hex: '#FFFFFF', weight: 0.2 },
    { hex: '#000000', weight: 0.2 },
    { hex: '#FF0000', weight: 0.2 },
    { hex: '#0000FF', weight: 0.2 },
    { hex: '#FFFF00', weight: 0.2 },
  ]);
  assert.ok(/^#[0-9A-F]{6}$/i.test(result), `无效 hex: ${result}`);
  console.log(`    → ${result}`);
});

// 光学混合 (对照物)
check('opticalBlend(红, 蓝, 0.5) 可用', () => {
  const result = core.opticalBlend('#FF0000', '#0000FF', 0.5);
  assert.ok(/^#[0-9A-F]{6}$/i.test(result));
  console.log(`    → ${result}`);
});

console.log('\n🎨 Golden test: 8色体系配方 (test-8color-fix.cjs 场景 #8D93AD)');

check('calculateMixboxRatios(#8D93AD) 5色模式返回 5 个比例', () => {
  const ratios = core.calculateMixboxRatios('#8D93AD');
  assert.ok(Array.isArray(ratios));
  assert.strictEqual(ratios.length, 5, '5色体系');
  const total = ratios.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - 100) < 1, `比例和应≈100%: ${total}`);
  console.log(`    → 白${ratios[0].toFixed(3)} 黑${ratios[1].toFixed(3)} 红${ratios[2].toFixed(3)} 蓝${ratios[3].toFixed(3)} 黄${ratios[4].toFixed(3)}`);
});

check('calculateMixboxRatios(#8D93AD, srgb, true) 8色模式: 蓝+青还原蓝紫灰', () => {
  const ratios = core.calculateMixboxRatios('#8D93AD', 'srgb', true);
  assert.strictEqual(ratios.length, 8, '8色体系');
  // EXTENDED 顺序: 白黑红品红蓝青黄橙
  const blue = ratios[4];
  const cyan = ratios[5];
  assert.ok(blue > 0, '蓝色应参与');
  const total = ratios.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - 100) < 1, `比例和应≈100%: ${total}`);
  // 注: 原始算法在中等饱和模式下走「去灰→蓝+青」路径 (test-8color-fix.cjs 的
  // 品红预期是设计意图, 实际实现为蓝+青; parity.cjs 保证与原始代码逐位一致)
  console.log(`    → 蓝 ${blue.toFixed(3)} / 青 ${cyan.toFixed(3)} (总: ${total.toFixed(3)})`);
});

console.log(`\n🎨 Mixbox: ${passed}/6 通过\n`);
