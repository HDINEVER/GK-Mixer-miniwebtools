import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { FloatingSwatchNode, PartCanvas } from "../../types";
import {
  AI_PRESET_STYLES,
  AiChannelMode,
  AiStudioMode,
  BYOK_PROVIDER_PRESETS,
  ByokConfig,
  ByokProviderId,
  REFINE_FINISH_OPTIONS,
  RefineFinishStyle,
  RefineUnpaintedPolicy,
  WalletInfo,
  buildPresetRenderPrompt,
  buildRefineRenderPrompt,
  fetchWalletStatus,
  getOrCreateWalletPasskey,
  loadByokConfig,
  loadPreferredChannel,
  redeemCreditCode,
  runAiPaintRender,
  saveByokConfig,
  savePreferredChannel,
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
  XIcon,
} from "@phosphor-icons/react";

interface AiPaintStudioModalProps {
  open: boolean;
  initialMode?: AiStudioMode;
  projectTitle: string;
  activePart?: PartCanvas;
  activePartImageSrc?: string;
  onClose: () => void;
  /** 替换当前零件图，并同步设为项目封面与取件表头图 */
  onReplaceCoverAndPartImage: (imageDataUrl: string, appliedLabel: string) => void;
  /** 作为新零件图追加进当前项目（保留原零件图不动） */
  onAppendAsNewPart: (imageDataUrl: string, partName: string, appliedLabel: string) => void;
}

const RECHARGE_TIERS = [
  { points: 100, priceCn: "¥9.9", renders: 10, tag: "尝鲜体验" },
  { points: 300, priceCn: "¥24.9", renders: 30, tag: "胶佬常用 · 推荐" },
  { points: 1000, priceCn: "¥68.0", renders: 100, tag: "工作室超值" },
];

