# GK Mixer — 项目开发状态总览

> **当前目标**：将 Web 原生颜料混合工具完整迁移为 **Native SwiftUI iOS App**。
> **阅读对象**：任何接手此项目的 AI Agent / 开发者。

---

## 1. 子项目关系

```
ios-GK-mixer/
├── GK-Mixer/                        ← ⭐ 当前主力：Native SwiftUI App（target）
├── GK-Mixer-miniwebtools-main/      ← 📖 参考源：原始 Web App（算法 + UI 风格来源）
├── gkmixer-1.icon/                  ← Icon Composer 源文件
├── PROJECT_STATUS.md                ← 📋 本文件
└── .git/
```

| 项目 | 状态 | 用途 |
|------|------|------|
| **`GK-Mixer/`** | 🚧 **开发中** | 纯原生 SwiftUI，Xcode 26.x，部署目标 iOS 26.0 |
| **`GK-Mixer-miniwebtools-main/`** | ✅ 已完整 | React 19 + Vite，算法和 UI 的**唯一参考来源** |

> 旧版 `gk-mixer-monorepo/`（React Native 尝试）已删除，不影响原生工程。

---

## 2. GK-Mixer/ — 当前 SwiftUI 项目（开发目标）

### 已实现

| 层级 | 文件 | 状态 |
|------|------|------|
| App 入口 | `GK_MixerApp.swift` | ✅ SwiftData `ModelContainer` + `PaletteStore` / `WorkbenchStore` 环境注入 |
| 根导航 | `ContentView.swift` | ✅ 混色台 / 调色 / 调色板 / 设置；旧 Tab ID 自动迁移 |
| 设计 token | `Design/Spacing.swift` | ✅ `Spacing`（xxs→xxl + touch 44）、`CornerRadius`（含同心内半径推导） |
| 设计 token | `Design/Colors.swift` | ✅ `AppColor` 语义色（canvas/surface/surfaceNested/accent…）、`BrandColor` 第三方品牌色 |
| 共享组件 | `Design/Components.swift` | ✅ `contentCard` / `SectionHeader` / `PlaceholderWell` / `EmptyStateCard` / `ActionButton`（`.glass` / `.glassProminent`） |
| 模型层 | `Models/PaletteModels.swift` | ✅ SwiftData 色卡/分类、HEX 唯一约束、双颜料体系版本化 Mixbox 快照、RAL 快照 |
| 状态层 | `State/PaletteStore.swift` | ✅ 持久化、HEX 去重、分类 CRUD、搜索组合过滤 |
| 状态层 | `State/WorkbenchStore.swift` / `BasicMixerStore.swift` | ✅ Web 8 色分解、RAL 识别、基础混色与调色板待用配方 |
| 算法层 | `Services/ColorAlgorithmRuntime.swift` + `Resources/gk-color-algorithms.js` | ✅ JavaScriptCore 离线运行 Web Mixbox LUT、旧版 8 色反求、基础混色与 RAL Classic 匹配 |
| 算法层 | `Services/MixboxEngine.swift` / `MixboxRecipeSolver.swift` | ✅ 保留 Swift 前向模型与求解器用于回归/对照；生产反求走 Web Bundle |
| 模型层 | `Models/ColorData.swift` | ✅ RGB/CMYK/HSB/LAB/ColorData/PaintBrand/RALColor |
| 扩展 | `Extensions/Color+Hex.swift` | ✅ hex → Color |
| 页面 | `Views/MixerWorkbenchView.swift` | ✅ 拾色：源图像 + 原生 ColorPicker + RAL 色卡；混色：目标容量 × Mixbox 权重 → 毫升配方（底漆/+/xml）；已固定 Mixbox |
| 页面 | `Views/TuningWorkbenchView.swift` | ✅ 原生分段整合自选/基础；子页状态保留 |
| 页面 | `Views/BlendView.swift` | ⚠️ 调色页“自选”分段；色轮无手势 |
| 页面 | `Views/BasicMixerView.swift` | ✅ 调色页“基础”分段；8 色 Slider 实时 Mixbox 混色、HEX、RAL 与保存已接通 |
| 页面 | `Views/PaletteView.swift` | ✅ 搜索、分类、3 列网格、详情 Sheet、RAL 信息、配方暂存、分享与删除 |
| 页面 | `Views/SettingsView.swift` | ✅ 原生 `Form`；主题切换、算法选择、版本号（读 Bundle）、外链均已生效 |
| 资产 | `Assets.xcassets/AccentColor` | ✅ #FF9900 + Dark 变体 |
| 设计文档 | `LIQUID_GLASS_UI_REFERENCE.md` | ✅ **实现与验收以本文为准** |
| 设计文档 | `GK_DESIGN_DOC.md` / `design.md` / `liquidglass-project-reference.md` | 📖 产品稿 / 早期愿景 / HIG 理论背景 |

