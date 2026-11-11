import {
  CatalogPaint,
  FloatingSwatchNode,
  GKMixArchivePart,
  GKMixArchivePayload,
  PaintingStep,
  PaintProject,
  PartCanvas,
  QRNode,
  QRSharePayload,
  QRStep,
} from '../types';
import { detectQRFromImageFile } from './qrCode';
import { isValidImageSrc, resolvePartImageSrc } from './studioSession';

const round3 = (n: number) => Math.round(n * 1000) / 1000;

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(sub));
  }
  return btoa(binary);
}

function base64ToUint8(base64: string): Uint8Array {
  const clean = base64.replace(/\s+/g, '');
  const binary = atob(clean);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

/**
 * Compresses UTF-8 string using raw deflate (RFC 1951, identical to Apple NSData.compressed(using: .zlib)).
 */
export async function compressDeflateRaw(text: string): Promise<Uint8Array> {
  const input = new TextEncoder().encode(text);
  if (typeof CompressionStream !== 'undefined') {
    try {
      const cs = new CompressionStream('deflate-raw');
      const writer = cs.writable.getWriter();
      writer.write(input);
      writer.close();
      const buf = await new Response(cs.readable).arrayBuffer();
      return new Uint8Array(buf);
    } catch {
      const cs = new CompressionStream('deflate');
      const writer = cs.writable.getWriter();
      writer.write(input);
      writer.close();
      const buf = await new Response(cs.readable).arrayBuffer();
      return new Uint8Array(buf);
    }
  }
  return input;
}

/**
 * Decompresses bytes trying 'deflate-raw' (Apple Foundation .zlib), 'deflate' (RFC 1950), and plain UTF-8 fallback.
 */
export async function decompressDeflateAny(bytes: Uint8Array): Promise<string> {
  if (typeof DecompressionStream !== 'undefined') {
    for (const format of ['deflate-raw', 'deflate'] as const) {
      try {
        const ds = new DecompressionStream(format);
        const writer = ds.writable.getWriter();
        writer.write(bytes as unknown as BufferSource);
        writer.close();
        const buf = await new Response(ds.readable).arrayBuffer();
        return new TextDecoder().decode(buf);
      } catch {
        // try next format
      }
    }
  }
  // If input has a 2-byte zlib header (0x78), try stripping header & 4-byte Adler32 trailer with deflate-raw
  if (typeof DecompressionStream !== 'undefined' && bytes.length > 6 && bytes[0] === 0x78) {
    try {
      const stripped = bytes.subarray(2, bytes.length - 4);
      const ds = new DecompressionStream('deflate-raw');
      const writer = ds.writable.getWriter();
      writer.write(stripped as unknown as BufferSource);
      writer.close();
      const buf = await new Response(ds.readable).arrayBuffer();
      return new TextDecoder().decode(buf);
    } catch {
      // ignore
    }
  }
  return new TextDecoder().decode(bytes);
}

// ==========================================
// ==========================================
// NOMOKEN 1 + CITADEL / 'EAVY METAL 全量预设工序字典注册表 (5 大分类 · 39 项标准工序)
// ==========================================

export interface PresetItem {
  code: string;
  defaultName: string;
  category: 'basic' | 'main' | 'advanced' | 'topcoat' | 'handpaint';
  lucideIcon: string;
  themeColorHex: string;
  defaultNozzle?: string;
  defaultRatio?: string;
  defaultPressure?: string;
  defaultMethod: string;
  nomokenTip?: string;
}

export const STEP_PRESET_REGISTRY: PresetItem[] = [
  // 1. 基础处理：打磨 / 补土 / 清洗 / 天顶预置 (basic)
  {
    code: 'sd',
    defaultName: '打磨修件',
    category: 'basic',
    lucideIcon: 'Sparkles',
    themeColorHex: '#F59E0B',
    defaultMethod: '#400➔#1000砂纸',
    nomokenTip: '耐水砂纸顺序打磨，镜面光泽件修模需精磨至 #2000',
  },
  {
    code: 'cl',
    defaultName: '清洗脱脂',
    category: 'basic',
    lucideIcon: 'Droplets',
    themeColorHex: '#06B6D4',
    defaultMethod: '洗剂浸泡晾干',
    nomokenTip: '中性洗剂或超声波清洗离型剂与打磨粉尘，彻底晾干',
  },
  {
    code: 'pr',
    defaultName: '水补土打底',
    category: 'basic',
    lucideIcon: 'Shield',
    themeColorHex: '#3B82F6',
    defaultNozzle: '0.5mm',
    defaultRatio: '1:2.0',
    defaultPressure: '1.8bar/26psi',
    defaultMethod: '薄喷 1~2 遍',
    nomokenTip: '1000号标准灰检查瑕疵，1200号极细免磨薄喷',
  },
  {
    code: 'mp',
    defaultName: '金属/树脂底漆',
    category: 'basic',
    lucideIcon: 'ShieldCheck',
    themeColorHex: '#6366F1',
    defaultNozzle: '0.3mm',
    defaultRatio: '原液直喷',
    defaultPressure: '1.2bar/18psi',
    defaultMethod: '薄喷 1~2 遍',
    nomokenTip: 'GK树脂专用补土或金属透明防剥落底漆，增强附着力',
  },
  {
    code: 'zn',
    defaultName: '天顶黑白灰预置 (Zenithal)',
    category: 'basic',
    lucideIcon: 'Sun',
    themeColorHex: '#0EA5E9',
    defaultNozzle: '0.3mm',
    defaultRatio: '1:2.0',
    defaultPressure: '1.2bar/18psi',
    defaultMethod: '黑底➔45°灰➔90°白顶光',
    nomokenTip: '黑补土满喷➔45°斜上方喷中灰➔90°正顶喷白，一步建立真实球面体积光底色',
  },

  // 2. 主色喷涂：底色 / 平喷 / 分色 (main)
  {
    code: 'bs',
    defaultName: '发色打底',
    category: 'main',
    lucideIcon: 'Layers',
    themeColorHex: '#8B5CF6',
    defaultNozzle: '0.3mm',
    defaultRatio: '1:2.0',
    defaultPressure: '1.2bar/18psi',
    defaultMethod: '薄喷 1~2 遍',
    nomokenTip: '白底提亮显色，粉红底发红黄肤色，黑底发金属',
  },
  {
    code: 'bp',
    defaultName: '主色平喷',
    category: 'main',
    lucideIcon: 'Paintbrush',
    themeColorHex: '#EC4899',
    defaultNozzle: '0.3mm',
    defaultRatio: '1:2.0',
    defaultPressure: '1.2bar/18psi',
    defaultMethod: '十字薄喷 2~3 遍',
    nomokenTip: '距离 10-15cm，先喷边缘凹线再十字薄喷 2~3 遍',
  },
  {
    code: 'mc',
    defaultName: '金属色喷涂',
    category: 'main',
    lucideIcon: 'Cpu',
    themeColorHex: '#94A3B8',
    defaultNozzle: '0.3~0.5mm',
    defaultRatio: '1:2.0',
    defaultPressure: '0.8bar/12psi',
    defaultMethod: '远距低压柔喷',
    nomokenTip: '0.3mm以上口径远距低压柔喷，严防粒子湿润流动',
  },
  {
    code: 'cm',
    defaultName: '徒手柔边迷彩',
    category: 'main',
    lucideIcon: 'Feather',
    themeColorHex: '#10B981',
    defaultNozzle: '0.2mm',
    defaultRatio: '1:2.0',
    defaultPressure: '0.5bar/7psi',
    defaultMethod: '细喷柔边轮廓',
    nomokenTip: '铅笔底稿➔细喷柔边轮廓➔宽喷填涂➔底色修边',
  },
  {
    code: 'mk',
    defaultName: '遮盖分色',
    category: 'main',
    lucideIcon: 'Scissors',
    themeColorHex: '#F97316',
    defaultMethod: '压实边缘防渗',
    nomokenTip: '遵循先浅后深原则，用牙签压实刻线边缘防渗色',
  },
  {
    code: 'hb',
    defaultName: '细节笔涂',
    category: 'main',
    lucideIcon: 'PenTool',
    themeColorHex: '#EF4444',
    defaultRatio: '1:0.5',
    defaultMethod: '面相笔点涂',
    nomokenTip: '添加缓干剂防笔痕，面相笔顺纹路点涂细节',
  },

  // 3. 进阶技法：光影 / 罩染 / 旧化 / 水贴 (advanced)
  {
    code: 'sh',
    defaultName: '阴影预置 (MAX)',
    category: 'advanced',
    lucideIcon: 'Contrast',
    themeColorHex: '#64748B',
    defaultNozzle: '0.2mm',
    defaultRatio: '1:2.5',
    defaultPressure: '0.8bar/12psi',
    defaultMethod: '棱线低压细喷',
    nomokenTip: '棱线凹陷低压细喷暗色，再整体薄喷基本色融合',
  },
  {
    code: 'hl',
    defaultName: '高光提亮 (顶光)',
    category: 'advanced',
    lucideIcon: 'Sun',
    themeColorHex: '#EAB308',
    defaultNozzle: '0.2mm',
    defaultRatio: '1:2.5',
    defaultPressure: '0.8bar/12psi',
    defaultMethod: '受光面中心提亮',
    nomokenTip: '面中心提亮，模拟上方光源在受光顶面加亮',
  },
  {
    code: 'gd',
    defaultName: '层次涂装 (留边)',
    category: 'advanced',
    lucideIcon: 'Layers3',
    themeColorHex: '#0EA5E9',
    defaultNozzle: '0.2~0.3mm',
    defaultRatio: '1:2.5',
    defaultPressure: '0.8bar/12psi',
    defaultMethod: '留边薄喷透色',
    nomokenTip: '深色底➔平面中央喷白留边缘➔薄喷主色透出层次',
  },
  {
    code: 'cc',
    defaultName: '糖果色透明罩染',
    category: 'advanced',
    lucideIcon: 'Wand2',
    themeColorHex: '#D946EF',
    defaultNozzle: '0.3mm',
    defaultRatio: '1:2.5',
    defaultPressure: '1.0bar/15psi',
    defaultMethod: '光油隔离+叠喷',
    nomokenTip: '银底必先喷透明光油隔离防浑浊，再多层叠喷透明色',
  },
  {
    code: 'pe',
    defaultName: '珍珠/云母罩染',
    category: 'advanced',
    lucideIcon: 'Sparkles',
    themeColorHex: '#A855F7',
    defaultNozzle: '0.3~0.5mm',
    defaultRatio: '1:2.5',
    defaultPressure: '0.8bar/12psi',
    defaultMethod: '低压柔喷+罩光',
    nomokenTip: '0.3mm以上口径低压防流挂；白底柔雅/黑底显金属色相',
  },
  {
    code: 'osl',
    defaultName: '等离子/目镜荧光晕染 (OSL)',
    category: 'advanced',
    lucideIcon: 'Sparkle',
    themeColorHex: '#06B6D4',
    defaultNozzle: '0.2mm',
    defaultRatio: '1:3.0',
    defaultPressure: '0.5bar/7psi',
    defaultMethod: '白心打底+柔边荧光',
    nomokenTip: '发光核心涂纯白，外圈低压细喷荧光色或罩染液形成受光溢出光晕',
  },
  {
    code: 'pl',
    defaultName: '渗线勾线',
    category: 'advanced',
    lucideIcon: 'Droplet',
    themeColorHex: '#6366F1',
    defaultRatio: '1:5.0',
    defaultMethod: '点流单向擦拭',
    nomokenTip: '光泽表面点流刻线，火机油/X-20单向擦拭(禁渗裸ABS)',
  },
  {
    code: 'wa',
    defaultName: '水洗渍洗 (滤镜)',
    category: 'advanced',
    lucideIcon: 'CloudRain',
    themeColorHex: '#14B8A6',
    defaultRatio: '1:8.0',
    defaultMethod: '火机油单向擦拭',
    nomokenTip: '高稀释珐琅涂死角，用速干无光泽ZIPPO火机油单向擦拭',
  },
  {
    code: 'gdw',
    defaultName: '暗黑珐琅旧化渍洗 (Grimdark)',
    category: 'advanced',
    lucideIcon: 'CloudFog',
    themeColorHex: '#78350F',
    defaultRatio: '1:6.0',
    defaultMethod: '棉签白电油擦高光',
    nomokenTip: '全件涂刷 Streaking Grime 暗黑珐琅/油画颜料，微干后棉签蘸白电油擦亮受光面',
  },
  {
    code: 'db',
    defaultName: '干扫边缘质感',
    category: 'advanced',
    lucideIcon: 'Brush',
    themeColorHex: '#D97706',
    defaultRatio: '原液滤干',
    defaultMethod: '滤干轻扫棱边',
    nomokenTip: '硬毛平笔蘸明色在纸上擦干至无色，轻扫凸起棱边',
  },
  {
    code: 'ch',
    defaultName: '掉漆笔涂 (剥落)',
    category: 'advanced',
    lucideIcon: 'Edit3',
    themeColorHex: '#9CA3AF',
    defaultRatio: '水性原液',
    defaultMethod: '面相笔点绘棱角',
    nomokenTip: '银色+灰色水性漆混合，面相笔点绘棱角铆钉(可水擦修正)',
  },
  {
    code: 'wp',
    defaultName: '粉彩泥锈旧化',
    category: 'advanced',
    lucideIcon: 'CloudFog',
    themeColorHex: '#B45309',
    defaultRatio: '干粉/AB液',
    defaultMethod: '海绵擦拭+点涂',
    nomokenTip: '#240砂纸研粉彩点凹处，海绵棒擦凸处，天然锈氧化',
  },
  {
    code: 'dc',
    defaultName: '水贴纸张贴',
    category: 'advanced',
    lucideIcon: 'Sticker',
    themeColorHex: '#22C55E',
    defaultMethod: '蓝盖定位+绿盖软化',
    nomokenTip: '蓝盖带胶定位+绿盖软化服帖，彻底干透后再封层',
  },

  // 4. 封层保护：消光 / 光油 / 水研 / 抛光 (topcoat)
  {
    code: 'sp',
    defaultName: '水贴防蚀喷砂层',
    category: 'topcoat',
    lucideIcon: 'ShieldAlert',
    themeColorHex: '#38BDF8',
    defaultNozzle: '0.3mm',
    defaultRatio: '1:1.5(缓干)',
    defaultPressure: '1.0bar/15psi',
    defaultMethod: '远距干喷隔离',
    nomokenTip: '首层拉远距离干喷呈微粗糙喷砂状，防强溶剂腐蚀贴纸',
  },
  {
    code: 'gl',
    defaultName: '光油封层 (光泽)',
    category: 'topcoat',
    lucideIcon: 'Triangle',
    themeColorHex: '#2563EB',
    defaultNozzle: '0.3~0.5mm',
    defaultRatio: '1:2.0(缓干)',
    defaultPressure: '1.8bar/26psi',
    defaultMethod: '缓干湿喷流平',
    nomokenTip: '推荐使用黄标缓干溶剂湿喷流平，高湿雨天禁喷防白化',
  },
  {
    code: 'sg',
    defaultName: '半光保护层',
    category: 'topcoat',
    lucideIcon: 'CircleDot',
    themeColorHex: '#818CF8',
    defaultNozzle: '0.3mm',
    defaultRatio: '1:2.0',
    defaultPressure: '1.2bar/18psi',
    defaultMethod: '薄喷 2 遍',
    nomokenTip: '十字薄喷2遍，呈现标准机甲丝绸质感',
  },
  {
    code: 'mt',
    defaultName: '消光保护层',
    category: 'topcoat',
    lucideIcon: 'Wind',
    themeColorHex: '#64748B',
    defaultNozzle: '0.3~0.5mm',
    defaultRatio: '1:2.0',
    defaultPressure: '1.2bar/18psi',
    defaultMethod: '薄喷 2 遍',
    nomokenTip: '距离 15~20cm 薄喷，压制塑料反光感',
  },
  {
    code: 'ws',
    defaultName: '中间水研 (消段差)',
    category: 'topcoat',
    lucideIcon: 'Waves',
    themeColorHex: '#0284C7',
    defaultMethod: '#1500水砂纸平光',
    nomokenTip: '#1200~#1500耐水砂纸裹弹性橡皮轻抚，磨平橘皮与贴纸台阶',
  },
  {
    code: 'po',
    defaultName: '镜面抛光研出',
    category: 'topcoat',
    lucideIcon: 'Gem',
    themeColorHex: '#06B6D4',
    defaultMethod: '#2000+三目抛光',
    nomokenTip: '#2000水研避开棱角➔粗/细/极细目研磨膏抛至发出吱吱声',
  },

  // 5. 微缩与重甲手涂工序：通用手涂分级体系 (handpaint)
  {
    code: 'wh_base',
    defaultName: 'Base 高遮盖底涂',
    category: 'handpaint',
    lucideIcon: 'PaintBrushBroad',
    themeColorHex: '#2563EB',
    defaultNozzle: '1号貂毛笔',
    defaultRatio: '1:0.3(湿盘)',
    defaultMethod: '两遍薄涂 (Two Thin Coats)',
    nomokenTip: '高色素浓度丙烯底漆，在湿色盘润开后分两遍薄涂，彻底消除笔痕并均匀覆盖底补土',
  },
  {
    code: 'wh_shade',
    defaultName: 'Shade 全局渍洗阴影',
    category: 'handpaint',
    lucideIcon: 'Droplet',
    themeColorHex: '#475569',
    defaultNozzle: '2号阴影笔',
    defaultRatio: '原液直涂',
    defaultMethod: '导流凹槽+吸除积漆',
    nomokenTip: '涂刷深色水性阴影液，趁未干用干净湿笔吸走肩甲球面多余积漆防咖啡斑',
  },
  {
    code: 'wh_recess',
    defaultName: 'Recess Shade 凹槽精准暗线',
    category: 'handpaint',
    lucideIcon: 'PenTool',
    themeColorHex: '#1E293B',
    defaultNozzle: '0号面相笔',
    defaultRatio: '1:0.5',
    defaultMethod: '沿装甲接缝精准填线',
    nomokenTip: '重甲盒照核心：将深色混黑精准填入主装甲与金框交界夹角，保留大面干净底色',
  },
  {
    code: 'wh_soft',
    defaultName: 'Soft Shade 球面暗部柔化',
    category: 'handpaint',
    lucideIcon: 'Contrast',
    themeColorHex: '#4F46E5',
    defaultNozzle: '1号貂毛笔',
    defaultRatio: '1:3.0(Glaze)',
    defaultMethod: '向背光侧单向拉暗',
    nomokenTip: '主色混暗色高稀释液，从受光中线向肩甲下半球/背光侧收笔，建立柔和球面体积暗部',
  },
  {
    code: 'wh_layer',
    defaultName: 'Layer 受光层涂提亮',
    category: 'handpaint',
    lucideIcon: 'Layers',
    themeColorHex: '#0284C7',
    defaultNozzle: '1号貂毛笔',
    defaultRatio: '1:0.8',
    defaultMethod: '留暗槽分阶叠涂受光面',
    nomokenTip: '半透明层涂漆逐层缩小面积提亮凸起受光面，重塑并强化经历阴影后的鲜亮主色',
  },
  {
    code: 'wh_chunky',
    defaultName: 'Chunky Highlight 粗高光沿',
    category: 'handpaint',
    lucideIcon: 'Sparkle',
    themeColorHex: '#3B82F6',
    defaultNozzle: '1号貂毛笔',
    defaultRatio: '1:0.5',
    defaultMethod: '沿棱边画宽过渡亮带',
    nomokenTip: '重甲双层高光第1步：用中间亮色沿装甲折角与金框内缘画出约 0.8mm 宽过渡带',
  },
  {
    code: 'wh_edge',
    defaultName: 'Fine Edge 刀锋极细棱边高光',
    category: 'handpaint',
    lucideIcon: 'Sparkles',
    themeColorHex: '#38BDF8',
    defaultNozzle: '00号极细笔',
    defaultRatio: '1:0.4',
    defaultMethod: '笔腹45°侧刮刀锋亮线',
    nomokenTip: '重甲双层高光第2步：滤干笔肚水分，用笔腹 45° 斜擦最尖锐的 C 面棱边',
  },
  {
    code: 'wh_dot',
    defaultName: 'Dot Highlight 尖角极亮点高光',
    category: 'handpaint',
    lucideIcon: 'Sun',
    themeColorHex: '#7DD3FC',
    defaultNozzle: '00号极细笔',
    defaultRatio: '1:0.3(湿盘)',
    defaultMethod: '笔尖轻点转角与铆钉顶点',
    nomokenTip: '在装甲折角交汇顶点与铆钉顶端轻点极浅冰蓝/象牙白，瞬间拉满官方盒照视觉锐度',
  },
  {
    code: 'wh_stipple',
    defaultName: 'Volumetric Stippling 体积光点拍',
    category: 'handpaint',
    lucideIcon: 'Sparkle',
    themeColorHex: '#06B6D4',
    defaultNozzle: '0号点拍笔',
    defaultRatio: '1:0.5',
    defaultMethod: '笔尖密集点拍+排线过渡',
    nomokenTip: '大师赛点拍技法：用笔尖成百上千次点拍与微排线，在球面穹顶堆叠丝绒般高反差体积光',
  },
  {
    code: 'wh_glaze',
    defaultName: 'Glaze 透明罩染过渡与滤镜',
    category: 'handpaint',
    lucideIcon: 'Wand2',
    themeColorHex: '#8B5CF6',
    defaultNozzle: '1号貂毛笔',
    defaultRatio: '1:4.0(Glaze)',
    defaultMethod: '吸干笔肚多层薄罩融合',
    nomokenTip: '以 1:4 媒介液稀释并在纸巾吸去多余水份，在色阶交界处反复轻扫消除断层或注入冷暖倾向',
  },
  {
    code: 'wh_contrast',
    defaultName: 'Contrast 对比漆一步流着色',
    category: 'handpaint',
    lucideIcon: 'Droplets',
    themeColorHex: '#EC4899',
    defaultNozzle: '2号储水笔',
    defaultRatio: 'Contrast原液',
    defaultMethod: '浅底单层快涂定向导流',
    nomokenTip: '在暖白/冷灰浅色底漆上单次饱蘸快涂，自动在凹槽聚集成影、凸起处退让显亮',
  },
  {
    code: 'wh_slapchop',
    defaultName: 'Slapchop 黑白灰干扫快涂底',
    category: 'handpaint',
    lucideIcon: 'Brush',
    themeColorHex: '#F59E0B',
    defaultNozzle: '圆头干扫笔',
    defaultRatio: '原液滤干',
    defaultMethod: '黑底➔灰重扫➔白轻扫棱角',
    nomokenTip: '黑底上用圆头干扫笔重扫中灰、轻扫纯白提亮棱角，再罩涂对比漆实现极速高立体感',
  },
  {
    code: 'wh_nmm',
    defaultName: 'NMM 非金属伪金属高光带',
    category: 'handpaint',
    lucideIcon: 'Gem',
    themeColorHex: '#EAB308',
    defaultNozzle: '0号貂毛笔',
    defaultRatio: '1:0.8',
    defaultMethod: '深棕➔金黄➔纯白高反差排带',
    nomokenTip: '不含金属粉，通过模拟主光源高光反射带与地面次级反光带，手涂出油画质感的黄金/寒铁边',
  },
  {
    code: 'wh_chip',
    defaultName: 'Sponge Chipping 海绵掉漆战损',
    category: 'handpaint',
    lucideIcon: 'Scissors',
    themeColorHex: '#78716C',
    defaultNozzle: '海绵块+00号笔',
    defaultRatio: '原液滤干',
    defaultMethod: '海绵轻拍黑斑+亮线托底',
    nomokenTip: '撕碎海绵蘸黑褐轻拍肩甲受撞击棱角，并在黑斑下缘画一道极细高光色模拟立体凹坑厚度',
  },
  {
    code: 'wh_tech',
    defaultName: 'Technical 特效肌理与地台',
    category: 'handpaint',
    lucideIcon: 'ShieldCheck',
    themeColorHex: '#10B981',
    defaultNozzle: '旧笔/刮刀',
    defaultRatio: '原液厚涂',
    defaultMethod: '宝石光泽/血迹腐蚀/结构泥',
    nomokenTip: '涂抹宝石透明特效漆、铜绿氧化物或地台龟裂砂膏完成终局氛围塑造',
  },
];

export function findStepPreset(codeOrName: string): PresetItem | undefined {
  if (!codeOrName) return undefined;
  const q = codeOrName.trim().toLowerCase();
  return (
    STEP_PRESET_REGISTRY.find((p) => p.code.toLowerCase() === q) ||
    STEP_PRESET_REGISTRY.find((p) => p.defaultName.toLowerCase() === q)
  );
}

// ==========================================
// PaintingStep Parameter Parsing Helpers (1:1 with iOS PaintingStep extensions)
// ==========================================

export function normalizePressureFormat(rawPressure: string): string {
  const trimmed = (rawPressure || '').trim();
  if (!trimmed || trimmed === '无' || trimmed === '--') return '';
  const mpaMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*MPa$/i);
  if (mpaMatch) {
    const mpa = parseFloat(mpaMatch[1]);
    if (Number.isFinite(mpa) && mpa > 0) {
      const bar = Math.round(mpa * 100) / 10;
      const psi = Math.round(mpa * 145.038);
      return `${bar.toFixed(1)}bar/${psi}psi`;
    }
  }
  return trimmed;
}

