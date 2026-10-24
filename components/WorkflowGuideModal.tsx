import React from "react";
import {
  XIcon,
  PaletteIcon,
  FlaskIcon,
  FolderPlusIcon,
  ListChecksIcon,
  QrCodeIcon,
  PackageIcon,
  DownloadSimpleIcon,
  ArrowRightIcon,
  CheckCircleIcon,
} from "@phosphor-icons/react";

interface WorkflowGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveToProject?: () => void;
  onExportPng?: () => void;
  onNavigateToStudio?: () => void;
}

export const WorkflowGuideModal: React.FC<WorkflowGuideModalProps> = ({
  isOpen,
  onClose,
  onSaveToProject,
  onExportPng,
  onNavigateToStudio,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[95] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bp-modal-shell relative w-full max-w-xl max-h-[90dvh] flex flex-col overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-4 sm:px-5 py-3.5 bg-slate-50/80 dark:bg-slate-900/90">
          <div className="flex items-center gap-2">
            <span className="text-base">🧭</span>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                色卡保存与涂装项目库全流程指引
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                纯色卡图片 vs 涂装项目库 · 工序记录 · 二维码名片 · 工程打包
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 transition cursor-pointer"
          >
            <XIcon className="h-4 w-4" weight="bold" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 text-xs">
          {/* Core Distinction Banner */}
          <div className="rounded-2xl border border-amber-300/85 dark:border-amber-700/75 bg-amber-50/90 dark:bg-amber-950/35 p-3.5 space-y-2">
            <div className="font-black text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
              <span>💡</span>
              <span>制作完色卡后，两种保存方式有什么区别？</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-0.5">
              <div className="rounded-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-2.5 space-y-1">
                <div className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <DownloadSimpleIcon className="h-4 w-4 text-slate-600 dark:text-slate-300 shrink-0" weight="bold" />
                  <span>① 导出 PNG（纯静态色卡图）</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  直接生成带引线与色号标签的高清 PNG 图片保存到手机相册，适合直接发朋友圈或群聊展示，但<strong>导出后无法二次修改或添加工序</strong>。
                </p>
              </div>

              <div className="rounded-xl bg-white/95 dark:bg-slate-900/95 border-2 border-accent/60 p-2.5 space-y-1 shadow-2xs">
                <div className="font-black text-accent flex items-center gap-1.5">
                  <FolderPlusIcon className="h-4 w-4 shrink-0" weight="bold" />
                  <span>② 存入「涂装项目库」（强烈推荐）</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  保存为可随时修改的<strong>多零件涂装工程</strong>，支持<strong>继续添加喷涂工序</strong>、生成<strong>模友可扫码导入的二维码名片</strong>，以及<strong>打包 `.gkmix` 项目文件</strong>！
                </p>
              </div>
            </div>
          </div>

          {/* 3 Key Capabilities inside Paint Project Library */}
          <div className="space-y-2">
            <div className="text-[11px] font-black uppercase tracking-wider text-slate-400 px-0.5">
              存入「涂装项目库」后可解锁的 3 大核心功能：
            </div>

            <div className="rounded-2xl border border-slate-200/85 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 p-3 flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-coral text-white shadow-xs">
                <ListChecksIcon className="h-4 w-4" weight="bold" />
              </div>
              <div className="space-y-0.5">
                <div className="font-black text-slate-900 dark:text-white">
                  1. 继续添加涂装工序（底漆 / 阴影 / 主色 / 消光封层）
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  进入项目文件夹后切换到<strong>「涂装工序」</strong>页签，可一键<strong>智能推导工序</strong>或手动添加每一步的<strong>关联油漆、喷笔口径 (0.2~0.5mm)、稀释比、气压 (Bar/PSI) 与喷涂手法</strong>。
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/85 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 p-3 flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs">
                <QrCodeIcon className="h-4 w-4" weight="bold" />
              </div>
              <div className="space-y-0.5">
                <div className="font-black text-slate-900 dark:text-white">
                  2. 制作别人也可扫码导入的「项目二维码名片」
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  在项目文件夹顶部点击<strong>「二维码名片」</strong>，即可生成包含配色清单、工序流水线与专属二维码的海报卡片。其他玩家在「涂装库 ➔ 导入工程 ➔ 识别二维码名片」上传该图即可一键还原你的配方！
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/85 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 p-3 flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
                <PackageIcon className="h-4 w-4" weight="bold" />
              </div>
              <div className="space-y-0.5">
                <div className="font-black text-slate-900 dark:text-white">
                  3. 打包导出 `.gkmix` 完整项目工程文件
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  在项目右上角菜单 <strong>「••• ➔ 导出 .gkmix 工程文件」</strong>，可将该项目下所有零件的高清原图、悬浮色卡位置、滴数微调配方与工序打包成一个文件，发给模友或跨设备无损导入。
                </p>
              </div>
            </div>
          </div>

          {/* Bonus Tips */}
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-1.5">
            <div className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <FlaskIcon className="h-4 w-4 text-accent" weight="fill" />
              <span>贴心小技巧：准星选取器 & 双品牌漆试混</span>
            </div>
            <ul className="space-y-1 text-[11px] text-slate-500 dark:text-slate-400 list-disc pl-4 leading-relaxed">
              <li>
                <strong>竖屏取色准星选取器</strong>：手指按住准星圆环的<strong>底部边缘握柄</strong>拖动，取色点始终位于<strong>圆环正中心的十字准星</strong>，手指绝不挡视线。
              </li>
              <li>
                <strong>双品牌漆 Mixbox 试混</strong>：在新手模式「选漆与微调」预览图下方，可任选两款品牌漆按比例试混，并一键查找同色现成单瓶漆！
              </li>
            </ul>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 px-4 sm:px-5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {onExportPng && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onExportPng();
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-extrabold text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition cursor-pointer"
              >
                <DownloadSimpleIcon className="h-3.5 w-3.5" weight="bold" />
                <span>仅导出纯色卡 PNG</span>
              </button>
            )}
            {onSaveToProject && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSaveToProject();
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-accent hover:bg-accent-hover px-3.5 py-2 text-xs font-extrabold text-white shadow-sm transition cursor-pointer"
              >
                <FolderPlusIcon className="h-4 w-4" weight="bold" />
                <span>存入涂装项目库（加工序 / 二维码名片）➔</span>
              </button>
            )}
            {!onSaveToProject && onNavigateToStudio && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToStudio();
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-accent hover:bg-accent-hover px-3.5 py-2 text-xs font-extrabold text-white shadow-sm transition cursor-pointer"
              >
                <span>前往涂装项目库</span>
                <ArrowRightIcon className="h-3.5 w-3.5" weight="bold" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-xl bg-slate-900 dark:bg-white px-4 py-2 text-xs font-extrabold text-white dark:text-slate-900 cursor-pointer ml-auto"
          >
            <CheckCircleIcon className="h-3.5 w-3.5" weight="fill" />
            <span>知道了</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkflowGuideModal;
