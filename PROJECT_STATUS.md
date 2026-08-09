# GK Mixer — 项目开发状态总览

> **当前目标**：将 Web 原生颜料混合工具完整迁移为 **Native SwiftUI iOS App**。
> **阅读对象**：任何接手此项目的 AI Agent / 开发者。

---

## 1. 三个子项目的关系

```
ios-GK-mixer/
├── GK-Mixer/                        ← ⭐ 当前主力：Native SwiftUI App（target）
├── GK-Mixer-miniwebtools-main/      ← 📖 参考源：原始 Web App（算法 + UI 风格来源）
├── gk-mixer-monorepo/               ← ⚠️ 已弃用：React Native 尝试（可参考但不开发）
├── PROJECT_STATUS.md                ← 📋 本文件
├── package.json / node_modules/     ← 无关，RN 遗留
└── .git/
```

| 项目 | 状态 | 用途 |
|------|------|------|
| **`GK-Mixer/`** | 🚧 **开发中** | 纯原生 SwiftUI，Xcode 26.3，部署目标 iOS 26.0 |
| **`GK-Mixer-miniwebtools-main/`** | ✅ 已完整 | React 19 + Vite，算法和 UI 的**唯一参考来源** |
| **`gk-mixer-monorepo/`** | ❌ 已废弃 | RN 尝试，`packages/core/` 的 TS 算法可供 port 参考 |

---

## 2. GK-Mixer/ — 当前 SwiftUI 项目（开发目标）

### 已实现

| 层级 | 文件 | 状态 |
|------|------|------|
| App 入口 | `GK_MixerApp.swift` | ✅ `@main` + `Appearance` 枚举，`@AppStorage("colorScheme")` 已真正生效 |
| 根导航 | `ContentView.swift` | ✅ 系统 `TabView` + `Tab(value:)` + `tabBarMinimizeBehavior(.onScrollDown)`；`AppTab` 枚举持久化 |
| 设计 token | `Design/Spacing.swift` | ✅ `Spacing`（xxs→xxl + touch 44）、`CornerRadius`（含同心内半径推导） |
| 设计 token | `Design/Colors.swift` | ✅ `AppColor` 语义色（canvas/surface/surfaceNested/accent…）、`BrandColor` 第三方品牌色 |
| 共享组件 | `Design/Components.swift` | ✅ `contentCard` / `SectionHeader` / `PlaceholderWell` / `EmptyStateCard` / `ActionButton`（`.glass` / `.glassProminent`） |
| 模型层 | `Models/ColorData.swift` | ✅ RGB/CMYK/HSB/LAB/ColorData/PaintBrand/RALColor — 与 TS 版 types 1:1 对应，但 UI 层尚未使用 |
| 扩展 | `Extensions/Color+Hex.swift` | ✅ hex → Color |
| 页面 | `Views/ExtractView.swift` | ⚠️ 结构就位，数据全为静态占位（无 PhotosPicker、无取样逻辑） |
| 页面 | `Views/MixerView.swift` | ⚠️ 结构就位；容量 / 算法已是原生 segmented Picker，但不驱动任何计算 |
| 页面 | `Views/BlendView.swift` | ⚠️ 结构就位；色轮无手势 |
| 页面 | `Views/BasicMixerView.swift` | ⚠️ 结构就位；已是真 `Slider`，但无混色引擎，HEX 恒为「—」 |
| 页面 | `Views/SettingsView.swift` | ✅ 原生 `Form`；主题切换、算法选择、版本号（读 Bundle）、外链均已生效 |
| 资产 | `Assets.xcassets/AccentColor` | ✅ #FF9900 + Dark 变体 |
| 设计文档 | `LIQUID_GLASS_UI_REFERENCE.md` | ✅ **实现与验收以本文为准** |
| 设计文档 | `GK_DESIGN_DOC.md` / `design.md` / `liquidglass-project-reference.md` | 📖 产品稿 / 早期愿景 / HIG 理论背景 |

### 待开发（按优先级）

1. **状态层** — `@Observable` 的 `PaletteStore` / `AppState`，在 `GK_MixerApp` 注入。
   跨 Tab 共享调色板是「拾色 → 保存 → 混色」主链路的前提，必须先于页面实现落地。
