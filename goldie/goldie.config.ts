const APP_ROOT = "/Users/krooshuang/code/ios-GK-mixer";

const config = {
  appRoot: APP_ROOT,
  appPath: `${APP_ROOT}/GK-Mixer/build_sim/Build/Products/Debug-iphonesimulator/GK-Mixer.app`,
  bundleId: "com.hdinever-studio.GK-Mixer",

  devices: ["iphone-6.9"],
  locales: ["en-US"],
  appearance: "light",

  frame: { variant: "17-pro-silver" },

  theme: {
    background: "linear-gradient(180deg, #FFFFFF 0%, #FFF8F2 40%, #FFF0E6 100%)",
    headlineColor: "#1A1A1A",
    subheadColor: "#6B6B6B",
    fontFamily: "noto-sans-sc",
    copyHeightRatio: 0.22,
    deviceWidthRatio: 0.82,
    template: "magazine",
    layout: "classic",
  },

  store: {
    name: "GKMixer",
    subtitle: { "en-US": "模型涂装调色助手" },
    developer: "HDiNEVER Studio",
    category: "工具",
    rating: 4.9,
    ratingCount: "100+ 评分",
    ageRating: "4+",
    price: "免费",
    description: {
      "en-US":
        "GKMixer 是模型涂装爱好者的调色助手。拍照取色、智能配方、品牌油漆数据库，让调色变得简单精确。支持盖亚、匠域、喵匠等多品牌油漆数据库查询，Mixbox 专业混色算法，RAL/Vallejo 色号匹配。",
    },
  },

  scenes: [
    {
      kind: "screenshot",
      id: "color-picker",
      flow: "store-01-color-picker",
      headline: { "en-US": "拍照取色，一键识别" },
      subhead: { "en-US": "从模型照片精准提取颜色，自动匹配最近似油漆" },
    },
    {
      kind: "screenshot",
      id: "card-adjust",
      flow: "store-02-card-adjust",
      headline: { "en-US": "色卡精调，所见即所得" },
      subhead: { "en-US": "自由调整色卡位置与排列，完美呈现配色方案" },
    },
    {
      kind: "screenshot",
      id: "basic-mixing",
      flow: "store-03-basic-mixing",
      headline: { "en-US": "基础调色，直觉操控" },
      subhead: { "en-US": "滑动调节基础颜料比例，实时预览混合结果" },
    },
    {
      kind: "screenshot",
      id: "custom-mixing",
      flow: "store-04-custom-mixing",
      headline: { "en-US": "自选调色，精确配方" },
      subhead: { "en-US": "自由添加品牌油漆混色，RAL 色号智能匹配" },
    },
    {
      kind: "screenshot",
      id: "paint-database",
      flow: "store-05-paint-database",
      headline: { "en-US": "全品牌油漆库" },
      subhead: { "en-US": "盖亚、匠域、喵匠等主流品牌色号一网打尽" },
    },
    {
      kind: "screenshot",
      id: "palette",
      flow: "store-06-palette",
      headline: { "en-US": "调色板，灵感收藏" },
      subhead: { "en-US": "收藏常用颜色，跨品牌比对一目了然" },
    },
    {
      kind: "screenshot",
      id: "paint-detail",
      flow: "store-07-paint-detail",
      headline: { "en-US": "色号详情，一目了然" },
      subhead: { "en-US": "查看油漆详细信息，HEX、光泽、品牌一应俱全" },
    },
    {
      kind: "screenshot",
      id: "mixbox-formula",
      flow: "store-08-mixbox-formula",
      headline: { "en-US": "Mixbox 专业配方" },
      subhead: { "en-US": "分层用量可视化，精确到毫升和滴数比" },
    },
  ],
};

export default config;
