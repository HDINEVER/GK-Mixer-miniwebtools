/**
 * 取件表 (Parts Checklist) 纯逻辑层
 * - 板件母池生成 / 部位模板 / 连号折叠 / 极速语法解析 / 清板评分 / 左右镜像
 * - 不依赖 React，可被 iOS bridge 或单测复用
 */
import type {
  ChecklistBadge,
  ChecklistPart,
  ChecklistRegion,
  ChecklistRegionCategory,
  ChecklistRunner,
  PaintProject,
  PartsChecklist,
  RunnerPartColorOverride,
} from '../types';

let uidCounter = 0;
export const checklistUid = (prefix = 'ck'): string =>
  `${prefix}-${Date.now().toString(36)}-${(uidCounter++).toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;

// ------------------------------------------------------------------
// 颜色
// ------------------------------------------------------------------

export const DEFAULT_RUNNER_COLOR = '#C9CED6';

/** 常用成形色（无项目油漆时也能快速给板件上色） */
export const RUNNER_COLOR_PRESETS: Array<{ name: string; hex: string }> = [
  { name: '白色成形', hex: '#ECEEF1' },
  { name: '浅灰成形', hex: '#C9CED6' },
  { name: '中灰成形', hex: '#8B9099' },
  { name: '深灰骨架', hex: '#4A4E56' },
  { name: '黑色成形', hex: '#24262B' },
  { name: '红色成形', hex: '#D7393A' },
  { name: '蓝色成形', hex: '#2C55A6' },
  { name: '黄色成形', hex: '#E8B526' },
  { name: '绿色成形', hex: '#4E7D4A' },
  { name: '透明件', hex: '#BFE2EE' },
];

const normalizeHex = (hex: string): string => {
  let h = (hex || '').trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return DEFAULT_RUNNER_COLOR;
  return `#${h.toUpperCase()}`;
};

