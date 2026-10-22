import {
  CatalogPaint,
  ColorData,
  FloatingSwatchNode,
  PaintProject,
  PaletteCategory,
  PartCanvas,
  SavedColor,
} from '../types';
import { hexToRgb, rgbToCmyk, rgbToHsb, rgbToLab } from './colorUtils';
import { inferStepsFromNodes } from './projectSharing';

const DB_NAME = 'gk_mixer_studio_db_v2';
const DB_VERSION = 1;
const STORE_PROJECTS = 'projects';
const STORE_CATEGORIES = 'categories';
const STORE_COLORS = 'saved_colors';

const DEFAULT_CATEGORIES: PaletteCategory[] = [
  { id: 'cat-mecha', name: '机甲/高达', createdAt: 1710000001000 },
  { id: 'cat-figure', name: 'GK手办/美少女', createdAt: 1710000002000 },
  { id: 'cat-armor', name: '军模/科幻旧化', createdAt: 1710000003000 },
];

const DEFAULT_SAVED_COLORS: SavedColor[] = [
  { id: 'sc-1', hex: '#E13D3A', name: '盖亚 003 亮红', brand: 'Gaia', code: '003', categoryId: 'cat-mecha', createdAt: 1710000001000 },
  { id: 'sc-2', hex: '#284B8C', name: '盖亚 004 亮蓝', brand: 'Gaia', code: '004', categoryId: 'cat-mecha', createdAt: 1710000002000 },
  { id: 'sc-3', hex: '#F3C73E', name: '盖亚 025 橙黄', brand: 'Gaia', code: '025', categoryId: 'cat-mecha', createdAt: 1710000003000 },
  { id: 'sc-4', hex: '#F7DFD4', name: '盖亚 051 基础肤色', brand: 'Gaia', code: '051', categoryId: 'cat-figure', createdAt: 1710000004000 },
];

function createDemoCoverDataUrl(): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const grad = ctx.createLinearGradient(0, 0, 640, 480);
  grad.addColorStop(0, '#0F172A');
  grad.addColorStop(0.5, '#1E293B');
  grad.addColorStop(1, '#334155');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 640, 480);

  // Armor plates illustration
  ctx.fillStyle = '#F8FAFC';
  ctx.beginPath();
  ctx.roundRect(90, 80, 210, 310, 24);
  ctx.fill();

  ctx.fillStyle = '#284B8C';
  ctx.beginPath();
  ctx.roundRect(330, 80, 220, 145, 22);
  ctx.fill();

  ctx.fillStyle = '#E13D3A';
  ctx.beginPath();
  ctx.roundRect(330, 245, 105, 145, 20);
  ctx.fill();

  ctx.fillStyle = '#F3C73E';
  ctx.beginPath();
  ctx.roundRect(450, 245, 100, 145, 20);
  ctx.fill();

  return canvas.toDataURL('image/jpeg', 0.88);
}

export function getSeedProjects(): PaintProject[] {
  const demoImg = createDemoCoverDataUrl();
  const nodes: FloatingSwatchNode[] = [
    {
      id: 'demo-node-1',
      anchorX: 0.3,
      anchorY: 0.45,
      offsetX: 0.04,
      offsetY: 0.14,
      paintBrand: 'Gaia',
      paintCode: '071',
      paintName: '中性灰 I',
      hex: '#ECEFF4',
    },
    {
      id: 'demo-node-2',
      anchorX: 0.68,
      anchorY: 0.31,
      offsetX: 0.62,
      offsetY: 0.08,
      paintBrand: 'Gaia',
      paintCode: '004',
      paintName: '亮光蓝',
      hex: '#284B8C',
    },
    {
      id: 'demo-node-3',
      anchorX: 0.6,
      anchorY: 0.68,
      offsetX: 0.62,
      offsetY: 0.68,
      paintBrand: 'Gaia',
      paintCode: '003',
      paintName: '亮光红',
      hex: '#E13D3A',
    },
  ];
  const part1: PartCanvas = {
    id: 'demo-part-1',
    partName: '外甲主配色 (胸甲/肩甲)',
    sourceImageDataUrl: demoImg,
    nodes,
    steps: inferStepsFromNodes(nodes),
    createdAt: 1710000010000,
  };
  return [
    {
      id: 'demo-proj-1',
      title: 'RX-93 ν高达 Ver.Ka 外甲分色示范',
      coverImageDataUrl: demoImg,
      createdAt: 1710000010000,
      updatedAt: 1710000010000,
      categoryId: 'cat-mecha',
      parts: [part1],
    },
  ];
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_CATEGORIES)) {
        db.createObjectStore(STORE_CATEGORIES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_COLORS)) {
        db.createObjectStore(STORE_COLORS, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readStoreAll<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as T[]) || []);
    req.onerror = () => reject(req.error);
  });
}

