import { RGB, CMYK, ColorData, PaintBrand } from '../types';
import * as mixbox from './mixbox';

// Helper to create unique IDs
export const generateId = (): string => Math.random().toString(36).substr(2, 9);

export const hexToRgb = (hex: string): RGB => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
};

export const rgbToHex = (r: number, g: number, b: number): string => {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
};

export const rgbToCmyk = (r: number, g: number, b: number): CMYK => {
  let c = 0;
  let m = 0;
  let y = 0;
  let k = 0;

  r = r / 255;
  g = g / 255;
  b = b / 255;

  k = Math.min(1 - r, 1 - g, 1 - b);
  if (k === 1) {
    return { c: 0, m: 0, y: 0, k: 100 };
  }
  
  c = (1 - r - k) / (1 - k);
  m = (1 - g - k) / (1 - k);
  y = (1 - b - k) / (1 - k);

  return {
    c: Math.round(c * 100),
    m: Math.round(m * 100),
    y: Math.round(y * 100),
    k: Math.round(k * 100)
  };
};

export const getContrastColor = (hex: string): string => {
  const rgb = hexToRgb(hex);
  // YIQ equation
  const yiq = ((rgb.r * 299) + (rgb.g * 587) + (rgb.b * 114)) / 1000;
  return yiq >= 128 ? '#000000' : '#FFFFFF';
};

// Simple Euclidean distance for color matching (for speed)
export const getColorDistance = (c1: RGB, c2: RGB): number => {
  return Math.sqrt(
    Math.pow(c1.r - c2.r, 2) +
    Math.pow(c1.g - c2.g, 2) +
    Math.pow(c1.b - c2.b, 2)
  );
};

