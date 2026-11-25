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

export type OfficialModelKey = "seedream-5.5" | "seedream-5.0-pro";

export interface OfficialModelPricing {
  cost1k: number;
  cost2k: number;
  supportsTransparent: boolean;
}

export interface OfficialPricingMatrix {
  "seedream-5.5": OfficialModelPricing;
  "seedream-5.0-pro": OfficialModelPricing;
}

export const DEFAULT_OFFICIAL_PRICING_MATRIX: OfficialPricingMatrix = {
  "seedream-5.5": { cost1k: 4, cost2k: 6, supportsTransparent: true },
  "seedream-5.0-pro": { cost1k: 8, cost2k: 12, supportsTransparent: false },
};

export interface WalletStatusResponse {
  ok: boolean;
  officialReady: boolean;
  kvReady: boolean;
  costPerRender: number;
  costPerRender1k?: number;
  costPerRender2k?: number;
  pricingMatrix?: OfficialPricingMatrix;
  wallet: WalletInfo;
  addedPoints?: number;
  error?: string;
}

export interface AiPresetSubStyle {
  id: string;
  name: string;
  badge: string;
  sampleImageUrl: string;
  defaultFinish?: SurfaceFinishId;
  defaultCrafts?: DetailCraftId[];
  defaultBg?: StudioBgId;
  defaultLighting?: LightingPosId;
  prompt: string;
  enabled?: boolean;
}

export interface AiPresetStyle {
  id: string;
  name: string;
  badge: string;
  sampleImageUrl: string;
  defaultFinish: SurfaceFinishId;
  defaultCrafts: DetailCraftId[];
  defaultBg: StudioBgId;
  defaultLighting: LightingPosId;
  prompt: string;
  subStyles?: AiPresetSubStyle[];
  enabled?: boolean;
}

export interface PromptBlock {
  id: string;
  label: string;
  text: string;
  kind: "core" | "process" | "ref" | "palette" | "rule" | "extra";
  isOverride?: boolean;
  requiresStyleRef?: boolean;
}

