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
| App 入口 | `GK-Mixer/GK_MixerApp.swift` | ✅ `@main`，WindowGroup → ContentView |
| 根导航 | `GK-Mixer/ContentView.swift` | ✅ 5-Tab TabView（拾色/混色/自选/基础/设置），orange tint |
| 模型层 | `GK-Mixer/Models/ColorData.swift` | ✅ RGB/CMYK/HSB/LAB/ColorData/PaintBrand/RALColor — 与 TS 版 types 1:1 对应 |
| 页面 | `Views/ExtractView.swift` | ⚠️ 占位（仅 icon + 描述文字） |
| 页面 | `Views/MixerView.swift` | ⚠️ 占位 |
| 页面 | `Views/BlendView.swift` | ⚠️ 占位 |
| 页面 | `Views/BasicMixerView.swift` | ⚠️ 占位 |
| 页面 | `Views/SettingsView.swift` | ✅ 基本完成（深色模式 toggle、开发者信息、外链） |
| 服务 | `Services/ColorPickerModule.swift` | ⚠️ 是 RN bridge 残留代码，纯 SwiftUI 项目中不需要 |
| 设计文档 | `design.md` | ✅ iOS 26 完整设计规范 |

### 待开发（按优先级）

1. **核心算法移植** — 从 TS port 到 Swift：
   - `mixbox.ts`（1009 行，Kubelka-Munk 物理混色，含 base85 压缩 LUT）
   - `color-engine.ts`（paint 数据库 + 梯度下降配比 + RAL 匹配）
   - `color-space.ts`（sRGB/P3/Adobe RGB ↔ XYZ）
   - `color-extract.ts`（像素取样 → 主色调提取）
2. **页面实现** — 用原生 SwiftUI 组件重写 5 个 Tab 页面
3. **iOS 特性** — ARKit 取色、Dynamic Island、Live Activities、Siri Intents
4. **清理** — 删除 `ColorPickerModule.swift`（RN artifact）

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
Phase 1: 核心算法移植（当前进行中）
├── Swift port: mixbox.ts → MixboxEngine.swift（LUT + 多项式回归 + lerp）
├── Swift port: color-space.ts → ColorSpaceConverter.swift
├── Swift port: color-engine.ts → PaintEngine.swift（数据库 + 梯度下降 + RAL）
└── Swift port: color-extract.ts → ColorExtractor.swift

Phase 2: 页面重写
├── ExtractView — 图片选择器 + 像素提取 + 调色板
├── MixerView — 专业混色台（Mixbox 混合 + 漆料匹配 + RAL）
├── BlendView — 径向混色器（CMY slider + 实时预览）
├── BasicMixerView — 8 色基础混合
└── SettingsView — 完善语言/色彩空间设置

Phase 3: iOS 原生特性
├── ARKit 实时取色
├── Dynamic Island 混色进度
├── Live Activities 配方锁屏
└── Siri Intents 语音调色
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
- **ColorPickerModule.swift** 是 RN 残留在纯 SwiftUI 项目中，可以删除
- 算法 port 时保持函数签名和逻辑结构与 TS 原版一致，方便后续对照调试
- UI 风格参考 Tailwind `macaron-*` 配色 + Web 版布局，但**交互组件必须使用原生 SwiftUI**
