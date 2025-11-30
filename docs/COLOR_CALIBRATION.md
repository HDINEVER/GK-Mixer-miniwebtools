# 色彩空间校准说明

## 问题诊断

### 原始问题
- **Photoshop 取色**: `#61B885` (Adobe RGB 或 sRGB 模式)
- **网页提取色**: `#73B588` (浏览器默认)
- **差异**: RGB 值偏移约 `(+18, 0, +3)`

### 根本原因
浏览器 Canvas API 在不指定 `colorSpace` 参数时,会根据系统显示器配置文件和图片嵌入的 ICC Profile 进行色彩管理转换,导致:

1. **Adobe RGB 图片** → 浏览器自动转换 → 色值偏移
2. **未标准化的 getContext()** → 使用显示器色彩配置 → 与 Photoshop sRGB 模式不一致

## 解决方案

### ✅ 已实施的修复

#### 1. Canvas API 色彩空间配置
在所有 Canvas 实例化时强制使用 **sRGB** 色彩空间:

```typescript
const ctx = canvas.getContext('2d', { 
  colorSpace: 'srgb',           // 强制 sRGB 色彩空间
  willReadFrequently: true      // 优化像素读取性能
});
```

#### 2. 修改位置

**`utils/colorUtils.ts` - extractProminentColors()**
```typescript
// Line ~400
const ctx = canvas.getContext('2d', { 
  colorSpace: 'srgb',
  willReadFrequently: true 
});
```

**`App.tsx` - handleCanvasClick()**
```typescript
// Line ~75
const ctx = canvasRef.current.getContext('2d', { 
  colorSpace: 'srgb',
  willReadFrequently: true 
});
```

**`App.tsx` - useEffect (Canvas 绘制)**
```typescript
// Line ~163
const ctx = canvas.getContext('2d', { 
  colorSpace: 'srgb',
  willReadFrequently: true 
});
```

### 📌 技术细节

#### colorSpace: 'srgb' 的作用
- 禁用浏览器的自动色彩管理
- 将所有图片统一转换到 **标准 sRGB 色彩空间**
- 确保 `getImageData()` 返回的像素值与 Photoshop sRGB 模式一致

#### willReadFrequently: true 的作用
- 告知浏览器频繁读取像素数据
- 触发软件渲染路径(而非 GPU 加速)
- 提高 `getImageData()` 性能,减少 GPU → CPU 数据传输开销

## 验证测试

### 测试步骤
1. 准备一张 **嵌入 Adobe RGB 配置文件的图片**
2. 在 Photoshop 中:
   - 转换到 sRGB 模式: `编辑 → 转换为配置文件 → sRGB IEC61966-2.1`
   - 使用取色器选取目标像素: 记录 Hex 值
3. 在 GK-Mixer 网页中:
   - 上传同一图片
   - 使用手动取色器点击相同像素
   - 对比 Hex 值

### 预期结果
修复后,两者的 Hex 值应该**完全一致**(误差 ≤ ±1 RGB 单位)

## 已知限制

### 1. Display P3 色域
如果图片使用 **Display P3** 或其他宽色域:
- sRGB 会裁切超出色域的颜色
- 但这是正确行为(与 Photoshop sRGB 转换一致)

### 2. Gamma 校正
浏览器假设显示器使用标准 **Gamma 2.2**:
- 如果用户显示器 Gamma 异常(1.8/2.4),可能仍有微小偏差
- 但 `getImageData()` 返回的是线性 sRGB 值,已消除 Gamma 影响

### 3. 量化误差
由于 RGB 值为 0-255 整数:
- 色彩空间转换的浮点计算会四舍五入
- 可能产生 ±1 的量化误差(可接受范围)

## 进阶校准(可选)

### 如果仍有色差,可尝试:

#### 方案 A: 图片预处理
在上传前使用 ImageMagick 转换:
```bash
magick convert input.jpg -colorspace sRGB -profile sRGB.icc output.jpg
```

#### 方案 B: 用户设置
添加色彩配置选项:
```typescript
enum ColorProfile {
  sRGB = 'srgb',
  AdobeRGB = 'adobe-rgb', // 需要手动转换矩阵
  DisplayP3 = 'display-p3'
}
```

## 参考资料

- [Canvas API colorSpace 参数](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext)
- [Web 色彩管理最佳实践](https://webkit.org/blog/6682/improving-color-on-the-web/)
- [Photoshop 色彩空间指南](https://helpx.adobe.com/photoshop/using/color-settings.html)

---

**修复日期**: 2025-11-30  
**影响范围**: 所有颜色提取和手动取色功能  
**向后兼容**: ✅ 完全兼容(仅影响色彩精度)