// Mock Database of common GK paints
// GAIA paint database (localized names are stored in `name` as Chinese names)
export const GAIA_PAINTS: PaintBrand[] = [
  { id: 'gaia-001', brand: 'Gaia', code: '001', name: '光泽白', hex: '#FFFFFF' },
  { id: 'gaia-002', brand: 'Gaia', code: '002', name: '光泽黑', hex: '#000000' },
  { id: 'gaia-003', brand: 'Gaia', code: '003', name: '光泽红', hex: '#E60012' },
  { id: 'gaia-004', brand: 'Gaia', code: '004', name: '光泽蓝', hex: '#004098' },
  { id: 'gaia-005', brand: 'Gaia', code: '005', name: '光泽黄', hex: '#FFD900' },
  { id: 'gaia-006', brand: 'Gaia', code: '006', name: '消光添加剂', hex: '#F0F0F0' },
  { id: 'gaia-007', brand: 'Gaia', code: '007', name: '透明光泽', hex: '#E0E0E0' },
  { id: 'gaia-008', brand: 'Gaia', code: '008', name: '透明消光', hex: '#D6D6D6' },
  { id: 'gaia-009', brand: 'Gaia', code: '009', name: '亮银', hex: '#C0C0C0' },
  { id: 'gaia-010', brand: 'Gaia', code: '010', name: '亮金', hex: '#FFD700' },
  { id: 'gaia-011', brand: 'Gaia', code: '011', name: '消光白', hex: '#F5F5F5' },
  { id: 'gaia-012', brand: 'Gaia', code: '012', name: '消光黑', hex: '#1A1A1A' },
  { id: 'gaia-013', brand: 'Gaia', code: '013', name: '浓绿 (光泽)', hex: '#006400' },
  { id: 'gaia-014', brand: 'Gaia', code: '014', name: '红褐 (光泽)', hex: '#8B4513' },
  { id: 'gaia-015', brand: 'Gaia', code: '015', name: '橙色 (光泽)', hex: '#FF8C00' },
  { id: 'gaia-016', brand: 'Gaia', code: '016', name: '粉色 (光泽)', hex: '#FF69B4' },
  { id: 'gaia-017', brand: 'Gaia', code: '017', name: '紫罗兰 (光泽)', hex: '#8A2BE2' },
  { id: 'gaia-018', brand: 'Gaia', code: '018', name: '宝绿 (光泽)', hex: '#50C878' },
  { id: 'gaia-019', brand: 'Gaia', code: '019', name: '薰衣草紫 (光泽)', hex: '#E6E6FA' },
  { id: 'gaia-020', brand: 'Gaia', code: '020', name: '金属黑', hex: '#2F353B' },
  { id: 'gaia-021', brand: 'Gaia', code: '021', name: '半光泽白', hex: '#F8F8FF' },
  { id: 'gaia-022', brand: 'Gaia', code: '022', name: '半光泽黑', hex: '#0D0D0D' },
  { id: 'gaia-023', brand: 'Gaia', code: '023', name: '猩红', hex: '#FF2400' },
  { id: 'gaia-024', brand: 'Gaia', code: '024', name: '钴蓝', hex: '#0047AB' },
  { id: 'gaia-025', brand: 'Gaia', code: '025', name: '橙黄色', hex: '#FFB347' },
  { id: 'gaia-026', brand: 'Gaia', code: '026', name: '浅绿', hex: '#90EE90' },
  { id: 'gaia-027', brand: 'Gaia', code: '027', name: '深绿', hex: '#013220' },
  { id: 'gaia-028', brand: 'Gaia', code: '028', name: '石绿', hex: '#556B2F' },
  { id: 'gaia-030', brand: 'Gaia', code: '030', name: '半光泽添加剂', hex: '#EBEBEB' },
  { id: 'gaia-031', brand: 'Gaia', code: '031', name: '纯白', hex: '#FEFEFE' },
  { id: 'gaia-032', brand: 'Gaia', code: '032', name: '纯黑', hex: '#050505' },
  { id: 'gaia-033', brand: 'Gaia', code: '033', name: '纯蓝', hex: '#00B7EB' },
  { id: 'gaia-034', brand: 'Gaia', code: '034', name: '纯红', hex: '#FF00FF' },
  { id: 'gaia-035', brand: 'Gaia', code: '035', name: '纯黄', hex: '#FFFF33' },
  { id: 'gaia-036', brand: 'Gaia', code: '036', name: '纯绿', hex: '#00FF00' },
  { id: 'gaia-037', brand: 'Gaia', code: '037', name: '光泽紫罗兰', hex: '#9400D3' },
  { id: 'gaia-041', brand: 'Gaia', code: '041', name: '光泽透明红', hex: '#CC0000' },
  { id: 'gaia-042', brand: 'Gaia', code: '042', name: '光泽透明橙', hex: '#FF8000' },
  { id: 'gaia-043', brand: 'Gaia', code: '043', name: '光泽透明黑', hex: '#333333' },
  { id: 'gaia-044', brand: 'Gaia', code: '044', name: '光泽透明蓝', hex: '#0000CC' },
  { id: 'gaia-045', brand: 'Gaia', code: '045', name: '光泽透明黄', hex: '#FFFF00' },
  { id: 'gaia-046', brand: 'Gaia', code: '046', name: '光泽透明褐', hex: '#8B4513' },
  { id: 'gaia-047', brand: 'Gaia', code: '047', name: '光泽透明紫', hex: '#800080' },
  { id: 'gaia-048', brand: 'Gaia', code: '048', name: '光泽透明绿', hex: '#008000' },
  { id: 'gaia-049', brand: 'Gaia', code: '049', name: '光泽透明粉', hex: '#FFC0CB' },
  { id: 'gaia-050', brand: 'Gaia', code: '050', name: '光泽透明白', hex: '#F8F8FF' },
  { id: 'gaia-051', brand: 'Gaia', code: '051', name: '肌肤色', hex: '#FFDAB9' },
  { id: 'gaia-052', brand: 'Gaia', code: '052', name: '肌肤白色', hex: '#FFF5EE' },
  { id: 'gaia-053', brand: 'Gaia', code: '053', name: '肌肤粉色', hex: '#FFC1C1' },
  { id: 'gaia-054', brand: 'Gaia', code: '054', name: '肌肤橙色', hex: '#FFCC99' },
  { id: 'gaia-059', brand: 'Gaia', code: '059', name: '透明肌肤粉', hex: '#FFCCCC' },
  { id: 'gaia-060', brand: 'Gaia', code: '060', name: '透明肌肤橙', hex: '#FFD1B3' },
  { id: 'gaia-061', brand: 'Gaia', code: '061', name: '午夜蓝', hex: '#191970' },
  { id: 'gaia-062', brand: 'Gaia', code: '062', name: '中蓝', hex: '#7B68EE' },
  { id: 'gaia-063', brand: 'Gaia', code: '063', name: '蓝灰色', hex: '#6699CC' },
  { id: 'gaia-071', brand: 'Gaia', code: '071', name: '中间灰 I', hex: '#E8E8E8' },
  { id: 'gaia-072', brand: 'Gaia', code: '072', name: '中间灰 II', hex: '#C0C0C0' },
  { id: 'gaia-073', brand: 'Gaia', code: '073', name: '中间灰 III', hex: '#909090' },
  { id: 'gaia-074', brand: 'Gaia', code: '074', name: '中间灰 IV', hex: '#606060' },
  { id: 'gaia-075', brand: 'Gaia', code: '075', name: '中间灰 V', hex: '#303030' },
  { id: 'gaia-101', brand: 'Gaia', code: '101', name: '荧光蓝', hex: '#00FFFF' },
  { id: 'gaia-102', brand: 'Gaia', code: '102', name: '荧光粉', hex: '#FF1493' },
  { id: 'gaia-103', brand: 'Gaia', code: '103', name: '荧光红', hex: '#FF0000' },
  { id: 'gaia-104', brand: 'Gaia', code: '104', name: '荧光绿', hex: '#39FF14' },
  { id: 'gaia-105', brand: 'Gaia', code: '105', name: '荧光黄', hex: '#CCFF00' },
  { id: 'gaia-106', brand: 'Gaia', code: '106', name: '荧光橙', hex: '#FF4500' },
  { id: 'gaia-107', brand: 'Gaia', code: '107', name: '荧光黄绿', hex: '#ADFF2F' },
  { id: 'gaia-108', brand: 'Gaia', code: '108', name: '荧光蓝绿', hex: '#00FF7F' },
  { id: 'gaia-110', brand: 'Gaia', code: '110', name: '荧光透明', hex: '#F0F8FF' },
  { id: 'gaia-121', brand: 'Gaia', code: '121', name: '星光银', hex: '#C5C5C5' },
  { id: 'gaia-122', brand: 'Gaia', code: '122', name: '星光金', hex: '#E5C100' },
  { id: 'gaia-123', brand: 'Gaia', code: '123', name: '星光铝', hex: '#A9A9A9' },
  { id: 'gaia-124', brand: 'Gaia', code: '124', name: '星光铜', hex: '#B87333' },
  { id: 'gaia-125', brand: 'Gaia', code: '125', name: '星光铁', hex: '#434B4D' },
  { id: 'gaia-131', brand: 'Gaia', code: '131', name: '珍珠银', hex: '#E0E0E0' },
  { id: 'gaia-132', brand: 'Gaia', code: '132', name: '珍珠金', hex: '#FFF8DC' },
  { id: 'gaia-133', brand: 'Gaia', code: '133', name: '珍珠铜', hex: '#CD7F32' },
  { id: 'gaia-134', brand: 'Gaia', code: '134', name: '棱镜紫绿', hex: '#9370DB' },
  { id: 'gaia-135', brand: 'Gaia', code: '135', name: '棱镜蓝绿', hex: '#20B2AA' },
  { id: 'gaia-136', brand: 'Gaia', code: '136', name: '棱镜红金', hex: '#DA70D6' },
  { id: 'gaia-201', brand: 'Gaia', code: '201', name: '暗黄色 1', hex: '#BDB76B' },
  { id: 'gaia-202', brand: 'Gaia', code: '202', name: '德国迷彩绿', hex: '#556B2F' },
  { id: 'gaia-203', brand: 'Gaia', code: '203', name: '德国迷彩褐', hex: '#8B4513' },
  { id: 'gaia-204', brand: 'Gaia', code: '204', name: '暗黄色 2', hex: '#EEE8AA' },
  { id: 'gaia-221', brand: 'Gaia', code: '221', name: '德国灰色', hex: '#4D4D4D' },
  { id: 'gaia-222', brand: 'Gaia', code: '222', name: '铁锈红色', hex: '#800000' },
  { id: 'gaia-223', brand: 'Gaia', code: '223', name: '战车内构色', hex: '#F5DEB3' },
  { id: 'gaia-EX01', brand: 'Gaia', code: 'EX01', name: '光泽白 (大瓶)', hex: '#FFFFFF' },
  { id: 'gaia-EX02', brand: 'Gaia', code: 'EX02', name: '光泽黑 (大瓶)', hex: '#000000' },
  { id: 'gaia-EX03', brand: 'Gaia', code: 'EX03', name: '光泽透明 (大瓶)', hex: '#E0E0E0' },
  { id: 'gaia-EX04', brand: 'Gaia', code: 'EX04', name: '消光透明 (大瓶)', hex: '#D6D6D6' },
  { id: 'gaia-EX07', brand: 'Gaia', code: 'EX07', name: '星光银 (大瓶)', hex: '#C0C0C0' },
  { id: 'gaia-EX08', brand: 'Gaia', code: 'EX08', name: '星光金 (大瓶)', hex: '#FFD700' },
  { id: 'gaia-GP-01', brand: 'Gaia', code: 'GP-01', name: '海洋蓝', hex: '#120A8F' },
  { id: 'gaia-GP-02', brand: 'Gaia', code: 'GP-02', name: '魔幻红', hex: '#D9001B' },
  { id: 'gaia-GP-02p', brand: 'Gaia', code: 'GP-02p', name: '超级珍珠红', hex: '#DC143C' },
  { id: 'gaia-GP-03', brand: 'Gaia', code: 'GP-03', name: '海洋深蓝 2', hex: '#000080' },
  { id: 'gaia-GP-04', brand: 'Gaia', code: 'GP-04', name: '星光珍珠白', hex: '#F0F8FF' },
  { id: 'gaia-GP-05', brand: 'Gaia', code: 'GP-05', name: '超级海洋蓝', hex: '#0047AB' },
  { id: 'gaia-GP-05p', brand: 'Gaia', code: 'GP-05p', name: '超级珍珠蓝', hex: '#4169E1' },
  { id: 'gaia-GP-06', brand: 'Gaia', code: 'GP-06', name: '透明海洋蓝', hex: '#0000CD' },
  { id: 'gaia-GP-07', brand: 'Gaia', code: 'GP-07', name: '高级电镀银', hex: '#DCDCDC' },
  { id: 'gaia-GP-08', brand: 'Gaia', code: 'GP-08', name: '镜面电镀银', hex: '#E3E4E5' },
  { id: 'gaia-GP-09', brand: 'Gaia', code: 'GP-09', name: '棱镜蓝黑', hex: '#0A0A1A' },
  { id: 'gaia-NC001', brand: 'Gaia', code: 'NC001', name: '钢白', hex: '#E6E6FA' },
  { id: 'gaia-NC002', brand: 'Gaia', code: 'NC002', name: '冰霜黑', hex: '#2C2C2C' },
  { id: 'gaia-NC003', brand: 'Gaia', code: 'NC003', name: '火焰红', hex: '#FF4500' },
  { id: 'gaia-NC004', brand: 'Gaia', code: 'NC004', name: '万蓝色', hex: '#6495ED' },
  { id: 'gaia-NC005', brand: 'Gaia', code: 'NC005', name: '浅暖灰', hex: '#D3D3D3' },
  { id: 'gaia-NC006', brand: 'Gaia', code: 'NC006', name: '蓝雾白', hex: '#F0F8FF' },
  { id: 'gaia-NC007', brand: 'Gaia', code: 'NC007', name: '关节灰', hex: '#708090' },
  { id: 'gaia-VO-01', brand: 'Gaia', code: 'VO-01', name: '暖白', hex: '#FDF5E6' },
  { id: 'gaia-VO-02', brand: 'Gaia', code: 'VO-02', name: '冰钴蓝', hex: '#0047AB' },
  { id: 'gaia-VO-03', brand: 'Gaia', code: 'VO-03', name: '鲜艳橙', hex: '#FF4500' },
  { id: 'gaia-VO-04', brand: 'Gaia', code: 'VO-04', name: '骨架金属色', hex: '#555555' },
  { id: 'gaia-EV-01', brand: 'Gaia', code: 'EV-01', name: 'EVA 紫', hex: '#6A5ACD' },
  { id: 'gaia-EV-02', brand: 'Gaia', code: 'EV-02', name: 'EVA 绿', hex: '#32CD32' },
  { id: 'gaia-EV-03', brand: 'Gaia', code: 'EV-03', name: 'EVA 黄', hex: '#FFD700' }
];

