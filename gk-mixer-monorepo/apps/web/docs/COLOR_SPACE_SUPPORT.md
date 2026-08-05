# 色彩空间支持文档

## ✅ 新增功能

项目现已支持 **三种色彩空间**:

### 1. **sRGB (标准)**
- 网页标准色彩空间
- 兼容所有显示器和浏览器
- 色域覆盖: ~35% CIE 1931
- 最佳兼容性选择

### 2. **Display P3 (广色域)**
- 现代设备广色域支持
- 支持设备: iPhone、iPad Pro、MacBook Pro、高端显示器
- 色域覆盖: ~45% CIE 1931 (比 sRGB 多 25%)
- 更鲜艳的红色和绿色

### 3. **Adobe RGB (1998)**
- 专业摄影和印刷标准
- 色域覆盖: ~52% CIE 1931 (最大色域)
- 适合高端相机和专业工作流

---

## 🎨 使用方法

### 切换色彩空间
在页面顶部工具栏中,点击对应按钮:
- **sRGB** - 标准模式 (默认)
- **P3** - 广色域模式
- **Adobe** - Adobe RGB 模式

### 色彩空间指示
- 提取的颜色会显示其来源色彩空间
- 超出色域的颜色会显示 ⚠️ 警告图标
- 非 sRGB 模式会在顶部显示信息横幅

---

## 🔧 技术实现

### 色彩空间转换流程

```
输入图像 (任意色彩空间)
    ↓
Canvas 提取 (P3/sRGB)
    ↓
转换到工作空间 (sRGB)
    ↓
混色算法 (Mixbox - 不变)
    ↓
输出结果 (sRGB)
    ↓
可选: 转换到目标色彩空间
```

### 关键特性

#### 1. **算法保持不变**
- 所有混色算法仍在 sRGB 工作空间运行
- Mixbox、CMYK 转换等核心逻辑完全不变
- 只在输入/输出层添加色彩空间转换

#### 2. **自动色彩空间转换**
```typescript
// 从源色彩空间 → sRGB 工作空间
convertToWorkingSpace(rgb, sourceColorSpace)

// 从 sRGB 工作空间 → 目标色彩空间
convertFromWorkingSpace(rgb, targetColorSpace)
```

#### 3. **色域检测**
```typescript
// 检查颜色是否在目标色域内
isInGamut(rgb, colorSpace)
// 返回 false 时显示警告图标
```

---

## 📊 色彩空间对比

| 特性 | sRGB | Display P3 | Adobe RGB |
|------|------|------------|-----------|
| **色域覆盖** | ~35% | ~45% | ~52% |
| **Web 支持** | ✅ 完美 | ✅ 现代浏览器 | ⚠️ 需转换 |
| **Canvas API** | ✅ 原生 | ✅ 原生 | ❌ 模拟 |
| **浏览器支持** | 所有 | Chrome 99+, Safari 16.4+ | 通过 sRGB 转换 |
| **显示器要求** | 普通 | 广色域 | 专业 |
| **适用场景** | 通用 | 现代设备 | 专业摄影/印刷 |

---

## 🎯 使用场景

### sRGB 模式
- ✅ 通用网页显示
- ✅ 标准显示器
- ✅ 最佳兼容性
- ✅ 模型漆混色 (多数厂商使用 sRGB)

### Display P3 模式
- ✅ iPhone/iPad 拍照参考图
- ✅ MacBook Pro 设计稿
- ✅ 需要更鲜艳色彩的场景
- ✅ 现代设备优化

### Adobe RGB 模式
- ✅ 专业相机 RAW 文件
- ✅ 印刷色彩管理
- ✅ 摄影工作流
- ⚠️ 注意: 在普通显示器上会被压缩到 sRGB

---

## 💡 最佳实践

### 1. **选择合适的色彩空间**
- 如果不确定,使用 **sRGB** (默认)
- iPhone 拍照 → 使用 **P3**
- 专业相机 → 使用 **Adobe RGB**

### 2. **注意色域警告**
- 看到 ⚠️ 图标表示颜色超出色域
- 超出色域的颜色在普通显示器上会失真
- 混色算法会自动将颜色限制在可显示范围内

### 3. **工作流建议**
```
1. 上传参考图片
2. 选择图片对应的色彩空间
3. 提取颜色 (自动转换到 sRGB 工作空间)
4. 使用混色功能 (算法在 sRGB 空间运行)
5. 输出配方 (自动适配各品牌漆标准)
```

---

## 🔬 技术细节

### 转换矩阵
使用 ICC Profile 标准转换矩阵:
- **P3 ↔ XYZ ↔ sRGB**
- **Adobe RGB ↔ XYZ ↔ sRGB**
- XYZ (D65) 作为中间色彩空间

### Gamma 校正
- **sRGB**: 2.4 gamma + 线性部分
- **Display P3**: 使用 sRGB gamma 曲线
- **Adobe RGB**: 2.2 gamma (简化)

### Canvas API 限制
- Adobe RGB 不被 Canvas 原生支持
- 使用 sRGB Canvas + 手动矩阵转换
- 保证色彩准确性

---

## 📝 代码示例

### 提取颜色 (带色彩空间)
```typescript
const colors = await extractProminentColors(img, 5, 'display-p3');
// 自动在 P3 空间提取,转换到 sRGB 工作空间
```

### 手动拾色 (带色彩空间)
```typescript
const ctx = canvas.getContext('2d', { 
  colorSpace: 'display-p3' 
});
const pixel = ctx.getImageData(x, y, 1, 1).data;
// P3 像素值自动转换到 sRGB
```

### 色域检测
```typescript
if (!isInGamut(color.rgb, 'display-p3')) {
  console.warn('Color out of P3 gamut, will be clipped');
}
```

---

## 🐛 已知限制

1. **Adobe RGB Canvas 支持**
   - Canvas API 不原生支持 Adobe RGB
   - 使用 sRGB 模式 + 手动转换
   - 精度可能略低于原生支持

2. **浏览器兼容性**
   - P3 需要 Chrome 99+, Safari 16.4+
   - 旧浏览器自动降级到 sRGB

3. **显示器限制**
   - P3/Adobe RGB 颜色在普通显示器上被压缩
   - 需要广色域显示器才能看到真实效果

---

## 📚 参考资源

- [Display P3 色彩空间](https://webkit.org/blog/10042/wide-gamut-color-in-css-with-display-p3/)
- [Adobe RGB (1998)](https://en.wikipedia.org/wiki/Adobe_RGB_color_space)
- [Canvas colorSpace API](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/getContext)
- [ICC Color Profiles](https://www.color.org/icc_specs2.xalter)

---

**更新日期**: 2025年12月1日  
**版本**: v2.0 - 广色域支持