export type SurfaceFinishId = "matte" | "semi_gloss" | "gloss" | "metallic_pearl";
export type DetailCraftId = "panel_lining" | "decals" | "metallic_frame" | "led_glow";
export type StudioBgId = "white_studio" | "dark_studio" | "cutting_mat" | "hangar_bay" | "transparent";
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
  {
    id: "transparent",
    name: "透明免抠 PNG",
    swatchHex: "transparent",
    promptFragment:
      "纯透明背景（无任何背景色、地台、阴影底板或杂物），仅保留完整洁净的涂装模型本体与锐利边缘，输出透明通道PNG素材。",
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
    name: "纯色平喷",
    badge: "官图标准",
    sampleImageUrl: "/ai-style-refs/clean_rg.jpg",
    defaultFinish: "semi_gloss",
    defaultCrafts: ["panel_lining"],
    defaultBg: "white_studio",
    defaultLighting: "soft_dual",
    prompt:
      "官方封绘级商业产品摄影，微缩高达机甲精涂成品模型，大师级纯色平喷直喷工艺（Solid Flat Airbrush），100%忠实还原并饱和呈现用户指定的油漆分色配方，彻底消除素组塑料水口、分模线与半透明塑料感，漆面均匀发色精准、同色系深浅分色利落清晰。严格保持原图模型的机械结构、装甲比例与拍摄视角100%不变。",
    enabled: true,
  },
  {
    id: "max_shadow",
    name: "阴影涂装",
    badge: "MAX预置",
    sampleImageUrl: "/ai-style-refs/max_shadow.jpg",
    defaultFinish: "matte",
    defaultCrafts: ["panel_lining", "decals", "metallic_frame"],
    defaultBg: "dark_studio",
    defaultLighting: "top_key",
    prompt:
      "日本模型杂志封面级产品摄影，微缩高达机甲MAX黑底预置阴影喷涂工艺（Pre-shading & Post-shading），沿装甲棱线、转折角与刻线边缘保留克制深邃的阴影过渡，装甲板面中心柔和提亮形成厚重体积感与高级发色层次。严格保持原图模型的零件轮廓、机械刻线、比例与姿态100%一致。",
    enabled: true,
  },
  {
    id: "anime_cel",
    name: "漫画风波点涂装",
    badge: "二次元网点",
    sampleImageUrl: "/ai-style-refs/anime_cel.jpg",
    defaultFinish: "matte",
    defaultCrafts: ["panel_lining"],
    defaultBg: "cutting_mat",
    defaultLighting: "soft_dual",
    prompt:
      "微缩高达机甲模型实拍，大师级手涂漫画风波点二次元涂装（Comic Cel-Shading with Halftone Dots）：清晰锐利的粗黑色轮廓描边与机械刻线勾线，高光白、主色、深暗色三层硬边缘赛璐璐明暗切块（无柔和渐变），并在暗部边缘与投影交界处加入复古日系漫画印刷波点/网点颗粒质感，营造极致破次元平面错觉效果。严格保持原图模型的机械结构、装甲造型、比例与拍摄角度完全不变。",
    enabled: true,
  },
  {
    id: "heavy_weathering",
    name: "战损旧化涂装",
    badge: "5项子工艺",
    sampleImageUrl: "/ai-style-refs/heavy_weathering.jpg",
    defaultFinish: "matte",
    defaultCrafts: ["panel_lining", "decals", "metallic_frame"],
    defaultBg: "dark_studio",
    defaultLighting: "rim_dramatic",
    prompt:
      "写实军事微缩模型微距摄影，高达机甲大师级战损旧化涂装工艺，整体呈现历经真实战场洗礼的钢铁重量感与岁月痕迹。严格保持原图模型的机械造型、比例与拍摄角度完全不变。",
    enabled: true,
    subStyles: [
      {
        id: "weathering_chipping",
        name: "海绵/笔涂掉漆",
        badge: "掉漆剥落",
        sampleImageUrl: "/ai-style-refs/weathering_chipping.jpg",
        defaultFinish: "matte",
        defaultCrafts: ["panel_lining", "decals", "metallic_frame"],
        defaultBg: "dark_studio",
        defaultLighting: "rim_dramatic",
        prompt:
          "主打高频磨损部位的海绵拍涂与00号极细面相笔点绘掉漆工艺（Sponge & Brush Chipping）：在装甲棱角、裙甲边缘、盾牌边沿与活动关节附近点缀大小错落的暗灰底层漆与银色露金属划痕，内部伴随浅色漆层托底立体感，整体控制克制自然不显杂乱。",
        enabled: true,
      },
      {
        id: "weathering_wash",
        name: "水洗渍洗滤镜",
        badge: "滤镜旧化",
        sampleImageUrl: "/ai-style-refs/weathering_wash.jpg",
        defaultFinish: "matte",
        defaultCrafts: ["panel_lining", "decals"],
        defaultBg: "white_studio",
        defaultLighting: "soft_dual",
        prompt:
          "主打高精度珐琅水洗渍洗与色彩滤镜工艺（Pin Wash & Filter）：沿机械铆钉、装甲落差凹槽与检修口积聚深棕/灰黑油泥渗渍，配合火机油单向竖向擦拭形成微弱重力油渍拉丝痕，同时对主色施加微妙统一的旧化色彩滤镜，消除干净新漆的浮躁感。",
        enabled: true,
      },
      {
        id: "weathering_grimdark",
        name: "暗黑珐琅旧化",
        badge: "Grimdark",
        sampleImageUrl: "/ai-style-refs/weathering_grimdark.jpg",
        defaultFinish: "matte",
        defaultCrafts: ["panel_lining", "metallic_frame", "led_glow"],
        defaultBg: "dark_studio",
        defaultLighting: "rim_dramatic",
        prompt:
          "战锤Grimdark暗黑写实重度珐琅旧化风格（Streaking Grime Reduction）：先通体罩涂深沉暗棕黑珐琅旧化液后对受光凸面进行白电油局部擦亮还原，深邃暗角积聚厚重陈年油垢与暗影反差，凸显黑暗工业战甲冷峻压迫感。",
        enabled: true,
      },
      {
        id: "weathering_drybrush",
        name: "干扫边缘质感",
        badge: "棱边金属",
        sampleImageUrl: "/ai-style-refs/weathering_drybrush.jpg",
        defaultFinish: "matte",
        defaultCrafts: ["panel_lining", "metallic_frame"],
        defaultBg: "dark_studio",
        defaultLighting: "top_key",
        prompt:
          "主打硬毛平笔高反差边缘干扫金属磨亮工艺（Metallic & Highlight Edge Drybrush）：在深沉消光装甲所有凸起棱线、散热格栅、关节骨架与铆钉顶点处，通过滤干轻扫呈现锋利的钢银色金属擦亮高光与粗粝金属表面微观颗粒纹理。",
        enabled: true,
      },
      {
        id: "weathering_rust_mud",
        name: "粉彩泥锈战损",
        badge: "泥锈烟熏",
        sampleImageUrl: "/ai-style-refs/weathering_rust_mud.jpg",
        defaultFinish: "matte",
        defaultCrafts: ["panel_lining", "decals", "metallic_frame"],
        defaultBg: "dark_studio",
        defaultLighting: "rim_dramatic",
        prompt:
          "主打粉彩干粉、天然铁锈氧化流痕与泥土积垢的写实陆战旧化工艺（Pigments, Rust Streaks & Soot）：在铆钉下方与雨水通道产生真实红褐色垂直流锈痕，推进喷口与炮口带黑色烟熏积碳晕染，小腿及足部装甲附着干燥泥沙粉尘堆叠质感。",
        enabled: true,
      },
    ],
  },
  {
    id: "candy_metallic",
    name: "金属/珍珠/电镀特效涂装",
    badge: "4项子工艺",
    sampleImageUrl: "/ai-style-refs/candy_metallic.jpg",
    defaultFinish: "gloss",
    defaultCrafts: ["metallic_frame", "led_glow"],
    defaultBg: "dark_studio",
    defaultLighting: "rim_dramatic",
    prompt:
      "高端合金成品与精细特殊涂装商业摄影，微缩机甲全金属/珍珠/电镀特效漆面表现。严格保持原图模型的每一个装甲零件轮廓、比例与姿态完全不变，禁止结构变形。",
    enabled: true,
    subStyles: [
      {
        id: "metallic_chrome",
        name: "铬合金镜面电镀",
        badge: "镜面电镀",
        sampleImageUrl: "/ai-style-refs/metallic_chrome.jpg",
        defaultFinish: "gloss",
        defaultCrafts: ["metallic_frame", "led_glow"],
        defaultBg: "dark_studio",
        defaultLighting: "rim_dramatic",
        prompt:
          "极致亮光黑打底配合真空镀铬/超微粒镜面银喷涂（Chrome Mirror Plating）：装甲呈现出如液体水银或真电镀镀铬金属般的超高反射率镜面高光，清晰映照摄影棚柔和灯带轮廓，配合钛金/枪铁金属骨架形成冷冽精密金属感。",
        enabled: true,
      },
      {
        id: "metallic_candy",
        name: "糖果透明叠喷",
        badge: "电镀糖果",
        sampleImageUrl: "/ai-style-refs/metallic_candy.jpg",
        defaultFinish: "gloss",
        defaultCrafts: ["metallic_frame", "led_glow"],
        defaultBg: "dark_studio",
        defaultLighting: "rim_dramatic",
        prompt:
          "经典黑底亮银打底＋透明光油隔离＋多层透明色罩染糖果漆工艺（Candy Clear Overcoat）：透明漆层呈现出珠宝般深邃浓郁的透射色泽，底层银粉从透明色膜深处闪烁跃出，转角与高光带呈深浅宝石渐变。",
        enabled: true,
      },
      {
        id: "metallic_pearl",
        name: "珍珠/云母偏光",
        badge: "珍珠云母",
        sampleImageUrl: "/ai-style-refs/metallic_pearl.jpg",
        defaultFinish: "metallic_pearl",
        defaultCrafts: ["panel_lining", "metallic_frame"],
        defaultBg: "white_studio",
        defaultLighting: "top_key",
        prompt:
          "高贵细腻珍珠粉/云母片罩染偏光涂装工艺（Pearl / Mica Shimmer）：漆面内均匀悬浮细密柔和的珍珠云母光泽，随着曲面弧度在主色调中流露出淡雅的丝绸金属偏光过渡，既保留陶瓷温润感又不失高级细闪。",
        enabled: true,
      },
      {
        id: "metallic_color",
        name: "常规彩色金属漆",
        badge: "彩色金属",
        sampleImageUrl: "/ai-style-refs/metallic_color.jpg",
        defaultFinish: "metallic_pearl",
        defaultCrafts: ["panel_lining", "metallic_frame"],
        defaultBg: "dark_studio",
        defaultLighting: "soft_dual",
        prompt:
          "工业阳极氧化风彩色金属实色漆喷涂（Colored Metallic Paint，如金属红、金属蓝、金属钛灰）：细腻均匀的铝粉/金属粒子融入主色漆膜，既有清晰硬朗的金属反光颗粒质感，又比透明糖果漆更沉稳内敛富有机械力量感。",
        enabled: true,
      },
    ],
  },
  {
    id: "primer_grey",
    name: "喷灰",
    badge: "水补土灰模",
    sampleImageUrl: "/ai-style-refs/primer_grey.jpg",
    defaultFinish: "matte",
    defaultCrafts: [],
    defaultBg: "white_studio",
    defaultLighting: "top_key",
    prompt:
      "专业模型原型制作与改件修件阶段产品摄影：全机均匀薄喷 #1000/#1200 号细腻中性灰色水补土底漆（Uniform Grey Surfacer Primer），将原本五颜六色的杂色塑料素组或分色零件完全覆盖统一为纯净均匀的中灰色水补土原型灰模状态，彻底消除塑料半透明与分模光泽差异，高清凸显每一条装甲C面折角、机械刻线锐利度与原型雕塑起伏感。严格保持原图模型的机械造型、比例与拍摄角度100%不变。",
    enabled: true,
  },
];

