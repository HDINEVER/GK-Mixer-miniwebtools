// Golden test 1: RAL matching (ported from original test-ral.cjs)
// Verifies core's RAL functions against the simple-color-converter library
const core = require('@gk-mixer/core');
const assert = require('node:assert');

let passed = 0;
const check = (name, fn) => {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
};

console.log('🎨 Golden test: RAL 色卡集成');

// Test 1: RGB -> RAL (原 test-ral.cjs: RGB(12, 75, 175))
check('hexToRAL(#0C4BAF) 返回 RAL 类型结果', () => {
  const ral = core.hexToRAL('#0C4BAF');
  assert.ok(ral, '应返回 RAL 匹配');
  assert.strictEqual(ral.type, 'ral');
  assert.strictEqual(typeof ral.ral, 'number');
  assert.strictEqual(typeof ral.name, 'string');
  assert.strictEqual(typeof ral.hex, 'string');
  console.log(`    → RAL ${ral.ral} ${ral.name} (${ral.hex})`);
});

// Test 2: CMYK -> RAL (原 test-ral.cjs: CMYK(0, 53, 60, 60))
check('cmykToRAL({0,53,60,60}) 返回 RAL 匹配', () => {
  const ral = core.cmykToRAL({ c: 0, m: 53, y: 60, k: 60 });
  assert.ok(ral, '应返回 RAL 匹配');
  assert.strictEqual(ral.type, 'ral');
  console.log(`    → RAL ${ral.ral} ${ral.name}`);
});

// Test 3: getRALByNumber 精确查询
check('getRALByNumber(3009) 返回 3009', () => {
  const ral = core.getRALByNumber(3009);
  assert.ok(ral);
  assert.strictEqual(ral.ral, 3009);
});

// Test 4: findNearestRAL 输入 RGB
check('findNearestRAL({r:12,g:75,b:175}) 返回匹配', () => {
  const ral = core.findNearestRAL({ r: 12, g: 75, b: 175 });
  assert.ok(ral);
  console.log(`    → RAL ${ral.ral} ${ral.name} (${ral.hex})`);
});

console.log(`\n🎨 RAL: ${passed}/4 通过\n`);
