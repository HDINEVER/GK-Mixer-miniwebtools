# GK Paint Mixing Simulator (GK_混色模拟器)

> A futuristic, programmer-style color mixing tool for model kit painters.
> 专为 GK 模玩爱好者设计的赛博风格调漆模拟器。

![App Screenshot](./docs/screenshots/屏幕截图%202025-11-29%20234749.png)


## 🎨 Project Overview

**GK Mixer** allows modelers to extract colors from reference images and simulate paint mixing using real-world physics. It bridges the gap between digital RGB colors and physical pigment mixing (FDM/Resin/Paints).

Designed with a clean, low-saturation "Macaron" aesthetic for high readability, with comprehensive mobile optimization and professional color space support.

## ✨ Key Features

### 1. Visual Input & Analysis (源图像输入)
* **Smart Extraction**: Drag & drop images to auto-detect up to 8 prominent colors.
* **Precision Tools**: Zoom/Pan loupe with manual eyedropper for precise color picking.
* **Color Space Support**: 🆕 Native support for **sRGB, Display P3, and Adobe RGB (1998)** color spaces.
* **Gamut Validation**: Automatic out-of-gamut detection with visual indicators.
* **Color Decomposition**: Breaks down colors into standard RGB & CMYK percentages with real-time conversion.

### 2. Paint Mixing Console (混色控制台)
* **Physical Simulation**: Uses **Kubelka-Munk theory** (via Mixbox) for realistic pigment mixing (Blue + Yellow = Green), distinct from standard digital blending.
* **Brand Matching**: Auto-matches colors to **Mr. Hobby, Gaia, Jumpwind, and Gunze** paint databases with ΔE color distance calculation.
* **CMY Mode**: Uses only Cyan, Magenta, Yellow primaries (no K/black) for authentic subtractive color mixing.
* **Dual Modes**:
    * **CMYK Correction**: Standard subtractive mixing for color matching.
    * **Universal Blend**: Base Paint + Additive X (CMY or other brands).

### 3. Interactive Mixing Modes 🆕

#### 3.1 Radial Palette Mixer (径向自选混合)
* **Interactive Canvas**: Drag-and-drop sliders arranged radially around a central mixing circle.
* **Real-time Blending**: Uses Mixbox latent space for physical paint mixing simulation.
* **Volume Calculator**: Automatically calculates ml needed for each color based on target volume (10-60ml presets).
* **Visual Feedback**: 
  - Radial slider positioning (outer=0%, inner=100%)
  - Mosaic pattern when no colors mixed
  - Target color comparison ring
  - Animated transitions with anime.js
* **Smooth Dragging**: Elastic animations and glow effects during interaction.
* **Color Selection**: Choose from extracted palette or use any available colors.

#### 3.2 Basic Color Mixer (基础色混合) 🆕
* **Foundation Palette**: Pre-loaded with 5 Gaia base colors (White, Black, Red, Blue, Yellow).
* **Physical Mixing Engine**: Powered by Mixbox for realistic subtractive color blending.
* **Interactive Sliders**: Drag radial sliders to adjust each color's contribution (0-100%).
* **Real-time Preview**: Central mixing circle updates instantly with resulting color.
* **Volume Calculation**: Precise ml breakdown for each component based on target volume.
* **Responsive Design**: Fluid layout adapts from mobile (240px minimum) to desktop (500px base).
* **Performance Optimized**: Throttled rendering for smooth 60fps animation on all devices.

### 4. Palette Visualizer (色板生成器) 🆕
* **Export Modes**: 
  - **STRIPES**: Horizontal color band layout
  - **CLAY**: Organic stone/clay texture overlay
  - **COMIC**: Comic-style speech bubble design
  - **TICKET**: Circular "Infinity Stones" themed arrangement
* **High-Quality Export**: One-click export to PNG with 2x resolution scaling via html2canvas.
* **Source Image Integration**: Optionally include reference image in visualizations.
* **Dynamic Layout**: Automatically adapts to extracted color count (1-8 colors).