export const AiPaintStudioModal: React.FC<AiPaintStudioModalProps> = ({
  open,
  initialMode,
  projectTitle,
  activePart,
  activePartImageSrc,
  onClose,
  onReplaceCoverAndPartImage,
  onAppendAsNewPart,
}) => {
  const hasStudioRawRef = Boolean(
    activePart?.studioSession?.rawSourceImageDataUrl &&
      activePart.studioSession.rawSourceImageDataUrl.startsWith("data:image")
  );

  const [mode, setMode] = useState<AiStudioMode>(
    initialMode || (hasStudioRawRef ? "refine" : "preset")
  );
  const [channel, setChannel] = useState<AiChannelMode>(() => loadPreferredChannel());
  const [drawerTab, setDrawerTab] = useState<"none" | "wallet" | "byok">("none");

  // Source image states
  const [customUploadedSrc, setCustomUploadedSrc] = useState<string | null>(null);
  const [useUnpaintedRawInPreset, setUseUnpaintedRawInPreset] = useState<boolean>(hasStudioRawRef);
  const [useDualRefInRefine, setUseDualRefInRefine] = useState<boolean>(hasStudioRawRef);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preset Mode options
  const [selectedPresetId, setSelectedPresetId] = useState<string>(AI_PRESET_STYLES[0].id);
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
  const [costPerRender, setCostPerRender] = useState<number>(10);
  const [redeemInput, setRedeemInput] = useState<string>("");
  const [redeeming, setRedeeming] = useState<boolean>(false);

  // BYOK state
  const [byok, setByok] = useState<ByokConfig>(() => loadByokConfig());
  const [testingByok, setTestingByok] = useState<boolean>(false);
  const [byokStatusMsg, setByokStatusMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Render execution & comparison slider state
  const [rendering, setRendering] = useState<boolean>(false);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [generatedLabel, setGeneratedLabel] = useState<string>("");
  const [splitPercent, setSplitPercent] = useState<number>(50);
  const [holdingOriginal, setHoldingOriginal] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const rechargeUrlCn = (import.meta as any).env?.VITE_RECHARGE_URL_CN || "";
  const rechargeUrlGlobal = (import.meta as any).env?.VITE_RECHARGE_URL_GLOBAL || "";

  useEffect(() => {
    if (!open) return;
    if (initialMode) {
      setMode(initialMode);
    } else if (hasStudioRawRef) {
      setMode("refine");
    }
    setUseUnpaintedRawInPreset(hasStudioRawRef);
    setUseDualRefInRefine(hasStudioRawRef);
    setInjectPalette(Boolean(activePart?.nodes && activePart.nodes.length > 0));
    setErrorMsg(null);
  }, [open, initialMode, hasStudioRawRef, activePart?.id]);

  // Load wallet status on open or passkey change
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchWalletStatus(passkey)
      .then((res) => {
        if (cancelled) return;
        setWallet(res.wallet);
        setOfficialReady(res.officialReady);
        setCostPerRender(res.costPerRender || 10);
      })
      .catch(() => {
        // Ignore silent initial fetch failure
      });
    return () => {
      cancelled = true;
    };
  }, [open, passkey]);

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

  const showToast = (msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg(null), 2600);
  };

  // Determine primary display & input reference images
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

  const finalPrompt = useMemo(() => {
    const nodes: FloatingSwatchNode[] = activePart?.nodes || [];
    if (mode === "preset") {
      return buildPresetRenderPrompt({
        presetId: selectedPresetId,
        nodes,
        injectPalette,
        extraUserPrompt: extraPrompt,
      });
    }
    return buildRefineRenderPrompt({
      hasDualRawImage: Boolean(effectiveDualRawRef),
      finishStyle: refineFinish,
      unpaintedPolicy,
      nodes,
      injectPalette,
      extraUserPrompt: extraPrompt,
    });
  }, [
    mode,
    selectedPresetId,
    activePart?.nodes,
    injectPalette,
    extraPrompt,
    effectiveDualRawRef,
    refineFinish,
    unpaintedPolicy,
  ]);

  const currentModeSummaryLabel = useMemo(() => {
    if (mode === "preset") {
      const p = AI_PRESET_STYLES.find((s) => s.id === selectedPresetId);
      return p ? `AI ${p.name}` : "AI 涂装效果图";
    }
    const r = REFINE_FINISH_OPTIONS.find((f) => f.id === refineFinish);
    return r ? `AI 精修 · ${r.name.replace(/（.*）/, "")}` : "AI 模拟上色精修";
  }, [mode, selectedPresetId, refineFinish]);

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
      showToast(`🎉 成功充值 +${res.addedPoints} 灵感点！当前共 ${res.wallet.credits} 点`);
    } catch (err: any) {
      setErrorMsg(err?.message || "兑换码核销失败");
    } finally {
      setRedeeming(false);
    }
  };

  const handleRestorePasskey = async () => {
    const candidate = restorePasskeyInput.trim().toUpperCase();
    if (!saveWalletPasskey(candidate)) {
      setErrorMsg("通行证密钥格式应为 GKM-XXXX-XXXX-XXXX");
      return;
    }
    setPasskey(candidate);
    setShowRestorePasskey(false);
    setRestorePasskeyInput("");
    showToast("已切换并同步通行证密钥");
  };

  const handleStartRender = async () => {
    if (!primaryBeforeSrc) {
      setErrorMsg("请先上传一张素组/灰模或模拟上色模型照片");
      return;
    }
    if (channel === "byok" && !byok.apiKey.trim()) {
      setDrawerTab("byok");
      setErrorMsg("请先填写你的自带 API Key，或切换到「官方 Seedream 通道」");
      return;
    }

    setRendering(true);
    setErrorMsg(null);

    try {
      const inputSources = effectiveDualRawRef
        ? [effectiveDualRawRef, primaryBeforeSrc]
        : [primaryBeforeSrc];

      const res = await runAiPaintRender({
        channel,
        passkey,
        byok,
        prompt: finalPrompt,
        rawImageSources: inputSources,
        size: "2K",
      });

      setGeneratedImageUrl(res.imageDataUrl);
      setGeneratedLabel(currentModeSummaryLabel);
      setSplitPercent(50);
      if (res.wallet) {
        setWallet(res.wallet);
      }
      showToast("✨ AI 涂装效果图生成完成！拖动中间滑杆可对比细节");
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
    const a = document.createElement("a");
    a.href = generatedImageUrl;
    a.download = `${projectTitle || "GK-Mixer"}-${generatedLabel || "AI涂装"}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!open || typeof document === "undefined") return null;

  const activeProviderMeta =
    BYOK_PROVIDER_PRESETS.find((p) => p.id === byok.provider) || BYOK_PROVIDER_PRESETS[0];

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-2 sm:p-4 overflow-y-auto">
      <div className="bp-card relative w-full max-w-6xl rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden my-auto max-h-[94dvh] flex flex-col">
        {/* Toast Banner */}
        {toastMsg && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-slate-900 text-white border border-emerald-400/60 px-4 py-1.5 text-xs font-bold shadow-xl">
            <CheckCircleIcon className="h-4 w-4 text-emerald-400 shrink-0" weight="fill" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-200/80 dark:border-slate-800 px-4 sm:px-6 py-3.5 bg-slate-50/80 dark:bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-coral/15 text-coral border border-coral/30 shrink-0">
              <SparkleIcon className="h-5 w-5" weight="fill" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate">
                  AI 涂装效果图与模拟上色精修
                </h3>
                <span className="rounded-full bg-coral/15 border border-coral/35 px-2 py-0.5 text-[10px] font-extrabold text-coral">
                  Seedream 2K 多模态
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                素组/灰模一键生成官图涂装 · 模拟上色修溢色与刻线 · 生成后一键替换色卡与取件表底图
              </p>
            </div>
          </div>

          {/* Right: Channel Switcher + Wallet / BYOK Config Triggers + Close */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5">
              <button
                type="button"
                onClick={() => handleChannelSwitch("official")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-extrabold transition cursor-pointer ${
                  channel === "official"
                    ? "bp-pill-active bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-xs"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <LightningIcon className="h-3.5 w-3.5 text-amber-400" weight="fill" />
                <span>官方 Seedream</span>
                <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[10px] text-amber-600 dark:text-amber-300 tabular-nums">
                  {wallet ? `${wallet.credits}点` : "..."}
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleChannelSwitch("byok")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-extrabold transition cursor-pointer ${
                  channel === "byok"
                    ? "bp-pill-active bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-xs"
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

            {channel === "official" ? (
              <button
                type="button"
                onClick={() => setDrawerTab((t) => (t === "wallet" ? "none" : "wallet"))}
                className={`inline-flex h-8 items-center gap-1 rounded-xl border px-2.5 text-xs font-extrabold transition cursor-pointer ${
                  drawerTab === "wallet"
                    ? "bp-subcard-active border-coral bg-coral/10 text-coral"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-coral"
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
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-coral"
                }`}
              >
                <KeyIcon className="h-3.5 w-3.5 text-emerald-500" weight="bold" />
                <span>配置 API Key</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
              aria-label="关闭"
            >
              <XIcon className="h-4 w-4" weight="bold" />
            </button>
          </div>
        </div>

        {/* Expandable Top Drawer: Wallet/Redeem OR BYOK 3-line Setup */}
        {drawerTab === "wallet" && (
          <div className="border-b border-slate-200 dark:border-slate-800 bg-amber-50/50 dark:bg-slate-950/80 px-4 sm:px-6 py-4 space-y-3 shrink-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <WalletIcon className="h-4 w-4 text-coral" weight="fill" />
                <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                  灵感点账户与卡密秒充
                </span>
                <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                  当前剩余：{wallet ? wallet.credits : 0} 点（每次生成消耗 {costPerRender} 点 · 新设备自动赠 20 点）
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDrawerTab("none")}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
              >
                收起 ▲
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              {/* Passkey Box */}
              <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400">
                    免注册专属通行证（跨设备复制即可同步点数）
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowRestorePasskey((v) => !v)}
                    className="text-[11px] font-bold text-coral hover:underline cursor-pointer"
                  >
                    {showRestorePasskey ? "取消恢复" : "恢复已有通行证"}
                  </button>
                </div>
                {showRestorePasskey ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={restorePasskeyInput}
                      onChange={(e) => setRestorePasskeyInput(e.target.value)}
                      placeholder="粘贴如 GKM-ABCD-1234-EFGH"
                      className="bp-input flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={handleRestorePasskey}
                      className="rounded-lg bg-slate-900 dark:bg-white px-3 py-1.5 text-xs font-extrabold text-white dark:text-slate-950 cursor-pointer"
                    >
                      绑定
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-100 dark:bg-slate-800/90 px-3 py-1.5">
                    <code className="font-mono text-xs font-black text-slate-900 dark:text-white tracking-wider">
                      {passkey}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(passkey);
                        showToast("已复制通行证密钥，请妥善保存以便跨设备同步点数");
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-white dark:bg-slate-700 px-2 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-100 shadow-2xs cursor-pointer"
                    >
                      <CopyIcon className="h-3.5 w-3.5" />
                      <span>复制备份</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Redeem CDK + Purchase Links */}
              <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={redeemInput}
                    onChange={(e) => setRedeemInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleRedeem()}
                    placeholder="粘贴充值兑换码（如 GKM-100-8F3K92AB-E49C10B27A）"
                    className="bp-input flex-1 min-w-[210px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 font-mono text-xs text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    disabled={redeeming || !redeemInput.trim()}
                    onClick={handleRedeem}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-coral hover:opacity-95 disabled:opacity-50 px-3.5 py-1.5 text-xs font-extrabold text-white cursor-pointer"
                  >
                    {redeeming ? (
                      <CircleNotchIcon className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckIcon className="h-3.5 w-3.5" weight="bold" />
                    )}
                    <span>立即核销到账</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-[11px]">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {RECHARGE_TIERS.map((t) => (
                      <span
                        key={t.points}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-2 py-0.5 font-bold text-slate-700 dark:text-slate-200"
                      >
                        {t.priceCn} = {t.points}点 ({t.renders}张)
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    {rechargeUrlCn ? (
                      <a
                        href={rechargeUrlCn}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1 text-xs font-extrabold text-white"
                      >
                        <span>微信/支付宝购买兑换码</span>
                        <ArrowSquareOutIcon className="h-3.5 w-3.5" />
                      </a>
                    ) : null}
                    {rechargeUrlGlobal ? (
                      <a
                        href={rechargeUrlGlobal}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-2.5 py-1 text-xs font-extrabold text-white"
                      >
                        <span>Stripe / 国际卡购点</span>
                        <ArrowSquareOutIcon className="h-3.5 w-3.5" />
                      </a>
                    ) : null}
                    {!rechargeUrlCn && !rechargeUrlGlobal && (
                      <span className="text-slate-400">
                        没有兑换码？也可右上角一键切换「自带 API 免费用」
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {drawerTab === "byok" && (
          <div className="border-b border-slate-200 dark:border-slate-800 bg-emerald-50/40 dark:bg-slate-950/80 px-4 sm:px-6 py-4 space-y-3 shrink-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <KeyIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" weight="fill" />
                <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                  接入你自己的多模态图片 API（纯本地存储 · 免费调用本站内置机甲提示词）
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDrawerTab("none")}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
              >
                收起 ▲
              </button>
            </div>

            {/* Provider Selector */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {BYOK_PROVIDER_PRESETS.map((p) => {
                const selected = byok.provider === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleProviderChange(p.id)}
                    className={`rounded-xl border p-2.5 text-left transition cursor-pointer ${
                      selected
                        ? "bp-subcard-active border-coral bg-white dark:bg-slate-900 ring-2 ring-coral/30"
                        : "bp-subcard border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                        {p.name}
                      </span>
                      {selected && (
                        <CheckCircleIcon className="h-4 w-4 text-coral shrink-0" weight="fill" />
                      )}
                    </div>
                    <span className="mt-0.5 inline-block text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      {p.badge}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Key + Model + BaseURL Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
              <div className="md:col-span-5 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  <span>API Key（仅保存在当前浏览器本地）</span>
                  {activeProviderMeta.keyApplyUrl && (
                    <a
                      href={activeProviderMeta.keyApplyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 text-coral hover:underline"
                    >
                      <span>去官方控制台获取 Key</span>
                      <ArrowSquareOutIcon className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <input
                  type="password"
                  value={byok.apiKey}
                  onChange={(e) => handleSaveByokField({ apiKey: e.target.value })}
                  placeholder={activeProviderMeta.placeholderKey}
                  className="bp-input w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 font-mono text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="md:col-span-4 space-y-1">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  模型 ID / 推理接入点 (如 ep-xxxx)
                </label>
                <input
                  type="text"
                  value={byok.model}
                  onChange={(e) => handleSaveByokField({ model: e.target.value })}
                  placeholder={activeProviderMeta.defaultModel}
                  className="bp-input w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 font-mono text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="md:col-span-3 flex items-center gap-2">
                <button
                  type="button"
                  disabled={testingByok}
                  onClick={handleTestByok}
                  className="w-full inline-flex h-[34px] items-center justify-center gap-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 px-3 text-xs font-extrabold hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                  {testingByok ? (
                    <CircleNotchIcon className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircleIcon className="h-3.5 w-3.5" weight="bold" />
                  )}
                  <span>测试连通性</span>
                </button>
              </div>
            </div>

            {byok.provider === "custom" && (
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  自定义接口 Base URL（兼容 OpenAI / xAI Grok / 硅基流动 / NewAPI）
                </label>
                <input
                  type="text"
                  value={byok.baseUrl}
                  onChange={(e) => handleSaveByokField({ baseUrl: e.target.value })}
                  placeholder="https://api.openai.com/v1"
                  className="bp-input w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 font-mono text-xs text-slate-900 dark:text-white"
                />
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-slate-400">常用模型快选：</span>
                {activeProviderMeta.modelSuggestions.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleSaveByokField({ model: m })}
                    className={`rounded-md px-2 py-0.5 font-mono text-[10px] border cursor-pointer ${
                      byok.model === m
                        ? "border-coral bg-coral/15 text-coral font-bold"
                        : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
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

        {/* Main Body Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* LEFT 7 COLS: Visual Stage & Comparison Slider */}
            <div className="lg:col-span-7 space-y-3">
              {/* Stage Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="bp-pill inline-flex h-8 items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-3 text-xs font-extrabold text-slate-800 dark:text-slate-100 hover:border-coral transition cursor-pointer"
                  >
                    <UploadSimpleIcon className="h-3.5 w-3.5 text-coral" weight="bold" />
                    <span>{customUploadedSrc ? "重新上传模型照片" : "上传素组/灰模照片"}</span>
                  </button>
                  {customUploadedSrc && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomUploadedSrc(null);
                        setGeneratedImageUrl(null);
                      }}
                      className="inline-flex h-8 items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 px-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                    >
                      <ArrowCounterClockwiseIcon className="h-3.5 w-3.5" />
                      <span>切回当前零件图</span>
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

                {/* Smart StudioSession Dual-Image Indicator */}
                {!customUploadedSrc && hasStudioRawRef && mode === "preset" && (
                  <button
                    type="button"
                    onClick={() => setUseUnpaintedRawInPreset((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 cursor-pointer"
                  >
                    <CheckCircleIcon className="h-3.5 w-3.5" weight="fill" />
                    <span>
                      {useUnpaintedRawInPreset
                        ? "底图源：原始未上色素组图（点击切换）"
                        : "底图源：当前模拟上色合成图（点击切换）"}
                    </span>
                  </button>
                )}

                {!customUploadedSrc && hasStudioRawRef && mode === "refine" && (
                  <button
                    type="button"
                    onClick={() => setUseDualRefInRefine((v) => !v)}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[11px] font-bold cursor-pointer ${
                      useDualRefInRefine
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "border-slate-300 dark:border-slate-700 text-slate-500"
                    }`}
                  >
                    <CheckCircleIcon className="h-3.5 w-3.5" weight="fill" />
                    <span>
                      {useDualRefInRefine
                        ? "✓ 已启用双图精修（原图刻线 + 模拟上色草图）"
                        : "单图精修模式（点击启用原图联合刻线锁定）"}
                    </span>
                  </button>
                )}
              </div>

              {/* Image Preview / Before-After Comparison Canvas */}
              <div className="relative flex items-center justify-center min-h-[300px] sm:min-h-[410px] rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden select-none">
                {!primaryBeforeSrc ? (
                  <div className="p-8 text-center space-y-3">
                    <ImageSquareIcon className="h-12 w-12 text-slate-600 mx-auto" />
                    <p className="text-sm font-bold text-slate-300">
                      尚未选择底图，请点击左上角上传一张高达素组、灰模或模拟上色图
                    </p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-coral px-4 py-2 text-xs font-extrabold text-white cursor-pointer"
                    >
                      <UploadSimpleIcon className="h-4 w-4" weight="bold" />
                      <span>选择图片上传</span>
                    </button>
                  </div>
                ) : generatedImageUrl ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                    {/* Generated After Image (Base Full Layer) */}
                    <img
                      src={holdingOriginal ? primaryBeforeSrc : generatedImageUrl}
                      alt="AI 涂装效果图"
                      className="max-h-[440px] w-auto max-w-full object-contain block"
                      draggable={false}
                    />
                    {/* Clipped Original Before Image Overlay for Split Slider */}
                    {!holdingOriginal && (
                      <div
                        className="absolute inset-0 flex items-center justify-center pointer-events-none"
                        style={{
                          clipPath: `inset(0 ${100 - splitPercent}% 0 0)`,
                        }}
                      >
                        <img
                          src={primaryBeforeSrc}
                          alt="原始底图"
                          className="max-h-[440px] w-auto max-w-full object-contain block"
                          draggable={false}
                        />
                      </div>
                    )}

                    {/* Vertical Divider Line + Handle */}
                    {!holdingOriginal && (
                      <div
                        className="absolute inset-y-0 pointer-events-none"
                        style={{ left: `${splitPercent}%` }}
                      >
                        <div className="h-full w-0.5 bg-white shadow-[0_0_10px_rgba(0,0,0,0.8)]" />
                        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-900 shadow-lg border border-slate-300">
                          <ArrowsLeftRightIcon className="h-4 w-4" weight="bold" />
                        </div>
                      </div>
                    )}

                    {/* Invisible Range Input across stage for silky dragging */}
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={splitPercent}
                      onChange={(e) => setSplitPercent(Number(e.target.value))}
                      aria-label="原图与AI效果图对比滑杆"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20"
                    />

                    {/* Corner Labels */}
                    <span className="absolute top-3 left-3 z-10 rounded-full bg-slate-900/80 border border-white/15 px-2.5 py-0.5 text-[10px] font-extrabold text-slate-200 pointer-events-none">
                      原图 (Before)
                    </span>
                    <span className="absolute top-3 right-3 z-10 rounded-full bg-coral/90 px-2.5 py-0.5 text-[10px] font-extrabold text-white pointer-events-none">
                      {generatedLabel || "AI 涂装后 (After)"}
                    </span>
                    <button
                      type="button"
                      onMouseDown={() => setHoldingOriginal(true)}
                      onMouseUp={() => setHoldingOriginal(false)}
                      onMouseLeave={() => setHoldingOriginal(false)}
                      onTouchStart={() => setHoldingOriginal(true)}
                      onTouchEnd={() => setHoldingOriginal(false)}
                      className="absolute bottom-3 right-3 z-30 rounded-xl bg-slate-900/85 hover:bg-slate-900 border border-white/20 px-2.5 py-1 text-[11px] font-bold text-white cursor-pointer"
                    >
                      按住看原图
                    </button>
                  </div>
                ) : (
                  <div className="relative w-full flex items-center justify-center p-2">
                    <img
                      src={primaryBeforeSrc}
                      alt="待处理模型底图"
                      className="max-h-[430px] w-auto max-w-full object-contain rounded-lg"
                    />
                    {effectiveDualRawRef && (
                      <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-xl bg-slate-900/90 border border-white/15 p-1.5 pr-3 text-[11px] text-white backdrop-blur-md">
                        <img
                          src={effectiveDualRawRef}
                          alt="素组原图参考"
                          className="h-10 w-10 rounded-lg object-cover border border-white/20"
                        />
                        <div>
                          <div className="font-extrabold text-emerald-400">双图联合锁定已就绪</div>
                          <div className="text-[10px] text-slate-300">
                            左：原始素组锁定刻线 · 主图：模拟上色提供分色
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Rendering Loading Overlay */}
                {rendering && (
                  <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-slate-950/80 backdrop-blur-sm p-6 text-center">
                    <CircleNotchIcon className="h-10 w-10 text-coral animate-spin" weight="bold" />
                    <div className="space-y-1">
                      <p className="text-sm font-black text-white">
                        正在调用多模态引擎绘制模型漆面与刻线细节... ({elapsedSec}s)
                      </p>
                      <p className="text-xs text-slate-300">
                        2K 高清精修通常耗时 8 ~ 20 秒，若上游接口异常将自动退回点数
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Post-Generation Action Bar: Replace Cover & Checklist Bg / Add New Part / Download */}
              {generatedImageUrl && (
                <div className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/10 p-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-black text-slate-900 dark:text-white">
                      ✅ 满意当前涂装效果？一键应用到当前项目：
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-300">
                      自动保留原图备份，随时可在详情页顶部一键还原
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onReplaceCoverAndPartImage(generatedImageUrl, generatedLabel);
                        onClose();
                      }}
                      className="flex-1 min-w-[200px] inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-coral hover:opacity-95 px-4 text-xs sm:text-sm font-black text-white shadow-md cursor-pointer"
                    >
                      <CheckCircleIcon className="h-4 w-4 shrink-0" weight="fill" />
                      <span>设为当前色卡与取件表底图</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onAppendAsNewPart(
                          generatedImageUrl,
                          generatedLabel || "AI 涂装效果图",
                          generatedLabel
                        );
                        onClose();
                      }}
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-xs font-extrabold text-slate-800 dark:text-slate-100 hover:border-coral cursor-pointer"
                    >
                      <PlusIcon className="h-4 w-4 text-coral" weight="bold" />
                      <span>存为新零件页</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadResult}
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-extrabold text-slate-700 dark:text-slate-200 hover:border-slate-400 cursor-pointer"
                    >
                      <DownloadSimpleIcon className="h-4 w-4" weight="bold" />
                      <span>下载 2K 图</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT 5 COLS: Mode Switcher + Presets/Refinement Controls + Generate CTA */}
            <div className="lg:col-span-5 space-y-4">
              {/* Two Core Modes Selector (High-Contrast Selected State) */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode("preset")}
                  className={`rounded-2xl border p-3 text-left transition cursor-pointer ${
                    mode === "preset"
                      ? "bp-subcard-active border-coral bg-white dark:bg-slate-900 ring-2 ring-coral/35 shadow-sm"
                      : "bp-subcard border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                      <PaletteIcon className="h-4 w-4 text-coral shrink-0" weight="fill" />
                      <span>素组一键涂装</span>
                    </span>
                    {mode === "preset" && (
                      <CheckCircleIcon className="h-4 w-4 text-coral shrink-0" weight="fill" />
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    上传素组/灰模，用特调提示词直出二次元/MAX喷涂作品
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setMode("refine")}
                  className={`rounded-2xl border p-3 text-left transition cursor-pointer ${
                    mode === "refine"
                      ? "bp-subcard-active border-coral bg-white dark:bg-slate-900 ring-2 ring-coral/35 shadow-sm"
                      : "bp-subcard border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                      <MagicWandIcon className="h-4 w-4 text-coral shrink-0" weight="fill" />
                      <span>模拟上色精修</span>
                    </span>
                    {mode === "refine" && (
                      <CheckCircleIcon className="h-4 w-4 text-coral shrink-0" weight="fill" />
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    修复局部试色的边缘溢出与生硬感，还原锐利刻线与漆面
                  </p>
                </button>
              </div>

              {/* Mode 1: Preset Style Cards */}
              {mode === "preset" ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                      选择预设涂装工艺风格
                    </span>
                    <span className="text-[11px] font-bold text-coral">
                      当前已选：{AI_PRESET_STYLES.find((s) => s.id === selectedPresetId)?.name}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[250px] overflow-y-auto pr-1">
                    {AI_PRESET_STYLES.map((preset) => {
                      const active = selectedPresetId === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setSelectedPresetId(preset.id)}
                          className={`rounded-xl border p-2.5 text-left transition cursor-pointer ${
                            active
                              ? "bp-subcard-active border-coral bg-white dark:bg-slate-900 ring-2 ring-coral/30"
                              : "bp-subcard border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 hover:border-slate-300"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-black text-slate-900 dark:text-white">
                              {preset.name}
                            </span>
                            {active ? (
                              <span className="rounded bg-coral px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                                ✓ 已选
                              </span>
                            ) : (
                              <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                                {preset.badge}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-snug">
                            {preset.shortDesc}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Mode 2: Simulated Coloring Refinement Options */
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <span className="block text-xs font-black text-slate-800 dark:text-slate-200">
                      1. 目标漆面质感与边缘修复方式
                    </span>
                    <div className="space-y-1.5">
                      {REFINE_FINISH_OPTIONS.map((opt) => {
                        const active = refineFinish === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setRefineFinish(opt.id)}
                            className={`w-full rounded-xl border p-2.5 text-left transition cursor-pointer ${
                              active
                                ? "bp-subcard-active border-coral bg-white dark:bg-slate-900 ring-2 ring-coral/30"
                                : "bp-subcard border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 hover:border-slate-300"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-black text-slate-900 dark:text-white">
                                {opt.name}
                              </span>
                              {active && (
                                <span className="rounded bg-coral px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                                  ✓ 已选中
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                              {opt.desc}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="block text-xs font-black text-slate-800 dark:text-slate-200">
                      2. 未上色留白区域处理策略
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setUnpaintedPolicy("keep_clean")}
                        className={`rounded-xl border p-2 text-left text-xs transition cursor-pointer ${
                          unpaintedPolicy === "keep_clean"
                            ? "bp-subcard-active border-coral bg-white dark:bg-slate-900 ring-2 ring-coral/30 font-black"
                            : "bp-subcard border-slate-200 dark:border-slate-800 font-bold text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>保留干净白/灰甲</span>
                          {unpaintedPolicy === "keep_clean" && (
                            <CheckCircleIcon className="h-3.5 w-3.5 text-coral" weight="fill" />
                          )}
                        </div>
                        <p className="mt-0.5 text-[10px] font-normal text-slate-400">
                          只修已涂色区溢色，未涂区转为整洁白灰消光
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setUnpaintedPolicy("harmonize_complete")}
                        className={`rounded-xl border p-2 text-left text-xs transition cursor-pointer ${
                          unpaintedPolicy === "harmonize_complete"
                            ? "bp-subcard-active border-coral bg-white dark:bg-slate-900 ring-2 ring-coral/30 font-black"
                            : "bp-subcard border-slate-200 dark:border-slate-800 font-bold text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>自动协调补全分色</span>
                          {unpaintedPolicy === "harmonize_complete" && (
                            <CheckCircleIcon className="h-3.5 w-3.5 text-coral" weight="fill" />
                          )}
                        </div>
                        <p className="mt-0.5 text-[10px] font-normal text-slate-400">
                          仅涂了局部时，按同色系逻辑补完剩余部位
                        </p>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Project Swatch Palette Auto-Injection Toggle */}
              {activePart && activePart.nodes.length > 0 && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 p-3 space-y-2">
                  <label className="flex items-center justify-between gap-2 cursor-pointer">
                    <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
                      融合当前项目已指派油漆色卡 ({activePart.nodes.length} 色)
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

              {/* Extra Custom Prompt Tweak + Built-in Prompt Preview */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
                    补充细节指令（选填）
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowFullPromptPreview((v) => !v)}
                    className="text-[11px] font-bold text-coral hover:underline cursor-pointer"
                  >
                    {showFullPromptPreview ? "隐藏完整提示词" : "查看内置特调提示词"}
                  </button>
                </div>
                <input
                  type="text"
                  value={extraPrompt}
                  onChange={(e) => setExtraPrompt(e.target.value)}
                  placeholder="例如：天线改成金色、眼睛发绿光、黑色格纳库背景..."
                  className="bp-input w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white"
                />
                {showFullPromptPreview && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed max-h-28 overflow-y-auto">
                    {finalPrompt}
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

              {/* Primary Generate CTA */}
              <button
                type="button"
                disabled={rendering || !primaryBeforeSrc}
                onClick={handleStartRender}
                className="bp-btn-primary w-full inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-coral hover:opacity-95 disabled:opacity-50 px-5 text-sm font-black text-white shadow-lg transition active:scale-[0.99] cursor-pointer"
              >
                {rendering ? (
                  <>
                    <CircleNotchIcon className="h-5 w-5 animate-spin" weight="bold" />
                    <span>正在生成 2K 涂装作品...</span>
                  </>
                ) : (
                  <>
                    <SparkleIcon className="h-5 w-5" weight="fill" />
                    <span>
                      {generatedImageUrl ? "重新生成涂装效果图" : "立即生成涂装效果图"}
                    </span>
                    <span className="rounded-full bg-black/20 px-2 py-0.5 text-[11px] font-extrabold">
                      {channel === "official" ? `消耗 ${costPerRender} 点` : "自有 API · 免费"}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
