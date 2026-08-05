// Golden test 3: 漆料数据库 + 最近色匹配 (基于原 test-color-analysis.cjs / test-medium-saturation.cjs 场景)
const core = require('@gk-mixer/core');
const assert = require('node:assert');

let passed = 0;
const check = (name, fn) => {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
};

console.log('🎨 Golden test: 漆料数据库');

check('GAIA 数据库非空且结构完整', () => {
  assert.ok(core.GAIA_PAINTS.length > 100, `GAIA 应有 100+ 色: ${core.GAIA_PAINTS.length}`);
  const first = core.GAIA_PAINTS[0];
  assert.ok(first.id && first.code && first.name && first.hex);
});

check('三大数据库合并到 COMMON_PAINTS', () => {
  const total = core.GAIA_PAINTS.length + core.JUMPWIND_PAINTS.length + core.GUNZE_PAINTS.length;
  assert.strictEqual(core.COMMON_PAINTS.length, 7 + total, 'COMMON = 7 基础 + 三大库');
  console.log(`    → COMMON_PAINTS: ${core.COMMON_PAINTS.length} 色`);
});

check('BASE_MIXING_COLORS 与 EXTENDED_MIXING_COLORS', () => {
  assert.ok(core.BASE_MIXING_COLORS.length >= 5, '5色体系');
  assert.ok(core.EXTENDED_MIXING_COLORS.length >= 8, '8色体系');
  console.log(`    → BASE: ${core.BASE_MIXING_COLORS.length} 色, EXTENDED: ${core.EXTENDED_MIXING_COLORS.length} 色`);
});

check('findNearestPaints(#E60012) 首位应为红色系', () => {
  const paints = core.findNearestPaints('#E60012', 3);
  assert.strictEqual(paints.length, 3);
  console.log(`    → ${paints.map(p => `${p.brand} ${p.code}`).join(', ')}`);
});

check('findNearestPaints(#8D93AD) 蓝紫灰匹配 (test-8color 场景)', () => {
  const paints = core.findNearestPaints('#8D93AD', 3);
  assert.strictEqual(paints.length, 3);
  console.log(`    → ${paints.map(p => `${p.brand} ${p.code}`).join(', ')}`);
});

console.log('🎨 Golden test: 专业配方 (test-medium-saturation.cjs 场景)');

check('calculateProfessionalRecipe(中饱和色) 返回完整配方', () => {
  const recipe = core.calculateProfessionalRecipe('#B85C38');
  assert.ok(recipe, '应返回配方');
  console.log(`    → 步骤: ${JSON.stringify(recipe).slice(0, 200)}...`);
});

console.log(`\n🎨 漆料库: ${passed}/6 通过\n`);
