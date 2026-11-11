/**
 * 达米兹（dammiz.cn）取件方案 → GK-Mixer 取件表 导入器
 *
 * 流程：分享链接 / 方案编号 → 提取 schemeId → 拉取公开方案文本数据 → 部位分类映射 → 生成 runners + regions
 * 只导入「部位名 + 板件号 + 零件号 + 数量」文本，不引入任何板件实拍图。
 */
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import type {
  ChecklistImportSource,
  ChecklistRegion,
  ChecklistRegionCategory,
  ChecklistRunner,
  PartsChecklist,
} from '../types';
import {
  addPartsToRegion,
  clampMaxNumber,
  createRegion,
  createRunner,
  PartInput,
  partQuantity,
  quantityToBadge,
  sortRunners,
} from './partsChecklist';

export const DAMMIZ_ORIGIN = 'https://www.dammiz.cn';

// ------------------------------------------------------------------
// 链接解析
// ------------------------------------------------------------------

/**
 * 支持：
 * - https://www.dammiz.cn/picking/schemes/917
 * - https://www.dammiz.cn/picking/schemes/917?returnTo=/picking
 * - 含分享文案的整段文本（自动抓取其中的链接）
 * - 纯数字方案号 917 / #917
 */
export const parseDammizSchemeId = (input: string): number | null => {
  const text = (input || '').trim();
  if (!text) return null;
  const fromUrl = text.match(/dammiz\.cn\/(?:[\w-]+\/)*schemes\/(\d{1,8})/i);
  if (fromUrl) return Number(fromUrl[1]);
  const fromPath = text.match(/\/schemes\/(\d{1,8})(?:\b|$)/i);
  if (fromPath) return Number(fromPath[1]);
  const plain = text.match(/^#?\s*(\d{1,8})$/);
  if (plain) return Number(plain[1]);
  return null;
};

export const dammizSchemeUrl = (id: number): string => `${DAMMIZ_ORIGIN}/picking/schemes/${id}`;

// ------------------------------------------------------------------
// 数据结构（代理裁剪后的形状，与原始接口字段同名）
// ------------------------------------------------------------------

export interface DammizPart {
  runnerName: string;
  partName: string;
  quantity: number;
  notes?: string;
}

export interface DammizSection {
  name: string;
  parts: DammizPart[];
}

export interface DammizScheme {
  id: number;
  title: string;
  revision?: string;
  updatedAt?: number;
  kitName?: string;
  brandName?: string;
  productLineName?: string;
  sections: DammizSection[];
}

const normalizeScheme = (raw: any): DammizScheme => {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.sections)) {
    throw new Error('方案数据格式无法识别');
  }
  return {
    id: Number(raw.id),
    title: String(raw.title ?? '').trim() || `达米兹方案 #${raw.id}`,
    revision: raw.revision ?? raw.editorRevision ?? undefined,
    updatedAt: Number(raw.updatedAt) || undefined,
    kitName: raw.modelKit?.name || undefined,
    brandName: raw.modelKit?.brand?.name || undefined,
    productLineName: raw.modelKit?.productLine?.name || undefined,
    // 仅保留文本字段；原始接口里的封面 / 板件图片字段在这里被丢弃
    sections: raw.sections.map((s: any) => ({
      name: String(s?.name ?? '').trim() || '未命名部位',
      parts: (Array.isArray(s?.parts) ? s.parts : []).map((p: any) => ({
        runnerName: String(p?.runnerName ?? '').trim(),
        partName: String(p?.partName ?? '').trim(),
        quantity: Number(p?.quantity) || 1,
        notes: p?.notes ? String(p.notes) : undefined,
      })),
    })),
  };
};

const unwrapPayload = (json: any): DammizScheme => {
  if (!json || typeof json !== 'object') throw new Error('接口返回为空');
  if (json.code !== 0 || !json.data) throw new Error(json.msg || '方案不存在或未公开');
  return normalizeScheme(json.data);
};

// ------------------------------------------------------------------
// 拉取：Web 走同源代理 /api/dammiz-scheme（Cloudflare Pages Function / Vite 中间件）
//       原生 App 走 CapacitorHttp 原生请求（不受 WebView CORS 限制）
// ------------------------------------------------------------------