### 待开发（按优先级）

1. **剩余算法接入**：
   - Paint 品牌数据库与最近漆料匹配
   - `color-space.ts`（sRGB/P3/Adobe RGB ↔ XYZ）
   - `color-extract.ts`（像素取样 → 主色调提取）
   - Web Bundle 更新命令：`npm run build:ios-algorithms`
2. **页面实现** — 图片主色提取、自选色轮手势
3. **本地化** — 建 String Catalog，中/英/日对齐 web 版 `translations.ts`
4. **AppIcon** — 用 Icon Composer 出 default/dark/tinted 三套
5. **iOS 特性** — ARKit 取色、Dynamic Island、Live Activities、Siri Intents

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

## 4. 开发路线建议

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

Phase 2: 状态层与调色板                                     ✅ 已完成
├── SwiftData: SavedColor / PaletteCategory
├── @Observable PaletteStore / WorkbenchStore
├── HEX 去重、搜索、分类、3 列网格、详情 Sheet
└── 调色板 → 待用配方联动

Phase 3: 核心算法移植
├── JavaScriptCore: Web Mixbox LUT + 旧版八色比例求解         ✅ 已完成
├── JavaScriptCore: Gaia/Process 基础混色 + RAL Classic       ✅ 已完成
├── Swift port: Mixbox 前向模型 + 八色比例求解（对照实现）     ✅ 已完成
├── Swift port: color-space.ts → ColorSpaceConverter.swift
├── PaintEngine.swift（漆料品牌数据库与匹配）
├── Swift port: color-extract.ts → ColorExtractor.swift
└── Bundle / 配方 / RAL 黄金用例测试                           ✅ 已完成

Phase 4: 逐屏重写（结构 + 数据 + 视觉一次成型）
├── MixerWorkbenchView — 拾色/混色分段、Mixbox、保存         ✅ 基础链路完成
├── PaletteView — 搜索、分类、详情、分享、删除               ✅ 已完成
├── Extract — PhotosPicker 已完成；像素提取待接
├── TuningWorkbenchView — 自选/基础分段                         ✅ 已完成
├── BasicMixerView — 8 色基础混合接入引擎                     ✅ 已完成
├── BlendView — 径向混色器（色轮手势 + 实时预览）
└── Mixer — RAL 名称已接；漆料品牌匹配待接

Phase 5: 打磨与 iOS 原生特性
├── String Catalog 本地化（中/英/日）
├── Dynamic Type、增强对比度验收
├── AppIcon（Icon Composer，default/dark/tinted）
└── ARKit 取色 / Dynamic Island / Live Activities / Siri Intents
```

---

## 5. 关键目录速查

| 用途 | 路径 |
|------|------|
| 当前开发的 Swift 项目 | `GK-Mixer/GK-Mixer.xcodeproj` |
| SwiftUI 源码目录 | `GK-Mixer/GK-Mixer/` |
| Web 版算法原始代码 | `GK-Mixer-miniwebtools-main/utils/` |
| iOS 26 设计文档 | `GK-Mixer/LIQUID_GLASS_UI_REFERENCE.md` |
| Web 版 UI 参考 | `GK-Mixer-miniwebtools-main/App.tsx` |
| App Icon 源 | `gkmixer-1.icon/` / `GK-Mixer/GK-Mixer/AppIcon.icon` |

---

## 6. 注意事项

- **不要编辑** `GK-Mixer-miniwebtools-main/` — 只读参考（算法已通过 JS Bundle 接入原生）
- **所有新代码** 写入 `GK-Mixer/GK-Mixer/` 目录
- **新增 Swift 文件** 后 Xcode 会自动识别（项目使用 filesystem synchronized root groups）
- Web 算法通过 `native/ios-bridge.ts` 暴露稳定 JSON 接口；修改 TS 后必须重建并提交 iOS Bundle
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