function resolveSampleUrl(rawSample: string, fallbackId: string): string {
  const s = String(rawSample || `${fallbackId}.jpg`).trim();
  if (s.startsWith("/") || s.startsWith("http")) return s;
  return `/ai-style-refs/${s}`;
}

export async function fetchPresetStyles(): Promise<AiPresetStyle[]> {
  if (typeof window === "undefined") return AI_PRESET_STYLES;
  try {
    const resp = await fetch("/ai-style-refs/presets.json", { cache: "no-cache" });
    if (!resp.ok) return AI_PRESET_STYLES;
    const raw = await resp.json();
    if (!Array.isArray(raw)) return AI_PRESET_STYLES;
    const valid: AiPresetStyle[] = raw
      .filter((item: any) => item && item.enabled !== false && item.id && item.name && item.prompt)
      .map((item: any) => {
        const subStyles: AiPresetSubStyle[] | undefined = Array.isArray(item.subStyles)
          ? item.subStyles
              .filter((sub: any) => sub && sub.enabled !== false && sub.id && sub.name && sub.prompt)
              .map((sub: any) => ({
                id: String(sub.id),
                name: String(sub.name),
                badge: String(sub.badge || ""),
                sampleImageUrl: resolveSampleUrl(sub.sampleImage, sub.id),
                defaultFinish: SURFACE_FINISH_OPTIONS.some((f) => f.id === sub.defaultFinish)
                  ? (sub.defaultFinish as SurfaceFinishId)
                  : undefined,
                defaultCrafts: Array.isArray(sub.defaultCrafts)
                  ? sub.defaultCrafts.filter((c: any) =>
                      DETAIL_CRAFT_OPTIONS.some((opt) => opt.id === c)
                    )
                  : undefined,
                defaultBg: STUDIO_BG_OPTIONS.some((b) => b.id === sub.defaultBg)
                  ? (sub.defaultBg as StudioBgId)
                  : undefined,
                defaultLighting: LIGHTING_POS_OPTIONS.some((l) => l.id === sub.defaultLighting)
                  ? (sub.defaultLighting as LightingPosId)
                  : undefined,
                prompt: String(sub.prompt),
                enabled: sub.enabled !== false,
              }))
          : undefined;

        return {
          id: String(item.id),
          name: String(item.name),
          badge: String(item.badge || ""),
          sampleImageUrl: resolveSampleUrl(item.sampleImage, item.id),
          defaultFinish: (SURFACE_FINISH_OPTIONS.some((f) => f.id === item.defaultFinish)
            ? item.defaultFinish
            : "semi_gloss") as SurfaceFinishId,
          defaultCrafts: Array.isArray(item.defaultCrafts)
            ? item.defaultCrafts.filter((c: any) =>
                DETAIL_CRAFT_OPTIONS.some((opt) => opt.id === c)
              )
            : ["panel_lining"],
          defaultBg: (STUDIO_BG_OPTIONS.some((b) => b.id === item.defaultBg)
            ? item.defaultBg
            : "white_studio") as StudioBgId,
          defaultLighting: (LIGHTING_POS_OPTIONS.some((l) => l.id === item.defaultLighting)
            ? item.defaultLighting
            : "soft_dual") as LightingPosId,
          prompt: String(item.prompt),
          subStyles: subStyles && subStyles.length > 0 ? subStyles : undefined,
          enabled: item.enabled !== false,
        };
      });
    return valid.length > 0 ? valid : AI_PRESET_STYLES;
  } catch {
    return AI_PRESET_STYLES;
  }
}

