import React, { useState } from "react";
import { FloatingSwatchNode, Language, PaintingStep } from "../types";
import {
  buildStepParams,
  inferStepsFromNodes,
  parseStepParams,
  STEP_PRESET_REGISTRY,
  findStepPreset,
  PresetItem,
} from "../utils/projectSharing";
import { localizedBrand } from "../utils/paintCatalog";
import {
  SparkleIcon,
  PlusIcon,
  TrashIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  StackIcon,
  DropIcon,
  WindIcon,
  CheckCircleIcon,
  CaretDownIcon,
  SlidersHorizontalIcon,
  TargetIcon,
} from "@phosphor-icons/react";

interface PaintingStepBuilderViewProps {
  steps: PaintingStep[];
  nodes: FloatingSwatchNode[];
  onChangeSteps: (nextSteps: PaintingStep[]) => void;
  lang: Language;
}

const NOZZLE_OPTIONS = [
  { value: "0.18~0.2mm", title: "0.18 ~ 0.2mm", subtitle: "极细高光 · 阴影勾线" },
  { value: "0.3mm", title: "0.3mm", subtitle: "标准通用口径 · 主色平喷" },
  { value: "0.3~0.5mm", title: "0.3 ~ 0.5mm", subtitle: "金属色 · 珍珠色柔喷" },
  { value: "0.5mm", title: "0.5mm", subtitle: "水补土打底 · 大面光油" },
  { value: "无", title: "无", subtitle: "非喷笔工序" },
];

const RATIO_OPTIONS = [
  { value: "无", title: "无", subtitle: "非喷涂工序" },
  { value: "原液直喷", title: "原液直喷", subtitle: "金属底漆 · 喷罐抽漆" },
  { value: "1:0.5", title: "1:0.5", subtitle: "细节笔涂 · 点涂" },
  { value: "1:1.0", title: "1:1.0", subtitle: "水性漆标准 · 高遮盖" },
  { value: "1:1.5(缓干)", title: "1:1.5 (缓干)", subtitle: "高光湿喷 · 水贴喷砂层" },
  { value: "1:2.0", title: "1:2.0", subtitle: "硝基主色 · 水补土标准" },
  { value: "1:2.5", title: "1:2.5", subtitle: "阴影高光 · 糖果透明罩染" },
  { value: "1:3.0", title: "1:3.0", subtitle: "MAX细喷 · 薄雾过渡" },
  { value: "1:5.0", title: "1:5.0", subtitle: "刻线渗线" },
  { value: "1:8.0", title: "1:8.0", subtitle: "大面积水洗渍洗 · 滤镜" },
];

const PRESSURE_OPTIONS = [
  { value: "无", title: "无", subtitle: "隐藏气压" },
  { value: "0.5bar/7psi", title: "0.5bar (7psi)", subtitle: "极细迷彩 · 0.2近距勾线" },
  { value: "0.8bar/12psi", title: "0.8bar (12psi)", subtitle: "MAX阴影 · 金属珍珠柔喷" },
  { value: "1.0bar/15psi", title: "1.0bar (15psi)", subtitle: "小零件薄喷 · 透明罩染" },
  { value: "1.2bar/18psi", title: "1.2bar (18psi)", subtitle: "标准主色十字平喷 · 基准" },
  { value: "1.5bar/22psi", title: "1.5bar (22psi)", subtitle: "大平面外甲 · 水性漆雾化" },
  { value: "1.8bar/26psi", title: "1.8bar (26psi)", subtitle: "水补土打底 · 镜面湿喷" },
  { value: "2.2bar/32psi", title: "2.2bar (32psi)", subtitle: "粗水补土 · GK树脂高雾化" },
];

const TECHNIQUE_OPTIONS = [
  "十字薄喷 2~3 遍",
  "薄喷 1~2 遍",
  "薄喷 2 遍",
  "湿喷流平",
  "远距低压柔喷",
  "细喷柔边填涂",
  "先浅后深压实",
  "面相笔点涂",
  "棱线低压细喷",
  "受光面中心提亮",
  "留边薄喷透色",
  "光油隔离+叠喷",
  "低压柔喷+罩光",
  "点流单向擦拭",
  "火机油单向擦拭",
  "滤干轻扫棱边",
  "面相笔点绘棱角",
  "海绵擦拭+点涂",
  "蓝盖定位+绿盖软化",
  "远距干喷隔离",
  "缓干湿喷流平",
  "#1500水砂纸平光",
  "#2000+三目抛光",
  "#400➔#1000砂纸",
  "洗剂浸泡晾干",
];

