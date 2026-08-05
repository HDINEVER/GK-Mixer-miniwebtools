# AI Coding Agent Instructions for GK-Mixer

## Project Overview
GK-Mixer is a **programmer-style paint mixing simulator** for hobby model painters (Garage Kit enthusiasts). It combines image color extraction, CMYK decomposition, and AI-powered paint recipe generation using the Gemini API.

**Key Goals:**
- Extract prominent colors from reference images (auto + manual picking)
- Decompose RGB → CMYK for paint mixing
- Match colors to real hobby paint brands (Mr. Hobby, Gaia, Jumpwind)
- Generate intelligent mixing recipes via Gemini 2.5 Flash AI
- Provide a visual mixing bottle simulator with volume calculations

---

## Architecture & Data Flow

### Core Components
1. **App.tsx** (main state container)
   - Manages global state: colors, selected color, zoom/pan, language, theme
   - Handles image upload via `DropZone` and color extraction
   - Coordinates manual color picking with canvas interaction

2. **Color Pipeline:**
   - Image → `DropZone` → `extractProminentColors()` → `ColorData[]`
   - Each `ColorData` includes: `id`, `hex`, `RGB`, `CMYK`, `source` ('auto' | 'manual')
   - **Single color selection** drives the mixing console

3. **Gemini Integration** (`services/geminiService.ts`)
   - `generatePaintRecipe(color, lang)` → async AI response
   - Uses `gemini-2.5-flash` with thinking budget set to 0 (for speed)
   - Prompt includes CMYK ratios; response formatted as "70% Brand X + 30% Brand Y"
   - **Environment:** `process.env.API_KEY` must be set via `.env.local`

4. **Paint Matching** (`colorUtils.ts`)
   - `findNearestPaints(hex)` uses Euclidean distance (RGB space)
   - Returns `PaintBrand[]` with `id`, `brand`, `code`, `name`, `hex`
   - Auto-selects first match; user can toggle selection or use pure CMYK mode

### Key Data Structures
```typescript
// ColorData: core unit of color information
interface ColorData {
  id: string;              // Unique ID for tracking across re-renders
  hex: string;             // "#RRGGBB"
  rgb: RGB;                // {r, g, b} 0–255
  cmyk: CMYK;              // {c, m, y, k} 0–100 (percentages)
  source: 'auto' | 'manual';
}

// MixRecipe: output of analysis (used in MixerResult)
interface MixRecipe {
  baseColor: ColorData;
  cmykRatio: string;       // e.g., "C70 M20 Y10 K0"
  aiSuggestion: string;    // Gemini response
  nearestPaints: PaintBrand[];
}
```

---

## Developer Workflows

### Local Development
```bash
npm install              # Install dependencies
npm run dev              # Vite dev server (http://localhost:5173)
npm run build            # Production build
npm run preview          # Preview production build
```

### Environment Setup
Create `.env.local` in project root:
```
API_KEY=your_gemini_api_key_here
```
The app gracefully handles missing API key (shows fallback message).

### Adding New Paint Brands
Edit color matching logic in `colorUtils.ts`:
- `findNearestPaints()` searches a predefined paint database
- To add brands: extend the paint database array with `PaintBrand` objects
- Distance calculation uses standard RGB Euclidean distance

---

## Project-Specific Patterns & Conventions

### Color Conversions
- **RGB → CMYK:** `rgbToCmyk(r, g, b)` normalizes RGB to 0–1, applies standard formula
- **Hex ↔ RGB:** `hexToRgb()`, `rgbToHex()` handle bidirectional conversion
- **Contrast Detection:** `getContrastColor(hex)` uses YIQ formula for text visibility

### Image Processing & Canvas Interaction
- **Prominent Color Extraction:** `extractProminentColors(img)` returns up to 8 colors
- **Manual Color Picking:** Canvas click handler scales pixel coordinates correctly
  - Formula: `pixelX = Math.floor(offsetX * scaleX)` where `scaleX = canvas.width / offsetWidth`
  - Prevents mismatch between canvas resolution and display size

### Internationalization (i18n)
- `translations.ts` contains nested objects: `translations[Language][key]`
- Supports **3 languages:** English (`'en'`), Chinese (`'zh'`), Japanese (`'ja'`)
- All user-facing strings use: `t = translations[lang]` then `t.keyName`
- **Gemini prompts also respect language:** `langPromptMap[lang]` provides localized instructions

### Animation Library
- Uses **anime.js** (loaded via CDN, declared as `declare var anime: any`)
- Applied to:
  - `DropZone`: scale animation on drag enter/leave
  - `MixerResult`: CMYK bar width animations, staggered delay
  - Mixing bottle simulator visual updates
- Pattern: `anime({ targets: ref, property: value, duration, easing })`

### Dark Mode
- Applied via CSS class `dark` on `document.documentElement`
- Conditional toggle in `App.tsx`: `useEffect` watches `theme` state
- All component styles should respect dark mode (check Tailwind config)

### Zoom & Pan (Canvas Interaction)
- Stored in App state: `scale` (1–max), `offset` { x, y }
- Mouse drag updates offset; wheel event updates scale
- Applied via CSS transform: `translate(offsetX, offsetY) scale(scale)`

---

## Critical Patterns to Preserve

1. **Single Selected Color Model:** Only one color drives the mixing console. Clicking a palette item sets `selectedColorId`.
2. **Lazy AI Evaluation:** `generatePaintRecipe()` only runs when color changes or language changes; result cached in state.
3. **Base Paint Toggle:** User can toggle paint selection; deselection triggers **pure CMYK mode** (no brand mix).
4. **Volume Calculation:** Mixing bottle layers based on CMYK percentages × user-set bottle volume (default 20ml).
5. **Error Handling:** AI failures return fallback strings; app remains functional without API.

---

## Integration Points

- **Gemini API:** Text-only (no vision). Receives CMYK values + RGB, returns recipe text.
- **Image Extraction:** Uses Canvas API `getImageData()` for pixel-level color sampling.
- **React 19:** Functional components + hooks; no class components or Redux.

---

## File Organization

```
├── App.tsx                    # Main orchestrator
├── types.ts                   # All TypeScript interfaces
├── components/
│   ├── DropZone.tsx          # Image upload + drag-drop UI
│   ├── ColorPalette.tsx       # Extracted color grid
│   └── MixerResult.tsx        # CMYK bars, AI recipe, bottle simulator
├── services/
│   └── geminiService.ts       # Gemini API integration
├── utils/
│   ├── colorUtils.ts          # RGB/CMYK/Hex conversions, paint matching
│   ├── mixbox.ts              # Advanced color mixing (Secret Weapons lib)
│   └── translations.ts        # i18n strings
└── .github/
    └── copilot-instructions.md   # This file
```

---

## When Adding Features

1. **New Color Space (LAB, HSL):** Add conversion functions to `colorUtils.ts`, extend `ColorData` interface.
2. **New Paint Brands:** Update paint database and `findNearestPaints()` matching logic.
3. **New UI Mode:** Add to `AppMode` enum in `types.ts`, handle in `App.tsx` state.
4. **Multi-language:** Add entries to `translations[Language]` object.
5. **AI Improvements:** Modify prompt in `generatePaintRecipe()` or adjust `gemini-2.5-flash` config.

---

## Testing & Debugging

- **Color Extraction:** Load test image, verify `ColorData[]` populated correctly in console.
- **Gemini Delays:** Check Network tab in DevTools; API latency typical 1–3s.
- **Canvas Clicking:** Ensure zoom/offset math correct; test on high-DPI displays.
- **i18n:** Switch language and verify all keys render (check console for warnings).
