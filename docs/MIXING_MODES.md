# 混色模式系统 - 功能说明

## 📅 更新日期: 2025-12-05

## 🎨 新增功能概览

GK-Mixer 现已支持 **四种专业混色模式**,每种模式针对不同的调色需求和工艺流程:

---

## 1️⃣ Mixbox 物理混色模式 (默认)

### 核心技术
- 基于 **Mixbox 2.0** 算法的7维潜在空间模拟
- 物理级别的颜料混合计算,结果更接近真实喷涂效果
- 使用 Gaia 001-005 五色基础色系统

### 适用场景
- 需要精确模拟物理混色效果
- 蓝+黄=绿(而非光学混色的灰色)
- 适合模型漆、丙烯颜料等实体颜料调色

### 基础色配置
```typescript
WHITE (Gaia 001) #FFFFFF - 纯白
BLACK (Gaia 002) #000000 - 纯黑  
RED   (Gaia 003) #FF0000 - 红色
BLUE  (Gaia 004) #0000FF - 蓝色
YELLOW(Gaia 005) #FFFF00 - 黄色
```

---

## 2️⃣ Professional 专业喷涂模式 ⭐新增

### 核心技术
- **HSB 色彩空间分析**: 色相(H 0-360°)、饱和度(S 0-100%)、明度(B 0-100%)
- **LAB 色彩空间校准**: 感知均匀的色彩空间,精确控制明度(L*)和色度(a*, b*)
- 基于真实喷涂工艺的明度分层策略

### 三级明度策略

#### 🌞 高明度模式 (B > 70%)
**策略**: 白底调色法
1. 先混合纯色相颜料(排除白色)
2. 将色相颜料逐步加入白色底漆
3. 边加边测试,避免过深

**适用**: 浅色、粉彩色、高亮色调色

#### 🎨 中明度模式 (30% < B ≤ 70%)  
**策略**: 标准 Mixbox 混合
1. 按 Mixbox 算法计算五色比例
2. 先混合主色相(占比最大)
3. 逐步加入其他颜色充分搅拌

**适用**: 常规颜色、中间色调调色

#### 🌙 低明度模式 (B ≤ 30%)
**策略**: 黑底提亮法
1. 准备黑色底漆(至少60%)
2. 混合色相颜料
3. 少量多次加入黑底,避免过深
4. 预留5-10%用于微调

**适用**: 深色、暗色调、影色调色

### 显示内容
- HSB 分析面板(色相系统、饱和度、明度)
- LAB 校准数据(L*, a*, b* 值)
- 分步操作指导
- 配比总结表

---

## 3️⃣ CMY Pigment 颜料模式 ⭐新增

### 核心技术
- 使用 **减法混色**原理的颜料三原色
- CMY 色彩模型(Cyan-Magenta-Yellow)
- 适配印刷、喷绘等颜料工艺

### 基础色配置
```typescript
WHITE   #FFFFFF - 白色
BLACK   #000000 - 黑色
CYAN    #00FFFF - 青色颜料(非蓝色!)
MAGENTA #FF00FF - 品红颜料  
YELLOW  #FFFF00 - 黄色颜料
```

### 适用场景
- 印刷级颜料调色
- 喷绘、丝网印刷工艺
- 需要使用 CMY 颜料体系的专业应用

### 特点
- Cyan + Magenta = Blue
- Magenta + Yellow = Red
- Cyan + Yellow = Green
- 三色叠加 = Black(理论上)

---

## 4️⃣ CMY Solid 实色模式 ⭐新增

### 核心技术
- 使用 RGB 实色作为三原色
- 更接近模型漆实际配色习惯
- 基于 Mixbox 算法的实色混合

### 基础色配置  
```typescript
WHITE  #FFFFFF - 白色
BLACK  #000000 - 黑色
RED    #FF0000 - 红色实色
BLUE   #0000FF - 蓝色实色  
YELLOW #FFFF00 - 黄色实色
```

### 适用场景
- 模型漆调色(Mr. Hobby, Gaia, Tamiya等)
- 丙烯颜料混色
- 使用红蓝黄实色作为基础色的工作流

### 特点
- Red + Blue = Purple(紫色)
- Blue + Yellow = Green(绿色)
- Red + Yellow = Orange(橙色)
- 更符合传统美术混色认知

---

## 🎛️ UI 交互设计

### 模式切换器布局

#### 桌面视图 (≥768px)
```
┌─────────────────────────────────────────┐
│ [Mixbox] [Professional] [CMY-P] [CMY-S] │
│  物理混色    专业喷涂     颜料    实色   │
└─────────────────────────────────────────┘
```
- 4列网格布局(`grid-cols-4`)
- 每个按钮显示完整标题 + 副标题

#### 移动视图 (<768px)
```
┌───────────────┬───────────────┐
│   [Mixbox]    │[Professional] │
│    物理混色    │   专业喷涂     │
├───────────────┼───────────────┤
│ [CMY-Pigment] │  [CMY-Solid]  │
│   颜料三原色   │   实色三原色   │
└───────────────┴───────────────┘
```
- 2列网格布局(`grid-cols-2`)
- 按钮垂直堆叠,易于触摸操作
- 保持可读性和点击区域

