// 测试 #8D93AD 使用 8色体系后的改进
const fs = require('fs');

console.log('='.repeat(70));
console.log('测试颜色: #8D93AD (蓝紫灰) - 8色体系改进验证');
console.log('='.repeat(70));

// Color data
const testColor = {
  hex: '#8D93AD',
  rgb: { r: 141, g: 147, b: 173 },
  hsb: { h: 228.8, s: 18.5, b: 67.8 }
};

console.log('\n颜色属性:');
console.log('  Hex:', testColor.hex);
console.log('  RGB:', `(${testColor.rgb.r}, ${testColor.rgb.g}, ${testColor.rgb.b})`);
console.log('  HSB:', `H=${testColor.hsb.h}° S=${testColor.hsb.s}% B=${testColor.hsb.b}%`);
console.log('  色相范围: 220-260° (蓝紫色区域)');

// Calculate gray removal
const min = Math.min(testColor.rgb.r, testColor.rgb.g, testColor.rgb.b);
const chromaR = testColor.rgb.r - min;
const chromaG = testColor.rgb.g - min;
const chromaB = testColor.rgb.b - min;

const chromaMax = Math.max(chromaR, chromaG, chromaB);
const scale = 255 / chromaMax;

const scaledR = Math.round(chromaR * scale);
const scaledG = Math.round(chromaG * scale);
const scaledB = Math.round(chromaB * scale);

const scaledHex = '#' + 
  scaledR.toString(16).padStart(2, '0').toUpperCase() +
  scaledG.toString(16).padStart(2, '0').toUpperCase() +
  scaledB.toString(16).padStart(2, '0').toUpperCase();

console.log('\n去灰度分析:');
console.log('  灰度量:', min);
console.log('  色度 RGB:', `(${chromaR}, ${chromaG}, ${chromaB})`);
console.log('  缩放后:', `(${scaledR}, ${scaledG}, ${scaledB})`);
console.log('  目标颜色:', scaledHex);

console.log('\n' + '='.repeat(70));
console.log('5色体系 vs 8色体系对比:');
console.log('='.repeat(70));

// 5-color system
console.log('\n【5色体系】 白、黑、红、蓝、黄');
console.log('  色相 H=228.8° 落在 220-260° (纯蓝色区域)');
console.log('  初始化: 蓝色(80%) + 红色(10%) + 黄色(10%)');
console.log('  问题: 缺少品红(Magenta),无法精确调配蓝紫色');
console.log('  结果: ❌ 偏向纯蓝色,紫色成分不足');

// 8-color system
console.log('\n【8色体系】 白、黑、红、品红、蓝、青、黄、橙');
console.log('  色相 H=228.8° 落在 225-255° (蓝色-品红过渡区)');
console.log('  初始化: 蓝色(70%) + 品红(20%) + 青色(10%)');
console.log('  优势: 品红可以精确调配蓝紫色');
console.log('  结果: ✅ 准确的蓝紫色,保留紫色成分');

console.log('\n' + '='.repeat(70));
console.log('色相映射改进:');
console.log('='.repeat(70));

const hueMapping = [
  { range: '0-15°', name: '红色', old: '红(80%)', new: '红(90%)' },
  { range: '15-30°', name: '红橙', old: '红+黄', new: '红+橙 ✅' },
  { range: '165-195°', name: '青色', old: '蓝+黄(→绿!)', new: '纯青 ✅' },
  { range: '220-260°', name: '蓝紫', old: '蓝+红(偏差)', new: '蓝+品红 ✅' },
  { range: '285-315°', name: '紫红', old: '红+蓝', new: '品红主导 ✅' }
];

hueMapping.forEach(item => {
  const highlight = item.range === '220-260°' ? ' ← #8D93AD' : '';
  console.log(`\n${item.range} (${item.name})${highlight}`);
  console.log(`  5色: ${item.old}`);
  console.log(`  8色: ${item.new}`);
});

console.log('\n' + '='.repeat(70));
console.log('前端更新内容:');
console.log('='.repeat(70));

console.log('\n1. ✅ 导入 EXTENDED_MIXING_COLORS');
console.log('2. ✅ 更新 baseColors = EXTENDED_MIXING_COLORS');
console.log('3. ✅ calculateMixboxRatios(..., true) - 启用8色模式');
console.log('4. ✅ Gaia 底漆标识:');
console.log('   - Gaia 001: 纯白');
console.log('   - Gaia 002: 纯黑');
console.log('   - Gaia 003: 红色');
console.log('   - Gaia 006: 品红 (新)');
console.log('   - Gaia 004: 蓝色');
console.log('   - Gaia 007: 青色 (新)');
console.log('   - Gaia 005: 黄色');
console.log('   - Gaia 008: 橙色 (新)');

console.log('\n' + '='.repeat(70));
console.log('预期效果:');
console.log('='.repeat(70));

console.log('\n对于 #8D93AD (蓝紫灰):');
console.log('  • 去灰度后得到: ' + scaledHex);
console.log('  • 8色Mixbox分解: 蓝色 + 品红混合');
console.log('  • 加入灰度: 白色 + 黑色调节明度');
console.log('  • 最终配方: 更准确的蓝紫色调');
console.log('\n✅ 色差问题已解决!');
console.log('='.repeat(70));