export function normalizeTechnique(rawTech?: string, defaultMethod?: string): string {
  if (!rawTech || !rawTech.trim() || rawTech.trim() === '无' || rawTech.trim() === '--') {
    return defaultMethod || '薄喷 2 遍';
  }
  const clean = rawTech.trim();
  if (clean.length <= 22) return clean;

  if (clean.includes('先喷边缘凹线再十字薄喷') || clean.includes('十字薄喷')) {
    return '十字薄喷 2~3 遍';
  } else if (clean.includes('免磨薄喷') || clean.includes('水补土') || clean.includes('防剥落底漆')) {
    return '薄喷 1~2 遍';
  } else if (clean.includes('标准机甲丝绸质感')) {
    return '薄喷 2 遍';
  } else if (clean.includes('压制塑料反光感') || clean.includes('消光')) {
    return '薄喷 2 遍';
  } else if (clean.includes('防强溶剂腐蚀贴纸') || clean.includes('喷砂状')) {
    return '远距干喷隔离';
  } else if (clean.includes('黄标缓干溶剂湿喷流平') || clean.includes('高光光油')) {
    return '缓干湿喷流平';
  } else if (clean.includes('耐水砂纸') && clean.includes('段差')) {
    return '#1500水砂纸平光';
  } else if (clean.includes('吱吱声') || clean.includes('抛光') || clean.includes('研出')) {
    return '#2000+三目抛光';
  } else if (clean.includes('防粒子流动') || clean.includes('严防粒子湿润流动')) {
    return '远距低压柔喷';
  } else if (clean.includes('白底柔雅') || clean.includes('云母')) {
    return '低压柔喷+罩光';
  } else if (clean.includes('透明光油隔离') || clean.includes('糖果色')) {
    return '光油隔离+叠喷';
  } else if (clean.includes('蓝盖') || clean.includes('水贴')) {
    return '蓝盖定位+绿盖软化';
  } else if (clean.includes('火机油') || clean.includes('渍洗')) {
    return '火机油单向擦拭';
  } else if (clean.includes('渗线') || clean.includes('刻线')) {
    return '点流单向擦拭';
  } else if (clean.includes('点绘棱角') || clean.includes('掉漆')) {
    return '面相笔点绘棱角';
  } else if (clean.includes('粉彩') || clean.includes('海绵棒') || clean.includes('旧化')) {
    return '海绵擦拭+点涂';
  } else if (clean.includes('硬毛平笔') || clean.includes('干扫')) {
    return '滤干轻扫棱边';
  } else if (clean.includes('留边缘') || clean.includes('层次')) {
    return '留边薄喷透色';
  } else if (clean.includes('受光顶面') || clean.includes('高光')) {
    return '受光面中心提亮';
  } else if (clean.includes('暗色') || clean.includes('阴影')) {
    return '棱线低压细喷';
  } else if (clean.includes('发色打底') || clean.includes('白底提亮')) {
    return '薄喷 1~2 遍';
  } else if (clean.includes('打磨') || clean.includes('砂纸')) {
    return '#400➔#1000砂纸';
  } else if (clean.includes('清洗') || clean.includes('脱脂')) {
    return '洗剂浸泡晾干';
  }
  return defaultMethod || clean.slice(0, 10);
}