### 5. Virtual Paint Bottle (调漆瓶模拟器)
* **Visual Feedback**: Real-time liquid simulation showing the mixed color inside a calibrated bottle.
* **Volume Presets**: One-click scaling for 10ml, 20ml, 30ml, 40ml, 50ml, 60ml batches.
* **Dynamic Recipe**: Instantly calculates exactly how many mL of target paint to add to the base.
* **Fluid Animations**: Powered by `anime.js` for smooth liquid transitions.
* **CMYK Layer Visualization**: Stacked liquid layers representing each CMYK component.

### 6. AI Assistant (Gemini 2.5 Flash)
* Generates human-readable mixing recipes based on CMYK ratios and selected color space.
* Auto-translates paint brand names and instructions to the selected language.
* Fallback handling for API errors with graceful degradation.

### 7. Advanced UX/UI
* **Theming**: Seamless Dark/Light mode toggle with system preference detection.
* **i18n**: Full support for English, Chinese (中文), and Japanese (日文).
* **Responsive Layout**: Fluid grid system adapts from mobile (320px) to desktop (1920px+).
* **Mobile Optimization**: 🆕 Touch-optimized interactions, pinch-to-zoom, and responsive canvas rendering.
* **Performance**: Throttled event handlers, RAF-based animations, and lazy color extraction for smooth 60fps experience.

## 🛠 Tech Stack

* **Frontend**: React 19, TypeScript, Vite
* **Styling**: Tailwind CSS with custom Macaron color palette
* **Animation**: Anime.js for fluid UI transitions
* **Canvas**: HTML5 Canvas API with color space support
* **Algorithm**: Mixbox (Physics-based Kubelka-Munk pigment mixing)
* **AI**: Google Gemini 2.5 Flash API
* **Export**: html2canvas for high-resolution palette exports
* **Deployment**: Cloudflare Pages with serverless functions

## 📊 Technical Highlights

### Color Space Implementation
* **RGB ↔ XYZ ↔ Linear RGB** conversions with proper gamma correction
* **sRGB, Display P3, Adobe RGB** transformation matrices (D65 white point)
* **Gamut mapping** with visual indicators for out-of-gamut colors
* **Canvas color space rendering** for accurate color display

### Performance Optimizations 🆕
* **Responsive Canvas Sizing**: Dynamic scaling based on container width (240px-500px)
* **Event Throttling**: Touch/mouse events limited to 16ms intervals (60fps)
* **RAF-based Animations**: RequestAnimationFrame for smooth rendering
* **Lazy Color Extraction**: Debounced palette generation to prevent UI blocking
* **Memory Management**: Proper cleanup of event listeners and animation frames

### Mobile-First Design 🆕
* **Touch Interactions**: Native touch event handling with gesture support
* **Fluid Typography**: Responsive font sizing (10px-16px range)
* **Flexible Layouts**: CSS Grid/Flexbox with breakpoint-aware spacing
* **High-DPI Support**: Retina display optimization with proper pixel ratio handling

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

### Environment Setup
Create `.env.local` in project root:
```
API_KEY=your_gemini_api_key_here
```

## 📱 Browser Compatibility

* **Desktop**: Chrome 94+, Firefox 94+, Safari 15+, Edge 94+
* **Mobile**: iOS Safari 15+, Chrome for Android 94+
* **Color Spaces**: Display P3 (Safari/iOS), sRGB (universal), Adobe RGB (calculated fallback)

## 🚀 Deployment

### Cloudflare Pages
Detailed deployment guide: [CLOUDFLARE_DOCS.md](./CLOUDFLARE_DOCS.md)

**Quick Deploy:**
1. Connect Git repository to Cloudflare Dashboard
2. Build command: `npm run build`
3. Build output: `dist`
4. Environment variable: `API_KEY=your_gemini_api_key`
5. Access: `https://your-project.pages.dev`

📖 More deployment info: [docs/deployment/](./docs/deployment/)

## 📚 Documentation

* [Color Space Support](./docs/COLOR_SPACE_SUPPORT.md) - Technical details on sRGB/P3/Adobe RGB implementation
* [Mobile Optimization](./docs/MOBILE_OPTIMIZATION.md) - Performance improvements and responsive design
* [Radial Mixer Details](./docs/RADIAL_MIXER_OPTIMIZATION.md) - Interactive mixing canvas architecture
* [Color Calibration](./docs/COLOR_CALIBRATION.md) - Gamut mapping and color accuracy
* [Mobile Testing Guide](./docs/MOBILE_TEST_GUIDE.md) - Cross-device testing procedures