const CATEGORY_GROUPS = [
  { key: "basic", label: "1. 基础处理：打磨 / 补土 / 清洗" },
  { key: "main", label: "2. 主色喷涂：底色 / 平喷 / 分色" },
  { key: "advanced", label: "3. 进阶技法：光影 / 罩染 / 旧化 / 水贴" },
  { key: "topcoat", label: "4. 封层保护：消光 / 光油 / 水研 / 抛光" },
];

export const PaintingStepBuilderView: React.FC<PaintingStepBuilderViewProps> = ({
  steps,
  nodes,
  onChangeSteps,
  lang,
}) => {
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [showTechniqueHints, setShowTechniqueHints] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("gk_show_step_hints");
      return saved !== null ? saved === "true" : true;
    }
    return true;
  });
  const [openMenu, setOpenMenu] = useState<{
    stepId: string;
    field: "paint" | "nozzle" | "ratio" | "pressure" | "technique";
  } | null>(null);

  const toggleTechniqueHints = () => {
    setShowTechniqueHints((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("gk_show_step_hints", String(next));
      }
      return next;
    });
  };

  const handleSmartInfer = () => {
    const inferred = inferStepsFromNodes(nodes);
    onChangeSteps(inferred);
  };

  const handleAddPreset = (preset: PresetItem) => {
    const firstNode = nodes[0];
    const newStep: PaintingStep = {
      id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      iconName: preset.lucideIcon || "PaintBrushBroad",
      actionText: preset.defaultName,
      actionCode: preset.code,
      paintID: firstNode ? `${firstNode.paintBrand} ${firstNode.paintCode}` : undefined,
      ratioAndPressure: buildStepParams(
        preset.defaultRatio || "无",
        preset.defaultPressure || "无",
        preset.defaultMethod,
        preset.defaultNozzle || "无"
      ),
      nozzle: preset.defaultNozzle,
    };
    onChangeSteps([...steps, newStep]);
    setShowPresetMenu(false);
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTitle.trim()) return;
    const firstNode = nodes[0];
    const newStep: PaintingStep = {
      id: `step-${Date.now()}`,
      iconName: "PaintBrushBroad",
      actionText: customTitle.trim(),
      actionCode: "bp",
      paintID: firstNode ? `${firstNode.paintBrand} ${firstNode.paintCode}` : undefined,
      ratioAndPressure: "1:2.0 | 1.2bar/18psi | 十字薄喷 2~3 遍 | 0.3mm",
      nozzle: "0.3mm",
    };
    onChangeSteps([...steps, newStep]);
    setCustomTitle("");
    setShowPresetMenu(false);
  };

  const moveStep = (index: number, dir: -1 | 1) => {
    const targetIdx = index + dir;
    if (targetIdx < 0 || targetIdx >= steps.length) return;
    const next = [...steps];
    const [removed] = next.splice(index, 1);
    next.splice(targetIdx, 0, removed);
    onChangeSteps(next);
  };

  const deleteStep = (id: string) => {
    onChangeSteps(steps.filter((s) => s.id !== id));
  };

  const updateStepParam = (
    step: PaintingStep,
    field: "paint" | "nozzle" | "ratio" | "pressure" | "technique",
    value: string
  ) => {
    const parsed = parseStepParams(step.ratioAndPressure, step.nozzle);
    const nextSteps = steps.map((s) => {
      if (s.id !== step.id) return s;
      if (field === "paint") {
        return { ...s, paintID: value || undefined };
      }
      const nextNozzle = field === "nozzle" ? (value === "无" ? "" : value) : parsed.nozzle;
      const nextRatio = field === "ratio" ? (value === "无" ? "" : value) : parsed.ratio;
      const nextPressure = field === "pressure" ? (value === "无" ? "" : value) : parsed.pressure;
      const nextTech = field === "technique" ? value : parsed.technique;
      return {
        ...s,
        nozzle: nextNozzle || undefined,
        ratioAndPressure: buildStepParams(nextRatio, nextPressure, nextTech, nextNozzle),
      };
    });
    onChangeSteps(nextSteps);
    setOpenMenu(null);
  };

  const resolvePaintNode = (paintID?: string): FloatingSwatchNode | undefined => {
    if (!paintID) return undefined;
    return nodes.find(
      (n) =>
        `${n.paintBrand} ${n.paintCode}`.toLowerCase() === paintID.toLowerCase() ||
        n.paintCode.toLowerCase() === paintID.toLowerCase()
    );
  };

  const stepColor = (step: PaintingStep) => {
    const preset = findStepPreset(step.actionCode || step.actionText);
    return preset?.themeColorHex || "#EC4899";
  };

  return (
    <div className="space-y-4">
      {/* Top Toolbar: Title + [💡 提示] + [✨ 智能推导] + [+ 添加工序] */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-xs font-black text-slate-900 dark:text-white">
            涂装工序流水线 ({steps.length} 步)
          </h4>
          <p className="text-[11px] text-slate-400">
            NOMOKEN 1 规范：点按工序内胶囊免打字切换口径、稀释比、气压(Bar/PSI)与手法
          </p>
        </div>

        <div className="flex items-center gap-2 relative">
          {/* NOMOKEN 1 Technique Hints Toggle */}
          <button
            type="button"
            onClick={toggleTechniqueHints}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-extrabold transition cursor-pointer ${
              showTechniqueHints
                ? "bp-pill-active bg-amber-100 dark:bg-amber-900/60 border-amber-300 dark:border-amber-600 text-amber-800 dark:text-amber-200"
                : "bp-pill bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
            title="切换《NOMOKEN 1》作例标准技法说明与气压参数注释"
          >
            <span>💡</span>
            <span>技法提示</span>
          </button>

          <button
            type="button"
            onClick={handleSmartInfer}
            className="bp-pill flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-300/80 dark:border-amber-700 px-3 py-1.5 text-xs font-extrabold text-amber-700 dark:text-amber-300 hover:bg-amber-100 transition cursor-pointer"
            title="根据当前零件已指派的油漆自动推导完整工序"
          >
            <SparkleIcon className="h-3.5 w-3.5" weight="fill" />
            <span>智能推导</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPresetMenu((v) => !v)}
            className="bp-pill-active flex items-center gap-1.5 rounded-full bg-coral px-3.5 py-1.5 text-xs font-extrabold text-white shadow-sm hover:opacity-95 transition cursor-pointer"
          >
            <PlusIcon className="h-3.5 w-3.5" weight="bold" />
            <span>添加工序</span>
          </button>

          {showPresetMenu && (
            <div className="bp-subcard-lg absolute right-0 top-full mt-2 z-[100] w-80 sm:w-96 max-w-[calc(100vw-2rem)] max-h-[460px] overflow-y-auto rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-3 shadow-2xl space-y-3">
              {CATEGORY_GROUPS.map((group) => {
                const groupPresets = STEP_PRESET_REGISTRY.filter((p) => p.category === group.key);
                return (
                  <div key={group.key} className="space-y-1">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1">
                      {group.label}
                    </div>
                    <div className="grid grid-cols-1 gap-1">
                      {groupPresets.map((preset) => (
                        <button
                          key={preset.code}
                          type="button"
                          onClick={() => handleAddPreset(preset)}
                          className="flex flex-col gap-0.5 rounded-xl px-2.5 py-1.5 text-left text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="flex items-center gap-1.5">
                              <span
                                className="h-2 w-2 rounded-full shrink-0"
                                style={{ backgroundColor: preset.themeColorHex }}
                              />
                              <span>{preset.defaultName}</span>
                            </span>
                            <span className="font-mono text-[10px] text-slate-400">
                              {[preset.defaultNozzle, preset.defaultRatio, preset.defaultPressure]
                                .filter(Boolean)
                                .join(" · ") || "无额外参数"}
                            </span>
                          </div>
                          {showTechniqueHints && preset.nomokenTip && (
                            <div className="text-[10px] text-amber-600/90 dark:text-amber-400/90 pl-3.5 truncate">
                              {preset.nomokenTip}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}

              <form onSubmit={handleAddCustom} className="pt-2 border-t border-slate-100 dark:border-slate-800 flex gap-1.5">
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="自定义工序名称…"
                  className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-bold"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-slate-900 dark:bg-white px-3 py-1.5 text-xs font-bold text-white dark:text-slate-900"
                >
                  添加
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Apple Shortcuts-Style Vertical Action Blocks with 28px-aligned 2.5px Connector Line */}
      {steps.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 p-8 text-center space-y-2.5">
          <p className="text-xs font-bold text-slate-500">尚未添加涂装工序</p>
          <p className="text-[11px] text-slate-400">
            点击右上角「智能推导」即可根据当前零件已指派的油漆一键生成标准喷涂流水线。
          </p>
          <button
            type="button"
            onClick={handleSmartInfer}
            className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-xs font-extrabold text-white shadow-sm"
          >
            <SparkleIcon className="h-3.5 w-3.5" weight="fill" />
            <span>一键智能推导工序</span>
          </button>
        </div>
      ) : (
        <div className="relative space-y-3">
          {/* Vertical Pipeline Connector Line aligned at 28px from left */}
          {steps.length > 1 && (
            <div
              className="pointer-events-none absolute top-6 bottom-6 w-[2.5px] bg-gradient-to-b from-coral/60 via-indigo-400/50 to-emerald-500/60 rounded-full"
              style={{ left: "28px" }}
            />
          )}

          {steps.map((step, index) => {
            const { ratio, pressure, technique, nozzle } = parseStepParams(
              step.ratioAndPressure,
              step.nozzle
            );
            const matchedNode = resolvePaintNode(step.paintID);
            const preset = findStepPreset(step.actionCode || step.actionText);

            return (
              <div
                key={step.id}
                className={`bp-subcard-lg relative flex items-start gap-3 rounded-2xl border border-slate-200/85 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-3 shadow-xs transition hover:border-slate-300 dark:hover:border-slate-700 ${
                  openMenu?.stepId === step.id ? "z-50" : "z-10"
                }`}
              >
                {/* Left: 32x32 Colored Icon Box + Step Number Badge */}
                <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center font-mono text-xs font-black mt-0.5">
                  <div
                    className="bp-swatch flex h-8 w-8 items-center justify-center rounded-xl shadow-xs text-white"
                    style={{ backgroundColor: stepColor(step) }}
                  >
                    {step.iconName === "Stack" ? (
                      <StackIcon className="h-4 w-4" weight="bold" />
                    ) : step.iconName === "Sparkle" ? (
                      <SparkleIcon className="h-4 w-4" weight="fill" />
                    ) : step.iconName === "ShieldCheck" ? (
                      <CheckCircleIcon className="h-4 w-4" weight="bold" />
                    ) : (
                      <DropIcon className="h-4 w-4" weight="fill" />
                    )}
                  </div>
                  <span className="bp-badge absolute -bottom-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-slate-900 dark:bg-white px-1 font-mono text-[9px] font-black text-white dark:text-slate-900 ring-2 ring-white dark:ring-slate-900">
                    {index + 1}
                  </span>
                </div>

                {/* Center: 2-Row Shortcuts Action Content */}
                <div className="min-w-0 flex-1 space-y-2">
                  {/* Row 1: Action Title + Interactive Paint Capsule Pill */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100">
                      {step.actionText}
                    </span>

                    {/* Paint Capsule Pill */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenMenu(
                            openMenu?.stepId === step.id && openMenu.field === "paint"
                              ? null
                              : { stepId: step.id, field: "paint" }
                          )
                        }
                        className="bp-pill inline-flex items-center gap-1.5 rounded-full border border-slate-200/90 dark:border-slate-700 bg-slate-100/90 dark:bg-slate-800 px-2.5 py-0.5 text-[11px] font-bold text-slate-800 dark:text-slate-100 hover:border-coral transition cursor-pointer"
                      >
                        <span
                          className="bp-dot h-3 w-3 rounded-full border border-black/20 shrink-0"
                          style={{ backgroundColor: matchedNode?.hex || "#94A3B8" }}
                        />
                        <span className="truncate max-w-[150px]">
                          {matchedNode
                            ? `${localizedBrand(matchedNode.paintBrand, lang)} ${matchedNode.paintCode} ${matchedNode.paintName}`
                            : step.paintID || "选择指派油漆"}
                        </span>
                        <CaretDownIcon className="h-2.5 w-2.5 opacity-60" />
                      </button>

                      {openMenu?.stepId === step.id && openMenu.field === "paint" && (
                        <div className="bp-subcard-lg absolute left-0 top-full mt-1 z-[100] w-56 max-w-[calc(100vw-3rem)] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1.5 shadow-xl space-y-0.5">
                          <button
                            type="button"
                            onClick={() => updateStepParam(step, "paint", "")}
                            className="w-full rounded-xl px-2.5 py-1.5 text-left text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            不关联特定油漆 (通用耗材)
                          </button>
                          {nodes.map((n) => {
                            const pid = `${n.paintBrand} ${n.paintCode}`;
                            return (
                              <button
                                key={n.id}
                                type="button"
                                onClick={() => updateStepParam(step, "paint", pid)}
                                className="w-full flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs font-bold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                <span
                                  className="h-3.5 w-3.5 rounded-full border border-black/15 shrink-0"
                                  style={{ backgroundColor: n.hex }}
                                />
                                <span className="truncate">
                                  {localizedBrand(n.paintBrand, lang)} {n.paintCode} {n.paintName}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Inline Interactive Parameter Pills (Nozzle / Ratio / Pressure / Technique) */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* Nozzle Pill */}
                    {nozzle && nozzle !== "无" && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenMenu(
                              openMenu?.stepId === step.id && openMenu.field === "nozzle"
                                ? null
                                : { stepId: step.id, field: "nozzle" }
                            )
                          }
                          className="bp-pill inline-flex items-center gap-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200/80 dark:border-amber-800/80 px-2 py-0.5 text-[11px] font-mono font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-100 transition cursor-pointer"
                        >
                          <TargetIcon className="h-3 w-3" weight="bold" />
                          <span>{nozzle}</span>
                        </button>
                        {openMenu?.stepId === step.id && openMenu.field === "nozzle" && (
                          <div className="bp-subcard-lg absolute left-0 top-full mt-1 z-[100] w-72 max-w-[calc(100vw-3rem)] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 shadow-xl">
                            {NOZZLE_OPTIONS.map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => updateStepParam(step, "nozzle", opt.value)}
                                className="w-full rounded-lg px-2.5 py-1.5 text-left font-mono text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-slate-800"
                              >
                                <span>{opt.title}</span>
                                {showTechniqueHints && opt.subtitle && (
                                  <span className="text-[10px] font-normal text-slate-400 dark:text-slate-400 ml-1.5">
                                    · {opt.subtitle}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Ratio Pill */}
                    {ratio && ratio !== "无" && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenMenu(
                              openMenu?.stepId === step.id && openMenu.field === "ratio"
                                ? null
                                : { stepId: step.id, field: "ratio" }
                            )
                          }
                          className="bp-pill inline-flex items-center gap-1 rounded-lg bg-sky-50 dark:bg-sky-950/50 border border-sky-200/80 dark:border-sky-800/80 px-2 py-0.5 text-[11px] font-mono font-bold text-sky-700 dark:text-sky-300 hover:bg-sky-100 transition cursor-pointer"
                        >
                          <DropIcon className="h-3 w-3" weight="fill" />
                          <span>{ratio}</span>
                        </button>
                        {openMenu?.stepId === step.id && openMenu.field === "ratio" && (
                          <div className="bp-subcard-lg absolute left-0 top-full mt-1 z-[100] w-72 max-w-[calc(100vw-3rem)] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 shadow-xl">
                            {RATIO_OPTIONS.map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => updateStepParam(step, "ratio", opt.value)}
                                className="w-full rounded-lg px-2.5 py-1.5 text-left font-mono text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-slate-800"
                              >
                                <span>{opt.title}</span>
                                {showTechniqueHints && opt.subtitle && (
                                  <span className="text-[10px] font-normal text-slate-400 dark:text-slate-400 ml-1.5">
                                    · {opt.subtitle}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Pressure Pill */}
                    {pressure && pressure !== "无" && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenMenu(
                              openMenu?.stepId === step.id && openMenu.field === "pressure"
                                ? null
                                : { stepId: step.id, field: "pressure" }
                            )
                          }
                          className="bp-pill inline-flex items-center gap-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800/80 px-2 py-0.5 text-[11px] font-mono font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition cursor-pointer"
                        >
                          <WindIcon className="h-3 w-3" weight="bold" />
                          <span>{pressure}</span>
                        </button>
                        {openMenu?.stepId === step.id && openMenu.field === "pressure" && (
                          <div className="bp-subcard-lg absolute left-0 top-full mt-1 z-[100] w-80 max-w-[calc(100vw-3rem)] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 shadow-xl">
                            {PRESSURE_OPTIONS.map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => updateStepParam(step, "pressure", opt.value)}
                                className="w-full rounded-lg px-2.5 py-1.5 text-left font-mono text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-slate-800"
                              >
                                <span>{opt.title}</span>
                                {showTechniqueHints && opt.subtitle && (
                                  <span className="text-[10px] font-normal text-slate-400 dark:text-slate-400 ml-1.5">
                                    · {opt.subtitle}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Technique Pill */}
                    {technique && technique !== "无" && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenMenu(
                              openMenu?.stepId === step.id && openMenu.field === "technique"
                                ? null
                                : { stepId: step.id, field: "technique" }
                            )
                          }
                          className="bp-pill inline-flex items-center gap-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800/80 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition cursor-pointer"
                        >
                          <SlidersHorizontalIcon className="h-3 w-3" weight="bold" />
                          <span>重ね {technique}</span>
                        </button>
                        {openMenu?.stepId === step.id && openMenu.field === "technique" && (
                          <div className="bp-subcard-lg absolute left-0 top-full mt-1 z-[100] w-48 max-w-[calc(100vw-3rem)] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 shadow-xl max-h-60 overflow-y-auto">
                            {TECHNIQUE_OPTIONS.map((opt) => (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => updateStepParam(step, "technique", opt)}
                                className="w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-slate-800"
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* If no nozzle/ratio/pressure, show a subtle + 喷涂参数 button */}
                    {!nozzle && !ratio && !pressure && (
                      <button
                        type="button"
                        onClick={() => {
                          const nextSteps = steps.map((s) => {
                            if (s.id !== step.id) return s;
                            return {
                              ...s,
                              nozzle: "0.3mm",
                              ratioAndPressure: buildStepParams("1:2.0", "1.2bar/18psi", technique || "十字薄喷 2~3 遍", "0.3mm"),
                            };
                          });
                          onChangeSteps(nextSteps);
                        }}
                        className="bp-pill inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-400 hover:text-coral hover:border-coral transition"
                        title="为该步骤配置喷涂口径、稀释与气压"
                      >
                        <PlusIcon className="h-2.5 w-2.5" />
                        <span>喷涂参数</span>
                      </button>
                    )}
                  </div>

                  {/* NOMOKEN 1 Technique Tip Card */}
                  {showTechniqueHints && preset?.nomokenTip && (
                    <div className="bp-dashed-box flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-800 dark:text-amber-200/90 bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 rounded-xl px-2.5 py-1.5">
                      <span className="shrink-0 text-amber-600 dark:text-amber-400 font-bold">💡</span>
                      <span>
                        <strong className="font-semibold text-amber-900 dark:text-amber-100">《NOMOKEN 1》提示：</strong>
                        {preset.nomokenTip}
                      </span>
                    </div>
                  )}
                </div>

                {/* Right: Reorder Up/Down + Delete */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => moveStep(index, -1)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-30"
                    title="上移"
                  >
                    <ArrowUpIcon className="h-3.5 w-3.5" weight="bold" />
                  </button>
                  <button
                    type="button"
                    disabled={index === steps.length - 1}
                    onClick={() => moveStep(index, 1)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-30"
                    title="下移"
                  >
                    <ArrowDownIcon className="h-3.5 w-3.5" weight="bold" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteStep(step.id)}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-500 transition"
                    title="删除工序"
                  >
                    <TrashIcon className="h-3.5 w-3.5" weight="bold" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PaintingStepBuilderView;
