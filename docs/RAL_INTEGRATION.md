# RAL 色卡系统集成文档

## 📋 概述

GK-Mixer 现已集成 **RAL 工业标准色卡系统**，支持 RAL Classic 约 200+ 种标准颜色的精确匹配。

## ✨ 新增功能

### 1. RAL 颜色匹配
- **RGB → RAL:** 将任意 RGB 颜色转换为最接近的 RAL 标准色
- **CMYK → RAL:** 从 CMYK 印刷色直接匹配 RAL 工业色
- **Hex → RAL:** 支持十六进制颜色代码转换
- **RAL 查询:** 通过 RAL 色号查询完整颜色信息

### 2. 色彩匹配算法
- 使用 **Delta E (CIE76)** 算法进行感知准确匹配
- 基于 **LAB 色彩空间**，符合人眼视觉感知
- 比传统 RGB 欧几里得距离更精确

### 3. RAL 颜色信息
每个 RAL 匹配结果包含：
- **RAL 编号:** 如 3009
- **颜色名称:** 如 "Oxide Red" (氧化红)
- **LRV 值:** Light Reflectance Value (反光值 0-100)
- **对应 Hex:** 标准 RGB 十六进制值

## 🛠️ API 使用

### TypeScript/JavaScript

```typescript
import { 
  findNearestRAL, 
  hexToRAL, 
  cmykToRAL, 
  getRALByNumber,
  colorDataToRAL 
} from './utils/colorUtils';

// 1. RGB → RAL
const ralColor = findNearestRAL({ r: 12, g: 75, b: 175 });
// 返回: { ral: 5002, name: 'Ultramarine Blue', lrv: 4, hex: '#0C4BAF', rgb: {...}, type: 'ral' }

// 2. Hex → RAL
const ralFromHex = hexToRAL('#FF0000');
// 返回: { ral: 3024, name: 'Luminous Red', lrv: 30, ... }

// 3. CMYK → RAL
const ralFromCMYK = cmykToRAL({ c: 0, m: 53, y: 60, k: 60 });
// 返回: { ral: 3009, name: 'Oxide Red', lrv: 5, ... }

// 4. 通过 RAL 编号查询
const ralInfo = getRALByNumber(3009);
// 返回: { ral: 3009, name: 'Oxide Red', lrv: 5, hex: '#663029', ... }

// 5. ColorData → RAL (便捷函数)
const colorData: ColorData = {
  id: 'color-1',
  hex: '#0C4BAF',
  rgb: { r: 12, g: 75, b: 175 },
  cmyk: { c: 93, m: 57, y: 0, k: 31 },
  source: 'auto'
};
const ral = colorDataToRAL(colorData);
```

## 📊 RAL 系统说明

### RAL Classic 色卡
- **总数:** 约 200+ 标准颜色
- **编号范围:** RAL 1000 - RAL 9023
- **应用领域:** 建筑、制造、涂料、汽车等工业领域
- **国际标准:** 欧洲及全球工业界广泛采用

### LRV (反光值) 含义
- **范围:** 0-100
- **0:** 完全吸光 (纯黑)
- **100:** 完全反光 (纯白)
- **用途:** 建筑设计、照明计算、安全标识

### 常见 RAL 色号示例
| RAL 编号 | 颜色名称 | 应用 |
|---------|---------|------|
| RAL 1000 | Green Beige | 建筑外墙 |
| RAL 3009 | Oxide Red | 防锈漆 |
| RAL 5002 | Ultramarine Blue | 机械设备 |
| RAL 7035 | Light Grey | 工业设备 |
| RAL 9016 | Traffic White | 交通标识 |

## 🎨 实际应用场景

### 场景 1: 模型制作
```typescript
// 用户拍摄实物照片，提取颜色
const extractedColor = { r: 102, g: 48, b: 41 };

// 同时匹配模型漆 + RAL 标准色
const hobbyPaints = findNearestPaints('#663029', 3); // Gaia, Mr.Hobby
const ralMatch = findNearestRAL(extractedColor);     // RAL 3009

// 用户可选择:
// 1. 使用 Gaia/Mr.Hobby 模型漆调配
// 2. 使用 RAL 3009 标准工业漆 (更耐久)
```