export function parseStepParams(
  ratioAndPressure?: string,
  explicitNozzle?: string
): {
  ratio: string;
  pressure: string;
  technique: string;
  nozzle: string;
} {
  const parts = (ratioAndPressure || '')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
  const ratio = parts[0] && parts[0] !== '无' && parts[0] !== '--' ? parts[0] : '';
  const rawPressure = parts[1] && parts[1] !== '无' && parts[1] !== '--' ? parts[1] : '';
  const pressure = normalizePressureFormat(rawPressure);
  const rawTechnique = parts[2] || '薄喷 2 遍';
  const technique = normalizeTechnique(rawTechnique);
  const nozzle =
    explicitNozzle ||
    (parts[3] && parts[3] !== '无' && parts[3] !== '--' ? parts[3] : '');
  return {
    ratio,
    pressure,
    technique,
    nozzle,
  };
}

export function buildStepParams(
  ratio: string,
  pressure: string,
  technique: string,
  nozzle?: string
): string {
  const r = ratio || '无';
  const p = pressure || '无';
  const t = technique || '薄喷 2 遍';
  const nz = nozzle || '无';
  return `${r} | ${p} | ${t} | ${nz}`;
}

/**
 * Smart workflow inference (`✨ 智能推导`) from a part's assigned swatch nodes.
 */