// Jumpwind/Jiangyu paint database
export const JUMPWIND_PAINTS: PaintBrand[] = [
  // NEO Basic Series (NO.xxx)
  { id: 'jw-NO-001', brand: 'Jumpwind', code: 'NO.001', name: '白色 / White', hex: '#FFFFFF' },
  { id: 'jw-NO-002', brand: 'Jumpwind', code: 'NO.002', name: '黑色 / Black', hex: '#000000' },
  { id: 'jw-NO-003', brand: 'Jumpwind', code: 'NO.003', name: '红色 / Red', hex: '#D81C26' },
  { id: 'jw-NO-004', brand: 'Jumpwind', code: 'NO.004', name: '黄色 / Yellow', hex: '#FFD200' },
  { id: 'jw-NO-005', brand: 'Jumpwind', code: 'NO.005', name: '蓝色 / Blue', hex: '#005BAC' },
  { id: 'jw-NO-006', brand: 'Jumpwind', code: 'NO.006', name: '绿色 / Green', hex: '#009140' },
  { id: 'jw-NO-007', brand: 'Jumpwind', code: 'NO.007', name: '橙色 / Orange', hex: '#F37021' },
  { id: 'jw-NO-008', brand: 'Jumpwind', code: 'NO.008', name: '紫色 / Purple', hex: '#6C3B95' },
  { id: 'jw-NO-009', brand: 'Jumpwind', code: 'NO.009', name: '棕色 / Brown', hex: '#8B4513' },
  { id: 'jw-NO-010', brand: 'Jumpwind', code: 'NO.010', name: '光泽透明 / Clear', hex: '#F2F2F2' },
  { id: 'jw-NO-011', brand: 'Jumpwind', code: 'NO.011', name: '半光透明 / Semi-gloss Clear', hex: '#E6E6E6' },
  { id: 'jw-NO-012', brand: 'Jumpwind', code: 'NO.012', name: '消光透明 / Matt Clear', hex: '#D9D9D9' },
  { id: 'jw-NO-017', brand: 'Jumpwind', code: 'NO.017', name: '桃红 / Pink', hex: '#F15A98' },
  { id: 'jw-NO-018', brand: 'Jumpwind', code: 'NO.018', name: '橙黄 / Orange Yellow', hex: '#FFAE00' },
  { id: 'jw-NO-019', brand: 'Jumpwind', code: 'NO.019', name: '天蓝 / Sky Blue', hex: '#00A0E9' },
  { id: 'jw-NO-020', brand: 'Jumpwind', code: 'NO.020', name: '中灰 / Neutral Grey', hex: '#808080' },
  { id: 'jw-NO-021', brand: 'Jumpwind', code: 'NO.021', name: '半光白 / Semi-gloss White', hex: '#FDFDFD' },
  { id: 'jw-NO-022', brand: 'Jumpwind', code: 'NO.022', name: '半光黑 / Semi-gloss Black', hex: '#141414' },
  { id: 'jw-NO-023', brand: 'Jumpwind', code: 'NO.023', name: '亮红 / Shine Red', hex: '#E60012' },
  { id: 'jw-NO-024', brand: 'Jumpwind', code: 'NO.024', name: '钴蓝 / Cobalt Blue', hex: '#0047AB' },
  { id: 'jw-NO-025', brand: 'Jumpwind', code: 'NO.025', name: '钴紫 / Cobalt Purple', hex: '#4B0082' },
  { id: 'jw-NO-026', brand: 'Jumpwind', code: 'NO.026', name: '橙红 / Orange Red', hex: '#FF4500' },
  { id: 'jw-NO-027', brand: 'Jumpwind', code: 'NO.027', name: '草绿 / Grass Green', hex: '#409D37' },
  { id: 'jw-NO-028', brand: 'Jumpwind', code: 'NO.028', name: '薰衣草紫 / Lavender', hex: '#B57EDC' },
  { id: 'jw-NO-029', brand: 'Jumpwind', code: 'NO.029', name: '木棕 / Wood Brown', hex: '#C19A6B' },
  { id: 'jw-NO-030', brand: 'Jumpwind', code: 'NO.030', name: '雪灰 / Snow Gray', hex: '#DCDCDC' },
  { id: 'jw-NO-031', brand: 'Jumpwind', code: 'NO.031', name: '消光白 / Matt White', hex: '#FAF9F6' },
  { id: 'jw-NO-032', brand: 'Jumpwind', code: 'NO.032', name: '消光黑 / Matt Black', hex: '#0F0F0F' },
  { id: 'jw-NO-033', brand: 'Jumpwind', code: 'NO.033', name: '舰底红 / Hull Red', hex: '#6C2E2E' },
  { id: 'jw-NO-034', brand: 'Jumpwind', code: 'NO.034', name: '海军蓝 / Navy Blue', hex: '#1F2F3E' },
  { id: 'jw-NO-035', brand: 'Jumpwind', code: 'NO.035', name: '沙黄 / Sandy Yellow', hex: '#C2B280' },
  { id: 'jw-NO-036', brand: 'Jumpwind', code: 'NO.036', name: '暗绿 / Dark Green', hex: '#013220' },
  { id: 'jw-NO-037', brand: 'Jumpwind', code: 'NO.037', name: '桃木红 / Mahogany', hex: '#4D2626' },
  { id: 'jw-NO-038', brand: 'Jumpwind', code: 'NO.038', name: '沙棕 / Sandy Brown', hex: '#C8AD7F' },
  { id: 'jw-NO-039', brand: 'Jumpwind', code: 'NO.039', name: '海鸥灰 / Gull Gray', hex: '#9EA2A2' },
  { id: 'jw-NO-040', brand: 'Jumpwind', code: 'NO.040', name: '德国灰 / German Gray', hex: '#4D5656' },
  // MEKA Series (MC.xxx)
  { id: 'jw-MC-51', brand: 'Jumpwind', code: 'MC.51', name: '冷白 / Cool White', hex: '#F0F8FF' },
  { id: 'jw-MC-52', brand: 'Jumpwind', code: 'MC.52', name: '明红 / Bright Red', hex: '#EE1C25' },
  { id: 'jw-MC-53', brand: 'Jumpwind', code: 'MC.53', name: '明黄 / Bright Yellow', hex: '#FFDD00' },
  { id: 'jw-MC-54', brand: 'Jumpwind', code: 'MC.54', name: '明蓝 / Bright Blue', hex: '#0055A4' },
  { id: 'jw-MC-55', brand: 'Jumpwind', code: 'MC.55', name: '冻绿 / Trick Green', hex: '#008F81' },
  { id: 'jw-MC-56', brand: 'Jumpwind', code: 'MC.56', name: '木槿紫 / Hibiscus Purple', hex: '#B088D0' },
  { id: 'jw-MC-57', brand: 'Jumpwind', code: 'MC.57', name: '砂岩红 / Malmstone Red', hex: '#E38676' },
  { id: 'jw-MC-58', brand: 'Jumpwind', code: 'MC.58', name: '波尔多红 / Bordeaux Red', hex: '#800020' },
  { id: 'jw-MC-59', brand: 'Jumpwind', code: 'MC.59', name: '幻影灰 / Phantom Gray', hex: '#3E424B' },
  { id: 'jw-MC-60', brand: 'Jumpwind', code: 'MC.60', name: '石绿 / Stone Green', hex: '#508B8D' },
  { id: 'jw-MC-61', brand: 'Jumpwind', code: 'MC.61', name: '沙白 / Sandy White', hex: '#E8E4C9' },
  { id: 'jw-MC-62', brand: 'Jumpwind', code: 'MC.62', name: '橄榄绿 / Olive Green', hex: '#808000' },
  { id: 'jw-MC-63', brand: 'Jumpwind', code: 'MC.63', name: '深橄榄绿 / Deep Olive Green', hex: '#556B2F' },
  { id: 'jw-MC-64', brand: 'Jumpwind', code: 'MC.64', name: '夜空蓝 / Night Blue', hex: '#191970' },
  { id: 'jw-MC-65', brand: 'Jumpwind', code: 'MC.65', name: '亮蓝 / Shine Blue', hex: '#4169E1' },
  { id: 'jw-MC-66', brand: 'Jumpwind', code: 'MC.66', name: '茜草红 / Madder Red', hex: '#E32636' },
  { id: 'jw-MC-67', brand: 'Jumpwind', code: 'MC.67', name: '冰钴蓝 / Ice Cobalt', hex: '#008ECC' },
  { id: 'jw-MC-68', brand: 'Jumpwind', code: 'MC.68', name: '翠绿 / Emerald Green', hex: '#50C878' },
  { id: 'jw-MC-69', brand: 'Jumpwind', code: 'MC.69', name: '珊瑚橙 / Coral Orange', hex: '#FF7F50' },
  { id: 'jw-MC-70', brand: 'Jumpwind', code: 'MC.70', name: '珊瑚粉 / Coral Pink', hex: '#F88379' },
  { id: 'jw-MC-71', brand: 'Jumpwind', code: 'MC.71', name: '绯红 / Scarlet Red', hex: '#FF2400' },
  { id: 'jw-MC-72', brand: 'Jumpwind', code: 'MC.72', name: '薄群青 / Light Ultramarine', hex: '#4D88FF' },
  { id: 'jw-MC-73', brand: 'Jumpwind', code: 'MC.73', name: '山吹橙 / Kerria Orange', hex: '#FFBF00' },
  { id: 'jw-MC-74', brand: 'Jumpwind', code: 'MC.74', name: '薄荷绿 / Mint Green', hex: '#98FF98' },
  { id: 'jw-MC-75', brand: 'Jumpwind', code: 'MC.75', name: '樱花粉 / Sakura Pink', hex: '#FFB7C5' },
  { id: 'jw-MC-76', brand: 'Jumpwind', code: 'MC.76', name: '酒红 / Wine Red', hex: '#722F37' },
  { id: 'jw-MC-77', brand: 'Jumpwind', code: 'MC.77', name: '栗红 / Chestnut Red', hex: '#954535' },
  { id: 'jw-MC-78', brand: 'Jumpwind', code: 'MC.78', name: '风暴蓝 / Storm Blue', hex: '#4682B4' },
  { id: 'jw-MC-79', brand: 'Jumpwind', code: 'MC.79', name: '风暴紫 / Storm Purple', hex: '#483D8B' },
  { id: 'jw-MC-80', brand: 'Jumpwind', code: 'MC.80', name: '风暴灰 / Storm Gray', hex: '#708090' },
  { id: 'jw-MC-81', brand: 'Jumpwind', code: 'MC.81', name: '幽灵白 / Ghost White', hex: '#F8F8FF' },
  { id: 'jw-MC-82', brand: 'Jumpwind', code: 'MC.82', name: '火焰红 / Flame Red', hex: '#FF4500' },
  { id: 'jw-MC-83', brand: 'Jumpwind', code: 'MC.83', name: '浅柑 / Light Orange', hex: '#FFB347' },
  { id: 'jw-MC-84', brand: 'Jumpwind', code: 'MC.84', name: '水蓝 / Aqua Blue', hex: '#00FFFF' },
  { id: 'jw-MC-85', brand: 'Jumpwind', code: 'MC.85', name: '卡其 / Khaki', hex: '#F0E68C' },
  { id: 'jw-MC-86', brand: 'Jumpwind', code: 'MC.86', name: '野莓红 / Berry Red', hex: '#C71585' },
  { id: 'jw-MC-87', brand: 'Jumpwind', code: 'MC.87', name: '野莓紫 / Berry Purple', hex: '#800080' },
  { id: 'jw-MC-88', brand: 'Jumpwind', code: 'MC.88', name: '樱草黄 / Primrose Yellow', hex: '#FDE910' },
  { id: 'jw-MC-89', brand: 'Jumpwind', code: 'MC.89', name: '火山灰 / Volcanic Ash', hex: '#737C82' },
  { id: 'jw-MC-90', brand: 'Jumpwind', code: 'MC.90', name: '野蕨绿 / Fern Green', hex: '#4F7942' },
  { id: 'jw-MC-91', brand: 'Jumpwind', code: 'MC.91', name: '装备白 / Device White', hex: '#F5F5F5' },
  { id: 'jw-MC-92', brand: 'Jumpwind', code: 'MC.92', name: '装备黄 / Device Yellow', hex: '#E3DFA6' },
  { id: 'jw-MC-93', brand: 'Jumpwind', code: 'MC.93', name: '装备灰 / Device Gray', hex: '#A9A9A9' },
  { id: 'jw-MC-94', brand: 'Jumpwind', code: 'MC.94', name: '装备蓝 / Device Blue', hex: '#ADD8E6' },
  { id: 'jw-MC-95', brand: 'Jumpwind', code: 'MC.95', name: '内构灰 / Structure Gray', hex: '#696969' },
  { id: 'jw-MC-96', brand: 'Jumpwind', code: 'MC.96', name: '太空白 / Space White', hex: '#EFEFEF' },
  { id: 'jw-MC-97', brand: 'Jumpwind', code: 'MC.97', name: '制空蓝 / Air Superiority Blue', hex: '#72A0C1' },
  { id: 'jw-MC-98', brand: 'Jumpwind', code: 'MC.98', name: '雾霾蓝 / Haze Blue', hex: '#5F7686' },
  { id: 'jw-MC-99', brand: 'Jumpwind', code: 'MC.99', name: '暗夜紫 / Dark Night Purple', hex: '#3A243B' },
  { id: 'jw-MC-100', brand: 'Jumpwind', code: 'MC.100', name: '午夜蓝 / Midnight Blue', hex: '#191970' }
];

