# GK Mixer — 素材与设计资产索引指南 (Assets Catalog)

> **目的**：对整个大项目中的设计稿、截屏、营销素材、品牌图标及色卡资源进行集中归纳整理，方便后续各个子模块开发与 AI Agent 快速检索。  
> **核心原则**：所有素材统一归档在 `assets/` 目录下；根目录通过向后兼容软链接保留对旧脚本调用的兼容。`GK-Mixer/` 与 `GK-Mixer-miniwebtools-main/` 两个主工程保持绝对独立和完整。

---

## 1. 资产总目录树

```
ios-GK-mixer/
├── assets/                                 # 🎨 统一素材资源总库
│   ├── app-store/                          # App Store 营销与上架截图
│   │   ├── framed/                         # 官方定稿截图（已套机型壳 + 中英文案）
│   │   │   ├── iphone-6.5/                 # 1242 × 2688 (10 张)
│   │   │   ├── ipad-13/                    # 2048 × 2732 (8 张)
│   │   │   └── ipad-2064x2752/             # 2064 × 2752 (framed & fullscreen)
│   │   ├── raw/                            # 原始真机/模拟器截屏留存 (raw_01 ~ raw_08)
│   │   └── promo-preview/                  # 宣传预览与推演图 (test1.png, 1024 × 1024)
│   │
│   ├── iap-promotional/                    # 内购 (IAP) 宣传物料
│   │   ├── GK_Mixer_IAP_GoldBadge_1024x1024.png   # 终身会员金质水晶流体徽章
│   │   └── IAP_Review_Screenshot_Lifetime.png     # App Store 审核购买凭证截图 (1206 × 2622)
│   │
│   ├── branding-icons/                     # 品牌、设计图层与参考原画
│   │   ├── icons/                          # 矢量品牌与社媒图标 (X, Bilibili)
│   │   ├── layers/                         # 设计分解图层 (喷笔、颜料瓶、遮阳帽、粉色瓶盖)
│   │   └── reference-art/                  # Grok AI 概念设计与视觉灵感原画 (1024 × 1024)
│   │
│   ├── app-icon/                           # App 图标工程
│   │   └── gkmixer-1.icon/                 # Apple Icon Composer bundle (含分层 Assets)
│   │
│   └── paint-catalogs/                     # 颜料库提取素材与色块
│       └── nightworks/                     # 夜之工坊产物 (NightWorksCatalog.json + 256x256 缩略图)
│
├── scripts/                                # 🛠️ 资产生成与自动化处理脚本
│   ├── iap-badge-generators/               # 4 代流体玻璃徽章渲染脚本 (render_liquid_glass.py v1~v4)
│   ├── generate-ipad-screenshots.mjs       # iPad 13 寸截图标注生成器
│   ├── generate-ipad-2064.mjs              # iPad 2064 截图生成器
│   ├── render_goldie_store_previews.py     # Goldie 商店海报渲染器
│   ├── extract_nightworks.py               # 夜之工坊 Excel 色彩提取与缩略图导出器
│   ├── import-paint-catalog.mjs            # 综合颜料目录合并器
│   ├── test_match_links.py                 # 淘宝商品精准链接匹配测试
│   └── update_categories.py                # 漆料分类与 NMP 英文名补全脚本
│
├── goldie/                                 # 📱 自动化截图配置与输出
├── .argent/                                # 🤖 UI 自动化测试与流程定义
└── legal/                                  # 📜 隐私政策托管
    ├── privacy.html
    └── privacy-policy-repo/
```

---

## 2. 素材模块详细说明与查找指引

### 2.1 App Store 上架与营销截图 (`assets/app-store/`)

| 子文件夹 / 文件 | 分辨率 / 格式 | 用途说明 | 对应生成脚本 / 工具 |
|---|---|---|---|
| `framed/iphone-6.5/` | 1242 × 2688 (PNG) | 对应 iPhone 6.5" / 6.7" / 6.9" 官方 App Store 宣传海报 (10张) | Goldie / `scripts/render_goldie_store_previews.py` |
| `framed/ipad-13/` | 2048 × 2732 (PNG) | 对应 iPad Pro 12.9" / 13" 官方 App Store 宣传海报 (8张) | `scripts/generate-ipad-screenshots.mjs` |
| `framed/ipad-2064x2752/` | 2064 × 2752 (PNG) | 对应新版 iPad 2064 × 2752 标准版海报与全屏图 | `scripts/generate-ipad-2064.mjs` |
| `raw/` | 470 × 1024 等 (PNG) | `raw_01` ~ `raw_08` 原始未经套壳裁切的模拟器/真机功能截屏留存 | 手动/自动化抓取留档 |
| `promo-preview/test1.png` | 1024 × 1024 (PNG) | 营销推文或预热展示用的方形海报 | 设计合成留档 |