export function inferStepsFromNodes(nodes: FloatingSwatchNode[]): PaintingStep[] {
  const steps: PaintingStep[] = [
    {
      id: `step-${Date.now()}-primer`,
      iconName: 'Shield',
      actionText: '水补土打底',
      actionCode: 'pr',
      paintID: nodes[0] ? `${nodes[0].paintBrand} ${nodes[0].paintCode}` : undefined,
      ratioAndPressure: '1:2.0 | 1.8bar/26psi | 薄喷 1~2 遍 | 0.5mm',
      nozzle: '0.5mm',
    },
  ];

  nodes.forEach((node, idx) => {
    const isMetallic =
      node.paintName.includes('金') ||
      node.paintName.includes('银') ||
      node.paintName.includes('铁') ||
      node.paintName.includes('金属') ||
      node.paintName.includes('铜') ||
      node.paintName.includes('钛');

    if (isMetallic) {
      steps.push({
        id: `step-${Date.now()}-blackbase-${idx}`,
        iconName: 'Layers',
        actionText: '黑色发色打底',
        actionCode: 'bs',
        paintID: undefined,
        ratioAndPressure: '1:2.0 | 1.2bar/18psi | 薄喷 1~2 遍 | 0.3mm',
        nozzle: '0.3mm',
      });
      steps.push({
        id: `step-${Date.now()}-metallic-${idx}`,
        iconName: 'Cpu',
        actionText: `${node.paintBrand} ${node.paintCode} 金属喷涂`,
        actionCode: 'mc',
        paintID: `${node.paintBrand} ${node.paintCode}`,
        ratioAndPressure: '1:2.0 | 0.8bar/12psi | 远距低压柔喷 | 0.3~0.5mm',
        nozzle: '0.3~0.5mm',
      });
    } else {
      steps.push({
        id: `step-${Date.now()}-base-${idx}`,
        iconName: 'Paintbrush',
        actionText: `${node.paintBrand} ${node.paintCode} 平喷`,
        actionCode: 'bp',
        paintID: `${node.paintBrand} ${node.paintCode}`,
        ratioAndPressure: '1:2.0 | 1.2bar/18psi | 十字薄喷 2~3 遍 | 0.3mm',
        nozzle: '0.3mm',
      });
    }
  });

  steps.push({
    id: `step-${Date.now()}-panelline`,
    iconName: 'Droplet',
    actionText: '渗线勾线',
    actionCode: 'pl',
    ratioAndPressure: '1:5.0 | 无 | 点流单向擦拭 | 无',
    nozzle: undefined,
  });

  steps.push({
    id: `step-${Date.now()}-topcoat`,
    iconName: 'Wind',
    actionText: '消光保护层',
    actionCode: 'mt',
    ratioAndPressure: '1:2.0 | 1.2bar/18psi | 薄喷 2 遍 | 0.3~0.5mm',
    nozzle: '0.3~0.5mm',
  });

  return steps;
}