export function resolveEffectivePresetDefaults(
  preset: AiPresetStyle,
  subStyle?: AiPresetSubStyle | null
): {
  finish: SurfaceFinishId;
  crafts: DetailCraftId[];
  bg: StudioBgId;
  lighting: LightingPosId;
} {
  return {
    finish: subStyle?.defaultFinish || preset.defaultFinish,
    crafts: subStyle?.defaultCrafts ? [...subStyle.defaultCrafts] : [...preset.defaultCrafts],
    bg: subStyle?.defaultBg || preset.defaultBg,
    lighting: subStyle?.defaultLighting || preset.defaultLighting,
  };
}

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
    defaultModel: "doubao-seedream-5-5-261028",
    modelSuggestions: [
      "doubao-seedream-5-5-261028",
      "doubao-seedream-5-0-pro-260628",
      "doubao-seedream-5-0-flash-260915",
      "doubao-seedream-5-0-lite-260128",
      "doubao-seedream-4-5-251128",
    ],
    keyApplyUrl: "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey",
    placeholderKey: "粘贴火山方舟 API Key（如 ark-...）",
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
      "doubao-seedream-5-5-261028",
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

export function buildPresetPromptBlocks(opts: {
  presetId: string;
  subStyleId?: string | null;
  presetsList?: AiPresetStyle[];
  finishId: SurfaceFinishId;
  crafts: DetailCraftId[];
  bgId: StudioBgId;
  lightingId: LightingPosId;
  hasStyleRefImage: boolean;
  isCustomStyleRef?: boolean;
  nodes: FloatingSwatchNode[];
  injectPalette: boolean;
  extraUserPrompt?: string;
}): { blocks: PromptBlock[]; prompt: string; overriddenLabels: string[] } {
  const list = opts.presetsList && opts.presetsList.length > 0 ? opts.presetsList : AI_PRESET_STYLES;
  const preset = list.find((p) => p.id === opts.presetId) || list[0];
  const subStyle =
    preset.subStyles && preset.subStyles.length > 0
      ? preset.subStyles.find((s) => s.id === opts.subStyleId) || preset.subStyles[0]
      : null;
  const defaults = resolveEffectivePresetDefaults(preset, subStyle);

  const finish = SURFACE_FINISH_OPTIONS.find((f) => f.id === opts.finishId);
  const bg = STUDIO_BG_OPTIONS.find((b) => b.id === opts.bgId);
  const lighting = LIGHTING_POS_OPTIONS.find((l) => l.id === opts.lightingId);

  const isFinishOverride = opts.finishId !== defaults.finish;
  const isBgOverride = opts.bgId !== defaults.bg;
  const isLightingOverride = opts.lightingId !== defaults.lighting;

  const overriddenLabels: string[] = [];
  if (isFinishOverride && finish) overriddenLabels.push(`漆面质感(${finish.name})`);
  if (isBgOverride && bg) overriddenLabels.push(`摄影背景(${bg.name})`);
  if (isLightingOverride && lighting) overriddenLabels.push(`打光位置(${lighting.name})`);

  const blocks: PromptBlock[] = [
    {
      id: "preset_core",
      label: `01 技法 · ${preset.name}`,
      text: preset.prompt,
      kind: "core",
    },
  ];

  if (subStyle) {
    blocks.push({
      id: "sub_style",
      label: `01-B 细分 · ${subStyle.name}`,
      text: subStyle.prompt,
      kind: "core",
    });
  }

  const craftTexts = opts.crafts
    .map((id) => DETAIL_CRAFT_OPTIONS.find((c) => c.id === id)?.promptFragment)
    .filter(Boolean) as string[];
  if (craftTexts.length > 0) {
    const craftNames = opts.crafts
      .map((id) => DETAIL_CRAFT_OPTIONS.find((c) => c.id === id)?.name)
      .filter(Boolean)
      .join("/");
    blocks.push({
      id: "crafts",
      label: `03 工艺 (${craftNames})`,
      text: craftTexts.join(" "),
      kind: "process",
    });
  }

  if (finish) {
    blocks.push({
      id: "finish",
      label: `02 漆面 · ${finish.name}`,
      text: finish.promptFragment,
      kind: "process",
      isOverride: isFinishOverride,
    });
  }

  if (bg) {
    blocks.push({
      id: "studio_bg",
      label: `04 背景 · ${bg.name}`,
      text: bg.promptFragment,
      kind: "process",
      isOverride: isBgOverride,
    });
  }

  if (lighting) {
    blocks.push({
      id: "lighting",
      label: `05 布光 · ${lighting.name}`,
      text: lighting.promptFragment,
      kind: "process",
      isOverride: isLightingOverride,
    });
  }

  if (opts.hasStyleRefImage) {
    blocks.push({
      id: "style_ref",
      label: opts.isCustomStyleRef ? "自定义样板参考" : "预设样板参考",
      text: "【多图风格参考指令】图1为需要上色的素组/灰模本体，必须100%保持图1的机械轮廓、零件造型与视角；图2为喷涂风格参考样板图，请学习图2的涂装笔触、明暗过渡、阴影重度与漆面粒子质感并迁移到图1模型上，严禁把图2的机体造型或多余部件混入图1；若用户手动指定了漆面光泽、摄影背景或布光，以用户指定工序为准而非照搬图2环境。",
      kind: "ref",
      requiresStyleRef: true,
    });
  }

  if (overriddenLabels.length > 0) {
    blocks.push({
      id: "override_precedence",
      label: "手动覆盖优先",
      text: `【手动工序覆盖优先】用户已明确手动覆盖调整了以下工序参数：${overriddenLabels.join("、")}。无论预设风格或参考样板图原本是什么漆面反光、背景或布光，最终画面都必须100%严格以用户手动选择的积木参数为准。`,
      kind: "rule",
      isOverride: true,
    });
  }

  const paletteClause = opts.injectPalette ? buildProjectPaletteClause(opts.nodes) : "";
  if (paletteClause) {
    blocks.push({
      id: "palette",
      label: "项目色卡配方",
      text: paletteClause,
      kind: "palette",
    });
  }

  blocks.push({
    id: "no_swatch_rule",
    label: "纯净出图约束",
    text: NO_SWATCH_UI_RULE,
    kind: "rule",
  });

  const extra = (opts.extraUserPrompt || "").trim();
  if (extra) {
    blocks.push({
      id: "extra",
      label: "追加指令",
      text: extra,
      kind: "extra",
    });
  }

  return {
    blocks,
    prompt: blocks.map((b) => b.text).join(" "),
    overriddenLabels,
  };
}