2. **核心算法移植** — 从 TS port 到 Swift：
   - `mixbox.ts`（1009 行，Kubelka-Munk 物理混色，含 base85 压缩 LUT）
   - `color-engine.ts`（paint 数据库 + 梯度下降配比 + RAL 匹配）
   - `color-space.ts`（sRGB/P3/Adobe RGB ↔ XYZ）
   - `color-extract.ts`（像素取样 → 主色调提取）
   - 用 `gk-mixer-monorepo/packages/core/test/parity.cjs` 做黄金对拍用例
3. **页面实现** — 每屏「结构 + 数据 + 视觉」一次成型，避免在假数据上二次打磨：
   拾色（PhotosPicker + 像素取样）→ 基础 → 自选（色轮手势）→ 混色
4. **本地化** — 建 String Catalog，中/英/日对齐 web 版 `translations.ts`（当前中文全部硬编码）
5. **AppIcon** — `Assets.xcassets/AppIcon` 目前只有空槽位，需用 Icon Composer 出 default/dark/tinted 三套
6. **iOS 特性** — ARKit 取色、Dynamic Island、Live Activities、Siri Intents

### 技术栈

- SwiftUI + Swift 5.0
- 目标平台：iOS 26.0 / macOS 26.0 / visionOS 26.0
- Bundle ID：`com.hdin-studio.GK-Mixer`
- Team：`MM283JDUV2`
- 构建系统：Xcode 26.3（objectVersion 77，文件系统同步根组）

---

## 3. GK-Mixer-miniwebtools-main/ — 原始 Web 参考（只读）

### 提供什么

| 资源 | 对应文件 |
|------|----------|
| **Mixbox 2.0 算法**（完整） | `utils/mixbox.ts`（1009 行） |
| **Paint 数据库**（Gaia/Jumpwind/Gunze/RAL） | `utils/colorUtils.ts`（1621 行，后半段） |
| **色域转换**（sRGB/P3/AdobeRGB） | `utils/colorSpaceConverter.ts`（282 行） |
| **主色调提取算法**（像素量化） | `utils/colorUtils.ts`（`extractProminentColors` 部分） |
| **UI 配色方案** | `tailwind.config.ts` → `macaron-*` 色板 |
| **UI 布局参考** | `App.tsx`（736 行），`components/*.tsx` |
| **i18n 文案**（中/英/日） | `utils/translations.ts`（184 行） |
| **Gemini AI 配方生成** | `services/geminiService.ts` |

### 不提供什么

- ❌ **不能直接在 iOS 运行**（React DOM + HTML5 Canvas + anime.js CDN）
- ❌ **不能用 Swift 自动转换**（需手工重写，但逻辑结构可直接对照）

---

## 4. gk-mixer-monorepo/ — React Native 尝试（已弃用，仅供参考）

### 架构

```
gk-mixer-monorepo/
├── packages/core/         ← TS 纯逻辑库（从 web 抽离，可作 Swift port 对照）
│   ├── src/utils/mixbox.ts
│   ├── src/utils/color-engine.ts
│   ├── src/utils/color-space.ts
│   ├── src/utils/color-extract.ts
│   ├── src/utils/color-convert.ts
│   └── src/types/color.ts
├── apps/web/              ← web 版副本（同 miniwebtools，部分引用 @gk-mixer/core）
└── apps/mobile/           ← RN App（iOS + Android）
    ├── src/screens/       ← 5 个屏幕（已用 @gk-mixer/core 调用算法）
    └── ios/               ← RN 原生桥接（UIColorPicker、AppDelegate）
```

### 可参考的价值

- `packages/core/` 的 TS 代码结构清晰，是 Swift port 的最佳算法对照源
- `apps/mobile/src/theme.ts` 定义了 iOS HIG 设计 token（语义色、SF Pro 字体层级、间距、最小触摸目标 44pt）
- `apps/mobile/src/navigation/RootTabs.tsx` 有已设计好的 5-tab 导航结构和 accent 色 `#FF9900`
- `apps/mobile/src/screens/*.tsx` 展示了各页面如何调用核心算法（可作为 SwiftUI View 的交互流程参考）

### 为什么弃用

- RN 0.86 的性能和原生手感达不到预期
- SwiftUI 可以更直接地使用 Dynamic Island、ARKit、Live Activities 等 iOS 26 特性

---

## 5. 开发路线建议