### 场景 2: 工业涂装
```typescript
// 设计师给出 CMYK 印刷色
const cmyk = { c: 0, m: 53, y: 60, k: 60 };

// 转换为 RAL 工业标准色
const ral = cmykToRAL(cmyk);
// 工厂直接订购 RAL 3009 涂料，无需调色
```

### 场景 3: 建筑设计
```typescript
// 建筑师选择 Hex 颜色
const wallColor = '#E3DFA6';

// 查找 RAL 标准色号
const ral = hexToRAL(wallColor);
// 提供给施工方: "使用 RAL 1015 Light Ivory"
```

## ⚡ 性能优化

- **本地匹配:** 所有转换在客户端完成，无需网络请求
- **缓存友好:** 重复查询速度极快
- **算法效率:** Delta E 匹配复杂度 O(n)，n ≈ 200

## 🔬 技术实现

### 依赖库
```json
{
  "simple-color-converter": "^latest",
  "color_library": "^latest" // 包含完整 RAL Classic 数据库
}
```

### 颜色匹配流程
```
RGB/CMYK/Hex
    ↓
LAB 色彩空间
    ↓
Delta E (CIE76) 计算
    ↓
遍历 RAL 数据库
    ↓
返回最小 Delta E 值的 RAL 色
```

### Delta E 公式
```
ΔE = √[(L₁-L₂)² + (a₁-a₂)² + (b₁-b₂)²]
```
- L: 亮度 (0-100)
- a: 红绿轴 (-128 to +127)
- b: 黄蓝轴 (-128 to +127)

## 📦 类型定义

```typescript
export interface RALColor {
  ral: number;        // RAL 编号 (如 3009)
  name: string;       // 颜色名称
  lrv: number;        // Light Reflectance Value (反光值)
  hex: string;        // 对应的 Hex 值
  rgb: RGB;           // RGB 值
  type: 'ral';        // 类型标识
}

export type PaintType = 'hobby' | 'ral' | 'pantone';
```

## 🌐 多语言支持

### 英文 (en)
```typescript
ralStandard: 'RAL STANDARD COLOR'
ralNumber: 'RAL No.'
ralName: 'Color Name'
ralLrv: 'LRV (Light Reflectance)'
industryStandard: 'Industrial Standard Color System'
```

### 中文 (zh)
```typescript
ralStandard: 'RAL 工业标准色'
ralNumber: 'RAL 色号'
ralName: '颜色名称'
ralLrv: 'LRV (反光值)'
industryStandard: '工业标准色系统'
```

### 日语 (ja)
```typescript
ralStandard: 'RAL 工業標準色'
ralNumber: 'RAL 番号'
ralName: '色名'
ralLrv: 'LRV (反射率)'
industryStandard: '工業標準色システム'
```

## ✅ 验证测试

运行测试脚本验证集成：
```bash
node test-ral.cjs
```

预期输出：
```
✅ 所有测试通过！RAL 色卡系统集成成功。
📊 支持的 RAL Classic 色卡约 200+ 种标准颜色
🔬 使用 LAB 色彩空间进行感知准确的颜色匹配
```

## 🛡️ 兼容性保证

### Mixbox 算法完整性
- ✅ 原有物理混合算法**未受影响**
- ✅ Blue + Yellow = Green 测试通过
- ✅ LAB 空间转换正常
- ✅ 所有现有功能保持不变

### 向后兼容
- ✅ 现有 `findNearestPaints()` 函数不变
- ✅ `PaintBrand` 接口向后兼容
- ✅ 新增 `type?: PaintType` 为可选字段

## 📚 参考资源

- [RAL Classic 官方网站](https://www.ral-farben.de/)
- [Delta E 色差标准](https://en.wikipedia.org/wiki/Color_difference)
- [simple-color-converter GitHub](https://github.com/draganradu/simple-color-convertor-pantone-ral)
- [RAL 色卡数据来源](https://gist.github.com/lunohodov/1995178)

## 🎯 未来扩展

- [ ] RAL Design 系统 (1,600+ 色)
- [ ] RAL Effect 系统 (金属/珠光色)
- [ ] Pantone 色卡集成
- [ ] NCS (Natural Color System) 支持
- [ ] 自定义色卡数据库上传

---

**版本:** v1.0.0  
**集成日期:** 2025年12月5日  
**状态:** ✅ 生产就绪
