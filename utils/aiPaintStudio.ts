import { FloatingSwatchNode } from "../types";
import { localizedBrand } from "./paintCatalog";

export type AiStudioMode = "preset" | "refine";
export type AiChannelMode = "official" | "byok";
export type AiRenderQuality = "1K" | "2K";
export type ByokProviderId = "ark" | "gemini" | "openai" | "custom";

export interface ByokConfig {
  provider: ByokProviderId;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface WalletInfo {
  passkey: string;
  credits: number;
  totalPurchased: number;
  totalUsed: number;
  trialGranted?: boolean;
}

export interface WalletStatusResponse {
  ok: boolean;
  officialReady: boolean;
  kvReady: boolean;
  costPerRender: number;
  costPerRender1k?: number;
  costPerRender2k?: number;
  wallet: WalletInfo;
  addedPoints?: number;
  error?: string;
}

export interface AiPresetStyle {
  id: string;
  name: string;
  badge: string;
  sampleImageUrl: string;
  defaultFinish: SurfaceFinishId;
  defaultBg: StudioBgId;
  defaultLighting: LightingPosId;
  prompt: string;
}

export type SurfaceFinishId = "matte" | "semi_gloss" | "gloss" | "metallic_pearl";
export type DetailCraftId = "panel_lining" | "decals" | "metallic_frame" | "led_glow";
export type StudioBgId = "white_studio" | "dark_studio" | "cutting_mat" | "hangar_bay";
export type LightingPosId = "soft_dual" | "top_key" | "rim_dramatic";

export type RefineFinishStyle = "matte_studio" | "anime_cel_refine" | "metallic_gloss_refine";
export type RefineUnpaintedPolicy = "keep_clean" | "harmonize_complete";

export const SURFACE_FINISH_OPTIONS: {
  id: SurfaceFinishId;
  name: string;
  promptFragment: string;
}[] = [
  {
    id: "matte",
    name: "纯哑光 / 消光",
    promptFragment: "外装甲表面统一喷涂纯哑光消光保护漆，丝滑无油光塑料感，漫反射细腻高级。",
  },
  {
    id: "semi_gloss",
    name: "半消光 / 缎面",
    promptFragment: "表面呈细腻的半消光缎面硝基漆质感，棱线保留克制柔润的丝绸高光。",
  },
  {
    id: "gloss",
    name: "镜面亮光 / 光油",
    promptFragment: "外装甲罩染高光泽镜面光油清漆，呈现汽车级深邃透亮高反光与清晰灯带倒影。",
  },
  {
    id: "metallic_pearl",
    name: "金属珠光漆面",
    promptFragment: "漆面呈现精细微粒金属漆与珍珠金属粉质感，边缘折角呈现金属光泽渐变。",
  },
];

export const DETAIL_CRAFT_OPTIONS: {
  id: DetailCraftId;
  name: string;
  promptFragment: string;
}[] = [
  {
    id: "panel_lining",
    name: "精密渗线",
    promptFragment: "全身机械刻线、装甲落差缝隙进行深灰/纯黑精密渗线勾勒，锐利干净无脏污。",
  },
  {
    id: "decals",
    name: "警示水贴",
    promptFragment: "仅在装甲平面适量点缀微缩机甲警示水贴与机体编号，严禁在背景悬浮任何文字牌或色卡。",
  },
  {
    id: "metallic_frame",
    name: "金属骨架分色",
    promptFragment: "外露关节骨架、液压杆与推进喷口采用精密枪铁、钛金与不锈钢金属分色。",
  },
  {
    id: "led_glow",
    name: "监视器发光",
    promptFragment: "头部主监视器眼部与感应器带有柔和真实的LED荧光微发光点缀。",
  },
];

export const STUDIO_BG_OPTIONS: {
  id: StudioBgId;
  name: string;
  swatchHex: string;
  promptFragment: string;
}[] = [
  {
    id: "white_studio",
    name: "纯白 / 浅灰无影棚",
    swatchHex: "#E5E7EB",
    promptFragment: "摄影背景为干净纯净的浅灰白渐变商业无影棚，背景简洁无杂物。",
  },
  {
    id: "dark_studio",
    name: "纯黑 / 深灰暗棚",
    swatchHex: "#1E293B",
    promptFragment: "摄影背景为专业深灰至纯黑渐变暗调摄影棚，凸显主体轮廓光影与漆面层次。",
  },
  {
    id: "cutting_mat",
    name: "模型切割垫桌面",
    swatchHex: "#1F3A3D",
    promptFragment: "置于模型玩家工作台的深绿灰刻度切割垫桌面实拍，带有柔和真实微距桌面景深。",
  },
  {
    id: "hangar_bay",
    name: "格纳库整备台",
    swatchHex: "#334155",
    promptFragment: "背景为微缩写实机甲格纳库金属整备架与机械臂底座，带轻微背景虚化。",
  },
];

export const LIGHTING_POS_OPTIONS: {
  id: LightingPosId;
  name: string;
  promptFragment: string;
}[] = [
  {
    id: "soft_dual",
    name: "双侧均匀柔光",
    promptFragment: "采用摄影棚双侧大面积柔光箱均匀布光，色彩还原精准、暗部细节清晰。",
  },
  {
    id: "top_key",
    name: "顶部神光主光",
    promptFragment: "采用顶部高角度主光照明配轻微底部补光，突出头部、肩甲与胸甲立体体块感。",
  },
  {
    id: "rim_dramatic",
    name: "侧逆轮廓光",
    promptFragment: "采用戏剧性单侧强主光配合后方冷暖双色轮廓光勾边，强化机甲钢铁轮廓线条。",
  },
];

export const AI_PRESET_STYLES: AiPresetStyle[] = [
  {
    id: "clean_rg",
    name: "平喷直喷",
    badge: "官图清爽",
    sampleImageUrl: "/ai-style-refs/clean_rg.jpg",
    defaultFinish: "semi_gloss",
    defaultBg: "white_studio",
    defaultLighting: "soft_dual",
    prompt:
      "官方封绘商业产品摄影，微缩高达机甲精涂成品模型，大师级干净平喷直喷分色工艺，彻底消除素组塑料水口与半透明塑料感，装甲同色系深浅层次分色清晰，色彩发色精准饱满。严格保持原图模型的机械结构、装甲比例与拍摄视角100%不变。",
  },
  {
    id: "max_shadow",
    name: "阴影喷涂 (MAX)",
    badge: "重涂立体",
    sampleImageUrl: "/ai-style-refs/max_shadow.jpg",
    defaultFinish: "matte",
    defaultBg: "dark_studio",
    defaultLighting: "top_key",
    prompt:
      "日本模型杂志封面级产品摄影，微缩高达机甲大师级MAX阴影喷涂工艺（黑水补土打底预置阴影 Pre-shading），装甲棱线、转折角与刻线边缘带有克制深邃的重色阴影过渡，装甲板面中心柔和提亮，呈现厚重精涂立体质感。严格保持原图模型的零件轮廓、机械刻线、比例与姿态100%一致。",
  },
  {
    id: "anime_cel",
    name: "漫画风格涂装",
    badge: "二次元破壁",
    sampleImageUrl: "/ai-style-refs/anime_cel.jpg",
    defaultFinish: "matte",
    defaultBg: "cutting_mat",
    defaultLighting: "soft_dual",
    prompt:
      "产品摄影，微缩高达机甲模型，大师级手涂漫画二次元涂装，清晰粗黑色轮廓勾线，赛璐璐平涂风格，硬边缘明暗色块，强烈明暗对比，每种颜色用白色高光、基本色、深黑色阴影三层硬边色块划分明暗关系，没有柔和渐变，干净锐利黑色卡通轮廓，近距离微距实拍，机械刻线清晰，日系漫画画风。严格保持原图模型的机械结构、装甲造型、比例与拍摄角度完全不变。",
  },
  {
    id: "heavy_weathering",
    name: "战损旧化涂装",
    badge: "写实战损",
    sampleImageUrl: "/ai-style-refs/heavy_weathering.jpg",
    defaultFinish: "matte",
    defaultBg: "dark_studio",
    defaultLighting: "rim_dramatic",
    prompt:
      "写实军事微缩模型摄影，高达机甲大师级战损旧化涂装，装甲棱角边缘逼真的海绵掉漆与银灰色金属磨损露底，表面带有细腻渍洗滤镜、自然重力流锈雨痕与喷口烟熏积碳痕迹，下肢轻微陆战沙尘旧化，极具钢铁重量感。严格保持原图模型的机械造型、比例与拍摄角度完全不变。",
  },
  {
    id: "candy_metallic",
    name: "电镀糖果金属",
    badge: "镜面高光",
    sampleImageUrl: "/ai-style-refs/candy_metallic.jpg",
    defaultFinish: "gloss",
    defaultBg: "dark_studio",
    defaultLighting: "rim_dramatic",
    prompt:
      "高端合金成品模型商业摄影，微缩机甲电镀糖果色金属涂装工艺（亮光黑打底、电镀银与多层透明色罩染抛光），发色通透深邃且极具金属光泽。严格保持原图模型的每一个装甲零件轮廓、比例与姿态完全不变，禁止结构变形。",
  },
  {
    id: "gk_resin_studio",
    name: "GK 灰模精涂",
    badge: "灰模上色",
    sampleImageUrl: "/ai-style-refs/gk_resin_studio.jpg",
    defaultFinish: "semi_gloss",
    defaultBg: "white_studio",
    defaultLighting: "top_key",
    prompt:
      "殿堂级GK改件涂装成品微距摄影，将单色灰模/白模转化为完整大师级精涂成品，消除打磨痕迹与层纹，自动赋予协调考究的机甲主副色分色方案与金属点缀细节。严格保持原图灰模的每一处装甲造型、刻线走向、比例与视角100%不变。",
  },
];

export const NO_SWATCH_UI_RULE =
  "【绝对禁止规则】画面中只能出现纯粹的模型实物与摄影棚环境，严禁在生成结果中保留或生成任何悬浮色卡方块、色号标签、编号圆点、引线框、价格文字、水印或UI界面元素。";

export const REFINE_FINISH_OPTIONS: {
  id: RefineFinishStyle;
  name: string;
  desc: string;
  promptFragment: string;
}[] = [
  {
    id: "matte_studio",
    name: "真实消光喷涂质感（推荐）",
    desc: "清除涂色边缘溢出与数字平涂假感，转化为真实喷笔雾化消光漆面与清晰刻线",
    promptFragment:
      "表面质感转化为真实的微缩模型硝基漆半消光/消光喷涂质感，带有自然真实的微距摄影棚柔光漫反射、清晰锐利的机械刻线黑色渗线与立体暗部过渡，彻底消除电子算法填色的生硬平面感。",
  },
  {
    id: "anime_cel_refine",
    name: "二次元漫画勾线精修",
    desc: "严格沿用你的模拟分色方案，修复溢色并重绘为硬边三层色块+粗黑勾线漫画涂装",
    promptFragment:
      "在严格遵循已上色部位配色方案的前提下，将表面转化为大师级手涂二次元漫画赛璐璐涂装，干净锐利的黑色轮廓勾线与刻线渗线，硬边缘高光、本色、深阴影三层色块对比，纯哑光消光质感。",
  },
  {
    id: "metallic_gloss_refine",
    name: "金属/糖果亮光精修",
    desc: "严格沿用你的模拟分色方案，修复溢色并升级为高反光金属/糖果镜面烤漆质感",
    promptFragment:
      "在严格遵循已上色部位配色方案的前提下，将外甲升级为高光泽镜面烤漆/金属糖果漆质感，内构关节升级为精密枪铁金属质感，呈现真实的摄影棚高光反射与锐利刻线。",
  },
];

export const BYOK_PROVIDER_PRESETS: {
  id: ByokProviderId;
  name: string;
  badge: string;
  defaultBaseUrl: string;
  defaultModel: string;
  modelSuggestions: string[];
  keyApplyUrl: string;
  placeholderKey: string;
}[] = [
  {
    id: "ark",
    name: "火山引擎 · 豆包 Seedream",
    badge: "国内直连首选",
    defaultBaseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    defaultModel: "doubao-seedream-5-0-pro-260628",
    modelSuggestions: [
      "doubao-seedream-5-0-pro-260628",
      "doubao-seedream-5-0-flash-260915",
      "doubao-seedream-5-0-lite-260128",
      "doubao-seedream-4-5-251128",
    ],
    keyApplyUrl: "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey",
    placeholderKey: "粘贴火山方舟 API Key（如 8a4f2c...）",
  },
  {
    id: "gemini",
    name: "Google Gemini 图像模型",
    badge: "海外极速",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-3.1-flash-image",
    modelSuggestions: [
      "gemini-3.1-flash-image",
      "gemini-3-pro-image",
      "gemini-2.5-flash-image",
    ],
    keyApplyUrl: "https://aistudio.google.com/apikey",
    placeholderKey: "粘贴 AIzaSy 开头的 Gemini API Key",
  },
  {
    id: "openai",
    name: "OpenAI GPT-Image",
    badge: "高阶多图精修",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-image-2.6-sunburst",
    modelSuggestions: [
      "gpt-image-2.6-sunburst",
      "gpt-image-2.6-flare",
      "gpt-image-2",
      "gpt-image-1.5",
    ],
    keyApplyUrl: "https://platform.openai.com/api-keys",
    placeholderKey: "粘贴 sk-... 开头的 OpenAI API Key",
  },
  {
    id: "custom",
    name: "OpenAI 兼容接口 (Grok / 中转站)",
    badge: "自定义 BaseURL",
    defaultBaseUrl: "https://api.x.ai/v1",
    defaultModel: "grok-imagine-image",
    modelSuggestions: [
      "grok-imagine-image",
      "gpt-image-2.6-sunburst",
      "doubao-seedream-5-0-pro-260628",
    ],
    keyApplyUrl: "",
    placeholderKey: "粘贴对应平台的 Bearer API Key",
  },
];

// ==========================================
// Prompt Builder with Project Paint Swatches
// ==========================================
export function buildProjectPaletteClause(nodes: FloatingSwatchNode[]): string {
  if (!nodes || nodes.length === 0) return "";
  const seen = new Set<string>();
  const items: string[] = [];
  for (const n of nodes) {
    const hex = (n.hex || "").toUpperCase();
    if (!hex || seen.has(hex)) continue;
    seen.add(hex);
    const brandZh = n.paintBrand ? localizedBrand(n.paintBrand, "zh") : "";
    const label = [brandZh, n.paintCode, n.paintName].filter(Boolean).join(" ").trim();
    items.push(label ? `${label}(${hex})` : hex);
    if (items.length >= 6) break;
  }
  if (items.length === 0) return "";
  return `涂装主副色方案请参考并融合以下模型漆色卡：${items.join("、")}。`;
}

export function buildProcessClause(opts: {
  finishId: SurfaceFinishId;
  crafts: DetailCraftId[];
  bgId: StudioBgId;
  lightingId: LightingPosId;
}): string {
  const finish = SURFACE_FINISH_OPTIONS.find((f) => f.id === opts.finishId);
  const bg = STUDIO_BG_OPTIONS.find((b) => b.id === opts.bgId);
  const lighting = LIGHTING_POS_OPTIONS.find((l) => l.id === opts.lightingId);
  const craftClauses = opts.crafts
    .map((id) => DETAIL_CRAFT_OPTIONS.find((c) => c.id === id)?.promptFragment)
    .filter(Boolean);
  return [
    finish?.promptFragment,
    ...craftClauses,
    bg?.promptFragment,
    lighting?.promptFragment,
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildPresetRenderPrompt(opts: {
  presetId: string;
  finishId: SurfaceFinishId;
  crafts: DetailCraftId[];
  bgId: StudioBgId;
  lightingId: LightingPosId;
  hasStyleRefImage: boolean;
  nodes: FloatingSwatchNode[];
  injectPalette: boolean;
  extraUserPrompt?: string;
}): string {
  const preset =
    AI_PRESET_STYLES.find((p) => p.id === opts.presetId) || AI_PRESET_STYLES[0];
  const processClause = buildProcessClause(opts);
  const styleRefClause = opts.hasStyleRefImage
    ? "【多图风格参考指令】图1为需要上色的素组/灰模本体，必须100%保持图1的机械轮廓、零件造型与视角；图2为喷涂风格与质感样板图，请深度学习图2的涂装笔触、明暗过渡、阴影重度与漆面发色质感并应用到图1模型上，严禁把图2的机体造型或零件混入图1。"
    : "";
  const paletteClause = opts.injectPalette ? buildProjectPaletteClause(opts.nodes) : "";
  const extra = (opts.extraUserPrompt || "").trim();
  return [
    preset.prompt,
    processClause,
    styleRefClause,
    paletteClause,
    NO_SWATCH_UI_RULE,
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildRefineRenderPrompt(opts: {
  hasDualRawImage: boolean;
  hasStyleRefImage: boolean;
  finishStyle: RefineFinishStyle;
  unpaintedPolicy: RefineUnpaintedPolicy;
  crafts: DetailCraftId[];
  bgId: StudioBgId;
  lightingId: LightingPosId;
  nodes: FloatingSwatchNode[];
  injectPalette: boolean;
  extraUserPrompt?: string;
}): string {
  const finishObj =
    REFINE_FINISH_OPTIONS.find((f) => f.id === opts.finishStyle) ||
    REFINE_FINISH_OPTIONS[0];
  const bg = STUDIO_BG_OPTIONS.find((b) => b.id === opts.bgId);
  const lighting = LIGHTING_POS_OPTIONS.find((l) => l.id === opts.lightingId);
  const craftClauses = opts.crafts
    .map((id) => DETAIL_CRAFT_OPTIONS.find((c) => c.id === id)?.promptFragment)
    .filter(Boolean)
    .join(" ");
  const paletteClause = opts.injectPalette ? buildProjectPaletteClause(opts.nodes) : "";
  const unpaintedClause =
    opts.unpaintedPolicy === "keep_clean"
      ? "对于草图中尚未涂上彩色的原始灰白装甲区域，请整理为干净整洁的白色/浅冷灰消光装甲漆面，不要胡乱涂成花哨杂色。"
      : "对于草图中尚未涂完的留白灰模区域，请结合已上色部位的整体机甲配色逻辑，自然协调地补全对称装甲与机械骨架分色。";

  const baseInstruction = opts.hasDualRawImage
    ? "基于多图联合精修微缩机甲模型：图1为未上色的原始模型实拍底图（提供100%准确的零件轮廓、装甲边界与机械刻线位置），图2为算法模拟局部上色草图（提供目标分色区域与配色位置）。请严格以图1的真实机械边缘与刻线为准，彻底修复图2中算法填色造成的边缘颜色溢出、锯齿毛边、渗色断层与死角漏涂问题，精准还原图2各部位的指定颜色。"
    : "微缩机甲模型模拟上色细节精修：原图为算法模拟上色的模型效果草图，存在局部边缘颜色溢出刻线、填色锯齿以及电子染色不自然的问题。请在严格保持原图模型零件造型、比例视角及已涂色部位颜色方案的前提下，彻底清除跨装甲缝隙的溢色毛边，锐化修复机械刻线边界。";

  const styleRefIdx = opts.hasDualRawImage ? "图3" : "图2";
  const styleRefClause = opts.hasStyleRefImage
    ? `【风格参考样板】${styleRefIdx}为喷涂质感参考样板，请学习${styleRefIdx}的漆面质感与涂装笔触表现，同时保持图1的实体结构与上色分色不变。`
    : "";

  const extra = (opts.extraUserPrompt || "").trim();
  return [
    baseInstruction,
    unpaintedClause,
    finishObj.promptFragment,
    craftClauses,
    bg?.promptFragment,
    lighting?.promptFragment,
    styleRefClause,
    paletteClause,
    "最终输出高清微距棚拍模型成品照片质感，严格保持模型原始姿态、结构比例与视角一致，禁止变形或增删零件。",
    NO_SWATCH_UI_RULE,
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

// ==========================================
// LocalStorage: Wallet Passkey & BYOK Config
// ==========================================
const PASSKEY_STORAGE_KEY = "gk_ai_wallet_passkey_v1";
const BYOK_STORAGE_KEY = "gk_ai_byok_config_v1";
const CHANNEL_STORAGE_KEY = "gk_ai_channel_pref_v1";
const QUALITY_STORAGE_KEY = "gk_ai_quality_pref_v1";

function randomBlock(len = 4): string {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const arr = new Uint8Array(len);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < len; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr)
    .map((b) => chars[b % chars.length])
    .join("");
}

export function generateNewPasskey(): string {
  return `GKM-${randomBlock(4)}-${randomBlock(4)}-${randomBlock(4)}`;
}

export function getOrCreateWalletPasskey(): string {
  if (typeof window === "undefined") return "GKM-DEMO-2026-INIT";
  const existing = localStorage.getItem(PASSKEY_STORAGE_KEY);
  if (existing && /^GKM-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(existing)) {
    return existing;
  }
  const created = generateNewPasskey();
  localStorage.setItem(PASSKEY_STORAGE_KEY, created);
  return created;
}

export function saveWalletPasskey(nextKey: string): boolean {
  const cleaned = nextKey.trim().toUpperCase();
  if (!/^GKM-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(cleaned)) {
    return false;
  }
  localStorage.setItem(PASSKEY_STORAGE_KEY, cleaned);
  return true;
}

export function loadByokConfig(): ByokConfig {
  const preset = BYOK_PROVIDER_PRESETS[0];
  const fallback: ByokConfig = {
    provider: preset.id,
    apiKey: "",
    baseUrl: preset.defaultBaseUrl,
    model: preset.defaultModel,
  };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(BYOK_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      provider: parsed.provider || fallback.provider,
      apiKey: parsed.apiKey || "",
      baseUrl: parsed.baseUrl || fallback.baseUrl,
      model: parsed.model || fallback.model,
    };
  } catch {
    return fallback;
  }
}

export function saveByokConfig(cfg: ByokConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(BYOK_STORAGE_KEY, JSON.stringify(cfg));
}

export function loadPreferredChannel(): AiChannelMode {
  if (typeof window === "undefined") return "official";
  const saved = localStorage.getItem(CHANNEL_STORAGE_KEY);
  if (saved === "byok" || saved === "official") return saved;
  return "official";
}

export function savePreferredChannel(ch: AiChannelMode): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CHANNEL_STORAGE_KEY, ch);
}

export function loadPreferredQuality(): AiRenderQuality {
  if (typeof window === "undefined") return "2K";
  const saved = localStorage.getItem(QUALITY_STORAGE_KEY);
  if (saved === "1K" || saved === "2K") return saved;
  return "2K";
}

export function savePreferredQuality(q: AiRenderQuality): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(QUALITY_STORAGE_KEY, q);
}

// ==========================================
// Client Image Compression (<1600px JPEG Data URI)
// ==========================================
export async function prepareImageForAiApi(
  imageSrc: string,
  maxEdge = 1536
): Promise<string> {
  if (!imageSrc) throw new Error("图片为空");
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (!w || !h) {
          reject(new Error("无法读取图片尺寸"));
          return;
        }
        const scale = Math.min(1, maxEdge / Math.max(w, h));
        const targetW = Math.max(64, Math.round(w * scale));
        const targetH = Math.max(64, Math.round(h * scale));
        const canvas = document.createElement("canvas");
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas 初始化失败"));
          return;
        }
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, targetW, targetH);
        ctx.drawImage(img, 0, 0, targetW, targetH);
        resolve(canvas.toDataURL("image/jpeg", 0.89));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error("加载参考图片失败"));
    img.src = imageSrc;
  });
}