```
Phase 0: 决策 + 设计 token                                  ✅ 已完成
├── Accent 统一 #FF9900（Assets 含 Dark 变体）
├── Design/Spacing.swift、Design/Colors.swift
└── Design/Components.swift（内容层卡片 + 功能层玻璃按钮）

Phase 1: 导航外壳换血                                        ✅ 已完成
├── ContentView: ZStack+switch → 系统 TabView + Tab(value:)
├── 删除 FloatingDock.swift（手搓胶囊，热区 48×40 不达标）
├── 删除 GlassComponents.swift 的 GlassBackground（全屏 MeshGradient）
├── 删除 5 处 .padding(.bottom, 100) 与 .padding(.top, 8)
└── 删除 toolbarBackground(.visible)，恢复系统 scroll edge effect

Phase 2: 状态层（下一步）
├── @Observable PaletteStore：跨 Tab 共享调色板
└── 在 GK_MixerApp 注入 environment

Phase 3: 核心算法移植
├── Swift port: mixbox.ts → MixboxEngine.swift（LUT + 多项式回归 + lerp）
├── Swift port: color-space.ts → ColorSpaceConverter.swift
├── Swift port: color-engine.ts → PaintEngine.swift（数据库 + 梯度下降 + RAL）
├── Swift port: color-extract.ts → ColorExtractor.swift
└── 对拍测试：packages/core/test/parity.cjs 作为黄金用例

Phase 4: 逐屏重写（结构 + 数据 + 视觉一次成型）
├── ExtractView — PhotosPicker + 像素提取 + 调色板
├── BasicMixerView — 8 色基础混合接入引擎
├── BlendView — 径向混色器（色轮手势 + 实时预览）
└── MixerView — 专业混色台（Mixbox 混合 + 漆料匹配 + RAL）

Phase 5: 打磨与 iOS 原生特性
├── String Catalog 本地化（中/英/日）
├── Dynamic Type、增强对比度验收
├── AppIcon（Icon Composer，default/dark/tinted）
└── ARKit 取色 / Dynamic Island / Live Activities / Siri Intents
```

---

## 6. 关键目录速查

| 用途 | 路径 |
|------|------|
| 当前开发的 Swift 项目 | `GK-Mixer/GK-Mixer.xcodeproj` |
| SwiftUI 源码目录 | `GK-Mixer/GK-Mixer/` |
| Web 版算法原始代码 | `GK-Mixer-miniwebtools-main/utils/` |
| RN 版算法（结构更清晰的 TS） | `gk-mixer-monorepo/packages/core/src/` |
| iOS HIG 设计 token（RN 版） | `gk-mixer-monorepo/apps/mobile/src/theme.ts` |
| iOS 26 设计文档 | `GK-Mixer/design.md` |
| Web 版 UI 参考 | `GK-Mixer-miniwebtools-main/App.tsx` |

---

## 7. 注意事项

- **不要编辑** `gk-mixer-monorepo/` 和 `GK-Mixer-miniwebtools-main/` — 它们是只读参考
- **所有新代码** 写入 `GK-Mixer/GK-Mixer/` 目录
- **新增 Swift 文件** 后 Xcode 会自动识别（项目使用 filesystem synchronized root groups）
- 算法 port 时保持函数签名和逻辑结构与 TS 原版一致，方便后续对照调试
- UI 风格参考 Web 版布局，但**交互组件必须使用原生 SwiftUI**

### UI 硬性约束（违反即返工）

- **分层**：玻璃只出现在功能层（TabBar / Toolbar / 浮动按钮 / Sheet）。内容卡片用 `AppColor.surface`，
  **不要**给内容层套 `.ultraThinMaterial`——这是 Web 思维的残留。
- **间距**：一律走 `Spacing.*`，禁止裸数字 pt。可点目标 ≥ `Spacing.touch`（44）。
- **颜色**：chrome 用 `AppColor.*` 语义色；**只有颜料 swatch 用绝对色**（它必须在深浅色下长得一样）。
  禁止硬编码 `#FFFFFF` / `#000000` 铺底或描边——深色模式必崩。
- **字体**：用语义样式（`.subheadline` / `.caption`…），禁止 `font(.system(size:))`，否则 Dynamic Type 失效。
- **安全区**：不要为 tab bar 手动留白，`TabView` 会自动给 ScrollView 底部 inset。
  仅装饰性背景可 `.ignoresSafeArea()`。
- **导航栏**：不要写 `toolbarBackground(.visible)`，那会关掉 iOS 26 的 scroll edge effect 并造成顶部实心条。
- 每屏合并前，按 `LIQUID_GLASS_UI_REFERENCE.md` §11 验收清单逐条勾选。
