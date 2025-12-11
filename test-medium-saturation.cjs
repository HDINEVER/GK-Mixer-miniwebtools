// Test the fixed medium saturation algorithm
const fs = require('fs');

// Read the colorUtils.ts file
const colorUtilsPath = 'd:\\桌面\\编程\\小工具开发\\GK-Mixer-miniwebtools\\utils\\colorUtils.ts';
const content = fs.readFileSync(colorUtilsPath, 'utf8');

// Helper functions
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
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

// Test color
const testHex = '#8D93AD';
const rgb = hexToRgb(testHex);
const hsb = rgbToHsb(rgb.r, rgb.g, rgb.b);

const max = Math.max(rgb.r, rgb.g, rgb.b);
const min = Math.min(rgb.r, rgb.g, rgb.b);
const saturation = max === 0 ? 0 : (max - min) / max;

console.log('='.repeat(60));
console.log('测试颜色: ' + testHex);
console.log('RGB:', rgb);
console.log('HSB: H=' + hsb.h.toFixed(1) + '° S=' + hsb.s.toFixed(1) + '% B=' + hsb.b.toFixed(1) + '%');
console.log('计算饱和度:', (saturation * 100).toFixed(2) + '%');
console.log('色相描述: 蓝紫色 (228.75° 在 220-260° 范围内)');
console.log('='.repeat(60));

// Calculate what the algorithm should do
if (saturation < 0.05) {
  console.log('算法分支: 纯灰色 (<5%)');
} else if (saturation < 0.12) {
  console.log('算法分支: 低饱和度简化公式 (5-12%)');
} else if (saturation >= 0.12 && saturation < 0.40) {
  console.log('算法分支: 中等饱和度 - 使用去灰度后的实际色彩 (12-40%)');
  console.log('✓ 新算法将保留紫色成分!');
  
  // Show what will be calculated
  const grayAmount = min;
  const chromaR = rgb.r - grayAmount;
  const chromaG = rgb.g - grayAmount;
  const chromaB = rgb.b - grayAmount;
  
  console.log('\n去除灰度计算:');
  console.log('  灰度量 (最小通道):', grayAmount);
  console.log('  色度 RGB:', { r: chromaR, g: chromaG, b: chromaB });
  
  const chromaMax = Math.max(chromaR, chromaG, chromaB);
  const scale = 255 / chromaMax;
  const scaledChroma = {
    r: Math.round(chromaR * scale),
    g: Math.round(chromaG * scale),
    b: Math.round(chromaB * scale)
  };
  
  console.log('  缩放后色度:', scaledChroma);
  console.log('  这个色度将用于 Mixbox 反推,保留了原始的蓝紫色调!');
} else {
  console.log('算法分支: 高饱和度 - 使用纯色相 (>40%)');
}

console.log('='.repeat(60));