// ==========================================
// API Client Calls
// ==========================================
export async function fetchWalletStatus(passkey: string): Promise<WalletStatusResponse> {
  const resp = await fetch("/api/ai-wallet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "status", passkey }),
  });
  const data = await resp.json();
  if (!resp.ok || !data.ok) {
    throw new Error(data?.error || "获取点数状态失败");
  }
  return data;
}

export async function redeemCreditCode(
  passkey: string,
  code: string
): Promise<WalletStatusResponse> {
  const resp = await fetch("/api/ai-wallet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "redeem", passkey, code }),
  });
  const data = await resp.json();
  if (!resp.ok || !data.ok) {
    throw new Error(data?.error || "兑换码核销失败");
  }
  return data;
}

export async function testByokConnection(byok: ByokConfig): Promise<string> {
  const resp = await fetch("/api/ai-render", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      channel: "byok",
      testOnly: true,
      byok,
    }),
  });
  const data = await resp.json();
  if (!resp.ok || !data.ok) {
    throw new Error(data?.error || "连通性测试未通过，请检查 Key 与模型名称");
  }
  return data.message || "连通性测试成功";
}

export async function runAiPaintRender(params: {
  channel: AiChannelMode;
  passkey: string;
  byok?: ByokConfig;
  prompt: string;
  rawImageSources: string[];
  size?: "1K" | "2K";
}): Promise<{
  imageDataUrl: string;
  modelUsed: string;
  wallet?: WalletInfo;
  costCredits?: number;
}> {
  const compressedImages = await Promise.all(
    params.rawImageSources.map((src) => prepareImageForAiApi(src, 1536))
  );

  const resp = await fetch("/api/ai-render", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      channel: params.channel,
      passkey: params.passkey,
      byok: params.channel === "byok" ? params.byok : undefined,
      prompt: params.prompt,
      images: compressedImages,
      size: params.size || "2K",
    }),
  });

  const data = await resp.json();
  if (!resp.ok || !data.ok) {
    const err: any = new Error(data?.error || "AI 生成失败，请稍后重试");
    err.code = data?.code;
    err.wallet = data?.wallet;
    throw err;
  }

  return {
    imageDataUrl: data.imageDataUrl,
    modelUsed: data.modelUsed,
    wallet: data.wallet,
    costCredits: data.costCredits,
  };
}
