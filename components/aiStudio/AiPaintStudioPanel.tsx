import React, { useEffect, useMemo, useRef, useState } from "react";
import type { FloatingSwatchNode, PartCanvas } from "../../types";
import {
  AI_PRESET_STYLES,
  AiChannelMode,
  AiPresetStyle,
  AiPresetSubStyle,
  AiRenderQuality,
  AiStudioMode,
  BYOK_PROVIDER_PRESETS,
  ByokConfig,
  ByokProviderId,
  DEFAULT_OFFICIAL_PRICING_MATRIX,
  DETAIL_CRAFT_OPTIONS,
  DetailCraftId,
  LIGHTING_POS_OPTIONS,
  LightingPosId,
  OfficialModelKey,
  OfficialPricingMatrix,
  REFINE_FINISH_OPTIONS,
  RefineFinishStyle,
  RefineUnpaintedPolicy,
  STUDIO_BG_OPTIONS,
  SURFACE_FINISH_OPTIONS,
  StudioBgId,
  SurfaceFinishId,
  WalletInfo,
  buildPresetPromptBlocks,
  buildRefinePromptBlocks,
  fetchPresetStyles,
  fetchWalletStatus,
  getOrCreateWalletPasskey,
  loadByokConfig,
  loadPreferredChannel,
  loadPreferredOfficialModel,
  loadPreferredQuality,
  redeemCreditCode,
  resolveEffectivePresetDefaults,
  runAiPaintRender,
  saveByokConfig,
  savePreferredChannel,
  savePreferredOfficialModel,
  savePreferredQuality,
  saveWalletPasskey,
  testByokConnection,
} from "../../utils/aiPaintStudio";
import { localizedBrand } from "../../utils/paintCatalog";
import {
  ArrowCounterClockwiseIcon,
  ArrowSquareOutIcon,
  ArrowsLeftRightIcon,
  CheckCircleIcon,
  CheckIcon,
  CircleNotchIcon,
  CopyIcon,
  DownloadSimpleIcon,
  ImageSquareIcon,
  KeyIcon,
  LightningIcon,
  MagicWandIcon,
  PaletteIcon,
  PlusIcon,
  SparkleIcon,
  UploadSimpleIcon,
  WalletIcon,
  WarningIcon,
} from "@phosphor-icons/react";

export interface AiLiveStageState {
  beforeSrc: string;
  dualRawRefSrc: string | null;
  generatedImageUrl: string | null;
  generatedLabel: string;
  rendering: boolean;
  elapsedSec: number;
  onRequestUpload: () => void;
}