### 视觉反馈
- **激活状态**: 彩色边框 + 浅色背景
  - Mixbox: 蓝色(`border-macaron-blue`)
  - Professional: 紫色(`border-purple-500`)
  - CMY-Pigment: 青色(`border-cyan-500`)
  - CMY-Solid: 橙色(`border-orange-500`)
- **悬停状态**: 半透明边框
- **文字层级**: 粗体标题 + 小号副标题

### 模式说明面板
每个模式下方显示一条简洁说明:
- 🎨 图标 + 核心算法说明
- 50-80字说明,3秒内可读完
- 深色模式自适应

---

## 📊 数据流架构

```
Color Input (RGB/HEX)
        ↓
   ┌────┴────┐
   │ HSB/LAB │ ← rgbToHsb(), rgbToLab()
   └────┬────┘
        ↓
 [Mode Selector]
        ↓
   ┌────┴─────────────────────────┐
   │                              │
Mixbox Mode              Professional Mode
   │                              │
calculateMixboxRatios()   calculateProfessionalRecipe()
   │                              │
   │                         ┌────┴────┐
   │                         │ Strategy│
   │                         │Decision │
   │                         └────┬────┘
   │                              │
   │                    ┌─────────┼─────────┐
   │                    │         │         │
   │                High-B     Mid-B     Low-B
   │                (白底)     (标准)    (黑底)
   │                    │         │         │
   └────────────────────┴─────────┴─────────┘
                        ↓
                  Bottle Layers
                  (Volume Calc)
```

---

## 🧪 测试用例

### 测试颜色

#### 高明度测试 (Professional Mode)
- 粉红 `#FFB6C1` → 预期: 白底调色
- 浅蓝 `#87CEEB` → 预期: 白色主导

#### 中明度测试
- 橙色 `#FF8C00` → 预期: 标准混合  
- 绿色 `#32CD32` → 预期: 均衡配比

#### 低明度测试
- 深蓝 `#00008B` → 预期: 黑底提亮
- 深红 `#8B0000` → 预期: 黑色60%+

### CMY 模式测试
- Pigment: Cyan + Magenta → 应接近紫色
- Solid: Red + Blue → 应接近紫色

---

## 🚀 性能优化

### 计算缓存
- `useMemo` 缓存 `mixLayers` 计算结果
- 仅在 `color`、`mixingMode`、`bottleVolume` 变化时重算
- Professional 配方计算结果存储在状态中

### 动画优化
- Anime.js 处理瓶身动画
- 使用 `easeOutElastic` 弹性效果
- Stagger 延迟创造层叠感

### 响应式布局
- Tailwind breakpoint: `md:` (768px)
- 网格自动调整: `grid-cols-2 md:grid-cols-4`
- 文字截断防止溢出: `truncate`

---

## 🎓 使用建议

### 新手用户
1. 从 **Mixbox 模式**开始,体验物理混色
2. 使用"最接近色"功能自动选择基础漆
3. 调整瓶身容量查看实际用量

### 专业用户  
1. 使用 **Professional 模式**获取详细配方
2. 参考 HSB/LAB 数据进行精确校准
3. 根据明度策略调整喷涂顺序

### 颜料工艺用户
1. 选择 **CMY-Pigment** 模式
2. 注意减法混色原理(CMY → RGB)
3. 适配印刷、喷绘工作流

### 模型玩家
1. 使用 **CMY-Solid** 模式
2. 符合传统红蓝黄混色习惯
3. 直接对应商业模型漆色号

---

## 📝 技术细节

### HSB 转换精度
- H: 整数 0-360°(四舍五入)
- S/B: 整数 0-100%(四舍五入)
- 误差: ±2 RGB单位(Round-trip测试)

### LAB 转换精度  
- L: 保留2位小数
- a/b: 保留2位小数
- D65 标准光源,sRGB色彩空间
- 误差: ±3 RGB单位(Round-trip测试)

### Mixbox 优化
- 梯度下降迭代: 50次
- 学习率: 0.1
- 收敛判定: 颜色距离 < 0.01

---

## 🐛 已知限制

1. **Professional 模式**不支持基础漆选择功能(使用纯色计算)
2. **CMY 模式**在极端色彩下可能出现色差(Mixbox算法限制)
3. **移动端**模式切换器占用较多垂直空间(已优化为2x2网格)
4. **LAB 转换**在超出 sRGB 色域的颜色可能被截断

---

## 🔮 未来计划

- [ ] 添加自定义基础色配置
- [ ] 支持更多色彩空间(LCH, Oklch)
- [ ] 导出配方为 PDF/图片
- [ ] 多语言完善(日语、英语翻译)
- [ ] 配方历史记录
- [ ] 色差计算与可视化

---

## 📚 参考资料

- [Mixbox 2.0 论文](https://scrtwpns.com/mixbox/)
- [HSB/HSV 色彩模型](https://en.wikipedia.org/wiki/HSL_and_HSV)
- [CIELAB 色彩空间](https://en.wikipedia.org/wiki/CIELAB_color_space)
- [Photoshop 色环算法](https://helpx.adobe.com/photoshop/using/adjusting-hue-saturation.html)

---

**版本**: v2.0.0  
**作者**: HDINEVER  
**项目**: GK-Mixer Mini Web Tools