const hexToRgbTuple = (hex: string): [number, number, number] => {
  const h = normalizeHex(hex).slice(1);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

const relLuminance = (hex: string): number => {
  const [r, g, b] = hexToRgbTuple(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** 自适应黑/白高对比文字 */
export const readableTextColor = (hex: string): string => {
  const L = relLuminance(hex);
  const contrastWhite = 1.05 / (L + 0.05);
  const contrastBlack = (L + 0.05) / 0.05;
  return contrastBlack >= contrastWhite ? '#0B0C10' : '#FFFFFF';
};

/** 与黑色混合（用于板件字母头加深） */
export const shadeHex = (hex: string, amount: number): string => {
  const [r, g, b] = hexToRgbTuple(hex);
  const k = Math.max(0, Math.min(1, 1 - amount));
  const toHex = (v: number) => Math.round(v * k).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
};

export { normalizeHex as normalizeRunnerHex };

/** 获取板件指定零件号的实际颜色（优先局部多色分色 partColors，其次板件主底色） */
export const getRunnerPartColorHex = (
  runner: ChecklistRunner | undefined,
  partNumber: number
): string => {
  const override = runner?.partColors?.[partNumber];
  if (override?.colorHex) return normalizeHex(override.colorHex);
  return normalizeHex(runner?.colorHex ?? DEFAULT_RUNNER_COLOR);
};

/** 获取板件指定零件号的实际色卡信息 */
export const getRunnerPartPaintInfo = (
  runner: ChecklistRunner | undefined,
  partNumber: number
): RunnerPartColorOverride => {
  const override = runner?.partColors?.[partNumber];
  if (override?.colorHex) {
    return {
      colorHex: normalizeHex(override.colorHex),
      paintBrand: override.paintBrand,
      paintCode: override.paintCode,
      paintName: override.paintName,
    };
  }
  return {
    colorHex: normalizeHex(runner?.colorHex ?? DEFAULT_RUNNER_COLOR),
    paintBrand: runner?.paintBrand,
    paintCode: runner?.paintCode,
    paintName: runner?.paintName,
  };
};

export interface RunnerColorBand {
  key: string;
  colorHex: string;
  paintBrand?: string;
  paintCode?: string;
  paintName?: string;
  numbers: number[];
  isBase: boolean;
}

/** 汇总单块板件上的全部颜色分组（支持万代多色成型 A 板 / 同板多油漆分色展示） */
export const getRunnerColorBands = (
  runner: ChecklistRunner | undefined
): RunnerColorBand[] => {
  if (!runner) return [];
  const baseHex = normalizeHex(runner.colorHex);
  const bands: RunnerColorBand[] = [];
  const overrideMap = new Map<string, RunnerColorBand>();
  const overriddenNums = new Set<number>();

  if (runner.partColors) {
    for (const [rawNum, ov] of Object.entries(runner.partColors)) {
      const num = Number(rawNum);
      if (!Number.isFinite(num) || num < 1 || num > runner.maxNumber || !ov?.colorHex) {
        continue;
      }
      const hex = normalizeHex(ov.colorHex);
      if (
        hex === baseHex &&
        (ov.paintCode ?? '') === (runner.paintCode ?? '') &&
        (ov.paintName ?? '') === (runner.paintName ?? '')
      ) {
        continue;
      }
      overriddenNums.add(num);
      const key = `${ov.paintBrand ?? ''}|${ov.paintCode ?? ''}|${ov.paintName ?? ''}|${hex}`;
      let band = overrideMap.get(key);
      if (!band) {
        band = {
          key,
          colorHex: hex,
          paintBrand: ov.paintBrand,
          paintCode: ov.paintCode,
          paintName: ov.paintName,
          numbers: [],
          isBase: false,
        };
        overrideMap.set(key, band);
      }
      band.numbers.push(num);
    }
  }

  const baseNums: number[] = [];
  for (let n = 1; n <= runner.maxNumber; n++) {
    if (!overriddenNums.has(n)) baseNums.push(n);
  }

  if (
    baseNums.length > 0 &&
    (runner.paintCode ||
      runner.paintName ||
      baseHex !== DEFAULT_RUNNER_COLOR ||
      overrideMap.size > 0)
  ) {
    bands.push({
      key: `base|${runner.paintBrand ?? ''}|${runner.paintCode ?? ''}|${baseHex}`,
      colorHex: baseHex,
      paintBrand: runner.paintBrand,
      paintCode: runner.paintCode,
      paintName: runner.paintName,
      numbers: baseNums,
      isBase: true,
    });
  }

  for (const band of overrideMap.values()) {
    band.numbers.sort((a, b) => a - b);
    bands.push(band);
  }

  return bands;
};

// ------------------------------------------------------------------
// 部位分类 & 模板
// ------------------------------------------------------------------

export const REGION_CATEGORY_META: Record<ChecklistRegionCategory, { label: string }> = {
  head: { label: '头部' },
  torso: { label: '躯干/胸部' },
  core: { label: '躯干/核心战机' },
  backpack: { label: '背包' },
  waist: { label: '腰部' },
  arm_common: { label: '手臂/公共部分' },
  arm_r: { label: '手臂/右手' },
  arm_l: { label: '手臂/左手' },
  shoulder: { label: '肩甲' },
  leg_common: { label: '腿部/公共部分' },
  leg_r: { label: '腿部/右腿' },
  leg_l: { label: '腿部/左腿' },
  weapon: { label: '武器' },
  shield: { label: '盾牌' },
  effect: { label: '特效件' },
  adapter: { label: '支架/配件' },
  decal: { label: '水贴/贴纸' },
  other: { label: '其他' },
};

export const REGION_CATEGORY_ORDER: ChecklistRegionCategory[] = [
  'head',
  'torso',
  'core',
  'backpack',
  'waist',
  'shoulder',
  'arm_common',
  'arm_r',
  'arm_l',
  'leg_common',
  'leg_r',
  'leg_l',
  'weapon',
  'shield',
  'effect',
  'adapter',
  'decal',
  'other',
];

/** 高达/机甲标准部位模板 */
export const MECHA_REGION_TEMPLATE: Array<{ category: ChecklistRegionCategory; title: string }> = [
  { category: 'head', title: '头部' },
  { category: 'torso', title: '躯干/胸部' },
  { category: 'core', title: '躯干/核心战机' },
  { category: 'backpack', title: '背包' },
  { category: 'waist', title: '腰部' },
  { category: 'shoulder', title: '肩甲' },
  { category: 'arm_common', title: '手臂/公共部分' },
  { category: 'arm_r', title: '手臂/右手' },
  { category: 'arm_l', title: '手臂/左手' },
  { category: 'leg_common', title: '腿部/公共部分' },
  { category: 'leg_r', title: '腿部/右腿' },
  { category: 'leg_l', title: '腿部/左腿' },
  { category: 'weapon', title: '武器/光束步枪' },
  { category: 'shield', title: '武器/盾牌' },
  { category: 'adapter', title: '支架/配件' },
];

/** 左右镜像对 */
export const MIRROR_PAIRS: Partial<Record<ChecklistRegionCategory, ChecklistRegionCategory>> = {
  arm_r: 'arm_l',
  arm_l: 'arm_r',
  leg_r: 'leg_l',
  leg_l: 'leg_r',
};

export const createRegion = (category: ChecklistRegionCategory, title?: string): ChecklistRegion => ({
  id: checklistUid('rg'),
  category,
  title: title?.trim() || REGION_CATEGORY_META[category].label,
  parts: [],
});

export const createEmptyChecklist = (modelTitle?: string): PartsChecklist => ({
  version: 1,
  modelTitle,
  mergeConsecutive: true,
  runners: [],
  regions: [],
  updatedAt: Date.now(),
});

// ------------------------------------------------------------------
// 板件母池
// ------------------------------------------------------------------

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** A~N → ["A","B",...,"N"] */
export const letterRange = (from: string, to: string): string[] => {
  const a = ALPHABET.indexOf(from.trim().toUpperCase());
  const b = ALPHABET.indexOf(to.trim().toUpperCase());
  if (a < 0 || b < 0) return [];
  const [lo, hi] = a <= b ? [a, b] : [b, a];
  return ALPHABET.slice(lo, hi + 1).split('');
};

export const clampMaxNumber = (n: number): number =>
  Math.max(1, Math.min(200, Math.round(Number.isFinite(n) ? n : 1)));

export const createRunner = (id: string, maxNumber: number, colorHex = DEFAULT_RUNNER_COLOR): ChecklistRunner => ({
  id: id.trim().toUpperCase(),
  maxNumber: clampMaxNumber(maxNumber),
  colorHex: normalizeHex(colorHex),
});

/** 批量生成板件（已存在的字母保留原设置） */
export const generateRunners = (
  existing: ChecklistRunner[],
  from: string,
  to: string,
  maxNumber: number
): ChecklistRunner[] => {
  const letters = letterRange(from, to);
  const have = new Set(existing.map((r) => r.id));
  const added = letters.filter((l) => !have.has(l)).map((l) => createRunner(l, maxNumber));
  return sortRunners([...existing, ...added]);
};

/**
 * 板件自然排序：A → A1 → A2 → B → B1 … (单字母前缀优先)，其余（PC / SB1 / Iron Chain）排在后面
 */
const RUNNER_ID_RE = /^([A-Z]+)(\d*)$/;

export const sortRunners = (runners: ChecklistRunner[]): ChecklistRunner[] =>
  [...runners].sort((a, b) => {
    const ma = a.id.match(RUNNER_ID_RE);
    const mb = b.id.match(RUNNER_ID_RE);
    const rank = (m: RegExpMatchArray | null) => (!m ? 2 : m[1].length === 1 ? 0 : 1);
    const ra = rank(ma);
    const rb = rank(mb);
    if (ra !== rb) return ra - rb;
    if (ma && mb) {
      if (ma[1] !== mb[1]) return ma[1].localeCompare(mb[1], 'en');
      const na = ma[2] ? Number(ma[2]) : 0;
      const nb = mb[2] ? Number(mb[2]) : 0;
      return na - nb;
    }
    return a.id.localeCompare(b.id, 'en', { numeric: true });
  });

export const partKey = (runnerId: string, number: number): string => `${runnerId}:${number}`;

export const parsePartKey = (key: string): { runnerId: string; number: number } => {
  const idx = key.lastIndexOf(':');
  return { runnerId: key.slice(0, idx), number: Number(key.slice(idx + 1)) };
};

// ------------------------------------------------------------------
// 角标
// ------------------------------------------------------------------

export const BADGE_CYCLE: Array<ChecklistBadge | undefined> = [undefined, '*2', '*4', 'x2', '▲'];

export const BADGE_META: Record<ChecklistBadge, { label: string; hint: string }> = {
  '*2': { label: '*2', hint: '对称件 ×2' },
  '*4': { label: '*4', hint: '同号 ×4' },
  x2: { label: 'x2', hint: '两件' },
  '▲': { label: '▲', hint: '隐藏水口 / 预涂装件' },
};

export const nextBadge = (badge?: ChecklistBadge, dir: 1 | -1 = 1): ChecklistBadge | undefined => {
  const idx = BADGE_CYCLE.indexOf(badge);
  return BADGE_CYCLE[(idx + dir + BADGE_CYCLE.length) % BADGE_CYCLE.length];
};

export const badgeMultiplier = (badge?: ChecklistBadge): number => {
  if (badge === '*2' || badge === 'x2') return 2;
  if (badge === '*4') return 4;
  return 1;
};

const normalizeQty = (qty?: number): number | undefined =>
  qty != null && Number.isFinite(qty) && qty > 1 ? Math.min(999, Math.round(qty)) : undefined;

/** 单个零件号实际件数：角标优先，其次导入数量 qty，默认 1 */
export const partQuantity = (p: { badge?: ChecklistBadge; qty?: number }): number =>
  p.badge ? badgeMultiplier(p.badge) : normalizeQty(p.qty) ?? 1;

/** 渲染用角标文本：*2 / x2 / ▲ / ×8 */
export const segmentBadgeLabel = (s: { badge?: ChecklistBadge; qty?: number }): string | undefined => {
  if (s.badge) return s.badge;
  const q = normalizeQty(s.qty);
  return q ? `×${q}` : undefined;
};

/** 数量 → 角标/qty（2 → x2，4 → *4，其余 >1 写入 qty） */
export const quantityToBadge = (quantity: number): { badge?: ChecklistBadge; qty?: number } => {
  const q = Math.round(Number(quantity) || 1);
  if (q <= 1) return {};
  if (q === 2) return { badge: 'x2' };
  if (q === 4) return { badge: '*4' };
  return { qty: normalizeQty(q) };
};

// ------------------------------------------------------------------
// 部位零件：增删 / 排序 / 连号折叠
// ------------------------------------------------------------------

export interface PartInput {
  runnerId: string;
  number: number;
  badge?: ChecklistBadge;
  qty?: number;
}

const runnerOrderMap = (runners: ChecklistRunner[]) => {
  const m = new Map<string, number>();
  runners.forEach((r, i) => m.set(r.id, i));
  return m;
};

export const sortParts = (parts: ChecklistPart[], runners: ChecklistRunner[]): ChecklistPart[] => {
  const order = runnerOrderMap(runners);
  return [...parts].sort((a, b) => {
    const ra = order.get(a.runnerId) ?? 999;
    const rb = order.get(b.runnerId) ?? 999;
    if (ra !== rb) return ra - rb;
    if (a.runnerId !== b.runnerId) return a.runnerId.localeCompare(b.runnerId);
    return a.number - b.number;
  });
};

/** 追加零件（同部位同板件同号去重；带角标的输入会覆盖原角标） */
export const addPartsToRegion = (
  region: ChecklistRegion,
  inputs: PartInput[],
  runners: ChecklistRunner[]
): { region: ChecklistRegion; added: number } => {
  const byKey = new Map(region.parts.map((p) => [partKey(p.runnerId, p.number), p]));
  let added = 0;
  for (const input of inputs) {
    const key = partKey(input.runnerId, input.number);
    const existing = byKey.get(key);
    if (existing) {
      const qty = normalizeQty(input.qty);
      if ((input.badge && existing.badge !== input.badge) || (qty && existing.qty !== qty)) {
        byKey.set(key, {
          ...existing,
          ...(input.badge ? { badge: input.badge } : {}),
          ...(qty ? { qty } : {}),
        });
      }
      continue;
    }
    byKey.set(key, {
      id: checklistUid('pt'),
      runnerId: input.runnerId,
      number: input.number,
      badge: input.badge,
      ...(normalizeQty(input.qty) ? { qty: normalizeQty(input.qty) } : {}),
    });
    added++;
  }
  return { region: { ...region, parts: sortParts([...byKey.values()], runners) }, added };
};

export interface PartSegment {
  key: string;
  runnerId: string;
  start: number;
  end: number;
  badge?: ChecklistBadge;
  qty?: number;
  isCut: boolean;
  partIds: string[];
  /** 该号段对应的颜色（支持多色成型板件内不同号段显示不同颜色） */
  colorHex?: string;
  paintBrand?: string;
  paintCode?: string;
  paintName?: string;
}

export interface RunnerGroup {
  runnerId: string;
  segments: PartSegment[];
}

/** 按板件归组，连续号（同角标、同剪件状态、同分色）折叠为 22-24 */
export const groupRegionParts = (
  parts: ChecklistPart[],
  runners: ChecklistRunner[],
  merge: boolean
): RunnerGroup[] => {
  const sorted = sortParts(parts, runners);
  const runnerMap = new Map(runners.map((r) => [r.id, r]));
  const groups: RunnerGroup[] = [];
  for (const p of sorted) {
    let group = groups[groups.length - 1];
    if (!group || group.runnerId !== p.runnerId) {
      group = { runnerId: p.runnerId, segments: [] };
      groups.push(group);
    }
    const runner = runnerMap.get(p.runnerId);
    const paintInfo = getRunnerPartPaintInfo(runner, p.number);
    const last = group.segments[group.segments.length - 1];
    const isCut = Boolean(p.isCut);
    const qty = p.badge ? undefined : normalizeQty(p.qty);
    if (
      merge &&
      last &&
      last.end + 1 === p.number &&
      last.badge === p.badge &&
      last.qty === qty &&
      last.isCut === isCut &&
      (last.colorHex ?? paintInfo.colorHex) === paintInfo.colorHex &&
      (last.paintCode ?? '') === (paintInfo.paintCode ?? '')
    ) {
      last.end = p.number;
      last.partIds.push(p.id);
      last.key = `${last.runnerId}-${last.start}-${last.end}`;
    } else {
      group.segments.push({
        key: `${p.runnerId}-${p.number}-${p.number}`,
        runnerId: p.runnerId,
        start: p.number,
        end: p.number,
        badge: p.badge,
        qty,
        isCut,
        partIds: [p.id],
        colorHex: paintInfo.colorHex,
        paintBrand: paintInfo.paintBrand,
        paintCode: paintInfo.paintCode,
        paintName: paintInfo.paintName,
      });
    }
  }
  return groups;
};

export const formatSegment = (seg: Pick<PartSegment, 'start' | 'end'>): string =>
  seg.start === seg.end ? String(seg.start) : `${seg.start}-${seg.end}`;

export const regionPartCount = (region: ChecklistRegion): number =>
  region.parts.reduce((sum, p) => sum + partQuantity(p), 0);

export const regionCutCount = (region: ChecklistRegion): number =>
  region.parts.reduce((sum, p) => sum + (p.isCut ? partQuantity(p) : 0), 0);

// ------------------------------------------------------------------
// 极速语法：A5,9,26 H6,10 K4-5*2 · 带数字板件用冒号：A1:7,10-16x2 SB1:3×8
// ------------------------------------------------------------------

const ITEM_RE = /^(\d{1,3})(?:\s*[-~～—–]\s*(\d{1,3}))?\s*(\*\s*\d{1,3}|[xX×]\s*\d{1,3}|▲|\^)?$/;

const normalizeBadgeToken = (raw?: string): { badge?: ChecklistBadge; qty?: number } => {
  if (!raw) return {};
  const s = raw.replace(/\s+/g, '');
  if (s === '▲' || s === '^') return { badge: '▲' };
  const star = s.match(/^\*(\d+)$/);
  if (star) {
    const n = Number(star[1]);
    if (n === 2) return { badge: '*2' };
    if (n === 4) return { badge: '*4' };
    return { qty: normalizeQty(n) };
  }
  const times = s.match(/^[xX×](\d+)$/);
  if (times) {
    const n = Number(times[1]);
    if (n === 2) return { badge: 'x2' };
    return { qty: normalizeQty(n) };
  }
  return {};
};

export interface QuickSyntaxResult {
  items: PartInput[];
  errors: string[];
}

export const parseQuickSyntax = (text: string): QuickSyntaxResult => {
  const items: PartInput[] = [];
  const errors: string[] = [];
  const tokens = text
    .replace(/[，、；;]/g, ',')
    .replace(/：/g, ':')
    .replace(/\s*:\s*/g, ':')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
  let currentRunner: string | null = null;

  for (const token of tokens) {
    // 带数字后缀的板件（A1 / SB1）必须使用冒号：A1:7,10
    const colon = token.match(/^([A-Za-z]+\d*):(.*)$/);
    const m = colon ?? token.match(/^([A-Za-z]+)(.*)$/);
    let body = token;
    if (m) {
      currentRunner = m[1].toUpperCase();
      body = m[2];
    }
    if (!currentRunner) {
      errors.push(`「${token}」缺少板件字母`);
      continue;
    }
    for (const rawItem of body.split(',')) {
      const item = rawItem.trim();
      if (!item) continue;
      const im = item.match(ITEM_RE);
      if (!im) {
        errors.push(`无法识别「${currentRunner}${item}」`);
        continue;
      }
      const a = Number(im[1]);
      const b = im[2] ? Number(im[2]) : a;
      const { badge, qty } = normalizeBadgeToken(im[3]);
      const [lo, hi] = a <= b ? [a, b] : [b, a];
      if (lo < 1 || hi - lo > 200) {
        errors.push(`号段「${currentRunner}${item}」超出范围`);
        continue;
      }
      for (let n = lo; n <= hi; n++) {
        items.push({ runnerId: currentRunner, number: n, badge, ...(qty ? { qty } : {}) });
      }
    }
  }
  return { items, errors };
};

/** 语法 / 拖入的号码若引用了不存在的板件或超出最大号，自动扩展板件池 */
export const ensureRunnersFor = (runners: ChecklistRunner[], inputs: PartInput[]): ChecklistRunner[] => {
  const map = new Map(runners.map((r) => [r.id, r]));
  let changed = false;
  for (const input of inputs) {
    const r = map.get(input.runnerId);
    if (!r) {
      map.set(input.runnerId, createRunner(input.runnerId, Math.max(10, input.number)));
      changed = true;
    } else if (input.number > r.maxNumber) {
      map.set(input.runnerId, { ...r, maxNumber: clampMaxNumber(input.number) });
      changed = true;
    }
  }
  return changed ? sortRunners([...map.values()]) : runners;
};

/** 部位 → 可回填到输入框的文本（带数字后缀的板件自动使用冒号） */
export const regionToSyntax = (region: ChecklistRegion, runners: ChecklistRunner[]): string =>
  groupRegionParts(region.parts, runners, true)
    .map(
      (g) =>
        (/\d$/.test(g.runnerId) ? `${g.runnerId}:` : g.runnerId) +
        g.segments
          .map((s) => `${formatSegment(s)}${s.badge ?? (s.qty ? `x${s.qty}` : '')}`)
          .join(',')
    )
    .join(' ');

// ------------------------------------------------------------------
// 镜像克隆
// ------------------------------------------------------------------

export const mirrorTitle = (title: string): string =>
  title.replace(/[左右]/g, (c) => (c === '左' ? '右' : '左'));

/**
 * 把 sourceId 部位整组零件复制到对侧（不存在则自动在其后创建）
 * 返回新的 regions 与目标部位 id
 */
export const mirrorRegion = (
  regions: ChecklistRegion[],
  sourceId: string
): { regions: ChecklistRegion[]; targetId: string | null; replaced: boolean } => {
  const srcIdx = regions.findIndex((r) => r.id === sourceId);
  if (srcIdx < 0) return { regions, targetId: null, replaced: false };
  const src = regions[srcIdx];
  const targetCat = MIRROR_PAIRS[src.category];
  if (!targetCat) return { regions, targetId: null, replaced: false };

  const clonedParts = src.parts.map((p) => ({ ...p, id: checklistUid('pt'), isCut: false }));
  const tgtIdx = regions.findIndex((r) => r.category === targetCat);
  if (tgtIdx >= 0) {
    const next = [...regions];
    const replaced = next[tgtIdx].parts.length > 0;
    next[tgtIdx] = { ...next[tgtIdx], parts: clonedParts };
    return { regions: next, targetId: next[tgtIdx].id, replaced };
  }
  const created: ChecklistRegion = {
    ...createRegion(targetCat, mirrorTitle(src.title)),
    parts: clonedParts,
  };
  const next = [...regions];
  next.splice(srcIdx + 1, 0, created);
  return { regions: next, targetId: created.id, replaced: false };
};

// ------------------------------------------------------------------
// 统计 & 清板评分
// ------------------------------------------------------------------

export type CleanGrade = 'S' | 'A' | 'B' | 'C' | 'D';

export const GRADE_META: Record<CleanGrade, { color: string; label: string }> = {
  S: { color: '#2DD4BF', label: '极易清板' },
  A: { color: '#22C55E', label: '易清板' },
  B: { color: '#A3E635', label: '中等' },
  C: { color: '#F59E0B', label: '较分散' },
  D: { color: '#EF4444', label: '难清板' },
};

export interface ChecklistStats {
  partsCount: number; // 零件总数（含 *2 / x2 / *4 倍数）
  uniqueNumbers: number; // 去重后的零件号数量
  runnersCount: number;
  regionsCount: number; // 非空部位数
  cutCount: number;
  avgSpread: number; // 平均每个部位横跨的板件数
  cleanScore: number | null;
  grade: CleanGrade | null;
  /** runnerId → number → 使用该号的部位标题 */
  usage: Map<string, Map<number, string[]>>;
  /** runnerId → 已被分配的去重号码数 */
  usedPerRunner: Map<string, number>;
}

export const scoreToGrade = (score: number): CleanGrade =>
  score >= 90 ? 'S' : score >= 75 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D';

export const computeChecklistStats = (checklist: PartsChecklist): ChecklistStats => {
  const usage = new Map<string, Map<number, string[]>>();
  let partsCount = 0;
  let cutCount = 0;
  let spreadSum = 0;
  let filledRegions = 0;

  for (const region of checklist.regions) {
    if (region.parts.length === 0) continue;
    filledRegions++;
    const runnerSet = new Set<string>();
    for (const p of region.parts) {
      const mult = partQuantity(p);
      partsCount += mult;
      if (p.isCut) cutCount += mult;
      runnerSet.add(p.runnerId);
      let byNum = usage.get(p.runnerId);
      if (!byNum) {
        byNum = new Map();
        usage.set(p.runnerId, byNum);
      }
      const titles = byNum.get(p.number) ?? [];
      titles.push(region.title);
      byNum.set(p.number, titles);
    }
    spreadSum += runnerSet.size;
  }

  const usedPerRunner = new Map<string, number>();
  let uniqueNumbers = 0;
  usage.forEach((byNum, runnerId) => {
    usedPerRunner.set(runnerId, byNum.size);
    uniqueNumbers += byNum.size;
  });

  const avgSpread = filledRegions ? spreadSum / filledRegions : 0;
  // 每部位只需 1 块板件 = 100 分；平均横跨 5.5 块 ≈ 20 分（D 级难清板）
  const cleanScore = filledRegions ? Math.round(100 * Math.exp(-(avgSpread - 1) / 2.8)) : null;

  return {
    partsCount,
    uniqueNumbers,
    runnersCount: checklist.runners.length,
    regionsCount: filledRegions,
    cutCount,
    avgSpread,
    cleanScore,
    grade: cleanScore == null ? null : scoreToGrade(cleanScore),
    usage,
    usedPerRunner,
  };
};

// ------------------------------------------------------------------
// 项目色卡汇总（用于板件一键绑定颜色）
// ------------------------------------------------------------------

export interface ProjectPaintSwatch {
  key: string;
  hex: string;
  brand: string;
  code: string;
  name: string;
}

export const collectProjectPaints = (project: PaintProject): ProjectPaintSwatch[] => {
  const seen = new Map<string, ProjectPaintSwatch>();
  for (const part of project.parts) {
    for (const node of part.nodes) {
      const hex = normalizeHex(node.hex);
      const key = `${node.paintBrand}|${node.paintCode}|${hex}`;
      if (!seen.has(key)) {
        seen.set(key, {
          key,
          hex,
          brand: node.paintBrand,
          code: node.paintCode,
          name: node.paintName,
        });
      }
    }
  }
  return [...seen.values()];
};

// ------------------------------------------------------------------
// 按板件取件（Runner-first 倒排视图）
// 数据源仍是「部位 → 零件」，这里实时倒排为「板件 → 部位 → 零件」，
// 两种视图共享同一份 isCut 状态，不存在双份维护。
// ------------------------------------------------------------------

/** 22,23,24,30 → "22-24, 30" */
export const compressNumbers = (nums: number[]): string => {
  if (nums.length === 0) return '';
  const sorted = [...new Set(nums)].sort((a, b) => a - b);
  const out: string[] = [];
  let start = sorted[0];
  let end = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    const n = sorted[i];
    if (n === end + 1) {
      end = n;
      continue;
    }
    out.push(start === end ? String(start) : `${start}-${end}`);
    start = n;
    end = n;
  }
  return out.join(', ');
};

export interface PartRef {
  regionId: string;
  partId: string;
}

export interface RunnerRegionRow {
  regionId: string;
  regionTitle: string;
  category: ChecklistRegionCategory;
  segments: PartSegment[];
  partCount: number;
  cutCount: number;
}

export interface RunnerNumberState {
  number: number;
  refs: PartRef[];
  regionTitles: string[];
  total: number; // 该号码需要的件数（含倍数，跨部位累加）
  cut: number;
}

export interface RunnerPickCard {
  runnerId: string;
  runner?: ChecklistRunner;
  rows: RunnerRegionRow[];
  partCount: number;
  cutCount: number;
  /** 号码 → 使用情况（仅包含被部位引用的号码） */
  numbers: Map<number, RunnerNumberState>;
  /** 号码图显示范围：max(板件最大号, 实际最大引用号) */
  maxNumber: number;
  /** 1..maxNumber 中未被任何部位引用的号（可留在板上 / 废件 / 备用） */
  unusedNumbers: number[];
  isCleared: boolean;
  progress: number; // 0..1
}

export interface RunnerPickSummary {
  cards: RunnerPickCard[];
  usedRunners: number;
  clearedRunners: number;
  /** 定义了但没有任何部位引用的板件 */
  idleRunnerIds: string[];
}

export const pivotByRunner = (checklist: PartsChecklist): RunnerPickSummary => {
  const runnerMap = new Map(checklist.runners.map((r) => [r.id, r]));
  const byRunner = new Map<string, Map<string, ChecklistPart[]>>(); // runnerId → regionId → parts
  const regionById = new Map(checklist.regions.map((r) => [r.id, r]));

  for (const region of checklist.regions) {
    for (const p of region.parts) {
      let regionsOfRunner = byRunner.get(p.runnerId);
      if (!regionsOfRunner) {
        regionsOfRunner = new Map();
        byRunner.set(p.runnerId, regionsOfRunner);
      }
      const list = regionsOfRunner.get(region.id) ?? [];
      list.push(p);
      regionsOfRunner.set(region.id, list);
    }
  }

  // 板件顺序：已定义板件的排序 + 未定义但被引用的板件（自然排序）
  const orphanIds = [...byRunner.keys()].filter((id) => !runnerMap.has(id));
  const orphanSorted = sortRunners(orphanIds.map((id) => createRunner(id, 1))).map((r) => r.id);
  const orderedIds = [...checklist.runners.map((r) => r.id), ...orphanSorted];

  const cards: RunnerPickCard[] = [];
  const idleRunnerIds: string[] = [];

  for (const runnerId of orderedIds) {
    const regionsOfRunner = byRunner.get(runnerId);
    if (!regionsOfRunner || regionsOfRunner.size === 0) {
      idleRunnerIds.push(runnerId);
      continue;
    }
    const runner = runnerMap.get(runnerId);
    const rows: RunnerRegionRow[] = [];
    const numbers = new Map<number, RunnerNumberState>();
    let partCount = 0;
    let cutCount = 0;

    // 行顺序与部位列表保持一致
    for (const region of checklist.regions) {
      const parts = regionsOfRunner.get(region.id);
      if (!parts || parts.length === 0) continue;
      const group = groupRegionParts(parts, checklist.runners, checklist.mergeConsecutive)[0];
      let rowTotal = 0;
      let rowCut = 0;
      for (const p of parts) {
        const q = partQuantity(p);
        rowTotal += q;
        if (p.isCut) rowCut += q;
        const st = numbers.get(p.number) ?? {
          number: p.number,
          refs: [],
          regionTitles: [],
          total: 0,
          cut: 0,
        };
        st.refs.push({ regionId: region.id, partId: p.id });
        if (!st.regionTitles.includes(region.title)) st.regionTitles.push(region.title);
        st.total += q;
        if (p.isCut) st.cut += q;
        numbers.set(p.number, st);
      }
      partCount += rowTotal;
      cutCount += rowCut;
      rows.push({
        regionId: region.id,
        regionTitle: regionById.get(region.id)?.title ?? region.title,
        category: region.category,
        segments: group?.segments ?? [],
        partCount: rowTotal,
        cutCount: rowCut,
      });
    }

    const highestUsed = Math.max(0, ...numbers.keys());
    const maxNumber = Math.max(runner?.maxNumber ?? 0, highestUsed);
    const unusedNumbers: number[] = [];
    for (let n = 1; n <= maxNumber; n++) if (!numbers.has(n)) unusedNumbers.push(n);

    cards.push({
      runnerId,
      runner,
      rows,
      partCount,
      cutCount,
      numbers,
      maxNumber,
      unusedNumbers,
      isCleared: partCount > 0 && cutCount >= partCount,
      progress: partCount ? cutCount / partCount : 0,
    });
  }

  return {
    cards,
    usedRunners: cards.length,
    clearedRunners: cards.filter((c) => c.isCleared).length,
    idleRunnerIds,
  };
};

/** 批量设置零件剪件状态（按 regionId + partId 精确定位） */
export const setPartsCut = (
  regions: ChecklistRegion[],
  refs: PartRef[],
  nextCut: boolean
): ChecklistRegion[] => {
  if (refs.length === 0) return regions;
  const byRegion = new Map<string, Set<string>>();
  for (const ref of refs) {
    const set = byRegion.get(ref.regionId) ?? new Set<string>();
    set.add(ref.partId);
    byRegion.set(ref.regionId, set);
  }
  return regions.map((r) => {
    const ids = byRegion.get(r.id);
    if (!ids) return r;
    return { ...r, parts: r.parts.map((p) => (ids.has(p.id) ? { ...p, isCut: nextCut } : p)) };
  });
};

/** 整板（或板上指定号码）一键剪完 / 撤销 —— 跨所有部位同步 */
export const setRunnerCut = (
  regions: ChecklistRegion[],
  runnerId: string,
  nextCut: boolean,
  numbers?: number[]
): ChecklistRegion[] => {
  const numSet = numbers ? new Set(numbers) : null;
  return regions.map((r) => {
    if (!r.parts.some((p) => p.runnerId === runnerId)) return r;
    return {
      ...r,
      parts: r.parts.map((p) =>
        p.runnerId === runnerId && (!numSet || numSet.has(p.number)) ? { ...p, isCut: nextCut } : p
      ),
    };
  });
};