export function buildPresetRenderPrompt(opts: {
  presetId: string;
  subStyleId?: string | null;
  presetsList?: AiPresetStyle[];
  finishId: SurfaceFinishId;
  crafts: DetailCraftId[];
  bgId: StudioBgId;
  lightingId: LightingPosId;
  hasStyleRefImage: boolean;
  isCustomStyleRef?: boolean;
  nodes: FloatingSwatchNode[];
  injectPalette: boolean;
  extraUserPrompt?: string;
}): string {
  return buildPresetPromptBlocks(opts).prompt;
}

export function buildRefinePromptBlocks(opts: {
  hasDualRawImage: boolean;
  hasStyleRefImage: boolean;
  isCustomStyleRef?: boolean;
  finishStyle: RefineFinishStyle;
  unpaintedPolicy: RefineUnpaintedPolicy;
  crafts: DetailCraftId[];
  bgId: StudioBgId;
  lightingId: LightingPosId;
  nodes: FloatingSwatchNode[];
  injectPalette: boolean;
  extraUserPrompt?: string;
}): { blocks: PromptBlock[]; prompt: string; overriddenLabels: string[] } {
  const finishObj =
    REFINE_FINISH_OPTIONS.find((f) => f.id === opts.finishStyle) ||
    REFINE_FINISH_OPTIONS[0];
  const bg = STUDIO_BG_OPTIONS.find((b) => b.id === opts.bgId);
  const lighting = LIGHTING_POS_OPTIONS.find((l) => l.id === opts.lightingId);

  const unpaintedClause =
    opts.unpaintedPolicy === "keep_clean"
      ? "对于草图中尚未涂上彩色的原始灰白装甲区域，请整理为干净整洁的白色/浅冷灰消光装甲漆面，不要胡乱涂成花哨杂色。"
      : "对于草图中尚未涂完的留白灰模区域，请结合已上色部位的整体机甲配色逻辑，自然协调地补全对称装甲与机械骨架分色。";

  const baseInstruction = opts.hasDualRawImage
    ? "基于多图联合精修微缩机甲模型：图1为未上色的原始模型实拍底图（提供100%准确的零件轮廓、装甲边界与机械刻线位置），图2为算法模拟局部上色草图（提供目标分色区域与配色位置）。请严格以图1的真实机械边缘与刻线为准，彻底修复图2中算法填色造成的边缘颜色溢出、锯齿毛边、渗色断层与死角漏涂问题，精准还原图2各部位的指定颜色。"
    : "微缩机甲模型模拟上色细节精修：原图为算法模拟上色的模型效果草图，存在局部边缘颜色溢出刻线、填色锯齿以及电子染色不自然的问题。请在严格保持原图模型零件造型、比例视角及已涂色部位颜色方案的前提下，彻底清除跨装甲缝隙的溢色毛边，锐化修复机械刻线边界。";

  const blocks: PromptBlock[] = [
    {
      id: "refine_core",
      label: opts.hasDualRawImage ? "01 双图锁定精修" : "01 溢色修复",
      text: `${baseInstruction} ${unpaintedClause}`,
      kind: "core",
    },
    {
      id: "refine_finish",
      label: `02 漆面 · ${finishObj.name.replace(/（.*）/, "")}`,
      text: finishObj.promptFragment,
      kind: "process",
    },
  ];

  const craftTexts = opts.crafts
    .map((id) => DETAIL_CRAFT_OPTIONS.find((c) => c.id === id)?.promptFragment)
    .filter(Boolean) as string[];
  if (craftTexts.length > 0) {
    const craftNames = opts.crafts
      .map((id) => DETAIL_CRAFT_OPTIONS.find((c) => c.id === id)?.name)
      .filter(Boolean)
      .join("/");
    blocks.push({
      id: "crafts",
      label: `03 工艺 (${craftNames})`,
      text: craftTexts.join(" "),
      kind: "process",
    });
  }

  if (bg) {
    blocks.push({
      id: "studio_bg",
      label: `04 背景 · ${bg.name}`,
      text: bg.promptFragment,
      kind: "process",
    });
  }

  if (lighting) {
    blocks.push({
      id: "lighting",
      label: `05 布光 · ${lighting.name}`,
      text: lighting.promptFragment,
      kind: "process",
    });
  }

  if (opts.hasStyleRefImage) {
    const styleRefIdx = opts.hasDualRawImage ? "图3" : "图2";
    blocks.push({
      id: "style_ref",
      label: opts.isCustomStyleRef ? "自定义样板参考" : "样板质感参考",
      text: `【风格参考样板】${styleRefIdx}为喷涂质感参考样板，请学习${styleRefIdx}的漆面质感与涂装笔触表现，同时保持图1的实体结构、上色分色及用户指定背景/布光不变。`,
      kind: "ref",
      requiresStyleRef: true,
    });
  }

  const paletteClause = opts.injectPalette ? buildProjectPaletteClause(opts.nodes) : "";
  if (paletteClause) {
    blocks.push({
      id: "palette",
      label: "项目色卡配方",
      text: paletteClause,
      kind: "palette",
    });
  }

  blocks.push({
    id: "refine_lock",
    label: "构图与纯净约束",
    text: `最终输出高清微距棚拍模型成品照片质感，严格保持模型原始姿态、结构比例与视角一致，禁止变形或增删零件。 ${NO_SWATCH_UI_RULE}`,
    kind: "rule",
  });

  const extra = (opts.extraUserPrompt || "").trim();
  if (extra) {
    blocks.push({
      id: "extra",
      label: "追加指令",
      text: extra,
      kind: "extra",
    });
  }

  return {
    blocks,
    prompt: blocks.map((b) => b.text).join(" "),
    overriddenLabels: [],
  };
}

