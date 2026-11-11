import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ChecklistRegionCategory } from "../../types";
import {
  buildDammizPreview,
  DammizApplyOptions,
  DammizImportMode,
  DammizImportPreview,
  dammizSchemeUrl,
  fetchDammizScheme,
  parseDammizSchemeId,
} from "../../utils/dammizImport";
import { REGION_CATEGORY_META, REGION_CATEGORY_ORDER } from "../../utils/partsChecklist";
import { RegionIcon } from "./RegionIcon";
import {
  ArrowSquareOutIcon,
  CheckCircleIcon,
  CheckIcon,
  CircleNotchIcon,
  ClipboardTextIcon,
  LinkSimpleIcon,
  WarningIcon,
  XIcon,
} from "@phosphor-icons/react";

const UNUSED_SECTION_RE = /废件|多余|不使用|未使用|余件/;

interface DammizImportDialogProps {
  open: boolean;
  onClose: () => void;
  /** 预填链接（如「重新同步」） */
  initialInput?: string;
  existing: { runners: number; regions: number; parts: number };
  onImport: (preview: DammizImportPreview, opts: DammizApplyOptions) => void;
}

export const DammizImportDialog: React.FC<DammizImportDialogProps> = ({
  open,
  onClose,
  initialInput = "",
  existing,
  onImport,
}) => {
  const [input, setInput] = useState(initialInput);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<DammizImportPreview | null>(null);
  const [categories, setCategories] = useState<Record<number, ChecklistRegionCategory>>({});
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [mode, setMode] = useState<DammizImportMode>("replace");
  const [syncTitle, setSyncTitle] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef(0);
  const hasExisting = existing.parts > 0 || existing.regions > 0;

  useEffect(() => {
    if (!open) return;
    setInput(initialInput);
    setError(null);
    setPreview(null);
    setLoading(false);
    setMode("replace");
    setSyncTitle(true);
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [open, initialInput]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  const parsedId = parseDammizSchemeId(input);

  const handleFetch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (loading) return;
    const id = parseDammizSchemeId(input);
    if (!id) {
      setError("没有识别到方案编号，请粘贴形如 https://www.dammiz.cn/picking/schemes/917 的分享链接");
      return;
    }
    const reqId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const scheme = await fetchDammizScheme(id);
      if (reqId !== requestIdRef.current) return;
      const pv = buildDammizPreview(scheme);
      setPreview(pv);
      setCategories(Object.fromEntries(pv.sections.map((s) => [s.index, s.category])));
      setExcluded(new Set(pv.sections.filter((s) => UNUSED_SECTION_RE.test(s.name)).map((s) => s.index)));
    } catch (err: any) {
      if (reqId !== requestIdRef.current) return;
      setPreview(null);
      setError(`读取失败：${err?.message || "请稍后重试"}`);
    } finally {
      if (reqId === requestIdRef.current) setLoading(false);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInput(text.trim());
        setError(null);
      }
    } catch {
      inputRef.current?.focus();
    }
  };

  const included = useMemo(
    () => (preview ? preview.sections.filter((s) => !excluded.has(s.index)) : []),
    [preview, excluded]
  );
  const includedParts = included.reduce((sum, s) => sum + s.partCount, 0);
  const includedRunners = new Set(included.flatMap((s) => s.runnerIds)).size;

  const handleConfirm = () => {
    if (!preview || included.length === 0) return;
    onImport(preview, {
      mode,
      categories,
      excluded,
      syncTitle,
      sourceUrl: dammizSchemeUrl(preview.scheme.id),
    });
  };

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[130] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dammiz-import-title"
        className="bp-subcard-lg flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-slate-200/85 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:rounded-3xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div className="min-w-0">
            <h3 id="dammiz-import-title" className="text-sm font-black text-slate-900 dark:text-white">
              从达米兹分享链接导入取件表
            </h3>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              只导入部位、板件号、零件号和数量，不带达米兹的板件实拍图。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="bp-pill grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"
          >
            <XIcon className="h-4 w-4" weight="bold" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* Step 1: link */}
          <form onSubmit={handleFetch} className="space-y-1.5">
            <label htmlFor="dammiz-link" className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
              分享链接或方案编号
            </label>
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <LinkSimpleIcon
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  weight="bold"
                />
                <input
                  id="dammiz-link"
                  ref={inputRef}
                  type="text"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    setError(null);
                  }}
                  placeholder="https://www.dammiz.cn/picking/schemes/917"
                  className="bp-input h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-[13px] font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <button
                type="button"
                onClick={handlePaste}
                title="从剪贴板粘贴"
                className="bp-pill hidden h-10 items-center gap-1 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:border-accent dark:border-slate-700 dark:text-slate-300 sm:inline-flex cursor-pointer"
              >
                <ClipboardTextIcon className="h-4 w-4" weight="bold" />
                <span>粘贴</span>
              </button>
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="bp-pill-active inline-flex h-10 min-w-[84px] items-center justify-center gap-1.5 rounded-xl bg-coral px-4 text-xs font-black text-white shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <CircleNotchIcon className="h-4 w-4 animate-spin" weight="bold" />
                    <span>读取中</span>
                  </>
                ) : (
                  <span>{preview ? "重新读取" : "读取方案"}</span>
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate-400" aria-live="polite">
              {parsedId ? (
                <>
                  已识别方案 <span className="font-mono font-bold text-slate-600 dark:text-slate-300">#{parsedId}</span>
                </>
              ) : (
                "在达米兹方案页点「分享」复制链接，整段文字直接粘贴也可以。"
              )}
            </p>
            {error && (
              <p
                role="alert"
                className="flex items-start gap-1.5 rounded-xl bg-red-50 px-3 py-2 text-[11px] font-bold text-red-600 dark:bg-red-500/10 dark:text-red-300"
              >
                <WarningIcon className="mt-px h-3.5 w-3.5 shrink-0" weight="bold" />
                <span>{error}</span>
              </p>
            )}
          </form>

          {/* Step 2: preview */}
          {preview && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-3.5 dark:border-slate-700 dark:bg-slate-800/60">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900 dark:text-white [text-wrap:balance]">
                      {preview.scheme.title}
                    </p>
                    {(preview.scheme.brandName || preview.scheme.productLineName || preview.scheme.kitName) && (
                      <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                        {[preview.scheme.brandName, preview.scheme.productLineName].filter(Boolean).join(" · ")}
                        {preview.scheme.kitName ? ` · ${preview.scheme.kitName}` : ""}
                      </p>
                    )}
                  </div>
                  <a
                    href={dammizSchemeUrl(preview.scheme.id)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="bp-pill inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-500 hover:text-accent dark:border-slate-700"
                  >
                    <span>#{preview.scheme.id}</span>
                    <ArrowSquareOutIcon className="h-3 w-3" weight="bold" />
                  </a>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11px] font-bold tabular-nums">
                  {[
                    `${included.length} 个部位`,
                    `${includedRunners} 块板件`,
                    `${includedParts} 件零件`,
                  ].map((t) => (
                    <span
                      key={t}
                      className="bp-badge rounded-full bg-white px-2.5 py-1 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <p className="mt-2 break-words font-mono text-[10px] leading-relaxed text-slate-400">
                  {preview.runnerIds.join(" · ")}
                </p>
              </div>

              {/* 部位映射 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">部位映射</span>
                  <span className="text-[10px] text-slate-400">已自动匹配部位图标，可手动修改</span>
                </div>
                <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 dark:divide-slate-800 dark:border-slate-700">
                  {preview.sections.map((s) => {
                    const off = excluded.has(s.index);
                    const cat = categories[s.index] ?? s.category;
                    return (
                      <li
                        key={s.index}
                        className={`flex items-center gap-2.5 px-3 py-2 transition ${off ? "opacity-45" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={!off}
                          aria-label={`导入「${s.name}」`}
                          onChange={() =>
                            setExcluded((prev) => {
                              const next = new Set(prev);
                              if (next.has(s.index)) next.delete(s.index);
                              else next.add(s.index);
                              return next;
                            })
                          }
                          className="h-4 w-4 shrink-0 accent-[var(--accent-color,#3b82f6)] cursor-pointer"
                        />
                        <span className="bp-region-icon grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          <RegionIcon category={cat} className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-black text-slate-900 dark:text-white">{s.name}</p>
                          <p className="truncate text-[10px] text-slate-400 tabular-nums">
                            {s.partCount} 件 · {s.runnerIds.length} 板（{s.runnerIds.join(" ")}）
                          </p>
                        </div>
                        <select
                          value={cat}
                          disabled={off}
                          aria-label={`「${s.name}」对应部位`}
                          onChange={(e) =>
                            setCategories((prev) => ({
                              ...prev,
                              [s.index]: e.target.value as ChecklistRegionCategory,
                            }))
                          }
                          className="bp-input h-8 max-w-[132px] shrink-0 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                        >
                          {REGION_CATEGORY_ORDER.map((c) => (
                            <option key={c} value={c}>
                              {REGION_CATEGORY_META[c].label}
                            </option>
                          ))}
                        </select>
                      </li>
                    );
                  })}
                </ul>
                {preview.sections.some((s) => UNUSED_SECTION_RE.test(s.name)) && (
                  <p className="text-[10px] text-slate-400">「废件」类部位默认不导入，需要的话勾选即可。</p>
                )}
              </div>

              {preview.skipped.length > 0 && (
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                  有 {preview.skipped.length} 个零件号不是数字，已跳过：{preview.skipped.slice(0, 6).join("、")}
                  {preview.skipped.length > 6 ? " …" : ""}
                </p>
              )}

              {/* 导入方式 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">导入方式</span>
                  <span className="text-[10px] font-semibold text-slate-400">
                    当前已选：{mode === "replace" ? "替换当前取件表" : "合并到现有取件表"}
                  </span>
                </div>
                <div
                  role="radiogroup"
                  aria-label="导入方式"
                  className="grid grid-cols-1 gap-2.5 sm:grid-cols-2"
                >
                  {(
                    [
                      {
                        id: "replace",
                        title: "替换当前取件表",
                        desc: hasExisting
                          ? `清空现有 ${existing.regions} 个部位 / ${existing.parts} 件，保留同名板件的颜色`
                          : "当前取件表为空，直接导入",
                      },
                      {
                        id: "merge",
                        title: "合并到现有取件表",
                        desc: "同名部位追加零件，其余部位新增",
                      },
                    ] as const
                  ).map((opt) => {
                    const active = mode === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-pressed={active}
                        onClick={() => setMode(opt.id)}
                        disabled={opt.id === "merge" && !hasExisting}
                        className={`relative rounded-2xl px-3.5 py-3 text-left transition disabled:opacity-40 cursor-pointer ${
                          active
                            ? "bp-subcard-active border-2 border-coral bg-coral/10 dark:bg-coral/15 ring-2 ring-coral/30 shadow-sm"
                            : "bp-subcard border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/50 opacity-80 hover:opacity-100 hover:border-slate-300 dark:hover:border-slate-600"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white">
                            {active ? (
                              <CheckCircleIcon
                                className="h-4 w-4 shrink-0 text-coral"
                                weight="fill"
                              />
                            ) : (
                              <span
                                aria-hidden
                                className="inline-block h-4 w-4 shrink-0 rounded-full border-2 border-slate-300 dark:border-slate-600"
                              />
                            )}
                            <span>{opt.title}</span>
                          </span>
                          {active && (
                            <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-black text-white dark:bg-white dark:text-slate-900">
                              <CheckIcon className="h-2.5 w-2.5" weight="bold" />
                              <span>已选中</span>
                            </span>
                          )}
                        </div>
                        <span className="mt-1 block pl-6 text-[10px] leading-relaxed text-slate-600 dark:text-slate-300">
                          {opt.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncTitle}
                    onChange={(e) => setSyncTitle(e.target.checked)}
                    className="h-4 w-4 accent-[var(--accent-color,#3b82f6)]"
                  />
                  <span>用方案名作为海报标题（{preview.scheme.title}）</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
          <span className="text-[10px] text-slate-400">导入后可到「制作编辑」给板件绑定油漆颜色</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="bp-pill rounded-full border border-slate-200 px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!preview || included.length === 0}
              className="bp-pill-active rounded-full bg-coral px-4 py-1.5 text-xs font-black text-white shadow-sm disabled:opacity-50 cursor-pointer tabular-nums"
            >
              {preview ? `导入 ${includedParts} 件` : "导入"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default DammizImportDialog;