// Gunze paint database
export const GUNZE_PAINTS: PaintBrand[] = [
  { id: 'gz-N-1', brand: 'Gunze', code: 'N-1', name: '白色 / White', hex: '#FFFFFF' },
  { id: 'gz-N-2', brand: 'Gunze', code: 'N-2', name: '黑色 / Black', hex: '#000000' },
  { id: 'gz-N-3', brand: 'Gunze', code: 'N-3', name: '红色 / Red', hex: '#E60012' },
  { id: 'gz-N-4', brand: 'Gunze', code: 'N-4', name: '黄色 / Yellow', hex: '#FFD700' },
  { id: 'gz-N-5', brand: 'Gunze', code: 'N-5', name: '蓝色 / Blue', hex: '#0047AB' },
  { id: 'gz-N-6', brand: 'Gunze', code: 'N-6', name: '绿色 / Green', hex: '#008000' },
  { id: 'gz-N-7', brand: 'Gunze', code: 'N-7', name: '棕色 / Brown', hex: '#8B4513' },
  { id: 'gz-N-8', brand: 'Gunze', code: 'N-8', name: '银色 / Silver', hex: '#C0C0C0' },
  { id: 'gz-N-9', brand: 'Gunze', code: 'N-9', name: '金色 / Gold', hex: '#FFD700' },
  { id: 'gz-N-10', brand: 'Gunze', code: 'N-10', name: '铜色 / Copper', hex: '#B87333' },
  { id: 'gz-N-11', brand: 'Gunze', code: 'N-11', name: '消光白色 / Flat White', hex: '#F5F5F5' },
  { id: 'gz-N-12', brand: 'Gunze', code: 'N-12', name: '消光黑色 / Flat Black', hex: '#1A1A1A' },
  { id: 'gz-N-13', brand: 'Gunze', code: 'N-13', name: '消光红色 / Flat Red', hex: '#CD5C5C' },
  { id: 'gz-N-14', brand: 'Gunze', code: 'N-14', name: '橙色 / Orange', hex: '#FFA500' },
  { id: 'gz-N-15', brand: 'Gunze', code: 'N-15', name: '亮蓝色 / Bright Blue', hex: '#1E90FF' },
  { id: 'gz-N-16', brand: 'Gunze', code: 'N-16', name: '黄绿色 / Yellow Green', hex: '#9ACD32' },
  { id: 'gz-N-17', brand: 'Gunze', code: 'N-17', name: '船底色 / Hull Red', hex: '#800000' },
  { id: 'gz-N-18', brand: 'Gunze', code: 'N-18', name: '黑铁色 / Black Iron', hex: '#2F353B' },
  { id: 'gz-N-19', brand: 'Gunze', code: 'N-19', name: '粉红色 / Pink', hex: '#FFC0CB' },
  { id: 'gz-N-20', brand: 'Gunze', code: 'N-20', name: '消光透明漆 / Flat Clear', hex: '#E8E8E8' },
  { id: 'gz-N-21', brand: 'Gunze', code: 'N-21', name: '米白色 / Beige', hex: '#FAF0E6' },
  { id: 'gz-N-22', brand: 'Gunze', code: 'N-22', name: '中灰色 / Neutral Grey', hex: '#808080' },
  { id: 'gz-N-23', brand: 'Gunze', code: 'N-23', name: '亮红色 / Bright Red', hex: '#FF2400' },
  { id: 'gz-N-24', brand: 'Gunze', code: 'N-24', name: '黄橙色 / Yellow Orange', hex: '#FFCC00' },
  { id: 'gz-N-25', brand: 'Gunze', code: 'N-25', name: '天蓝色 / Sky Blue', hex: '#87CEEB' },
  { id: 'gz-N-26', brand: 'Gunze', code: 'N-26', name: '亮绿色 / Bright Green', hex: '#228B22' },
  { id: 'gz-N-27', brand: 'Gunze', code: 'N-27', name: '木甲板色 / Wood Deck', hex: '#D2B48C' },
  { id: 'gz-N-28', brand: 'Gunze', code: 'N-28', name: '金属黑色 / Metallic Black', hex: '#2F2F2F' },
  { id: 'gz-N-30', brand: 'Gunze', code: 'N-30', name: '透明漆 / Clear', hex: '#FFFFFF' },
  { id: 'gz-N-32', brand: 'Gunze', code: 'N-32', name: '德国灰色 / German Grey', hex: '#4D4D4D' },
  { id: 'gz-N-33', brand: 'Gunze', code: 'N-33', name: '红褐色 / Red Brown', hex: '#80461B' },
  { id: 'gz-N-34', brand: 'Gunze', code: 'N-34', name: '奶黄色 / Cream Yellow', hex: '#FFFDD0' },
  { id: 'gz-N-35', brand: 'Gunze', code: 'N-35', name: '钴蓝色 / Cobalt Blue', hex: '#0047AB' },
  { id: 'gz-N-36', brand: 'Gunze', code: 'N-36', name: '暗绿色 (中岛) / Dark Green Nakajima', hex: '#124428' },
  { id: 'gz-N-37', brand: 'Gunze', code: 'N-37', name: '木棕色 / Wood Brown', hex: '#8B5A2B' },
  { id: 'gz-N-38', brand: 'Gunze', code: 'N-38', name: '铁红色 / Iron Red', hex: '#782F2F' },
  { id: 'gz-N-39', brand: 'Gunze', code: 'N-39', name: '紫色 / Purple', hex: '#800080' },
  { id: 'gz-N-40', brand: 'Gunze', code: 'N-40', name: '消光添加剂 / Flat Base', hex: '#D3D3D3' },
  { id: 'gz-N-43', brand: 'Gunze', code: 'N-43', name: '栗色 / Maroon', hex: '#800000' },
  { id: 'gz-N-44', brand: 'Gunze', code: 'N-44', name: '肌肤色 / Skin Tone', hex: '#FFDAB9' },
  { id: 'gz-N-45', brand: 'Gunze', code: 'N-45', name: '淡蓝色 / Light Blue', hex: '#ADD8E6' },
  { id: 'gz-N-46', brand: 'Gunze', code: 'N-46', name: '翡翠绿色 / Emerald Green', hex: '#50C878' },
  { id: 'gz-N-47', brand: 'Gunze', code: 'N-47', name: '红棕色 / Brown Red', hex: '#A52A2A' },
  { id: 'gz-N-49', brand: 'Gunze', code: 'N-49', name: '紫罗兰色 / Violet', hex: '#EE82EE' },
  { id: 'gz-N-50', brand: 'Gunze', code: 'N-50', name: '莱姆绿色 / Lime Green', hex: '#32CD32' },
  { id: 'gz-N-51', brand: 'Gunze', code: 'N-51', name: '海鸥灰色 / Gull Grey', hex: '#9EA2A2' },
  { id: 'gz-N-52', brand: 'Gunze', code: 'N-52', name: '橄榄绿 1 / Olive Green 1', hex: '#6B8E23' },
  { id: 'gz-N-54', brand: 'Gunze', code: 'N-54', name: '海军蓝色 / Navy Blue', hex: '#000080' },
  { id: 'gz-N-55', brand: 'Gunze', code: 'N-55', name: '午夜蓝色 / Midnight Blue', hex: '#191970' },
  { id: 'gz-N-56', brand: 'Gunze', code: 'N-56', name: '中蓝色 / Medium Blue', hex: '#5F9EA0' },
  { id: 'gz-N-57', brand: 'Gunze', code: 'N-57', name: '飞机灰色 / Aircraft Grey', hex: '#DCDCDC' },
  { id: 'gz-N-58', brand: 'Gunze', code: 'N-58', name: '机体内部色 / Interior Color', hex: '#A9BA9D' },
  { id: 'gz-N-60', brand: 'Gunze', code: 'N-60', name: '浓绿色 / Deep Green', hex: '#006400' },
  { id: 'gz-N-61', brand: 'Gunze', code: 'N-61', name: '明灰白 (三菱) / Light Grey Mitsubishi', hex: '#B0C4DE' },
  { id: 'gz-N-62', brand: 'Gunze', code: 'N-62', name: '明灰绿 (中岛) / Light Grey Green Nakajima', hex: '#A9A9A9' },
  { id: 'gz-N-63', brand: 'Gunze', code: 'N-63', name: '蓝绿色 / Blue Green', hex: '#0095B6' },
  { id: 'gz-N-66', brand: 'Gunze', code: 'N-66', name: 'RLM79 沙漠黄 / RLM79 Desert Yellow', hex: '#DEB887' },
  { id: 'gz-N-67', brand: 'Gunze', code: 'N-67', name: 'RLM65 浅蓝 / RLM65 Light Blue', hex: '#87CEEB' },
  { id: 'gz-N-68', brand: 'Gunze', code: 'N-68', name: 'RLM74 灰绿 / RLM74 Grey Green', hex: '#696969' },
  { id: 'gz-N-69', brand: 'Gunze', code: 'N-69', name: 'RLM75 灰紫 / RLM75 Grey Purple', hex: '#778899' },
  { id: 'gz-N-70', brand: 'Gunze', code: 'N-70', name: 'RLM02 灰 / RLM02 Grey', hex: '#808069' },
  { id: 'gz-N-71', brand: 'Gunze', code: 'N-71', name: '中石色 / Medium Stone', hex: '#BDB76B' },
  { id: 'gz-N-72', brand: 'Gunze', code: 'N-72', name: '暗土色 / Dark Earth', hex: '#554433' },
  { id: 'gz-N-73', brand: 'Gunze', code: 'N-73', name: '暗绿色 / Dark Green', hex: '#013220' },
  { id: 'gz-N-76', brand: 'Gunze', code: 'N-76', name: '烧铁色 / Burnt Iron', hex: '#454545' },
  { id: 'gz-N-77', brand: 'Gunze', code: 'N-77', name: '轮胎黑色 / Tire Black', hex: '#1C1C1C' },
  { id: 'gz-N-78', brand: 'Gunze', code: 'N-78', name: '橄榄绿 2 / Olive Green 2', hex: '#4B5320' },
  { id: 'gz-N-79', brand: 'Gunze', code: 'N-79', name: '暗黄色 / Dark Yellow', hex: '#C2B280' },
  { id: 'gz-N-80', brand: 'Gunze', code: 'N-80', name: '卡其绿色 / Khaki Green', hex: '#556B2F' },
  { id: 'gz-N-81', brand: 'Gunze', code: 'N-81', name: '卡其色 / Khaki', hex: '#F0E68C' },
  { id: 'gz-N-82', brand: 'Gunze', code: 'N-82', name: '军舰灰 1 / Warship Grey 1', hex: '#5A6369' },
  { id: 'gz-N-83', brand: 'Gunze', code: 'N-83', name: '军舰灰 2 / Warship Grey 2', hex: '#4F565C' },
  { id: 'gz-N-84', brand: 'Gunze', code: 'N-84', name: '红木色 / Red Wood', hex: '#C04040' },
  { id: 'gz-N-85', brand: 'Gunze', code: 'N-85', name: '帆布色 / Canvas', hex: '#F5F5DC' },
  { id: 'gz-N-86', brand: 'Gunze', code: 'N-86', name: '鲜红色 / Fresh Red', hex: '#FF0000' },
  { id: 'gz-N-87', brand: 'Gunze', code: 'N-87', name: '金属红色 / Metallic Red', hex: '#A30000' },
  { id: 'gz-N-88', brand: 'Gunze', code: 'N-88', name: '金属蓝色 / Metallic Blue', hex: '#4169E1' },
  { id: 'gz-N-89', brand: 'Gunze', code: 'N-89', name: '金属绿色 / Metallic Green', hex: '#2E8B57' },
  { id: 'gz-N-90', brand: 'Gunze', code: 'N-90', name: '透明红色 / Clear Red', hex: '#DC143C' },
  { id: 'gz-N-91', brand: 'Gunze', code: 'N-91', name: '透明黄色 / Clear Yellow', hex: '#FFFF00' },
  { id: 'gz-N-92', brand: 'Gunze', code: 'N-92', name: '透明橙色 / Clear Orange', hex: '#FFA500' },
  { id: 'gz-N-93', brand: 'Gunze', code: 'N-93', name: '透明蓝色 / Clear Blue', hex: '#0000FF' },
  { id: 'gz-N-94', brand: 'Gunze', code: 'N-94', name: '透明绿色 / Clear Green', hex: '#008000' },
  { id: 'gz-N-95', brand: 'Gunze', code: 'N-95', name: '烟灰色 / Smoke Grey', hex: '#696969' },
  { id: 'gz-N-97', brand: 'Gunze', code: 'N-97', name: '荧光黄色 / Fluorescent Yellow', hex: '#CCFF00' },
  { id: 'gz-N-98', brand: 'Gunze', code: 'N-98', name: '荧光橙色 / Fluorescent Orange', hex: '#FF6600' },
  { id: 'gz-N-99', brand: 'Gunze', code: 'N-99', name: '荧光粉红色 / Fluorescent Pink', hex: '#FF00CC' },
  { id: 'gz-N-100', brand: 'Gunze', code: 'N-100', name: '荧光绿色 / Fluorescent Green', hex: '#00FF00' },
  { id: 'gz-N-101', brand: 'Gunze', code: 'N-101', name: '荧光红色 / Fluorescent Red', hex: '#FF4500' },
  { id: 'gz-N-127', brand: 'Gunze', code: 'N-127', name: '座舱绿 (中岛) / Cockpit Green Nakajima', hex: '#8FBC8F' }
];