// ==========================================
// QR Payload (gkm1:) Encode & Decode
// ==========================================

export function buildQRSharePayload(
  projectTitle: string,
  part: PartCanvas,
  cropRect: [number, number, number, number] = [0, 0, 1, 0.58]
): QRSharePayload {
  const qrNodes: QRNode[] = part.nodes.map((node) => ({
    c: node.hex.replace('#', '').toUpperCase(),
    pid: node.paintCode,
    b: node.paintBrand,
    pos: [
      round3(node.anchorX),
      round3(node.anchorY),
      round3(node.offsetX),
      round3(node.offsetY),
    ],
    st: node.tonalGradient?.length ? node.tonalGradient.length : undefined,
  }));

  const qrSteps: QRStep[] = part.steps.map((step) => {
    const { ratio, pressure, technique, nozzle } = parseStepParams(
      step.ratioAndPressure,
      step.nozzle
    );
    const preset = findStepPreset(step.actionCode || step.actionText);
    const code = preset?.code || step.actionCode || 'bp';
    const customName =
      preset && step.actionText !== preset.defaultName
        ? step.actionText
        : !preset
        ? step.actionText
        : undefined;

    const defaultMethod = preset?.defaultMethod;
    const customMethod = technique && technique !== defaultMethod ? technique : undefined;

    const defaultNozzle = preset?.defaultNozzle;
    const customNozzle = nozzle && nozzle !== defaultNozzle ? nozzle : undefined;

    const defaultRatio = preset?.defaultRatio;
    const customRatio = ratio && ratio !== defaultRatio ? ratio : undefined;

    const defaultPressure = preset?.defaultPressure;
    const customPressure = pressure && pressure !== defaultPressure ? pressure : undefined;

    return {
      a: code,
      cn: customName,
      pid: step.paintID,
      nz: customNozzle,
      rp: customRatio,
      mp: customPressure,
      mt: customMethod,
      i: preset ? undefined : step.iconName,
    };
  });

  return {
    t: projectTitle,
    p: part.partName,
    r: cropRect,
    n: qrNodes,
    s: qrSteps,
  };
}