export function buildRefineRenderPrompt(opts: {
  hasDualRawImage: boolean;
  hasStyleRefImage: boolean;
  isCustomStyleRef?: boolean;
  finishStyle: RefineFinishStyle;
  unpaintedPolicy: RefineUnpaintedPolicy;
  crafts: DetailCraftId[];
  bgId: StudioBgId;
  lightingId: LightingPosId;
  nodes: FloatingSwatchNode[];
  injectPalette: boolean;
  extraUserPrompt?: string;
}): string {
  return buildRefinePromptBlocks(opts).prompt;
}

// ==========================================
// LocalStorage: Wallet Passkey & BYOK Config
// ==========================================
const PASSKEY_STORAGE_KEY = "gk_ai_wallet_passkey_v1";
const BYOK_STORAGE_KEY = "gk_ai_byok_config_v1";
const CHANNEL_STORAGE_KEY = "gk_ai_channel_pref_v1";
const QUALITY_STORAGE_KEY = "gk_ai_quality_pref_v1";
const OFFICIAL_MODEL_STORAGE_KEY = "gk_ai_official_model_v1";

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

export function loadPreferredOfficialModel(): OfficialModelKey {
  if (typeof window === "undefined") return "seedream-5.5";
  const saved = localStorage.getItem(OFFICIAL_MODEL_STORAGE_KEY);
  if (saved === "seedream-5.0-pro" || saved === "seedream-5.5") return saved;
  return "seedream-5.5";
}