export const COMMON_PAINTS: PaintBrand[] = [
  { id: '1', brand: 'Mr.Hobby', code: 'C1', name: 'White', hex: '#FFFFFF' },
  { id: '2', brand: 'Mr.Hobby', code: 'C2', name: 'Black', hex: '#000000' },
  { id: '3', brand: 'Mr.Hobby', code: 'C3', name: 'Red', hex: '#E60012' },
  { id: '4', brand: 'Mr.Hobby', code: 'C4', name: 'Yellow', hex: '#FFF100' },
  { id: '5', brand: 'Mr.Hobby', code: 'C5', name: 'Blue', hex: '#00479D' },
  // Jumpwind / other brand examples
  { id: '9', brand: 'Jumpwind', code: 'JW01', name: 'Cold White', hex: '#F0F8FF' },
  { id: '10', brand: 'Jumpwind', code: 'JW02', name: 'Mechanic Grey', hex: '#708090' },
  // Merge GAIA paints into the common pool for matching purposes
  ...GAIA_PAINTS,
  ...JUMPWIND_PAINTS,
  ...GUNZE_PAINTS
];

export const findNearestPaints = (targetHex: string, count: number = 3): PaintBrand[] => {
  const targetRgb = hexToRgb(targetHex);
  const sorted = [...COMMON_PAINTS].sort((a, b) => {
    const distA = getColorDistance(targetRgb, hexToRgb(a.hex));
    const distB = getColorDistance(targetRgb, hexToRgb(b.hex));
    return distA - distB;
  });
  return sorted.slice(0, count);
};

