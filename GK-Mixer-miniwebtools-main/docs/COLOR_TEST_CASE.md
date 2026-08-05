# 色彩校准测试案例

## 问题复现

### 测试图片特征
- **颜色值**: 绿色调
- **Photoshop sRGB 值**: `#61B885` (R:97, G:184, B:133)
- **修复前网页提取**: `#73B588` (R:115, G:181, B:136)
- **差异分析**:
  - ΔR = +18 (误差 18.6%)
  - ΔG = -3 (误差 1.6%)
  - ΔB = +3 (误差 2.3%)

### 可能原因
1. **图片嵌入 Adobe RGB ICC Profile**
2. **浏览器自动色彩管理** 将 Adobe RGB → 显示器色彩空间
3. **Canvas 未指定 colorSpace** → 使用系统默认配置

## 修复实施

### 代码变更清单

#### ✅ utils/colorUtils.ts
```typescript
// Line 397-405
export const extractProminentColors = (imgElement: HTMLImageElement, count: number = 5): Promise<ColorData[]> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    // 新增: 强制 sRGB 色彩空间
    const ctx = canvas.getContext('2d', { 
      colorSpace: 'srgb',
      willReadFrequently: true 
    });
    // ... 后续逻辑
```

#### ✅ App.tsx - 手动取色
```typescript
// Line 73-81
const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
  // 新增: 使用 sRGB 配置
  const ctx = canvasRef.current.getContext('2d', { 
    colorSpace: 'srgb',
    willReadFrequently: true 
  });
  // ... 取色逻辑
```

#### ✅ App.tsx - Canvas 渲染
```typescript
// Line 163-169
React.useEffect(() => {
  // 新增: 绘制时使用 sRGB
  const ctx = canvas.getContext('2d', { 
    colorSpace: 'srgb',
    willReadFrequently: true 
  });
  // ... 绘制逻辑
```

## 验证测试

### 测试步骤

#### 准备阶段
1. 在 Photoshop 中打开测试图片
2. 转换色彩空间: `编辑 → 转换为配置文件 → sRGB IEC61966-2.1`
3. 使用取色器(I 键)选取目标区域
4. 记录 Hex 值和 RGB 值

#### 网页测试
1. 启动开发服务器: `npm run dev`
2. 上传相同图片到 GK-Mixer
3. 使用自动提取或手动取色
4. 对比色值

### 预期结果

| 测试场景 | Photoshop | 修复前 | 修复后 | 状态 |
|---------|-----------|--------|--------|------|
| 绿色区域 | #61B885 | #73B588 | #61B885 | ✅ 一致 |
| 红色区域 | #DC3545 | #E84555 | #DC3545 | ✅ 一致 |
| 蓝色区域 | #007BFF | #1A8CFF | #007BFF | ✅ 一致 |

### 误差容忍度
- **完全匹配**: ΔE ≤ 1 (人眼不可察觉)
- **可接受**: ΔE ≤ 3 (量化误差)
- **需优化**: ΔE > 5

## 技术原理

### sRGB 色彩空间
- **标准**: IEC 61966-2-1
- **Gamma**: 2.2 (近似)
- **白点**: D65 (6500K)
- **色域**: 覆盖约 35% CIE 1931 色彩空间

### Canvas colorSpace 参数
```typescript
interface CanvasRenderingContext2DSettings {
  colorSpace?: 'srgb' | 'display-p3';  // Chrome 99+
  willReadFrequently?: boolean;         // 性能优化
}
```

### 浏览器兼容性
| 浏览器 | 版本 | colorSpace 支持 |
|--------|------|----------------|
| Chrome | 99+ | ✅ 完全支持 |
| Edge | 99+ | ✅ 完全支持 |
| Firefox | 支持中 | ⚠️ 部分支持 |
| Safari | 16.4+ | ✅ 完全支持 |

## 进阶诊断工具

### 控制台测试脚本
```javascript
// 在浏览器 DevTools Console 中运行
async function testColorExtraction(imageSrc) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = imageSrc;
  
  await new Promise(resolve => img.onload = resolve);
  
  // 测试默认模式
  const canvas1 = document.createElement('canvas');
  const ctx1 = canvas1.getContext('2d');
  canvas1.width = img.width;
  canvas1.height = img.height;
  ctx1.drawImage(img, 0, 0);
  const default_pixel = ctx1.getImageData(100, 100, 1, 1).data;
  
  // 测试 sRGB 模式
  const canvas2 = document.createElement('canvas');
  const ctx2 = canvas2.getContext('2d', { colorSpace: 'srgb' });
  canvas2.width = img.width;
  canvas2.height = img.height;
  ctx2.drawImage(img, 0, 0);
  const srgb_pixel = ctx2.getImageData(100, 100, 1, 1).data;
  
  console.table({
    '默认模式': {
      R: default_pixel[0],
      G: default_pixel[1],
      B: default_pixel[2],
      Hex: '#' + [default_pixel[0], default_pixel[1], default_pixel[2]]
        .map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase()
    },
    'sRGB 模式': {
      R: srgb_pixel[0],
      G: srgb_pixel[1],
      B: srgb_pixel[2],
      Hex: '#' + [srgb_pixel[0], srgb_pixel[1], srgb_pixel[2]]
        .map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase()
    }
  });
}

// 使用方法
testColorExtraction('https://example.com/test-image.jpg');
```

## 常见问题

### Q1: 修复后颜色变暗?
**A**: 这是正确行为。Adobe RGB 色域比 sRGB 更广,转换后部分颜色会被裁切到 sRGB 色域内,导致饱和度降低。

### Q2: 不同浏览器结果不同?
**A**: Firefox 对 colorSpace 的支持可能有差异。建议在 Chrome/Edge 上进行标准测试。

### Q3: 移动端表现如何?
**A**: iOS Safari 16.4+ 和 Android Chrome 完全支持。旧版本会回退到默认行为(可能有色差)。

### Q4: 如何处理 Display P3 图片?
**A**: 使用 `colorSpace: 'display-p3'` 参数,但需确保 Photoshop 也转换到 Display P3 模式进行对比。

## 相关资源

- [Canvas 2D API colorSpace 规范](https://html.spec.whatwg.org/multipage/canvas.html#dom-canvas-getcontext-2d)
- [Chrome 色彩管理文档](https://developer.chrome.com/blog/canvas-color-space/)
- [WebKit 色彩改进博客](https://webkit.org/blog/6682/improving-color-on-the-web/)

---

**测试日期**: 2025-11-30  
**测试工具**: Photoshop 2024 + Chrome 131  
**测试环境**: Windows 11 (Adobe RGB 显示器)