export const fetchDammizScheme = async (id: number): Promise<DammizScheme> => {
  if (!Number.isInteger(id) || id <= 0) throw new Error('无效的方案编号');

  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.get({
      url: `${DAMMIZ_ORIGIN}/api/picking/schemes/${id}`,
      headers: { Accept: 'application/json' },
      responseType: 'json',
    });
    const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
    return unwrapPayload(data);
  }

  let proxyError: Error | null = null;
  try {
    const res = await fetch(`/api/dammiz-scheme?id=${id}`, { headers: { Accept: 'application/json' } });
    const type = res.headers.get('content-type') || '';
    if (type.includes('application/json')) {
      return unwrapPayload(await res.json());
    }
    proxyError = new Error('当前环境未部署导入代理（本地开发请重启 npm run dev）');
  } catch (err: any) {
    proxyError = err instanceof Error ? err : new Error(String(err));
  }

  // 兜底：直连（仅当对方开放 CORS 时可用）
  try {
    const res = await fetch(`${DAMMIZ_ORIGIN}/api/picking/schemes/${id}`, {
      headers: { Accept: 'application/json' },
      credentials: 'omit',
    });
    return unwrapPayload(await res.json());
  } catch {
    throw new Error(
      proxyError?.message && proxyError.message !== 'Failed to fetch'
        ? proxyError.message
        : '网络请求失败，请检查网络后重试'
    );
  }
};

// ------------------------------------------------------------------
// 部位名 → GK-Mixer 部位分类
// ------------------------------------------------------------------