/** 渲染在左侧主预览台 (partStageCard) 内的无遮挡底图与前后分割对比画布 */
export const AiLiveComparisonStage: React.FC<{
  stage: AiLiveStageState;
}> = ({ stage }) => {
  const [splitPercent, setSplitPercent] = useState<number>(50);
  const [holdingOriginal, setHoldingOriginal] = useState<boolean>(false);

  useEffect(() => {
    if (stage.generatedImageUrl) {
      setSplitPercent(50);
    }
  }, [stage.generatedImageUrl]);

  if (!stage.beforeSrc) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-8 text-center min-h-[260px]">
        <ImageSquareIcon className="h-12 w-12 text-slate-500" />
        <p className="text-xs sm:text-sm font-bold text-slate-300">
          尚未上传模型底图，请上传一张素组、灰模或模拟上色照片
        </p>
        <button
          type="button"
          onClick={stage.onRequestUpload}
          className="gk-btn-primary inline-flex items-center gap-1.5 rounded-xl bg-coral px-4 py-2 text-xs font-extrabold text-white cursor-pointer"
        >
          <UploadSimpleIcon className="h-4 w-4" weight="bold" />
          <span>上传模型照片</span>
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center select-none min-h-[260px] sm:min-h-[340px]">
      {stage.generatedImageUrl ? (
        <div className="relative w-full h-full flex items-center justify-center">
          <img
            src={holdingOriginal ? stage.beforeSrc : stage.generatedImageUrl}
            alt="AI 涂装效果图"
            className="max-h-[480px] w-auto max-w-full object-contain rounded-lg block"
            draggable={false}
          />

          {!holdingOriginal && (
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              style={{
                clipPath: `inset(0 ${100 - splitPercent}% 0 0)`,
              }}
            >
              <img
                src={stage.beforeSrc}
                alt="原始底图"
                className="max-h-[480px] w-auto max-w-full object-contain rounded-lg block"
                draggable={false}
              />
            </div>
          )}

          {!holdingOriginal && (
            <div
              className="absolute inset-y-0 pointer-events-none"
              style={{ left: `${splitPercent}%` }}
            >
              <div className="h-full w-0.5 bg-white shadow-[0_0_10px_rgba(0,0,0,0.85)]" />
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-900 shadow-lg border border-slate-300">
                <ArrowsLeftRightIcon className="h-4 w-4" weight="bold" />
              </div>
            </div>
          )}

          <input
            type="range"
            min={0}
            max={100}
            value={splitPercent}
            onChange={(e) => setSplitPercent(Number(e.target.value))}
            aria-label="原图与AI效果图对比滑杆"
            className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20"
          />

          <span className="absolute top-2.5 left-2.5 z-10 rounded-full bg-slate-900/85 border border-white/15 px-2.5 py-0.5 text-[10px] font-extrabold text-slate-200 pointer-events-none">
            原图 (Before)
          </span>
          <span className="absolute top-2.5 right-2.5 z-10 rounded-full bg-coral/95 px-2.5 py-0.5 text-[10px] font-extrabold text-white pointer-events-none">
            {stage.generatedLabel || "AI 涂装后 (After)"}
          </span>
          <button
            type="button"
            onMouseDown={() => setHoldingOriginal(true)}
            onMouseUp={() => setHoldingOriginal(false)}
            onMouseLeave={() => setHoldingOriginal(false)}
            onTouchStart={() => setHoldingOriginal(true)}
            onTouchEnd={() => setHoldingOriginal(false)}
            className="bp-btn absolute bottom-2.5 right-2.5 z-30 rounded-xl bg-slate-900/85 hover:bg-slate-900 border border-white/20 px-2.5 py-1 text-[11px] font-bold text-white cursor-pointer"
          >
            按住看原图
          </button>
        </div>
      ) : (
        <div className="relative w-full flex items-center justify-center">
          <img
            src={stage.beforeSrc}
            alt="待处理模型底图"
            className="max-h-[480px] w-auto max-w-full object-contain rounded-lg block"
            draggable={false}
          />
          {stage.dualRawRefSrc && (
            <div className="absolute bottom-2.5 left-2.5 flex items-center gap-2 rounded-xl bg-slate-900/90 border border-white/15 p-1.5 pr-3 text-[11px] text-white backdrop-blur-md">
              <img
                src={stage.dualRawRefSrc}
                alt="素组原图参考"
                className="h-9 w-9 rounded-lg object-cover border border-white/20"
              />
              <div>
                <div className="font-extrabold text-emerald-400 leading-tight">
                  双图联合锁定已就绪
                </div>
                <div className="text-[10px] text-slate-300 leading-tight">
                  原图锁定锐利刻线 + 模拟上色提供分色
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {stage.rendering && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 rounded-xl bg-slate-950/80 backdrop-blur-sm p-6 text-center">
          <CircleNotchIcon className="h-10 w-10 text-coral animate-spin" weight="bold" />
          <div className="space-y-1">
            <p className="text-sm font-black text-white">
              正在调用官方 Seedream 绘制漆面与刻线细节... ({stage.elapsedSec}s)
            </p>
            <p className="text-xs text-slate-300">
              通常耗时 8 ~ 20 秒，若上游接口异常将自动原路退回点数
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

interface AiPaintStudioPanelProps {
  projectTitle: string;
  activePart?: PartCanvas;
  activePartImageSrc?: string;
  onStageStateChange?: (stage: AiLiveStageState) => void;
  onReplaceCoverAndPartImage: (imageDataUrl: string, appliedLabel: string) => void;
  onAppendAsNewPart: (imageDataUrl: string, partName: string, appliedLabel: string) => void;
  onRestoreOriginalBeforeAi?: () => void;
}

const RECHARGE_TIERS = [
  { id: "starter", name: "入门特惠包", coins: "10 币", priceNote: "≈¥7.2", points: 60, renders1k: 12, renders2k: 6, badge: "入门" },
  { id: "lite", name: "轻量尝鲜包", coins: "15 币", priceNote: "≈¥10.8", points: 70, renders1k: 14, renders2k: 7, badge: "" },
  { id: "main", name: "主力涂装包", coins: "39 币", priceNote: "≈¥28.1", points: 200, renders1k: 40, renders2k: 20, badge: "推荐" },
  { id: "studio", name: "工作室包", coins: "99 币", priceNote: "≈¥71.3", points: 550, renders1k: 110, renders2k: 55, badge: "" },
  { id: "monthly", name: "月度赞助", coins: "12 币/月", priceNote: "含50点/月", points: 50, renders1k: 10, renders2k: 5, badge: "赞助" },
];

export const AiPaintStudioPanel: React.FC<AiPaintStudioPanelProps> = ({
  projectTitle,
  activePart,
  activePartImageSrc,
  onStageStateChange,
  onReplaceCoverAndPartImage,
  onAppendAsNewPart,
  onRestoreOriginalBeforeAi,
}) => {
  const hasStudioRawRef = Boolean(
    activePart?.studioSession?.rawSourceImageDataUrl &&
      activePart.studioSession.rawSourceImageDataUrl.startsWith("data:image")
  );

  const [mode, setMode] = useState<AiStudioMode>(() =>
    hasStudioRawRef ? "refine" : "preset"
  );
  const [channel, setChannel] = useState<AiChannelMode>(() => loadPreferredChannel());
  const [officialModel, setOfficialModel] = useState<OfficialModelKey>(() =>
    loadPreferredOfficialModel()
  );
  const [renderQuality, setRenderQuality] = useState<AiRenderQuality>(() => loadPreferredQuality());
  const [drawerTab, setDrawerTab] = useState<"none" | "wallet" | "byok">("none");

  // Source image states
  const [customUploadedSrc, setCustomUploadedSrc] = useState<string | null>(null);
  const [useUnpaintedRawInPreset, setUseUnpaintedRawInPreset] = useState<boolean>(hasStudioRawRef);
  const [useDualRefInRefine, setUseDualRefInRefine] = useState<boolean>(hasStudioRawRef);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dynamic Preset Manifest + Process Configurator options
  const [presetStyles, setPresetStyles] = useState<AiPresetStyle[]>(AI_PRESET_STYLES);
  const [selectedPresetId, setSelectedPresetId] = useState<string>(AI_PRESET_STYLES[0].id);
  const [selectedSubStyleIds, setSelectedSubStyleIds] = useState<string[]>(
    AI_PRESET_STYLES[0].subStyles?.[0] ? [AI_PRESET_STYLES[0].subStyles[0].id] : []
  );
  const [finishId, setFinishId] = useState<SurfaceFinishId>(AI_PRESET_STYLES[0].defaultFinish);
  const [crafts, setCrafts] = useState<DetailCraftId[]>([...AI_PRESET_STYLES[0].defaultCrafts]);
  const [bgId, setBgId] = useState<StudioBgId>(AI_PRESET_STYLES[0].defaultBg);
  const [lightingId, setLightingId] = useState<LightingPosId>(AI_PRESET_STYLES[0].defaultLighting);

  // Style Reference Sample image (backend preset/sub-style slot + user custom upload)
  const [customStyleRefSrc, setCustomStyleRefSrc] = useState<string | null>(null);
  const [useStyleRef, setUseStyleRef] = useState<boolean>(true);
  const [loadedRefMap, setLoadedRefMap] = useState<Record<string, boolean>>({});
  const [previewTab, setPreviewTab] = useState<"result" | "ref">("ref");
  const styleRefInputRef = useRef<HTMLInputElement>(null);

  const [injectPalette, setInjectPalette] = useState<boolean>(
    Boolean(activePart?.nodes && activePart.nodes.length > 0)
  );
  const [extraPrompt, setExtraPrompt] = useState<string>("");
  const [showFullPromptPreview, setShowFullPromptPreview] = useState<boolean>(false);

  // Refine Mode options
  const [refineFinish, setRefineFinish] = useState<RefineFinishStyle>("matte_studio");
  const [unpaintedPolicy, setUnpaintedPolicy] = useState<RefineUnpaintedPolicy>("keep_clean");

  // Wallet & Credits
  const [passkey, setPasskey] = useState<string>(() => getOrCreateWalletPasskey());
  const [restorePasskeyInput, setRestorePasskeyInput] = useState<string>("");
  const [showRestorePasskey, setShowRestorePasskey] = useState<boolean>(false);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [officialReady, setOfficialReady] = useState<boolean>(true);
  const [pricingMatrix, setPricingMatrix] = useState<OfficialPricingMatrix>(
    DEFAULT_OFFICIAL_PRICING_MATRIX
  );
  const [redeemInput, setRedeemInput] = useState<string>("");
  const [redeeming, setRedeeming] = useState<boolean>(false);

  const activeModelPricing = pricingMatrix[officialModel] || DEFAULT_OFFICIAL_PRICING_MATRIX["seedream-5.5"];
  const activeCost1k = activeModelPricing.cost1k;
  const activeCost2k = activeModelPricing.cost2k;
  const activeRenderCost = renderQuality === "1K" ? activeCost1k : activeCost2k;

  // BYOK state
  const [byok, setByok] = useState<ByokConfig>(() => loadByokConfig());
  const [testingByok, setTestingByok] = useState<boolean>(false);
  const [byokStatusMsg, setByokStatusMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Render execution state
  const [rendering, setRendering] = useState<boolean>(false);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [generatedLabel, setGeneratedLabel] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const rechargeUrlUnifans =
    (import.meta as any).env?.VITE_RECHARGE_URL_UNIFANS ||
    (import.meta as any).env?.VITE_RECHARGE_URL_CN ||
    "https://app.unifans.io/c/gk_mixer0428";
  const rechargeUrlGlobal = (import.meta as any).env?.VITE_RECHARGE_URL_GLOBAL || "";

  // Reset part-specific overrides when user switches part tab
  useEffect(() => {
    setUseUnpaintedRawInPreset(hasStudioRawRef);
    setUseDualRefInRefine(hasStudioRawRef);
    setInjectPalette(Boolean(activePart?.nodes && activePart.nodes.length > 0));
    setCustomUploadedSrc(null);
    setGeneratedImageUrl(null);
    setErrorMsg(null);
  }, [activePart?.id, hasStudioRawRef]);

  // Load dynamic preset manifest (/ai-style-refs/presets.json)
  useEffect(() => {
    let cancelled = false;
    fetchPresetStyles().then((loaded) => {
      if (cancelled || !loaded || loaded.length === 0) return;
      setPresetStyles(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch wallet credits & model pricing matrix
  useEffect(() => {
    let cancelled = false;
    fetchWalletStatus(passkey)
      .then((res) => {
        if (cancelled) return;
        setWallet(res.wallet);
        setOfficialReady(res.officialReady);
        if (res.pricingMatrix) {
          setPricingMatrix(res.pricingMatrix);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [passkey]);

  // Elapsed timer while rendering
  useEffect(() => {
    if (!rendering) {
      setElapsedSec(0);
      return;
    }
    const start = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - start) / 1000));
    }, 500);
    return () => window.clearInterval(timer);
  }, [rendering]);

  const flashNotice = (msg: string) => {
    setStatusNotice(msg);
    window.setTimeout(() => setStatusNotice(null), 2800);
  };

  const primaryBeforeSrc = useMemo(() => {
    if (customUploadedSrc) return customUploadedSrc;
    if (
      mode === "preset" &&
      useUnpaintedRawInPreset &&
      activePart?.studioSession?.rawSourceImageDataUrl
    ) {
      return activePart.studioSession.rawSourceImageDataUrl;
    }
    return activePartImageSrc || activePart?.sourceImageDataUrl || "";
  }, [
    customUploadedSrc,
    mode,
    useUnpaintedRawInPreset,
    activePart?.studioSession?.rawSourceImageDataUrl,
    activePartImageSrc,
    activePart?.sourceImageDataUrl,
  ]);

  const effectiveDualRawRef = useMemo(() => {
    if (
      mode === "refine" &&
      !customUploadedSrc &&
      useDualRefInRefine &&
      activePart?.studioSession?.rawSourceImageDataUrl
    ) {
      return activePart.studioSession.rawSourceImageDataUrl;
    }
    return null;
  }, [mode, customUploadedSrc, useDualRefInRefine, activePart?.studioSession?.rawSourceImageDataUrl]);

  // Sync live visual stage state to parent left column (partStageCard)
  useEffect(() => {
    onStageStateChange?.({
      beforeSrc: primaryBeforeSrc,
      dualRawRefSrc: effectiveDualRawRef,
      generatedImageUrl,
      generatedLabel,
      rendering,
      elapsedSec,
      onRequestUpload: () => fileInputRef.current?.click(),
    });
  }, [
    onStageStateChange,
    primaryBeforeSrc,
    effectiveDualRawRef,
    generatedImageUrl,
    generatedLabel,
    rendering,
    elapsedSec,
  ]);

  const activePresetObj = useMemo(
    () => presetStyles.find((s) => s.id === selectedPresetId) || presetStyles[0] || AI_PRESET_STYLES[0],
    [presetStyles, selectedPresetId]
  );

  const isSubStyleMulti = activePresetObj.subStyleSelection === "multiple";

  const activeSubStyles: AiPresetSubStyle[] = useMemo(() => {
    if (!activePresetObj.subStyles || activePresetObj.subStyles.length === 0) return [];
    const matched = activePresetObj.subStyles.filter((s) => selectedSubStyleIds.includes(s.id));
    if (matched.length === 0) return [activePresetObj.subStyles[0]];
    return isSubStyleMulti ? matched : [matched[0]];
  }, [activePresetObj, selectedSubStyleIds, isSubStyleMulti]);

  const primarySubStyleObj: AiPresetSubStyle | null = activeSubStyles[0] || null;

  const activeDefaults = useMemo(
    () => resolveEffectivePresetDefaults(activePresetObj, primarySubStyleObj),
    [activePresetObj, primarySubStyleObj]
  );

  const probeUrls = useMemo(() => {
    const urls: string[] = [];
    for (const sub of activeSubStyles) {
      if (sub.sampleImageUrl && !urls.includes(sub.sampleImageUrl)) {
        urls.push(sub.sampleImageUrl);
      }
    }
    if (activePresetObj.sampleImageUrl && !urls.includes(activePresetObj.sampleImageUrl)) {
      urls.push(activePresetObj.sampleImageUrl);
    }
    return urls;
  }, [activeSubStyles, activePresetObj.sampleImageUrl]);

  const loadedPresetRefItems = useMemo(() => {
    if (activeSubStyles.length > 0) {
      const subItems = activeSubStyles
        .filter((sub) => loadedRefMap[sub.sampleImageUrl] === true)
        .slice(0, 2)
        .map((sub) => ({ url: sub.sampleImageUrl, label: sub.name }));
      if (subItems.length > 0) return subItems;
    }
    if (loadedRefMap[activePresetObj.sampleImageUrl] === true) {
      return [{ url: activePresetObj.sampleImageUrl, label: activePresetObj.name }];
    }
    return [];
  }, [activeSubStyles, activePresetObj, loadedRefMap]);

  const effectiveStyleRefSrc = useMemo(() => {
    if (!useStyleRef) return null;
    if (customStyleRefSrc) return customStyleRefSrc;
    if (mode === "preset" && loadedPresetRefItems.length > 0) return loadedPresetRefItems[0].url;
    return null;
  }, [useStyleRef, customStyleRefSrc, mode, loadedPresetRefItems]);

  const activeStyleRefLabels = useMemo(() => {
    if (!useStyleRef) return [];
    if (customStyleRefSrc) return ["自定义作品样板"];
    if (mode === "preset") return loadedPresetRefItems.map((i) => i.label);
    return [];
  }, [useStyleRef, customStyleRefSrc, mode, loadedPresetRefItems]);

  const applyPresetDefaults = (p: AiPresetStyle, sub?: AiPresetSubStyle | null) => {
    const d = resolveEffectivePresetDefaults(p, sub);
    setFinishId(d.finish);
    setCrafts([...d.crafts]);
    setBgId(d.bg);
    setLightingId(d.lighting);
    if (p.id === "primer_grey") {
      setInjectPalette(false);
    } else if (activePart?.nodes && activePart.nodes.length > 0) {
      setInjectPalette(true);
    }
  };

  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const p = presetStyles.find((s) => s.id === presetId);
    if (p) {
      const firstSub = p.subStyles?.[0] || null;
      setSelectedSubStyleIds(firstSub ? [firstSub.id] : []);
      applyPresetDefaults(p, firstSub);
    } else {
      setSelectedSubStyleIds([]);
    }
  };

  const handleSelectSubStyle = (subId: string) => {
    const sub = activePresetObj.subStyles?.find((s) => s.id === subId) || null;
    if (isSubStyleMulti) {
      setSelectedSubStyleIds((prev) => {
        const exists = prev.includes(subId);
        if (exists) {
          return prev.length <= 1 ? prev : prev.filter((id) => id !== subId);
        }
        return [...prev, subId];
      });
    } else {
      setSelectedSubStyleIds([subId]);
      if (sub) {
        applyPresetDefaults(activePresetObj, sub);
      }
    }
  };

  const isFinishOverridden = mode === "preset" && finishId !== activeDefaults.finish;
  const isBgOverridden = mode === "preset" && bgId !== activeDefaults.bg;
  const isLightingOverridden = mode === "preset" && lightingId !== activeDefaults.lighting;
  const isCraftsOverridden = useMemo(() => {
    if (mode !== "preset") return false;
    const def = [...activeDefaults.crafts].sort().join(",");
    const cur = [...crafts].sort().join(",");
    return def !== cur;
  }, [mode, activeDefaults.crafts, crafts]);
  const hasAnyOverride =
    isFinishOverridden || isBgOverridden || isLightingOverridden || isCraftsOverridden;

  const toggleCraft = (craftId: DetailCraftId) => {
    setCrafts((prev) =>
      prev.includes(craftId) ? prev.filter((id) => id !== craftId) : [...prev, craftId]
    );
  };

  const handleUploadStyleRef = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCustomStyleRefSrc(reader.result);
        setUseStyleRef(true);
        setPreviewTab("ref");
        flashNotice("✓ 已加载自定义参考样板图，生成时将自动学习其喷涂笔触并叠加工序积木");
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const promptAssembly = useMemo(() => {
    const nodes: FloatingSwatchNode[] = activePart?.nodes || [];
    const hasStyleRefImage = Boolean(effectiveStyleRefSrc);
    const isCustomStyleRef = Boolean(useStyleRef && customStyleRefSrc);
    if (mode === "preset") {
      return buildPresetPromptBlocks({
        presetId: selectedPresetId,
        subStyleIds: activeSubStyles.map((s) => s.id),
        presetsList: presetStyles,
        finishId,
        crafts,
        bgId,
        lightingId,
        hasStyleRefImage,
        styleRefLabels: activeStyleRefLabels,
        isCustomStyleRef,
        nodes,
        injectPalette,
        extraUserPrompt: extraPrompt,
      });
    }
    return buildRefinePromptBlocks({
      hasDualRawImage: Boolean(effectiveDualRawRef),
      hasStyleRefImage,
      isCustomStyleRef,
      finishStyle: refineFinish,
      unpaintedPolicy,
      crafts,
      bgId,
      lightingId,
      nodes,
      injectPalette,
      extraUserPrompt: extraPrompt,
    });
  }, [
    mode,
    selectedPresetId,
    activeSubStyles,
    presetStyles,
    finishId,
    crafts,
    bgId,
    lightingId,
    effectiveStyleRefSrc,
    activeStyleRefLabels,
    useStyleRef,
    customStyleRefSrc,
    activePart?.nodes,
    injectPalette,
    extraPrompt,
    effectiveDualRawRef,
    refineFinish,
    unpaintedPolicy,
  ]);
  const finalPrompt = promptAssembly.prompt;

  const subStyleSummaryText = activeSubStyles.map((s) => s.name).join(" + ");

  const currentModeSummaryLabel = useMemo(() => {
    if (mode === "preset") {
      return subStyleSummaryText
        ? `AI ${activePresetObj.name} · ${subStyleSummaryText}`
        : `AI ${activePresetObj.name}`;
    }
    const r = REFINE_FINISH_OPTIONS.find((f) => f.id === refineFinish);
    return r ? `AI 精修 · ${r.name.replace(/（.*）/, "")}` : "AI 模拟上色精修";
  }, [mode, activePresetObj.name, subStyleSummaryText, refineFinish]);

  const handleChannelSwitch = (next: AiChannelMode) => {
    setChannel(next);
    savePreferredChannel(next);
    setErrorMsg(null);
    if (next === "byok" && !byok.apiKey.trim()) {
      setDrawerTab("byok");
    } else if (drawerTab === "byok" && next === "official") {
      setDrawerTab("none");
    }
  };

  const handleUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCustomUploadedSrc(reader.result);
        setGeneratedImageUrl(null);
        setErrorMsg(null);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleProviderChange = (providerId: ByokProviderId) => {
    const preset =
      BYOK_PROVIDER_PRESETS.find((p) => p.id === providerId) || BYOK_PROVIDER_PRESETS[0];
    const updated: ByokConfig = {
      ...byok,
      provider: providerId,
      baseUrl: preset.defaultBaseUrl,
      model: preset.defaultModel,
    };
    setByok(updated);
    saveByokConfig(updated);
    setByokStatusMsg(null);
  };

  const handleSaveByokField = (patch: Partial<ByokConfig>) => {
    const updated = { ...byok, ...patch };
    setByok(updated);
    saveByokConfig(updated);
    setByokStatusMsg(null);
  };

  const handleTestByok = async () => {
    if (!byok.apiKey.trim()) {
      setByokStatusMsg({ ok: false, text: "请先粘贴你的 API Key" });
      return;
    }
    setTestingByok(true);
    setByokStatusMsg(null);
    try {
      const msg = await testByokConnection(byok);
      setByokStatusMsg({ ok: true, text: msg });
    } catch (err: any) {
      setByokStatusMsg({ ok: false, text: err?.message || "连接测试失败" });
    } finally {
      setTestingByok(false);
    }
  };

  const handleRedeem = async () => {
    if (!redeemInput.trim()) return;
    setRedeeming(true);
    setErrorMsg(null);
    try {
      const res = await redeemCreditCode(passkey, redeemInput);
      setWallet(res.wallet);
      setRedeemInput("");
      flashNotice(`🎉 充值成功 +${res.addedPoints} 点！当前共 ${res.wallet.credits} 点`);
    } catch (err: any) {
      setErrorMsg(err?.message || "兑换码核销失败");
    } finally {
      setRedeeming(false);
    }
  };

  const handleRestorePasskey = () => {
    const candidate = restorePasskeyInput.trim().toUpperCase();
    if (!saveWalletPasskey(candidate)) {
      setErrorMsg("通行证密钥格式应为 GKM-XXXX-XXXX-XXXX");
      return;
    }
    setPasskey(candidate);
    setShowRestorePasskey(false);
    setRestorePasskeyInput("");
    flashNotice("已切换并同步通行证密钥");
  };

  const handleStartRender = async () => {
    if (!primaryBeforeSrc) {
      setErrorMsg("请先上传一张素组/灰模或模拟上色模型照片");
      return;
    }
    if (channel === "byok" && !byok.apiKey.trim()) {
      setDrawerTab("byok");
      setErrorMsg("请先填写你的自带 API Key，或切换到「官方 Seedream」通道");
      return;
    }

    setRendering(true);
    setErrorMsg(null);

    try {
      const inputSources = effectiveDualRawRef
        ? [effectiveDualRawRef, primaryBeforeSrc]
        : [primaryBeforeSrc];
      const styleRefMode: "none" | "preset" | "custom" = !useStyleRef
        ? "none"
        : customStyleRefSrc
        ? "custom"
        : mode === "preset" && loadedPresetRefItems.length > 0
        ? "preset"
        : "none";

      const isTransparentBg = bgId === "transparent";
      const res = await runAiPaintRender({
        channel,
        passkey,
        byok,
        officialModel,
        prompt: finalPrompt,
        promptBlocks: promptAssembly.blocks,
        rawImageSources: inputSources,
        styleRefMode,
        presetStyleRefPath:
          styleRefMode === "preset" ? loadedPresetRefItems[0]?.url || null : null,
        presetStyleRefPaths:
          styleRefMode === "preset" ? loadedPresetRefItems.map((i) => i.url) : undefined,
        fallbackStyleRefPath:
          styleRefMode === "preset" ? activePresetObj.sampleImageUrl : null,
        customStyleRefSrc: styleRefMode === "custom" ? customStyleRefSrc : null,
        size: renderQuality,
        background: isTransparentBg ? "transparent" : "auto",
        outputFormat: isTransparentBg ? "png" : undefined,
      });

      setGeneratedImageUrl(res.imageDataUrl);
      setGeneratedLabel(currentModeSummaryLabel);
      setPreviewTab("result");
      if (res.wallet) {
        setWallet(res.wallet);
      }
      flashNotice("✨ AI 涂装效果图已生成！可在右侧预览窗口直接对比与导出");
    } catch (err: any) {
      if (err?.wallet) {
        setWallet(err.wallet);
      }
      if (err?.code === "INSUFFICIENT_CREDITS") {
        setDrawerTab("wallet");
      }
      setErrorMsg(err?.message || "生成失败，请稍后重试");
    } finally {
      setRendering(false);
    }
  };

  const handleDownloadResult = () => {
    if (!generatedImageUrl) return;
    const ext = generatedImageUrl.startsWith("data:image/png") ? "png" : "jpg";
    const a = document.createElement("a");
    a.href = generatedImageUrl;
    a.download = `${projectTitle || "GK-Mixer"}-${generatedLabel || "AI涂装"}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const activeProviderMeta =
    BYOK_PROVIDER_PRESETS.find((p) => p.id === byok.provider) || BYOK_PROVIDER_PRESETS[0];

  return (
    <div className="space-y-3.5">
      {/* Status Toast Inline Banner */}
      {statusNotice && (
        <div className="bp-subcard flex items-center gap-2 rounded-2xl border border-emerald-500/45 bg-emerald-500/10 px-3.5 py-2 text-xs font-extrabold text-emerald-700 dark:text-emerald-300">
          <CheckCircleIcon className="h-4 w-4 shrink-0" weight="fill" />
          <span>{statusNotice}</span>
        </div>
      )}

      {/* 1. Compact Channel & Source Toolbar Card */}
      <div className="bp-subcard rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 p-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Channel Switcher */}
          <div className="bp-segmented inline-flex rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5">
            <button
              type="button"
              onClick={() => handleChannelSwitch("official")}
              className={`bp-segmented-item inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-extrabold transition cursor-pointer ${
                channel === "official"
                  ? "bp-segmented-item-active bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <LightningIcon className="h-3.5 w-3.5 text-amber-400" weight="fill" />
              <span>官方 {officialModel === "seedream-5.5" ? "5.5" : "5.0 Pro"}</span>
              <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[10px] text-amber-600 dark:text-amber-300 tabular-nums">
                {wallet ? `${wallet.credits}点` : "..."}
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleChannelSwitch("byok")}
              className={`bp-segmented-item inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-extrabold transition cursor-pointer ${
                channel === "byok"
                  ? "bp-segmented-item-active bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <KeyIcon className="h-3.5 w-3.5 text-emerald-500" weight="bold" />
              <span>自带 API 免费用</span>
              {byok.apiKey.trim() && (
                <span className="h-2 w-2 rounded-full bg-emerald-500" title="已配置本地 API Key" />
              )}
            </button>
          </div>

          {/* Right Quick Actions: Upload / Restore / Wallet or BYOK Config */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="bp-pill inline-flex h-8 items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 text-xs font-extrabold text-slate-700 dark:text-slate-200 hover:border-coral transition cursor-pointer"
            >
              <UploadSimpleIcon className="h-3.5 w-3.5 text-coral" weight="bold" />
              <span>{customUploadedSrc ? "换一张照片" : "上传素组/灰模照"}</span>
            </button>

            {customUploadedSrc && (
              <button
                type="button"
                onClick={() => {
                  setCustomUploadedSrc(null);
                  setGeneratedImageUrl(null);
                }}
                className="bp-pill inline-flex h-8 items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 px-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                <ArrowCounterClockwiseIcon className="h-3.5 w-3.5" />
                <span>用当前零件图</span>
              </button>
            )}

            {activePart?.originalBeforeAiImageDataUrl && onRestoreOriginalBeforeAi && (
              <button
                type="button"
                onClick={() => {
                  onRestoreOriginalBeforeAi();
                  setGeneratedImageUrl(null);
                }}
                className="bp-pill inline-flex h-8 items-center gap-1 rounded-xl border border-amber-500/45 bg-amber-500/10 px-2.5 text-xs font-extrabold text-amber-700 dark:text-amber-300 cursor-pointer"
                title="还原 AI 替换前的原始底图"
              >
                <ArrowCounterClockwiseIcon className="h-3.5 w-3.5" weight="bold" />
                <span>还原原图</span>
              </button>
            )}

            {channel === "official" ? (
              <button
                type="button"
                onClick={() => setDrawerTab((t) => (t === "wallet" ? "none" : "wallet"))}
                className={`inline-flex h-8 items-center gap-1 rounded-xl border px-2.5 text-xs font-extrabold transition cursor-pointer ${
                  drawerTab === "wallet"
                    ? "bp-subcard-active border-coral bg-coral/10 text-coral"
                    : "bp-pill border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-coral"
                }`}
              >
                <WalletIcon className="h-3.5 w-3.5 text-coral" weight="bold" />
                <span>充值 / 通行证</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setDrawerTab((t) => (t === "byok" ? "none" : "byok"))}
                className={`inline-flex h-8 items-center gap-1 rounded-xl border px-2.5 text-xs font-extrabold transition cursor-pointer ${
                  drawerTab === "byok"
                    ? "bp-subcard-active border-coral bg-coral/10 text-coral"
                    : "bp-pill border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-coral"
                }`}
              >
                <KeyIcon className="h-3.5 w-3.5 text-emerald-500" weight="bold" />
                <span>配置 API Key</span>
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleUploadFile}
              className="hidden"
            />
          </div>
        </div>

        {/* Inline Expandable Wallet / Redeem Accordion */}
        {drawerTab === "wallet" && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/70 p-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-black text-slate-900 dark:text-white">
                灵感点账户：{wallet ? wallet.credits : 0} 点（5.5 每次 {pricingMatrix["seedream-5.5"].cost1k}/{pricingMatrix["seedream-5.5"].cost2k} 点 · 5.0 Pro 每次 {pricingMatrix["seedream-5.0-pro"].cost1k}/{pricingMatrix["seedream-5.0-pro"].cost2k} 点 · 新设备赠 20 点）
              </span>
              <button
                type="button"
                onClick={() => setShowRestorePasskey((v) => !v)}
                className="text-[11px] font-bold text-coral hover:underline cursor-pointer"
              >
                {showRestorePasskey ? "取消恢复" : "跨设备恢复通行证"}
              </button>
            </div>

            {showRestorePasskey ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={restorePasskeyInput}
                  onChange={(e) => setRestorePasskeyInput(e.target.value)}
                  placeholder="粘贴如 GKM-ABCD-1234-EFGH"
                  className="bp-input flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleRestorePasskey}
                  className="bp-btn rounded-lg bg-slate-900 dark:bg-white px-3 py-1.5 text-xs font-extrabold text-white dark:text-slate-950 cursor-pointer"
                >
                  绑定
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 px-2.5 py-1.5">
                <span className="text-[11px] text-slate-500">
                  专属通行证：<code className="font-mono font-black text-slate-900 dark:text-white">{passkey}</code>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(passkey);
                    flashNotice("已复制通行证密钥，可粘贴到其他设备同步点数");
                  }}
                  className="bp-pill inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  <CopyIcon className="h-3 w-3" />
                  <span>复制</span>
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={redeemInput}
                onChange={(e) => setRedeemInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRedeem()}
                placeholder="输入充值兑换码（如 GKM-100-...）"
                className="bp-input flex-1 min-w-[190px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 font-mono text-xs text-slate-900 dark:text-white"
              />
              <button
                type="button"
                disabled={redeeming || !redeemInput.trim()}
                onClick={handleRedeem}
                className="gk-btn-primary inline-flex items-center gap-1 rounded-xl bg-coral hover:opacity-95 disabled:opacity-50 px-3.5 py-1.5 text-xs font-extrabold text-white cursor-pointer"
              >
                {redeeming ? (
                  <CircleNotchIcon className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckIcon className="h-3.5 w-3.5" weight="bold" />
                )}
                <span>核销充值</span>
              </button>
            </div>

              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5">
                  {RECHARGE_TIERS.map((t) => (
                    <div
                      key={t.id}
                      className={`rounded-xl border px-2 py-1.5 text-[11px] ${
                        t.badge === "推荐"
                          ? "border-coral/60 bg-coral/10 dark:bg-coral/15"
                          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 font-black text-slate-900 dark:text-white">
                        <span className="truncate">{t.name}</span>
                        {t.badge && (
                          <span className="rounded bg-coral px-1 py-0.2 text-[9px] font-black text-white shrink-0">
                            {t.badge}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 font-extrabold text-coral tabular-nums">
                        {t.coins} · {t.points}点
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        1080p {t.renders1k}张 / 2K {t.renders2k}张
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400">
                    支持支付宝/微信/PayPal/海外卡，下单后在引力圈私信领 GKM-xxx 兑换码（永久不清零）
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    {rechargeUrlUnifans && (
                      <a
                        href={rechargeUrlUnifans}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-coral hover:opacity-95 px-2.5 py-1 text-xs font-extrabold text-white"
                      >
                        <span>前往引力圈购买兑换码</span>
                        <ArrowSquareOutIcon className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {rechargeUrlGlobal && (
                      <a
                        href={rechargeUrlGlobal}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-2.5 py-1 text-xs font-extrabold text-white"
                      >
                        <span>海外通道</span>
                        <ArrowSquareOutIcon className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
          </div>
        )}

        {/* Inline Expandable BYOK 3-line Setup Accordion */}
        {drawerTab === "byok" && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/70 p-3 space-y-2.5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {BYOK_PROVIDER_PRESETS.map((p) => {
                const selected = byok.provider === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleProviderChange(p.id)}
                    className={`rounded-xl border p-2 text-left transition cursor-pointer ${
                      selected
                        ? "bp-subcard-active border-coral bg-white dark:bg-slate-900 ring-2 ring-coral/30"
                        : "bp-subcard border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-black text-slate-900 dark:text-white truncate">
                        {p.name}
                      </span>
                      {selected && (
                        <CheckCircleIcon className="h-3.5 w-3.5 text-coral shrink-0" weight="fill" />
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      {p.badge}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
              <div className="sm:col-span-5 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  <span>API Key（仅存本地浏览器）</span>
                  {activeProviderMeta.keyApplyUrl && (
                    <a
                      href={activeProviderMeta.keyApplyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 text-coral hover:underline"
                    >
                      <span>获取 Key</span>
                      <ArrowSquareOutIcon className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <input
                  type="password"
                  value={byok.apiKey}
                  onChange={(e) => handleSaveByokField({ apiKey: e.target.value })}
                  placeholder={activeProviderMeta.placeholderKey}
                  className="bp-input w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:text-white"
                />
              </div>
              <div className="sm:col-span-4 space-y-1">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  模型 ID
                </label>
                <input
                  type="text"
                  value={byok.model}
                  onChange={(e) => handleSaveByokField({ model: e.target.value })}
                  placeholder={activeProviderMeta.defaultModel}
                  className="bp-input w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:text-white"
                />
              </div>
              <div className="sm:col-span-3">
                <button
                  type="button"
                  disabled={testingByok}
                  onClick={handleTestByok}
                  className="bp-btn w-full inline-flex h-[34px] items-center justify-center gap-1 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 px-2.5 text-xs font-extrabold cursor-pointer"
                >
                  {testingByok ? (
                    <CircleNotchIcon className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircleIcon className="h-3.5 w-3.5" weight="bold" />
                  )}
                  <span>测试连通</span>
                </button>
              </div>
            </div>

            {byok.provider === "custom" && (
              <input
                type="text"
                value={byok.baseUrl}
                onChange={(e) => handleSaveByokField({ baseUrl: e.target.value })}
                placeholder="自定义 Base URL，如 https://api.openai.com/v1"
                className="bp-input w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:text-white"
              />
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <div className="flex flex-wrap items-center gap-1">
                {activeProviderMeta.modelSuggestions.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleSaveByokField({ model: m })}
                    className={`rounded px-1.5 py-0.5 font-mono text-[10px] border cursor-pointer ${
                      byok.model === m
                        ? "bp-pill-active border-coral bg-coral/15 text-coral font-bold"
                        : "bp-pill border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              {byokStatusMsg && (
                <span
                  className={`font-bold ${
                    byokStatusMsg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"
                  }`}
                >
                  {byokStatusMsg.ok ? "✓ " : "⚠ "}
                  {byokStatusMsg.text}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. Main Process-Block Configurator (Left) + Sample & Result Preview (Right) */}
      <div className="bp-subcard rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 p-3.5 sm:p-4 space-y-4">
        {/* Hidden input for uploading user custom paint reference */}
        <input
          ref={styleRefInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleUploadStyleRef}
        />

        {/* Hidden probe images to check which /ai-style-refs/<id>.jpg files exist */}
        {mode === "preset" && !customStyleRefSrc && (
          <>
            {probeUrls.map((url) => (
              <img
                key={url}
                src={url}
                alt=""
                className="hidden"
                onLoad={() =>
                  setLoadedRefMap((prev) => (prev[url] === true ? prev : { ...prev, [url]: true }))
                }
                onError={() =>
                  setLoadedRefMap((prev) => (prev[url] === false ? prev : { ...prev, [url]: false }))
                }
              />
            ))}
          </>
        )}

        {/* Two Core Modes - Compact Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode("preset")}
            className={`rounded-xl border px-3 py-2 text-left transition cursor-pointer flex items-center justify-between gap-2 ${
              mode === "preset"
                ? "bp-subcard-active border-coral bg-white dark:bg-slate-900 ring-2 ring-coral/35 shadow-xs"
                : "bp-subcard border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 hover:border-slate-300"
            }`}
          >
            <span className="inline-flex items-center gap-1.5 text-xs font-black text-slate-900 dark:text-white">
              <PaletteIcon className="h-4 w-4 text-coral shrink-0" weight="fill" />
              <span>模式 1：素组/灰模一键涂装</span>
            </span>
            {mode === "preset" && (
              <CheckCircleIcon className="h-4 w-4 text-coral shrink-0" weight="fill" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setMode("refine")}
            className={`rounded-xl border px-3 py-2 text-left transition cursor-pointer flex items-center justify-between gap-2 ${
              mode === "refine"
                ? "bp-subcard-active border-coral bg-white dark:bg-slate-900 ring-2 ring-coral/35 shadow-xs"
                : "bp-subcard border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 hover:border-slate-300"
            }`}
          >
            <span className="inline-flex items-center gap-1.5 text-xs font-black text-slate-900 dark:text-white">
              <MagicWandIcon className="h-4 w-4 text-coral shrink-0" weight="fill" />
              <span>模式 2：模拟上色边缘精修</span>
            </span>
            {mode === "refine" && (
              <CheckCircleIcon className="h-4 w-4 text-coral shrink-0" weight="fill" />
            )}
          </button>
        </div>

        {/* Smart StudioSession Source Switcher */}
        {!customUploadedSrc && hasStudioRawRef && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
            {mode === "preset" ? (
              <>
                <span>
                  试色底图源：「{useUnpaintedRawInPreset ? "原始未上色素组图" : "当前模拟上色图"}」
                </span>
                <button
                  type="button"
                  onClick={() => setUseUnpaintedRawInPreset((v) => !v)}
                  className="underline font-extrabold cursor-pointer shrink-0"
                >
                  切换底图源
                </button>
              </>
            ) : (
              <>
                <span>
                  {useDualRefInRefine
                    ? "✓ 已启用「原始素组 + 模拟上色」双图锁定精修"
                    : "当前为单图精修模式"}
                </span>
                <button
                  type="button"
                  onClick={() => setUseDualRefInRefine((v) => !v)}
                  className="underline font-extrabold cursor-pointer shrink-0"
                >
                  {useDualRefInRefine ? "切为单图" : "启用双图锁定"}
                </button>
              </>
            )}
          </div>
        )}

        {/* Split Workbench: Left (5-Step Process Buttons) | Right (Sample Reference & Output Preview) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* LEFT: 5-Step Process Configurator */}
          <div className="lg:col-span-7 space-y-3">
            {mode === "preset" ? (
              <>
                {/* Step 01: Paint Technique */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-black tracking-wide text-slate-800 dark:text-slate-200">
                      01 涂装技法
                    </span>
                    <div className="flex items-center gap-2">
                      {hasAnyOverride && (
                        <button
                          type="button"
                          onClick={() => applyPresetDefaults(activePresetObj, primarySubStyleObj)}
                          className="bp-pill inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 cursor-pointer"
                        >
                          <ArrowCounterClockwiseIcon className="h-2.5 w-2.5" weight="bold" />
                          <span>恢复默认工序</span>
                        </button>
                      )}
                      <span className="text-[10px] font-bold text-coral">
                        {activePresetObj.name}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {presetStyles.map((preset) => {
                      const active = selectedPresetId === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleSelectPreset(preset.id)}
                          className={`rounded-xl border px-2.5 py-2 text-left transition cursor-pointer flex items-center justify-between gap-1.5 ${
                            active
                              ? "bp-subcard-active border-coral bg-white dark:bg-slate-900 ring-2 ring-coral/30"
                              : "bp-subcard border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 hover:border-slate-300"
                          }`}
                        >
                          <span className="text-[11px] sm:text-xs font-black text-slate-900 dark:text-white leading-tight">
                            {preset.name}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[9px] font-extrabold shrink-0 ${
                              active
                                ? "bg-coral text-white"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                            }`}
                          >
                            {active ? "✓" : preset.badge}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Step 01-B: Sub-Style Craft Variants (Weathering Multi-Select / Metallic Single-Select) */}
                {activePresetObj.subStyles && activePresetObj.subStyles.length > 0 && (
                  <div className="bp-subcard rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-[11px] font-black tracking-wide text-slate-800 dark:text-slate-200">
                        {isSubStyleMulti
                          ? "01-B 细分旧化工艺（可多选叠加 · 最多附 2 张特写图）"
                          : "01-B 细分特效工艺（单选 · 独立材质特写槽位）"}
                      </span>
                      <span className="text-[10px] font-bold text-coral">
                        {isSubStyleMulti
                          ? `已选 ${activeSubStyles.length} 项`
                          : primarySubStyleObj?.name}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {activePresetObj.subStyles.map((sub) => {
                        const subActive = activeSubStyles.some((s) => s.id === sub.id);
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => handleSelectSubStyle(sub.id)}
                            className={`rounded-xl border px-2.5 py-1.5 text-left transition cursor-pointer flex items-center justify-between gap-1.5 ${
                              subActive
                                ? "bp-subcard-active border-coral bg-white dark:bg-slate-900 ring-1 ring-coral/35"
                                : "bp-subcard border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 hover:border-slate-300"
                            }`}
                          >
                            <span className="text-[11px] font-black text-slate-900 dark:text-white leading-tight inline-flex items-center gap-1">
                              {isSubStyleMulti && subActive && (
                                <CheckIcon className="h-3 w-3 text-coral shrink-0" weight="bold" />
                              )}
                              <span>{sub.name}</span>
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[9px] font-extrabold shrink-0 ${
                                subActive
                                  ? "bg-coral text-white"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                              }`}
                            >
                              {subActive ? "✓" : sub.badge}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Step 02: Surface Topcoat Finish */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black tracking-wide text-slate-800 dark:text-slate-200">
                      02 漆面质感
                    </span>
                    {isFinishOverridden && (
                      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-700 dark:text-amber-300">
                        已手动覆盖
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {SURFACE_FINISH_OPTIONS.map((opt) => {
                      const active = finishId === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setFinishId(opt.id)}
                          className={`rounded-xl border px-2.5 py-1.5 text-center text-[11px] transition cursor-pointer ${
                            active
                              ? "bp-subcard-active border-coral bg-coral/10 text-coral font-black ring-1 ring-coral/40"
                              : "bp-subcard border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 font-bold text-slate-700 dark:text-slate-300 hover:border-slate-300"
                          }`}
                        >
                          {opt.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Mode 2 Step 01: Edge Refine Finish */}
                <div className="space-y-1.5">
                  <span className="block text-[11px] font-black tracking-wide text-slate-800 dark:text-slate-200">
                    01 溢色修复漆面
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {REFINE_FINISH_OPTIONS.map((opt) => {
                      const active = refineFinish === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setRefineFinish(opt.id)}
                          className={`rounded-xl border px-2.5 py-2 text-center text-[11px] transition cursor-pointer ${
                            active
                              ? "bp-subcard-active border-coral bg-coral/10 text-coral font-black ring-1 ring-coral/40"
                              : "bp-subcard border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 font-bold text-slate-700 dark:text-slate-300 hover:border-slate-300"
                          }`}
                        >
                          {opt.name.replace("（推荐）", "")}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Mode 2 Step 02: Unpainted Policy */}
                <div className="space-y-1.5">
                  <span className="block text-[11px] font-black tracking-wide text-slate-800 dark:text-slate-200">
                    02 未涂留白处理
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setUnpaintedPolicy("keep_clean")}
                      className={`rounded-xl border px-2.5 py-1.5 text-center text-[11px] transition cursor-pointer ${
                        unpaintedPolicy === "keep_clean"
                          ? "bp-subcard-active border-coral bg-coral/10 text-coral font-black ring-1 ring-coral/40"
                          : "bp-subcard border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 font-bold text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      保留干净白/浅灰外甲
                    </button>
                    <button
                      type="button"
                      onClick={() => setUnpaintedPolicy("harmonize_complete")}
                      className={`rounded-xl border px-2.5 py-1.5 text-center text-[11px] transition cursor-pointer ${
                        unpaintedPolicy === "harmonize_complete"
                          ? "bp-subcard-active border-coral bg-coral/10 text-coral font-black ring-1 ring-coral/40"
                          : "bp-subcard border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 font-bold text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      自动协调补全分色
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Step 03: Detail Crafts (Multi-Select) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black tracking-wide text-slate-800 dark:text-slate-200">
                  03 工艺细节（可多选）
                </span>
                <div className="flex items-center gap-1.5">
                  {isCraftsOverridden && (
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-700 dark:text-amber-300">
                      已手动覆盖
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400">
                    已选 {crafts.length} 项
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {DETAIL_CRAFT_OPTIONS.map((craft) => {
                  const active = crafts.includes(craft.id);
                  return (
                    <button
                      key={craft.id}
                      type="button"
                      onClick={() => toggleCraft(craft.id)}
                      className={`rounded-xl border px-2.5 py-1.5 text-center text-[11px] transition cursor-pointer inline-flex items-center justify-center gap-1 ${
                        active
                          ? "bp-subcard-active border-coral bg-coral/10 text-coral font-black ring-1 ring-coral/40"
                          : "bp-subcard border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 font-bold text-slate-700 dark:text-slate-300 hover:border-slate-300"
                      }`}
                    >
                      {active && <CheckIcon className="h-3 w-3 shrink-0" weight="bold" />}
                      <span>{craft.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 04: Studio Background */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black tracking-wide text-slate-800 dark:text-slate-200">
                  04 摄影背景
                </span>
                {isBgOverridden && (
                  <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-700 dark:text-amber-300">
                    已手动覆盖
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {STUDIO_BG_OPTIONS.map((bg) => {
                  const active = bgId === bg.id;
                  const isTransparent = bg.swatchHex === "transparent";
                  return (
                    <button
                      key={bg.id}
                      type="button"
                      onClick={() => setBgId(bg.id)}
                      className={`rounded-xl border px-2.5 py-1.5 text-[11px] transition cursor-pointer inline-flex items-center justify-center gap-1.5 ${
                        active
                          ? "bp-subcard-active border-coral bg-coral/10 text-coral font-black ring-1 ring-coral/40"
                          : "bp-subcard border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 font-bold text-slate-700 dark:text-slate-300 hover:border-slate-300"
                      }`}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full border border-black/20 shrink-0"
                        style={
                          isTransparent
                            ? {
                                backgroundImage:
                                  "repeating-conic-gradient(#cbd5e1 0% 25%, #ffffff 0% 50%)",
                                backgroundSize: "6px 6px",
                              }
                            : { backgroundColor: bg.swatchHex }
                        }
                      />
                      <span className="truncate">{bg.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 05: Studio Lighting Position */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black tracking-wide text-slate-800 dark:text-slate-200">
                  05 打光位置
                </span>
                {isLightingOverridden && (
                  <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-700 dark:text-amber-300">
                    已手动覆盖
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {LIGHTING_POS_OPTIONS.map((light) => {
                  const active = lightingId === light.id;
                  return (
                    <button
                      key={light.id}
                      type="button"
                      onClick={() => setLightingId(light.id)}
                      className={`rounded-xl border px-2.5 py-1.5 text-center text-[11px] transition cursor-pointer ${
                        active
                          ? "bp-subcard-active border-coral bg-coral/10 text-coral font-black ring-1 ring-coral/40"
                          : "bp-subcard border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 font-bold text-slate-700 dark:text-slate-300 hover:border-slate-300"
                      }`}
                    >
                      {light.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT: Clean Sample Style Reference & Generated Effect Preview Window */}
          <div className="bp-subcard lg:col-span-5 space-y-2.5 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-950/60 p-3">
            {/* Preview Window Switcher Tabs */}
            <div className="flex items-center justify-between gap-1.5">
              <div className="bp-segmented inline-flex rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setPreviewTab("result")}
                  className={`bp-segmented-item px-2.5 py-1 rounded-lg font-extrabold transition cursor-pointer ${
                    previewTab === "result"
                      ? "bp-segmented-item-active bg-coral text-white"
                      : "text-slate-600 dark:text-slate-300"
                  }`}
                >
                  效果图预览
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab("ref")}
                  className={`bp-segmented-item px-2.5 py-1 rounded-lg font-extrabold transition cursor-pointer ${
                    previewTab === "ref"
                      ? "bp-segmented-item-active bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                      : "text-slate-600 dark:text-slate-300"
                  }`}
                >
                  风格样板参考
                </button>
              </div>

              <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300">
                无悬浮色卡
              </span>
            </div>

            {/* Preview Viewport */}
            {previewTab === "result" && generatedImageUrl ? (
              <div className="space-y-2.5">
                <div
                  className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                  style={
                    generatedImageUrl.startsWith("data:image/png")
                      ? {
                          backgroundImage:
                            "repeating-conic-gradient(#e2e8f0 0% 25%, #ffffff 0% 50%)",
                          backgroundSize: "14px 14px",
                        }
                      : undefined
                  }
                >
                  <img
                    src={generatedImageUrl}
                    alt={generatedLabel || "AI 涂装效果图"}
                    className="h-full w-full object-contain"
                  />
                  <span className="absolute top-2 left-2 rounded-lg bg-black/65 backdrop-blur-sm px-2 py-0.5 text-[10px] font-extrabold text-white">
                    ✓ {generatedLabel} · {renderQuality === "1K" ? "1080p" : "2K"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      onReplaceCoverAndPartImage(generatedImageUrl, generatedLabel);
                      setGeneratedImageUrl(null);
                    }}
                    className="gk-btn-primary inline-flex h-8 items-center justify-center gap-1 rounded-lg bg-coral hover:opacity-95 px-2 text-[11px] font-black text-white cursor-pointer"
                  >
                    <CheckCircleIcon className="h-3.5 w-3.5 shrink-0" weight="fill" />
                    <span>设为底图</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onAppendAsNewPart(
                        generatedImageUrl,
                        generatedLabel || "AI 涂装效果图",
                        generatedLabel
                      );
                      setGeneratedImageUrl(null);
                    }}
                    className="bp-pill inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-[11px] font-extrabold text-slate-800 dark:text-slate-100 cursor-pointer"
                  >
                    <PlusIcon className="h-3.5 w-3.5 text-coral shrink-0" weight="bold" />
                    <span>存新零件</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadResult}
                    className="bp-pill inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-[11px] font-extrabold text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    <DownloadSimpleIcon className="h-3.5 w-3.5 shrink-0" weight="bold" />
                    <span>下载</span>
                  </button>
                </div>
              </div>
            ) : previewTab === "result" && !generatedImageUrl ? (
              <div className="flex aspect-[4/3] w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/70 dark:bg-slate-900/50 p-4 text-center">
                <SparkleIcon className="h-7 w-7 text-coral/70 mb-1.5" weight="duotone" />
                <p className="text-xs font-black text-slate-700 dark:text-slate-200">
                  {rendering
                    ? `正在渲染 ${renderQuality === "1K" ? "1080p" : "2K"} 涂装成品... (${elapsedSec}s)`
                    : "选择左侧工序后点击生成"}
                </p>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  生成后可在此预览并一键设为取件表底图
                </p>
              </div>
            ) : (
              /* Reference Image Slot (Preset/Sub-Style Close-Up Samples OR User Custom Upload) */
              <div className="space-y-2">
                {customStyleRefSrc ? (
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <img
                      src={customStyleRefSrc}
                      alt="自定义样板参考图"
                      className={`h-full w-full object-contain transition ${
                        useStyleRef ? "opacity-100" : "opacity-40 grayscale"
                      }`}
                    />
                    <span className="absolute top-2 left-2 rounded-lg bg-black/65 backdrop-blur-sm px-2 py-0.5 text-[10px] font-extrabold text-white">
                      自定义参考样板
                    </span>
                  </div>
                ) : mode === "preset" && loadedPresetRefItems.length > 1 ? (
                  <div className="grid grid-cols-2 gap-1.5 aspect-[4/3] w-full">
                    {loadedPresetRefItems.slice(0, 2).map((item, idx) => (
                      <div
                        key={item.url}
                        className="relative h-full w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                      >
                        <img
                          src={item.url}
                          alt={item.label}
                          className={`h-full w-full object-cover transition ${
                            useStyleRef ? "opacity-100" : "opacity-40 grayscale"
                          }`}
                        />
                        <span className="absolute top-1.5 left-1.5 rounded-md bg-black/70 backdrop-blur-sm px-1.5 py-0.5 text-[9px] font-extrabold text-white">
                          图{idx + 2} · {item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : mode === "preset" && loadedPresetRefItems.length === 1 ? (
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <img
                      src={loadedPresetRefItems[0].url}
                      alt={loadedPresetRefItems[0].label}
                      className={`h-full w-full object-contain transition ${
                        useStyleRef ? "opacity-100" : "opacity-40 grayscale"
                      }`}
                    />
                    <span className="absolute top-2 left-2 rounded-lg bg-black/65 backdrop-blur-sm px-2 py-0.5 text-[10px] font-extrabold text-white">
                      图2 · {loadedPresetRefItems[0].label}
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => styleRefInputRef.current?.click()}
                    className="flex aspect-[4/3] w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/70 dark:bg-slate-900/50 p-4 text-center hover:border-coral transition cursor-pointer"
                  >
                    <ImageSquareIcon className="h-7 w-7 text-slate-400 mb-1.5" weight="duotone" />
                    <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                      上传他人作品 / 局部特写参考图（选填）
                    </span>
                    <span className="mt-1 text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      可直接上传别人的涂装/局部装甲特写作为参考，或等待放入槽位：{" "}
                      <code className="font-mono text-coral">
                        {(activeSubStyles.length > 0
                          ? activeSubStyles.slice(0, 2).map((s) => s.sampleImageUrl)
                          : [activePresetObj.sampleImageUrl]
                        ).join(" / ")}
                      </code>
                    </span>
                  </button>
                )}

                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useStyleRef}
                      onChange={(e) => setUseStyleRef(e.target.checked)}
                      className="h-3.5 w-3.5 accent-coral rounded cursor-pointer"
                    />
                    <span>多图参考学习笔触</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    {customStyleRefSrc && (
                      <button
                        type="button"
                        onClick={() => setCustomStyleRefSrc(null)}
                        className="bp-pill inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:border-rose-400 cursor-pointer"
                      >
                        <ArrowCounterClockwiseIcon className="h-3 w-3" weight="bold" />
                        <span>清自定义</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => styleRefInputRef.current?.click()}
                      className="bp-pill inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-[10px] font-extrabold text-slate-800 dark:text-slate-200 hover:border-coral cursor-pointer"
                    >
                      <UploadSimpleIcon className="h-3 w-3 text-coral" weight="bold" />
                      <span>{customStyleRefSrc ? "换参考图" : "传参考图"}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Active Process Pill Summary */}
            <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 px-2.5 py-2 text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed">
              <span className="font-black text-slate-800 dark:text-slate-200">当前工序：</span>
              <span>
                {mode === "preset"
                  ? `${activePresetObj.name}${
                      subStyleSummaryText ? `(${subStyleSummaryText})` : ""
                    } · ${SURFACE_FINISH_OPTIONS.find((f) => f.id === finishId)?.name}`
                  : REFINE_FINISH_OPTIONS.find((f) => f.id === refineFinish)?.name.replace(
                      "（推荐）",
                      ""
                    )}
                {" · "}
                {STUDIO_BG_OPTIONS.find((b) => b.id === bgId)?.name}
                {" · "}
                {LIGHTING_POS_OPTIONS.find((l) => l.id === lightingId)?.name}
                {activeStyleRefLabels.length > 0
                  ? ` · 已挂${activeStyleRefLabels.length}张参考图`
                  : ""}
              </span>
            </div>
          </div>
        </div>

        {/* Project Paint Swatch Palette Auto-Injection */}
        {activePart && activePart.nodes.length > 0 && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 p-2.5 space-y-2">
            <label className="flex items-center justify-between gap-2 cursor-pointer">
              <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
                自动融合当前项目油漆色卡 ({activePart.nodes.length} 色 · 仅作配色指令，图内不画悬浮色卡)
              </span>
              <input
                type="checkbox"
                checked={injectPalette}
                onChange={(e) => setInjectPalette(e.target.checked)}
                className="h-4 w-4 accent-coral rounded cursor-pointer"
              />
            </label>
            {injectPalette && (
              <div className="flex flex-wrap gap-1.5">
                {activePart.nodes.slice(0, 6).map((n) => (
                  <span
                    key={n.id}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-200"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full border border-black/15"
                      style={{ backgroundColor: n.hex }}
                    />
                    <span>
                      {localizedBrand(n.paintBrand, "zh")} {n.paintCode}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Extra Prompt Tweak & Built-in Prompt Preview */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
              追加细节指令（选填）
            </label>
            <button
              type="button"
              onClick={() => setShowFullPromptPreview((v) => !v)}
              className="text-[11px] font-bold text-coral hover:underline cursor-pointer"
            >
              {showFullPromptPreview
                ? "收起积木提示词"
                : `查看积木提示词 (${promptAssembly.blocks.length} 块)`}
            </button>
          </div>
          <input
            type="text"
            value={extraPrompt}
            onChange={(e) => setExtraPrompt(e.target.value)}
            placeholder="例如：天线改成金属金色、胸口加一点轻微掉漆、盾牌做红色分色..."
            className="bp-input w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white"
          />
          {showFullPromptPreview && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 space-y-1.5 max-h-52 overflow-y-auto">
              {promptAssembly.blocks.map((block) => (
                <div
                  key={block.id}
                  className={`rounded-lg border px-2 py-1.5 text-[11px] leading-relaxed ${
                    block.isOverride
                      ? "border-amber-500/40 bg-amber-500/10 text-slate-800 dark:text-slate-200"
                      : "border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="rounded bg-slate-900/10 dark:bg-white/10 px-1.5 py-0.5 text-[9px] font-black text-slate-800 dark:text-slate-100">
                      {block.label}
                    </span>
                    {block.isOverride && (
                      <span className="rounded bg-amber-500/20 px-1 py-0.5 text-[9px] font-extrabold text-amber-700 dark:text-amber-300">
                        手动覆盖优先
                      </span>
                    )}
                    {block.requiresStyleRef && (
                      <span className="rounded bg-emerald-500/15 px-1 py-0.5 text-[9px] font-extrabold text-emerald-700 dark:text-emerald-300">
                        随参考图自动联动
                      </span>
                    )}
                  </div>
                  <div>{block.text}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs font-bold text-rose-600 dark:text-rose-300">
            <WarningIcon className="h-4 w-4 shrink-0 mt-0.5" weight="fill" />
            <div className="flex-1 space-y-1">
              <div>{errorMsg}</div>
              {!officialReady && channel === "official" && (
                <button
                  type="button"
                  onClick={() => handleChannelSwitch("byok")}
                  className="underline font-extrabold text-coral cursor-pointer"
                >
                  立即切换到「自带 API 免费用」→
                </button>
              )}
            </div>
          </div>
        )}

        {/* Official Engine Model Selector (5.5 vs 5.0 Pro) */}
        {channel === "official" && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black tracking-wide text-slate-800 dark:text-slate-200">
                生图引擎版本
              </span>
              <span className="text-[10px] text-slate-400">
                5.5 极速省点含透明 PNG · 5.0 Pro 重涂经典大模型
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setOfficialModel("seedream-5.5");
                  savePreferredOfficialModel("seedream-5.5");
                }}
                className={`rounded-xl border px-3 py-2 text-left transition cursor-pointer ${
                  officialModel === "seedream-5.5"
                    ? "bp-subcard-active border-coral bg-white dark:bg-slate-900 ring-2 ring-coral/30"
                    : "bp-subcard border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-black text-slate-900 dark:text-white">
                    Seedream 5.5
                  </span>
                  <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                    {pricingMatrix["seedream-5.5"].cost1k}/{pricingMatrix["seedream-5.5"].cost2k} 点
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                  极速省点首选 · 支持透明免抠 PNG
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setOfficialModel("seedream-5.0-pro");
                  savePreferredOfficialModel("seedream-5.0-pro");
                }}
                className={`rounded-xl border px-3 py-2 text-left transition cursor-pointer ${
                  officialModel === "seedream-5.0-pro"
                    ? "bp-subcard-active border-coral bg-white dark:bg-slate-900 ring-2 ring-coral/30"
                    : "bp-subcard border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-black text-slate-900 dark:text-white">
                    Seedream 5.0 Pro
                  </span>
                  <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] font-black text-amber-700 dark:text-amber-300">
                    {pricingMatrix["seedream-5.0-pro"].cost1k}/{pricingMatrix["seedream-5.0-pro"].cost2k} 点
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                  旗舰经典重涂模型 · 算力消耗翻倍
                </p>
              </button>
            </div>
            {officialModel === "seedream-5.0-pro" && bgId === "transparent" && (
              <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                提示：透明免抠 PNG 仅 Seedream 5.5 原生支持，当前 5.0 Pro 将自动按标准棚拍背景出图
              </p>
            )}
          </div>
        )}

        {/* Output Resolution & Credit Tier Switcher */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setRenderQuality("1K");
              savePreferredQuality("1K");
            }}
            className={`rounded-xl border px-3 py-2 text-left transition cursor-pointer ${
              renderQuality === "1K"
                ? "bp-subcard-active border-coral bg-white dark:bg-slate-900 ring-2 ring-coral/30"
                : "bp-subcard border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-black text-slate-900 dark:text-white">
                1080p 标准试色
              </span>
              <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                {channel === "official" ? `${activeCost1k} 点/次` : "省流快出"}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
              适合快速试配色与多次迭代
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setRenderQuality("2K");
              savePreferredQuality("2K");
            }}
            className={`rounded-xl border px-3 py-2 text-left transition cursor-pointer ${
              renderQuality === "2K"
                ? "bp-subcard-active border-coral bg-white dark:bg-slate-900 ring-2 ring-coral/30"
                : "bp-subcard border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-black text-slate-900 dark:text-white">
                2K Pro 高清精修
              </span>
              <span className="rounded bg-coral/15 px-1.5 py-0.5 font-mono text-[10px] font-black text-coral">
                {channel === "official" ? `${activeCost2k} 点/次` : "高清推荐"}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
              官图级锐利细节 · 适合做封面与取件表底图
            </p>
          </button>
        </div>

        {/* Generate CTA */}
        <button
          type="button"
          disabled={rendering || !primaryBeforeSrc}
          onClick={handleStartRender}
          className="gk-btn-primary w-full inline-flex h-11 sm:h-12 items-center justify-center gap-2 rounded-2xl bg-coral hover:opacity-95 disabled:opacity-50 px-5 text-sm font-black text-white transition active:scale-[0.99] cursor-pointer"
        >
          {rendering ? (
            <>
              <CircleNotchIcon className="h-5 w-5 animate-spin" weight="bold" />
              <span>
                正在生成 {renderQuality === "1K" ? "1080p" : "2K"} 涂装作品... ({elapsedSec}s)
              </span>
            </>
          ) : (
            <>
              <SparkleIcon className="h-5 w-5" weight="fill" />
              <span>{generatedImageUrl ? "重新生成涂装效果图" : "立即生成涂装效果图"}</span>
              <span className="rounded-full bg-black/20 px-2 py-0.5 text-[11px] font-extrabold">
                {channel === "official"
                  ? `消耗 ${activeRenderCost} 点`
                  : "自有 API · 免费"}
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