export const extractProminentColors = (imgElement: HTMLImageElement, count: number = 5): Promise<ColorData[]> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return resolve([]);

    // Scale down for performance
    const scale = Math.min(1, 300 / Math.max(imgElement.naturalWidth, imgElement.naturalHeight));
    canvas.width = imgElement.naturalWidth * scale;
    canvas.height = imgElement.naturalHeight * scale;

    ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    const colorMap: Record<string, number> = {};

    // Sample every 10th pixel for speed
    for (let i = 0; i < data.length; i += 40) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a < 128) continue; // Skip transparent

      // Quantize colors to reduce noise (round to nearest 10)
      const qr = Math.round(r / 20) * 20;
      const qg = Math.round(g / 20) * 20;
      const qb = Math.round(b / 20) * 20;

      const hex = rgbToHex(qr, qg, qb);
      colorMap[hex] = (colorMap[hex] || 0) + 1;
    }

    const sortedHex = Object.entries(colorMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, count)
      .map(([hex]) => hex);

    const colors: ColorData[] = sortedHex.map(hex => {
      const rgb = hexToRgb(hex);
      return {
        id: generateId(),
        hex,
        rgb,
        cmyk: rgbToCmyk(rgb.r, rgb.g, rgb.b),
        source: 'auto'
      };
    });

    resolve(colors);
  });
};