export async function encodeQRPayloadString(
  projectTitle: string,
  part: PartCanvas,
  cropRect: [number, number, number, number] = [0, 0, 1, 0.58]
): Promise<string> {
  const payload = buildQRSharePayload(projectTitle, part, cropRect);
  const jsonStr = JSON.stringify(payload);
  const compressed = await compressDeflateRaw(jsonStr);
  return `gkm1:${uint8ToBase64(compressed)}`;
}

export async function decodeQRPayloadString(rawString: string): Promise<QRSharePayload> {
  const trimmed = rawString.trim();
  if (!trimmed.startsWith('gkm1:')) {
    throw new Error('并非有效的 GKMixer 涂装工程二维码 (缺少 gkm1: 协议头)');
  }
  const b64 = trimmed.slice(5);
  const bytes = base64ToUint8(b64);
  const jsonStr = await decompressDeflateAny(bytes);
  return JSON.parse(jsonStr) as QRSharePayload;
}

function lookupCatalogPaint(
  catalog: CatalogPaint[],
  brand?: string,
  code?: string,
  fallbackHex?: string
): { brand: string; code: string; name: string; hex: string } {
  const cleanCode = (code || '').trim();
  const cleanBrand = (brand || '').trim();
  if (cleanCode) {
    const exact = catalog.find(
      (p) =>
        p.code.toLowerCase() === cleanCode.toLowerCase() &&
        (!cleanBrand || p.brand.toLowerCase() === cleanBrand.toLowerCase())
    );
    if (exact) {
      return {
        brand: exact.brand,
        code: exact.code,
        name: exact.name,
        hex: exact.hex.toUpperCase(),
      };
    }
    const byCodeOnly = catalog.find((p) => p.code.toLowerCase() === cleanCode.toLowerCase());
    if (byCodeOnly) {
      return {
        brand: byCodeOnly.brand,
        code: byCodeOnly.code,
        name: byCodeOnly.name,
        hex: byCodeOnly.hex.toUpperCase(),
      };
    }
  }
  const hex = fallbackHex
    ? fallbackHex.startsWith('#')
      ? fallbackHex.toUpperCase()
      : `#${fallbackHex.toUpperCase()}`
    : '#64748B';
  return {
    brand: cleanBrand || 'Custom',
    code: cleanCode || '000',
    name: cleanCode ? `${cleanBrand || ''} ${cleanCode}`.trim() : '自定义色',
    hex,
  };
}