### 2.2 内购宣传图 (`assets/iap-promotional/`)

| 文件名 | 分辨率 | 场景说明 |
|---|---|---|
| `GK_Mixer_IAP_GoldBadge_1024x1024.png` | 1024 × 1024 | 苹果 App Store Connect 终身买断制（Lifetime Pro）内购商品宣传图标 |
| `IAP_Review_Screenshot_Lifetime.png` | 1206 × 2622 | 提交苹果审核时所需的 App 内购支付页面审查截屏 |

### 2.3 品牌与设计素材 (`assets/branding-icons/`)

| 类别 | 包含文件 | 说明与用途 |
|---|---|---|
| **`icons/`** | `X_icon.svg`<br>`bilibili-1336519698016049435_0px.svg` | 社交媒体官方矢量图标（用于 App 设置页外链或营销网页） |
| **`layers/`** | `layer-airbrush.png` (508×420)<br>`layer-pill-bottle.png` (237×369)<br>`layer-brown-hat.png` (666×357)<br>`layer-pink-bottle-cap.png` (190×101) | 应用图标设计与 UI 动效用的透明背景拆分元素 |
| **`reference-art/`** | `grok-image-*.jpg`<br>`grok-image-*.png` (1024×1024) | 猫咪喷涂与调色师形象设计概念原画参考 |

### 2.4 图标工程 (`assets/app-icon/`)

- `gkmixer-1.icon/`：macOS Apple Icon Composer 官方工程包，内部包含 `icon.json` 以及分层 `Assets/`，可直接通过 macOS 的 Icon Composer 打开与修改。

### 2.5 颜料数据库产物 (`assets/paint-catalogs/`)

- `nightworks/NightWorksCatalog.json`：由 `scripts/extract_nightworks.py` 解析出的夜之工坊完整色彩结构体，包含 CIELAB (D65)、RGB、HEX、官方分类及淘宝精准商品链接。
- `nightworks/paints/`：夜之工坊所有色号导出的 256 × 256 缩略色卡图。

---

## 3. 根目录与资产库说明

为确保开发习惯与历史脚本调用顺畅，根目录保留了实体文件夹：

- [app_store_screenshots](file:///Users/krooshuang/code/ios-GK-mixer/app_store_screenshots)：对应官方定稿海报（与 `assets/app-store/framed` 结构一致）
- [IAP_Promotional_Images](file:///Users/krooshuang/code/ios-GK-mixer/IAP_Promotional_Images)：对应内购宣传与审核凭证物料（与 `assets/iap-promotional` 同步）
- [NightWorks_Output](file:///Users/krooshuang/code/ios-GK-mixer/NightWorks_Output)：对应夜之工坊产物（与 `assets/paint-catalogs/nightworks` 同步）
- [gkmixer-1.icon](file:///Users/krooshuang/code/ios-GK-mixer/gkmixer-1.icon)：对应 Icon Composer 工程（与 `assets/app-icon/gkmixer-1.icon` 同步）

以上 4 个目录均为普通实体文件夹（非快捷方式/软链接），可直接在 macOS Finder 或 Xcode/VS Code 中作为独立工程目录访问与打开。

---

## 4. 常见任务快速执行命令

### 重新生成 iPad 宣传海报
```bash
# 生成 2048 x 2732 (iPad 13)
node scripts/generate-ipad-screenshots.mjs

# 生成 2064 x 2752 (iPad 2064)
node scripts/generate-ipad-2064.mjs
```

### 重新生成 IAP 金质流体玻璃图标
```bash
python3 scripts/iap-badge-generators/render_liquid_glass_v4.py
```

### 重新解析夜之工坊色卡与合并目录
```bash
python3 scripts/extract_nightworks.py
node scripts/import-paint-catalog.mjs
```