## 🔬 Architecture Notes

### Component Structure
```
App.tsx                      # Main orchestrator, state management
├── DropZone                # Image upload & drag-drop
├── ColorPalette            # Extracted color grid with manual picker
├── MixerResult             # CMYK analysis + AI recipe + bottle simulator
├── RadialPaletteMixer      # Interactive radial canvas mixer
├── BasicColorMixer         # Foundation color blending tool
└── PaletteVisualizer       # Export palette as styled images
```

### Data Flow
```
Image Upload → Color Extraction → Color Space Conversion → Palette Display
                                                         ↓
Selected Color → CMYK Decomposition → Paint Matching → AI Recipe Generation
                                                         ↓
                                   Mixing Simulation → Volume Calculation → Bottle Visualization
```

### Critical Patterns
1. **Single Selected Color Model**: Only one color drives the mixing console at a time
2. **Lazy AI Evaluation**: Gemini API calls only on color/language changes with caching
3. **Base Paint Toggle**: Deselecting paint triggers pure CMYK mode
4. **Volume Calculation**: Mixing bottle layers scaled by CMYK % × total volume
5. **Canvas Coordinate Mapping**: Proper scaling between display size and pixel coordinates

---

## ⚖️ Credits & Licenses

### Core Mixing Algorithm: Mixbox
This project uses **Mixbox** for accurate pigment mixing simulation based on Kubelka-Munk theory.

* **Copyright**: (c) 2022 Secret Weapons
* **License**: Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)
* **Authors**: Šárka Sochorová and Ondřej Jamriska
* **Source**: https://github.com/scrtwpns/mixbox
* **Citation**: Šárka Sochorová and Ondřej Jamriska. 2021. Practical Pigment Mixing for Digital Painting. ACM Trans. Graph. 40, 6, Article 234 (December 2021), 11 pages. DOI: https://doi.org/10.1145/3478513.3480581

**Note**: This project is for educational and non-commercial use. For commercial licensing, please contact the Mixbox authors.

### Additional Libraries
* **html2canvas**: MIT License - DOM screenshot capability
* **Anime.js**: MIT License - Animation engine
* **Tailwind CSS**: MIT License - Utility-first CSS framework

---

## 🎯 Roadmap

- [x] Basic color extraction and CMYK decomposition
- [x] Paint brand database matching (Mr. Hobby, Gaia, Jumpwind, Gunze)
- [x] Gemini AI recipe generation
- [x] Dark/Light theme toggle
- [x] Multi-language support (EN/中文/日文)
- [x] Radial palette mixer with drag-and-drop
- [x] Basic color mixer with foundation palette
- [x] Color space support (sRGB, Display P3, Adobe RGB)
- [x] Mobile optimization and responsive design
- [x] Palette visualizer with export modes
- [x] Cloudflare Pages deployment
- [ ] LAB color space support for better perceptual matching
- [ ] User-uploaded custom paint databases
- [ ] Batch color extraction from multiple images
- [ ] Recipe saving and sharing system
- [ ] PWA support for offline usage
- [ ] Advanced AI suggestions with brand preference learning

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

**Development Notes:**
* Follow existing TypeScript patterns and interfaces
* Maintain i18n support for all user-facing strings
* Test on both mobile and desktop breakpoints
* Preserve Mixbox license attribution
* Document color space conversions clearly

---

## 📄 License

This project is licensed under **CC BY-NC 4.0** (Creative Commons Attribution-NonCommercial 4.0 International) to maintain compatibility with the Mixbox library license.

**You are free to:**
- Share: Copy and redistribute the material
- Adapt: Remix, transform, and build upon the material

**Under the following terms:**
- Attribution: Give appropriate credit
- NonCommercial: Not for commercial use without permission

For commercial use inquiries, please contact the repository owner.

---

**Developed with ❤️ by HDINEBER**

*Last Updated: December 2025*