async function writeStoreAll<T extends { id: string }>(storeName: string, items: T[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.clear();
    for (const item of items) {
      store.put(item);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadStudioData(): Promise<{
  projects: PaintProject[];
  categories: PaletteCategory[];
  savedColors: SavedColor[];
}> {
  try {
    let [projects, categories, savedColors] = await Promise.all([
      readStoreAll<PaintProject>(STORE_PROJECTS),
      readStoreAll<PaletteCategory>(STORE_CATEGORIES),
      readStoreAll<SavedColor>(STORE_COLORS),
    ]);

    const seededFlag = localStorage.getItem('gkmixer_v2_seeded');
    if (!seededFlag && projects.length === 0 && categories.length === 0) {
      projects = getSeedProjects();
      categories = DEFAULT_CATEGORIES;
      savedColors = DEFAULT_SAVED_COLORS;
      await Promise.all([
        writeStoreAll(STORE_PROJECTS, projects),
        writeStoreAll(STORE_CATEGORIES, categories),
        writeStoreAll(STORE_COLORS, savedColors),
      ]);
      localStorage.setItem('gkmixer_v2_seeded', '1');
    }

    projects.sort((a, b) => b.updatedAt - a.updatedAt);
    categories.sort((a, b) => a.createdAt - b.createdAt);
    savedColors.sort((a, b) => b.createdAt - a.createdAt);

    return { projects, categories, savedColors };
  } catch (err) {
    console.warn('IndexedDB fallback to memory/localStorage:', err);
    return {
      projects: getSeedProjects(),
      categories: DEFAULT_CATEGORIES,
      savedColors: DEFAULT_SAVED_COLORS,
    };
  }
}

export async function saveProjectsToDB(projects: PaintProject[]): Promise<void> {
  try {
    await writeStoreAll(STORE_PROJECTS, projects);
  } catch (err) {
    console.warn('Failed to save projects to IndexedDB:', err);
  }
}

export async function saveCategoriesToDB(categories: PaletteCategory[]): Promise<void> {
  try {
    await writeStoreAll(STORE_CATEGORIES, categories);
  } catch (err) {
    console.warn('Failed to save categories to IndexedDB:', err);
  }
}

export async function saveColorsToDB(colors: SavedColor[]): Promise<void> {
  try {
    await writeStoreAll(STORE_COLORS, colors);
  } catch (err) {
    console.warn('Failed to save colors to IndexedDB:', err);
  }
}

// ==========================================
// Conversion between Tab 1 ColorData[] and Tab 3 FloatingSwatchNode[]
// ==========================================

export function colorsToFloatingNodes(colors: ColorData[]): FloatingSwatchNode[] {
  return colors
    .filter(
      (c): c is ColorData & { sampleX: number; sampleY: number; assignedPaint: CatalogPaint } =>
        Number.isFinite(c.sampleX) && Number.isFinite(c.sampleY) && !!c.assignedPaint
    )
    .map((c) => {
      const p = c.assignedPaint;
      const defaultLeft = c.sampleX > 0.55 ? Math.max(0.02, c.sampleX - 0.24) : Math.min(0.75, c.sampleX + 0.04);
      const defaultTop = Math.min(0.86, Math.max(0.02, c.sampleY - 0.05));
      return {
        id: c.id,
        anchorX: c.sampleX,
        anchorY: c.sampleY,
        offsetX: typeof c.labelNx === 'number' ? c.labelNx : defaultLeft,
        offsetY: typeof c.labelNy === 'number' ? c.labelNy : defaultTop,
        paintBrand: p.brand,
        paintCode: p.code,
        paintName: p.name,
        hex: (p.hex || c.hex).toUpperCase(),
        tonalGradient: c.tonalGradient,
        labelScale: c.labelScale,
      };
    });
}

export function floatingNodesToColors(
  nodes: FloatingSwatchNode[],
  catalogPaints: CatalogPaint[]
): ColorData[] {
  return nodes.map((node, index) => {
    const rgb = hexToRgb(node.hex);
    const matchedCatalog =
      catalogPaints.find(
        (p) =>
          p.brand.toLowerCase() === node.paintBrand.toLowerCase() &&
          p.code.toLowerCase() === node.paintCode.toLowerCase()
      ) ||
      ({
        id: `${node.paintBrand}-${node.paintCode}`,
        brand: node.paintBrand,
        code: node.paintCode,
        name: node.paintName,
        hex: node.hex,
        lab: [],
        set: '',
        finish: 'standard',
      } as CatalogPaint);

    return {
      id: node.id || `node-color-${index}`,
      hex: node.hex.toUpperCase(),
      rgb,
      cmyk: rgbToCmyk(rgb.r, rgb.g, rgb.b),
      hsb: rgbToHsb(rgb.r, rgb.g, rgb.b),
      lab: rgbToLab(rgb.r, rgb.g, rgb.b),
      source: 'manual',
      name: `${node.paintBrand} ${node.paintCode} ${node.paintName}`.trim(),
      sampleX: node.anchorX,
      sampleY: node.anchorY,
      labelNx: node.offsetX,
      labelNy: node.offsetY,
      labelScale: node.labelScale,
      assignedPaint: matchedCatalog,
      tonalGradient: node.tonalGradient,
    };
  });
}
