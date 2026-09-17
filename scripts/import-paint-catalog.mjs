#!/usr/bin/env node
/**
 * Builds PaintCatalog.json for the iOS app.
 *
 * Sources:
 * - Local Gaia / Jumpwind / Gunze tables in colorUtils.ts
 * - Arcturus5404/miniature-paints (MIT) markdown swatches
 * - afzafri/modkit-swatch (MIT) gunpla lacquer table (Jumpwind Basic/Aqueous,
 *   extra Gaia, Hobby Mio, Sunin7, QNC; existing codes keep first-seen hex)
 * - seotaro/tamiya-list Japanese names (code overlay only; hex stays upstream)
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CACHE = path.join(__dirname, ".cache", "miniature-paints");
const MODKIT_CACHE = path.join(__dirname, ".cache", "modkit-swatch", "paints.json");
const OUT_DIR = path.join(ROOT, "GK-Mixer", "GK-Mixer", "Resources");

const PAINTS_API =
  "https://api.github.com/repos/Arcturus5404/miniature-paints/contents/paints";
const PAINTS_RAW =
  "https://raw.githubusercontent.com/Arcturus5404/miniature-paints/main/paints/";
const MODKIT_PAINTS_URL =
  "https://raw.githubusercontent.com/afzafri/modkit-swatch/main/data/paints.json";
const TAMIYA_LIST_FILES = [
  "https://raw.githubusercontent.com/seotaro/tamiya-list/main/list-acrylic-paint-mini.json",
  "https://raw.githubusercontent.com/seotaro/tamiya-list/main/list-enamel-paint.json",
  "https://raw.githubusercontent.com/seotaro/tamiya-list/main/list-lacquer-paint.json",
];

const SKIP_FILES = new Set(["RAL.md", "Pantone.md"]);
const SKIP_BRANDS = new Set([
  "corfix",
  "talento",
  "daiara",
  "silverbright",
  "true colors",
  "truecolours",
  "smooth3d",
  "ral",
  "pantone",
]);

const BRAND_ALIASES = {
  "mr hobby": "Mr.Hobby",
  mrhobby: "Mr.Hobby",
  "citadel colour": "Citadel",
  "citadel classic": "Citadel Classic",
  "army painter": "Army Painter",
  "green stuff world": "Green Stuff World",
  "mission models": "Mission Models",
  "kimera kolors": "Kimera Kolors",
  "coat d armes": "Coat d'Armes",
  "coat d'armes": "Coat d'Armes",
  akrc: "AK Real Colors",
  "a k r c": "AK Real Colors",
  "ak real colors": "AK Real Colors",
  gaianotes: "Gaia",
  "gaia notes": "Gaia",
  "mr color": "Mr.Hobby",
  "mr. color": "Mr.Hobby",
};

const headers = {
  "User-Agent": "gk-mixer-paint-catalog-import",
  Accept: "application/vnd.github+json",
};

const rgbToLab = (r, g, b) => {
  const linearize = (channel) => {
    const c = channel / 255;
    return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92;
  };
  const rLin = linearize(r);
  const gLin = linearize(g);
  const bLin = linearize(b);
  const x = (rLin * 0.4124564 + gLin * 0.3575761 + bLin * 0.1804375) * 100;
  const y = (rLin * 0.2126729 + gLin * 0.7151522 + bLin * 0.072175) * 100;
  const z = (rLin * 0.0193339 + gLin * 0.119192 + bLin * 0.9503041) * 100;
  const labF = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const xN = labF(x / 95.047);
  const yN = labF(y / 100);
  const zN = labF(z / 108.883);
  return [
    round4(116 * yN - 16),
    round4(500 * (xN - yN)),
    round4(200 * (yN - zN)),
  ];
};

const hexToRgb = (hex) => {
  const cleaned = hex.replace("#", "");
  return {
    r: parseInt(cleaned.slice(0, 2), 16),
    g: parseInt(cleaned.slice(2, 4), 16),
    b: parseInt(cleaned.slice(4, 6), 16),
  };
};

const round4 = (n) => Math.round(n * 10000) / 10000;

const slug = (value) =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "x";

const normalizeBrand = (raw) => {
  const key = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ");
  return BRAND_ALIASES[key] || String(raw).trim();
};

const inferFinish = ({ name, set, type, finish, code }) => {
  const blob = `${name} ${set} ${type} ${finish || ""} ${code || ""}`.toLowerCase();
  const zh = `${name} ${set}`;
  if (/\b(wash|shade|contrast|ink|filter|glaze)\b/.test(blob)) return "wash";
  if (/\bhyper\b/.test(blob) || /超级[黑白]/.test(zh)) return "hyper";
  if (
    finish === "fluorescent" ||
    /\bfluorescent\b/.test(blob) ||
    /荧光|螢光|蛍光/.test(zh)
  ) {
    return "fluorescent";
  }
  if (/extra metal|jwem/.test(blob)) return "extraMetal";
  if (/prime metal|\bpm\d/.test(blob)) return "primeMetal";
  if (finish === "pearl" || /\bpearl\b/.test(blob) || /珍珠/.test(zh)) {
    return "pearl";
  }
  if (
    finish === "clear" ||
    /\b(clear|transparent)\b/.test(blob) ||
    /透明/.test(zh)
  ) {
    return "clear";
  }
  if (
    finish === "metallic" ||
    type === "metallic" ||
    /\b(metallic|metal color|mr metal|chrome|gold leaf|starbright|metal)\b/.test(
      blob
    ) ||
    /金属|星光|电镀|メタリック/.test(zh)
  ) {
    return "metallic";
  }
  if (/\b(technical|thinner|primer)\b/.test(blob) || /添加剂/.test(zh)) {
    return "other";
  }
  if (type === "ink" || type === "wash" || type === "other") {
    return type;
  }
  return "standard";
};

const isMixableFinish = (finish) =>
  finish === "standard" ||
  finish === "metallic" ||
  finish === "wash" ||
  finish === "ink";


const extractHex = (cell) => {
  const match = String(cell).match(/#([0-9A-Fa-f]{6})/);
  return match ? `#${match[1].toUpperCase()}` : null;
};

const splitRow = (line) =>
  line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());

const isDivider = (line) => /^\|[\s|:-]+\|$/.test(line.trim());

const formatMrHobbyCode = (code, set) => {
  const trimmed = String(code || "").trim();
  if (!trimmed) return "";
  if (/^mr color$/i.test(set) && /^\d+[A-Za-z]?$/.test(trimmed)) {
    return `C${trimmed}`;
  }
  return trimmed;
};

const normalizeCode = (brand, raw) => {
  const code = String(raw || "").trim();
  if (!code) return "";
  if (brand === "Jumpwind") {
    const compact = code.toUpperCase().replace(/\s+/g, "");
    let match = compact.match(/^MC\.?(\d+)$/);
    if (match) return `MC.${Number(match[1])}`;
    match = compact.match(/^NO\.?(\d+)$/);
    if (match) return `NO.${String(Number(match[1])).padStart(3, "0")}`;
    match = compact.match(/^JW-?A(\d+)$/);
    if (match) return `JW-A${String(Number(match[1])).padStart(2, "0")}`;
    match = compact.match(/^JW-?(\d+)$/);
    if (match) return `JW-${String(Number(match[1])).padStart(3, "0")}`;
    return compact;
  }
  if (brand === "Gaia") {
    const compact = code.replace(/\s+/g, "");
    const ex = compact.match(/^ex-?(\d+)$/i);
    if (ex) return `EX${String(Number(ex[1])).padStart(2, "0")}`;
    return compact;
  }
  if (brand === "Mr.Hobby") {
    const compact = code.toUpperCase().replace(/\s+/g, "");
    if (/^\d+[A-Z]?$/.test(compact)) return `C${compact}`;
    return compact;
  }
  return code;
};

const identityKey = (brand, code) => {
  const normalized = normalizeCode(brand, code);
  return normalized ? `${brand.toLowerCase()}::${normalized}` : "";
};

const cleanName = (name) => String(name || "").replace(/\s+/g, " ").trim();

const inferSet = (brand, code, finish, type) => {
  if (brand === "Jumpwind") {
    if (/^JWEM/i.test(code)) return "Extra Metal";
    if (/^PM/i.test(code)) return "Prime Metal";
    if (/^GC/i.test(code)) return "Pearl";
    if (/^PC/i.test(code)) return "Clear";
    if (code === "JW-041" || code === "JW-042") return "Hyper";
    if (/^JW-11[1-8]$/.test(code)) return "Fluorescent";
    if (code.startsWith("JW-A")) return "Aqueous";
    if (code.startsWith("JW-")) return "Basic";
    if (code.startsWith("MC")) return "MEKA";
    if (code.startsWith("NO")) return "NEO";
  }
  if (brand === "Gaia") {
    if (code.startsWith("GE")) return "Gaia Ex";
    if (code.startsWith("TL")) return "Train Line";
    if (code.startsWith("EX")) return "EX";
    if (/^10\d{2}$/.test(code)) return "Railway";
    if (/^2\d{2}$/.test(code)) return "Military";
    return "Gaia Notes";
  }
  if (brand === "Hobby Mio") {
    const number = Number((code.match(/(\d+)/) || [])[1] || 0);
    if (number >= 301 || (number >= 101 && number < 183)) return "Metal";
    if (number >= 183) return "Premium";
    if (number >= 71) return "Gray";
    if (number >= 51) return "Mecha";
    return "Basic";
  }
  if (brand === "Sunin7") {
    const blob = `${finish} ${type}`;
    if (/fluorescent/i.test(blob)) return "Fluorescent";
    if (finish === "metallic") return "Metallic";
    if (finish === "clear") return "Clear";
    return "Sunin7";
  }
  if (brand === "QNC") return "QNC";
  if (brand === "Mr.Hobby") return "Mr Color";
  if (brand === "Tamiya") {
    if (/^X-\d+/i.test(code)) return "Acrylic X";
    if (/^XF-\d+/i.test(code)) return "Acrylic XF";
    if (/^LP-\d+/i.test(code)) return "Lacquer LP";
    return "Tamiya";
  }
  return "";
};

const jumpwindZhByEnglish = (paints) => {
  const map = new Map();
  for (const paint of paints) {
    if (paint.brand !== "Jumpwind") continue;
    const [zh, en] = String(paint.name)
      .split("/")
      .map((part) => part.trim());
    if (zh && en) map.set(en.toLowerCase(), zh);
  }
  return map;
};

const withChineseName = (name, zhByEnglish) => {
  const zh = zhByEnglish.get(name.toLowerCase());
  if (zh && !name.includes(zh)) return `${zh} / ${name}`;
  return name;
};

const parseMarkdownTable = (markdown, filename) => {
  const heading =
    markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() ||
    filename.replace(/\.md$/i, "");
  const brand = normalizeBrand(heading);
  const lines = markdown.split(/\r?\n/).filter((line) => line.startsWith("|"));
  if (lines.length < 2) return [];

  let headerLine = lines[0];
  let start = 1;
  if (isDivider(lines[1])) start = 2;
  else if (lines.length > 2 && isDivider(lines[2])) {
    headerLine = lines[1];
    start = 3;
  }

  const header = splitRow(headerLine).map((cell) => cell.toLowerCase());
  const nameIdx = header.findIndex((h) => h === "name");
  const codeIdx = header.findIndex((h) => h === "code");
  const setIdx = header.findIndex((h) => h === "set");
  const hexIdx = header.findIndex((h) => h.includes("hex"));
  if (nameIdx < 0 || hexIdx < 0) return [];

  const paints = [];
  for (const line of lines.slice(start)) {
    if (isDivider(line)) continue;
    const cells = splitRow(line);
    const hex = extractHex(cells[hexIdx] || "");
    if (!hex) continue;
    const name = (cells[nameIdx] || "").replace(/\\'/g, "'").trim();
    const set = setIdx >= 0 ? cells[setIdx] || "" : "";
    const rawCode = codeIdx >= 0 ? cells[codeIdx] || "" : "";
    const code =
      brand === "Mr.Hobby" ? formatMrHobbyCode(rawCode, set) : rawCode;
    paints.push({
      brand,
      code,
      name: name || code || hex,
      hex,
      set,
        finish: inferFinish({ name, set, type: "standard", code }),
      source: "miniature-paints",
      approx: true,
    });
  }
  return paints;
};

const extractLocalArray = (source, name) => {
  const match = source.match(
    new RegExp(`export const ${name}[^=]*=\\s*\\[([\\s\\S]*?)\\n\\];`)
  );
  if (!match) throw new Error(`Could not find ${name}`);
  const body = match[1];
  const entries = [];
  const rowRe =
    /\{\s*id:\s*'([^']+)',\s*brand:\s*'([^']+)',\s*code:\s*'([^']+)',\s*name:\s*'([^']*)',\s*hex:\s*'([^']+)'\s*\}/g;
  let row;
  while ((row = rowRe.exec(body))) {
    entries.push({
      id: row[1],
      brand: row[2],
      code: row[3],
      name: row[4],
      hex: row[5].toUpperCase().startsWith("#")
        ? row[5].toUpperCase()
        : `#${row[5].toUpperCase()}`,
    });
  }
  return entries;
};

const fetchText = async (url) => {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`${response.status} ${url}`);
  }
  return response.text();
};

const fetchJSON = async (url) => JSON.parse(await fetchText(url));

const listPaintFiles = async () => {
  const items = await fetchJSON(PAINTS_API);
  return items
    .filter((item) => item.type === "file" && item.name.endsWith(".md"))
    .filter((item) => !SKIP_FILES.has(item.name))
    .map((item) => item.name);
};

const cachedRead = async (filename) => {
  const filePath = path.join(CACHE, filename);
  try {
    return await readFile(filePath, "utf8");
  } catch {
    const text = await fetchText(`${PAINTS_RAW}${encodeURIComponent(filename)}`);
    await mkdir(CACHE, { recursive: true });
    await writeFile(filePath, text);
    return text;
  }
};

const cachedJSON = async (filePath, url) => {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    const text = await fetchText(url);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, text);
    return JSON.parse(text);
  }
};

const loadModkitPaints = async (zhByEnglish) => {
  const rows = await cachedJSON(MODKIT_CACHE, MODKIT_PAINTS_URL);
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    const brand = normalizeBrand(row.brand);
    const hex = extractHex(row.hex || "");
    if (!hex) return [];
    const code = normalizeCode(brand, row.code);
    const rawName = cleanName(row.name);
    const name =
      brand === "Jumpwind" ? withChineseName(rawName, zhByEnglish) : rawName;
    return [
      {
        brand,
        code,
        name: name || code || hex,
        hex,
        set: inferSet(brand, code, row.finish, row.type),
        finish: inferFinish({
          name,
          set: row.finish || "",
          type: row.type || "",
          finish: row.finish,
          code,
        }),
        source: "modkit-swatch",
        approx: true,
      },
    ];
  });
};

const toEntry = (paint) => {
  const hex = (paint.hex || "").toUpperCase();
  const rgb = hex && /^#[0-9A-F]{6}$/.test(hex) ? hexToRgb(hex) : null;
  const code = normalizeCode(paint.brand, paint.code || "");
  const finish = paint.finish || "standard";
  const mixable =
    paint.mixable != null ? Boolean(paint.mixable) : isMixableFinish(finish);
  return {
    id:
      paint.id ||
      `${slug(paint.brand)}-${slug(code || paint.name)}-${slug(paint.set || "std")}-${
        rgb ? hex.slice(1).toLowerCase() : "stub"
      }`,
    brand: paint.brand,
    code,
    name: paint.name,
    hex: rgb ? hex : "",
    set: paint.set || "",
    finish,
    source: paint.source,
    approx: paint.approx !== false,
    lab: rgb ? rgbToLab(rgb.r, rgb.g, rgb.b) : [],
    mixable,
  };
};

const jumpwindSpecialStubs = () => {
  const rows = [
    ["JW-041", "超级白 / Hyper White", "hyper", "#FFFFFF"],
    ["JW-042", "超级黑 / Hyper Black", "hyper", "#0D0D0D"],
    ["JW-111", "荧光粉红 / Fluorescent Pink", "fluorescent", "#FF1493"],
    ["JW-112", "荧光红 / Fluorescent Red", "fluorescent", "#FF2247"],
    ["JW-113", "荧光橙 / Fluorescent Orange", "fluorescent", "#FF6A00"],
    ["JW-114", "荧光橙黄 / Fluorescent Orange Yellow", "fluorescent", "#FFAA00"],
    ["JW-115", "荧光黄 / Fluorescent Yellow", "fluorescent", "#FFEE00"],
    ["JW-116", "荧光绿 / Fluorescent Green", "fluorescent", "#00FF66"],
    ["JW-117", "荧光蓝 / Fluorescent Blue", "fluorescent", "#00A6FF"],
    ["JW-118", "荧光紫 / Fluorescent Violet", "fluorescent", "#9B30FF"],
    ["JWEM01", "光银 / Shiny Silver", "extraMetal", "#D4D4D8"],
    ["JWEM02", "耀金 / Glitz Gold", "extraMetal", "#E5C158"],
    ["JWEM03", "白铝 / Aluminium", "extraMetal", "#C0C7CE"],
    ["JWEM04", "青金 / Green Gold", "extraMetal", "#C8BA7A"],
    ["JWEM05", "铁 / Iron", "extraMetal", "#4A525A"],
    ["JWEM06", "钢 / Steel", "extraMetal", "#6E7680"],
    ["JWEM07", "暗钢 / Dark Steel", "extraMetal", "#3E444B"],
    ["JWEM08", "黑铁 / Black Iron", "extraMetal", "#2A2E33"],
    ["JWEM09", "赤铜 / Copper", "extraMetal", "#B86B43"],
    ["JWEM10", "超级不锈钢 / Super Stainless", "extraMetal", "#9AA4AE"],
    ["JWEM11", "杜拉铝 / Duralumin", "extraMetal", "#A8ADB5"],
    ["JWEM12", "香槟金 / Champagne Gold", "extraMetal", "#D9C59A"],
    ["JWEM13", "烧铁 / Burnt Iron", "extraMetal", "#4D3D36"],
    ["JWEM14", "赤金 / Red Gold", "extraMetal", "#C68A4C"],
    ["JWEM15", "钛金色 / Titanium Gold", "extraMetal", "#BFAF80"],
    ["JWEM16", "灼烧金色 / Burnt Gold", "extraMetal", "#9A6836"],
    ["JWEM21", "金属红 / Metallic Red", "extraMetal", "#B8232B"],
    ["JWEM22", "金属蓝 / Metallic Blue", "extraMetal", "#1E5AA8"],
    ["JWEM23", "金属绿 / Metallic Green", "extraMetal", "#1E8548"],
    ["JWEM24", "金属紫 / Metallic Purple", "extraMetal", "#6E3E8C"],
    ["JWEM25", "金属桃红 / Metallic Pink", "extraMetal", "#D14975"],
    ["JWEM26", "金属海蓝 / Metallic Sea Blue", "extraMetal", "#1E5B7E"],
    ["JWEM27", "金属翠绿 / Metallic Emerald", "extraMetal", "#1E9E68"],
    ["JWEM28", "金属血红 / Metallic Crimson", "extraMetal", "#7A1822"],
    ["JWEM29", "金属星辰蓝 / Metallic Star Blue", "extraMetal", "#18335C"],
    ["JWEM30", "金属琥珀绿 / Metallic Amber Green", "extraMetal", "#687D38"],
    ["JWEM31", "金属玫瑰紫 / Metallic Rose Purple", "extraMetal", "#8C335E"],
    ["JWEM32", "金属松石绿 / Metallic Turquoise", "extraMetal", "#1E887E"],
    ["PM01", "秘银 / Mithril", "primeMetal", "#E2E8F0"],
    ["PM02", "绚金 / Brilliant Gold", "primeMetal", "#DEB24A"],
    ["PM03", "钨钢 / Tungsten", "primeMetal", "#434B54"],
    ["PM04", "玫瑰金 / Rose Gold", "primeMetal", "#BA757D"],
    ["PM05", "亚麻金 / Linen Gold", "primeMetal", "#CCA876"],
    ["PM06", "合金钛 / Alloy Titanium", "primeMetal", "#8C8B82"],
    ["PM07", "陨铁 / Meteor Iron", "primeMetal", "#35383D"],
    ["PM08", "绯金 / Scarlet Gold", "primeMetal", "#BA603D"],
    ["PM09", "茶金 / Tea Gold", "primeMetal", "#8C6528"],
    ["GC001", "珍珠红 / Pearl Red", "pearl", "#E57373"],
    ["GC002", "珍珠黄 / Pearl Yellow", "pearl", "#F2D06B"],
    ["GC003", "珍珠蓝 / Pearl Blue", "pearl", "#7BAAF7"],
    ["GC004", "珍珠绿 / Pearl Green", "pearl", "#81C995"],
    ["GC005", "珍珠紫 / Pearl Purple", "pearl", "#B39DDB"],
    ["GC006", "珍珠品红 / Pearl Magenta", "pearl", "#E06292"],
    ["GC007", "珍珠松石绿 / Pearl Turquoise", "pearl", "#4DB6AC"],
    ["GC008", "珍珠白 / Pearl White", "pearl", "#F5F7FA"],
    ["GC009", "珍珠黑 / Pearl Black", "pearl", "#2C2D30"],
    ["GC010", "珍珠银 / Pearl Silver", "pearl", "#D5D8DC"],
    ["GC011", "珍珠月白 / Pearl Moon White", "pearl", "#E8ECF2"],
    ["GC012", "珍珠午夜黑 / Pearl Midnight", "pearl", "#1C1F26"],
    ["PC01", "透明红 / Clear Red", "clear", "#D81E28"],
    ["PC02", "透明橙 / Clear Orange", "clear", "#F37021"],
    ["PC03", "透明黄 / Clear Yellow", "clear", "#FED100"],
    ["PC04", "透明绿 / Clear Green", "clear", "#009A44"],
    ["PC05", "透明蓝 / Clear Blue", "clear", "#0062AC"],
    ["PC06", "透明紫 / Clear Purple", "clear", "#702A8C"],
    ["PC07", "透明粉红 / Clear Pink", "clear", "#E8437D"],
    ["PC08", "透明棕 / Clear Brown", "clear", "#6E3821"],
    ["PC09", "透明黑 / Clear Black", "clear", "#2B2B2B"],
    ["PC10", "透明琥珀 / Clear Amber", "clear", "#E68A00"],
    ["PC11", "透明白 / Clear White", "clear", "#F5F5F5"],
  ];
  return rows.map(([code, name, finish, hex]) => ({
    brand: "Jumpwind",
    code,
    name,
    hex: hex || "",
    set: inferSet("Jumpwind", normalizeCode("Jumpwind", code), finish, ""),
    finish,
    source: "jumpwind-special",
    approx: true,
    mixable: false,
  }));
};

const loadTamiyaNames = async () => {
  const byCode = new Map();
  for (const url of TAMIYA_LIST_FILES) {
    try {
      const rows = await fetchJSON(url);
      for (const row of rows) {
        const code = String(row.code || "").trim();
        if (!code) continue;
        const ja = row.name?.ja;
        const en = row.name?.en;
        byCode.set(code.toUpperCase(), { ja, en, code });
      }
    } catch (error) {
      console.warn(`tamiya-list skip ${url}: ${error.message}`);
    }
  }
  return byCode;
};

const enrichTamiya = (paints, names) => {
  if (names.size === 0) return paints;
  return paints.map((paint) => {
    if (paint.brand !== "Tamiya") return paint;
    const extra = names.get(paint.code.toUpperCase());
    if (!extra) return paint;
    const ja = extra.ja?.trim();
    if (ja && !paint.name.includes(ja)) {
      return { ...paint, name: `${paint.name} / ${ja}` };
    }
    return paint;
  });
};

const main = async () => {
  const colorUtils = await readFile(
    path.join(ROOT, "GK-Mixer-miniwebtools-main", "utils", "colorUtils.ts"),
    "utf8"
  );

  const local = [
    ...extractLocalArray(colorUtils, "GAIA_PAINTS").map((paint) => ({
      ...paint,
      set: "Gaia Notes",
      finish: inferFinish(paint),
      source: "gk-mixer",
      approx: true,
    })),
    ...extractLocalArray(colorUtils, "JUMPWIND_PAINTS").map((paint) => ({
      ...paint,
      set: paint.code.startsWith("MC") ? "MEKA" : "NEO",
      finish: inferFinish(paint),
      source: "gk-mixer",
      approx: true,
    })),
    ...extractLocalArray(colorUtils, "GUNZE_PAINTS").map((paint) => ({
      ...paint,
      brand: "Gunze",
      set: "Acrysion",
      finish: inferFinish(paint),
      source: "gk-mixer",
      approx: true,
    })),
  ];

  const files = await listPaintFiles();
  const community = [];
  for (const filename of files) {
    const markdown = await cachedRead(filename);
    const parsed = parseMarkdownTable(markdown, filename).filter(
      (paint) => !SKIP_BRANDS.has(paint.brand.toLowerCase())
    );
    community.push(...parsed);
    console.log(`${filename}: ${parsed.length}`);
  }

  const tamiyaNames = await loadTamiyaNames();
  const zhByEnglish = jumpwindZhByEnglish(local);
  const modkit = await loadModkitPaints(zhByEnglish);
  console.log(`modkit-swatch: ${modkit.length}`);

  const merged = enrichTamiya(
    [...local, ...community, ...modkit, ...jumpwindSpecialStubs()],
    tamiyaNames
  );

  const seenIds = new Set();
  const seenKeys = new Set();
  const paints = [];
  for (const paint of merged) {
    const entry = toEntry(paint);
    const key = identityKey(entry.brand, entry.code);
    const overlay = paint.source === "modkit-swatch";
    if (overlay && key && seenKeys.has(key)) continue;
    if ((paint.source === "jumpwind-stub" || paint.source === "jumpwind-special") && key && seenKeys.has(key)) continue;
    if (seenIds.has(entry.id)) continue;
    if (key) seenKeys.add(key);
    seenIds.add(entry.id);
    paints.push(entry);
  }

  paints.sort((a, b) => {
    const brand = a.brand.localeCompare(b.brand);
    if (brand !== 0) return brand;
    const code = a.code.localeCompare(b.code, undefined, { numeric: true });
    if (code !== 0) return code;
    return a.name.localeCompare(b.name);
  });

  const catalog = {
    version: 1,
    generatedAt: new Date().toISOString().slice(0, 10),
    sources: [
      "gk-mixer Gaia/Jumpwind/Gunze",
      "Arcturus5404/miniature-paints (MIT)",
      "afzafri/modkit-swatch (MIT)",
      "seotaro/tamiya-list (Tamiya names)",
      "Jumpwind special-series (calibrated hex, non-mixable)",
    ],
    paints,
  };

  await mkdir(OUT_DIR, { recursive: true });
  const json = JSON.stringify(catalog);
  await writeFile(path.join(OUT_DIR, "PaintCatalog.json"), json);
  const webOut = path.join(ROOT, "GK-Mixer-miniwebtools-main", "public", "PaintCatalog.json");
  await writeFile(webOut, json);

  const brands = {};
  for (const paint of paints) {
    brands[paint.brand] = (brands[paint.brand] || 0) + 1;
  }
  console.log("\nBrands:");
  for (const [brand, count] of Object.entries(brands).sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`  ${String(count).padStart(5)}  ${brand}`);
  }
  console.log(`\nWrote ${paints.length} paints → ${path.join(OUT_DIR, "PaintCatalog.json")}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