/**
 * Mixbox Color Blending (Physical-Level Algorithm)
 * Uses Secret Weapons Mixbox algorithm for more realistic color mixing
 * 
 * Example: Blue (#0000FF) + Yellow (#FFFF00) at 50% = Green (not Gray)
 * This is physically accurate paint mixing, not optical mixing
 */
export const mixboxBlend = (color1Hex: string, color2Hex: string, t: number = 0.5): string => {
  const result = mixbox.lerp(color1Hex, color2Hex, t);
  if (result && result.length >= 3) {
    return rgbToHex(result[0], result[1], result[2]);
  }
  // Fallback to old algorithm if mixbox fails
  return opticalBlend(color1Hex, color2Hex, t);
};

/**
 * Optical-Level Blending (Fallback)
 * Simple RGB average - produces gray when mixing blue + yellow
 * Used for backward compatibility
 */
export const opticalBlend = (color1Hex: string, color2Hex: string, t: number = 0.5): string => {
  const c1 = hexToRgb(color1Hex);
  const c2 = hexToRgb(color2Hex);
  const r = Math.round(c1.r * (1 - t) + c2.r * t);
  const g = Math.round(c1.g * (1 - t) + c2.g * t);
  const b = Math.round(c1.b * (1 - t) + c2.b * t);
  return rgbToHex(r, g, b);
};