export function savePreferredOfficialModel(m: OfficialModelKey): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(OFFICIAL_MODEL_STORAGE_KEY, m);
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
  officialModel?: OfficialModelKey;
  prompt: string;
  promptBlocks?: PromptBlock[];
  rawImageSources: string[];
  styleRefMode?: "none" | "preset" | "custom";
  presetStyleRefPath?: string | null;
  fallbackStyleRefPath?: string | null;
  customStyleRefSrc?: string | null;
  size?: "1K" | "2K";
  background?: "auto" | "transparent";
  outputFormat?: "png" | "jpeg";
}): Promise<{
  imageDataUrl: string;
  modelUsed: string;
  officialModelUsed?: OfficialModelKey;
  styleRefApplied?: boolean;
  wallet?: WalletInfo;
  costCredits?: number;
}> {
  const compressedImages = await Promise.all(
    params.rawImageSources.map((src) => prepareImageForAiApi(src, 1536))
  );

  let compressedCustomRef: string | undefined;
  if (params.styleRefMode === "custom" && params.customStyleRefSrc) {
    compressedCustomRef = await prepareImageForAiApi(params.customStyleRefSrc, 1536);
  }

  const resp = await fetch("/api/ai-render", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      channel: params.channel,
      passkey: params.passkey,
      byok: params.channel === "byok" ? params.byok : undefined,
      officialModel: params.channel === "official" ? params.officialModel || "seedream-5.5" : undefined,
      prompt: params.prompt,
      promptBlocks: params.promptBlocks,
      images: compressedImages,
      styleRefMode: params.styleRefMode || "none",
      presetStyleRefPath:
        params.styleRefMode === "preset" ? params.presetStyleRefPath || undefined : undefined,
      fallbackStyleRefPath:
        params.styleRefMode === "preset" ? params.fallbackStyleRefPath || undefined : undefined,
      customStyleRefImage: compressedCustomRef,
      size: params.size || "2K",
      background: params.background,
      outputFormat: params.outputFormat,
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
    officialModelUsed: data.officialModelUsed,
    styleRefApplied: data.styleRefApplied,
    wallet: data.wallet,
    costCredits: data.costCredits,
  };
}
