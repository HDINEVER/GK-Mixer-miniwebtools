// Golden test 4: 像素取色管线 (Tab 1 图像输入+提取颜色的核心算法)
const core = require('@gk-mixer/core');
const assert = require('node:assert');

let passed = 0;
const check = (name, fn) => {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
};

const mkPixels = (w, h, fill) => {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) fill(px, i);
  return px;
};
const fillPixel = (px, i, r, g, b, a = 255) => {
  px[i * 4] = r; px[i * 4 + 1] = g; px[i * 4 + 2] = b; px[i * 4 + 3] = a;
};

console.log('🎨 Golden test: 像素取色');

// 场景 1: 70% 纯红 + 30% 纯白 → 首位应为红
check('主色提取: 红为主色', () => {
  const px = mkPixels(100, 100, (p, i) =>
    fillPixel(p, i, ...(i < 7000 ? [255, 0, 0] : [255, 255, 255])));
  const colors = core.extractProminentColorsFromPixels(px, { count: 3 });
  assert.ok(colors.length >= 2, '应至少返回 2 个去重主色');
  assert.strictEqual(colors[0].hex, '#FF0000');
  assert.strictEqual(colors[0].source, 'auto');
  console.log(`    → ${colors.map(c => c.hex).join(', ')}`);
});

// 场景 2: 透明像素应被跳过
check('透明像素 (alpha<128) 被跳过', () => {
  const px = mkPixels(64, 64, (p, i) =>
    fillPixel(p, i, ...(i % 2 === 0 ? [0, 0, 255, 255] : [0, 255, 0, 0])));
  const colors = core.extractProminentColorsFromPixels(px, { count: 2 });
  assert.ok(colors.every(c => c.hex !== '#00FF00'), '绿色像素 alpha=0 不应出现');
  assert.strictEqual(colors[0].hex, '#0000FF');
});

// 场景 3: ColorData 完整性 (注意: 采样量化步长 20, 153→160 是设计行为)
check('返回的 ColorData 各色彩空间完整', () => {
  const px = mkPixels(10, 10, (p, i) => fillPixel(p, i, 255, 153, 0));
  const [c] = core.extractProminentColorsFromPixels(px, { count: 1 });
  assert.strictEqual(c.hex, '#FFA000', '量化后应为 (255,160,0)');
  assert.deepStrictEqual(c.rgb, { r: 255, g: 160, b: 0 });
  assert.strictEqual(c.colorSpace, 'srgb');
  assert.strictEqual(c.source, 'auto');
  assert.ok(Array.isArray(c.lab) || typeof c.lab === 'object');
});

// 场景 4: adobe-rgb 色彩空间参数透传
check('adobe-rgb 工作空间参数生效', () => {
  const px = mkPixels(10, 10, (p, i) => fillPixel(p, i, 255, 0, 0));
  const [c] = core.extractProminentColorsFromPixels(px, { count: 1, colorSpace: 'adobe-rgb' });
  assert.strictEqual(c.colorSpace, 'adobe-rgb');
  assert.ok(c.hex.startsWith('#'));
});

console.log(`\n🎨 取色: ${passed}/4 通过\n`);