async function cropPosterImage(
  posterFileOrDataUrl: File | string,
  normRect: number[] = [0, 0, 1, 0.58]
): Promise<string> {
  const url =
    typeof posterFileOrDataUrl === 'string'
      ? posterFileOrDataUrl
      : URL.createObjectURL(posterFileOrDataUrl);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });

    const [rx, ry, rw, rh] = normRect.length === 4 ? normRect : [0, 0, 1, 0.58];
    const sx = Math.max(0, Math.round(rx * img.naturalWidth));
    const sy = Math.max(0, Math.round(ry * img.naturalHeight));
    const sw = Math.max(10, Math.min(img.naturalWidth - sx, Math.round(rw * img.naturalWidth)));
    const sh = Math.max(10, Math.min(img.naturalHeight - sy, Math.round(rh * img.naturalHeight)));

    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return url;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    return canvas.toDataURL('image/jpeg', 0.9);
  } finally {
    if (typeof posterFileOrDataUrl !== 'string') {
      URL.revokeObjectURL(url);
    }
  }
}

export async function restoreProjectFromPoster(
  posterFile: File | null,
  manualCode: string,
  catalog: CatalogPaint[]
): Promise<PaintProject> {
  let rawCode = manualCode.trim();
  if (!rawCode && posterFile) {
    const detected = await detectQRFromImageFile(posterFile);
    if (detected) rawCode = detected;
  }
  if (!rawCode) {
    throw new Error('未能从图片中识别到 gkm1: 二维码，请确认图片清晰或在下方粘贴 gkm1: 工程码');
  }

  const payload = await decodeQRPayloadString(rawCode);
  const croppedDataUrl = posterFile
    ? await cropPosterImage(posterFile, payload.r || [0, 0, 1, 0.58])
    : '';

  const nodes: FloatingSwatchNode[] = (payload.n || []).map((qn, idx) => {
    const resolved = lookupCatalogPaint(catalog, qn.b, qn.pid, qn.c);
    const pos = qn.pos || [0.3, 0.3, 0.05, 0.25];
    return {
      id: `node-${Date.now()}-${idx}`,
      anchorX: pos[0] ?? 0.3,
      anchorY: pos[1] ?? 0.3,
      offsetX: pos[2] ?? 0.05,
      offsetY: pos[3] ?? 0.25,
      paintBrand: resolved.brand,
      paintCode: resolved.code,
      paintName: resolved.name,
      hex: resolved.hex,
    };
  });

  const steps: PaintingStep[] = (payload.s || []).map((qs, idx) => {
    const preset = findStepPreset(qs.a);
    const actionCode = preset?.code || (qs.a.length === 2 ? qs.a : undefined);
    const actionText = qs.cn || preset?.defaultName || qs.a;
    const icon = qs.i || (preset ? (preset.lucideIcon || 'PaintBrushBroad') : 'PaintBrushBroad');

    const nozzle = qs.nz || preset?.defaultNozzle;
    const ratio = qs.rp || preset?.defaultRatio;
    const pressure = qs.mp || preset?.defaultPressure;
    const technique = qs.mt || preset?.defaultMethod || '薄喷 2 遍';

    return {
      id: `step-${Date.now()}-${idx}`,
      iconName: icon,
      actionText,
      actionCode,
      paintID: qs.pid,
      ratioAndPressure: buildStepParams(ratio || '无', pressure || '无', technique, nozzle || '无'),
      nozzle,
    };
  });

  const now = Date.now();
  const part: PartCanvas = {
    id: `part-${now}`,
    partName: payload.p || '导入零件 1',
    sourceImageDataUrl: croppedDataUrl,
    nodes,
    steps,
    createdAt: now,
  };

  const coverThumbnail = croppedDataUrl ? await createCoverThumbnail(croppedDataUrl) : undefined;

  return {
    id: `proj-${now}`,
    title: payload.t || '扫码导入工程',
    coverImageDataUrl: coverThumbnail,
    createdAt: now,
    updatedAt: now,
    parts: [part],
  };
}

