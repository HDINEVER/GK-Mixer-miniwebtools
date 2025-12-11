function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return {r, g, b};
}

function rgbToHsb(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;
  
  let h = 0;
  if (diff !== 0) {
    if (max === r) {
      h = ((g - b) / diff + (g < b ? 6 : 0)) * 60;
    } else if (max === g) {
      h = ((b - r) / diff + 2) * 60;
    } else {
      h = ((r - g) / diff + 4) * 60;
    }
  }
  
  const s = max === 0 ? 0 : (diff / max) * 100;
  const brightness = max * 100;
  return { h, s, b: brightness };
}

console.log('='.repeat(70));
console.log('色相偏差分析: #8D93AD vs #0610EC');
console.log('='.repeat(70));

const colors = [
  { hex: '#8D93AD', name: '浅蓝紫灰' },
  { hex: '#0610EC', name: '深蓝色' }
];

colors.forEach(({hex, name}) => {
  const rgb = hexToRgb(hex);
  const hsb = rgbToHsb(rgb.r, rgb.g, rgb.b);
  const max = Math.max(rgb.r, rgb.g, rgb.b);
  const min = Math.min(rgb.r, rgb.g, rgb.b);
  const sat = max === 0 ? 0 : (max - min) / max;
  
  console.log('\n' + name + ': ' + hex);
  console.log('  RGB: (' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ')');
  console.log('  HSB: H=' + hsb.h.toFixed(1) + '° S=' + hsb.s.toFixed(1) + '% B=' + hsb.b.toFixed(1) + '%');
  console.log('  饱和度: ' + (sat * 100).toFixed(2) + '%');
  console.log('  去灰度后: R=' + (rgb.r - min) + ', G=' + (rgb.g - min) + ', B=' + (rgb.b - min));
});

console.log('\n' + '='.repeat(70));
console.log('色相差异:');
const rgb1 = hexToRgb('#8D93AD');
const rgb2 = hexToRgb('#0610EC');
const hsb1 = rgbToHsb(rgb1.r, rgb1.g, rgb1.b);
const hsb2 = rgbToHsb(rgb2.r, rgb2.g, rgb2.b);
console.log('  色相差: ' + Math.abs(hsb1.h - hsb2.h).toFixed(1) + '°');
console.log('  #8D93AD 色相: ' + hsb1.h.toFixed(1) + '° (228.8° 蓝紫色)');
console.log('  #0610EC 色相: ' + hsb2.h.toFixed(1) + '° (234.8° 蓝色偏紫)');

console.log('\n' + '='.repeat(70));
console.log('问题分析:');
console.log('1. 五色体系 (白、黑、红、蓝、黄) 无法覆盖所有色域');
console.log('2. 缺少青色(Cyan)、品红(Magenta)等次级颜色');
console.log('3. 蓝紫色区域(220-260°)难以用纯蓝色+红色精确调配');
console.log('4. 当前算法对中等饱和度使用去灰度,但 Mixbox 仍基于五色体系');
console.log('='.repeat(70));