const CATEGORY_RULES: Array<[RegExp, ChecklistRegionCategory]> = [
  [/废件|多余|备用|不使用|未使用|余件/, 'other'],
  [/水贴|贴纸|贴花|decal|sticker/i, 'decal'],
  [/支架|底座|地台|展示架|stand|base/i, 'adapter'],
  [/特效|效果|光效|effect/i, 'effect'],
  [/盾/, 'shield'],
  [/头|head/i, 'head'],
  [/核心|战机|驾驶舱|cockpit|core/i, 'core'],
  [/右.{0,2}(腕|臂|手|肘)|(腕|臂|手).{0,2}[（(]?右/, 'arm_r'],
  [/左.{0,2}(腕|臂|手|肘)|(腕|臂|手).{0,2}[（(]?左/, 'arm_l'],
  [/右.{0,2}(腿|脚|足|膝)|(腿|脚|足).{0,2}[（(]?右/, 'leg_r'],
  [/左.{0,2}(腿|脚|足|膝)|(腿|脚|足).{0,2}[（(]?左/, 'leg_l'],
  [/肩|绑缚|binder|shoulder/i, 'shoulder'],
  [/背包|推进|背部|翼|翅|backpack|wing/i, 'backpack'],
  [/腰|裙|股|waist|skirt/i, 'waist'],
  [/胸|躯干|身体|上身|腹|torso|chest|body/i, 'torso'],
  [/腕|臂|手|arm|hand/i, 'arm_common'],
  [/腿|脚|足|膝|leg|foot/i, 'leg_common'],
  [/武器|枪|炮|刀|剑|军刀|光束|浮游|火箭|导弹|斧|矛|weapon|rifle|saber|funnel/i, 'weapon'],
];

export const guessRegionCategory = (sectionName: string): ChecklistRegionCategory => {
  for (const [re, cat] of CATEGORY_RULES) if (re.test(sectionName)) return cat;
  return 'other';
};

// ------------------------------------------------------------------
// 转换
// ------------------------------------------------------------------

export interface DammizSectionPreview {
  index: number;
  name: string;
  category: ChecklistRegionCategory;
  partCount: number; // 含数量倍数
  uniqueParts: number;
  runnerIds: string[];
}

export interface DammizImportPreview {
  scheme: DammizScheme;
  sections: DammizSectionPreview[];
  runnerIds: string[];
  totalParts: number;
  skipped: string[]; // 无法识别的零件（非数字零件号 / 缺板件号）
}

const RUNNER_NAME_RE = /^[A-Za-z]{1,4}\d{0,3}$/;

const parsePartNumber = (partName: string): number | null => {
  const s = partName.trim();
  if (/^\d{1,3}$/.test(s)) return Number(s);
  const m = s.match(/^(?:[A-Za-z]{1,4}\d{0,3}[-_ ])?(\d{1,3})$/); // "A1-7" 之类
  return m ? Number(m[1]) : null;
};

interface ParsedSectionParts {
  inputs: PartInput[];
  skipped: string[];
}

const parseSectionParts = (section: DammizSection): ParsedSectionParts => {
  // 同部位同板件同号：数量累加
  const acc = new Map<string, { runnerId: string; number: number; quantity: number }>();
  const skipped: string[] = [];
  for (const p of section.parts) {
    const runnerId = p.runnerName.trim().toUpperCase();
    const num = parsePartNumber(p.partName);
    if (!runnerId || !RUNNER_NAME_RE.test(runnerId) || num == null || num < 1) {
      skipped.push(`${section.name}：${p.runnerName || '?'}-${p.partName || '?'}`);
      continue;
    }
    const key = `${runnerId}:${num}`;
    const cur = acc.get(key);
    if (cur) cur.quantity += Math.max(1, p.quantity);
    else acc.set(key, { runnerId, number: num, quantity: Math.max(1, p.quantity) });
  }
  const inputs: PartInput[] = [...acc.values()].map((v) => ({
    runnerId: v.runnerId,
    number: v.number,
    ...quantityToBadge(v.quantity),
  }));
  return { inputs, skipped };
};

export const buildDammizPreview = (scheme: DammizScheme): DammizImportPreview => {
  const runnerSet = new Set<string>();
  const skipped: string[] = [];
  let totalParts = 0;
  const sections: DammizSectionPreview[] = scheme.sections.map((s, index) => {
    const parsed = parseSectionParts(s);
    skipped.push(...parsed.skipped);
    const ids = [...new Set(parsed.inputs.map((i) => i.runnerId))];
    ids.forEach((id) => runnerSet.add(id));
    const partCount = parsed.inputs.reduce((sum, it) => sum + partQuantity(it), 0);
    totalParts += partCount;
    return {
      index,
      name: s.name,
      category: guessRegionCategory(s.name),
      partCount,
      uniqueParts: parsed.inputs.length,
      runnerIds: sortRunners(ids.map((id) => createRunner(id, 1))).map((r) => r.id),
    };
  });
  return {
    scheme,
    sections,
    runnerIds: sortRunners([...runnerSet].map((id) => createRunner(id, 1))).map((r) => r.id),
    totalParts,
    skipped,
  };
};

export type DammizImportMode = 'replace' | 'merge';

export interface DammizApplyOptions {
  mode: DammizImportMode;
  /** 部位 index → 用户确认后的分类 */
  categories: Record<number, ChecklistRegionCategory>;
  /** 跳过的部位 index（如「废件」） */
  excluded?: Set<number>;
  syncTitle: boolean;
  sourceUrl: string;
}

export const applyDammizImport = (
  prev: PartsChecklist,
  preview: DammizImportPreview,
  opts: DammizApplyOptions
): { checklist: PartsChecklist; addedParts: number; addedRegions: number } => {
  const { scheme } = preview;
  const baseRunners: ChecklistRunner[] = opts.mode === 'merge' ? prev.runners : [];
  // 替换模式下保留同名板件已绑定的颜色 / 油漆，省去重新取色
  const colorMemory = new Map(prev.runners.map((r) => [r.id, r]));
  const runnerMap = new Map(baseRunners.map((r) => [r.id, r]));

  const sectionInputs = scheme.sections.map((s) => parseSectionParts(s).inputs);

  // 1. 板件：最大号 = 方案中出现的最大零件号
  const maxById = new Map<string, number>();
  sectionInputs.forEach((inputs, idx) => {
    if (opts.excluded?.has(idx)) return;
    for (const it of inputs) maxById.set(it.runnerId, Math.max(maxById.get(it.runnerId) ?? 0, it.number));
  });
  maxById.forEach((max, id) => {
    const existing = runnerMap.get(id);
    if (existing) {
      if (max > existing.maxNumber) runnerMap.set(id, { ...existing, maxNumber: clampMaxNumber(max) });
      return;
    }
    const remembered = colorMemory.get(id);
    runnerMap.set(
      id,
      remembered
        ? { ...remembered, maxNumber: clampMaxNumber(Math.max(max, remembered.maxNumber)) }
        : createRunner(id, max)
    );
  });
  const runners = sortRunners([...runnerMap.values()]);

  // 2. 部位：合并模式下同名部位追加零件，否则新建
  const regions: ChecklistRegion[] = opts.mode === 'merge' ? [...prev.regions] : [];
  let addedParts = 0;
  let addedRegions = 0;
  scheme.sections.forEach((section, idx) => {
    if (opts.excluded?.has(idx)) return;
    const inputs = sectionInputs[idx];
    if (inputs.length === 0) return;
    const category = opts.categories[idx] ?? guessRegionCategory(section.name);
    const existingIdx =
      opts.mode === 'merge' ? regions.findIndex((r) => r.title.trim() === section.name.trim()) : -1;
    const base = existingIdx >= 0 ? regions[existingIdx] : createRegion(category, section.name);
    const { region, added } = addPartsToRegion(base, inputs, runners);
    addedParts += added;
    if (existingIdx >= 0) {
      regions[existingIdx] = region;
    } else {
      regions.push(region);
      addedRegions++;
    }
  });

  const source: ChecklistImportSource = {
    provider: 'dammiz',
    schemeId: scheme.id,
    url: opts.sourceUrl,
    title: scheme.title,
    revision: scheme.revision,
    importedAt: Date.now(),
  };

  return {
    checklist: {
      ...prev,
      runners,
      regions,
      source,
      modelTitle: opts.syncTitle ? scheme.title : prev.modelTitle,
      subtitle:
        opts.syncTitle && !prev.subtitle?.trim()
          ? [scheme.brandName, scheme.productLineName].filter(Boolean).join(' · ') || prev.subtitle
          : prev.subtitle,
    },
    addedParts,
    addedRegions,
  };
};
