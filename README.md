# GK Paint Mixing Simulator (GK_混色模拟器.exe)

> A futuristic, programmer-style color mixing tool for model kit painters.
> 专为 GK 模玩爱好者设计的赛博风格调漆模拟器。

![App Screenshot](./docs/screenshots/屏幕截图%202025-11-29%20234749.png)


## 🎨 Project Overview

**GK Mixer** allows modelers to extract colors from reference images and simulate paint mixing using real-world physics. It bridges the gap between digital RGB colors and physical pigment mixing (FDM/Resin/Paints).

Designed with a clean, low-saturation "Macaron" aesthetic for high readability.

## ✨ Key Features

### 1. Visual Input & Analysis (源图像输入)
* **Smart Extraction**: Drag & drop images to auto-detect the palette.
* **Precision Tools**: Zoom/Pan loupe with manual eyedropper.
* **Color Decomposition**: Breaks down colors into standard RGB & CMYK percentages.

### 2. Paint Mixing Console (混色控制台)
* **Physical Simulation**: Uses **Kubelka-Munk theory** (via Mixbox) for realistic pigment mixing (Blue + Yellow = Green), distinct from standard digital blending.
* **Brand Matching**: Auto-matches colors to **Mr. Hobby, Gaia, and Jumpwind** databases.
* **Dual Modes**:
    * **CMYK Correction**: Standard subtractive mixing.
    * **Universal Blend**: Base Paint + Additive X (CMYK or other brands).

### 3. Virtual Paint Bottle (调漆瓶模拟器)
* **Visual Feedback**: Real-time liquid simulation showing the mixed color inside a calibrated bottle.
* **Volume Presets**: One-click scaling for 10ml, 20ml, ... 60ml batches.
* **Dynamic Recipe**: Instantly calculates exactly how many mL of target paint to add to the base.
* **Fluid Animations**: Powered by `anime.js` for smooth liquid transitions.

### 4. AI Assistant (Gemini 2.5)
* Generates human-readable mixing recipes.
* Auto-translates paint names and instructions to the selected language.

### 5. UX/UI
* **Theming**: Seamless Dark/Light mode toggle.
* **i18n**: Full support for English, Chinese (中文), and Japanese (日文).

## 🛠 Tech Stack

* **Frontend**: React, TypeScript, Vite
* **Styling**: Tailwind CSS
* **Animation**: Anime.js
* **Algorithm**: Mixbox (Physics-based color mixing)
* **AI**: Google Gemini API

## ⚡ Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview
```

## 🚀 Cloudflare Pages 部署

详见 [CLOUDFLARE_DOCS.md](./CLOUDFLARE_DOCS.md)

### 快速部署

1. **连接 Git 仓库**
   - 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
   - Pages → 创建项目 → 连接到 Git

2. **配置构建设置**
   - 构建命令：`npm run build`
   - 构建输出目录：`dist`
   - 环境变量：`API_KEY=your_gemini_api_key`

3. **部署完成**
   - 访问 `https://your-project.pages.dev`

📖 更多部署信息查看 [docs/deployment/](./docs/deployment/)
⚖️ Credits & Licenses
Core Mixing Algorithm: Mixbox
This project uses Mixbox for accurate pigment mixing simulation.

Copyright: (c) 2022 Secret Weapons

License: Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)

Author: Sarka Sochorova and Ondrej Jamriska

Source: https://github.com/scrtwpns/mixbox

Note: This project is for educational and non-commercial use. If you intend to use this commercially, please contact Mixbox authors for a license.

Developed with ❤️ by HDINEBER