// ==========================================
// Project Cover Helpers (Multi-level dynamic fallback & Downsampling)
// ==========================================

export function getEffectiveProjectCover(project: PaintProject): string | undefined {
  if (isValidImageSrc(project.customCoverImageDataUrl)) {
    return project.customCoverImageDataUrl;
  }
  for (const p of project.parts) {
    const resolved = resolvePartImageSrc(p);
    if (resolved) return resolved;
  }
  if (isValidImageSrc(project.coverImageDataUrl)) {
    return project.coverImageDataUrl;
  }
  return undefined;
}

export async function createCoverThumbnail(
  dataUrl: string,
  maxDim = 500,
  quality = 0.8
): Promise<string> {
  if (!dataUrl) return dataUrl;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let { width, height } = img;
      if (width <= 0 || height <= 0) {
        resolve(dataUrl);
        return;
      }
      const ratio = Math.min(maxDim / width, maxDim / height, 1);
      const targetW = Math.round(width * ratio);
      const targetH = Math.round(height * ratio);

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, targetW, targetH);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// ==========================================
// .gkmix v2 Archive Export & Import (100% iOS Compatible)
// ==========================================

function dataUrlToBase64Bytes(dataUrl: string): string {
  const comma = dataUrl.indexOf(',');
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

export async function exportGKMixArchive(project: PaintProject): Promise<void> {
  const archiveParts: GKMixArchivePart[] = project.parts.map((part) => {
    const qrPayload = buildQRSharePayload(project.title, part);
    return {
      partName: part.partName,
      cleanSourceImageData: dataUrlToBase64Bytes(part.sourceImageDataUrl),
      nodes: qrPayload.n,
      steps: qrPayload.s,
    };
  });

  const archive: GKMixArchivePayload = {
    version: 2,
    projectTitle: project.title,
    createdAt: Math.floor(project.createdAt / 1000),
    parts: archiveParts,
    customCoverData: project.customCoverImageDataUrl
      ? dataUrlToBase64Bytes(project.customCoverImageDataUrl)
      : undefined,
    partsChecklist: project.partsChecklist,
  };

  const jsonStr = JSON.stringify(archive);
  const compressed = await compressDeflateRaw(jsonStr);
  const blob = new Blob([compressed as unknown as BlobPart], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeTitle = (project.title || 'GKMixer-Project').replace(/[\\/:*?"<>|]/g, '_');
  link.href = url;
  link.download = `${safeTitle}.gkmix`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export async function importGKMixArchive(
  file: File,
  catalog: CatalogPaint[]
): Promise<PaintProject> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const jsonStr = await decompressDeflateAny(bytes);
  const archive = JSON.parse(jsonStr) as GKMixArchivePayload;

  const now = Date.now();
  const parts: PartCanvas[] = (archive.parts || []).map((ap, pIdx) => {
    const rawB64 = ap.cleanSourceImageData || '';
    const sourceImageDataUrl = rawB64.startsWith('data:')
      ? rawB64
      : `data:image/jpeg;base64,${rawB64}`;

    const nodes: FloatingSwatchNode[] = (ap.nodes || []).map((qn, nIdx) => {
      const resolved = lookupCatalogPaint(catalog, qn.b, qn.pid, qn.c);
      const pos = qn.pos || [0.3, 0.3, 0.05, 0.25];
      return {
        id: `node-${now}-${pIdx}-${nIdx}`,
        anchorX: pos[0] ?? 0.3,
        anchorY: pos[1] ?? 0.3,
        offsetX: pos[2] ?? 0.05,
        offsetY: pos[3] ?? 0.25,
        paintBrand: resolved.brand,
        paintCode: resolved.code,
        paintName: resolved.name,
        hex: resolved.hex,
      };
    });

    const steps: PaintingStep[] = (ap.steps || []).map((qs, sIdx) => {
      const preset = findStepPreset(qs.a);
      const actionCode = preset?.code || (qs.a.length === 2 ? qs.a : undefined);
      const actionText = qs.cn || preset?.defaultName || qs.a;
      const icon = qs.i || (preset ? (preset.lucideIcon || 'PaintBrushBroad') : 'PaintBrushBroad');

      const nozzle = qs.nz || preset?.defaultNozzle;
      const ratio = qs.rp || preset?.defaultRatio;
      const pressure = qs.mp || preset?.defaultPressure;
      const technique = qs.mt || preset?.defaultMethod || '薄喷 2 遍';

      return {
        id: `step-${now}-${pIdx}-${sIdx}`,
        iconName: icon,
        actionText,
        actionCode,
        paintID: qs.pid,
        ratioAndPressure: buildStepParams(ratio || '无', pressure || '无', technique, nozzle || '无'),
        nozzle,
      };
    });

    return {
      id: `part-${now}-${pIdx}`,
      partName: ap.partName || `零件 ${pIdx + 1}`,
      sourceImageDataUrl,
      nodes,
      steps,
      createdAt: now + pIdx,
    };
  });

  let customCoverUrl: string | undefined = undefined;
  if (archive.customCoverData) {
    const raw = archive.customCoverData;
    customCoverUrl = raw.startsWith('data:') ? raw : `data:image/jpeg;base64,${raw}`;
  }

  const effectiveCover = customCoverUrl || parts.find((p) => Boolean(p.sourceImageDataUrl))?.sourceImageDataUrl;
  const coverThumbnail = effectiveCover ? await createCoverThumbnail(effectiveCover) : undefined;

  return {
    id: `proj-${now}`,
    title: archive.projectTitle || file.name.replace(/\.gkmix$/i, '') || '导入涂装工程',
    coverImageDataUrl: coverThumbnail,
    customCoverImageDataUrl: customCoverUrl,
    createdAt: now,
    updatedAt: now,
    parts,
    partsChecklist: archive.partsChecklist,
  };
}
